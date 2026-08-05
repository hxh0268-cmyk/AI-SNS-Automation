# TEXT_POST_SLICE — X Text-only MVP Stage A

- **Stage:** A (Fake Provider Dry-run Slice)
- **Status:** Implementation Complete (uncommitted until Commit and Publish Execution)
- **Manifest:** [config/delivery/x_text_only_stage_a_manifest.json](../../config/delivery/x_text_only_stage_a_manifest.json)

## Purpose

Provide an offline, provider-neutral text-post publishing slice for Branch A (text-only MVP) using a **fake X text provider** only.

This slice proves:

- Content validation and deterministic normalization
- Manual approval binding (actor, timestamp, content digest)
- Kill-switch gating
- In-memory idempotency and duplicate prevention
- Typed results / errors and audit events
- No-network guard

It does **not** authorize Real Provider, External IO, OAuth, credentials, endpoints, Catalog registration, or automatic publishing.

## Flow

```
Content Draft
  → Validation
  → Manual Approval
  → Publish Request
  → Kill-switch Check
  → Idempotency Check
  → Fake X Text Provider
  → Dry-run Result
  → Audit Events
```

## Success states (Stage A)

Allowed:

- `dry_run_succeeded`
- `simulated_success` (result field)
- `accepted_by_fake_provider` (result field)

**Not allowed:** `published` / live publication statuses.

## Modules

| Path | Role |
| ---- | ---- |
| `src/lib/text_post_content.js` | Normalize / validate / content digest |
| `src/lib/text_post_lifecycle.js` | Lifecycle states + typed errors |
| `src/lib/text_post_audit.js` | Audit event types + in-memory sink |
| `src/lib/text_post_idempotency.js` | In-memory idempotency / duplicate store |
| `src/lib/text_post_kill_switch.js` | Kill switch + NoNetworkGuard |
| `src/lib/x_text_post_mock_provider.js` | Fake X text provider (`invokeMockTextPost`) |
| `src/lib/text_post_service.js` | Orchestrator + `FakeXTextPostProvider` boundary |
| `scripts/test_text_post_slice.sh` | Offline Stage A tests |
| `scripts/test_quality_pipeline.sh` | TP-AUX hook (non-numbered; Test 1233 absent) |

## Governance freeze

| Item | State |
| ---- | ----- |
| Recommended Provider | X (Conditional Recommendation) |
| Authorized Provider | **None** |
| Endpoint Approval | **No** |
| Real Provider | **Prohibited** |
| External IO | **Prohibited** |
| Automatic Publishing | **Prohibited** |
| Catalog registration of mock | **Not in Stage A** |
| Version assignment | **None** |

## Explicit non-goals (Stage A)

- X API / `POST /2/tweets`
- HTTP / DNS / sockets
- OAuth / tokens / credentials
- Real Provider adapter
- Scheduler / queue / DB
- Image / video / poll / reply / quote / repost / DM
- Threads / Instagram
- Autonomous approval or publishing

## Tests

Run offline:

```bash
bash scripts/test_text_post_slice.sh
```

Quality pipeline invokes the same suite as **TP-AUX** after the numbered **1232 PASS** line (does not add Test 1233).

## Delivery

```bash
./scripts/delivery_gate.sh verify --manifest config/delivery/x_text_only_stage_a_manifest.json
./scripts/delivery_gate.sh full --dry-run --manifest config/delivery/x_text_only_stage_a_manifest.json
```

### Known delivery-gate Minor (foundation)

`verify` requires **exact equality** between dirty paths and `allowed_paths`. A **clean tree** with a non-empty Stage A allowlist fails allowlist/file-count checks. `DG_E_DIRTY` is documented but not emitted as a distinct preflight. This is an Accelerated Delivery foundation semantic Minor; Stage A implementation is unaffected while the working tree matches the 11-path allowlist exactly. Post-commit re-verify needs an emptied allowlist or a deferred foundation fix — not a product authorization change.
