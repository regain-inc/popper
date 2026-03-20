---
name: linear
description: Work with Linear tickets - create, search, update issues, manage projects and cycles. Use when user mentions Linear, tickets, issues, or task management.
---

# Linear Skill

Lightweight Linear integration via API scripts. Replaces heavy MCP plugin (~33k tokens saved).

## Project Defaults

**Project:** Regain Health (Salomatic)
**Team:** Salomatic
**Default team for commands:** "MISS"

---

## CRITICAL: Repo-Aware Project Filtering

**When running from the `popper` repo**, all ticket queries MUST default to filtering by the **"Popper"** project unless the user explicitly asks for all projects or a different project.

### Automatic Behavior

| Repo | Default Project Filter |
|------|------------------------|
| `popper` | `Popper` |
| `salomatic` / `unified-health-app` | `Regain Health` |
| other repos | No filter (all projects) |

### Commands That Apply This Filter

When in `popper` repo, these commands auto-filter:
- `member <name>` → `project-member "Popper" <name>`
- `workload` → filter results to Popper project
- `status` → filter results to Popper project
- General "tickets" / "tasks" queries → `project-issues "Popper"`

### Explicit Override

User can override by saying:
- "all projects" / "все проекты" → no filter
- "unified health app tickets" → filter by that project
- "show all Harsh's tickets across projects" → no filter

---

## Popper Project Team

**Only 2 developers work on Popper:**

| Name | Role | Tickets | Focus |
|------|------|---------|-------|
| Davron Yuldashev | Backend/DevOps | 22 | All backend: DSL, policy engine, API, DB, auth, drift detection |
| Harsh Manwani | UI/UX Designer | 3 | Ops Dashboard UI only (status view, audit log, safe-mode controls) |

### Popper Ticket Summary

| Phase | Davron | Harsh | Total |
|-------|--------|-------|-------|
| Phase 1 | 3 (Done) | - | 3 |
| Phase 2 | 5 | - | 5 |
| Phase 3 | 3 | - | 3 |
| Phase 4 | 2 | - | 2 |
| Phase 5 | 3 | - | 3 |
| Phase 6 | 3 | - | 3 |
| Phase 7 | - | 3 | 3 |
| Phase 8 | 2 | - | 2 |
| Untagged | 1 | - | 1 |
| **Total** | **22** | **3** | **25** |

### Current Status (Popper)

- **Done:** 3 (Phase 1 foundation)
- **In Progress:** 1 (POP-004: Hermes Integration)
- **Backlog:** 21

### POP-XXX Ticket IDs

**You can use `POP-XXX` instead of `SAL-XXX`** for all Popper tickets. The system auto-resolves:

```bash
# These are equivalent:
linear.sh get POP-004
linear.sh get SAL-599

# Works for all commands:
linear.sh update POP-004 status "Done"
linear.sh comment POP-004 "Completed implementation"
```

| POP ID | SAL ID | Title |
|--------|--------|-------|
| POP-001 | SAL-596 | Project Foundation Setup |
| POP-002 | SAL-597 | TimescaleDB Database Setup |
| POP-003 | SAL-598 | Basic Elysia Server |
| POP-004 | SAL-599 | Hermes Package Integration |
| ... | ... | ... |
| POP-025 | SAL-620 | Test Fixtures & E2E Test Suite |

### Sub-Ticket Naming Convention (A/B System)

When adding related tickets that extend existing functionality, use the **A/B naming scheme**:

1. **Rename parent ticket** to include "A" suffix in title
   - `POP-013: Operational Settings API` → `POP-013A: Operational Settings API`

2. **Create child ticket** with "B" suffix
   - `POP-013B: Policy Lifecycle & Adaptability`

3. **Maintain dependencies**: B depends on A

**Rules:**
- **A** = original functionality (unchanged scope)
- **B** = extension/enhancement (new scope)
- **C, D...** = additional extensions if needed
- All sub-tickets share the same Linear labels for grouping
- B tickets should reference A tickets in description ("Depends on POP-XXA")

**Example A/B pairs:**
| Parent (A) | Extension (B) | Relationship |
|------------|---------------|--------------|
| POP-013A: Operational Settings API | POP-013B: Policy Lifecycle & Adaptability | Settings → versioned policies |
| POP-015A: Drift Baseline Calculation | POP-015B: RLHF Feedback Loop | Drift metrics → feedback integration |
| POP-023A: Export Bundle Generator | POP-023B: TEFCA/USCDI Compliance | Export → standards compliance |

