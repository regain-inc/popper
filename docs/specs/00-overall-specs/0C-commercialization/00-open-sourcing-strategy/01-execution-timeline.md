# Open Source Execution Timeline

## Two-Phase Strategy: Alpha → Production (Quiet Open-Source)

We're using a **two-phase release strategy** that aligns with ARPA-H milestones:

| Phase | Date | Version | ARPA-H Event |
|-------|------|---------|--------------|
| **Alpha Launch** | Feb 1-15, 2026 | v0.1.0 | Before Solution Summary (Feb 27) |
| **Production Release** | Late March 2026 | v1.0.0 | Before Full Proposal (April 1) |

### Quiet Open-Source Approach

**Strategy:** Put code on GitHub without active marketing/promotion.

**Why quiet open-source?**
1. **Limited resources** - We don't have capacity for active community management
2. **Demo is our differentiator** - ARPA-H reviewers see working demo, not GitHub stars
3. **Low IP risk** - Competitors unlikely to copy in time for Feb 27 deadline
4. **Minimal effort** - Just push to GitHub, no Hacker News/Twitter/LinkedIn campaigns
5. **Preserves optionality** - Can always promote later if selected

**Who knows about the repos?**
- ARPA-H reviewers (certain) - We reference repos in Solution Summary
- TA3 partners we share with (certain) - Reduces their technical risk
- Competitors monitoring GitHub (possible but unlikely to matter) - Can't copy in time

**What we skip:**
- ❌ Hacker News "Show HN" post
- ❌ Twitter/X thread
- ❌ LinkedIn announcement
- ❌ Active community engagement
- ❌ Blog posts and tutorials

**What we still do:**
- ✅ Push code to GitHub (public repos)
- ✅ Add alpha warning to README
- ✅ Reference in Solution Summary
- ✅ Share with TA3 partners for evaluation
- ✅ Respond to issues if any appear

**Trade-off:** Estimated 5% lower chance at Stage 1 (60-70% vs 65-75%), but minimal resource investment.

## Critical Dates

| Date | Event | Our Action |
|------|-------|------------|
| **Feb 1-15, 2026** | Alpha launch window | Push Hermes + Popper v0.1.0-alpha |
| **February 27, 2026** | ARPA-H Solution Summary Due | Reference alpha + **testable demo** + MIS dashboard |
| **March 2026** | Iteration period | v0.2.0, v0.3.0 based on feedback |
| **Late March 2026** | Production release | Push v1.0.0 |
| **April 1, 2026** | ARPA-H Full Proposal Due | Reference production release + TA3 partner |

---

## Demo Assets (Ready BY Solution Summary)

**Timing:** Demo will be ready BY Feb 27, but not before. This means ARPA-H reviewers can test it, but we can't use demo for early outreach activities.

### What We WILL Have at Solution Summary (Feb 27)

| Asset | Format | Available |
|-------|--------|-----------|
| **Testable Deutsch demo** | 50% MVP mobile app | ✅ Yes - ARPA-H can download |
| **MIS dashboard** | Live demo showing TA1+TA2 integration | ✅ Yes |
| **Open-source Hermes + Popper** | GitHub repos | ✅ Yes |
| **70% frontend** | In the demo | ✅ Yes |
| **RCT protocol** | Document | ✅ Yes |
| **Architecture diagrams** | Images | ✅ Yes |

### Demo Timing Implications

| Context | Demo Available? | Alternative |
|---------|-----------------|-------------|
| **ARPA-H reviewers (Feb 27)** | ✅ Yes | - |
| **Early TA3 fit calls (Now - Feb)** | ❌ No | Use open-source + screenshots |
| **Team recruitment outreach (Now - Feb)** | ❌ No | Use open-source + screenshots |

### Demo Target: Solution Summary (Feb 27)

| Milestone | Description | Target |
|-----------|-------------|--------|
| **Mobile app testable** | ARPA-H admins can download and test | Feb 27, 2026 |
| **Core CVD conversations** | Heart failure management flows working | Feb 27, 2026 |
| **MIS dashboard working** | Shows TA1+TA2 integration | Feb 27, 2026 |

**Demo + open-source provides strong differentiation for Solution Summary.**

---

## Parallel Track: Team Building & TA3 Pursuit

