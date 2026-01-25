# Conjecture and Refutation

> **Purpose**: Explain Popper's scientific method and how it applies to clinical reasoning, particularly differential diagnosis.

---

## 1. The Popperian Method

Karl Popper proposed that science advances not by confirming theories but by attempting to refute them:

> "The method of science is the method of bold conjectures and ingenious and severe attempts to refute them."
> — Karl Popper, *Conjectures and Refutations*

### The Cycle

```
Problem → Conjecture → Criticism → Error Elimination → New Problem
```

1. **Problem**: Something is unexplained or anomalous
2. **Conjecture**: A bold hypothesis is proposed
3. **Criticism**: The hypothesis is tested—logically, empirically, or both
4. **Error Elimination**: Failed hypotheses are discarded
5. **New Problem**: Surviving hypotheses reveal new questions

This cycle never terminates. Knowledge grows indefinitely, but is never complete.

---

## 2. The Logic of Falsification

### Why Verification Fails

No matter how many observations confirm a theory, they cannot prove it true. The next observation might contradict it.

| Number of Confirmations | Proof of Truth? |
|------------------------|-----------------|
| 1 | No |
| 100 | No |
| 1,000,000 | No |
| ∞ | Still no |

This is the "problem of induction."

### Why Falsification Works

A single counterexample can prove a universal claim false:

| Claim | Counterexample | Result |
|-------|----------------|--------|
| "All swans are white" | One black swan | Claim is false |
| "This patient has pneumonia" | Chest X-ray is clear | Hypothesis refuted |
| "Drug X is always safe" | One severe adverse event | Claim is false |

This asymmetry—between the impossibility of verification and the possibility of falsification—is the foundation of Popper's method.

### Modus Tollens

The logical form:

```
If P, then Q.    (Theory predicts observation)
Not Q.           (Observation contradicts prediction)
Therefore, not P. (Theory is refuted)
```

Example:
- If the patient has pulmonary embolism, D-dimer will be elevated
- D-dimer is normal
- Therefore, pulmonary embolism is unlikely (refuted as primary diagnosis)

---

## 3. Corroboration vs. Confirmation

Popper distinguished between:

| Confirmation | Corroboration |
|--------------|---------------|
| Evidence "proves" theory true | Evidence shows theory *survived a test* |
| Adds certainty | Adds resistance to refutation |
| Justifies belief | Justifies tentative retention |

A well-corroborated theory is not "proven"—it has simply passed many severe tests. We hold it tentatively, ready to revise if new evidence contradicts it.

### Severe Tests

Not all tests are equal. A **severe test** is one the theory might plausibly fail:

| Test Type | Example | Severity |
|-----------|---------|----------|
| Easy pass | "Patient with pneumonia has cough" | Low (most things cause cough) |
| Severe test | "Sputum culture grows Streptococcus pneumoniae" | High (specific prediction) |

The more ways a test could have failed, the more meaningful it is when the theory passes.

---

## 4. Bold Conjectures

Popper advocated for **bold conjectures**—hypotheses that:
- Make strong, specific predictions
- Differ significantly from existing theories
- Risk being refuted (high falsifiability)

Timid hypotheses that are vague or hedge against refutation may avoid being wrong, but they also cannot contribute to knowledge.

### Medical Application

| Timid Conjecture | Bold Conjecture |
|------------------|-----------------|
| "Patient might have some cardiac issue" | "Patient has NSTEMI—troponin will be elevated, ECG will show ST depression" |
| "Could be viral or bacterial" | "This is bacterial pneumonia—WBC elevated, consolidation on X-ray, fever pattern X" |

Bold conjectures guide action. Timid ones lead to endless testing without direction.

---

## 5. Differential Diagnosis as Conjecture-Refutation

Clinical differential diagnosis is a natural implementation of Popperian epistemology:

### Step 1: Generate Conjectures

From presenting symptoms, the clinician generates multiple hypotheses:
- Acute coronary syndrome
- Pulmonary embolism
- Pneumonia
- Musculoskeletal pain

Each is a **bold conjecture** with specific predictions.

### Step 2: Attempt Refutation

Each hypothesis implies certain findings. The clinician orders tests to look for contradictions:

| Hypothesis | Predicted Finding | Test |
|------------|-------------------|------|
| ACS | Elevated troponin, ECG changes | Troponin, ECG |
| PE | Elevated D-dimer, CT shows clot | D-dimer, CT-PA |
| Pneumonia | Infiltrate on X-ray, elevated WBC | CXR, CBC |
| MSK pain | Reproducible on palpation | Physical exam |

### Step 3: Eliminate Refuted Hypotheses

If troponin is normal and ECG unchanged, ACS is deprioritized. If D-dimer is normal, PE is unlikely. And so on.

### Step 4: Retain Survivors

The hypothesis that best explains findings *and has not been refuted* is tentatively adopted. But it remains provisional—new data might change the picture.

---

## 6. The Role of Negative Search

A crucial Popperian insight: **actively seek disconfirmation**.

| Confirmation Bias | Popperian Approach |
|-------------------|-------------------|
| "What confirms my hypothesis?" | "What would refute my hypothesis?" |
| Selective attention to supportive data | Active search for contradictory data |
| Overconfidence | Calibrated uncertainty |

In the Regain ArgMed debate, the **Verifier (Critic)** agent is explicitly tasked with negative search:
- "What evidence contradicts this?"
- "What predictions fail?"
- "What alternative explains this better?"

This adversarial structure prevents the system from falling into confirmation bias.

---

## 7. Implications for Clinical AI

### 7.1 Generate Multiple Hypotheses

The system should not output a single diagnosis but a ranked differential:
- Primary hypothesis (highest HTV, most corroborated)
- Alternative hypotheses (what if primary is wrong?)
- Refuted hypotheses (what was ruled out and why)

### 7.2 Specify Falsification Conditions

Every recommendation should state what would refute it:
- "If potassium remains low despite supplementation, consider non-compliance or GI loss"
- "If symptoms persist after 48h on antibiotics, reassess for resistant organism"

### 7.3 Track Refutations

Audit logs should record:
- Which hypotheses were generated
- Which were refuted and by what evidence
- Which survive and with what corroboration

### 7.4 Design Severe Tests

When recommending tests, prioritize those that could decisively refute leading hypotheses—not just those that might confirm them.

---

## 8. The ArgMed Implementation

The Regain system implements conjecture-refutation through the ArgMed multi-agent debate:

| Agent | Role | Popperian Function |
|-------|------|-------------------|
| **Generator** | Proposes hypotheses | Conjecturer |
| **Verifier** | Attacks hypotheses | Critic / Refuter |
| **Reasoner** | Selects survivors | Judge |

The Generator is instructed to be **bold**—generate multiple plausible theories.
The Verifier is instructed to be **adversarial**—try to destroy them.
The Reasoner selects based on **HTV and survival**—not probability alone.

---

## 9. Key Sources

- Popper, K. (1963). *Conjectures and Refutations: The Growth of Scientific Knowledge*
- Popper, K. (1959). *The Logic of Scientific Discovery*
- [Stanford Encyclopedia: Karl Popper](https://plato.stanford.edu/entries/popper/)
- [PMC: Falsifiability in medicine](https://pmc.ncbi.nlm.nih.gov/articles/PMC8140582/)
- [IEP: Popper's Philosophy of Science](https://iep.utm.edu/pop-sci/)

---

*Next: [04-fallibilism-and-error-correction.md](04-fallibilism-and-error-correction.md)*
