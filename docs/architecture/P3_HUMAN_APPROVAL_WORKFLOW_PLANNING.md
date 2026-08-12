# P3 Human Approval Workflow Foundation — Planning

**Document type:** P3 Planning（scope definition, authorization requirements, sub-phase structure）
**Lifecycle:** P3 — **Planning In Progress**; Implementation **Not Authorized**
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [PRODUCT_MVP_BOUNDARY.md](./PRODUCT_MVP_BOUNDARY.md), [TEXT_POST_SLICE.md](./TEXT_POST_SLICE.md), [P2_THREAT_MODEL.md](./P2_THREAT_MODEL.md), [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md)

---

## 1. Purpose

P3 Human Approval Workflow Foundation は、テキスト投稿パスにおける **人間による明示的承認ゲート** を、CLI で操作可能な永続的なワークフローとして確立する。

P2B+ が確立したこと（in-memory、プログラム内部の `approve()` 呼び出し）を、**オペレーターが明示的に関与できる CLI 承認インターフェース** へと昇格させる。

この文書は **スコープ・認可要件・サブフェーズ・成功基準** を定義する。Implementation を許可しない。

---

## 2. Background

### 2.1 Roadmap position（ADR-0024）

| ID | Milestone | Status |
| -- | --------- | ------ |
| P2B+ | Local types / resolver / gateway abstractions | **Complete / Published** |
| **P3** | **Human Approval Workflow Foundation** | **Planning In Progress** |
| P4 | Real Provider Adapter（default-disabled） | Not started — Prohibited |

### 2.2 P2B+ approval implementation（current）

P2B+ の `approve()` は以下を実現している:

| 機能 | 状態 |
| ---- | ---- |
| actorId 必須チェック | ✅ Implemented |
| content digest 3-way 検証 | ✅ Implemented |
| 承認後コンテンツ変更検出 | ✅ Implemented |
| in-memory approval record | ✅ Implemented |
| Kill-switch gate | ✅ Implemented |
| **CLI 承認インターフェース** | ❌ **Not implemented** |
| **永続的 approval record** | ❌ **Not implemented — in-memory only** |
| **コンテンツ提示（オペレーター確認）** | ❌ **Not implemented** |
| **プロセス境界をまたぐ承認検証** | ❌ **Not implemented** |

---

## 3. Gap Analysis

P3 が対処するギャップ:

### G-01: Content presentation gap

`runStageADryRun()` は `actorId` をコードから受け取り、オペレーターが本文を確認する機会がない。
MVP 境界（[PRODUCT_MVP_BOUNDARY.md §4](./PRODUCT_MVP_BOUNDARY.md)）は、オペレーターが承認前に内容を確認することを前提とする。

### G-02: In-memory only

Approval record はプロセス終了と同時に消える。
実運用では `draft` → `approve` → `publish` を **別プロセス・別タイミング** で実行する。

### G-03: CLI approval interface absent

`approve` に相当するオペレーター向け CLI コマンドが存在しない。
`runStageADryRun()` はテスト用ヘルパーであり、運用 CLI ではない。

### G-04: Cross-session approval integrity

新しい CLI セッションで `publish` を実行する際、前のセッションの承認を検証する手段がない。

---

## 4. P3 Scope

### 4.1 Included

| # | Deliverable | Notes |
| - | ----------- | ----- |
| D-01 | Approval Record Specification | JSON format spec; secret values never included |
| D-02 | File-backed Approval Record Store | Reads/writes local approval JSON（`tmp/` or `.approval/`; gitignored） |
| D-03 | Content Presentation Layer | Displays `normalizedText` to operator before approval prompt |
| D-04 | `approve-text-post` CLI | Operator-facing approval command; records `actorId`, `approvedAt`, `contentDigest` |
| D-05 | Cross-session Approval Validation | `requestDryRunPublish` accepts file-backed approval; digest re-verification |
| D-06 | Approval Record Forbidden Fields | No `token`, `secret`, `credential`, etc. in approval record |
| D-07 | P3 Quality Tests | Offline tests; added to TP-AUX or numbered suite（TBD at implementation） |

### 4.2 Approval Record Format（planning sketch）

```json
{
  "schema_version": "1.0",
  "actorId": "<operator-identity>",
  "approvedAt": "<ISO-8601>",
  "correlationId": "<corr-id>",
  "contentDigest": "sha256:<hex>",
  "normalizedText": "<post-text>",
  "approvalMode": "dry_run",
  "providerId": "x-text-post-mock-provider",
  "expiresAt": null
}
```

Forbidden fields（must never appear）: `token`, `secret`, `password`, `apiKey`, `oauth`,
`accessToken`, `refreshToken`, `clientSecret`, `credential`, `bearer`, `value`.