**Context:** Open-source execution runs in parallel with team recruitment and TA3 partner acquisition. These activities are critical because our US healthcare credibility is limited (medical center deployments and pilot trial are in Uzbekistan).

### Team Composition

**Current:**
| Role | Person | Notes |
|------|--------|-------|
| **Founder & CEO** | Anton Kim, PhD | Also serves as Project Manager + AI Researcher |

**Note:** Founder wears multiple hats. ARPA-H requires PM to be *identified*, not a separate person.

### Team Recruitment (Before Solution Summary)

| Role | Why Critical | Target | Impact |
|------|--------------|--------|--------|
| **US Cardiologist** | Demonstrates US market commitment, clinical champion | Feb 15, 2026 | +10% |
| **FDA SaMD Consultant** | Regulatory credibility, pathway memo | Feb 20, 2026 | +5% |
| **Health System Innovation Leader** | TA3 introductions | Feb 25, 2026 | TA3 intros |

**Stage 1 estimate:** 65-75% chance of Full Proposal invitation (demo + open-source + team additions)

**Stage 2:** 33-50% chance of Final 5 (depends heavily on TA3 partner quality)

**See [09-team-recruitment-playbook.md](./09-team-recruitment-playbook.md)** for detailed instructions, outreach templates, and budget guidance.

### TA3 Partner Pursuit

See [08-ta3-acquisition-strategy.md](./08-ta3-acquisition-strategy.md) for full strategy.

#### Before Solution Summary (Feb 27)

| Week | Activity | Owner |
|------|----------|-------|
| Now | Identify warm intros from Proposers' Day participant list | Founder |
| Now + 1 | Schedule fit calls with interested AMCs | Founder |
| Now + 2 | Conduct fit calls (clinical champion + CIO + research ops) | Founder |
| Before Feb 27 | Document pursuit status for Solution Summary | Founder |

**Fit Call Attendees (from TA3 side):**
- Clinical Champion/PI: Medical decision maker
- CIO/Security Lead: Technical feasibility assessment
- Research Ops/IRB: Study logistics evaluation

**Messaging for fit calls:**
- Lead with: "70% frontend built, open-source TA2 stack, **complete RCT protocol ready for deployment**"
- Emphasize: "You execute the study, we've already designed it - endpoints, sample size, timeline defined"
- Mention: "Deployed in clinical settings before"
- Avoid: Overselling Uzbekistan results

#### Solution Summary Language (if no TA3 confirmed)

```markdown
## TA3 Partnership Status

We are actively pursuing TA3 partnerships with [X] academic medical centers
from the ARPA-H Proposers' Day participant list. We expect to confirm
partnership for the Full Proposal (April 1).

Our open-source TA2 stack (Hermes + Popper) reduces integration risk
for any TA3 partner, enabling them to evaluate the protocol independently.
```

#### Post-Selection Strategy (if selected for Full Proposal)

| Timing | Activity | Owner |
|--------|----------|-------|
| Immediately | Announce selection on social media | Founder |
| Week 1 | Outreach to TA3 targets with "ARPA-H selected" credibility | Founder |
| Week 2-3 | Fit calls with interested parties | Founder |
| Before April 1 | Confirm TA3 partnership for Full Proposal | Founder |

**The key insight:** ARPA-H selection becomes our US credibility signal. Use it immediately to accelerate TA3 acquisition.

### Priority TA3 Targets

From Proposers' Day participant list (see [08-ta3-acquisition-strategy.md](./08-ta3-acquisition-strategy.md)):

| Priority | Organization | Why |
|----------|--------------|-----|
| HIGH | Duke University / Duke Health | Multiple participants, strong research infrastructure |
| HIGH | Stanford / Stanford Health Care | Tech-forward, multiple participants |
| HIGH | Mayo Clinic | Premier research institution |
| HIGH | Johns Hopkins / Armstrong Institute | Patient safety focus |
| HIGH | Kaiser Permanente | Large integrated system, research division |
| MEDIUM | Yale / Yale CORE | Krumholz's CORE group |
| MEDIUM | Vanderbilt | DBMI presence |

---

## Phase 1: Pre-Launch (Now → Launch Day)

### Week 1-2: Legal & Infrastructure

