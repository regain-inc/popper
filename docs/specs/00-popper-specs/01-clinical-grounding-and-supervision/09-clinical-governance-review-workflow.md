# 09 — Clinical Governance Review Workflow

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

Popper is built by engineers. Clinical rules should not be authored by engineers alone. This document defines the governance workflow that ensures clinical rules are proposed, reviewed, approved, and maintained by people with the right clinical expertise — and that engineering implements but does not unilaterally decide clinical content.

---

## Roles

### Clinical Governance Board

**Composition:** Minimum 3 members:
- **Medical director** (physician, board-certified in relevant specialty)
- **Clinical pharmacist** (PharmD or equivalent)
- **Quality/compliance officer**

Optional members based on domain:
- Domain specialist (cardiologist, endocrinologist, nephrologist)
- Nursing representative
- Patient safety officer

**Responsibilities:**
- Approve new clinical rules and domain packs before activation
- Review and approve site protocol packs
- Adjudicate conflicts between guidelines
- Decide when emerging evidence warrants rule changes
- Conduct scheduled reviews of active rules
- Review and approve enforcement level assignments (HARD_STOP vs. ROUTE_TO_CLINICIAN)
- Review clinician override patterns and decide if rules need adjustment

### Domain Physician

**Role:** Subject matter expert for a specific clinical domain (e.g., cardiologist for HF rules, endocrinologist for diabetes rules).

**Responsibilities:**
- Interpret guideline recommendations and translate them into rule logic
- Review proposed rule conditions and enforcement levels for clinical accuracy
- Validate that rule explanations are clinically correct and useful to reviewing clinicians
- Flag when guidelines have been updated and existing rules may need revision

### Clinical Pharmacist

**Role:** Medication safety expert.

**Responsibilities:**
- Validate medication label citations (contraindications, interactions, dose limits)
- Review formulary data files for accuracy
- Ensure drug interaction rules are clinically appropriate
- Review REMS requirements for supervised medications

### Engineering Team

**Role:** Implement rules as specified by clinical governance. Own the mechanism, not the content.

**Responsibilities:**
- Translate clinically approved rule specifications into policy pack YAML
- Validate rule syntax, priority ordering, and pack compatibility
- Run automated tests against rule packs
- Deploy approved packs through the standard release process
- Build and maintain the policy engine, provenance model, and governance tooling
- Report on rule coverage, review status, and override patterns

### Compliance Officer

**Role:** Ensure governance process meets regulatory and accreditation requirements.

**Responsibilities:**
- Maintain governance process documentation
- Ensure review schedules are met
- Prepare audit documentation for external reviews
- Track regulatory changes that affect governance requirements

---

## Workflow: New Clinical Rule

### Step 1: Rule Proposal

**Who:** Domain physician, clinical pharmacist, or engineering team (identifying a gap)

**What:** A rule proposal document containing:
- **Clinical scenario** the rule addresses
- **Source citation** (guideline section, medication label section, etc.)
- **Proposed enforcement level** and rationale
- **Proposed rule conditions** (in plain clinical language, not YAML)
- **Proposed explanation text** (what the clinician sees when the rule fires)
- **Applicable population** and any exclusions
- **Proposed review interval**

**Format:** Free-form document or structured template. Does not need to be YAML at this stage.

### Step 2: Clinical Review

**Who:** Domain physician reviews clinical accuracy; clinical pharmacist reviews medication safety aspects

**What:**
- Verify the source citation is accurate and current
- Verify the proposed conditions capture the clinical intent correctly
- Verify the enforcement level is appropriate (not too aggressive, not too permissive)
- Verify the explanation text is accurate and helpful
- Identify any edge cases or populations where the rule should not apply
- Confirm the evidence grade and COR/LOE assignment

**Output:** Reviewed proposal with clinical sign-off or requested changes

### Step 3: Governance Board Approval

**Who:** Clinical governance board (minimum quorum)

**What:**
- Review the proposal and clinical review
- Approve enforcement level (especially any `HARD_STOP` classifications)
- Approve the rule's position in the source hierarchy
- Approve the review interval
- If the rule involves emerging evidence (Layer 5), decide whether to activate or defer
- Record the approval decision, date, and approvers