### 4.3 CLI flow（planning sketch）

```
Step 1 — Draft + Validate（existing）
  node src/text_post_draft.js "post text"
  → outputs: content digest, normalized text, correlation ID

Step 2 — Approve（P3 new）
  node src/text_post_approve.js --digest <digest> --actor <actor-id>
  → displays normalized text to operator
  → prompts for explicit confirmation
  → writes: tmp/approval-<corr-id>.json

Step 3 — Dry-run Publish（P2B+ extended）
  node src/text_post_publish.js --approval tmp/approval-<corr-id>.json
  → reads + validates approval record
  → verifies digest match
  → executes kill-switch → idempotency → gateway → adapter
  → outputs: dry_run_succeeded
```

No network. No real Provider. No credentials. Dry-run only at P3.

---

## 5. Sub-phase Structure

```
P3-Plan   (this document)          docs-only; versionless; Not Committed
     ↓
P3A       Approval Record Spec     docs-only; formal spec; commit-eligible
     ↓
P3-ImplAuth  Implementation        human gate: Authorization Review A.GO required
             Authorization
     ↓
P3B       CLI + Store              implementation; Quality tests; commit-eligible
     ↓
P3-IR     Independent Review       read-only; A.GO required
     ↓
P3-Commit Commit / Push            versionless governance tip or MINOR bump（TBD）
```

### 5.1 P3A — Approval Record Specification（docs-only）

- Formal approval record JSON schema
- Field definitions, forbidden fields, storage location
- Expiry / invalidation rules
- Threat model mapping（T-14, T-15）
- **No code changes**
- Delivery: `docs/architecture/P3_APPROVAL_RECORD_SPEC.md` + schema artifact

### 5.2 P3-ImplAuth — Implementation Authorization

Requires **human decision** before any code is written. Entry conditions: see §8.

### 5.3 P3B — CLI Implementation

New modules:
- `src/lib/text_post_approval_record.js` — approval record validation / serialization
- `src/lib/text_post_approval_file_store.js` — file-backed read/write（`tmp/` path）
- `src/text_post_approve.js` — operator-facing CLI command
- `src/text_post_draft.js` — draft + validate CLI command（or extend existing）
- Extend `src/lib/text_post_service.js` — accept file-backed approval path
- `scripts/test_text_post_approval.sh` — offline P3 approval tests

Forbidden path additions（manifest）:
- `.env`, credential files, real Provider files

### 5.4 P3-IR — Independent Review

- Approval record spec vs implementation alignment
- Forbidden field verification
- Cross-session integrity proof
- CLI flow coverage by tests
- Threat T-14 / T-15 enforcement confirmed

### 5.5 Version / Release approach（TBD at P3-ImplAuth）

P3 は docs-only（P3A）と implementation（P3B）の 2 コミットを想定。
バージョン割り当ては P3-ImplAuth ゲートで決定。現時点では **Not Assigned**。
versionless governance tip が基本方針（後続マイルストーンでの MINOR bump も可）。

---

## 6. Authorization Requirements

### 6.1 P3A（Approval Record Spec）— docs-only

P3-Plan（本文書）完了後、直接着手可能。

Entry conditions:
- [x] P2B+ Complete / Published（`c6269918…`）
- [x] P2B+ Post-Push Record Population Complete（`cb2b3db…`）
- [x] Permission Policy Independent Review A.GO
- [x] Pre-P3 Commit Integrity Verification A.SAFE
- [ ] P3 Planning（本文書）commit / push

### 6.2 P3-ImplAuth（Implementation Authorization）

**Human approval required.** 以下をすべて確認してから implementation に進む:

| # | Condition |
| - | --------- |
| IA-01 | P3A Approval Record Spec — Independent Review A.GO |
| IA-02 | P3 scope boundary confirmed: no Real Provider, no External IO, no OAuth |
| IA-03 | Architecture Review: Layer consistency（Platform / Application / Future boundary）|
| IA-04 | ADR review: P3 scope change 相当の ADR が必要か確認（scope が Provider Layer に触れない場合 ADR 不要の可能性あり）|
| IA-05 | Compliance Checklist — Foundation Addition / Future Architecture Addition 節 PASS |
| IA-06 | Risk Review: T-14 / T-15 implementation risk accepted |
| IA-07 | Public Contract Review: 新規 public contract 追加があれば Catalog 整合 |
| IA-08 | Compatibility Review: backward compat maintained（approval store は新規 opt-in; 破壊的変更なし想定）|

---

## 7. Technical Constraints

### 7.1 Secret / credential prohibition（inherited from P2A）

Approval record must NOT contain:
- Secret values（tokens, passwords, API keys）
- OAuth material
- Credential values of any kind

