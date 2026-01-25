# Alpha Release Guide

## Your Situation

**Code status:** Works but rough
**Strategy:** Quiet open-source with explicit alpha labeling

This guide covers how to properly communicate "alpha" status to set expectations and protect credibility.

---

## Alpha Warning Template (Use This)

The standard alpha warning for both Hermes and Popper READMEs:

```markdown
# Hermes (Alpha)

⚠️ **Alpha Release** - This is early-stage software.
- APIs may change without notice
- Not recommended for production use
- Feedback welcome via Issues
```

This warning:
- Sets expectations clearly
- Protects against criticism of rough code
- Invites feedback without demanding engagement
- Works well for quiet open-source (minimal commitment)

---

## Alpha Labeling Checklist

### Repository Level

```
□ README.md has prominent alpha warning
□ Package version is 0.x.x (semver signals instability)
□ GitHub repo description includes "alpha" or "experimental"
□ LICENSE is clear (Apache 2.0)
□ CHANGELOG.md exists (even if short)
```

### Code Level

```
□ Basic example works without crashing
□ npm install succeeds
□ No hardcoded secrets/credentials
□ Critical paths have some tests
□ Known issues documented in GitHub Issues or README
```

---

## README Template (Alpha Version - Quiet Open-Source)

```markdown
# Hermes (Alpha)

⚠️ **Alpha Release** - This is early-stage software.
- APIs may change without notice
- Not recommended for production use
- Feedback welcome via Issues

---

**The open protocol for clinical AI supervision**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## What is Hermes?

Hermes is an open protocol for communication between clinical AI agents
and safety supervisors. It defines:

- **SupervisionRequest/Response** - Core message types
- **AuditEvent** - Audit trail format
- **ControlCommand** - Safe-mode and settings
- **ProposedIntervention** - Clinical action types

## Quick Start

```bash
npm install @regain/hermes-core
```

```typescript
import { SupervisionRequest, validateRequest } from '@regain/hermes-core';

const request: SupervisionRequest = {
  trace: { trace_id: 'abc123', span_id: 'def456' },
  subject: { subject_id: 'patient_001' },
  intervention: {
    kind: 'PRESCRIPTION_NEW',
    details: { medication: 'Lisinopril', dose: '10mg' }
  }
};

const result = validateRequest(request);
if (!result.valid) {
  console.error(result.errors);
}
```

## Documentation

- [Protocol Specification](./docs/spec.md)
- [API Reference](./docs/api.md)
- [Examples](./examples/)

## Known Limitations (Alpha)

- [ ] Measurement protocols not yet implemented
- [ ] Performance not optimized for high throughput
- [ ] Some edge cases in validation not handled
- [ ] Documentation gaps

See [GitHub Issues](https://github.com/regain-inc/hermes/issues) for
current bugs and planned features.

## Contributing

We welcome feedback and contributions! This is alpha software, so we're
especially interested in:

- Protocol design feedback
- Bug reports
- Documentation improvements

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Roadmap

| Milestone | Target | Status |
|-----------|--------|--------|
| v0.1.0 - Core schemas | Feb 2026 | ✅ Done |
| v0.2.0 - Validation | Feb 2026 | 🚧 In progress |
| v0.3.0 - Measurement | Mar 2026 | Planned |
| v1.0.0 - Stable | Q2 2026 | Planned |

## License

Apache 2.0 - See [LICENSE](./LICENSE)

## Trademarks

Hermes™ is a trademark of Regain Health, Inc.

---

*Built for the [ARPA-H ADVOCATE](https://arpa-h.gov/advocate) program.*
```

---

## Popper README Template (Alpha - Quiet Open-Source)

```markdown
# Popper (Alpha)

⚠️ **Alpha Release** - This is early-stage software.
- APIs may change without notice
- Not recommended for production use
- Feedback welcome via Issues

---

**Open-source clinical AI supervisory agent**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

> ⚠️ **Not for clinical use.** This is reference implementation for protocol
> development and research.

---

## What is Popper?

Popper is a reference implementation of a clinical AI supervisory agent
(TA2), built on the [Hermes](https://github.com/regain-inc/hermes) protocol.

It provides:
- **Safety DSL** - Write declarative safety policies
- **Policy evaluation** - First-match, boolean composition
- **Clinical policy packs** - Example rules (not clinically validated)
- **Audit logging** - Hermes-compatible audit events

## Quick Start

```bash
npm install @regain/popper-dsl @regain/popper-base
```

```typescript
import { PolicyEngine } from '@regain/popper-dsl';
import { basePolicyPack } from '@regain/popper-base';

const engine = new PolicyEngine(basePolicyPack);

const decision = await engine.evaluate({
  intervention: { kind: 'PRESCRIPTION_NEW', ... },
  snapshot: { ... }
});

console.log(decision); // { action: 'APPROVED' | 'ROUTE' | 'HARD_STOP', ... }
```

## Known Limitations (Alpha)

- [ ] Clinical policy packs are examples only, NOT validated
- [ ] Measurement protocols incomplete
- [ ] Performance not optimized
- [ ] Limited error messages

## Clinical Disclaimer

⚠️ **This software is NOT validated for clinical use.**

The clinical policy packs included are examples for development and research.
Organizations deploying in clinical settings are responsible for:
- Clinical validation
- Regulatory compliance
- Patient safety assessment

## License

Apache 2.0 - See [LICENSE](./LICENSE)

Popper™ is a trademark of Regain Health, Inc.
```

