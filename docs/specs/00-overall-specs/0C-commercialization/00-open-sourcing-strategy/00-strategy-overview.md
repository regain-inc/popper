# Open Source Strategy: Hermes + Popper

## Executive Summary

We will fully open-source Hermes (protocol) and Popper (TA2 implementation) using a **two-phase Alpha → Production progression**:

| Phase | Target Date | Version | ARPA-H Milestone |
|-------|-------------|---------|------------------|
| **Alpha Launch** | Feb 1-15, 2026 | v0.1.0 | Before Solution Summary (Feb 27) |
| **Production Release** | Late March 2026 | v1.0.0 | Before Full Proposal (April 1) |

This establishes us as the creators of the industry standard for clinical AI supervision, strengthens our TA1 (Deutsch) proposal, and creates multiple value capture mechanisms.

**Core Principle:** Open source is not charity. It's a distribution strategy that funnels demand to paid offerings.

```
Hermes (free) → Certification (paid)
Hermes (free) → Regain Cloud (paid)
Hermes (free) → Deutsch (paid)
Hermes (free) → Consulting (paid)

The protocol is the funnel. The products are the revenue.
```

---

## Quiet Open-Source Approach

**Decision:** Put code on GitHub without active marketing/promotion.

### Why Quiet Open-Source?

| Reason | Explanation |
|--------|-------------|
| **Limited resources** | We don't have capacity for active community management |
| **Demo is our differentiator** | ARPA-H reviewers see working demo, not GitHub stars |
| **Low IP risk** | Competitors can't copy and polish in time for Feb 27 deadline |
| **Minimal effort** | Just push to GitHub, skip marketing campaigns |
| **Preserves optionality** | Can always promote later if selected |

### What We Skip

| Activity | Why Skip |
|----------|----------|
| ❌ Hacker News "Show HN" post | Requires 4+ hours for launch day response |
| ❌ Twitter/X thread | Maintenance overhead |
| ❌ LinkedIn announcement | Professional audience, but not our priority |
| ❌ Blog posts and tutorials | Resource intensive |
| ❌ Active community engagement | Can't staff it |

### What We Still Do

| Activity | Why Keep |
|----------|----------|
| ✅ Push to GitHub (public repos) | ARPA-H needs to see code |
| ✅ Add alpha warning to README | Manages expectations |
| ✅ Reference in Solution Summary | Core differentiator |
| ✅ Share with TA3 partners | Reduces their technical risk |
| ✅ Respond to issues if any | Basic maintenance |

### Trade-off Analysis

| Scenario | Stage 1 Chance | Notes |
|----------|---------------|-------|
| Full promotion | 65-75% | More work, marginal benefit |
| **Quiet open-source** | **60-70%** | **Chosen approach** - minimal effort |
| No open-source | 55-65% | Loses differentiation |

**5% variance is within margin of error.** Demo + code availability matters more than stars/downloads.

### Who Knows About the Repos?

| Audience | Certainty | Impact |
|----------|-----------|--------|
| **ARPA-H reviewers** | Certain | We reference repos in Solution Summary |
| **TA3 partners we share with** | Certain | Reduces their technical risk |
| **Competitors monitoring GitHub** | Possible | Can't copy and validate in time |

---

## Two-Phase Timeline Strategy

### Why Two Phases?

We're speedrunning development to hit ARPA-H deadlines. Rather than waiting for perfect code, we:
1. **Launch alpha** before solution summaries to establish presence
2. **Iterate to production** before full proposals to show momentum

### Phase 1: Alpha Launch (Feb 1-15, 2026)

**Code state:** Works but rough (v0.1.0-alpha)

**Purpose:**
- Establish our stake in the standard before others
- Give TA2 teams early access
- Gather community feedback on protocol design
- Reference in Solution Summary (Feb 27)

