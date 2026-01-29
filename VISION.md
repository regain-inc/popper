# Popper Vision

## The Challenge

As clinical AI systems become more capable, there's a critical need for independent safety oversight. Clinical reasoning agents can propose interventions — medication changes, lifestyle recommendations, escalations to clinicians — but without independent verification, there's no guarantee these proposals are safe.

The challenge isn't just building safe AI. It's building AI systems that can be **verified** as safe by an independent party.

## The Solution: The Shield

Regain Popper™ is an independent supervisory agent — "The Shield" — that evaluates clinical AI decisions before they reach patients.

When a clinical reasoning agent proposes an action, Popper:

1. **Evaluates** the proposal against safety policies
2. **Decides**: Approve, request more information, route to clinician, or hard-stop
3. **Logs** every decision for audit and accountability

Popper doesn't try to be helpful. It doesn't second-guess clinical reasoning. It enforces safety boundaries — nothing more, nothing less.

## Brain-Agnostic Design

**Popper is designed to supervise ANY clinical reasoning agent, not just specific implementations.**

This is a deliberate architectural choice:

- **No trust in the "Brain"**: Popper validates independently. It doesn't assume the clinical AI is correct.
- **Self-contained safety**: All safety checks are in Popper. The clinical AI's internal checks are UX optimizations, not safety guarantees.
- **Configurable policies**: Safety rules live in configuration files, not hardcoded logic. Different deployments can have different rules.

Whether you're building your own clinical AI or integrating with an existing one, Popper can supervise it through the standard Hermes protocol.

## Deterministic Safety

Popper's safety layer is **deterministic**. It can make hard-stop decisions without calling an LLM.

This matters because:

- **Predictability**: The same input always produces the same safety decision
- **Speed**: Policy evaluation happens in milliseconds, not seconds
- **Auditability**: Every decision can be traced to specific rules
- **Reliability**: No network calls, no API rate limits, no model degradation

The Safety DSL (Domain-Specific Language) allows you to write declarative policies:

```yaml
- name: block_contraindicated_medication
  priority: 100
  when:
    intervention.kind: PRESCRIPTION_NEW
    has_contraindication: true
  then:
    action: HARD_STOP
    reason: CONTRAINDICATION_DETECTED
```

## The Popper Standard

Popper establishes a standard for clinical AI supervision:

### Safety DSL

A declarative language for expressing safety policies. Policies are:

- Human-readable YAML
- Version-controlled
- Testable and auditable

### Audit Trails

Every decision produces an audit event with:

- Trace ID for correlation
- Input snapshot reference
- Applied rules and outcomes
- Timestamps and metadata

### Safe-Mode Controls

Operational controls for managing supervision behavior:

- Enable/disable specific policy packs
- Adjust thresholds for different contexts
- Emergency override capabilities

## Our Commitment

We believe clinical AI safety should be:

- **Open**: The protocol and reference implementation are open source
- **Verifiable**: Every decision can be audited and explained
- **Independent**: Safety supervision is separate from clinical reasoning
- **Standard**: One protocol for the entire ecosystem

Popper is our contribution to making clinical AI safer for everyone.

---

*Regain Popper™ is a trademark of Regain, Inc.*
