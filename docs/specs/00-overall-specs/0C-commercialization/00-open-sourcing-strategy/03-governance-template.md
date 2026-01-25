# Governance Template

This document provides the template for GOVERNANCE.md files in the Hermes and Popper repositories.

---

## Hermes GOVERNANCE.md

```markdown
# Hermes Governance

This document describes the governance model for the Hermes project.

## Overview

Hermes is the open protocol for clinical AI supervision, enabling safe
communication between clinical agents (TA1) and supervisory agents (TA2).

The project is maintained by Regain Health, Inc. with input from the
community.

## Roles

### Maintainers

Maintainers have write access to the repository and are responsible for:
- Reviewing and merging pull requests
- Triaging issues
- Releasing new versions
- Enforcing the code of conduct

**Current Maintainers:**
- @[founder-github] (Regain Health) - Lead Maintainer

### Hermes Steering Committee (HSC)

The HSC guides the project's strategic direction, including:
- Major version decisions
- Breaking changes
- Protocol extensions
- Governance changes

**Current HSC Members:**
- [Founder Name], Regain Health (Chair)
- Seat 2: Open
- Seat 3: Open

HSC seats may be filled by individuals who have demonstrated sustained,
high-quality contributions to the project.

### Contributors

Anyone who contributes code, documentation, or other improvements.
Contributors are recognized in CONTRIBUTORS.md.

## Decision Making

### Minor Changes
- Bug fixes, documentation improvements, small features
- Any maintainer can merge
- No HSC approval required

### Major Changes
- New message types, significant API changes
- Requires HSC majority approval
- 14-day comment period before merge

### Breaking Changes
- Changes that break backward compatibility
- Requires HSC unanimous approval
- 90-day deprecation notice required
- Must increment major version

## Versioning

Hermes follows [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes

**Current Version Policy:**
- v0.x: Rapid iteration, breaking changes allowed with notice
- v1.x: Stable, strict backward compatibility

## Trademarks

"Hermes" and "Hermes Certified" are trademarks of Regain Health, Inc.

Use of these marks is subject to the [Trademark Policy](./TRADEMARK.md).

Forks of this project may not use the "Hermes" name without permission.

## Certification

"Hermes Certified" status is available for implementations that pass
the official conformance test suite. See [Certification](./CERTIFICATION.md).

## License

Hermes is licensed under [Apache License 2.0](./LICENSE).

## Code of Conduct

All participants must follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Changes to Governance

Changes to this governance document require HSC unanimous approval.
```

---

## Popper GOVERNANCE.md

```markdown
# Popper Governance

This document describes the governance model for the Popper project.

## Overview

Popper is the reference implementation of a clinical AI supervisory agent,
built on the Hermes protocol. It provides safety evaluation, policy
enforcement, and audit capabilities.

The project is maintained by Regain Health, Inc. with input from the
community.

## Roles

### Maintainers

Maintainers have write access to the repository and are responsible for:
- Reviewing and merging pull requests
- Triaging issues
- Releasing new versions
- Enforcing the code of conduct

**Current Maintainers:**
- @[founder-github] (Regain Health) - Lead Maintainer

### Popper Steering Committee (PSC)

The PSC guides the project's strategic direction, including:
- Major architectural decisions
- Policy pack standards
- Measurement protocol changes
- Governance changes

**Current PSC Members:**
- [Founder Name], Regain Health (Chair)
- Seat 2: Open
- Seat 3: Open

### Contributors

Anyone who contributes code, documentation, policy packs, or other
improvements. Contributors are recognized in CONTRIBUTORS.md.

## Decision Making

### Minor Changes
- Bug fixes, documentation, new non-clinical policy rules
- Any maintainer can merge

### Major Changes
- New DSL features, architectural changes
- Requires PSC majority approval
- 14-day comment period

### Clinical Policy Changes
- Changes to clinical policy packs (HTV thresholds, evidence grades)
- Requires clinical review
- Requires PSC unanimous approval
- Must document clinical rationale

### Breaking Changes
- Requires PSC unanimous approval
- 90-day deprecation notice

## Clinical Disclaimer

Popper is provided for research and development purposes. The clinical
policy packs included are examples and are NOT validated for clinical use.

Organizations deploying Popper in clinical settings are responsible for:
- Clinical validation appropriate to their use case
- Regulatory compliance (FDA, etc.)
- Patient safety assessment

## Trademarks

"Popper" is a trademark of Regain Health, Inc.

Forks of this project may not use the "Popper" name without permission.

## License

Popper is licensed under [Apache License 2.0](./LICENSE).

## Code of Conduct

All participants must follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Changes to Governance

Changes to this governance document require PSC unanimous approval.
```