Approval record MAY contain:
- `actorId`（operator identity string — not a credential）
- `contentDigest`, `normalizedText`（post content — not secret）
- `correlationId`, `approvedAt`（metadata）
- `providerId`（non-secret provider identifier）

### 7.2 Storage location

- Approval record files: `tmp/approvals/` (local, gitignored)
- Approval record files must NOT be committed to Git
- `.gitignore` must cover `tmp/` (verify / extend at P3B)

### 7.3 No real network

P3 does not add network capability. Approval workflow is entirely offline.

### 7.4 No automatic approval

```text
Automatic approval = Prohibited（PRODUCT_MVP_BOUNDARY.md §4）
```

`approve-text-post` CLI must require explicit human input（`--actor` flag at minimum）.
Piping / scripted approval without human confirmation is an implementation decision
that must be evaluated at P3-ImplAuth.

### 7.5 Kill switch remains in force

Kill switch continues to gate provider invocation in P3B.
Approval alone does not enable the kill switch.

---

## 8. Entry Conditions for P3 Implementation Authorization（IA-01 gate）

```
P3A docs-only spec committed AND Independent Review A.GO
AND
Architecture Review PASS
AND
Compliance Checklist PASS（Foundation Addition applicable sections）
AND
Human approval: P3-ImplAuth
```

---

## 9. Threat Model Coverage

| Threat | P3 coverage |
| ------ | ----------- |
| T-14: Approval bypass | CLI requires `--actor`; no approval file → `APPROVAL_REQUIRED`; file-backed record cannot be silently fabricated |
| T-15: Content changed after approval | Cross-session digest re-verification: `contentDigest` in record vs live `contentDigest(normalizedText)` at publish time |
| T-01: Secret in Git | Approval records in `tmp/` (gitignored); forbidden field validation |
| T-02: Secret logged | Approval CLI output: digest + actor only; normalized text shown to operator, not logged to structured events |
| T-16: Kill-switch bypass | Kill switch check remains before provider invocation; approval record does not enable kill switch |

---

## 10. Success Criteria

P3 is complete when:

1. Operator can present, review, and explicitly approve normalized text via CLI
2. Approval record persists in a local file and survives process boundary
3. `requestDryRunPublish` accepts file-backed approval and re-verifies digest
4. Content mutation after approval is detected and rejected（cross-session）
5. Approval record contains no secret values; forbidden field validation enforced
6. `tmp/approvals/` is gitignored; no approval files committed
7. P3 offline tests pass（TP-AUX or numbered — TBD）
8. Quality Pipeline: 1232 PASS（or higher if numbered tests added）/ 0 FAIL
9. Kill switch default-OFF maintained
10. Real Provider / External IO remain Prohibited

---

## 11. Explicit Non-Goals

| Non-goal | Reason |
| --------- | ------ |
| Real Provider（P4） | Separate authorization required |
| External IO / network | Still Prohibited |
| OAuth / credential implementation | P2C / P2D / P4 |
| Automatic approval | Explicitly prohibited（PRODUCT_MVP_BOUNDARY.md）|
| Multi-actor / multi-factor approval | Not in MVP boundary |
| Remote approval（webhook / email） | Not in MVP boundary |
| Approval UI（web / GUI） | Not in MVP boundary |
| Approval expiry enforcement | May be deferred to P5 / P6 |
| Catalog registration（Real Provider） | Not authorized |
| Version assignment | Not assigned; TBD at P3-ImplAuth |
| Production Ready declaration | Not authorized |
| Repository-wide Level 4 | Not authorized |

---

## 12. Relationship to Other Phases

```
P2B+    Structural enforcement types（Gateway / Resolver / Fake Adapter）
             ↓
P3      Human Approval Workflow Foundation（this milestone）
             ↓
P4      Real Provider Adapter（default-disabled — not authorized）
             ↓
P5      Dry-Run and Idempotency（formalized）
             ↓
P6      Controlled Publication Execution
```

P3 は P2B+ が確立した **structural enforcement** の上に **operator-facing approval UX** を積む。
P4 は P3 完了後に別認可で着手する。

---

## 13. Governance Markers

```text
P3-Plan:       In Progress（this document）
P3A-Spec:      Not Started
P3-ImplAuth:   Not Authorized
P3B-Impl:      Not Started / Not Authorized
P3-IR:         Not Started
P3-Commit:     Not Started
Version:       Not Assigned
Real Provider: Prohibited
External IO:   Prohibited
Endpoints:     Not Approved
```

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Planning In Progress** |
| Implementation | **Not Authorized** |
| Real Provider / External IO | **Prohibited** |
| Version | **Not Assigned** |
| Mutation | Requires P3-Plan governance update |