| Task | Owner | Effort | Status |
|------|-------|--------|--------|
| Search USPTO TESS for conflicts | Founder | 1 hour | [ ] |
| File "Hermes" trademark (Class 9) | Founder | 1 hour | [ ] |
| File "Popper" trademark (Class 9) | Founder | 1 hour | [ ] |
| Register hermes-protocol.dev | Ops | 10 min | [ ] |
| Register popper-safety.dev (optional) | Ops | 10 min | [ ] |
| Verify GitHub org: github.com/regain-inc | Engineering | 5 min | [ ] |
| Create repos: hermes, popper | Engineering | 10 min | [ ] |

**Cost: ~$500 (trademarks) + $24 (domains)**

### Week 2-3: Code Preparation (Alpha Quality)

**Minimum bar for alpha:** Code works, basic example runs, no crashes.

| Task | Owner | Effort | Status |
|------|-------|--------|--------|
| Extract Hermes schemas from specs | Engineering | 2 days | [ ] |
| Extract Popper DSL from specs | Engineering | 3 days | [ ] |
| Write Popper clinical policy packs | Engineering | 3 days | [ ] |
| Write Popper measurement protocols | Engineering | 2 days | [ ] |
| Add TypeScript types | Engineering | 1 day | [ ] |
| Add Zod validation | Engineering | 1 day | [ ] |
| Write unit tests (critical paths only) | Engineering | 1 day | [ ] |
| Verify `npm install` works | Engineering | 1 hour | [ ] |
| Verify basic example runs | Engineering | 2 hours | [ ] |
| Create GitHub issues for known limitations | Engineering | 2 hours | [ ] |

### Week 3-4: Documentation (Alpha Framing)

See [06-alpha-release-guide.md](./06-alpha-release-guide.md) for README templates.

| Task | Owner | Effort | Status |
|------|-------|--------|--------|
| Write Hermes README.md (with alpha warning) | Engineering | 4 hours | [ ] |
| Write Popper README.md (with alpha warning) | Engineering | 4 hours | [ ] |
| Write CONTRIBUTING.md | Founder | 2 hours | [ ] |
| Write GOVERNANCE.md | Founder | 1 hour | [ ] |
| Write CODE_OF_CONDUCT.md | Founder | 30 min | [ ] |
| Add LICENSE (Apache 2.0) | Engineering | 10 min | [ ] |
| Write 1-2 working examples | Engineering | 4 hours | [ ] |
| Add known limitations to README | Engineering | 1 hour | [ ] |

### Week 4: Launch Preparation (Quiet Open-Source)

| Task | Owner | Effort | Status |
|------|-------|--------|--------|
| Prepare GitHub release notes (v0.1.0-alpha) | Engineering | 1 hour | [ ] |
| Test npm publish (dry run) | Engineering | 1 hour | [ ] |
| Final check: example runs without crash | Engineering | 1 hour | [ ] |
| ~~Write Hacker News post~~ | ~~Founder~~ | ~~2 hours~~ | Skipped (quiet) |
| ~~Write Twitter/X thread~~ | ~~Founder~~ | ~~1 hour~~ | Skipped (quiet) |
| ~~Write LinkedIn announcement~~ | ~~Founder~~ | ~~1 hour~~ | Skipped (quiet) |
| ~~Create simple landing page~~ | ~~Engineering~~ | ~~4 hours~~ | Skipped (quiet) |

**Note:** Marketing tasks skipped per quiet open-source strategy. Can revisit after ARPA-H selection.

---

## Phase 2: Launch Day (Quiet Open-Source)

### Launch Sequence

| Time | Action |
|------|--------|
| Any time | Push final code to GitHub |
| +5 min | Publish npm packages |
| +10 min | Publish GitHub release (v0.1.0-alpha) |
| Done | That's it - no marketing push |

**Marketing activities skipped:**
- ~~Submit Hacker News "Show HN"~~
- ~~Post Twitter thread~~
- ~~Post LinkedIn announcement~~
- ~~Email to healthcare AI contacts~~

**Timing doesn't matter** - We're not trying to hit peak visibility hours.

---

## Phase 3: Post-Launch (Days 1-7) - Quiet Mode

### Daily Activities (Minimal)

| Day | Focus |
|-----|-------|
| Days 1-7 | Check for GitHub issues once daily, respond if any appear |

**What we skip:**
- ~~Respond to ALL HN comments within 1 hour~~ (no HN post)
- ~~Write follow-up blog post~~
- ~~Engage with people who shared/starred~~
- ~~Submit to other communities~~