**Commands for A/B workflow:**
```bash
# Step 1: Rename existing ticket to A
linear.sh update "POP-013" title "POP-013A: Operational Settings API"

# Step 2: Create B ticket
linear.sh create "MISS" "POP-013B: Policy Lifecycle & Adaptability" "Depends on POP-013A. Implements Safety DSL spec §10."

# Step 3: Add same labels
linear.sh label-add "POP-013B" "arpa"
linear.sh label-add "POP-013B" "phase-4"
```

### Popper-Specific Aliases

When in popper repo, these names map to Popper team only:
- `davr`, `davron`, `давр` → Davron Yuldashev
- `harsh`, `харш` → Harsh Manwani

Other team members (Anton, Ania, Katya) have NO Popper tickets.

### Team Members (with assigned tickets)

| Name | Role | Email | Aliases |
|------|------|-------|---------|
| Anton Kim | CEO | kim.anton@gmail.com | anton, антон |
| Anna Shevtsova | Full-Stack / AI Engineer | aniashevtsova@gmail.com | ania, аня, anna |
| Harsh Manwani | UI/UX Designer | harshmanwani56@gmail.com | harsh, харш |
| Katya Mun | Medical Domain Developer | ekaterina.mun@gmail.com | katya, катя |
| Davron Yuldashev | Backend/DevOps | d.yuldashev@example.com | davr, давр, davron |

**Note:** Salomatic Team is the project lead/organization and does NOT have tickets assigned.

### Ticket Distribution

| Phase | Anton | Anna | Harsh | Katya | Davron |
|-------|-------|------|-------|-------|--------|
| Phase 1 | 3 | 4 | 3 | 4 | 3 |
| Phase 2 | 4 | 4 | 3 | 4 | 3 |
| Phase 3 | 4 | 5 | 4 | 5 | 3 |
| Phase 4 | 4 | 5 | 4 | 4 | 3 |
| Phase 5 | 1 | - | 1 | 4 | - |
| Phase 6 | 1 | 6 | 4 | 4 | 4 |
| Phase 7 | 1 | 3 | 3 | 3 | 3 |
| Phase 8 | 1 | 6 | 6 | 5 | 2 |

**Note:** All team members use bundled tickets (one per section). Mobile tickets reassigned to Anton on 2025-12-30.

**Ticket numbering:**
- SAL-223, SAL-229, SAL-236, SAL-242: Phase 2 (Anton - mobile)
- SAL-251, SAL-258, SAL-263: Phase 3 (Anton - mobile)
- SAL-268, SAL-272, SAL-277, SAL-281, SAL-286, SAL-287, SAL-288: Phase 4 (Anton - mobile)
- SAL-289: Phase 5 (Anton - mobile)
- SAL-306: Phase 6 (Anton - mobile)
- SAL-336: Phase 7 (Anton - mobile)
- SAL-357: Phase 8 (Anton - mobile)
- SAL-399 to SAL-460: Phases 1-4 bundled (Anna, Harsh, Katya, Davron)

---

## CRITICAL: Language Rules

1. **Response language = Prompt language**
   - User writes in English → You respond in English
   - User writes in Russian → You respond in Russian
   - NEVER mix languages

2. **Ticket data = Always English**
   - All ticket titles and descriptions MUST be in English
   - If you fetch a ticket in Russian/other language → translate and update it automatically

3. **Auto-translation (silent)**
   - When fetching tickets, scan for Cyrillic/non-English text
   - Translate to English and update via: `linear.sh update <ID> title "English Title"`
   - Do NOT ask permission - just fix it silently

## Setup

Set your Linear API key:
```bash
export LINEAR_API_KEY="lin_api_xxxxx"
```

Get your key at: https://linear.app/settings/api

## Commands

### List My Issues
```bash
.claude/skills/linear/scripts/linear.sh my-issues
```

### List ALL Issues (across all teams) - USE THIS FOR "our tasks"
```bash
.claude/skills/linear/scripts/linear.sh all-issues [limit]
```

