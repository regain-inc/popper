# Hard-to-Vary Explanations

> **Purpose**: Deep dive into David Deutsch's central criterion for distinguishing good explanations from bad ones. This principle is operationalized in the Regain system as HTV (Hard-to-Vary) scoring.

---

## 1. The Core Insight

David Deutsch proposes a simple but profound test for explanation quality:

> **Good explanations are hard to vary while still accounting for the phenomena they explain.**

An explanation is "hard to vary" when every detail plays a functional role. Change any part, and the explanation breaks—it no longer accounts for what it was meant to explain.

Conversely, a "bad" explanation is easy to vary: you can swap out details, add epicycles, or adjust parameters to fit any observation. Such explanations are unfalsifiable in practice because they explain everything and therefore nothing.

---

## 2. The Classic Example: Why We Have Seasons

### The Easy-to-Vary Explanation (Bad)

Ancient Greek mythology explained seasons through the story of Persephone:
- Persephone, goddess of spring, is abducted by Hades
- Her mother Demeter, goddess of harvest, grieves
- During Persephone's time in the underworld, Demeter's grief causes winter
- When Persephone returns, spring arrives

**Why this is easy to vary**:
- Persephone could be replaced by any deity
- Hades could be Zeus, Poseidon, or an invented god
- The mechanism (grief → cold) has no specific connection to the details
- The story can be adjusted to fit any seasonal pattern

### The Hard-to-Vary Explanation (Good)

Modern astronomy explains seasons through axial tilt:
- Earth's rotational axis is tilted 23.4° relative to its orbital plane
- When the Northern Hemisphere tilts toward the Sun, it receives more direct sunlight → summer
- When it tilts away, sunlight hits at a lower angle and spreads over more area → winter
- The Southern Hemisphere experiences opposite seasons simultaneously

**Why this is hard to vary**:
- The 23.4° angle is precisely measured; a different angle would predict different seasonal intensity
- The mechanism (angle → sunlight intensity → temperature) is tightly coupled
- It predicts that the Southern Hemisphere has opposite seasons (verified)
- It explains why the equator has no seasons (also verified)
- Every detail is load-bearing: change any, and predictions fail

---

## 3. The Four Dimensions of Hard-to-Vary

The Regain system operationalizes this criterion as **HTV scoring** with four dimensions:

### 3.1 Interdependence

**Definition**: How tightly coupled are the parts of the explanation?

| Low Interdependence | High Interdependence |
|---------------------|----------------------|
| "Stress causes headaches" | "Tension in trapezius muscles compresses occipital nerves" |
| Parts are loosely connected | Each part references others |

In a high-interdependence explanation, removing one element makes the others meaningless.

### 3.2 Specificity

**Definition**: How precise are the predictions?

| Low Specificity | High Specificity |
|-----------------|------------------|
| "Exercise helps health" | "30 min of moderate aerobic activity reduces systolic BP by 5-8 mmHg" |
| Vague, always "confirmed" | Precise, can be clearly tested |

Specific predictions are easier to refute—and therefore more meaningful when corroborated.

### 3.3 Parsimony

**Definition**: Are there unnecessary elements?

| Low Parsimony | High Parsimony |
|---------------|----------------|
| "Condition X is caused by toxins, stress, diet, genetics, and cosmic alignment" | "Condition X is caused by mutation in gene Y affecting enzyme Z" |
| Many elements, some irrelevant | Minimal sufficient explanation |

Parsimony is not minimalism for its own sake—it's about having *no superfluous parts*. Every element should carry explanatory weight.

### 3.4 Falsifiability

**Definition**: What would refute this explanation?

| Low Falsifiability | High Falsifiability |
|--------------------|---------------------|
| "There is an imbalance" | "Serum potassium will be below 3.5 mEq/L" |
| No clear test | Clear test with pass/fail criteria |

An explanation should make predictions that, if wrong, would count against it.

---

## 4. Medical Application: Good Diagnoses vs. Vague Labels

### Example: "Chronic Fatigue"

**Easy-to-vary (bad) explanation**:
> "Patient has chronic fatigue syndrome due to unknown factors"

