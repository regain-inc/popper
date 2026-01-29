# Popper Governance

This document describes the governance model for the Regain Popper™ project.

## Overview

Popper is an open-source clinical AI supervisory agent built on the Hermes protocol. It provides safety evaluation, policy enforcement, and audit capabilities for clinical AI systems.

Popper is designed as **brain-agnostic** — it can supervise any clinical reasoning agent, not just specific implementations.

The project is maintained by Regain, Inc. with input from the community.

## Roles

### Maintainers

Maintainers have write access to the repository and are responsible for:

- Reviewing and merging pull requests
- Triaging issues
- Releasing new versions
- Enforcing the code of conduct

**Current Maintainers:**

- Anton Kim (Regain, Inc.) - Lead Maintainer

### Popper Steering Committee (PSC)

The PSC guides the project's strategic direction, including:

- Major architectural decisions
- Policy pack standards
- Measurement protocol changes
- Governance changes

**Current PSC Members:**

- Anton Kim, Founder and CEO of Regain, Inc. (Chair)
- Seat 2: Open
- Seat 3: Open

PSC seats may be filled by individuals who have demonstrated sustained, high-quality contributions to the project.

### Contributors

Anyone who contributes code, documentation, policy packs, or other improvements. Contributors are recognized in the project's commit history and release notes.

## Decision Making

### Minor Changes

- Bug fixes, documentation improvements, non-clinical policy rules
- Any maintainer can merge
- No PSC approval required

### Major Changes

- New DSL features, architectural changes
- Requires PSC majority approval
- 14-day comment period before merge

### Clinical Policy Changes

- Changes to clinical policy packs (thresholds, evidence grades)
- Requires clinical review
- Requires PSC unanimous approval
- Must document clinical rationale

### Breaking Changes

- Changes that break backward compatibility
- Requires PSC unanimous approval
- 90-day deprecation notice required
- Must increment major version

## Versioning

Popper follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes

**Current Version Policy:**

- v0.x: Rapid iteration, breaking changes allowed with notice
- v1.x: Stable, strict backward compatibility

## Clinical Disclaimer

Popper is provided for research and development purposes. The clinical policy packs included are examples and are **NOT validated for clinical use**.

Organizations deploying Popper in clinical settings are responsible for:

- Clinical validation appropriate to their use case
- Regulatory compliance (FDA, etc.)
- Patient safety assessment

## Trademarks

"Regain Popper" and "Popper" are trademarks of Regain, Inc.

Use of these marks is subject to the [Trademark Policy](./TRADEMARK.md).

Forks of this project may not use the "Popper" name without permission.

## Certification

Certification for Popper implementations will be available through the Hermes Certification Program. See [Certification](./CERTIFICATION.md) for details.

## License

Popper is licensed under [Apache License 2.0](./LICENSE).

## Code of Conduct

All participants must follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Changes to Governance

Changes to this governance document require PSC unanimous approval.
