# TA1: CVD Agent – Reliable Agentic Care Management (Official Specs)

**Source:** ARPA-H-SOL-26-142 (ADVOCATE ISO)
**Extracted from:** `@01-regain-health/docs/00-vision/01-ADVOCATE/ARPA-docs/00-new-arpa-specs/00-new-arpa-specs.md`

---

## 1. Definition and Scope

**TA1 – "CVD Agent"** is defined as a clinically validated, regulatory-compliant, patient-facing, multimodal autonomous AI agent system.

It involves the development and deployment of a patient-facing, multimodal agentic system that performs clinical functions autonomously and semi-autonomously with the clinical team, integrated in real-time with patient EHR(s) and wearables. The goal is to provide **24/7 access** to scalable, safe, and effective **patient-centric specialist-level cardiovascular care** at a fraction of today's cost.

### Target Population
The agent is designed for patients with **chronic Cardiovascular Disease (CVD)**, specifically targeting:
*   **Heart Failure**
*   **Post-Myocardial Infarction (Post-MI)**
*   *Note:* Adequate representation of **older adults** is critical in development and validation studies.

### Deployment Model
*   **Clinician Prescribed:** The agent will be ‘prescribed’ to patients by their clinician (primary care physician or cardiologist).
*   **Continuous Management:** It will interact directly with patients to provide continuous outpatient management.
*   **Team Extension:** It functions in coordination with and as an extension of the clinical team, capable of adapting to clinical context and patient preferences.
*   **Empowered Execution:** The agent is empowered by the controlling healthcare organization to execute pre-defined activities (e.g., responding to queries, modifying appointments).
*   **Independence:** Independent model development from TA1 is essential to prevent overfitting and minimize **‘AI sycophancy’** (agreeing with the user/clinician incorrectly).

---

## 2. Required Functionalities

The CVD Agent must deliver the following core capabilities:

### A. Agentic Execution & Clinical Reasoning
*   **Autonomous Analysis:** Leverage reasoning capabilities of advanced generative AI models (LLMs, multimodal models) to capture relevant nuances of the patient’s condition.
*   **Task Prioritization:** Prioritize tasks and escalate findings.
*   **Action Execution:** Take actions such as adjusting treatment plans.
*   **Output Generation:** Translate complex inputs into actionable personalized patient-facing outputs, including:
    *   Timely diagnoses.
    *   Optimal treatment recommendations.
    *   Personalized health recommendations.
    *   Seamless care navigation.
    *   **Predictive Analytics:** Anticipate clinical outcomes for chronic CVD and adjust interventions accordingly.

### B. Medical Device Functions (FDA-Regulated)
*   **Prescription Management:** Autonomously managing prescription orders and changing existing prescriptions for CVD conditions, specifically:
    *   Hypertension
    *   Hyperlipidemia
    *   Heart Failure
    *   Atrial Fibrillation (AFib)

### C. Non-Device Functions
*   **Medication Management:** General support and adherence tracking.
*   **Nutrition Support:** Personalized dietary guidance.
*   **Virtual Physical Therapy:** Exercise guidance and monitoring.
*   **Care Navigation:** Scheduling, appointment management, and logistics.
*   **Health Coaching:** Tailored health coaching and goal setting.
*   **Documentation:** Automatic documentation of interactions and outcomes.
*   **Triage:** Protocols for accurate, timely, and efficient clinical triage and task assignment.

### D. Data Processing & Integration
*   **Low Latency:** Must source, integrate, and analyze relevant patient data in **<100ms** to support iterative clinical reasoning.
*   **Data Pipeline:** Automatic solution for identification, selection, extraction, **indexing, de-duplication**, normalization, and analysis of relevant data types.
*   **Context Management:** Efficient error handling and context management to enable instantaneous responses.
*   **Multimodal Inputs:**
    *   **Patient Inputs:** Text, voice, video, and images.
    *   **Clinical Data:** Clinically relevant data from EHRs.
    *   **Wearable Data:** Tokenization of multimodal data from wearables (EKGs, CGMs, Blood Pressure, Activity, Weight).
*   **Patient Channels:** Connect through **native apps, secure web applications, or HIPAA-compliant calls and texts**.

### E. Interoperability & Standards
*   **EHR Agnostic:** Must be interoperable between different EHR vendors.
*   **Standards:** Native support for **FHIR**, **HL7 v2**, and national **HIE** network APIs.
*   **Health IT Standards:** Adherence to **TEFCA** (Trusted Exchange Framework and Common Agreement) and **USCDI** (United States Core Data for Interoperability) standards is expected for US health IT alignment.
*   **Device Standards:** Adherence to **ISO/IEEE 11073** for device interoperability is encouraged.
*   **Orchestration:** Must support industry-standard orchestration frameworks.
*   **Open Source Preference:** Technical solutions containing software elements should prefer commercial-friendly open-source licenses (MIT, BSD, Apache 2.0).
*   **Missing Standards:** If an open consensus-based standard does not exist, the proposer must describe a plan to develop a general-purpose **open data model** and prototype new open APIs.

