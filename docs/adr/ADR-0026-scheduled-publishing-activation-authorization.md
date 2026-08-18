# ADR-0026: Scheduled Publishing Activation Authorization

## Status

Accepted（X4 — Scheduled Publishing Activation Governance;
versionless governance; implementation authorized）

## Context

### Prior authorization chain

| Document | Role |
|----------|------|
| [X0_PROTOTYPE_PLANNING.md](../architecture/X0_PROTOTYPE_PLANNING.md) | X0 Planning Complete; Real IO Authorization; Scheduler design (§15) |
| [ADR-0025](./ADR-0025-x-real-provider-implementation-authorization.md) | X1 Real Provider Adapter authorization |
| X2 smoke test | First real X post confirmed; xPostId recorded |
| X3-A–X3-D | Scheduler trigger; idempotency; failure handling; all tests PASS |
| **This ADR** | **X4 Scheduled Publishing Activation formal authorization** |

X3-A through X3-D established:

1. `scripts/run_x_daily.sh` — grace window (08:08–08:38 JST), activation guards, JST date authority
2. `src/lib/daily_publish_job.js` — idempotency (published/quarantine/block), crash guard, content load
3. `config/com.aisns.daily.plist` — launchd local scheduler at 08:08 JST
4. All failure/missed-run/restart scenarios tested (X3-D: 30 checks PASS)

This ADR authorizes:
- **X4-A**: `SCHEDULED_PUBLISH_ENABLED=true` gate as the Human Approval Gate for Stage 1
- **X4-B**: GitHub Actions scheduler (`.github/workflows/x_daily_post.yml`)

---

## 1. Decision

### 1.1 Authorization granted by this ADR

| Item | Decision |
|------|----------|
| GitHub Actions scheduler implementation | **AUTHORIZED** (cron `8 23 * * *` = 08:08 JST) |
| `SCHEDULED_PUBLISH_ENABLED=true` as Human Approval Gate | **AUTHORIZED** (Stage 1 scope; see §4) |
| Stage 1 content pre-approval model | **AUTHORIZED** (see §4) |
| workflow_dispatch manual trigger with dry_run / skip_time_check inputs | **AUTHORIZED** |
| GitHub Secrets for X credentials + activation flags | **AUTHORIZED** (values never committed) |

### 1.2 What remains prohibited

| Item | Status |
|------|--------|
| Any X API endpoint except `POST /2/tweets` | **PROHIBITED** |
| Credential values in any committed file | **PROHIBITED** |
| Automatic approval (no human actor) | **PROHIBITED** for Stage 2 dynamic content |
| `SCHEDULED_PUBLISH_ENABLED=true` without explicit operator action | **PROHIBITED** |
| `cancel-in-progress: true` in concurrency group | **PROHIBITED** (mid-flight cancel forbidden) |
| force push | **PROHIBITED** |
| git tag (until X5 release) | **PROHIBITED** |
| P3B CLI bypass for Stage 2+ dynamic content | **PROHIBITED** without separate ADR |

---

## 2. DoD-04 Satisfaction: Stage 1 Human Approval Gate

### 2.1 Stage 1 Content Approval Model

DoD-04 requires: "Human Approval を通せる（actor / timestamp / contentDigest）"

For Stage 1 (fixed content), this is satisfied by a two-layer gate:

| Layer | Mechanism | Human Actor |
|-------|-----------|-------------|
| Content approval | `content/scheduled/daily_fixed.txt` committed to `main` | Operator who authored / reviewed the commit |
| Activation gate | `SCHEDULED_PUBLISH_ENABLED=true` set explicitly in `.env` or GitHub Secrets | Operator who enables the flag |

The content commit establishes: content identity (contentDigest derivable from the file),
implicit actor (git author), and timestamp (commit timestamp).

The `SCHEDULED_PUBLISH_ENABLED=true` flag is the explicit Human Approval Gate. Setting it
requires deliberate operator action and is audited by the activation log in `run_x_daily.sh`.

**This model is approved for Stage 1 (fixed content) only.**

### 2.2 Stage 2 Extension Requirement

When dynamic content generation (AI-generated posts) is introduced:
- A separate ADR must authorize P3B per-post approval (`text_post_approve.js` CLI)
- `actor`, `timestamp`, `contentDigest` must be explicitly recorded per post
- Automatic approval remains PROHIBITED

