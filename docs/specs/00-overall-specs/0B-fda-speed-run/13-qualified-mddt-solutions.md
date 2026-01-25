# FDA-Qualified MDDT Solutions for ADVOCATE

> **Document Version:** 1.2.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2), Hermes Protocol
> **Purpose:** Catalog existing FDA-qualified MDDTs and identify integration opportunities
> **Canonical Source:** This document is the **single source of truth** for MDDT facts (dates, categories, SEBQ links). Other specs should reference this doc rather than duplicating data.

---

## 1. Overview

This document catalogs all FDA-qualified Medical Device Development Tools (MDDTs) and analyzes their relevance to the ADVOCATE clinical agent system. As of late 2024, approximately 18 tools have received MDDT qualification since the program began in 2017.

### Why This Matters for ADVOCATE

1. **Efficiency**: Qualified MDDTs can be used without re-validating their suitability
2. **Precedent**: Existing qualifications inform Popper's MDDT pathway
3. **Integration**: Several tools directly support Deutsch and Hermes functions
4. **Strategy**: Understanding the landscape guides future qualification proposals

### Document Organization

| Section | Content |
|---------|---------|
| §2 | MDDT Program Background |
| §3 | Complete MDDT Catalog (11 Relevant MDDTs) |
| §4 | Cardiovascular/Heart Failure PRO MDDTs (KCCQ, MLHFQ) |
| §5 | Digital Health MDDTs (Apple Watch AFib) |
| §6 | Comorbidity PRO MDDTs (INSPIRE, WOUND-Q) |
| §7 | Cybersecurity MDDTs (MITRE CVSS Rubric) |
| §8 | Non-Clinical Assessment Models (MRI Safety, Computational NAMs) |
| §9 | Biomarker Tests (OsiriX CDE, UCSF LAD) |
| §10 | Other PRO Instruments |
| §11 | ADVOCATE MDDT Strategy |
| §12 | Implementation Checklist |
| §13 | References |

---

## 2. MDDT Program Background

### 2.1 Program Purpose

The FDA's Medical Device Development Tools (MDDT) program facilitates device development by qualifying tools that sponsors can rely on without re-establishing their validity within the same context of use.

**Key Benefits:**
- Predictability in regulatory review
- Reduced redundant validation studies
- Standardized evaluation approaches
- Accelerated device development timelines

### 2.2 Three MDDT Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **COA** (Clinical Outcome Assessment) | Measures how patients feel or function | PRO questionnaires, clinician-reported scales |
| **BT** (Biomarker Test) | Detects/measures biological indicators | Imaging software, lab tests |
| **NAM** (Non-Clinical Assessment Model) | Non-clinical test models/methods | Computational models, in-vitro models, animal models |

### 2.3 Qualification Process

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MDDT Qualification Process                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │  Proposal   │   │   Review    │   │   Full      │               │
│  │  Submission │──►│   Phase     │──►│Qualification│               │
│  └─────────────┘   └─────────────┘   └──────┬──────┘               │
│         │                                    │                       │
│         ▼                                    ▼                       │
│  • Context of Use (COU)              • Evidence package              │
│  • Tool description                  • Performance data              │
│  • Preliminary evidence              • SEBQ document                 │
│  • Qualification plan                • FDA decision letter           │
│                                                                      │
│  Timeline: 6-18 months typically                                    │
│  Fee: None (voluntary program)                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 Context of Use (COU) Compliance

**Critical:** Qualified MDDTs may only be used within their specified Context of Use. Using an MDDT outside its COU voids the qualification benefit and requires independent validation.

| COU Element | What It Specifies | Consequence of Violation |
|-------------|------------------|-------------------------|
| **Population** | Patient demographics, conditions | Results not generalizable |
| **Setting** | Clinical trial, routine care | Regulatory review required |
| **Endpoint Role** | Primary vs secondary | Cannot upgrade without re-qualification |
| **Device Type** | What devices can rely on tool | Different devices need own evidence |

**ADVOCATE implication:** When integrating any MDDT, verify the specific COU and document compliance in clinical trial protocols.

### 2.5 PRO Instrument Licensing & Governance

PRO instruments (KCCQ, MLHFQ, INSPIRE, WOUND-Q) typically require licensing:

| Aspect | Consideration |
|--------|---------------|
| **License Required** | Most PROs require permission for use |
| **Fee Structure** | Research often free; commercial may require fees |
| **Translation Rights** | Validated translations may have separate licensing |
| **ePRO Validation** | Electronic administration may need equivalence validation |
| **Audit Trail** | HIPAA/GCP require documented consent and administration |

**For ADVOCATE:**
- Obtain instrument licenses before integration
- Document licensing terms in governance framework
- Ensure ePRO equivalence is established for digital administration

### 2.6 SEBQ Document Structure

The Summary of Evidence and Basis of Qualification (SEBQ) is the FDA's public record of qualification:

| Section | Content |
|---------|---------|
| **Background** | Tool purpose and development history |
| **Context of Use** | Specific use cases, populations, settings |
| **Tool Description** | Technical specifications, methodology |
| **Evidence Summary** | Validation studies, performance data |
| **Basis of Qualification** | FDA's reasoning for qualification |
| **Limitations** | Boundaries of qualified use |

---

## 3. Complete MDDT Catalog

### 3.1 All Qualified MDDTs (as of November 2024)