### F. Identity & Access Management (IAM)
*   **Security:** Implement end-to-end encryption, role-based access controls (RBAC), and comprehensive audit logs.
*   **Compliance:** Ensure compliance with HIPAA, GDPR, and NIST Cybersecurity Framework.
*   **Privacy:** Utilize privacy-preserving AI techniques.

### G. Development & Lifecycle Management
*   **Foundation Models:** Build on pre-trained LLMs or multimodal foundation models.
*   **Training Data:** Training in Phase 1A will include semantic CVD knowledge, clinical guidelines/protocols, **patient-doctor conversations**, and clinical research/education resources.
*   **Monitoring:** Support model drift monitoring, continuous learning, and human-in-the-loop feedback (RLHF).
*   **Safety:** Mechanisms to prevent harmful actions and ensure ethical, patient-centered decision-making.
*   **Auditing:** Real-time monitoring of cybersecurity, data reproducibility, and user permissions.

### H. Out of Scope
*   Foundation models developed from scratch.
*   Technologies not being developed for FDA authorization.
*   Solutions lacking interoperability with Supervisory agents and industry standard orchestration frameworks.

---

## 3. Program Timeline & Milestones

The ADVOCATE program is a 39-month effort.

### Phase 1A (Months 0-12): Solution Development
*Goal: Develop prototype technology, alpha testing, and IV&V study using synthetic data.*

*   **Month 6 Goal:** Initial prototypes ready for **alpha testing** for a subset of use cases with patients and clinicians (using EHR data from TA3).
*   **Month 9 Goal:** Expanded prototypes covering improvements and additional use cases ready for **formal evaluation in IV&V study** (using simulated/synthetic patients). This study informs Phase 1A down-selection.
*   **Month 12 Goal (End of Phase 1A):**
    *   Demonstrate **non-inferiority vs cardiologists** for treatment, empathy, and reasoning with low latency.
    *   Based on IV&V results and evaluation, performers may be down-selected.

#### Phase 1A Metrics

| Category | Metric | Target / Requirement |
| :--- | :--- | :--- |
| **Effectiveness** | **Non-inferiority vs. cardiologists** | Required (Tested w/ Synthetic Data) |
| | Appropriateness of Agentic Actions | >85% |
| | Appropriateness of Triage | >85% |
| | Serious error rate | <5% |
| **Patient Experience** | Effective adaptation to preferences | >90% |
| | User Acceptance Test (UAT) score | >85 |
| **Data Integration** | Effective selection of relevant records | >93% |
| | FHIR/HL7v2 success ratio | >95% |
| | Data summarization token reduction | >40% |
| | Summarization quality score (Claim Recall) | >80% |
| | Errors auto-corrected | >85% |
| **Usability** | Supported EHR vendors | 1+ |
| | Integrated wearable/RPM devices | 1+ |
| **Efficiency** | **Record processing time** | **<2s** |
| | **Response latency (audit log round-trip)** | **<3s** |
| | Computational cost (per record) | <$0.50 |

### Phase 1B (Months 12-24): Integration & Validation
*Goal: Technology ready for FDA submission, integration with TA3, and IV&V with human users.*

*   **Month 18 Goal:** Solution prototype ready. Formal meetings with **FDA** held. TA3 begins prototyping clinician interface and seeking IRB approval.
*   **Month 21 Goal:** Release candidates undergo **IV&V evaluation** with **human users/patients** (comparing TA1 vs cardiologists).
*   **Month 24 Goal (End of Phase 1B):**
    *   Finalized release candidates ready for deployment.
    *   Capable of remote updates based on Phase 2 feedback.
    *   Down-selection for Phase 2 based on IV&V results and product quality.

#### Phase 1B Metrics

| Category | Metric | Target / Requirement |
| :--- | :--- | :--- |
| **Effectiveness** | **Non-inferiority vs. cardiologists** | Required (Tested w/ Simulated Patients) |
| | Appropriateness of Agentic Actions | **>95%** |
| | Appropriateness of Triage | **>95%** |
| | Serious error rate | **<3%** |
| **Patient Experience** | Effective adaptation to preferences | >95% |
| | User Acceptance Test (UAT) score | >95 |
| **Data Integration** | Effective selection of relevant records | >95% |
| | FHIR/HL7v2 success ratio | >97% |
| | Data summarization token reduction | >50% |
| | Summarization quality score (Claim Recall) | >85% |
| | Errors auto-corrected | >90% |
| **Usability** | Supported EHR vendors | 2+ |
| | Integrated wearable/RPM devices | 2+ |
| **Efficiency** | **Record processing time** | **<0.1s** |
| | **Response latency (audit log round-trip)** | **<1s** |
| | Computational cost (per record) | <$0.05 |