### List Team Issues (for a specific team)
```bash
.claude/skills/linear/scripts/linear.sh team-issues "Team Name" [limit]
```

### Search Issues
```bash
.claude/skills/linear/scripts/linear.sh search "query text"
```

### List Project Issues (filter by project)
```bash
.claude/skills/linear/scripts/linear.sh project-issues "Popper" [limit]
```

### Project Member Issues (filter by project + assignee)
```bash
.claude/skills/linear/scripts/linear.sh project-member "Popper" "Harsh"
```

### Get Issue Details
```bash
.claude/skills/linear/scripts/linear.sh get ISSUE-123
```

### Create Issue
```bash
.claude/skills/linear/scripts/linear.sh create "Team Name" "Title" "Description"
```

### Update Issue Status
```bash
.claude/skills/linear/scripts/linear.sh update ISSUE-123 status "In Progress"
```

### Add Comment
```bash
.claude/skills/linear/scripts/linear.sh comment ISSUE-123 "Comment text"
```

### List Teams
```bash
.claude/skills/linear/scripts/linear.sh teams
```

### List Projects
```bash
.claude/skills/linear/scripts/linear.sh projects
```

### List Cycles
```bash
.claude/skills/linear/scripts/linear.sh cycles "Team Name"
```

---

## CTO Dashboard Commands

Quick overview commands for team leads and CTOs.

### Status Breakdown (by state)
```bash
.claude/skills/linear/scripts/linear.sh status
```

### Workload (who's working on what)
```bash
.claude/skills/linear/scripts/linear.sh workload
```

### Blocked Issues
```bash
.claude/skills/linear/scripts/linear.sh blocked
```

### Urgent/High Priority
```bash
.claude/skills/linear/scripts/linear.sh urgent
```

### Current Sprint Progress
```bash
.claude/skills/linear/scripts/linear.sh cycle-status [team]
```

### Recently Updated (last N hours)
```bash
.claude/skills/linear/scripts/linear.sh recent [hours]
```

### Unassigned Issues
```bash
.claude/skills/linear/scripts/linear.sh unassigned
```

### Team Member Issues
```bash
.claude/skills/linear/scripts/linear.sh member "Anton"
.claude/skills/linear/scripts/linear.sh member "Davr"
.claude/skills/linear/scripts/linear.sh member "Ania"
.claude/skills/linear/scripts/linear.sh member "Harsh"
.claude/skills/linear/scripts/linear.sh member "Katya"
```
Supports aliases: anton/антон, davr/давр, ania/аня, harsh/харш, katya/катя

### Full Summary (combines all above)
```bash
.claude/skills/linear/scripts/linear.sh summary
```

---

## Sprint Management Commands

Full sprint/cycle lifecycle management: create, update, archive, and assign issues.

### Create New Sprint
```bash
.claude/skills/linear/scripts/linear.sh cycle-create "Team Name" "Sprint Name" "YYYY-MM-DD" "YYYY-MM-DD"
```
Example:
```bash
.claude/skills/linear/scripts/linear.sh cycle-create "MISS" "Sprint 1: Foundation" "2025-01-06" "2025-01-19"
```

### Update Sprint
```bash
.claude/skills/linear/scripts/linear.sh cycle-update <cycle-id> <field> <value>
```
Fields: `name`, `starts`, `ends`, `description`

Examples:
```bash
.claude/skills/linear/scripts/linear.sh cycle-update abc123 name "Sprint 1 - Extended"
.claude/skills/linear/scripts/linear.sh cycle-update abc123 ends "2025-01-21"
```

### Archive/Close Sprint
```bash
.claude/skills/linear/scripts/linear.sh cycle-archive <cycle-id>
```

### Add Issue to Sprint
```bash
.claude/skills/linear/scripts/linear.sh cycle-add <issue-id> <cycle-id>
```
Example:
```bash
.claude/skills/linear/scripts/linear.sh cycle-add SAL-123 abc123
```

### Remove Issue from Sprint
```bash
.claude/skills/linear/scripts/linear.sh cycle-remove <issue-id>
```

### List Issues in Sprint
```bash
.claude/skills/linear/scripts/linear.sh cycle-issues <cycle-id>
```

