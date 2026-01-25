# Open Source Strategy for Hermes + Popper

## Quick Summary

**What:** Fully open-source Hermes (protocol) and Popper (TA2 implementation) under Apache 2.0

**Strategy:** Two-phase Alpha → Production progression

| Phase | Date | Version | ARPA-H Milestone |
|-------|------|---------|------------------|
| **Alpha Launch** | Feb 1-15, 2026 | v0.1.0 | Reference in Solution Summary (Feb 27) |
| **Production Release** | Late March 2026 | v1.0.0 | Reference in Full Proposal (April 1) |

**Why:** Establish the industry standard for clinical AI supervision, strengthen our TA1 (Deutsch) proposal, demonstrate iteration velocity

**Approach:** Quiet open-source (no active marketing/promotion) - code is public but we don't pursue stars/downloads

**Revenue:** Capture value through Deutsch (TA1), certification program, managed service, and consulting

---

## Why Open-Source Works for Regain

**Our situation:** We have strong technical capability (70% frontend built, 90% HIPAA-compliant) but limited US healthcare credibility. Our medical center deployments and pilot trial are in Uzbekistan, not the US.

**What makes us different:** By Solution Summary (Feb 27), we have:
- **Testable Deutsch demo** - 50% MVP on mobile app ARPA-H can download
- **MIS dashboard** - Shows TA1+TA2 integration working
- **Open-source TA2 on GitHub** - Only team with verifiable code

**Open-source amplifies our demo:**

| What We Provide | What We Don't Have |
|-----------------|-------------------|
| ✅ Testable demo (50% MVP) | ❌ US healthcare credibility |
| ✅ MIS dashboard (TA1+TA2 working) | ❌ TA3 partners (yet) |
| ✅ Open-source TA2 (verifiable code) | ❌ Published clinical validation |
| ✅ Complete RCT protocol | |
| ✅ ARPA-H alignment signal | |

**The strategic bet:**
```
Testable Deutsch demo (50% MVP on mobile)
              +
MIS dashboard (TA1+TA2 integration visible)
              +
Open-source TA2 (Hermes + Popper on GitHub)
              +
Complete RCT protocol (reduces TA3 burden)
              +
US cardiologist + FDA consultant
              =
Stage 1: 65-75% chance of Full Proposal invitation
Stage 2: 33-50% chance of Final 5 (depends on TA3)
Overall: 22-38% chance of Final 5
```

**Key insight:** ARPA-H uses a two-stage funnel. Solution Summary → Full Proposal is a wider gate (~10-15 invited). Demo + open-source TA2 is our differentiation - we're the only team with verifiable code AND testable demo.

**If rejected (62-78% chance):** Pivot to direct commercial sales + international expansion. Don't invest heavily in certification (value drops 10x without ARPA-H mandate). The demo and RCT protocol have value regardless.

See [07-realistic-assessment.md](./07-realistic-assessment.md) for detailed analysis and contingency plan.

---

## Licensing: Apache 2.0 + CLA

**License:** Apache 2.0 (permissive, maximum adoption)

**CLA (Contributor License Agreement):** Required for all contributions. Grants Regain the right to relicense in the future.

**Why CLA?** Preserves strategic flexibility:
- Can offer dual license (AGPL + Commercial) later if needed
- Can transition to LGPL for v2.0 if competitors exploit permissive license
- Without CLA, we're locked into Apache 2.0 forever

**Phased strategy:**
1. **Now:** Apache 2.0 + CLA (max adoption, ARPA-H friendly)
2. **If standard:** Consider LGPL for v2.0 (modifications must be shared)
3. **If demand:** Consider dual license (revenue from commercial option)

See [03-governance-template.md](./03-governance-template.md) for full CLA text.

---

## Documents in This Folder

