# 02 — Cardiometabolic Guideline Priority Map

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

This document prioritizes the clinical guidelines and safety sources that should ground Popper's first-wave cardiometabolic supervision rules. Prioritization is based on:

1. **Relevance to current Deutsch scope** — what clinical domains does Deutsch currently reason about?
2. **Safety criticality** — which domains carry the highest patient safety risk if unsupervised?
3. **Rule density** — which guidelines produce the most actionable supervision rules?
4. **Implementation readiness** — which guidelines have clear, deterministic recommendations that map well to Popper's rule engine?

---

## Priority Waves

### Wave 1 — Immediate (next 90 days)

These sources produce the highest-value supervision rules for Popper's current scope.

#### 1A. Medication Label Safety (Layer 1)

| Source | Description | Priority Rationale |
|---|---|---|
| **DailyMed Structured Product Labels** | FDA-approved labels for all medications in Popper's supervised formulary | Contraindications, black box warnings, and dose limits are non-negotiable safety facts. This is the single most important source layer. |
| **FDALabel Database** | Full-text search of boxed warnings, contraindications, warnings/precautions | Required for building the contraindication rule set |

**First medications to ground:**
- ACE inhibitors (lisinopril, enalapril, ramipril) — HF, HTN, CKD overlap
- ARBs (losartan, valsartan, candesartan) — HF, HTN, CKD overlap
- SGLT2 inhibitors (empagliflozin, dapagliflozin) — HF, diabetes, CKD triple overlap
- Beta-blockers (carvedilol, metoprolol succinate, bisoprolol) — HF
- MRAs (spironolactone, eplerenone) — HF, HTN
- Statins (atorvastatin, rosuvastatin) — lipids
- Anticoagulants (apixaban, rivaroxaban, warfarin) — AF, if in scope
- GLP-1 RAs (semaglutide, liraglutide) — diabetes, CV risk, emerging HTN data

**What supervision rules these produce:**
- Absolute contraindication checks → `HARD_STOP`
- Relative contraindication checks → `ROUTE_TO_CLINICIAN`
- Dose-ceiling enforcement → `ROUTE_TO_CLINICIAN` if proposed dose exceeds max
- Renal dose adjustment checks → `REQUEST_MORE_INFO` if eGFR not available or below threshold
- Pregnancy/lactation category checks → `HARD_STOP` or `ROUTE_TO_CLINICIAN`
- Black box warning condition checks → `ROUTE_TO_CLINICIAN` with mandatory acknowledgment

#### 1B. Heart Failure Guidelines (Layer 2)

| Source | Full Citation | Key Supervision Rules |
|---|---|---|
| **2022 AHA/ACC/HFSA HF Guideline** | Heidenreich PA et al. *Circulation*. 2022;145:e895-e1032. DOI: 10.1161/CIR.0000000000001063 | GDMT four-pillar therapy checks (ARNI/ACEi/ARB + BB + MRA + SGLT2i), titration to target dose rules, contraindication-aware medication selection |
| **2024 ACC ECDP for HFrEF** | *JACC*. 2024. DOI: 10.1016/j.jacc.2023.12.024 | Stepwise titration algorithm, practical medication initiation order |

**Key rules derivable:**
- HFrEF without SGLT2i: `ROUTE_TO_CLINICIAN` — "Guideline-recommended SGLT2i not present in proposal; Class I, LOE A" (§7.3.2)
- HFrEF without beta-blocker when stable: `ROUTE_TO_CLINICIAN` — verify clinical reasoning
- ARNI preferred over ACEi in HFrEF (Class I): informational note on APPROVED, not enforcement
- MRA initiation with K+ >5.0 or eGFR <30 without renal monitoring: `ROUTE_TO_CLINICIAN`
- HFpEF SGLT2i recommendation (Class IIa): lighter enforcement than HFrEF

**Maturity/Priority:** HIGH. Heart failure is the most complex medication supervision domain in cardiology, with the most potential for patient harm from inappropriate medication changes.

**Dependency on clinician review:** Every rule derived from this guideline requires domain cardiologist review before activation. HF medication management is nuanced; rules must capture the guideline's intent without becoming inappropriately rigid.

---

### Wave 2 — Near-term (90-180 days)