**Messaging for Solution Summary:**
> We have developed and open-sourced Hermes and Popper under Apache 2.0.
> Initial alpha release is gathering community feedback from potential TA2 implementers.
> GitHub: github.com/regain-inc/hermes, github.com/regain-inc/popper

### Phase 2: Production Release (Late March 2026)

**Code state:** Stable, documented, tested (v1.0.0)

**Purpose:**
- Demonstrate rapid iteration capability
- Show community adoption and feedback incorporation
- Reference in Full Proposal (April 1)

**Messaging for Full Proposal:**
> Since our solution summary, Hermes and Popper have reached production quality (v1.0).
> - [X] GitHub stars across both repos
> - [Y] npm downloads
> - [Z] TA2 teams evaluating or adopting
> - Community feedback incorporated into stable v1.0 release
>
> This demonstrates our ability to iterate rapidly based on real-world feedback.

### Timeline Visual

```
Jan 2026          Feb 2026                    March 2026           April 2026
   |                 |                            |                    |
   |    Alpha v0.1   |   Solution     Iterate     |   Full Proposal    |
   |    Launch       |   Summary      v0.2, v0.3  |   References v1.0  |
   |                 |                            |                    |
   +----[Feb 1-15]---+---[Feb 27]---+------------+---[April 1]--------+
                            |                            |
                     "We open-sourced"          "We've reached v1.0"
```

---

## Strategic Rationale

### Why Open Source Fully

| Reason | Impact |
|--------|--------|
| **TA1 Focus** | We're applying for TA1 (Deutsch), not TA2. Giving away TA2 strengthens TA1 proposal. |
| **ARPA-H Alignment** | ISO states "TA2 solutions are strongly preferred to be open source" |
| **Standard-Setting** | First comprehensive protocol + implementation becomes the standard |
| **De-risk Program** | ARPA-H sees reduced integration risk (protocol already exists) |
| **Credibility** | "We already built this" > "We promise to build this" |
| **Network Effects** | Other TA2 teams adopt → our Deutsch integrates perfectly |

### What We're Giving Away

| Component | Description | Replacement Cost |
|-----------|-------------|------------------|
| **Hermes Protocol** | Schemas, types, message formats | 2-4 weeks design |
| **Popper DSL** | Rule engine, evaluation semantics | 4-6 weeks engineering |
| **Popper Clinical Packs** | HTV thresholds, evidence grades | 2-3 months clinical expertise |
| **Popper Measurement** | Accuracy, hallucination protocols | 2-3 months R&D |
| **Total** | Complete TA2 implementation | ~6 months head start |

### What We Keep Proprietary

| Component | Description | Why Proprietary |
|-----------|-------------|-----------------|
| **Deutsch** | TA1 clinical reasoning engine | Primary product, ARPA-H contract target |
| **Disease Cartridges** | Deep clinical knowledge packs | Post-ARPA-H revenue |
| **Regain Cloud** | Managed service infrastructure | SaaS revenue |

---

## Regain's Competitive Position

### ARPA-H Selection Model

**Critical insight:** ARPA-H uses a **two-stage funnel**:

| Stage | Input | Output |
|-------|-------|--------|
| **Solution Summary → Full Proposal** | ~30-40 serious applicants | ~10-15 invited |
| **Full Proposal → Final Selection** | ~10-15 proposals | 5 finalists |

Solution Summary is a wider gate. The real competition is at Full Proposal stage.

### What We Have (At Solution Summary - Feb 27)

| Asset | US Relevance | Verifiable? |
|-------|--------------|-------------|
| **Testable Deutsch demo** | ✅ High - ARPA-H can test | ✅ Download mobile app |
| **MIS dashboard** | ✅ High - shows TA1+TA2 working | ✅ Live demo |
| **Open-source Hermes + Popper** | ✅ High - verifiable code | ✅ On GitHub |
| **70% frontend built** | ✅ High - tangible technical proof | In demo |
| **90% HIPAA-compliant** | ✅ High - cybersecurity ready | Code review |
| **Complete RCT protocol** | ✅ High - ready for TA3 deployment | Document |
| **Proprietary eval harness** | ✅ High - agentic AI expertise | - |
| **2 medical center deployments** | ⚠️ Low - Uzbekistan, shows execution | Reference |
| **CVD pilot trial (N=13)** | ⚠️ Low - unpublished, international | Methodology only |