| Document | Purpose |
|----------|---------|
| [00-strategy-overview.md](./00-strategy-overview.md) | Complete strategic rationale, two-phase timeline, value capture |
| [01-execution-timeline.md](./01-execution-timeline.md) | Week-by-week timeline: Alpha → Production → ARPA-H milestones |
| [02-trademark-filing-guide.md](./02-trademark-filing-guide.md) | USPTO DIY filing instructions |
| [03-governance-template.md](./03-governance-template.md) | Templates for GOVERNANCE.md, TRADEMARK.md, etc. |
| [04-certification-program.md](./04-certification-program.md) | Hermes Certified program tiers and revenue model |
| [05-marketing-plan.md](./05-marketing-plan.md) | Launch marketing activities and messaging (alpha framing) |
| [06-alpha-release-guide.md](./06-alpha-release-guide.md) | Alpha labeling, README templates, Alpha → Production timeline |
| [07-realistic-assessment.md](./07-realistic-assessment.md) | Honest assessment + **if-rejected contingency plan** |
| [08-ta3-acquisition-strategy.md](./08-ta3-acquisition-strategy.md) | TA3 partner pursuit strategy |
| [09-team-recruitment-playbook.md](./09-team-recruitment-playbook.md) | Step-by-step recruitment for cardiologist, FDA consultant, innovation leader |

---

## The Core Insight

```
Open source is not charity. It's a distribution strategy.

Hermes (free) → Certification (paid)
Hermes (free) → Regain Cloud (paid)
Hermes (free) → Deutsch (paid)
Hermes (free) → Consulting (paid)

The protocol is the funnel. The products are the revenue.
```

---

## Key Numbers

| Metric | Value |
|--------|-------|
| **Trademark filing cost** | $500 (Hermes + Popper, Class 9) |
| **Launch marketing cost** | $0-500 |
| **Maintenance commitment** | 15-30 hrs/month |
| **Year 3 certification revenue** | $500K-1M |
| **Year 5 total revenue** | $18-77M |

---

## Decision: Why Full Open Source

We evaluated four options:

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Open Hermes only | Low maintenance | Less ARPA-H credit | No |
| Open Hermes + Popper core | Medium effort | Mixed message | No |
| **Open Hermes + Popper fully** | Maximum ARPA-H credit | More maintenance | **Yes** |
| Keep everything proprietary | Full control | Against ARPA-H preference | No |

**Rationale:** We're applying for TA1 (Deutsch), not TA2. Giving away TA2 strengthens our TA1 proposal and establishes us as the standard.

---

## Immediate Next Steps

### This Week (Legal & Infrastructure)

- [ ] Search USPTO for trademark conflicts
- [ ] File trademark applications ($500)
- [ ] Register hermes-protocol.dev domain ($12)
- [ ] Create repos in github.com/regain-inc

### Before Alpha Launch (Target: Feb 1-15)

- [ ] Complete Hermes core (types, schemas, validation)
- [ ] Complete Popper core (DSL, basic evaluation)
- [ ] Write README with alpha warning (see [06-alpha-release-guide.md](./06-alpha-release-guide.md))
- [ ] Add GOVERNANCE, LICENSE files
- [ ] Pre-create GitHub issues for known limitations
- [ ] Prepare Hacker News post (alpha framing)

### Alpha Launch Week (Feb 1-15) - Quiet Mode

- [ ] Push v0.1.0-alpha to GitHub
- [ ] Publish to npm
- [ ] ~~Post on Hacker News~~ (skipped in quiet mode)
- [ ] Check for any issues (likely none)

### Before Production Release (Target: Late March)

- [ ] Fix all critical bugs from alpha feedback
- [ ] Improve documentation based on community questions
- [ ] Add conformance tests
- [ ] Release v1.0.0
- [ ] Update README to remove alpha warnings

See [01-execution-timeline.md](./01-execution-timeline.md) for detailed checklist.

---

## Risks We Accept

| Risk | Mitigation |
|------|------------|
| Competitors fork and improve | Trademark protection, move fast |
| Maintenance burden | Set expectations, accept community help |
| ARPA-H sees us as giving it away | Frame as strategic, focus on TA1 |

---

## Success Looks Like (Quiet Mode)

### Phase 1: Alpha Launch (Feb 2026)
- Code works, basic examples run
- v0.1.0-alpha published to npm
- Referenced in Solution Summary (Feb 27)
- TA3 partners can evaluate repos (no metrics to cite)

### Phase 2: Production Release (March 2026)
- v1.0.0 stable release
- Bug fixes from internal testing
- Referenced in Full Proposal (April 1)
- ~~500+ GitHub stars~~ (not a target in quiet mode)

### Medium-term (Year 1-2)
- Hermes is the de facto TA2 protocol
- Certification program generating revenue
- Deutsch wins TA1 contract

### Long-term (Year 3-5)
- "Hermes Certified" is an industry standard
- Regain Cloud serving enterprise customers
- $20M+ ARR from Deutsch + services