### If Issues Appear

**For GitHub issues (respond within 48 hours):**
```
Thanks for finding this!

[If bug] We'll look into this.
[If feature] Noted - adding to backlog.
[If question] [Direct answer]
```

**Expectation:** Likely zero or very few issues in quiet mode.

---

## Phase 4: First Month (Days 8-30) - Quiet Mode

### Weeks 2-4: Minimal Maintenance

| Task | Owner | Effort |
|------|-------|--------|
| Fix critical bugs if reported | Engineering | As needed |
| Respond to GitHub issues | Engineering | 1-2 hours/week |
| Prepare for Solution Summary | Founder | Focus here |

**Content tasks skipped (quiet mode):**
- ~~Write blog post: "Why We Open-Sourced Hermes"~~
- ~~Create architecture diagram~~
- ~~Record 5-minute demo video~~
- ~~Improve landing page~~
- ~~Reach out to potential adopters~~

**Focus:** Demo + Solution Summary preparation, not open-source community building.

---

## Phase 5: Solution Summary (Feb 2026)

### Before Solution Summary (Feb 27)

| Task | Owner | Deadline |
|------|-------|----------|
| Ensure repos are public and accessible | Engineering | Feb 20 |
| Verify README has alpha warning | Engineering | Feb 20 |
| Reference alpha in TA1 solution summary | Founder | Feb 25 |

**Note:** No adoption metrics to cite (quiet approach). The demo is our primary differentiator.

### TA1 Solution Summary Language (Demo + Open-Source Framing)

```markdown
## Demonstrable Capability

We provide verifiable proof of technical capability:

1. **Testable Demo** - Download our mobile app and test Deutsch yourself
   - 50% MVP of TA1 clinical reasoning engine
   - Core CVD conversation flows working

2. **MIS Dashboard** - See TA1+TA2 integration in action
   - Doctor-facing interface showing supervision in real-time
   - Demonstrates ADVOCATE vision realized

3. **Open-Source TA2** - Examine our code on GitHub
   - Hermes Protocol (github.com/regain-inc/hermes)
   - Popper Implementation (github.com/regain-inc/popper)
   - Apache 2.0 licensed, available for inspection and evaluation

## This Proposal: Deutsch (TA1)

Our Deutsch clinical reasoning engine is designed from the ground
up to emit Hermes-compliant supervision requests, ensuring seamless
integration with any TA2 performer.

The working demo validates our engineering velocity and technical approach.
```

**Note:** No community metrics to cite (quiet approach). Lead with demo + code availability.

---

## Phase 6: Production Release (March 2026)

### March Iteration Sprint

| Week | Focus | Version |
|------|-------|---------|
| Week 1 (Mar 1-7) | Fix bugs from alpha feedback | v0.2.0 |
| Week 2 (Mar 8-14) | Documentation improvements | v0.3.0 |
| Week 3 (Mar 15-21) | Stability and tests | v0.9.0 |
| Week 4 (Mar 22-28) | Final polish and v1.0 release | v1.0.0 |

### Production Release Checklist (v1.0.0)

| Task | Owner | Effort | Status |
|------|-------|--------|--------|
| All critical bugs from alpha fixed | Engineering | As needed | [ ] |
| npm install works reliably | Engineering | 2 hours | [ ] |
| Examples run without issues | Engineering | 4 hours | [ ] |
| README reflects production status | Engineering | 2 hours | [ ] |
| CHANGELOG updated with all changes | Engineering | 2 hours | [ ] |
| Remove alpha warnings from README | Engineering | 30 min | [ ] |
| Update version to 1.0.0 | Engineering | 10 min | [ ] |
| Tag v1.0.0 release on GitHub | Engineering | 10 min | [ ] |
| Publish to npm as stable | Engineering | 30 min | [ ] |
| Announce v1.0 on social media | Founder | 1 hour | [ ] |

---

## Phase 7: Full Proposal (April 2026)

### Decision Point: Start Marketing?

**If selected for Full Proposal:** Consider starting active promotion to build metrics before April 1.

| Option | Effort | Benefit |
|--------|--------|---------|
| Stay quiet | Minimal | Focus on proposal |
| Start marketing | 10-15 hours | Build metrics for proposal |

**Recommendation:** If selected, brief marketing push in March may help Full Proposal.

### Before Full Proposal (April 1)