### Setup Roadmap Sprints (Bulk Create)
```bash
.claude/skills/linear/scripts/linear.sh cycle-setup-roadmap "Team Name" "YYYY-MM-DD"
```
Creates 8 phases as cycles based on the project roadmap:
- Phase 1: Foundation (Weeks 1-2)
- Phase 2: Core Data & AI (Weeks 3-4)
- Phase 3: MVP Polish (Weeks 5-6)
- Phase 4: Programs & Billing (Weeks 7-8)
- Phase 5: Launch (Weeks 9-10)
- Phase 6: Labs & Advanced (Weeks 11-14)
- Phase 7: Clinical Services (Weeks 15-18)
- Phase 8: Mini-Apps (Weeks 19-22)

Example:
```bash
.claude/skills/linear/scripts/linear.sh cycle-setup-roadmap "MISS" "2025-01-06"
```

### Natural Language → Sprint Commands

| Query | Command |
|-------|---------|
| "create sprint" / "создай спринт" | `cycle-create` |
| "add to sprint" / "добавь в спринт" | `cycle-add` |
| "setup roadmap sprints" / "настрой спринты по роадмапу" | `cycle-setup-roadmap` |
| "update sprint dates" / "измени даты спринта" | `cycle-update` |
| "close sprint" / "закрой спринт" | `cycle-archive` |
| "sprint issues" / "задачи спринта" | `cycle-issues` |

---

## Label Management

Manage labels on issues.

### Create Label
```bash
.claude/skills/linear/scripts/linear.sh label-create "label-name" "#FF0000"
```

### Add Label to Issue
```bash
.claude/skills/linear/scripts/linear.sh label-add SAL-123 "phase-1"
```

### Remove Label from Issue
```bash
.claude/skills/linear/scripts/linear.sh label-remove SAL-123 "phase-1"
```

---

## Project & Phase Sync

Automatically assign all tickets to the default project and apply phase labels from the roadmap mapping.

### Sync Everything (Recommended)
```bash
.claude/skills/linear/scripts/linear.sh sync-all
```

This command:
1. Assigns all tickets without a project to "Regain Health"
2. Applies correct phase labels based on `data/ticket-phase-map.yaml`

### Sync Project Only
```bash
.claude/skills/linear/scripts/linear.sh sync-project [project-name]
```
Default: "Regain Health"

### Sync Phase Labels Only
```bash
.claude/skills/linear/scripts/linear.sh sync-phases
```
Reads mappings from `data/ticket-phase-map.yaml`.

### Auto-Assignment on Create

New tickets created via `linear.sh create` are automatically assigned to the "Regain Health" project.

---

## Phase Commands

All tickets are tagged with phase labels (`phase-1` through `phase-8`) for roadmap tracking.

### List Phase Issues
```bash
.claude/skills/linear/scripts/linear.sh phase 1      # List Phase 1 issues
.claude/skills/linear/scripts/linear.sh phase 2      # List Phase 2 issues
```

### Phase Summary (with team breakdown)
```bash
.claude/skills/linear/scripts/linear.sh phase-summary
```

Returns phase × status × member matrix:
```json
{
  "phase": "phase-1",
  "total": 20,
  "backlog": 18,
  "in_progress": 2,
  "done": 0,
  "by_member": [
    {"name": "r4topunk.eth@gmail.com", "count": 10},
    {"name": "aniashevtsova@gmail.com", "count": 5}
  ]
}
```

### Setup Phase Labels (one-time)
```bash
.claude/skills/linear/scripts/linear.sh phase-labels-setup
```
Creates all 8 phase labels with distinct colors.

### Auto-Apply Phase Labels
```bash
.claude/skills/linear/scripts/linear.sh phase-apply
```
Applies phase labels based on `[P1]`, `[P2]`, etc. title prefixes.

### Natural Language → Phase Commands

| Query | Command |
|-------|---------|
| "phase 1 tasks" / "задачи фазы 1" | `phase 1` |
| "phase breakdown" / "разбивка по фазам" | `phase-summary` |
| "add SAL-123 to phase 2" | `label-add SAL-123 phase-2` |
| "which phase is SAL-123?" | `get SAL-123` (check labels) |

---

## Standup Data Command

Get all data needed for standup reports in one call.

### Usage
```bash
.claude/skills/linear/scripts/linear.sh standup-data "YYYY-MM-DD" [assignee]
```