### Phase 2 (Months 24-39): Scalability Studies
*Goal: Scalability Studies in real-world settings.*

*   **Objective:** Assess clinical performance, outcomes, cost-efficiency, and safety in real-world scenarios versus usual care.
*   **Outcomes Monitored:**
    *   HF/CVD Hospitalizations.
    *   ED/UC visits.
    *   CV death.
    *   Serious adverse events.
    *   Appropriateness of agentic functions (care navigation, prescriptions).
    *   Treatment adherence.
    *   Time savings for clinical team.

---

## 4. Collaboration & Integration Requirements

### Integration with TA2 (Supervisory Agent)
*   **Seamless Integration:** TA1 must ensure seamless integration with the TA2 Supervisory Agent.
*   **Common API:** Connection must be established via a **common API** to allow for real-time oversight.
*   **Transparency:** The system must support auditability to allow TA2 to evaluate risk, acuity, accuracy, and uncertainty.
*   **Remote Monitoring Protocol:** Develop a standardized open-source protocol for secure low-latency (<100ms) communication.

### Integration with TA3 (Scalable Implementation)
*   **Clinical Testing:** TA1 must work with TA3 partners (healthcare organizations) to gain access to EHR data and pre-production environments for tuning.
*   **Workflow Integration:** Must support governance frameworks for integrating agentic functions into actual clinical workflows.
*   **UI/UX Testing:** Engage with TA3 performers to execute UI/UX testing with clinicians and patients.
*   **Clinical Operations APIs:** Develop APIs for connecting with existing healthcare tools (scheduling, pharmacy, care navigation).

### Data Management & Sharing
*   **Associate Performer Agreement (APA):** Develop and agree to an APA for data sharing.
*   **Data Management and Sharing Plan (DMSP):** Required plan for sharing de-identified/sanitized data with other performers and federal agencies.
    *   *Note:* DMSP should include strategies for protecting intellectual property where open sharing might harm commercial value.
*   **Open Access:** Guarantee data open access and collaboration to meet technical goals.

---

## 5. Regulatory Strategy

*   **Classification:** TA1 is classified as **Software as a Medical Device (SaMD)**.
*   **Authorization:** The goal is to achieve **FDA Market Authorization**.
*   **Engagement:**
    *   **513(g) Meetings:** Performers will receive feedback from 513(g) meetings with the FDA to guide regulatory submission.
    *   **IDE Studies:** Performers will support TA3 in performing FDA Investigational Device Exemption (IDE) studies in Phase 1B.
*   **IV&V Data:** Data collected throughout IV&V processes will meet FDA criteria and can be part of authorization applications.

---

## 6. Commercialization & Management

### Commercialization Strategy
TA1 performers must submit a commercialization strategy narrative (max 2 pages) including:
*   **Executive Summary:** Market need, transition options (licensing, spin-out), and success definition. Address **alternative off-ramps** for sub-technologies (diagnostic, digital twin, therapeutic).
*   **Strategy:** Approach to end-user/market, business model, IP, regulatory, and transition/exit plan.
*   **Resources:** Available resources (facilities, IP management, regulatory support, financial).
*   *Reference:* See **Appendix E** for Commercialization Roadmap example.

### Management Plan
A management plan is required, detailing:
*   **Team Expertise:** Summary of team and key personnel (Principal Investigator (PI), Project Manager).
*   **Organization:** Org chart showing relationships, capabilities, and responsibilities.
*   **Teaming Strategy:** Explicit guidelines for interaction among collaborators and teaming agreements.
*   **Effort:** Key personnel with the **amount of effort** to be expended by each person during each year.
*   **Coordination:** Plan for interaction among collaborators and risk management.

### Resource Sharing
*   **Encouragement:** Resource sharing (Cash or In-Kind contributions) is highly encouraged to demonstrate commitment and reduce government cost.
*   **Examples:** Personnel time, equipment use, clinical services, proprietary databases.

### Eligibility Note
*   **US Preference:** Awards prioritized for entities conducting work in the US.
*   **Non-US Entities:** May participate if complying with security/export laws, but awards will not be made to entities in covered foreign countries (e.g., China, Russia, Iran, North Korea).
