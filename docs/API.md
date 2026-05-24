# TrustCert API Documentation

Base URL: `http://localhost:4000`

## Authentication

### POST `/api/auth/login`
```json
{ "email": "admin@msu.edu", "password": "Admin@123" }
```
Response: `{ "token": "...", "user": { ... } }`

### GET `/api/auth/me`
Header: `Authorization: Bearer <token>`

---

## Certificates

### POST `/api/certificates/prepare-issue` (auth: UNIVERSITY_ADMIN)
Multipart form: `certificateId`, `studentName`, `studentId`, `degree`, `department`, `issueDate`, `walletAddress`, optional `certificateFile`

Returns IPFS CID, hash, and contract encoding for MetaMask transaction.

### POST `/api/certificates/confirm` (auth)
```json
{
  "certificateId": "CERT-MSU-2024-001",
  "txHash": "0x...",
  "action": "ISSUE|REVOKE|REPLACE",
  "metadata": { ... }
}
```
Waits for on-chain confirmation before updating PostgreSQL.

### GET `/api/certificates/verify/:certificateId` (public)
Returns combined blockchain + database verification result, QR code data, history timeline.

### GET `/api/certificates` (auth)
List certificates for admin's university.

### GET `/api/certificates/:certificateId` (auth)
Certificate detail with history and transactions.

### POST `/api/certificates/prepare-revoke` (auth)
### POST `/api/certificates/prepare-replace` (auth)

---

## Universities

### GET `/api/universities` (auth)
### POST `/api/universities` (SUPER_ADMIN)
### POST `/api/universities/confirm-registration` (SUPER_ADMIN)

---

## Analytics & Metrics

### GET `/api/analytics/dashboard` (auth)
### GET `/api/metrics` (auth)
### POST `/api/metrics/export` (SUPER_ADMIN) — exports JSON/CSV to `docs/metrics/`

---

## Health

### GET `/health`