### Parameters
- `since-date` (required): Date in YYYY-MM-DD format
- `assignee` (optional): Filter by team member (supports aliases: rato, davr, ania, harsh, katya)

### Output Structure
```json
{
  "since_date": "2025-12-27",
  "completed": [...],
  "completed_count": 5,
  "in_progress": [...],
  "in_progress_count": 2,
  "in_review": [...],
  "in_review_count": 1,
  "upcoming": [...],
  "upcoming_count": 10,
  "blocked": [...],
  "blocked_count": 0
}
```

### Examples
```bash
# All team's standup data since Dec 27
.claude/skills/linear/scripts/linear.sh standup-data "2025-12-27"

# Rato's standup data since last Thursday
.claude/skills/linear/scripts/linear.sh standup-data "2025-12-26" "Rato"
```

### Natural Language → Standup Commands

| Query | Command |
|-------|---------|
| "standup data since Monday" | `standup-data "2025-12-23"` |
| "my standup since yesterday" | `standup-data "2025-12-29" "Rato"` |
| "what did Ania do this week" | `standup-data "2025-12-23" "Ania"` |

---

## Usage Examples

### IMPORTANT: Interpreting user intent

**Task queries:**
- "какие у нас таски/задачи" / "what tasks do we have" / "our issues" → `all-issues`
- "мои таски" / "my tasks" / "assigned to me" → `my-issues`

**CTO Dashboard queries:**
- "кто над чем работает?" / "who is working on what?" → `workload`
- "статус задач" / "status overview" → `status`
- "что заблокировано?" / "what's blocked?" → `blocked`
- "срочные задачи" / "urgent tasks" → `urgent`
- "прогресс спринта" / "sprint progress" → `cycle-status`
- "что изменилось?" / "what changed?" → `recent`
- "неназначенные" / "unassigned" → `unassigned`
- "полный обзор" / "summary" → `summary`

**Team member queries:**
- "что делает Давр?" / "what is Davr working on?" → `member "Davr"`
- "таски Антона" / "Anton's tasks" → `member "Anton"`
- "задачи Ани" / "Ania's issues" → `member "Ania"`
- "над чем работает Harsh?" → `member "Harsh"`

### Quick Examples

User: "какие у нас таски есть?"
→ `.claude/skills/linear/scripts/linear.sh all-issues`

User: "кто над чем работает?"
→ `.claude/skills/linear/scripts/linear.sh workload`

User: "что делает Давр?"
→ `.claude/skills/linear/scripts/linear.sh member "Davr"`

User: "статус спринта"
→ `.claude/skills/linear/scripts/linear.sh cycle-status`

User: "Show Harsh's tasks"
→ Run: `.claude/skills/linear/scripts/linear.sh assigned-to "Harsh"`

User: "Create a bug ticket for login issue"
→ `.claude/skills/linear/scripts/linear.sh create "MISS" "Login button not working" "Users report..."`

### Repo-Aware Examples (from `popper` repo)

User: "what are Harsh's tickets?"
→ `.claude/skills/linear/scripts/linear.sh project-member "Popper" "Harsh"`
(Auto-filters to Popper project - returns 3 UI tickets)

User: "Davron's tasks" / "what is davr working on?"
→ `.claude/skills/linear/scripts/linear.sh project-member "Popper" "Davron"`
(Auto-filters to Popper project - returns 22 backend tickets)

User: "show all tasks" / "our tickets"
→ `.claude/skills/linear/scripts/linear.sh project-issues "Popper"`
(Auto-filters to Popper project - returns 25 total tickets)

User: "show Harsh's tickets across all projects"
→ `.claude/skills/linear/scripts/linear.sh member "Harsh"`
(No project filter - explicit override, returns 79 tickets)

User: "who's working on popper?"
→ Show Popper team summary: Davron (22), Harsh (3)

## Output Format

All commands return JSON for easy parsing. Parse with `jq` if needed.

---

## Git Automation

Automatic ticket status updates on git events. Requires `LINEAR_API_KEY` in environment or `.env` file.

### How it works

| Event | Trigger | Status Change |
|-------|---------|---------------|
| Commit | Issue ID in commit message (e.g., `SAL-123`) | → **In Progress** |
| Push | Issue ID in pushed commits | → **In Review** |

### Commit message format