---

## Supporting Files

### TRADEMARK.md (for both repos)

```markdown
# Trademark Policy

## Trademarks

The following are trademarks of Regain Health, Inc.:
- Hermes™
- Popper™
- Hermes Certified™

## Permitted Use

You MAY:
- State that your software "uses Hermes" or "is compatible with Hermes"
- State that your software "is built on Popper"
- Use the marks in truthful comparative advertising

You MAY NOT:
- Use "Hermes" or "Popper" in your product name
- Use "Hermes Certified" without official certification
- Imply endorsement by Regain Health without permission
- Use the marks in a way that suggests your product IS Hermes/Popper

## Forks

If you fork this project:
- You must rename your fork
- You may state "forked from Hermes" or "based on Popper"
- You may not use "Hermes" or "Popper" in the fork's name

## Questions

Contact: trademarks@regain.health
```

### CODE_OF_CONDUCT.md (for both repos)

```markdown
# Code of Conduct

## Our Pledge

We are committed to providing a welcoming and harassment-free experience
for everyone, regardless of age, body size, disability, ethnicity, gender
identity, level of experience, nationality, personal appearance, race,
religion, or sexual identity and orientation.

## Our Standards

**Positive behaviors:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behaviors:**
- Harassment, trolling, or personal attacks
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

## Enforcement

Instances of abusive behavior may be reported to conduct@regain.health.

All complaints will be reviewed and investigated and will result in a
response that is deemed necessary and appropriate.

## Attribution

This Code of Conduct is adapted from the Contributor Covenant, version 2.1.
```

### CONTRIBUTING.md (for both repos)

```markdown
# Contributing to [Hermes/Popper]

Thank you for your interest in contributing!

## How to Contribute

### Reporting Issues

- Search existing issues first
- Include version number
- Provide minimal reproduction steps
- Include expected vs actual behavior

### Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Ensure tests pass
6. Submit PR with clear description

### Code Style

- Run `bun run lint` before submitting
- Follow existing code patterns
- Add comments for complex logic

### Commit Messages

Use conventional commits:
- `feat: Add new message type`
- `fix: Handle edge case in validation`
- `docs: Update README examples`

## Getting Help

- Open an issue for questions
- Join discussions in GitHub Discussions

## Contributor License Agreement (CLA)

By submitting a pull request or other contribution to this project, you agree to the following terms:

### Grant of Rights

1. **Copyright License**: You grant Regain Health, Inc. and recipients of software distributed by Regain Health a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute your contributions and such derivative works.

2. **Patent License**: You grant Regain Health, Inc. and recipients of software distributed by Regain Health a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer your contributions, where such license applies only to those patent claims licensable by you that are necessarily infringed by your contribution(s) alone or by combination of your contribution(s) with the project to which such contribution(s) were submitted.

3. **Relicensing Right**: You grant Regain Health, Inc. the right to relicense your contributions under different license terms, including but not limited to LGPL, AGPL, or commercial licenses, at Regain Health's sole discretion.

### Representations

4. **Original Work**: You represent that each of your contributions is your original creation and that you have the right to grant the above licenses.

5. **Third-Party Content**: If your contribution includes or is based on any third-party code, you will clearly identify it and provide all relevant license information.

6. **Employer Rights**: If your employer has rights to intellectual property that you create, you represent that you have received permission to make the contributions on behalf of that employer, or that your employer has waived such rights for your contributions.

### Why We Require This CLA

This CLA allows Regain Health to:
- Protect the project from license-related legal issues
- Offer commercial licenses to organizations that cannot use open-source licenses
- Potentially change the license in the future if needed for the project's health
- Maintain flexibility to respond to evolving open-source ecosystem needs

Your contributions will always remain available under the current Apache 2.0 license for existing users. The CLA simply preserves our ability to offer additional licensing options.

### Agreeing to the CLA

By submitting a pull request, you indicate your agreement to this CLA. For significant contributions, we may ask you to sign a formal CLA document.
```

---

## Why This Governance Matters