---

## Version Numbering Strategy

```
v0.1.0 - Initial alpha release
v0.2.0 - Breaking changes allowed (semver 0.x rules)
v0.3.0 - More features, still breaking changes OK
...
v0.9.0 - Feature complete, stabilizing
v1.0.0 - First stable release (breaking changes = major bump)
```

**Start at v0.1.0** - This signals:
1. Not production-ready
2. Breaking changes expected
3. Feedback wanted

---

## GitHub Repository Settings

### Repo Description

```
Hermes: Open protocol for clinical AI supervision (⚠️ Alpha)
Popper: Reference TA2 implementation for clinical AI safety (⚠️ Alpha)
```

### Topics (Tags)

```
clinical-ai, healthcare, ai-safety, supervision, protocol, alpha,
arpa-h, advocate, hermes, open-source
```

### About Section

```
Website: https://hermes-protocol.dev
License: Apache-2.0
```

---

## What Alpha Protects You From

| Criticism | Your Response |
|-----------|---------------|
| "This has bugs" | "Yes, it's alpha. Here's the issue tracker." |
| "This isn't complete" | "Correct, see roadmap for planned features." |
| "API changed and broke my code" | "We're 0.x, breaking changes are expected." |
| "Documentation is sparse" | "We're prioritizing core functionality first." |

## What Alpha Does NOT Protect You From

| Criticism | You Must Avoid |
|-----------|----------------|
| "npm install crashes" | Basic installation must work |
| "The example doesn't run" | Documented example must work |
| "There are secrets in the code" | Security basics required |
| "This looks abandoned" | Must respond to issues |

---

## GitHub Issues: Pre-Create Known Issues

Before launch, create issues for known limitations:

```markdown
## Issue: Measurement protocols not implemented

**Type:** Enhancement
**Priority:** High
**Milestone:** v0.3.0

The measurement protocols for accuracy ascertainment and hallucination
quantification are not yet implemented.

Current status: Placeholder code exists, returns mock data.

Target: March 2026
```

This shows:
1. You're aware of gaps
2. You have a plan
3. You're being transparent

---

## Hacker News Framing (If Marketing Later)

**Note:** Skipped in quiet open-source approach. Save for later if we decide to promote after ARPA-H selection.

```
Show HN: Hermes – Open protocol for clinical AI supervision (alpha)

We're building an open protocol for clinical AI safety and releasing
an early alpha to get feedback.

Hermes defines how clinical AI agents should communicate with safety
supervisors – think "HTTP for clinical AI oversight."

It's rough around the edges (hence alpha), but the core protocol
design is solid and we'd love feedback on:
- The message schema design
- The intervention taxonomy
- What's missing for your use case

Links:
- Hermes: github.com/regain-inc/hermes
- Popper (reference impl): github.com/regain-inc/popper

We're building this for the ARPA-H ADVOCATE program. Decided to
open-source early rather than polish in private.
```

---

## Timeline: Alpha → Production Progression

**This is our primary strategy: launch alpha before Solution Summary, reach production before Full Proposal.**

| Date | Action | Version | ARPA-H |
|------|--------|---------|--------|
| Feb 1-15 | Release alpha | v0.1.0-alpha | - |
| Feb 27 | Solution summary submitted | Reference v0.1.x | **Solution Summary** |
| Mar 1-7 | Bug fixes from alpha feedback | v0.2.0 | - |
| Mar 8-14 | Documentation improvements | v0.3.0 | - |
| Mar 15-21 | Stability and tests | v0.9.0 | - |
| Mar 22-28 | Production release | **v1.0.0** | - |
| April 1 | Full proposal submitted | Reference v1.0.0 | **Full Proposal** |

### Why This Works

**Solution Summary (Feb 27):**
- "We have open-sourced Hermes and Popper under Apache 2.0"
- "Initial alpha release is gathering community feedback"
- Shows initiative and commitment to open collaboration

**Full Proposal (April 1):**
- "Since our solution summary, we've reached production (v1.0)"
- "[X] GitHub stars, [Y] downloads, [Z] teams evaluating"
- "Iterated from v0.1 to v1.0 in 6 weeks based on feedback"
- Demonstrates execution velocity and responsiveness

---

## Minimum Bar Before Alpha Launch

### Must Have

- [ ] `npm install @regain/hermes-core` works
- [ ] Basic validation example runs
- [ ] README with alpha warning
- [ ] LICENSE file (Apache 2.0)
- [ ] No secrets/credentials in code
- [ ] At least one working example

### Nice to Have (Can Follow)

- [ ] Comprehensive tests
- [ ] Full documentation
- [ ] Performance optimization
- [ ] All features complete

---

## Updated URLs

| Asset | URL |
|-------|-----|
| GitHub Org | https://github.com/regain-inc |
| Hermes Repo | https://github.com/regain-inc/hermes |
| Popper Repo | https://github.com/regain-inc/popper |
| npm Scope | @regain (or @regain-inc if @regain taken) |
| Landing Page | https://hermes-protocol.dev |
