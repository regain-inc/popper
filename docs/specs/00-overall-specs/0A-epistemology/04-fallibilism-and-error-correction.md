# Fallibilism and Error Correction

> **Purpose**: Explain the principle of fallibilism—that all knowledge is provisional—and how error correction enables progress rather than undermining it.

---

## 1. Fallibilism Defined

**Fallibilism** is the philosophical position that:

> Human beings can be mistaken about anything they think or do.

This sounds pessimistic but is actually the foundation of rational optimism. If we could never be wrong, we could never improve. The recognition of fallibility is what enables error correction.

### What Fallibilism Is Not

| Fallibilism IS | Fallibilism IS NOT |
|----------------|-------------------|
| "I might be wrong" | "I am probably wrong" |
| Knowledge is provisional | Knowledge is impossible |
| Errors are correctable | Errors are inevitable doom |
| Truth exists and we can approach it | Truth is relative or unknowable |

Fallibilism implies truth exists (otherwise "error" is meaningless) and that we can make progress toward it (by correcting errors).

---

## 2. Error as the Engine of Progress

David Deutsch emphasizes:

> "Without error-correction, all information processing—and hence all knowledge-creation—is necessarily bounded."

Errors are not obstacles to progress; they are the raw material of progress.

### The Error-Correction Cycle

```
Action → Error → Detection → Correction → Improved Action
```

Every successful system—biological, technological, intellectual—runs this cycle continuously.

### Biological Example

Evolution proceeds by:
1. Genetic variation (errors in copying)
2. Selection pressure (detection of fitness errors)
3. Differential reproduction (correction)
4. Adaptation (improved organisms)

Without copying errors, evolution stalls.

### Scientific Example

Science proceeds by:
1. Theory proposal (might be wrong)
2. Testing (detection of errors)
3. Revision or rejection (correction)
4. Better theory (improved knowledge)

Without bold conjectures that risk being wrong, science stalls.

---

## 3. Criticism as a Virtue

In the Popper-Deutsch tradition, **criticism is not hostility—it is the highest form of intellectual respect**.

To criticize an idea is to take it seriously enough to test it. To shield an idea from criticism is to guarantee it will accumulate errors.

### Open Systems vs. Closed Systems

| Closed System | Open System |
|---------------|-------------|
| Shields ideas from criticism | Welcomes criticism |
| Errors accumulate silently | Errors are detected and corrected |
| Stagnates or collapses | Improves over time |
| Authoritarian | Democratic |

Medical practice should be an open system: actively seeking feedback, adverse event reporting, outcome audits, peer review.

---

## 4. "Problems Are Inevitable, Problems Are Soluble"

Deutsch's twin principles:

### Problems Are Inevitable

No matter how much we know, we will always encounter new problems:
- New diseases emerge
- Treatments have side effects we didn't predict
- Patients present with unusual combinations
- Guidelines become outdated

This is not a failure—it's the nature of reality. Knowledge is infinite; we will never reach the end.

### Problems Are Soluble

Given the right knowledge, any problem can be solved:
- Diseases once fatal are now curable
- Side effects can be managed or treatments replaced
- Unusual presentations can be diagnosed
- Guidelines can be updated

"Soluble" does not mean "easy" or "quick." It means: there is no fundamental barrier. With enough effort and the right approach, solutions exist.

### Rational Optimism

This is not naive optimism ("everything will be fine"). It's rational optimism:
- Problems will arise (realism)
- We can solve them (confidence in knowledge creation)
- Therefore: invest in error correction, not error denial

---

## 5. Error Correction Mechanisms

### In Science
- Peer review
- Replication
- Meta-analysis
- Null findings published

### In Medicine
- Adverse event reporting (VAERS, MedWatch)
- Quality improvement (PDSA cycles)
- Mortality and morbidity conferences
- Practice guidelines with revision schedules
- Second opinions

### In AI Systems
- Human-in-the-loop review
- Audit logging
- Drift detection
- Model retraining
- User feedback loops

---

## 6. Medical Application

### Example: Learning from Adverse Events

A patient on a new heart failure medication develops acute kidney injury.

**Without fallibilism**: "This must be a coincidence—the drug is proven safe."
**With fallibilism**: "This could be a signal. Let's investigate."

Investigation reveals: the drug interacts with NSAIDs to cause renal vasoconstriction. This was not in the original trials because NSAID users were excluded.

**Error correction**: Update prescribing guidelines to warn about NSAID interaction.

### Example: Revising Clinical Practice

For decades, tight glucose control in ICU patients was standard. Then the NICE-SUGAR trial showed it increased mortality.

**Without fallibilism**: "Our practice is established; this one study must be wrong."
**With fallibilism**: "Our practice might be wrong. Let's examine the evidence."

**Error correction**: ICU glucose targets were revised upward.

This is science working correctly: detecting an error in practice and correcting it.

---

## 7. Implementation in Regain

### 7.1 DisclosureBundle: Key Unknowns

Every recommendation includes a `key_unknowns` field:
- What don't we know?
- What could we be wrong about?
- What would change this recommendation?

This is fallibilism operationalized: the system admits its own limitations.

### 7.2 Audit Events

All decisions are logged with:
- What was decided
- What evidence supported it
- What was the confidence level

This enables retrospective error detection.

### 7.3 Drift Monitoring

The Popper (TA2) supervisor monitors for:
- Changes in recommendation patterns
- Unusual outcomes
- Divergence from expected behavior

This catches errors before they propagate.

### 7.4 Version Control

Every policy, rule, and model has a version. When errors are found:
- The correction is made
- The version increments
- The change is documented

No knowledge is treated as final.

---

## 8. The Danger of Infallibilism

Systems that claim certainty—or resist admitting error—fail in predictable ways:

| Infallibilist Behavior | Consequence |
|------------------------|-------------|
| "The model is 99% accurate" | Overreliance, missed edge cases |
| "This treatment always works" | Harm to patients who don't respond |
| "Our process is validated" | Failure to update when evidence changes |
| "Trust the algorithm" | Automation complacency |

The Regain system is designed to avoid these failure modes by building fallibilism into its architecture.

---

## 9. Key Sources

- Deutsch, D. (2011). *The Beginning of Infinity*, Chapters 9 and 13
- [Critical Fallibilism: Evolution and Error Correction](https://criticalfallibilism.com/critical-fallibilism-evolution-and-digital-error-correction/)
- [Nautilus: Why It's Good To Be Wrong](http://nautil.us/issue/2/uncertainty/why-its-good-to-be-wrong)
- [Res Extensa: Liberal Science—Fallibilism and Error Correction](https://www.resextensa.co/p/liberal-science-fallibilism-and-error)
- [Driverless Crocodile: Deutsch on Error Correction](https://www.driverlesscrocodile.com/iteration/david-deutsch-on-politics-planning-and-error-correction/)

---

*Next: [05-iterative-progress.md](05-iterative-progress.md)*
