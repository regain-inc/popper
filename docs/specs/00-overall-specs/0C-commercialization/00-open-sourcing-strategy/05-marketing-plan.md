# Open Source Marketing Plan

> ⚠️ **Status: ON HOLD**
>
> We are using a **quiet open-source** approach: code is public but we're not
> actively marketing. This document is preserved for later if we decide to
> promote after ARPA-H selection.
>
> **Why quiet?**
> - Limited resources for community management
> - Demo is our primary differentiator for ARPA-H, not GitHub stars
> - Minimal IP risk (competitors can't copy and polish in time)
> - Can always promote later
>
> **When to revisit:**
> - If selected for Full Proposal (March 2026)
> - If we want metrics for Full Proposal narrative

---

## Strategy Summary (If/When We Market)

**Core message:** "The open standard for clinical AI safety"

**Primary channels:** Hacker News, GitHub, technical conferences

**Budget:** Minimal ($0-1K for launch, organic growth focus)

**Success metric:** TA2 teams adopt before ARPA-H proposals

---

## Launch Day Marketing (ON HOLD)

> **Skipped in quiet mode.** Preserved for reference if we decide to market later.

### Hacker News (Primary)

**Title options (pick one):**
```
Show HN: Hermes – Open protocol for clinical AI supervision (alpha)

Show HN: We're open-sourcing our clinical AI safety stack before applying to ARPA-H

Show HN: Hermes + Popper – Open source clinical AI supervision (alpha, feedback wanted)
```

**Best title:** First option (clearest, most technical)

**Optimal timing:** Tuesday or Wednesday, 10am ET

**Post text:**
```
We built Hermes, an open protocol for communication between clinical AI
agents and safety supervisors, and Popper, a reference implementation
of a supervisory agent.

We're open-sourcing both under Apache 2.0 before the ARPA-H ADVOCATE
program proposals are due. Our goal is to establish a standard that
any clinical AI system can use for safety supervision.

Hermes defines:
- SupervisionRequest/Response schemas
- Audit event formats
- Control commands (safe-mode, settings)
- Evidence and disclosure structures

Popper provides:
- A DSL for writing safety policies
- Clinical policy pack examples
- Measurement protocols for accuracy/hallucination
- Regulatory export bundle formats

We're applying for TA1 (the clinical reasoning agent) in ADVOCATE.
We decided to open-source TA2 (the supervisor) to reduce integration
risk for the program and establish an interoperability standard.

Links:
- Hermes: https://github.com/regain-inc/hermes
- Popper: https://github.com/regain-inc/popper
- Docs: https://hermes-protocol.dev

Happy to answer questions about the design decisions, clinical AI
safety, or our ARPA-H strategy.
```

### Response Strategy

**For the first 4 hours, respond to every comment.**

| Comment Type | Response Template |
|--------------|-------------------|
| Technical question | Detailed, helpful answer |
| Skepticism | Acknowledge concern, explain rationale |
| Comparison to X | Explain differences respectfully |
| "Why open source?" | Explain standard-setting strategy |
| Feature request | "Great idea, opened an issue" |

**Tone:** Humble, technical, mission-driven. Not salesy.

---

### Twitter/X (ON HOLD)

**Thread (post at same time as HN - if marketing):**

```
1/ We just open-sourced Hermes + Popper, our stack for clinical AI safety supervision.

Apache 2.0. Free forever.

Thread: why we're giving away 6 months of work 🧵

2/ Hermes is a protocol for communication between clinical AI agents
and their safety supervisors.

Think: HTTP for clinical AI oversight.

Schemas, audit formats, control commands.
github.com/regain-inc/hermes

3/ Popper is a reference TA2 (supervisory agent) implementation:
- Safety policy DSL
- Clinical rule evaluation
- Accuracy/hallucination measurement
- Regulatory exports

github.com/regain-inc/popper

4/ Why open-source before ARPA-H proposals are due?

We're applying for TA1 (the clinical reasoning engine).

By open-sourcing TA2, we:
- De-risk the program
- Establish the interop standard
- Focus on what we're best at

5/ Our bet: the team that creates the standard has an advantage,
even if they give away the code.

If every TA2 team uses Hermes, our TA1 integrates perfectly
with all of them.

6/ Want to build clinical AI that's safe by design?

Start here:
📦 npm install @regain/hermes-core
📦 npm install @regain/popper-dsl

Docs: hermes-protocol.dev

7/ Questions? Reply here or open an issue.

We're building in public and want feedback from the community.
```

### LinkedIn (ON HOLD)

```
We just open-sourced Hermes and Popper, our clinical AI safety stack.

Hermes is an open protocol for supervising clinical AI agents.
Popper is a reference implementation of a supervisory agent.

Both are Apache 2.0 licensed. Free forever.

Why are we doing this before ARPA-H ADVOCATE proposals are due?

1. We believe clinical AI safety should be a shared standard, not
   proprietary lock-in.

2. We're applying for TA1 (clinical reasoning). Open-sourcing TA2
   (supervision) de-risks the program.

3. The team that creates the standard has strategic advantage,
   even if the code is free.

If you're building clinical AI, health IT, or working on AI safety:
→ GitHub: github.com/regain-inc/hermes
→ Docs: hermes-protocol.dev

Happy to connect with others working on safe clinical AI.
```

---

## Week 1 Follow-Up (ON HOLD)

> **Skipped in quiet mode.** Focus instead on demo preparation and Solution Summary.

### Day 2-3: GitHub Engagement

- Star and thank early stargazers
- Respond to all issues within 24 hours
- Merge simple fixes quickly (shows active maintenance)

### Day 3-4: Technical Blog Post

**Title:** "Designing Hermes: Decisions and Trade-offs in Clinical AI Supervision"

**Outline:**
1. Why clinical AI needs a supervision protocol
2. Key design decisions (and alternatives we considered)
3. How Popper implements the protocol
4. What we learned from building this
5. Call to action: try it, give feedback

**Publish on:** Your blog, cross-post to dev.to and Medium

### Day 5-7: Secondary Channels

| Channel | Action |
|---------|--------|
| r/programming | Link to HN discussion |
| r/MachineLearning | Focus on safety/evaluation aspects |
| r/healthIT | Focus on interoperability |
| dev.to | Cross-post blog article |

---

## Month 1 Marketing (ON HOLD)

> **Skipped in quiet mode.**

### Content Calendar

| Week | Content |
|------|---------|
| Week 1 | Launch + design decisions blog |
| Week 2 | "Getting Started with Hermes" tutorial |
| Week 3 | "Writing Your First Popper Policy" tutorial |
| Week 4 | "Why We Open-Sourced" retrospective |

### Community Building

| Action | Effort |
|--------|--------|
| Answer every GitHub issue | Ongoing |
| Thank every contributor | Ongoing |
| Feature community uses | When they appear |
| Share on social when others mention | Ongoing |

---

## Conference Strategy (Later)

### Target Conferences

| Conference | Focus | Timeline |
|------------|-------|----------|
| **HIMSS** | Healthcare IT | Apply 6 months ahead |
| **AMIA** | Health informatics | Apply 6 months ahead |
| **FHIR DevDays** | Interoperability | Apply 4 months ahead |
| **AI in Healthcare Summit** | AI + health | Apply 4 months ahead |

### Talk Proposals

**Talk 1: "Open Standards for Clinical AI Safety"**
- Why clinical AI needs supervision
- Introduction to Hermes protocol
- Real-world adoption examples

**Talk 2: "Building a Safety DSL for Healthcare AI"**
- Technical deep-dive on Popper
- Policy evaluation architecture
- Measurement and validation

---

## Metrics to Track (If Marketing)

> **Not targeting these metrics in quiet mode.** Preserving for reference if we start marketing later.

### Launch Metrics

| Metric | Source | Target |
|--------|--------|--------|
| HN upvotes | Hacker News | 100+ |
| HN rank (peak) | Hacker News | Top 10 |
| GitHub stars (Hermes) | GitHub | 200+ week 1 |
| GitHub stars (Popper) | GitHub | 100+ week 1 |
| npm downloads | npm | 500+ week 1 |
| Twitter impressions | Twitter Analytics | 10K+ |

### Growth Metrics (Monthly)

| Metric | Target Month 1 | Target Month 3 |
|--------|----------------|----------------|
| GitHub stars (total) | 500 | 1,500 |
| npm downloads/month | 1,000 | 5,000 |
| Contributors | 5 | 15 |
| Issues opened | 20 | 50 |
| External blog mentions | 2 | 10 |

---

## Messaging Framework

### Core Message
"The open standard for clinical AI safety"

### Supporting Messages

| Audience | Message |
|----------|---------|
| **Developers** | "Build clinical AI that's safe by design" |
| **Health systems** | "Interoperability without vendor lock-in" |
| **Regulators** | "Transparent, auditable AI supervision" |
| **Researchers** | "A foundation for clinical AI safety research" |
| **Investors** | "We created the industry standard" |

### What NOT to Say

| Avoid | Why |
|-------|-----|
| "We're better than X" | Creates enemies, not friends |
| "Production-ready" | We're v0.x, be honest about maturity |
| "FDA-approved" | We're not approved, Hermes is a protocol |
| Overselling clinical capabilities | Liability risk |

---

## Budget

### Launch ($0-500)

| Item | Cost |
|------|------|
| Domain (hermes-protocol.dev) | $12 |
| Simple landing page (template) | $0-100 |
| Diagrams (Excalidraw/free tools) | $0 |
| **Total** | **$12-112** |

### Month 1-3 ($0-1000)

| Item | Cost |
|------|------|
| Landing page improvements | $0-200 |
| Documentation hosting (free tier) | $0 |
| Optional: Stickers for events | $200-500 |
| **Total** | **$0-700** |

### When to Invest More

| Trigger | Investment |
|---------|------------|
| Significant adoption | Landing page redesign |
| Conference acceptance | Travel budget |
| Enterprise interest | Sales collateral |
| Community growth | Swag, events |

---

## Anti-Goals

Things we're NOT trying to do with marketing:

| Anti-Goal | Why |
|-----------|-----|
| Viral consumer hit | We're B2B/enterprise |
| Massive community | Quality > quantity |
| Press coverage | Developers matter more |
| Aggressive promotion | Respect earns trust |

**Our marketing is simple:** Build something useful, tell people about it, be helpful.