### 2.3 Rationale for Stage 1 Gate approach

| Rationale | Evidence |
|-----------|---------|
| Fixed content is identical every run; per-post approval is redundant | `daily_fixed.txt` deterministic |
| Commit-time approval is established practice for fixed-text deployments | git author record |
| Activation flag requires deliberate operator action | `run_x_daily.sh` BLOCKED exit if unset |
| X0 §10 explicitly allows in-memory approve() for X2 (smoke test) | X0 §10 |
| Stage 1 goal is operational verification, not full P3B integration | X0 §16 X4 DoD |

---

## 3. DoD-11 Satisfaction: GitHub Actions Scheduler

### 3.1 Scheduler implementation

| Field | Value |
|-------|-------|
| Workflow file | `.github/workflows/x_daily_post.yml` |
| Trigger (production) | `cron: "8 23 * * *"` (23:08 UTC = 08:08 JST) |
| Trigger (testing) | `workflow_dispatch` with `dry_run` and `skip_time_check` inputs |
| Grace window | 08:08–08:38 JST (30 min); implemented in `run_x_daily.sh` |
| Concurrency | `group: x-daily-post; cancel-in-progress: false` |
| Runner | `ubuntu-latest` |
| Node version | `20` |
| Entry point | `bash scripts/run_x_daily.sh` (all guards enforced) |

### 3.2 launchd and GitHub Actions relationship

| Scheduler | Scope | Status |
|-----------|-------|--------|
| `config/com.aisns.daily.plist` (launchd) | Local development / macOS | Preserved; unchanged |
| `.github/workflows/x_daily_post.yml` | Production / CI | New (this ADR) |

Both call `scripts/run_x_daily.sh`. The script handles all guards regardless of which
scheduler invokes it. launchd is retained for local development; it does not duplicate
production scheduling because production secrets are not in the local `.env`.

---

## 4. Activation Procedure

### 4.1 Local development (launchd)

```bash
# 1. Set credentials and flags in .env (gitignored)
#    X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET
#    REAL_PUBLISH_ENABLED=true
#    SCHEDULED_PUBLISH_ENABLED=true   ← Human Approval Gate: explicit operator action

# 2. Verify dry-run
bash scripts/run_x_daily.sh --simulate-scheduled

# 3. Verify real mode (outside grace window, will skip)
bash scripts/run_x_daily.sh

# 4. Load launchd agent
cp config/com.aisns.daily.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.aisns.daily.plist
```

### 4.2 GitHub Actions (production)

```text
1. Navigate to repository Settings → Secrets and variables → Actions

2. Set Secrets (never committed):
   X_API_KEY             = <consumer api key>
   X_API_SECRET          = <consumer api secret>
   X_ACCESS_TOKEN        = <access token>
   X_ACCESS_TOKEN_SECRET = <access token secret>
   REAL_PUBLISH_ENABLED  = false      ← set to "true" only after X5 DoD verification
   SCHEDULED_PUBLISH_ENABLED = false  ← Human Approval Gate; set "true" = explicit approval

3. Verify workflow appears:
   gh workflow list

4. Dry-run test via workflow_dispatch:
   gh workflow run x_daily_post.yml \
     -f dry_run=true \
     -f skip_time_check=true

5. Verify DRY_RUN_SUCCESS in Actions log

6. To activate real publishing (X5 activation step):
   Set REAL_PUBLISH_ENABLED=true AND SCHEDULED_PUBLISH_ENABLED=true in Secrets
   → This constitutes the Human Approval Gate passage for Stage 1
```

### 4.3 Kill switch (emergency disable)

```text
Immediate disable (no X credentials needed):
  → Set REAL_PUBLISH_ENABLED=false in GitHub Secrets
  → Set SCHEDULED_PUBLISH_ENABLED=false in GitHub Secrets
  → Active workflow run completes safely (cancel-in-progress=false)
  → Next scheduled run fails cleanly with BLOCKED exit
```

---

## 5. Security Invariants