- Can accommodate any symptom pattern
- No mechanism specified
- No clear predictions to test
- Treatment is trial-and-error

**Hard-to-vary (good) explanation**:
> "Patient has hypothyroidism (TSH: 8.2 mIU/L, T4: 0.8 ng/dL) causing fatigue through reduced metabolic rate. Levothyroxine at 50 mcg/day should normalize TSH within 6 weeks and reduce fatigue."

- Specific mechanism (low T4 → reduced metabolism → fatigue)
- Precise predictions (TSH should normalize, fatigue should improve)
- Clear falsification conditions (if TSH normalizes but fatigue persists, explanation is wrong)
- Every detail is testable

### Example: Differential Diagnosis

When a clinician builds a differential, they are generating **multiple hard-to-vary explanations** and systematically testing them:

1. **Conjecture 1**: "Chest pain is cardiac—unstable angina"
   - Prediction: Troponin elevated, ECG changes
   - Test result: Troponin normal, ECG normal
   - **Refuted**

2. **Conjecture 2**: "Chest pain is pulmonary—pulmonary embolism"
   - Prediction: D-dimer elevated, CT shows clot
   - Test result: D-dimer normal
   - **Refuted**

3. **Conjecture 3**: "Chest pain is musculoskeletal—costochondritis"
   - Prediction: Reproducible on palpation, no systemic signs
   - Test result: Pain reproduced by pressing on sternum
   - **Survives testing** (tentatively retained)

Each diagnosis is a hard-to-vary explanation with specific predictions that can be tested.

---

## 5. Why Easy-to-Vary Explanations Fail

### They Cannot Be Wrong

If an explanation can accommodate any outcome, it provides no guidance:
- "Treatment might help, or it might not work for you"
- "The condition could improve, stay stable, or worsen"
- "Results vary depending on individual factors"

These statements are true but useless—they don't help decide anything.

### They Resist Correction

Easy-to-vary explanations are self-protecting:
- Failure is attributed to "individual variation"
- Success is claimed even when outcomes are vague
- The theory never accumulates counter-evidence

### They Stagnate

Without clear predictions to test, there's no way to improve:
- Which details are important?
- What should change if outcomes disappoint?
- How do we know if we're making progress?

---

## 6. Implementation in Regain

The HTV score in the Regain system is computed as:

```
HTV = (interdependence + specificity + parsimony + falsifiability) / 4
```

Each dimension is scored 0.0–1.0 based on structured evaluation.

### Thresholds

| HTV Score | Interpretation |
|-----------|----------------|
| 0.0–0.3 | **Refuted / unusable** — effectively easy-to-vary; should not be acted upon |
| 0.3–0.4 | **Poor** — likely too vague; route / IDK for high-risk decisions |
| 0.4–0.7 | **Moderate** — may be useful but needs strengthening; disclose uncertainty |
| 0.7–0.9 | **Good** — hard to vary, actionable (subject to other checks) |
| 0.9–1.0 | **Excellent** — highly specific, tightly coupled, readily testable |

### Example in ArgMed Debate

When the **Verifier** (Critic) agent evaluates a hypothesis from the **Generator**, it applies HTV criteria:

- "Is every part of this explanation necessary?"
- "Does changing any detail break the logic?"
- "What specific prediction does this make?"
- "What finding would refute this?"

Hypotheses with low HTV scores are deprioritized in favor of those that are genuinely hard to vary.

---

## 7. Key Sources

- Deutsch, D. (2011). *The Beginning of Infinity*, Chapter 1: "The Reach of Explanations"
- [David Deutsch TED Talk: A new way to explain explanation](https://www.ted.com/talks/david_deutsch_a_new_way_to_explain_explanation)
- [LessWrong: Book Review of Beginning of Infinity](https://www.lesswrong.com/posts/FyRyECG7YxvAF2QTF/book-review-the-beginning-of-infinity)
- [Nav.al: The Beginning of Infinity notes](https://nav.al/infinity)

---

*Next: [02-primacy-of-explanations.md](02-primacy-of-explanations.md)*