### Demo Timing Note

Demo will be ready BY Solution Summary (Feb 27), but not earlier. This means:
- ✅ ARPA-H reviewers can download and test Deutsch
- ✅ MIS dashboard shows TA1+TA2 working together
- ⚠️ Demo NOT available for early TA3 fit calls (use open-source as credibility)

### Why Open-Source Remains Critical (Even With Demo)

Open-source amplifies the demo's impact:

1. **Code-level verification** - Demo shows it works, GitHub shows HOW it works
2. **ARPA-H alignment** - ISO prefers open-source TA2
3. **TA3 risk reduction** - Protocol already exists, integration proven
4. **Unique differentiation** - Only team with open-source TA2 + testable demo

**Chance estimates (with demo):**
- **Stage 1 (Solution Summary → Full Proposal):** 65-75% with full package
- **Stage 2 (Full Proposal → Final 5):** 33-50% (depends on TA3 quality)
- **Overall to Final 5:** 22-38%

See [07-realistic-assessment.md](./07-realistic-assessment.md) for detailed analysis.

### Team Composition

**Current:** Anton Kim, PhD (Founder & CEO) serves as Project Manager + AI Researcher

**Critical Additions (Before Solution Summary):**

| Role | Why Critical | Impact |
|------|--------------|--------|
| **US Cardiologist** | Demonstrates US market commitment, clinical champion | +10% |
| **FDA SaMD Consultant** | Regulatory credibility, pathway memo | +5% |

See [09-team-recruitment-playbook.md](./09-team-recruitment-playbook.md) for recruitment instructions.

### The TA3 Challenge

We need a US health system partner. Open-source + RCT protocol reduces their technical risk. See [08-ta3-acquisition-strategy.md](./08-ta3-acquisition-strategy.md) for our approach.

---

## ARPA-H Competitive Dynamics

### How This Changes TA2 Competition

**Before we open-source:**
```
TA2 applicants compete on: Protocol + Engine + Clinical Intelligence
```

**After we open-source:**
```
TA2 applicants compete on: Clinical Intelligence only (protocol + engine are free)
```

We commoditize 60% of their proposal.

### Impact on Other TA2 Teams

| Competitor | Likely Response |
|------------|-----------------|
| **Microsoft/Google** | Adopt Hermes (why reinvent?) |
| **Tempus/Similar** | Adopt Hermes + Popper, add their expertise |
| **Academic Teams** | Definitely adopt (fewer resources) |
| **Other Startups** | Adopt or differentiate elsewhere |

### Impact on Our TA1 Proposal

| Proposal Element | Boost |
|------------------|-------|
| **Technical Merit** | "We already shipped production code" |
| **Capabilities** | "Here's our GitHub with working software" |
| **Mission Contribution** | "We contributed to the entire program for free" |
| **Integration Risk** | "Zero — we defined the protocol" |

---

## Value Capture Mechanisms

### 1. Trademark Protection

| Mark | Class | Cost | Protection |
|------|-------|------|------------|
| Hermes | Class 9 | $250 | Name protection for software |
| Popper | Class 9 | $250 | Name protection for software |
| Hermes Certified | Class 42 | $250 (later) | Certification program |

**Timeline:** File before open-sourcing. Applications create priority date.

### 2. Specification Control

| Power | How We Use It |
|-------|---------------|
| We define v2.0 | Features that benefit Deutsch get prioritized |
| We run governance | Hermes Steering Committee (we chair) |
| We approve extensions | "Hermes Extension Registry" controlled by us |
| We write conformance tests | Tests favor our implementation patterns |