| # | Tool Name | Category | Year | Focus Area | SEBQ Link |
|---|-----------|----------|------|------------|-----------|
| 1 | Kansas City Cardiomyopathy Questionnaire (KCCQ) | COA/PRO | 2016 | Heart failure | [SEBQ](https://www.fda.gov/media/108301/download) |
| 2 | Minnesota Living with Heart Failure Questionnaire (MLHFQ) | COA/PRO | 2018 | Heart failure | [SEBQ](https://djhurij4nde4r.cloudfront.net/attachments/files/000/000/483/original/MLHFQ_FDA_Medical_Device_Development_Tool_(MDDT)_Qualification_Package.pdf) |
| 3 | OsiriX CDE Software Module | BT | 2019 | TBI imaging | [SEBQ](https://www.fda.gov/media/112157/download) |
| 4 | Tissue Mimicking Material (TMM) | NAM | 2019 | Ultrasound testing | [SEBQ](https://www.fda.gov/media/129898/download) |
| 5 | MITRE CVSS Rubric for Medical Devices | NAM | 2020 | Cybersecurity | [SEBQ](https://www.fda.gov/media/143131/download) |
| 6 | BREAST-Q Reconstruction Module | COA/PRO | 2020 | Breast reconstruction | [SEBQ](https://www.fda.gov/media/141349/download) |
| 7 | INSPIRE Questionnaires | COA/PRO | 2020 | Automated insulin dosing | [SEBQ](https://www.fda.gov/media/139432/download) |
| 8 | PROWL-SS | COA/PRO | 2020 | LASIK outcomes | [SEBQ](https://www.fda.gov/media/136862/download) |
| 9 | FACE-Q Aesthetics | COA/PRO | 2021 | Facial aesthetics | [SEBQ](https://www.fda.gov/media/149521/download) |
| 10 | NEI-VFQ-25 Supplement | COA/PRO | 2021 | Neuro-ophthalmology | [SEBQ](https://www.fda.gov/media/151431/download) |
| 11 | Glasgow Outcome Scale-Extended (GOSE) | COA/ClinRO | 2022 | TBI outcomes | [SEBQ](https://www.fda.gov/media/157956/download) |
| 12 | MRI Temperature Rise Prediction Tool | NAM | 2023 | Orthopedic implant safety | [SEBQ](https://www.fda.gov/media/166724/download) |
| 13 | AIOLIS | COA/PRO | 2024 | Premium IOL outcomes | [SEBQ](https://www.fda.gov/media/178114/download) |
| 14 | Apple Watch AFib History Feature | BT | 2024 | Atrial fibrillation (first digital health MDDT) | [SEBQ](https://www.fda.gov/media/178230/download) |
| 15 | WOUND-Q | COA/PRO | 2024 | Chronic wound healing | [SEBQ](https://www.fda.gov/media/183648/download) |
| 16 | IMAnalytics with MRIxViP | NAM | 2021 | MRI implant safety | [SEBQ](https://www.fda.gov/media/148922/download) |
| 17 | Virtual MRI Safety Evaluations | NAM | 2021 | MRI device testing | [SEBQ](https://www.fda.gov/media/154181/download) |
| 18 | UCSF Lethal Arrhythmia Database (LAD) | BT | 2024 | Arrhythmia ground truth | [SEBQ](https://www.fda.gov/media/177482/download) |
| 19 | ENDPOINT numaScrew | NAM | 2025 | Orthopedic screw simulation | [SEBQ](https://www.fda.gov/media/188766/download) |

*Notes:*
- *Additional qualified tools may exist. Refer to [FDA MDDT main page](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt) for the most current list.*
- *⚠️ SEBQ links should be verified against FDA's current database before external publication—FDA media IDs may change.*

### 3.2 MDDT Distribution by Category

| Category | Count | Percentage |
|----------|-------|------------|
| COA (Clinical Outcome Assessments) | 11 | 58% |
| NAM (Non-Clinical Assessment Models) | 5 | 26% |
| BT (Biomarker Tests) | 3 | 16% |

*Note: Apple Watch AFib is categorized as BT (Biomarker Test) per FDA qualification; "Digital Health" is a descriptor, not an MDDT category.*

### 3.3 Relevance to ADVOCATE (11 Relevant MDDTs)

| # | MDDT | Category | Target | Application |
|---|------|----------|--------|-------------|
| 1 | **KCCQ** | COA | Deutsch | HF patient outcome measurement (primary/secondary endpoint) |
| 2 | **MLHFQ** | COA | Deutsch | HF quality of life assessment (secondary endpoint) |
| 3 | **Apple Watch AFib History** | BT | Deutsch | Wearable AFib burden monitoring |
| 4 | **INSPIRE** | COA | Deutsch | Diabetic HF patients with automated insulin dosing |
| 5 | **WOUND-Q** | COA | Deutsch | Chronic wound tracking (venous ulcers, pressure injuries) |
| 6 | **IMAnalytics/MRIxViP** | NAM | Deutsch | Cardiac implant MRI safety (pacemaker/ICD clearance) |
| 7 | **Virtual MRI Safety** | NAM | Deutsch/Popper | Additional implant safety validation |
| 8 | **UCSF LAD** | BT | Popper | Arrhythmia ground truth for IV&V validation |
| 9 | **MITRE CVSS Rubric** | NAM | Hermes | Vulnerability scoring methodology |
| 10 | **MRI Temperature Rise** | NAM | Popper | NAM pathway precedent for computational tools |
| 11 | **ENDPOINT numaScrew** | NAM | Popper | Latest computational NAM precedent (May 2025) |

---

## 4. Cardiovascular/Heart Failure MDDTs

### 4.1 Kansas City Cardiomyopathy Questionnaire (KCCQ)

**The first FDA-qualified MDDT (2016)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | John Spertus, MD, MPH (University of Missouri-Kansas City) |
| **Category** | COA / Patient-Reported Outcome (PRO) |
| **Qualification Date** | October 2016 |
| **Items** | 23 questions |
| **Scoring** | 0-100 (higher = better status) |

#### Context of Use

The KCCQ is qualified as a **primary or secondary endpoint** in feasibility or pivotal clinical trials for:
- Patients with congestive heart failure
- Measuring health status including symptoms (frequency and burden), physical limitations, social limitations, and quality of life

#### Domains Measured

| Domain | Questions | Description |
|--------|-----------|-------------|
| Physical Limitation | 6 | Activities limited by HF |
| Symptom Stability | 1 | Change over 2 weeks |
| Symptom Frequency | 4 | How often symptoms occur |
| Symptom Burden | 3 | Bother from symptoms |
| Self-Efficacy | 2 | Understanding of condition |
| Quality of Life | 3 | Enjoyment of life |
| Social Limitation | 4 | Impact on relationships |

#### Summary Scores

| Score | Components | MCID |
|-------|------------|------|
| **Clinical Summary Score (CSS)** | Physical Limitation + Symptom Frequency + Burden | 5 points |
| **Overall Summary Score (OSS)** | CSS + Quality of Life + Social Limitation | 5 points |

#### ADVOCATE Integration

**Application for Deutsch:**
- Patient outcome measurement in CVD clinical trials
- Baseline and follow-up assessment via multimodal intake
- Integration with `UIInstruction` form rendering

**Implementation:**
```typescript
// Example KCCQ integration in Deutsch ProposedIntervention
interface KCCQAssessment {
  instrument_id: 'KCCQ-23' | 'KCCQ-12';
  score_type: 'CSS' | 'OSS' | 'domain';
  score_value: number; // 0-100
  measurement_date: ISO8601;
  change_from_baseline?: number;
  mcid_achieved?: boolean;
}
```

**Key Evidence:**
- Validated in >30,000 patients across multiple studies
- Responsive to clinical changes
- Predictive of hospitalization and mortality
- Translations available in 80+ languages

#### References

- [KCCQ SEBQ Document](https://www.fda.gov/media/108301/download)
- [JACC State-of-the-Art Review: Interpreting the KCCQ](https://www.jacc.org/doi/abs/10.1016/j.jacc.2020.09.542)

---

### 4.2 Minnesota Living with Heart Failure Questionnaire (MLHFQ)

**Second FDA-qualified MDDT (2018)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developers** | Thomas Rector, PhD & Jay Cohn, MD (University of Minnesota) |
| **Category** | COA / Patient-Reported Outcome (PRO) |
| **Qualification Date** | May 2018 |
| **Items** | 21 questions |
| **Scoring** | 0-105 (lower = better quality of life) |
| **Development** | 1984 (35+ years of use) |

#### Context of Use

The MLHFQ is qualified as a **secondary endpoint** in feasibility and pivotal studies of:
- Outpatients with symptomatic heart failure (NYHA Class II-III)
- Measuring quality of life impact of HF treatment

#### Domains Measured

| Domain | Questions | Score Range |
|--------|-----------|-------------|
| **Physical** | 8 items | 0-40 |
| **Emotional** | 5 items | 0-25 |
| **Total** | 21 items | 0-105 |

#### MLHFQ vs KCCQ

| Aspect | MLHFQ | KCCQ |
|--------|-------|------|
| Endpoint Role | Secondary only | Primary or secondary |
| Population | NYHA II-III | All HF |
| Length | 21 items | 23 items |
| Recall Period | 4 weeks | 2 weeks |
| Scoring Direction | Lower = better | Higher = better |
| MCID | 5 points | 5 points |

#### ADVOCATE Integration

**Application for Deutsch:**
- Quality of life assessment complementing KCCQ
- Longer recall period (4 weeks) for less frequent assessments
- Licensed by 2,000+ organizations worldwide

**Complementary Use:**
- Use KCCQ for primary endpoints (shorter recall, health status focus)
- Use MLHFQ for secondary QoL endpoints (longer recall, emotional domain)

#### References

- [MLHFQ SEBQ Document](https://djhurij4nde4r.cloudfront.net/attachments/files/000/000/483/original/MLHFQ_FDA_Medical_Device_Development_Tool_(MDDT)_Qualification_Package.pdf)
- [FDA Qualification Announcement](https://research.umn.edu/news/fda-names-u-heart-patient-survey-go-device-makers)

---

## 5. Digital Health MDDTs

### 5.1 Apple Watch AFib History Feature

**First digital health technology MDDT (May 2024)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | Apple Inc. |
| **Category** | Digital Health Technology |
| **Qualification Date** | May 1, 2024 |
| **Platform** | Apple Watch Series 4+, SE, Ultra (watchOS 9+) |
| **Measurement** | Weekly AFib burden estimate |

#### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                Apple Watch AFib History Feature                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │ Photopleth- │   │  Interval   │   │   Weekly    │               │
│  │  ysmography │──►│  Analysis   │──►│AFib Burden  │               │
│  │  (PPG)      │   │             │   │  Estimate   │               │
│  └─────────────┘   └─────────────┘   └─────────────┘               │
│         │                                    │                       │
│         ▼                                    ▼                       │
│  Blood flow changes             % time in AFib over                 │
│  at wrist → heartbeat           past 7 days                         │
│  interval detection                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Context of Use

Qualified as a **secondary endpoint** in clinical trials for:
- Cardiac ablation devices
- Assessment of AFib burden estimates

**Important Limitation:** Not qualified as a primary endpoint. FDA noted that AFib burden as primary endpoint is "problematic" due to non-therapy-related factors affecting results.

#### Validation Study Results

| Metric | Value |
|--------|-------|
| Study Size | 280 participants with AFib history |
| Reference Device | Cardea SOLO Wireless ECG Patch |
| Average Difference | 0.67% from reference |
| Accuracy | 92.9% within ±5% of reference |

#### ADVOCATE Integration

**Application for Deutsch:**
- Multimodal wearable data integration
- AFib monitoring for CVD patients
- Secondary endpoint for rhythm control assessment

**Technical Integration:**
```typescript
// Example Apple Watch AFib data in Deutsch intake
interface WearableAFibData {
  source: 'apple_watch_afib_history';
  weekly_burden_pct: number; // 0-100
  measurement_window: {
    start: ISO8601;
    end: ISO8601;
  };
  data_quality: 'sufficient' | 'insufficient';
  device_model: string;
  watch_os_version: string;
}
```

**Considerations:**
- Requires user opt-in and Apple Health authorization
- Data must be validated against device compatibility
- May not be available for all patient populations

#### Significance for ADVOCATE

1. **First Digital Health MDDT** - Establishes precedent for wearable data in clinical trials
2. **Consumer Device** - Shows pathway for non-medical-grade device qualification
3. **Secondary Endpoint** - Demonstrates realistic scope for digital health tools
4. **Integration Model** - Provides template for Deutsch wearable data handling

#### References

- [Apple AFib History SEBQ](https://www.fda.gov/media/178230/download)
- [FDA Qualification Announcement](https://www.fda.gov/news-events/press-announcements/fda-qualifies-first-medical-device-development-tool-assessing-atrial-fibrillation-burden)
- [MedTech Dive Coverage](https://www.medtechdive.com/news/fda-apple-watch-atrial-fibrillation-medical-device-development-tool/715210/)

---

## 6. Comorbidity PRO MDDTs for Heart Failure Patients

### 6.1 INSPIRE Questionnaires

**Qualified for Automated Insulin Dosing (June 2020)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | INSPIRE Study Team |
| **Category** | COA / Patient-Reported Outcome (PRO) |
| **Qualification Date** | June 2020 |
| **Application** | Automated insulin dosing (AID) systems |
| **Target Population** | Type 1 diabetes patients using AID |

#### Context of Use

Qualified as a **secondary endpoint** in pivotal clinical trials for automated insulin dosing systems, measuring:
- Psychosocial impact of AID systems
- Diabetes-specific quality of life
- Fear of hypoglycemia
- Sleep quality with AID

#### ADVOCATE Integration

**Application for Deutsch (Comorbid HF + T1D patients):**
- Heart failure patients with comorbid Type 1 diabetes using AID systems
- Measure psychosocial impact of technology-assisted care
- Assess quality of life in complex multi-morbidity scenarios

**Guardrail Application:**
```markdown
SOFT guardrail: INSPIRE psychosocial decline
- Condition: INSPIRE psychosocial score drops >10 points
- Action: Flag for diabetes educator review + AID system check
```

#### References

- [INSPIRE SEBQ](https://www.fda.gov/media/139432/download)

---

### 6.2 WOUND-Q

**Most Recent MDDT Qualification (November 2024)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | McMaster University / Brigham and Women's Hospital |
| **Category** | COA / Patient-Reported Outcome (PRO) |
| **Qualification Date** | November 2024 |
| **Scales** | 7 independent scales |
| **Items** | 117 items total |

#### Context of Use

Qualified as a **secondary endpoint** in pivotal clinical trials for chronic wound treatment devices, measuring:
- Wound symptoms (bother, pain, odor)
- Healing progress perception
- Psychological wellbeing
- Social function
- Physical function
- Appearance satisfaction
- Treatment satisfaction

#### ADVOCATE Integration

**Application for Deutsch (HF patients with chronic wounds):**
- Heart failure patients commonly develop chronic wounds (venous ulcers, pressure injuries)
- Poor circulation and edema contribute to wound complications
- WOUND-Q enables tracking wound-related QoL in HF population

**Comorbidity Rationale:**
| HF Complication | Wound Type | WOUND-Q Application |
|-----------------|------------|---------------------|
| Venous insufficiency | Venous leg ulcers | Symptom tracking |
| Immobility | Pressure injuries | Healing assessment |
| Edema | Skin breakdown | QoL measurement |

**Guardrail Application:**
```markdown
SOFT guardrail: WOUND-Q wound deterioration
- Condition: wound_bother increases OR healing_progress decreases
- Action: Route to wound care specialist + vascular assessment
```

#### References

- [WOUND-Q SEBQ](https://www.fda.gov/media/183648/download)

---

## 7. Cybersecurity MDDTs

### 7.1 MITRE Rubric for Applying CVSS to Medical Devices

**Qualified October 2020**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | MITRE Corporation (FDA contract) |
| **Category** | NAM (Non-Clinical Assessment Model) |
| **Qualification Date** | October 20, 2020 |
| **Version Qualified** | 0.12.04 |
| **Base Standard** | CVSS v3.0 |

**Note on CVSS Version:** The MITRE rubric was developed against CVSS v3.0 (published June 2015) and qualified in October 2020. While CVSS v3.1 was released in June 2019, the FDA-qualified rubric remains based on v3.0. The differences between v3.0 and v3.1 are minor (primarily clarifications to scoring guidance, not formula changes), and the qualified rubric's medical device adaptations apply equally to both versions. Organizations may use v3.1 vector strings with the MITRE rubric guidance; document any v3.1-specific considerations in security assessments.

#### Purpose

The standard Common Vulnerability Scoring System (CVSS) does not adequately reflect:
- Clinical environment context
- Patient safety impacts
- Medical device-specific attack vectors

The MITRE rubric adapts CVSS scoring for medical devices by providing:
- Structured guidance for consistent, defensible scoring
- Patient-centric interpretations of impact
- Medical device-specific decision trees

#### CVSS Base Metrics Adapted

| Metric | Standard CVSS | MITRE Medical Device Adaptation |
|--------|---------------|--------------------------------|
| Attack Vector | Network/Adjacent/Local/Physical | Includes clinical setting context |
| Attack Complexity | Low/High | Medical workflow considerations |
| Privileges Required | None/Low/High | Clinical role-based access |
| User Interaction | None/Required | Clinical user scenarios |
| Scope | Unchanged/Changed | Patient safety boundary |
| Confidentiality | None/Low/High | PHI impact |
| Integrity | None/Low/High | Clinical data integrity |
| Availability | None/Low/High | Patient care continuity |

#### Context of Use

Qualified for:
- Evaluation and justification of patient-centric, situational impact
- Time-sensitive postmarket vulnerability assessments
- Premarket cybersecurity documentation

#### ADVOCATE Integration

**Application for Hermes:**
- Vulnerability scoring for Hermes communication protocol
- Security risk assessment documentation
- Premarket cybersecurity submission support

**Implementation:**
```typescript
// Example CVSS scoring for Hermes vulnerability
interface HermesCVSSScore {
  vulnerability_id: string;
  cvss_base_score: number; // 0.0-10.0
  cvss_vector_string: string;
  mitre_rubric_version: '0.12.04';

  // Patient-centric adjustments
  patient_safety_impact: 'none' | 'low' | 'high' | 'critical';
  clinical_context: string;

  // Hermes-specific
  affected_component: 'transport' | 'signature' | 'audit' | 'replay_protection';
  mitigation_status: 'open' | 'mitigated' | 'accepted';
}
```

**Use Cases:**
1. Assessing JWS signature implementation vulnerabilities
2. Evaluating replay protection weaknesses
3. Scoring multi-tenant isolation bypass risks
4. Documenting clock skew exploitation risks

#### Tools Available

| Tool | Purpose | Link |
|------|---------|------|
| Online Calculator | Interactive CVSS scoring | [cvss-rubric.deeparmor.com](https://cvss-rubric.deeparmor.com/) |
| GitHub Tools | Command-line calculators | [mitre.github.io/md-cvss-rubric-tools](https://mitre.github.io/md-cvss-rubric-tools/) |
| Rubric Document | Full methodology | [MITRE Publication](https://www.mitre.org/sites/default/files/2021-11/pr-18-2208-rubric-for-applying-cvss-to-medical-devices.pdf) |

#### References

- [MITRE CVSS Rubric SEBQ](https://www.fda.gov/media/143131/download)
- [FDA Qualification Announcement](https://content.govdelivery.com/accounts/USFDA/bulletins/2a6cf79)
- [MITRE Publication](https://www.mitre.org/news-insights/publication/rubric-applying-cvss-medical-devices)

---

## 8. Non-Clinical Assessment Model MDDTs

### 8.1 MRI Temperature Rise Prediction Tool

**First computational modeling MDDT (2023)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | FDA (CDRH) |
| **Category** | NAM (Computational Model) |
| **Qualification Date** | 2023 |
| **Application** | Orthopedic implant MRI safety |

#### Purpose

Predicts temperature rise in tissue around certain metallic orthopedic implants during MRI scans using computational modeling and simulation.

#### Significance for ADVOCATE

This MDDT establishes **critical precedent for Popper's MDDT qualification**:

| Precedent Aspect | MRI Tool | Popper Application |
|------------------|----------|-------------------|
| **Category** | NAM | NAM |
| **Method** | Computational model | Policy engine + quality signals |
| **Purpose** | Predict safety outcomes | Assess AI safety |
| **Validation** | In silico testing | Policy validation testing |

#### Context of Use Pattern

The MRI tool's COU provides a template for Popper:

```
MRI Tool COU:
"Predict temperature rise [safety metric] in tissue
around certain metallic orthopedic implants [device type]
during MRI scans [use context]"

Popper COU (analogous):
"Assess accuracy, safety, and uncertainty [safety metrics]
of AI clinical recommendations [device type]
during patient-facing interactions [use context]"
```

#### References

- [MRI Temperature Rise SEBQ](https://www.fda.gov/media/166724/download)
- [FDA Announcement](https://content.govdelivery.com/accounts/USFDA/bulletins/351ef58)

---

### 8.2 Tissue Mimicking Material (TMM)

**First FDA-developed MDDT (2019)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | FDA (CDRH/OSEL) |
| **Category** | NAM |
| **Qualification Date** | 2019 |
| **Application** | Ultrasound device testing |

#### Purpose

Physical material that mimics human tissue properties for non-clinical testing of ultrasound medical devices.

#### Significance

- Demonstrates FDA's commitment to the MDDT program
- Shows NAM can include physical materials, not just software
- Establishes precedent for non-clinical testing tools

---

### 8.3 IMAnalytics with MRIxViP

**First Computational MDDT (May 2021)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | Zurich Med Tech AG |
| **Category** | NAM (Computational Model) |
| **Qualification Date** | May 2021 |
| **Application** | MRI safety for active implants |

#### Purpose

Computational simulation platform for evaluating MRI-related heating of active implantable medical devices (AIMDs) such as:
- Pacemakers
- Implantable cardioverter-defibrillators (ICDs)
- Cardiac resynchronization therapy (CRT) devices
- Neurostimulators

#### Context of Use

Qualified for non-clinical MRI safety assessment:
- Predict RF-induced heating at implant leads
- Evaluate MRI conditional labeling claims
- Reduce animal testing requirements
- Supplement physical testing

#### ADVOCATE Integration

**Application for Deutsch (Cardiac Implant Patients):**

| Use Case | Application |
|----------|-------------|
| **Patient intake** | Identify patients with cardiac implants |
| **MRI ordering** | Flag when imaging includes MRI for implant patients |
| **Safety verification** | Verify MRI conditional status using qualified methodology |

**Guardrail Application:**
```markdown
HARD guardrail: Cardiac implant + MRI imaging order
- Condition: Patient has cardiac implant AND imaging order includes MRI
- Action: ROUTE_TO_CLINICIAN - verify MRI conditional status
- Methodology: Use FDA-qualified IMAnalytics methodology for safety determination
```

#### References

- [IMAnalytics SEBQ](https://www.fda.gov/media/148922/download)

---

### 8.4 Virtual MRI Safety Evaluations

**Second MRI Safety NAM (November 2021)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | MED Institute, Inc. with FDA (CDRH/OSEL) collaboration |
| **Category** | NAM (Computational Model) |
| **Qualification Date** | November 2021 |
| **Application** | MRI safety simulation |

#### Purpose

Extends MRI safety computational modeling capabilities:
- Validate in silico predictions against physical testing
- Enable efficient safety evaluation across MRI configurations
- Support MRI conditional labeling for implants

#### Significance for Popper

Demonstrates FDA acceptance of computational simulation for safety assessment:

| Aspect | Virtual MRI Safety | Popper Analogy |
|--------|-------------------|----------------|
| **Domain** | MRI safety | AI clinical safety |
| **Method** | Computational simulation | Policy engine simulation |
| **Output** | Safety predictions | Safety classifications |
| **Validation** | Physical testing correlation | Human clinician correlation |

#### References

- [Virtual MRI Safety SEBQ](https://www.fda.gov/media/154181/download)

---

### 8.5 ENDPOINT numaScrew

**Latest Computational NAM (May 2025)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | ENDPOINT |
| **Category** | NAM (Computational Model) |
| **Qualification Date** | May 2025 |
| **Application** | Orthopedic screw performance simulation |

#### Purpose

Computational simulation tool for predicting orthopedic bone screw performance:
- Pullout strength prediction
- Bone-implant interface modeling
- Reduces cadaveric testing requirements

#### Significance for ADVOCATE

**Most recent computational NAM qualification demonstrates:**
1. **Continued FDA support** for computational modeling MDDTs
2. **Pathway viability** for Popper as computational safety tool
3. **Evidence standards** for simulation-based qualification

#### Popper NAM Pathway Precedent

| ENDPOINT numaScrew | Popper (Proposed) |
|--------------------|-------------------|
| Predicts screw pullout | Predicts AI safety |
| Validated vs physical tests | Validated vs clinician review |
| Reduces animal testing | Reduces manual AI review |
| Orthopedic domain | Clinical AI domain |

#### References

- [ENDPOINT numaScrew SEBQ](https://www.fda.gov/media/188766/download)

---

## 9. Biomarker Test MDDTs

### 9.1 OsiriX CDE Software Module

**First Biomarker Test MDDT (March 2019)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | TBI Endpoints Development (TED) Initiative |
| **Category** | BT (Biomarker Test) |
| **Qualification Date** | March 2019 |
| **Application** | TBI imaging standardization |

#### Purpose

Software module for OsiriX that:
- Provides standardized marking of brain contusions
- Uses common criteria for classification
- Labels MRI abnormalities consistently
- Enriches enrollment in TBI clinical trials

#### Significance for ADVOCATE

| Aspect | OsiriX CDE | Potential ADVOCATE Tool |
|--------|------------|------------------------|
| **Category** | BT | BT or NAM |
| **Function** | Standardize image assessment | Standardize AI output assessment |
| **Benefit** | Consistent trial enrollment | Consistent AI quality evaluation |

---

### 9.2 UCSF Lethal Arrhythmia Database (LAD)

**Ground Truth Dataset for Arrhythmia Detection (March 2024)**

#### Overview

| Attribute | Value |
|-----------|-------|
| **Developer** | University of California, San Francisco |
| **Category** | BT (Biomarker Test) / Ground Truth Dataset |
| **Qualification Date** | March 2024 |
| **Application** | Arrhythmia detection algorithm validation |
| **Contents** | ECG recordings with expert annotations |

#### Context of Use

Qualified as a **reference standard** for:
- Validating arrhythmia detection algorithms
- Benchmarking cardiac rhythm classification AI
- Providing ground truth for algorithm development
- Supporting premarket submissions for arrhythmia detection devices

#### Dataset Characteristics

| Characteristic | Details |
|----------------|---------|
| **Arrhythmias covered** | Ventricular fibrillation, ventricular tachycardia, asystole, lethal arrhythmias |
| **Annotation quality** | Expert cardiologist review |
| **Clinical validity** | Correlated with clinical outcomes |
| **Representativeness** | Diverse patient demographics |

#### ADVOCATE Integration

**Critical Application for Popper IV&V:**

The UCSF LAD provides FDA-qualified ground truth for validating Popper's monitoring of Deutsch cardiac rhythm analysis:

| Validation Use | Description |
|----------------|-------------|
| **Accuracy benchmark** | Validate Popper's assessment of Deutsch arrhythmia detection |
| **Hallucination detection** | Test Popper's ability to detect false arrhythmia claims |
| **Uncertainty calibration** | Verify Popper's confidence estimates for rhythm analysis |
| **Drift monitoring** | Establish baseline for performance monitoring |

**IV&V Study Application:**
```markdown
Popper Validation Protocol (using UCSF LAD):

1. Present Deutsch with LAD ECG recordings
2. Deutsch produces arrhythmia classifications
3. Popper evaluates Deutsch outputs
4. Compare Popper assessments against LAD ground truth
5. Calculate:
   - Popper accuracy in detecting Deutsch errors (target: >95%)
   - Popper accuracy in validating correct Deutsch outputs (target: >95%)
   - Popper uncertainty calibration quality
```

**⚠️ Important Access Constraint:**
UCSF LAD uses a "submit executable; users blind to dataset" access model:
- Algorithm developers **do not** receive direct access to raw ECG data
- Validation requires submitting executable code to UCSF
- UCSF runs the algorithm and returns performance metrics
- This prevents overfitting to the validation dataset

Plan validation studies with this access model in mind—cannot use LAD for iterative development.

#### Why This Matters

| Without UCSF LAD | With UCSF LAD |
|------------------|---------------|
| Create own ground truth dataset | Use FDA-qualified dataset |
| Validate dataset before use | Pre-validated by FDA |
| Defend methodology in submission | Reference qualified MDDT |
| Risk of dataset bias challenges | Established representativeness |

#### References

- [UCSF LAD SEBQ](https://www.fda.gov/media/177482/download)

---

## 10. Other Qualified PRO Instruments

### 10.1 Summary Table

| Tool | Year | Focus Area | Items | Use |
|------|------|------------|-------|-----|
| **BREAST-Q Reconstruction** | 2020 | Breast reconstruction | Multiple scales | Primary/secondary endpoint |
| **FACE-Q Aesthetics** | 2021 | Facial aesthetics | Multiple scales | Primary/secondary endpoint |
| **INSPIRE** | 2020 | Automated insulin dosing | Multiple questionnaires | Secondary endpoint |
| **PROWL-SS** | 2020 | LASIK outcomes | Symptoms & satisfaction | Secondary endpoint |
| **AIOLIS** | 2024 | Premium IOL | Visual function | Secondary endpoint |
| **WOUND-Q** | 2024 | Chronic wounds | 7 scales | Secondary endpoint |
| **NEI-VFQ-25 Supplement** | 2021 | Neuro-ophthalmology | 10 items | Secondary endpoint |
| **GOSE** | 2022 | TBI outcomes | Clinician-reported | Outcome measure |

### 10.2 PRO Development Insights

These tools share common characteristics relevant to ADVOCATE:

| Characteristic | Implementation |
|----------------|----------------|
| Multi-domain measurement | Physical + emotional + functional |
| Validated translations | 20+ languages typical |
| MCID established | Minimal clinically important difference |
| Recall period defined | 1-4 weeks typical |
| Electronic administration | ePRO versions available |

---

## 11. ADVOCATE MDDT Strategy

### 11.1 Immediate Integration Opportunities

#### Use Existing Qualified MDDTs

| MDDT | ADVOCATE Application | Priority |
|------|---------------------|----------|
| **KCCQ** | Primary/secondary endpoint in Deutsch CVD trials | High |
| **MLHFQ** | Secondary QoL endpoint | Medium |
| **Apple Watch AFib** | Wearable data integration for AFib patients | Medium |
| **MITRE CVSS** | Hermes vulnerability assessment | High |

#### Implementation Steps

**For KCCQ/MLHFQ:**
1. License instruments (KCCQ: free for research; MLHFQ: fee-based)
2. Integrate into Deutsch `UIInstruction` form system
3. Store scores in HealthStateSnapshot with instrument identifier
4. Report as endpoint in clinical trial protocols

**For MITRE CVSS:**
1. Adopt rubric for Hermes security assessments
2. Document all vulnerabilities using qualified methodology
3. Include in premarket cybersecurity documentation
4. Reference MDDT qualification in submission

### 11.2 Popper MDDT Qualification Pathway

#### REQUIRED: FDA MDDT Qualification

Per ARPA-H TA2 specs (§2.G, §5):
- **Mandatory:** "Technologies not being developed for FDA MDDT qualification" are OUT OF SCOPE
- **Goal:** "Achieve FDA MDDT Qualification" to become "industry standard tool for generative and agentic AI monitoring"

#### Category: NAM (Non-Clinical Assessment Model)

**Rationale:**
- Popper is a non-clinical tool (evaluates AI, not patients directly)
- Computational/algorithmic nature matches NAM precedents
- MRI Temperature Rise Tool provides pathway model
- Does not measure biological markers (not BT) or patient outcomes (not COA)

#### Proposed Context of Use

**IMPORTANT:** Per ARPA-H TA2 specs, Popper MUST achieve FDA MDDT qualification. This is not optional—technologies not developed for MDDT qualification are explicitly out of scope.

```
Context of Use Statement (Draft):

"The Popper Supervisory Agent is qualified as a disease-agnostic,
non-clinical assessment model for automated monitoring and control
of AI/ML-enabled clinical agents.

Specifically, Popper may be used to:

1. ASCERTAIN AGENT ACCURACY (>95% target)
   - Evaluate correctness of AI clinical recommendations
   - Recognize high-quality vs low-quality outputs

2. QUANTIFY HALLUCINATION RATE (>95% target)
   - Detect fabricated or unsupported clinical claims
   - Measure hallucination frequency over time

3. DETERMINE UNCERTAINTY (>95% target)
   - Assess confidence levels in AI inference
   - Identify recommendations requiring clinician review

4. ASSESS CLINICAL ACUITY AND INTERVENTION RISK (>97% target)
   - Evaluate patient risk from AI-recommended actions
   - Evaluate patient risk from AI-recommended inaction
   - Route high-risk outputs to clinician review

5. MONITOR ALGORITHMIC DRIFT
   - Detect performance degradation over deployment lifetime
   - Trigger hard-stop analysis when thresholds exceeded

Within feasibility, pivotal, and post-market studies of AI/ML-enabled
Software as a Medical Device (SaMD) across clinical domains. While
initially tuned for cardiovascular disease, the tool is designed to
support future clinical agents with different intended uses."
```

**Key Alignment with ARPA-H TA2 Specs:**

| ARPA-H Requirement | COU Coverage |
|--------------------|--------------|
| Disease agnostic | ✓ "across clinical domains" |
| Ascertain agent accuracy >95% | ✓ Explicitly stated |
| Hallucination quantification >95% | ✓ Explicitly stated |
| Uncertainty determination >95% | ✓ Explicitly stated |
| Acuity/risk >97% | ✓ Explicitly stated |
| Algorithmic drift monitoring | ✓ Explicitly stated |
| Post-market monitoring | ✓ "post-market studies" |

#### Evidence Requirements (Based on ARPA-H TA2 Specs)

| Evidence Type | Description | ARPA-H Target | Source |
|---------------|-------------|---------------|--------|
| **Agent Accuracy Assessment** | Popper's ability to ascertain TA1 accuracy | >95% (Phase 1B) | IV&V studies |
| **Hallucination Quantification** | Accuracy in detecting fabricated content | >95% (Phase 1B) | IV&V studies |
| **Uncertainty Determination** | Accuracy in assessing AI confidence levels | >95% (Phase 1B) | IV&V studies |
| **Acuity/Risk Assessment** | Accuracy in determining clinical risk | >97% (Phase 1B) | IV&V studies |
| **Algorithm Description** | Safety DSL + policy engine documentation | N/A | Spec files |
| **Reproducibility** | Deterministic: same input → same output | Required | Policy tests |
| **Drift Detection** | Demonstrated algorithmic drift monitoring | Required | Post-market data |
| **Disease Agnosticism** | Demonstrated generalizability beyond CVD | Required | Multi-domain testing |
| **Limitations** | Known failure modes, edge cases | Required | Safety analysis |

**Note:** IV&V data collected through ARPA-H program will meet FDA criteria and can be included in MDDT qualification applications (per TA2 §5).

### 11.3 Supporting Tools & Future MDDT Proposals

**Note:** Hallucination detection and drift monitoring are **core Popper requirements** per ARPA-H TA2 specs (not separate future tools). The proposals below are for **additional** standardization tools that could support Popper's functions or extend the ecosystem.

#### Proposal 1: AI Hallucination Ground Truth Dataset

| Attribute | Value |
|-----------|-------|
| Category | BT or NAM |
| Purpose | Benchmark dataset for validating Popper's hallucination detection |
| Need | Popper must quantify hallucination rate at >95% accuracy—needs ground truth |
| Precedent | OsiriX CDE (standardization tool for TBI imaging) |
| Relationship | Supports Popper validation, not a replacement |

#### Proposal 2: Demographic Parity Testing Protocol

| Attribute | Value |
|-----------|-------|
| Category | NAM |
| Purpose | Validate AI fairness across demographics |
| Need | GMLP Principle 3 (representative data) compliance |
| Precedent | MRI Temperature Rise Tool (computational testing) |
| Relationship | Extends Popper for bias auditing |

#### Proposal 3: Cross-Domain Conflict Resolution Validator

| Attribute | Value |
|-----------|-------|
| Category | NAM |
| Purpose | Validate multi-domain recommendation conflict detection |
| Need | Popper's disease-agnostic design requires handling multiple clinical domains |
| Precedent | MITRE CVSS (assessment rubric) |
| Relationship | Supports Popper's multi-domain composition evaluation |

---

## 12. Implementation Checklist

### For Immediate MDDT Integration

#### KCCQ/MLHFQ Integration
- [ ] Obtain instrument licenses
- [ ] Design form integration in Deutsch UI system
- [ ] Create data model for PRO scores in HealthStateSnapshot
- [ ] Implement scoring algorithms
- [ ] Validate electronic administration equivalence
- [ ] Document in clinical trial protocols

#### MITRE CVSS Integration
- [ ] Adopt rubric v0.12.04 for security assessments
- [ ] Train security team on methodology
- [ ] Document all Hermes vulnerabilities using rubric
- [ ] Create vulnerability tracking system
- [ ] Include in premarket cybersecurity submission

### For Popper MDDT Qualification

#### Phase 1: Proposal Preparation
- [ ] Draft Context of Use statement
- [ ] Document tool description (Safety DSL spec)
- [ ] Compile preliminary evidence (IV&V data)
- [ ] Create qualification plan outline
- [ ] Identify FDA MDDT program contacts

#### Phase 2: Evidence Development
- [ ] Execute validation studies per plan
- [ ] Compile performance data
- [ ] Document limitations and failure modes
- [ ] Prepare SEBQ draft sections
- [ ] Conduct internal review

#### Phase 3: Submission
- [ ] Submit proposal package
- [ ] Respond to FDA questions
- [ ] Complete full qualification package
- [ ] Address FDA review comments
- [ ] Finalize SEBQ document

---

## 13. References

### FDA MDDT Program

- [Medical Device Development Tools (MDDT) Main Page](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt)
- [Qualification of Medical Device Development Tools Guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/qualification-medical-device-development-tools)
- [MDDT Proposal Submission Content](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt/medical-device-development-tool-mddt-proposal-submission-content)

### SEBQ Documents (11 ADVOCATE-Relevant MDDTs)

| # | Tool | Category | SEBQ Link |
|---|------|----------|-----------|
| 1 | KCCQ | COA | [Download](https://www.fda.gov/media/108301/download) |
| 2 | MLHFQ | COA | [Download](https://djhurij4nde4r.cloudfront.net/attachments/files/000/000/483/original/MLHFQ_FDA_Medical_Device_Development_Tool_(MDDT)_Qualification_Package.pdf) |
| 3 | Apple Watch AFib | BT | [Download](https://www.fda.gov/media/178230/download) |
| 4 | INSPIRE | COA | [Download](https://www.fda.gov/media/139432/download) |
| 5 | WOUND-Q | COA | [Download](https://www.fda.gov/media/183648/download) |
| 6 | IMAnalytics/MRIxViP | NAM | [Download](https://www.fda.gov/media/148922/download) |
| 7 | Virtual MRI Safety | NAM | [Download](https://www.fda.gov/media/154181/download) |
| 8 | UCSF LAD | BT | [Download](https://www.fda.gov/media/177482/download) |
| 9 | MITRE CVSS | NAM | [Download](https://www.fda.gov/media/143131/download) |
| 10 | MRI Temperature Rise | NAM | [Download](https://www.fda.gov/media/166724/download) |
| 11 | ENDPOINT numaScrew | NAM | [Download](https://www.fda.gov/media/188766/download) |

### Other SEBQ Documents (Reference)

| Tool | SEBQ Link |
|------|-----------|
| OsiriX CDE | [Download](https://www.fda.gov/media/112157/download) |
| BREAST-Q | [Download](https://www.fda.gov/media/141349/download) |

### ADVOCATE Specs

- [Deutsch System Spec](../../01-deutsch-specs/01-deutsch-system-spec.md)
- [Popper System Spec](../../02-popper-specs/01-popper-system-spec.md)
- [Hermes Contracts](../../03-hermes-specs/02-hermes-contracts.md)
- [MDDT Qualification Guide](./02-mddt-qualification-guide.md)

### External Resources

- [MITRE CVSS Rubric Publication](https://www.mitre.org/news-insights/publication/rubric-applying-cvss-medical-devices)
- [MITRE CVSS Online Calculator](https://cvss-rubric.deeparmor.com/)
- [JACC KCCQ Interpretation Review](https://www.jacc.org/doi/abs/10.1016/j.jacc.2020.09.542)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
| 1.1.0 | 2026-01-24 | ADVOCATE Team | Fixed section numbering, KCCQ/MLHFQ dates, Apple AFib category, COU/licensing guidance |
| 1.2.0 | 2026-01-24 | ADVOCATE Team | Fixed SEBQ links (IMAnalytics, Virtual MRI, UCSF LAD, ENDPOINT), corrected ENDPOINT date to May 2025, added MED Institute attribution for Virtual MRI, added asystole to UCSF LAD coverage, added CVSS v3.0/v3.1 clarification |