| Task | Owner | Deadline |
|------|-------|----------|
| Ensure v1.0.0 stable release | Engineering | Mar 28 |
| Reference progression in full proposal | Founder | Mar 30 |
| (If marketing) Document any adoption metrics | Founder | Mar 28 |

### TA1 Full Proposal Language (Production Framing)

```markdown
## Prior Work and Progress

Since our solution summary, we have achieved significant milestones:

1. **Hermes Protocol** (github.com/regain-inc/hermes)
   - Production-ready v1.0.0 released March 2026
   - Apache 2.0 licensed
   - Available for inspection and evaluation

2. **Popper Reference Implementation** (github.com/regain-inc/popper)
   - Production-ready v1.0.0 released March 2026
   - Apache 2.0 licensed

3. **Technical Progression**
   - Iteration from v0.1.0-alpha to v1.0.0 in 6 weeks
   - Bug fixes and stability improvements based on internal testing
   - Documentation and examples complete

This progression demonstrates:
- **Technical execution**: Alpha to production in one sprint cycle
- **Engineering velocity**: Rapid iteration capability
- **Program alignment**: Open-source TA2 reduces integration risk

## This Proposal: Deutsch (TA1)

Our Deutsch clinical reasoning engine is designed from the ground
up to emit Hermes-compliant supervision requests, ensuring seamless
integration with any TA2 performer.

The rapid maturation of Hermes and Popper validates our engineering
velocity and positions Deutsch for similarly rapid development.
```

**Note:** Language focuses on technical progression, not community metrics (which we may not have in quiet mode).

---

## Phase 6: Ongoing Maintenance

### Monthly Cadence

| Week | Focus |
|------|-------|
| Week 1 | Triage issues, merge low-risk PRs |
| Week 2 | Work on planned features |
| Week 3 | Documentation updates |
| Week 4 | Release (if changes warrant) |

### Time Commitment

| Activity | Hours/Month |
|----------|-------------|
| Issue triage | 4-8 |
| PR review | 4-8 |
| Documentation | 2-4 |
| Community engagement | 2-4 |
| Releases | 2-4 |
| **Total** | **15-30 hours/month** |

### Reducing Burden Over Time

| Tactic | When |
|--------|------|
| Accept maintainer from community | After 50+ contributions from individual |
| Mark "community maintained" | If you need to step back |
| Archive if inactive | If no engagement after 6 months |
| Transfer to foundation | If becomes industry-critical |

---

## Resource Requirements

### People

| Role | Allocation | Duration |
|------|------------|----------|
| Engineering | 50% FTE | Pre-launch (4 weeks) |
| Engineering | 25% FTE | Launch week |
| Engineering | 10% FTE | Ongoing maintenance |
| Founder | 20% time | Pre-launch + launch week |
| Founder | 5% time | Ongoing |

### Budget

| Item | Cost | When |
|------|------|------|
| Trademark filing | $500 | Pre-launch |
| Domain registration | $24 | Pre-launch |
| GitHub (free tier) | $0 | Ongoing |
| npm (free tier) | $0 | Ongoing |
| Optional: Landing page hosting | $0-20/month | Ongoing |
| **Total Year 1** | **~$750** | |

---

## Decision Points

### Go/No-Go Checklist (Before Launch)

- [ ] Code is production-quality (no obvious bugs)
- [ ] README explains what it is and how to use it
- [ ] LICENSE file present
- [ ] Trademark applications filed
- [ ] Domain registered
- [ ] At least one working example
- [ ] Founder available for launch day monitoring

### Abort Criteria

| If This Happens | Action |
|-----------------|--------|
| Major bug found pre-launch | Delay 1 week, fix |
| Trademark conflict discovered | Rename before launch |
| ARPA-H timeline changes | Adjust accordingly |
| Team capacity crisis | Delay or reduce scope to Hermes-only |

---

## Rollback Plan

If open-sourcing goes poorly (unlikely):

| Scenario | Response |
|----------|----------|
| No adoption | That's fine - still use in TA1 proposal |
| Negative reception | Learn from feedback, iterate |
| Security vulnerability found | Patch immediately, communicate transparently |
| Competitor hostile fork | Ignore, focus on being the authoritative source |

**There's no true "rollback" from open source.** Once public, it's public. This is why we:
1. Review code carefully before launch
2. Start with clear governance
3. Set realistic expectations