### 3. Certification Program

```
Tier 1: Hermes Compatible           $0 (self-certification)
  - Pass conformance test suite
  - Use "Hermes Compatible" badge

Tier 2: Hermes Certified            $10-25K/year
  - Regain reviews implementation
  - Listed on hermes-protocol.dev
  - "Hermes Certified" badge
  - Priority support channel

Tier 3: Hermes Certified Clinical   $50-100K/year
  - Full audit by Regain
  - Clinical validation review
  - FDA submission support
  - "Hermes Certified for Clinical Use" badge
```

### 4. Deutsch Upsell

```
Customer journey:

1. Health system evaluates clinical AI
2. They see everyone uses Hermes
3. They ask: "What's the best TA1 for Hermes?"
4. Answer: "Deutsch - built by the creators of Hermes"

Sales pitch:
"Other TA1 systems are 'Hermes compatible.'
 Deutsch IS Hermes. We wrote both.
 Zero integration risk. Perfect compatibility."
```

### 5. Regain Cloud (Managed Service)

| Offering | Price | Value Proposition |
|----------|-------|-------------------|
| Hermes Validator SaaS | $1-5K/month | Validate supervision requests |
| Popper Managed Service | $5-20K/month | We run your TA2 |
| Regain Cloud (Full Stack) | $20-100K/month | Deutsch + Popper + Hermes |

### 6. Consulting & Implementation

| Service | Price | Buyer |
|---------|-------|-------|
| Hermes Implementation Review | $15-30K | TA2 teams wanting validation |
| Popper Deployment | $25-50K | Health systems self-hosting |
| Custom Policy Pack Development | $50-100K | Disease-specific rules |
| FDA MDDT Preparation | $100-250K | Teams seeking qualification |

### 7. The Adoption Flywheel (Realistic)

**Note:** The primary value is **standardization**, not community contributions. Don't expect significant PRs from adopters in Year 1.

```
You open-source Hermes + Popper
           │
           ▼
TA2 teams adopt (Microsoft, Google, Tempus)
           │
           ▼
Protocol fragmentation is prevented
  • Everyone speaks the same language
  • No competing standards emerge
  • Integration complexity reduced
           │
           ▼
They market to their customers
  • "We use Hermes, the industry standard"
  • Conference talks, blog posts
           │
           ▼
Health systems hear about Hermes everywhere
           │
           ▼
When they want clinical AI:
  "Is it Hermes-compatible?"
           │
           ▼
Your Deutsch is the obvious choice
  "Built by the creators of Hermes"
```

**What to expect from adopters (Year 1):**
- ~5 PRs total from external contributors
- Issues filed (not code contributed)
- Adoption without contribution is normal

**The value is standardization, not contributions.**

---

## Revenue Model

### Year 1-3 (During ARPA-H)

| Stream | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| TA1 Contract (Deutsch) | $2-5M | $3-6M | $4-8M |
| Certification Program | $0 | $50K | $250K |
| Consulting | $50K | $200K | $500K |
| **Total** | **$2-5M** | **$3-6M** | **$5-9M** |

### Year 4-5 (Post-ARPA-H)

| Stream | Year 4 | Year 5 |
|--------|--------|--------|
| Deutsch API (Commercial) | $5-15M | $10-50M |
| Regain Cloud | $2-5M | $5-20M |
| Certification Program | $500K | $1-2M |
| Consulting | $1M | $2-5M |
| **Total** | **$8-21M** | **$18-77M** |

---

## Risk Analysis

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Competitors fork and improve | Medium | Medium | Trademark protection, spec control, move fast |
| Big company out-markets us | High | Medium | Let them market for us (they mention Hermes) |
| Community expectations we can't meet | Medium | Medium | Set "minimal maintenance" expectations upfront |
| ARPA-H sees us as giving it away | Low | High | Frame as strategic, focus proposal on TA1 |
| Protocol design has flaws | Medium | High | Stay at v0.x, iterate before v1.0 |