| Invariant | Enforcement |
|-----------|------------|
| Credentials never in any committed file | `.gitignore` + `run_x_daily.sh` git-tracking guard |
| Credentials never echoed to logs | `set +x` before `.env` source; variable names only in logs |
| Activation flags default OFF | `REAL_PUBLISH_ENABLED:-false`, `SCHEDULED_PUBLISH_ENABLED:-false` |
| No mid-flight cancel | `cancel-in-progress: false` in concurrency group |
| Grace window prevents off-schedule execution | `run_x_daily.sh` time check |
| No dry-run → real-mode escalation without explicit flag | separate `--dry-run` arg required |

---

## 6. X4 Implementation Allowlist

### New files

```text
.github/workflows/x_daily_post.yml
docs/adr/ADR-0026-scheduled-publishing-activation-authorization.md
config/delivery/x4_impl_manifest.json
```

### Modified files

```text
scripts/test_quality_pipeline.sh   — X4 auxiliary verification section
```

### Forbidden paths (in X4 commit)

```text
.env                               — secret values
src/lib/text_post_approve.js       — Stage 2 only; not yet authorized
GitHub Secrets values              — set via GitHub UI only; never committed
Any file containing raw credential values
```

---

## 7. Rollback

```text
If X4 needs to be reverted:
  git revert <x4-commit-sha>   ← new commit reverting X4
  dg publish                   ← push revert via delivery gate

Force push: PROHIBITED
Disabling GitHub Actions only: disable the workflow in GitHub UI (no commit needed)
```

---

## 8. X5 Entry Conditions

Before activating `SCHEDULED_PUBLISH_ENABLED=true` in production (X5):

| # | Condition |
|---|-----------|
| 1 | X4 commit published to `main` (this ADR + x_daily_post.yml both in HEAD) |
| 2 | `gh workflow list` shows `x_daily_post.yml` as active |
| 3 | `workflow_dispatch` dry-run succeeds (DRY_RUN_SUCCESS in Actions log) |
| 4 | All X credentials set in GitHub Secrets (never committed) |
| 5 | Quality Pipeline tests PASS (including X4 auxiliary verification) |
| 6 | Operator explicitly sets `SCHEDULED_PUBLISH_ENABLED=true` in GitHub Secrets |
| 7 | Operator explicitly sets `REAL_PUBLISH_ENABLED=true` in GitHub Secrets |
| 8 | DoD-01–12 checklist completed |
| 9 | First automated run verified (xPostId recorded in Actions log) |

---

## 9. Governance Markers

```text
GitHub Actions scheduler: AUTHORIZED (cron 8 23 * * * = 08:08 JST)
SCHEDULED_PUBLISH_ENABLED gate: AUTHORIZED as Human Approval Gate (Stage 1)
Stage 1 content pre-approval: AUTHORIZED (daily_fixed.txt commit = content approved)
P3B per-post approval (Stage 2): NOT YET — requires separate ADR
X Real Provider:    AUTHORIZED (preserved from ADR-0025)
External IO:        AUTHORIZED (api.x.com only; kill-switch gated; preserved)
Credentials:        AUTHORIZED (OAuth 1.0a; env/Secrets only; never committed)
Automatic Publishing: PROHIBITED until SCHEDULED_PUBLISH_ENABLED=true (explicit gate)
Force push:         PROHIBITED
git tag:            PROHIBITED (until X5 release)
Version:            Not Assigned (X4 versionless)
```

---

## 10. References

- [X0_PROTOTYPE_PLANNING.md](../architecture/X0_PROTOTYPE_PLANNING.md) — §15 Scheduler Architecture, §16 Phase DoD
- [ADR-0025](./ADR-0025-x-real-provider-implementation-authorization.md) — X1 Real Provider authorization
- [EXTERNAL_IO_BOUNDARY.md](../architecture/EXTERNAL_IO_BOUNDARY.md) — External IO boundary
- [SECURITY_CREDENTIAL_BOUNDARY.md](../architecture/SECURITY_CREDENTIAL_BOUNDARY.md) — Credential boundary
- [SECRET_HANDLING_POLICY.md](../architecture/SECRET_HANDLING_POLICY.md) — Secret handling policy
- [P3_APPROVAL_RECORD_SPEC.md](../architecture/P3_APPROVAL_RECORD_SPEC.md) — Stage 2 approval record spec (future)
