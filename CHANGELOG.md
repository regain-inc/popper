# Changelog

All notable changes to Regain Popper™ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial open-source documentation (VISION, GOVERNANCE, CONTRIBUTING, etc.)

## [0.1.0-alpha] - 2026-01-28

### Added
- Core policy engine with deterministic Safety DSL
- Hermes protocol integration (`@regain/hermes` types)
- Supervision API (SupervisionRequest → SupervisionResponse)
- Safe-mode controls and state management
- Audit event logging with trace_id propagation
- TimescaleDB schema for audit storage
- Redis caching layer for idempotency and safe-mode state
- BullMQ worker for async processing
- Example policy packs (CVD, general wellness)

### Notes
- **Alpha Release**: APIs may change without notice
- **Not for Clinical Use**: Policy packs are examples only, not clinically validated

[Unreleased]: https://github.com/regain-inc/popper/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/regain-inc/popper/releases/tag/v0.1.0-alpha