### What We Sacrifice

| Sacrifice | Acceptable Because |
|-----------|-------------------|
| 6 months head start for competitors | We want TA1, not TA2 |
| Potential TA2 revenue | TA1 revenue >> TA2 |
| Protocol licensing fees | Protocols are rarely monetized |
| Implementation licensing | Services > licenses |

### What We Gain

| Gain | Value |
|------|-------|
| "Created the industry standard" narrative | Immeasurable credibility |
| TA1 proposal strength | Higher win probability |
| Network effects | Every TA2 team markets for us |
| Reduced integration risk | Deutsch works with any TA2 |
| Standardization | Prevents protocol fragmentation |
| Technical credibility proof | Compensates for limited US healthcare experience |

---

## Licensing Strategy

### Current: Apache 2.0 + CLA

| Component | Purpose |
|-----------|---------|
| **Apache 2.0** | Maximum adoption, ARPA-H friendly, patent protection |
| **CLA (Contributor License Agreement)** | Preserves right to relicense in future |

### Why CLA Is Critical

Without CLA, we're locked into Apache 2.0 forever. With CLA, we can:

| Capability | Scenario |
|------------|----------|
| **Dual licensing** | Offer commercial licenses to companies avoiding copyleft |
| **License evolution** | Transition to LGPL for v2.0 if competitors exploit permissive license |
| **Legal flexibility** | Respond to ecosystem changes |

### Phased Licensing Strategy

| Phase | Trigger | License | Effect |
|-------|---------|---------|--------|
| **Phase 1 (Now)** | ARPA-H application | Apache 2.0 + CLA | Max adoption |
| **Phase 2 (If standard)** | 80%+ market share | LGPL for v2.0 | Modifications must be shared |
| **Phase 3 (If demand)** | Enterprise requests | AGPL + Commercial dual | Revenue from non-copyleft |

### What Each License Compels

| License | What Users Must Share |
|---------|----------------------|
| **Apache 2.0** | Nothing (permissive) |
| **LGPL** | Modifications to Hermes itself (apps stay proprietary) |
| **AGPL** | Everything that touches it (even SaaS) |

### Our Recommendation

**Phase 1 is correct for now:**
- ARPA-H explicitly prefers open source → permissive is safer
- Adoption is the goal → Apache 2.0 maximizes it
- CLA preserves all future options

**Don't pursue contributions through license:**
- Contributions come from being useful, not from license requirements
- Copyleft can hurt adoption (big tech avoids AGPL)
- Our competitive advantage is Deutsch + certification, not Hermes code

See [03-governance-template.md](./03-governance-template.md) for full CLA text and detailed licensing rationale.

---

## Success Metrics

### Quiet Open-Source Success (Pre-ARPA-H Decision)

| Metric | Target | Notes |
|--------|--------|-------|
| Code is public and accessible | ✅ | Primary goal |
| ARPA-H can review repos | ✅ | Verified in Solution Summary |
| Alpha warning visible | ✅ | Manages expectations |
| TA3 partners can evaluate | ✅ | Reduces their risk |

**Note:** GitHub stars, npm downloads, HN upvotes are NOT targets in quiet mode.

### If Marketing Later (Post-ARPA-H Selection)

If selected for Full Proposal, we may start marketing in March:

| Metric | Target |
|--------|--------|
| GitHub stars (Hermes) | 500+ |
| GitHub stars (Popper) | 300+ |
| npm downloads | 1,000+ |

### Growth Metrics (Year 1, If Selected)

| Metric | Target |
|--------|--------|
| Production deployments | 5+ |
| Certification inquiries | 10+ |
| Conference mentions | 5+ |
| Contributors | 20+ |
| Forks (active) | 10+ |

### Value Capture Metrics (Year 2-3)

| Metric | Target |
|--------|--------|
| Certified implementations | 5+ |
| Consulting revenue | $500K+ |
| Deutsch customers citing Hermes | 80%+ |

