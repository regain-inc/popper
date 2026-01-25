#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["pyyaml"]
# ///
"""
Analyze a Linear ticket to determine expert readiness.

Detects required domain experts from ticket keywords/labels,
checks if experts exist and have sufficient coverage,
and recommends actions (create, improve, or proceed).

Usage:
  uv run analyze-ticket-experts.py <ticket_id>
  uv run analyze-ticket-experts.py --json '<ticket_json>'
  uv run analyze-ticket-experts.py --title "Add webhooks" --description "..." --labels "billing,api"

Output:
  JSON with required_domains, expert_status, and recommendations
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

import yaml


# Paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = SKILL_DIR.parent.parent.parent
EXPERTS_DIR = PROJECT_ROOT / ".claude" / "experts"
KEYWORDS_FILE = SKILL_DIR / "data" / "domain-keywords.yaml"
LINEAR_SCRIPT = SKILL_DIR / "scripts" / "linear.sh"


def load_keywords() -> dict:
    """Load domain-keywords.yaml mapping."""
    if not KEYWORDS_FILE.exists():
        return {}
    with open(KEYWORDS_FILE) as f:
        return yaml.safe_load(f) or {}


def fetch_ticket(ticket_id: str) -> dict | None:
    """Fetch ticket from Linear API using linear.sh."""
    try:
        result = subprocess.run(
            ["bash", str(LINEAR_SCRIPT), "get", ticket_id],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        return None


def detect_domains(
    title: str,
    description: str,
    labels: list[str],
    keywords_map: dict,
) -> list[str]:
    """Detect required domains from ticket content."""
    detected = set()
    text = f"{title} {description}".lower()
    labels_lower = [l.lower() for l in labels]

    for domain, mapping in keywords_map.items():
        # Check labels
        domain_labels = [l.lower() for l in mapping.get("labels", [])]
        if any(dl in labels_lower or any(dl in l for l in labels_lower) for dl in domain_labels):
            detected.add(domain)
            continue

        # Check keywords in title/description
        domain_keywords = mapping.get("keywords", [])
        for keyword in domain_keywords:
            if keyword.lower() in text:
                detected.add(domain)
                break

    return sorted(detected)


def check_expert_exists(domain: str) -> bool:
    """Check if expert directory and expertise.yaml exist."""
    expert_dir = EXPERTS_DIR / domain
    expertise_file = expert_dir / "expertise.yaml"
    return expertise_file.exists()


def load_expertise(domain: str) -> dict | None:
    """Load expertise.yaml for a domain."""
    expertise_file = EXPERTS_DIR / domain / "expertise.yaml"
    if not expertise_file.exists():
        return None
    with open(expertise_file) as f:
        return yaml.safe_load(f) or {}


def calculate_pattern_coverage(
    expertise: dict,
    title: str,
    description: str,
) -> tuple[float, list[str]]:
    """Calculate pattern coverage for ticket content.

    Returns (score 0-1, list of gap descriptions).
    """
    patterns = expertise.get("patterns", [])
    if not patterns:
        return 0.0, ["No patterns defined"]

    text = f"{title} {description}".lower()
    matching = 0
    gaps = []

    # Check if any patterns are relevant to the ticket
    relevant_patterns = []
    for pattern in patterns:
        name = pattern.get("name", "")
        desc = pattern.get("description", "")
        pattern_text = f"{name} {desc}".lower()

        # Check for keyword overlap
        keywords = name.replace("-", " ").split() + desc.lower().split()
        for keyword in keywords:
            if len(keyword) > 3 and keyword in text:
                relevant_patterns.append(pattern)
                break

    if not relevant_patterns:
        # No patterns match the ticket - might need new ones
        gaps.append("No existing patterns match ticket keywords")
        return 0.3, gaps  # Low but not zero - expert exists

    # Check pattern status
    active_count = sum(1 for p in relevant_patterns if p.get("status") == "active")
    provisional_count = len(relevant_patterns) - active_count

    if active_count == 0 and provisional_count > 0:
        gaps.append(f"{provisional_count} relevant patterns still provisional")

    score = min(1.0, (active_count + provisional_count * 0.5) / max(1, len(relevant_patterns)))
    return score, gaps


def calculate_assumption_freshness(expertise: dict) -> tuple[float, list[str]]:
    """Calculate how fresh assumptions are.

    Returns (score 0-1, list of stale assumptions).
    """
    assumptions = expertise.get("assumptions", [])
    if not assumptions:
        return 0.5, ["No assumptions defined"]

    stale = []
    fresh_count = 0
    now = datetime.now()

    for assumption in assumptions:
        last_validated = assumption.get("last_validated")
        if not last_validated:
            stale.append(f"Never validated: {assumption.get('id', 'unknown')}")
            continue

        try:
            validated_date = datetime.strptime(last_validated, "%Y-%m-%d")
            days_old = (now - validated_date).days
            if days_old <= 14:
                fresh_count += 1
            elif days_old <= 30:
                fresh_count += 0.5
            else:
                stale.append(f"Stale ({days_old} days): {assumption.get('id', 'unknown')}")
        except ValueError:
            stale.append(f"Invalid date: {assumption.get('id', 'unknown')}")

    score = fresh_count / max(1, len(assumptions))
    return score, stale[:3]  # Limit to 3 stale assumptions in output


def calculate_key_file_coverage(
    expertise: dict,
    title: str,
    description: str,
) -> tuple[float, list[str]]:
    """Calculate if key_files cover ticket-mentioned files.

    Returns (score 0-1, list of missing coverage).
    """
    key_files = expertise.get("key_files", [])
    if not key_files:
        return 0.3, ["No key_files defined"]

    # Extract file mentions from ticket
    text = f"{title} {description}"
    file_patterns = re.findall(r'[\w/-]+\.(ts|tsx|py|yaml|yml|json|md)', text)

    if not file_patterns:
        # No files mentioned - assume key_files are OK
        return 0.8, []

    # Check if mentioned files match key_files patterns
    gaps = []
    matched = 0
    for file_mention in file_patterns:
        file_found = False
        for key_file in key_files:
            if file_mention in key_file or key_file.endswith(file_mention):
                file_found = True
                matched += 1
                break
        if not file_found:
            gaps.append(f"File not in key_files: {file_mention}")

    score = matched / max(1, len(file_patterns))
    return score, gaps[:3]


def calculate_coverage(
    domain: str,
    title: str,
    description: str,
) -> tuple[float, list[str]]:
    """Calculate overall coverage score for a domain expert.

    Returns (score 0-1, list of all gaps).
    """
    expertise = load_expertise(domain)
    if not expertise:
        return 0.0, ["Expert file could not be loaded"]

    all_gaps = []

    # Pattern coverage (40% weight)
    pattern_score, pattern_gaps = calculate_pattern_coverage(expertise, title, description)
    all_gaps.extend(pattern_gaps)

    # Assumption freshness (30% weight)
    assumption_score, assumption_gaps = calculate_assumption_freshness(expertise)
    all_gaps.extend(assumption_gaps)

    # Key file coverage (30% weight)
    file_score, file_gaps = calculate_key_file_coverage(expertise, title, description)
    all_gaps.extend(file_gaps)

    # Weighted average
    total_score = (
        pattern_score * 0.4 +
        assumption_score * 0.3 +
        file_score * 0.3
    )

    return round(total_score, 2), all_gaps


def generate_recommendation(
    exists: bool,
    coverage: float,
    gaps: list[str],
) -> str:
    """Generate recommendation based on expert status."""
    if not exists:
        return "create"
    if coverage >= 0.7:
        return "ready"
    return "improve"


def generate_expert_description(
    domain: str,
    title: str,
    description: str,
) -> str:
    """Generate a description for creating a new expert."""
    # Extract key terms from ticket
    text = f"{title} {description}"

    # Domain-specific default descriptions
    defaults = {
        "database": "Database schema, Drizzle ORM, PostgreSQL migrations",
        "backend": "API endpoints, Elysia.js controllers, middleware",
        "web": "Next.js pages, React components, i18n",
        "mobile": "Expo screens, React Native, navigation",
        "billing": "Payment processing, Polar.sh integration, webhooks",
        "cache": "Redis caching, invalidation strategies, performance",
        "infrastructure": "Deployment, CI/CD, monitoring, secrets management",
        "integrations": "External service clients, S2S auth, webhooks",
        "notifications": "Push notifications, FCM, scheduling",
        "programs": "Cohort management, content delivery, check-ins",
        "health-computation": "Health metrics, trends, time-series analysis",
    }

    return defaults.get(domain, f"{domain.replace('-', ' ').title()} domain functionality")


def analyze_ticket(
    ticket_id: str | None = None,
    ticket_json: str | None = None,
    title: str | None = None,
    description: str | None = None,
    labels: list[str] | None = None,
) -> dict:
    """Main analysis function."""
    # Get ticket data
    if ticket_json:
        try:
            ticket = json.loads(ticket_json)
        except json.JSONDecodeError:
            return {"error": "Invalid JSON"}
    elif ticket_id:
        ticket = fetch_ticket(ticket_id)
        if not ticket:
            return {"error": f"Could not fetch ticket {ticket_id}"}
    elif title:
        ticket = {
            "id": "MANUAL",
            "title": title,
            "description": description or "",
            "labels": labels or [],
        }
    else:
        return {"error": "No ticket data provided"}

    # Extract fields
    ticket_title = ticket.get("title", "")
    ticket_description = ticket.get("description", "") or ""
    ticket_labels = ticket.get("labels", [])
    if isinstance(ticket_labels, str):
        ticket_labels = [l.strip() for l in ticket_labels.split(",")]

    # Load keywords mapping
    keywords_map = load_keywords()
    if not keywords_map:
        return {"error": "Could not load domain-keywords.yaml"}

    # Detect required domains
    required_domains = detect_domains(
        ticket_title, ticket_description, ticket_labels, keywords_map
    )

    if not required_domains:
        return {
            "ticket_id": ticket.get("id", "unknown"),
            "title": ticket_title,
            "required_domains": [],
            "expert_status": {},
            "action_needed": "none",
            "message": "No specific domain experts detected for this ticket",
            "missing_experts": [],
            "experts_needing_improvement": [],
        }

    # Analyze each domain
    expert_status = {}
    missing_experts = []
    experts_needing_improvement = []

    for domain in required_domains:
        exists = check_expert_exists(domain)

        if not exists:
            expert_status[domain] = {
                "exists": False,
                "coverage_score": 0.0,
                "gaps": ["Expert does not exist"],
                "recommendation": "create",
                "create_command": f'/create-expert {domain} "{generate_expert_description(domain, ticket_title, ticket_description)}"',
            }
            missing_experts.append(domain)
        else:
            coverage, gaps = calculate_coverage(domain, ticket_title, ticket_description)
            recommendation = generate_recommendation(True, coverage, gaps)

            expert_status[domain] = {
                "exists": True,
                "coverage_score": coverage,
                "gaps": gaps,
                "recommendation": recommendation,
            }

            if recommendation == "improve":
                experts_needing_improvement.append(domain)
                expert_status[domain]["improve_command"] = f"/self-improve {domain}"

    # Determine overall action needed
    if missing_experts:
        action_needed = "create"
    elif experts_needing_improvement:
        action_needed = "improve"
    else:
        action_needed = "ready"

    return {
        "ticket_id": ticket.get("id", "unknown"),
        "title": ticket_title,
        "required_domains": required_domains,
        "expert_status": expert_status,
        "action_needed": action_needed,
        "missing_experts": missing_experts,
        "experts_needing_improvement": experts_needing_improvement,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Analyze a Linear ticket to determine expert readiness"
    )
    parser.add_argument(
        "ticket_id",
        nargs="?",
        help="Linear ticket ID (e.g., SAL-123)",
    )
    parser.add_argument(
        "--json",
        dest="ticket_json",
        help="Ticket data as JSON string",
    )
    parser.add_argument(
        "--title",
        help="Ticket title (for manual testing)",
    )
    parser.add_argument(
        "--description",
        help="Ticket description (for manual testing)",
    )
    parser.add_argument(
        "--labels",
        help="Comma-separated labels (for manual testing)",
    )

    args = parser.parse_args()

    labels = None
    if args.labels:
        labels = [l.strip() for l in args.labels.split(",")]

    result = analyze_ticket(
        ticket_id=args.ticket_id,
        ticket_json=args.ticket_json,
        title=args.title,
        description=args.description,
        labels=labels,
    )

    print(json.dumps(result, indent=2))

    # Exit with code based on action_needed
    action = result.get("action_needed", "ready")
    if action == "create":
        sys.exit(2)  # Missing experts
    elif action == "improve":
        sys.exit(1)  # Needs improvement
    else:
        sys.exit(0)  # Ready


if __name__ == "__main__":
    main()