**Output:** Approved rule specification with governance sign-off

### Step 4: Engineering Implementation

**Who:** Engineering team

**What:**
- Translate the approved specification into YAML rule syntax
- Add structured provenance (`RuleProvenance` fields)
- Add the rule to the appropriate policy pack (domain pack, site pack, etc.)
- Write or update tests for the new rule
- Validate pack compatibility (no conflicts with existing rules)
- Run full policy engine test suite

**Output:** Pull request with new rule, tests, and updated pack version

### Step 5: Staging Validation

**Who:** Engineering + domain physician

**What:**
- Load the updated pack in a staging environment
- Run test scenarios that should trigger the new rule
- Run test scenarios that should NOT trigger the new rule (false positive check)
- Verify the audit event includes correct rule citation and provenance
- Domain physician reviews the explanation text as it would appear to a clinician

**Output:** Validation report

### Step 6: Production Activation

**Who:** Engineering (with governance board approval already obtained in Step 3)

**What:**
- Deploy the updated pack version to production
- Monitor drift signals for unexpected changes in decision distribution
- If decision distribution shifts unexpectedly, alert governance board

**Output:** Active rule in production with version tracking

---

## Workflow: Guideline Update

When a society publishes a new or updated guideline:

### Step 1: Notification

**Who:** Anyone on the team who becomes aware of the update

**What:** Notify the clinical governance board that a guideline has been updated

### Step 2: Impact Assessment

**Who:** Domain physician + engineering

**What:**
- Query the source registry for all rules derived from the updated guideline
- Review each affected rule against the new guideline version
- Classify changes: no impact, text update only, condition change, enforcement change, new rule needed, rule retirement needed

**Output:** Impact assessment document listing every affected rule and proposed action

### Step 3: Rule Updates

**Who:** Follow Steps 1-6 of the "New Clinical Rule" workflow for each affected rule

**Timeline:** Within 30 days of guideline publication for Layer 2 sources. Within 72 hours for Layer 1 sources (label changes).

### Step 4: Source Registry Update

**Who:** Engineering

**What:** Update the source registry with the new guideline version, publication date, and URL. Update `superseded_by` on the old entry.

---

## Workflow: Clinician Override Review

When clinician override rates change significantly:

### Step 1: Detection

**Who:** Automated drift detection or ops team

**What:** Override rate for a specific rule or rule category exceeds threshold (e.g., >30% override rate over 30 days)

### Step 2: Override Analysis

**Who:** Engineering + domain physician

**What:**
- Pull override data from audit trail (Hermes `ClinicianFeedbackEvent` records)
- Categorize overrides by rationale category (`RationaleCategory` in Hermes)
- Identify patterns: Are clinicians consistently overriding for the same reason?
- Is the override pattern clinically appropriate (e.g., guideline does not apply to this population)?

### Step 3: Governance Decision

**Who:** Clinical governance board

**What:** Decide one of:
- **Rule is correct; overrides are appropriate.** No change needed. Document the pattern for future reference.
- **Rule is too aggressive.** Adjust enforcement level (e.g., ROUTE_TO_CLINICIAN → REQUEST_MORE_INFO) or narrow the applicable population.
- **Rule is incorrect.** Fix the rule condition or retire the rule.
- **Clinician education needed.** Rule is correct but clinicians are not aware of the guideline. Training recommendation to facility.

---

## Scheduled Reviews

### Rule-Level Reviews

Each rule has a `review_interval_days` in its provenance. The governance board reviews rules on this schedule:

| Source Layer | Default Review Interval |
|---|---|
| Layer 1 (medication labels) | 90 days (labels can change frequently) |
| Layer 2 (society guidelines) | 365 days (or upon new guideline publication) |
| Layer 3 (site protocols) | 90-180 days (depending on site volatility) |
| Layer 4 (governance requirements) | 365 days (or upon new guidance publication) |
| Layer 5 (emerging evidence) | 90 days (pending promotion or retirement) |