#### 2A. Hypertension Guideline

| Source | Full Citation | Key Supervision Rules |
|---|---|---|
| **2025 AHA/ACC Hypertension Guideline** | *Circulation*. 2025. DOI: 10.1161/CIR.0000000000001356 | BP thresholds for treatment initiation, first-line agent selection, combination therapy, special populations |

**Key rules derivable:**
- Treatment initiation: Stage 1 HTN (>=130/80) treatment is conditional on cardiovascular disease, CKD, diabetes, or predicted CV risk (not a flat universal trigger). Popper rules should check risk context, not just BP threshold alone.
- First-line agents: thiazide, CCB, ACEi, ARB — proposals for non-first-line agents trigger `REQUEST_MORE_INFO` (why not first-line?)
- Target BP validation: proposals should include BP context
- Special population checks: CKD with albuminuria → ACEi/ARB preferred; diabetes with albuminuria → ACEi/ARB preferred (the preference depends on kidney/albuminuria context, not simply "has diabetes"); elderly → adjusted targets
- Dual RAS blockade prohibition: ACEi + ARB combination → `ROUTE_TO_CLINICIAN` (or `HARD_STOP` per KDIGO/label alignment)

**Maturity/Priority:** HIGH. Hypertension affects the majority of cardiometabolic patients. Rules are relatively straightforward compared to HF.

#### 2B. Lipid/Cholesterol Guideline

| Source | Full Citation | Key Supervision Rules |
|---|---|---|
| **2026 ACC/AHA Dyslipidemia Guideline** | Blumenthal RS et al. *JACC*. 2026. DOI: 10.1016/j.jacc.2025.11.016 | LDL-C goal-based treatment, stepwise lipid-lowering pathway, statin intensity, nonstatin therapy sequencing |

**Key rules derivable:**
- Risk-stratified LDL-C goals: <55 (very high risk), <70 (high risk), <100 (borderline-intermediate)
- Statin intensity check: high-risk patients should be on high-intensity statin unless contraindicated
- Nonstatin sequencing: ezetimibe before PCSK9i/inclisiran; bempedoic acid for statin intolerance
- Statin + gemfibrozil interaction: `ROUTE_TO_CLINICIAN` (rhabdomyolysis risk)
- Monitoring: proposals for lipid therapy changes should include recent lipid panel context

**Maturity/Priority:** MEDIUM-HIGH. Rules are well-defined but lipid therapy is generally lower-acuity than HF or anticoagulation.

#### 2C. Diabetes Standards of Care

| Source | Full Citation | Key Supervision Rules |
|---|---|---|
| **ADA 2026 Standards of Care, Section 10** | *Diabetes Care*. 2026;49(Suppl 1):S216-S245 | Cardiovascular risk management in diabetes, SGLT2i/GLP-1 RA prioritization, BP and lipid targets |
| **ADA 2026, Section 9** | Pharmacologic approaches to glycemic treatment | Medication selection algorithms, insulin management |

**Key rules derivable:**
- SGLT2i/GLP-1 RA for established ASCVD or high CV risk in T2D: Class I equivalent
- BP target in diabetes: <130/80 (<120 systolic for high CV/kidney risk)
- LDL-C target in diabetes with ASCVD: <55 mg/dL (aligns with ACC/AHA 2026)
- Metformin + SGLT2i combination initiation: monitoring requirements
- Insulin management: proposals for insulin changes require glucose data context

**Maturity/Priority:** MEDIUM-HIGH. Heavy overlap with HF and CKD domains — rules can cross-reference rather than duplicate.

---

### Wave 3 — Mid-term (6-12 months)

#### 3A. CKD / Renal Safety

| Source | Full Citation | Key Supervision Rules |
|---|---|---|
| **KDIGO 2024 CKD Guideline** | *Kidney Int*. 2024. Available at kdigo.org | RASi continuation/adjustment, SGLT2i in CKD, potassium monitoring, eGFR-based dose adjustment, sick-day rules |

