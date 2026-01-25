# TA2: Supervisory Agent – Automated Clinical Agent Monitoring & Control (Official Specs)

**Source:** ARPA-H-SOL-26-142 (ADVOCATE ISO)
**Extracted from:** `@01-regain-health/docs/00-vision/01-ADVOCATE/ARPA-docs/00-new-arpa-specs/00-new-arpa-specs.md`

---

## 1. Definition and Scope

**TA2 – "Supervisory Agent"** is defined as a disease-agnostic, independent oversight agent for real-time monitoring, auditability, and regulatory compliance.

It involves the development of a scalable and context-aware Supervisory agent that can continuously monitor and control clinical agents (TA1), playing a pivotal role in local management and regulatory post-marketing monitoring of deployed clinical agents’ safety and performance.

### Core Philosophy: "The Shield"
*   **Independent Oversight:** Must be developed independently from TA1 to prevent "AI sycophancy" and ensuring objective safety gating.
*   **Disease Agnostic:** While tuned for CVD in this program, the goal is to be capable of evaluating and supporting future clinical agents with different intended uses.
*   **Automated Monitoring:** Performs automated continuous monitoring and control of clinical agents using low-touch and highly reliable mechanisms.
*   **Mission Critical:** Plays a mission-critical role in safety assurance by independently detecting and preventing potential errors in real-time.

---

## 2. Required Functionalities

The Supervisory Agent must deliver the following core capabilities:

### A. Clinical Agent Monitoring
*   **Continuous Evaluation:** Continuously evaluate both patient inputs and the CVD (TA1) agent’s outputs.
*   **Recommendations:** Evaluate clinical recommendations across diseases, assessing quality, risk, and reliability.
*   **Risk Assessment:** Assess risk (from action or inaction), acuity, accuracy, and the level of uncertainty in the CVD agent’s reasoning.
*   **Drift Monitoring:** Monitor patient acuity, errors, and **algorithmic drift**.

### B. Clinical Agent Management (Control)
*   **Output Routing:** Determine whether outputs or actions can safely proceed or whether they should be routed to a clinician for review (trigger clinician intervention).
*   **Hard-Stop Analysis:** Monitor for dips in clinical reasoning and trigger a "hard-stop" analysis.
*   **Safe Mode Transition:** Ability to transition the system to a "safe mode" when necessary.
*   **Direct Control:** Securely exert direct live control and changes in operational settings for care management functions of the TA1 agent.
*   **Audit Logs:** Maintain comprehensive audit logs of all clinical agent activities.
*   **Compliance:** Continuously monitor clinical guidelines and compliance and regulatory standards.

### C. Regulatory Support
*   **Data Transfer:** System allowing useful data transfers to regulatory bodies for oversight.
*   **Privacy:** De-identifies and aggregates data.
*   **Triage:** Protocols for rapid issue triage and resolution.

### D. Data Integration
*   **Real-time Integration:** Facilitate real-time product integration with the CVD agent to ensure appropriate monitoring and oversight of the overall customer experience.

### E. Interoperability (Fusion Protocol)
*   **Framework:** Present an interoperability framework leveraging **Application Programming Interfaces (APIs)** and **Model Context Protocol (MCP)**.
*   **Health IT Standards:** Adherence to **TEFCA** (Trusted Exchange Framework and Common Agreement) and **USCDI** (United States Core Data for Interoperability) standards is expected for US health IT alignment.
*   **Security Standards:** Adhere to FDA and industry standards for privacy and security.
*   **Protocol:** Collaborate with TA1 to develop a standardized **Remote Monitoring & Control open-source protocol** for secure low-latency (**<100ms**) communication.
*   **Open Source Preference:** TA2 solutions are strongly preferred to be open source. Technical solutions containing software elements should prefer commercial-friendly open-source licenses (MIT, BSD, Apache 2.0).

### F. Development & Life Cycle Management
*   **Adaptability:** System that adapts to new clinical knowledge, guidelines, and regulatory requirements.
*   **Learning:** Supports continuous learning and **human-in-the-loop feedback (RLHF)**.
*   **Validation:** Allows for rigorous testing and validation to ensure accuracy and effectiveness.

### G. Out of Scope
*   Foundation models developed from scratch.
*   Solutions that are **not** disease agnostic.
*   Technologies not being developed for **FDA MDDT qualification**.
*   Solutions lacking interoperability with Supervisory agents and industry-standard orchestration frameworks.

---

## 3. Program Timeline & Milestones

The ADVOCATE program is a 39-month effort.

### Phase 1A (Months 0-12): Solution Development
*Goal: Develop prototype technology, alpha testing, and IV&V study using synthetic data.*