Include the issue ID anywhere in your commit message:
```bash
git commit -m "SAL-123: Fix login button alignment"
git commit -m "Implement dark mode [SAL-456]"
git commit -m "Quick fix for SAL-789"
```

Pattern: `[A-Z]{2,5}-[0-9]+` (e.g., SAL-123, PROJ-45, ENG-1)

### Status transitions

```
Backlog/Todo → (commit) → In Progress → (push) → In Review → (manual) → Done
```

- **post-commit**: Moves to "In Progress" + adds commit reference as comment
- **post-push**: Moves to "In Review" + adds push/branch info as comment
- Completed issues (Done, Completed, Cancelled) are never reopened

### Setup

Hooks are installed in `.git/hooks/`:
- `post-commit` - Runs after each commit
- `pre-push` + `post-push` - Runs after successful push

To disable temporarily:
```bash
git commit --no-verify -m "message"
git push --no-verify
```

### Troubleshooting

If hooks don't work:
1. Check `LINEAR_API_KEY` is exported or in `.env`
2. Verify hooks are executable: `ls -la .git/hooks/post-commit`
3. Test manually: `.git/hooks/post-commit`

---

## Work on Task (Expert System Integration)

When user says **"выполни/работай над/начни SAL-123"** or **"work on/implement/start SAL-123"**:

### Workflow

```
1. FETCH: .claude/skills/linear/scripts/linear.sh get SAL-123
2. STATUS: .claude/skills/linear/scripts/linear.sh update SAL-123 status "In Progress"
3. ANALYZE: Apply "Expert System (MANDATORY)" from CLAUDE.md
4. EXECUTE: Follow the expert chain determined by analysis
5. COMPLETE:
   → .claude/skills/linear/scripts/linear.sh comment SAL-123 "Implementation summary..."
   → .claude/skills/linear/scripts/linear.sh update SAL-123 status "In Review"
```

**Key:** Step 3 uses the existing Task Analysis Process from CLAUDE.md — no duplication.

### Triggers

| Phrase | Action |
|--------|--------|
| "выполни SAL-123" / "work on SAL-123" | Full workflow above |
| "начни SAL-123" / "start SAL-123" | Full workflow above |
| "implement SAL-123" / "do SAL-123" | Full workflow above |

---

## Expert Readiness Check (Fully Automatic)

Before starting work on any ticket, the system automatically ensures expert readiness. This step runs between FETCH and STATUS in the workflow above.

### Updated Workflow

```
1. FETCH: linear.sh get SAL-123
2. EXPERT CHECK: uv run analyze-ticket-experts.py SAL-123  ← NEW
   → Auto-creates missing experts (silent)
   → Auto-improves low-coverage experts (silent)
   → Logs actions to ticket comment
3. STATUS: linear.sh update SAL-123 status "In Progress"
4. ANALYZE: Apply Expert System from CLAUDE.md
5. EXECUTE: Follow expert chain with verified experts
6. COMPLETE: Add comment + update status "In Review"
```

### How It Works

The analysis script detects required domains from:
1. **Labels**: `database`, `api`, `billing`, etc.
2. **Keywords**: `schema`, `endpoint`, `webhook`, etc.
3. **File mentions**: `schema.ts`, `controller.ts`, etc.

See `data/domain-keywords.yaml` for full mapping.

### Automatic Actions (No User Confirmation)

**Missing Expert → Auto-Create**
```
[AUTO] Creating "payments" expert for SAL-123...
       Running: /create-expert payments "Payment processing, Polar.sh, webhooks"
       ✓ Expert created with 7 patterns, 5 assumptions
       Continuing with ticket...
```

**Low Coverage Expert → Auto-Improve**
```
[AUTO] Improving "billing" expert (coverage: 0.4 → target: 0.7)...
       Gaps: webhook patterns, Polar.sh assumptions
       Running: /self-improve billing
       ✓ Added 3 patterns, validated 2 assumptions
       Continuing with ticket...
```

### Coverage Thresholds

| Score | Status | Automatic Action |
|-------|--------|------------------|
| >= 0.7 | Ready | Proceed immediately |
| 0.4 - 0.7 | Improvable | Auto-run `/self-improve`, then proceed |
| < 0.4 | Insufficient | Auto-run `/self-improve` with extra focus, then proceed |
| N/A | Missing | Auto-run `/create-expert`, then proceed |