---

## Governance Structure

### Hermes Steering Committee

```markdown
# Membership
- Chair: [Founder], Regain Health
- Seat 2: Open (reserve for major contributor)
- Seat 3: Open (reserve for health system representative)

# Decision Rights
- Minor changes: Any maintainer
- Major changes: HSC majority
- Breaking changes: HSC unanimous + 90-day notice

# Trademark Policy
"Hermes" and "Popper" trademarks owned by Regain Health, Inc.
Certified use requires compliance with Certification Agreement.
```

### Extension Registry

We control what gets official "Hermes Extension" status:

| Extension Type | Approval |
|----------------|----------|
| Schema extensions | HSC review required |
| Tool integrations | Self-registered, not endorsed |
| Protocol amendments | HSC unanimous |

---

## Dependencies

### Before Open-Sourcing

| Dependency | Status | Owner |
|------------|--------|-------|
| Hermes implementation complete | Required | Engineering |
| Popper implementation complete | Required | Engineering |
| Trademark applications filed | Required | Legal/Founder |
| Domain registered | Required | Ops |
| README.md written | Required | Engineering |
| GOVERNANCE.md written | Required | Founder |
| LICENSE files added | Required | Engineering |

### Nice to Have (Can Follow)

| Dependency | Status | Owner |
|------------|--------|-------|
| Landing page | Week 1-2 post-launch | Marketing |
| Conformance test suite | Month 1-2 | Engineering |
| Certification program terms | Month 6-12 | Legal |

---

## If Rejected: Contingency Summary

**Reality:** There's a 62-78% chance we don't make the Final 5. See [07-realistic-assessment.md](./07-realistic-assessment.md) for full contingency plan.

### Key Pivots If Rejected

| Strategy | Revenue Path |
|----------|--------------|
| **Direct commercial sales** | Demo is ready, sell to health systems directly |
| **International expansion** | Uzbekistan experience is an asset outside US |
| **Alternative funding** | NIH SBIR, VA Innovation, foundations |

### What Changes

| With ARPA-H | Without ARPA-H |
|-------------|----------------|
| Certification = required | Certification = voluntary (deprioritize) |
| Hermes = mandated standard | Hermes = marketing asset only |
| Focus on TA3 partners | Focus on direct enterprise sales |
| $10-15M Year 3 | $4-6M Year 3 |

### Don't Count On

**"Inadvertent marketing" from ARPA-H ecosystem is unreliable:**
- Selected TA2 teams may fork, rename, or ignore Hermes
- No guarantee ARPA-H standardizes on any protocol
- Certification revenue drops ~10x without mandate

### The Assets Still Have Value

| Asset | Without ARPA-H |
|-------|----------------|
| Demo (Deutsch) | Direct sales tool |
| RCT protocol | Other grants, pilot studies |
| Open-source | Technical credibility |
| Uzbekistan deployments | International expansion base |

**Bottom line:** ARPA-H accelerates growth but isn't the only path. The assets we're building work regardless of selection outcome.

---

## Related Documents

- [01-execution-timeline.md](./01-execution-timeline.md) - Detailed launch timeline (two-phase)
- [02-trademark-filing-guide.md](./02-trademark-filing-guide.md) - USPTO filing instructions
- [03-governance-template.md](./03-governance-template.md) - GOVERNANCE.md template
- [04-certification-program.md](./04-certification-program.md) - Certification tiers and terms
- [05-marketing-plan.md](./05-marketing-plan.md) - Launch marketing activities
- [06-alpha-release-guide.md](./06-alpha-release-guide.md) - Alpha labeling and README templates
- [07-realistic-assessment.md](./07-realistic-assessment.md) - What open-source does/doesn't provide + **contingency plan**
- [08-ta3-acquisition-strategy.md](./08-ta3-acquisition-strategy.md) - TA3 partner acquisition strategy
