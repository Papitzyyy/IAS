# PRD: Secure Information System (IS)

## Objective

Develop a secure Information System that implements core Information Assurance and Security (IAS) principles, focusing on data confidentiality, integrity, and availability within a medical emergency context.

## Project Title

**CRCY Scan and Help: EVSU Student Medical Tag System with Integrated Security Controls**

---

## Purpose

The purpose of this project is to design and develop a secure Information System (IS) that demonstrates core principles of Information Assurance and Security, including data protection, authentication, access control, and secure system integration. It serves the EVSU Ormoc Campus by providing College Red Cross Youth (CRCY) student responders with instant, secure access to student-approved medical directives via tokenized QR codes during emergencies.

---

## System Description

The "Scan and Help" system is a secure emergency medical directive system consisting of a Web Dashboard for Clinic Admins and a secure Android Application (APK) for CRCY Responders. 

1. **Opt-In and Data Collection**: Students opt-in by submitting a physical medical consent form at the EVSU clinic. A Clinic Admin then registers their chosen emergency medical details (e.g., severe allergies, high-risk diagnoses, and guardian contact details) into the Web Portal.
2. **Tag Generation & Verification**: The system generates a print-ready QR tag for the student containing a signed UUID token. Simultaneously, the student receives an automated email summarizing their encoded profile and providing a one-click tag deactivation link (complying with the right-to-erasure and notification principles of RA 10173).
3. **Emergency Scanning**: In a campus medical crisis, an authorized CRCY Responder scans the student's QR tag with the mobile app. The app cryptographically verifies the token, displays the critical medical directives, and provides active direct-dialing shortcuts to contact the student's emergency guardian immediately.

---

## Security Features Implemented

*   **Cryptographic Tokenization**: QR codes hold signed UUID tokens—not raw medical text. Each scanned token must be verified against an HMAC-SHA256 signature generated with a server-side secret key.
*   **Role-Based Access Control (RBAC)**: Distinct permissions enforced at the API gateway level:
    *   *Clinic Admins* possess write/update access to student files, auditor logs, and staff configurations. They cannot access the mobile scanner.
    *   *CRCY Responders* possess read-only scanner capabilities and me-profile management. They cannot view administration views.
*   **Session Management & Kill Switch**: Active responder sessions expire after 30 days to facilitate continuous availability in emergency environments. Clinic Admins hold a "Remote Kill Switch" in the dashboard to immediately deactivate any responder and invalidate their active session tokens.
*   **Encryption at Rest & In Transit**:
    *   *In-Transit*: All communications between clients and the backend are forced over secure TLS/HTTPS configurations in production.
    *   *At-Rest*: User credentials and MFA OTP codes are securely salted and hashed at rest (using `bcrypt` and `SHA-256`). For sensitive student medical columns, at-rest AES-256 encryption is supported as an optional PostgreSQL production migration via `pgcrypto` (SQLite stores development fields natively in plain-text).
*   **Immutable Audit Log**: The database includes an append-only audit trail. A database-level trigger rejects all `UPDATE` and `DELETE` commands, protecting the logs from deletion or tampering.

---

## Tools/Technologies Used

*   **Web Portal (Admin)**: HTML5 / JavaScript / Vanilla CSS / Tailwind CSS (served statically by the FastAPI server).
*   **Mobile Scanner (Responder)**: React Native (Android APK) featuring camera scanner integrations and direct dialing capability.
*   **Backend / API**: FastAPI (Python 3.10+) with request validation via Pydantic.
*   **Database**: PostgreSQL (Production) / SQLite (Local Development & Sandbox Testing).
*   **Security & Hashing**: JWT (JSON Web Tokens) for API authorization, bcrypt for password hashing, and SHA-256 for OTP hashing.
*   **QR Security**: HMAC-SHA256 signatures with server-side secrets.

---

## Threats Identified & Mitigation

*   **Threat**: Lost Responder Phone (Unauthorized Access)
    *   *Mitigation*: Admins can execute a "Remote Kill Switch" to deactivate the responder's account, instantly invalidating their JWT session token and logging them out on their next API interaction.
*   **Threat**: Stolen / Copied Student QR Tag
    *   *Mitigation*: The QR payload does not display raw text and can only be decoded by a signed responder session. The student can click the deactivation link in their automated email to instantly void the tag server-side.
*   **Threat**: Brute Force Login Attacks
    *   *Mitigation*: The backend automatically locks out user accounts after 3 consecutive failed OTP attempts within a 15-minute window.
*   **Threat**: QR Spoofing (Creating fake QR codes)
    *   *Mitigation*: Scanned QR payloads are cryptographically checked against an HMAC-SHA256 signature using the server-side secret key. Spoofed or manually altered tags are rejected with a `403 Forbidden` response.