### Coverage Score Formula

```
coverage = pattern_coverage * 0.4 + assumption_freshness * 0.3 + key_file_coverage * 0.3
```

- **Pattern coverage**: Do expert patterns match ticket keywords?
- **Assumption freshness**: Are assumptions recently validated? (>30 days = stale)
- **Key file coverage**: Do key_files include ticket-mentioned files?

### Logging

All automatic actions are logged to the ticket as a comment:
```
🤖 Expert System Preparation:
- Created "payments" expert (v1.0.0)
- Improved "billing" expert (coverage: 0.4 → 0.75)
```

### Manual Analysis (Optional)

Run the analysis script directly:
```bash
# By ticket ID
uv run .claude/skills/linear/scripts/analyze-ticket-experts.py SAL-123

# With manual input
uv run .claude/skills/linear/scripts/analyze-ticket-experts.py \
  --title "Add payment webhooks" \
  --description "Implement Polar.sh webhook handling" \
  --labels "billing,api"

# With JSON input
uv run .claude/skills/linear/scripts/analyze-ticket-experts.py \
  --json '{"title":"Add webhooks","labels":["billing"]}'
```

**Exit codes:**
- 0 = All experts ready
- 1 = Experts need improvement
- 2 = Experts missing

---

## CRITICAL: Interactive Follow-Ups (Numbered Options)

After displaying Linear command output, ALWAYS show numbered options in text. User can reply with just a number (1, 2, 3...) to continue. Do NOT use the AskUserQuestion tool - it blocks the response. Do NOT include "Done" option - user will simply stop responding if they're done.

### Output Format

End every Linear response with a "Next?" section showing 3-4 numbered options:

```
**Next?**
1. View blocked issues
2. Check Anton's tasks
3. Sprint progress
```

User replies "2" → run `member "Anton"`

### Follow-Up Matrix (by command)

**When in `popper` repo, use Popper-specific options:**

| Command | Numbered Options (Popper) |
|---------|---------------------------|
| `project-issues "Popper"` | 1. Davron's tasks (22) 2. Harsh's tasks (3) 3. Phase breakdown |
| `project-member` | 1. [Other Popper dev] 2. View ticket details 3. All Popper tasks |

**For other repos:**

| Command | Numbered Options |
|---------|------------------|
| `summary` | 1. Blocked 2. Urgent 3. Anton's tasks 4. All members breakdown |
| `workload` | 1. Anton (19) 2. Katya (33) 3. Ania (33) 4. Harsh (28) 5. Davr (22) 6. Unassigned |
| `status` | 1. In Progress 2. Backlog tasks 3. Full summary |
| `blocked` | 1. View [issue] 2. Urgent tasks 3. Team workload |
| `urgent` | 1. View [issue] 2. Blocked 3. Sprint status |
| `member` | List ALL other members: 1. Anton 2. Katya 3. Ania 4. Harsh 5. Davr (exclude current) |
| `cycle-status` | 1. View sprint issues 2. Create new sprint 3. Team workload |
| `cycles` | 1. View sprint issues 2. Create new sprint 3. Archive sprint |
| `cycle-create` | 1. Add issues to sprint 2. View sprint 3. Create another sprint |
| `cycle-issues` | 1. Add more issues 2. Update sprint 3. Team workload |
| `phase N` | 1. Phase summary 2. Other phases (1-8) 3. Team workload |
| `phase-summary` | 1. Phase 1 2. Phase 2 3. Phase 3 4. [continue for all] |

**IMPORTANT:** After `workload` or `member` commands, list team members as options based on the current project:
- **Popper repo:** Only Davron and Harsh (the 2 Popper developers)
- **Other repos:** All team members (Anton, Katya, Ania, Harsh, Davr)

### Smart Prioritization

Order options by what's notable in the output:
- Blocked > 0 → "Blocked issues" first
- Unassigned > 3 → "Unassigned tasks" prominent
- Member with most in-progress → Show that member

### Language Matching

**English prompt:**
```
**Next?**
1. View blocked
2. Anton's tasks
3. Sprint progress
```

**Russian prompt:**
```
**Дальше?**
1. Заблокированные
2. Таски Антона
3. Прогресс спринта
```
