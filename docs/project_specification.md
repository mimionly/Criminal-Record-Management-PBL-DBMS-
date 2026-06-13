# CIPMS Project Specification

This document details the functional specifications, database configurations, and requirements for the **Criminal Intelligence & Public Safety Management System (CIPMS)**.

## 1. Functional Scope

### A. Citizen Module
- **Self-service Portal**: Login/Register using JWT credentials.
- **FIR Registration**: Submit complaints specifying incident location, date, time, description, category, and digital evidence uploads.
- **Live Status Feed**: Check review state of filed complaints (Pending -> Approved/Investigating -> Closed/Rejected).
- **SOS Emergency Beacon**: Trigger instantaneous SOS alerts transmitting latitude and longitude.
- **Vehicle Violation Management**: Search active vehicular challans and perform dummy payments.

### B. Police Officer Module
- **Investigation Feed**: Review case queues assigned by Station Inspectors.
- **Suspect Linkage**: Link identified suspects from the centralized Criminal database to active cases.
- **Dynamic Case Journaling**: Add progression remarks, upload physical evidence metadata, and close/escalate cases.

### C. Inspector Module
- **Station Management**: View overall queue metrics (Total pending, Solved ratio).
- **Officer Deployment**: Manually assign open cases to on-duty officers.
- **Performance Evaluation**: View charts plotting resolution latency per officer.

### D. Admin Module
- **General CRUD Control**: Create, update, or remove police stations, adjust officer badge levels, and revoke citizen credentials if abused.
- **Strategic Analytics**: Access the geospatial heatmap to view high-density crime clusters.

---

## 2. Advanced Algorithmic Workflows

### Criminal Risk Scoring
When a criminal profile is created or updated, the system evaluates their public risk factor:
- **Calculation Formula**:
  $$\text{Score} = (C \times 10) + (V \times 20) + (W \times 30)$$
  Where $C$ is the total count of minor/moderate offenses, $V$ is violent offense count, and $W$ is the count of active warrants.
- **Mapping Ranges**:
  - `0 - 20`: Low Risk
  - `21 - 50`: Medium Risk
  - `51 - 99`: High Risk
  - `100+` / Warrant Active: Wanted

### FIR Priority Processing & Keyword Matching
Incoming complaints are scanned for high-priority tokens (`assault`, `kidnap`, `weapon`, `drugs`, `homicide`) and flagged automatically to alert the inspector immediately, escalating response times.