---

## Limitations of the System

*   **Hardware Dependency**: Responders must have a functioning, charged smartphone to run the scanner.
*   **Connectivity Required**: The application requires active EVSU intranet/internet connectivity to query the API and load the student profile. Offline caching is out of scope.
*   **Physical Tag Dependency**: The student must have their physical QR tag on their person during an emergency.
*   **Admin-Mediated Data**: Students cannot update profiles directly. All data updates are entered by Clinic Admins based on physical consent forms.

---

## Core Features

### 1. Authentication & Access Control
*   **Identify all users**:
    *   **Admins (Clinic Staff)**: Full access to create/update student files, print tags, add staff, manage responders, view the immutable audit trail, and trigger session kill switches. Excluded from the mobile scanner UI.
    *   **Responders (CRCY)**: Access restricted to the mobile scanner UI and updating personal profile contact details. Can only query student profile records after scanning a valid, verified QR tag.
    *   **Students (Data Subjects)**: Opt-in data owners. They do not log in. They receive email receipts containing medical summaries and a one-click deactivation link to withdraw consent instantly.

### 2. Multi-Factor Authentication (MFA)
*   **Implement MFA Identify it**:
    *   Both Clinic Admins and Responders log in via their registered EVSU institutional email address and a 6-digit numeric One-Time Password (OTP) sent to their email (no SMS).
    *   Admins require re-authentication after an 8-hour shift, while responder mobile JWT sessions are kept active for 30 days to guarantee immediate emergency scanning.

### 3. Data Security
*   **Encryption**: 
    *   *In-Transit*: All client-server communication is forced over secure TLS/HTTPS configurations in production to safeguard sensitive medical files from Man-in-the-Middle (MitM) eavesdropping on campus Wi-Fi.
    *   *At-Rest*: User passwords and MFA OTP codes are strongly secured using `bcrypt` and `SHA-256` hashing. Column-level encryption (AES-256 via `pgcrypto`) for sensitive medical fields is supported as an optional production-hardening migration for PostgreSQL (SQLite stores development columns in plain-text). Physical QR tags store signed UUID tokens instead of raw plain-text medical records.

### 4. Web & URL Protection
*   **Input validation (prevent SQL injection/XSS)**: Input validation is enforced on all text and Pydantic schemas. Query parameters are bound securely using SQLite/PostgreSQL parameters to block SQL injection and XSS.
*   **Block unauthorized page access**: Unauthenticated users attempting to access dashboard URLs are automatically redirected to `login.html`. Responders attempting to access administrative API endpoints receive a `403 Forbidden` error.

### 5. API Security
*   **At least 1 API endpoint**: `GET /api/v1/scan-tag/{qr_token}` (Used by the Responder App to retrieve medical files).
*   **Must require API key or token**: The endpoint strictly demands a valid JSON Web Token (JWT) passed in the `Authorization: Bearer <token>` header, confirming the request originates from an active responder.

### 6. Logging
*   **Track login attempts and unauthorized access**: The database maintains a tamper-evident Immutable Audit Log protected by a database trigger blocking `UPDATE` and `DELETE` queries.
*   It records:
    *   Admin and Responder login attempts (Success/Failure, Timestamp, and Client IP).
    *   Every QR scan executed (Timestamp, Responder ID, Scanned Token UUID).
    *   Unauthorized API requests, session kill switches, and student record creations, updates, or archivals.

---

## System Requirement

*   **Working system (web/app)**: Admin Web Portal (HTML/CSS/JS served by FastAPI) and Responder Android App (React Native).
*   **Database integration**: SQLite (Local development/sandbox testing) and PostgreSQL (Production) storing users, audit trails, and student profiles.
*   **User roles implemented**: Admin, Responder, Student (Data Subject).

---

## Deliverables

*   **Functional system**: A fully deployable web dashboard (integrated with backend) and the React Native Android APK.
*   **Documentation (security features + threats)**: This finalized, template-compliant PRD detailing security mitigations, architecture configurations, and implementation parameters.
*   **Demo (login, MFA, access control, API security)**: A complete presentation showing an Admin creating a student record, generating the QR tag, a Responder logging in via OTP, scanning the QR tag securely to view medical directives, and the immutable audit logs updating in real time.

---

## Success Criteria

*   **System is functional and secure**: The system is fully operational end-to-end, protecting sensitive student data.
*   **Unauthorized access is prevented**: Standard commercial QR scanners fail to read the medical data, which requires a valid JWT session to query.
*   **Data is protected**: Multi-factor authentication is functional, data transit uses TLS, and sessions can be revoked remotely by admins.
*   **API is secured**: API endpoints verify cryptographic HMAC-SHA256 signatures on scanned tokens and reject requests missing valid JWT authorizations.