**Key rules derivable:**
- Continue RASi even when eGFR <30 (KDIGO Practice Point 3.6.7) — prevents inappropriate discontinuation
- SGLT2i initiation with eGFR >=20 (not >=25 as in some older guidelines)
- Initial eGFR dip after SGLT2i is expected — rule to prevent inappropriate SGLT2i discontinuation
- Potassium monitoring after RASi/MRA initiation: check within 2-4 weeks
- Dual RAS blockade prohibition (aligns with Layer 1 label safety)
- Finerenone: T2D + CKD + eGFR >25 + normal K+ + residual albuminuria on maximal RASi + SGLT2i
- SADMANS sick-day rules: flag acute illness context for temporary medication holds

**Maturity/Priority:** MEDIUM. CKD supervision is critical for patient safety but requires reliable eGFR and potassium data in the health state snapshot. Rules depend on data quality.

#### 3B. Atrial Fibrillation / Anticoagulation

| Source | Full Citation | Key Supervision Rules |
|---|---|---|
| **2023 ACC/AHA/ACCP/HRS AF Guideline** | Joglar JA et al. *Circulation*. 2024;149:e1-e156. DOI: 10.1161/CIR.0000000000001193 | Anticoagulation threshold, DOAC preference, bleeding risk assessment, AF + CAD management |

**Key rules derivable:**
- Anticoagulation threshold: annual stroke risk >=2% (not CHA2DS2-VASc score alone)
- DOAC preferred over warfarin (except mechanical valves, moderate-severe mitral stenosis)
- Aspirin NOT recommended as alternative to anticoagulation (Class III — harm)
- AF + CAD beyond 1 year post-revascularization: OAC monotherapy preferred over OAC + antiplatelet
- Bleeding risk scores: should not be used alone to withhold OAC
- Device-detected AF duration thresholds for anticoagulation consideration

**Maturity/Priority:** MEDIUM. Anticoagulation supervision is high-stakes but may not be in Deutsch's initial scope. Include in architecture now; activate when Deutsch supports AF domain.

**Dependency on clinician review:** Anticoagulation rules require hematologist or cardiologist with EP expertise to review. The 2023 guideline significantly changed thresholds from CHA2DS2-VASc-based to annual-risk-based.

---

### Wave 4 — Later (12+ months)

| Source | Domain | Notes |
|---|---|---|
| ACS/STEMI/NSTEMI guidelines | Acute coronary syndromes | Requires acute-care context not typically available in chronic disease supervision |
| Valvular heart disease guidelines | Valve management | Specialized; likely requires modality data (echo findings) |
| Pulmonary hypertension guidelines | PH management | Specialized domain with unique medication classes |
| Peripheral artery disease guidelines | PAD management | Extends beyond core cardiometabolic scope |

---

## Cross-Guideline Dependencies

Several clinical scenarios require rules that reference multiple guidelines simultaneously:

| Scenario | Guidelines Involved | Resolution |
|---|---|---|
| HF patient with CKD starting SGLT2i | 2022 HF + KDIGO 2024 + DailyMed label | Use most conservative eGFR threshold from all sources; both guidelines agree on eGFR >=20 |
| Diabetic patient with HTN and CKD on ACEi | ADA 2026 + 2025 HTN + KDIGO 2024 | All agree ACEi is preferred; KDIGO provides renal monitoring requirements |
| HF patient needing statin after ACS | 2022 HF + 2026 Dyslipidemia + ACS guideline | Statin choice/intensity follows dyslipidemia guideline; HF context affects drug interaction checks |
| AF patient with diabetes on SGLT2i | 2023 AF + ADA 2026 | SGLT2i does not interact with DOACs; anticoagulation rules are independent |

These cross-guideline scenarios should be modeled as rules that reference multiple provenance entries. See `05-rule-provenance-and-evidence-model.md`.

---

## What Popper Does NOT Do with These Guidelines

1. **Popper does not recommend therapy.** It checks whether AI-proposed therapy is consistent with guideline-derived rules.
2. **Popper does not interpret guidelines dynamically.** Rules are pre-derived from guidelines by clinicians and encoded deterministically.
3. **Popper does not replace clinical judgment.** When a rule fires `ROUTE_TO_CLINICIAN`, the clinician decides. The clinician may override the rule with documented rationale.
4. **Popper does not track guideline updates automatically.** Guideline version changes trigger a manual clinical governance review (see `09-clinical-governance-review-workflow.md`).