| Element | Purpose |
|---------|---------|
| **Steering Committee** | You maintain control over direction |
| **Breaking change process** | Prevents chaos, maintains stability |
| **Trademark policy** | Forks can't use your name |
| **Clinical disclaimer** | Limits liability |
| **Open seats** | Shows openness to community |

## When to Update

| Trigger | Action |
|---------|--------|
| Major contributor emerges | Consider adding to maintainers |
| v1.0 release | Tighten breaking change policy |
| Corporate adopter wants input | Consider HSC seat |
| Governance dispute | Clarify rules |

---

## Licensing Strategy

### Current License: Apache 2.0

We use Apache 2.0 for maximum adoption:
- Permissive: Companies can use without open-sourcing their code
- ARPA-H friendly: Satisfies "open source" preference
- Patent grant: Protects users and contributors
- Attribution required: Maintains brand awareness

### Why CLA Is Critical

The Contributor License Agreement (CLA) preserves our ability to:

| Capability | Why It Matters |
|------------|----------------|
| **Dual licensing** | Offer commercial licenses to companies avoiding copyleft |
| **License evolution** | Transition to LGPL/AGPL for v2.0 if needed |
| **Relicensing** | Respond to ecosystem changes (e.g., if competitors exploit permissive license) |
| **Legal protection** | Ensure all contributions have clear IP status |

**Without CLA:** Once code is Apache 2.0, we cannot change it. We'd need consent from every contributor to relicense.

**With CLA:** We retain flexibility while contributors' code remains available under Apache 2.0.

### Phased Licensing Strategy

| Phase | Timeline | License | Rationale |
|-------|----------|---------|-----------|
| **Phase 1** | Now - ARPA-H decision | Apache 2.0 + CLA | Maximum adoption, ARPA-H alignment |
| **Phase 2** | If standard established | Evaluate LGPL | Compel modifications to be shared |
| **Phase 3** | If commercial demand | Consider dual license | AGPL (free) + Commercial (paid) |

### Phase 2: LGPL Consideration (Future)

If Hermes becomes the standard, we may transition NEW major versions to LGPL:

```
What LGPL requires:
- Modifications to Hermes/Popper itself must be shared
- Applications USING Hermes can remain proprietary
- Dynamic linking is allowed

What LGPL does NOT require:
- Open-sourcing your TA1 agent (it just uses Hermes)
- Open-sourcing your application code
- Sharing your proprietary integrations
```

**Trigger for LGPL consideration:**
- Competitors forking without contributing
- Hermes is clearly the standard (80%+ market)
- Big tech "taking without giving"

### Phase 3: Dual License Consideration (Future)

If we want to monetize open-source directly:

```
Hermes Community (AGPL-3.0)      Hermes Enterprise ($X/year)
├── Must open-source if modified  ├── Keep modifications private
├── Must use AGPL for derivatives ├── No copyleft obligations
├── Free                          ├── Priority support
└── Community support only        └── SLA + indemnification
```

**Trigger for dual license:**
- Significant enterprise demand for non-copyleft
- Community contributions justify complexity
- Certification program not generating sufficient revenue

### What We DON'T Do

| Approach | Why We Avoid It |
|----------|-----------------|
| **AGPL from start** | Hurts adoption (big tech avoids AGPL) |
| **No CLA** | Locks us into Apache 2.0 forever |
| **BSL/Source Available** | Not "open source" - may hurt ARPA-H perception |
| **Delayed open source** | Looks like we're hiding something |

### Communicating License Changes

If we ever change the license:

1. **Existing code stays Apache 2.0** - Users of current version unaffected
2. **New version under new license** - Clear version boundary
3. **90-day notice** - Announced in advance
4. **Migration guide** - Help users understand implications
5. **Explain rationale** - Transparency about why

### Bottom Line

```
Phase 1 (Now):     Apache 2.0 + CLA
                   ├── Maximize adoption
                   ├── ARPA-H alignment
                   └── Preserve future options

Phase 2 (If standard): Consider LGPL for v2.0
                   ├── Compel contribution of modifications
                   ├── Applications stay proprietary
                   └── Only if clear market dominance

Phase 3 (If demand):   Consider dual license
                   ├── AGPL + Commercial
                   ├── Revenue from enterprise
                   └── Only if certification insufficient
```

The CLA is the critical enabler. Without it, we're locked in. With it, we have strategic flexibility.