*   **Month 6 Goal:** Initial prototypes ready for **alpha testing** for a subset of use cases (using EHR data from TA3).
*   **Month 9 Goal:** Expanded prototypes covering improvements and additional use cases ready for **formal evaluation in IV&V study** (using simulated/synthetic patients).
*   **Month 12 Goal (End of Phase 1A):**
    *   Develop low-latency Agentic prototypes capable of ascertaining accuracy, clinical acuity, and intervention risk.
    *   Based on IV&V results and evaluation, performers may be down-selected.

#### Phase 1A Metrics

| Category | Metric | Target / Requirement |
| :--- | :--- | :--- |
| **Effectiveness** | **Ability to ascertain agent accuracy** | **>85%** |
| | Recognition of high-quality recommendations | >85% |
| | Quantification of hallucination rate | >85% |
| | Determination of uncertainty of clinical inference | >85% |
| | Determination of clinical acuity and intervention risk | >90% |
| | Evaluation of appropriateness of task assignment | >90% |
| **Usability** | Clinician app User Acceptance Test (UAT) score (0–100) | >80 |
| | **Response latency (audit log round-trip)** | **<3s** |
| | Quality score (0-100) of summarized clinical info | >80 |

### Phase 1B (Months 12-24): Integration & Validation
*Goal: Technology ready for FDA submission, integration with TA3, and IV&V with human users.*

*   **Month 18 Goal:** Solution prototype ready. Formal meetings with **FDA** held.
*   **Month 21 Goal:** Release candidates undergo **IV&V evaluation** with **human users/patients** (comparing TA1 performance vs cardiologists).
*   **Month 24 Goal (End of Phase 1B):**
    *   Finalized release candidates ready for deployment.
    *   Capable of remote updates based on Phase 2 feedback.
    *   Down-selection for Phase 2 based on IV&V results and product quality.

#### Phase 1B Metrics

| Category | Metric | Target / Requirement |
| :--- | :--- | :--- |
| **Effectiveness** | **Ability to ascertain agent accuracy** | **>95%** |
| | Recognition of high-quality recommendations | >95% |
| | Quantification of hallucination rate | >95% |
| | Determination of uncertainty of clinical inference | >95% |
| | Determination of clinical acuity and intervention risk | >97% |
| | Evaluation of appropriateness of task assignment | >97% |
| **Usability** | Clinician app User Acceptance Test (UAT) score (0–100) | >90 |
| | **Response latency (audit log round-trip)** | **<1s** |
| | Quality score (0-100) of summarized clinical info | >95 |

### Phase 2 (Months 24-39): Scalability Studies
*Goal: Scalability Studies in real-world settings.*

*   **Objective:** Access the effectiveness of the Supervisory agent as a decentralized post-market monitoring solution to dynamically oversee and audit the performance of clinical AI agents deployed in patient care.
*   **Monitoring:** Continuously monitored on effectiveness in tracking CVD agent activities to provide safety assurance.

---

## 4. Collaboration & Integration Requirements

### Integration with TA1 (CVD Agent)
*   **Fusion Protocol:** Collaborate on the development of the standardized Remote Monitoring & Control protocol.
*   **Seamless Integration:** Ensure the Supervisory agent allows for seamless integration with the CVD agent via a **common API**.

### Integration with TA3 (Scalable Implementation)
*   **Clinical Insights:** Collaborate with TA3 to receive clinical insights.
*   **Testing:** Execute UI/UX testing with TA3 clinicians.
*   **Data Access:** Leverage TA3 EHR data/pre-production environments for tuning.

### Data Management & Sharing
*   **Associate Performer Agreement (APA):** Develop and agree to an APA for data sharing.
*   **Data Management and Sharing Plan (DMSP):** Required plan for sharing de-identified/sanitized data with other performers and federal agencies.
    *   *Note:* DMSP should include strategies for protecting intellectual property where open sharing might harm commercial value.
*   **Open Access:** Guarantee data open access and collaboration to meet technical goals.

---

## 5. Regulatory Strategy

*   **Classification:** TA2 is classified as a **Medical Device Development Tool (MDDT)**.
*   **Qualification:** The goal is to achieve **FDA MDDT Qualification**.
    *   This allows it to become the industry standard tool for generative and agentic AI monitoring.
*   **Engagement:** The program includes ongoing engagement with the FDA, facilitated by ARPA-H.
*   **IV&V Data:** Data collected throughout IV&V processes will meet FDA criteria and can be part of authorization/qualification applications.

---

## 6. Commercialization & Management

### Commercialization Strategy
TA2 performers must submit a commercialization strategy narrative (max 2 pages) including:
*   **Executive Summary:** Market need, transition options (licensing, spin-out), and success definition. Address **alternative off-ramps** for sub-technologies.
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
