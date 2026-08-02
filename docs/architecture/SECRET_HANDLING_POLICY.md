# Secret Handling Policy

**Document type:** P2A Secret Handling Policy
**Lifecycle:** P2A — Boundary Specifications **Complete** / IR **A.GO**; lifecycle closure **In Progress**（versionless; **Not Assigned**）
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md), [ERROR_REDACTION_MODEL.md](./ERROR_REDACTION_MODEL.md)

---

## 1. Purpose

Define how secret material and secret references must be classified, stored, validated, redacted, and incident-handled for the Bounded Text Publishing MVP path.

This policy does **not** authorize credential creation, secret storage implementation, Real Provider, or External IO.

## 2. Classifications

### Secret value

Material that grants access or proves identity when disclosed（access tokens, refresh tokens, client secrets, raw Authorization headers, etc.）.

### Secret reference

Non-secret locator or name used to find material later（env var **name**, credential reference ID, account reference）.

### Non-secret configuration

Provider ID, environment label, endpoint **policy** ID, timeouts, enable flags（booleans）, public client IDs when classified as non-secret by future Provider contract.

## 3. Prohibited storage locations（secret values）

- Git-tracked files（including docs, fixtures, snapshots）
- Committed `.env` files（`.env` must remain untracked）
- Quality / developer / catalog reports intended for persistence
- Audit event payloads
- Domain / publication records
- Exception messages and stack fields that echo values
- CI logs（values must never be echoed）

## 4. Prohibited output surfaces（secret values）

- `console.log` / structured logs
- CLI stdout/stderr operator messages
- HTML/Markdown reports under `reports/`
- Handoff artifacts
- Test failure diffs that print env values
- Dry-run “simulated request” dumps

## 5. Safe presence-only validation

Allowed:

- “required credential reference present: yes/no”
- health-check style presence without printing values
- fail-closed codes: `CREDENTIAL_MISSING`

Forbidden:

- printing substrings of secret values
- logging “first/last N characters” of tokens（still leakage）

## 6. Safe error behavior

- Use taxonomy from [ERROR_REDACTION_MODEL.md](./ERROR_REDACTION_MODEL.md)
- Operator messages are safe and non-secret
- Technical detail is redacted; redaction failure → **fail closed**

## 7. Redaction requirements

Before any log, report, audit, or exception serialization, scrub at least:

- Authorization header
- access / refresh tokens
- client secrets
- cookies
- signed URLs
- request signatures
- secret query values
- sensitive bodies
- environment variable **values**

## 8. Local development policy

- Use untracked local env for values
- Commit only empty placeholders in `.env.example`（names only）
- Never paste real tokens into issues, docs, or chat
- Dry-run must remain usable without resolving secrets

## 9. CI policy

- Secrets via CI secret store only
- Workflows inject by name; do not echo
- Test jobs must not require production credentials
- Nightly/apply patterns remain presence-oriented where already established

## 10. Production policy

- Deferred beyond P2A
- When later authorized: least privilege, rotation, revocation, environment binding
- Cloud secret manager implementation remains Non-Goal until separately authorized

## 11. Test credential separation

- Tests use fixtures / mocks / empty placeholders
- Production credentials must never be required for unit/quality pipeline green
- Mock providers remain `credentialRequirement: false` unless a future ADR changes that

## 12. Rotation and revocation

- Documented in [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md)
- Audit reference IDs only
- Local disable / kill-switch must work without Provider credentials

## 13. Incident response（accidental exposure）

If a secret value is suspected in Git, logs, reports, or chat:

1. Do **not** repeat the value in further messages
2. Rotate / revoke the credential at the Provider or store
3. Remove from history only via separately authorized incident process（not casual force-push in normal governance）
4. Record a redacted incident note（no value）
5. Treat as blocking for any IO enablement milestone

## 14. Accidental exposure procedure（operators）

1. Stop using the exposed credential
2. Revoke / rotate
3. Confirm kill-switch / real-publish remains OFF
4. Scan for further exposure（redacted findings only）
5. Resume only after rotation confirmed

## 15. Permitted placeholders（examples）

Safe examples for docs/fixtures:

- env **names**: `INSTAGRAM_TOKEN`（name only）
- empty assignment in `.env.example`
- strings like `<redacted>`, `${CREDENTIAL_REF_ID}`, `credential-ref:example`

## 16. Forbidden values（examples of patterns — do not insert real secrets）

Forbidden to commit or document as live material:

- Bearer token strings
- Long random hex/base64 blobs presented as “example tokens”
- Client secrets with real entropy from a live app
- Full Authorization headers

## 17. Explicit non-goals

- Implementing redaction utilities in P2A（spec only）
- Creating credentials
- Authorizing External IO or Real Provider

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Complete** — P2A Boundary Specifications（IR **A.GO**）; lifecycle closure **In Progress**（versionless） |
| Real Provider / External IO | **Prohibited** |
| Version | **Not Assigned** |