### Pack-Level Reviews

Each policy pack has a pack-level review date. Pack review includes:
- Are all rules within the pack still current?
- Have any sources been superseded?
- Is the pack version in sync with its source versions?
- Are there new guidelines that should generate rules not yet in the pack?

### Source Registry Reviews

Quarterly review of the full source registry:
- Are all active sources still the most current version?
- Are there newly published sources that should be added?
- Are there sources with no derived rules (may indicate a gap)?
- Are there expired review dates?

---

## Emergency Safety Update Procedure

The standard governance workflow requires full board review. For urgent safety situations (FDA recall, new black box warning, critical safety communication), a faster path is needed.

### When this applies
- FDA safety communication requiring immediate label change
- Drug recall or market withdrawal
- Discovery of a critical interaction or contraindication not previously encoded
- Post-market surveillance signal meeting clinical significance threshold

### Emergency procedure
1. **Medical director OR clinical pharmacist** (either one, not both required) can authorize an emergency safety rule addition or modification
2. Emergency rules must be at Layer 1 priority (700-799, per normative priority table in `04-policy-pack-architecture.md`) and may only produce `HARD_STOP` or `ROUTE_TO_CLINICIAN`
3. Engineering implements and deploys within 72 hours (within 24 hours for recalls)
4. Emergency rule is tagged with `provenance.emergency: true` and `provenance.ratification_due` (date, typically 14 days)
5. Full governance board ratifies or modifies the emergency rule at the next available meeting, or within `ratification_due` deadline
6. If the board does not ratify within the deadline, the rule remains active (conservative default) and an alert escalates to the medical director

### What emergency procedure CANNOT do
- Cannot weaken or remove existing Layer 1 rules
- Cannot produce `APPROVED` decisions (emergency rules can only restrict, not loosen)
- Cannot bypass the ratification step — it only defers it

---

## Bootstrapping: Zero Board to First Draft Pack

The governance workflow assumes a clinical governance board exists. Before that board is established, Popper still needs a path from zero to first draft pack:

### Bootstrapping procedure
1. **Engineering + one physician advisor** develop a draft domain pack in a sandbox environment (not production)
2. Draft pack is tagged `pack_status: draft` and cannot be loaded in production
3. Draft pack is validated against test scenarios in staging
4. When a clinical governance board is established (minimum: one physician + one pharmacist), they review the draft pack as their first act
5. Board approves, modifies, or rejects the draft
6. Only board-approved packs transition to `pack_status: active` and become loadable in production

This procedure ensures no clinical rule reaches production without physician sign-off while allowing preparatory work to proceed before the governance board exists.

---

## What Engineering Owns vs. What Clinical Governance Owns

| Domain | Engineering Owns | Clinical Governance Owns |
|---|---|---|
| Rule mechanism | Policy engine, DSL parser, evaluator, loader | — |
| Rule content | Translating approved specs into YAML | Clinical accuracy, appropriateness, enforcement level |
| Rule testing | Automated tests, staging validation | Clinical scenario review |
| Activation decision | Deployment mechanics | Approval to activate |
| Override response | Data analysis, tooling | Clinical interpretation, rule adjustment |
| Source registry | Database, tooling, import/export | Which sources are authoritative, when to update |
| Provenance model | Data model, schema, validation | Correct citation, evidence grade, approval |
| Review schedule | Alerting, tracking | Conducting the review |

---

## Governance Documentation

The following documents should be maintained as part of the governance process:

1. **Active rules register** — list of all active rules with provenance, review status, and approval history
2. **Source registry** — all authoritative sources with version tracking and derived rule counts
3. **Override analysis reports** — quarterly analysis of clinician override patterns
4. **Governance meeting minutes** — decisions, approvals, and action items from governance board meetings
5. **Rule change log** — chronological record of all rule additions, modifications, and retirements

These documents are governance artifacts, not software features. They may live outside the Popper codebase (e.g., in a compliance document management system). Popper should provide the data (via audit trail, source registry API, pack metadata) that enables these documents to be produced.
