# Low-Prompt Delivery CLI — Operating Model

## Purpose

Reduce the number of Claude Code permission prompts while preserving full safety by
consolidating all delivery operations into a small set of auditable, fixed-path CLI calls.

Each call is:
- One command, one purpose
- Bounded by a machine-readable manifest or plan
- Auditable before execution (--dry-run)
- Explicit about mutations (--execute required for Class L/N)

---

## Four Quality Gates

All four must pass for any delivery to be declared A.GO:

| Gate | Command | Criteria |
|---|---|---|
| Quality | `./scripts/test_quality_pipeline.sh` | Exit 0, 1232+ PASS, 0 FAIL |
| Catalog | `npm run public-contract:catalog` | Exit 0 |
| CAS | `git update-ref -m ... NEW OLD` | Atomic; remote must not have advanced |
| Low Prompt | Representative workflow ≤ 4 mutation approvals | No safety regressions |

---

## State Machine

The delivery lifecycle transitions:

```
[prepared]      working tree has intended changes; nothing staged
      ↓  dg stage --execute                           [L]
[staged]        allowlist files in index; extra dirty allowed
      ↓  dg verify                                    [R]
[verified]      all gates pass; staged scope confirmed
      ↓  dg commit --execute                          [L]
[committed]     HEAD = NEW_COMMIT; staged empty; origin at OLD_HEAD
      ↓  dg publish --execute                         [N]
[published]     HEAD = origin/main = NEW_COMMIT; divergence 0:0
```

Separation sub-states:
```
[prepared]     →  dg separate --execute  →  [separated]
[separated]    →  dg restore --execute   →  [restored]
[restored]     →  manual stash drop      →  [clean]
```

Each command defines valid entry states:

| Command | Valid Entry State | Resulting State |
|---|---|---|
| `dg stage` | prepared | staged |
| `dg verify` | staged or prepared | verified (read-only, no state change) |
| `dg commit` | staged + verified | committed |
| `dg publish` | committed | published |
| `dg full` | prepared | published |
| `dg separate` | prepared (source worktree) | separated |
| `dg restore` | separated (stash exists) | restored |

---

## Entry Points

```bash
./scripts/dg <mode> [options]          # short entry point (recommended)
./scripts/delivery_gate.sh <mode> [options]  # full path
```

---

## Canonical Delivery Workflow

```bash
# 1. Stage (Class L — one mutation approval)
./scripts/dg stage --manifest config/delivery/my_manifest.json --execute

# 2. Verify (Class R — zero approvals)
./scripts/dg verify --manifest config/delivery/my_manifest.json

# 3. Commit (Class L — one mutation approval)
./scripts/dg commit --manifest config/delivery/my_manifest.json --execute

# 4. Publish (Class N — one mutation approval)
./scripts/dg publish --manifest config/delivery/my_manifest.json --execute
```

Total mutation approvals: **3** (stage, commit, publish)
Total read-only approvals: **0** (verify is Class R)

---

## Safety Classes

### Class R — Read Only

Modes: `help`, `verify`, `prepare`, `report`

- No `--execute` required
- `--dry-run` has no effect (no mutations possible)
- No Git ref, index, remote, stash, or worktree mutations

### Class L — Local Mutation

Modes: `commit`, `separate`

- **Requires `--execute` to apply mutations**
- Without `--execute` or `--dry-run`: execution plan displayed, exit 0, **no mutations**
- `--dry-run`: explicit preview, no mutations
- `--execute`: bounded, manifest/plan-authorized mutations only

Mutations: staged files → commit-tree + CAS; scoped stash; branch/worktree creation; stash apply

### Class N — Network Mutation

Modes: `publish` (includes Class L commit + push)

- **Requires `--execute` to push**
- Same `--dry-run` / `--execute` model as Class L
- Constraints: main-only push, no force, tag_policy=none, remote CAS verified, post-push verify required

---

## Confirmation-minimization Model

| Scenario | Operator action | Mutations |
|---|---|---|
| Preview any mode | `./scripts/dg <mode> --manifest <f>` | None |
| Explicit preview | `./scripts/dg <mode> --manifest <f> --dry-run` | None |
| Apply mutations | `./scripts/dg <mode> --manifest <f> --execute` | Bounded, auditable |

**One confirmation point per bounded operation.** The operator approves a single `./scripts/dg`
call. Claude Code generates no dynamic shell, no complex pipelines.

---

## Claude Code Responsibility

Claude Code's role is to:

1. Run `./scripts/dg <mode> --manifest <f>` (read-only) to verify state
2. Present the execution plan to the operator
3. Run `./scripts/dg <mode> --manifest <f> --execute` with explicit operator approval
4. Run post-operation read-only verification

Claude Code does **not**:
- Build dynamic shell commands for delivery operations
- Use `while`, `eval`, `xargs`, or complex pipelines for delivery
- Use `$(...)` in redirect targets
- Run mutations without operator confirmation
- Combine multiple state changes in one Bash call

---

## Human / Manual Review Responsibility

The following **always** require human review before execution:

| Action | Why |
|---|---|
| `--execute` for commit | Creates immutable git object |
| `--execute` for publish | Mutates remote origin |
| `--execute` for separate | Creates branch, worktree, stash |
| Stash drop after separation | Irreversible if no backup |
| File deletion | Irreversible without backup |
| Backup deletion | Irreversible |
| Destructive migration | Data loss risk |
| Provider Authorization | Governance phase required |
| Endpoint Approval | Governance phase required |
| Credential handling | Security boundary |
| External IO enablement | Governance phase required |
| Production enablement | Separate authorization required |

---

## Manifest (Delivery Mode)

Manifests drive `verify`, `prepare`, `commit`, `publish`, `full`, `report` modes.

Required fields: `schema_version`, `change_id`, `commit_subject`, `allowed_paths`,
`expected_file_count`

Schema: `config/delivery/manifest_schema.json`

Key safety properties:
- `allowed_paths`: exhaustive enumeration, no wildcards
- `expected_file_count`: must equal `allowed_paths` length
- `force_push`: always `"prohibited"` (const)
- `tag_policy`: default `"none"`
- `commit_subject`: single-line, no trailers

---

## Separation Plan (Workstream Separation)

Plans drive the `separate` mode.

```json
{
  "schema_version": "1.0",
  "operation_id": "carousel-sep-2026-08",
  "source_worktree": "/absolute/path/to/main",
  "destination_worktree": "/absolute/path/to/new-worktree",
  "destination_branch": "work/feature-name",
  "expected_head": "<sha>",
  "expected_origin": "<sha>",
  "exact_paths": ["path/to/file1", "path/to/file2"],
  "expected_path_count": 2,
  "stash_message": "transfer: description",
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true
}
```

Safe defaults (must be explicit):
- `commit_allowed`: `false`
- `push_allowed`: `false`
- `drop_stash_after_verified_restore`: `false` — stash is retained; drop requires manual verification
- `required_hash_match`: `true`
- `preserve_existing_backup`: `true`

Schema: `config/delivery/separation_plan_schema.json`

---

## Stash Retention Policy

- Transfer stash is **retained by default** after `dg separate --execute`
- The stash SHA is logged in the output
- The operator must verify the restoration (SHA-256 comparison) independently
- Only after exact hash equality is proven should `git stash drop <selector>` be run
- `drop_stash_after_verified_restore: true` in the plan enables automatic drop after verification

---

## Backup Retention Policy

- `preserve_existing_backup: true` (default) prevents overwriting or deleting existing backups
- External backup directory and tar/hash manifests are never modified by `dg`
- The operator is responsible for creating and maintaining external backups before separation

---

## Worktree Policy

- Dedicated worktrees are created at absolute paths specified in the separation plan
- The destination path must not exist before `dg separate --execute`
- The destination branch must not exist before `dg separate --execute`
- Worktrees are never automatically deleted by `dg`

---

## Fixed-path and Shell Safety

Inside `delivery_gate.sh` and `delivery_gate_lib.sh`:

- Repository root verified with `realpath`-equivalent at startup
- All paths from manifests and plans validated before use:
  - No absolute paths in `exact_paths`
  - No path traversal (`../`)
  - No newline characters in paths
- No `eval`
- No untrusted command construction
- No `sh -c` with user data
- No `$(...)` in redirect targets
- Node.js used for JSON parsing (deterministic, injection-safe)
- Reports written to fixed `reports/delivery-gate/latest/` or specified `--report-dir`

---

## Example Operator Workflow

```bash
# 1. Verify state (Class R — no confirmation needed)
./scripts/dg verify --manifest config/delivery/my_manifest.json

# 2. Preview commit (Class L — no mutations)
./scripts/dg commit --manifest config/delivery/my_manifest.json --dry-run

# 3. Apply commit (Class L — one confirmation point)
./scripts/dg commit --manifest config/delivery/my_manifest.json --execute

# 4. Preview publish (Class N — no mutations)
./scripts/dg publish --manifest config/delivery/my_manifest.json --dry-run

# 5. Apply publish (Class N — one confirmation point)
./scripts/dg publish --manifest config/delivery/my_manifest.json --execute

# 6. Separate a workstream (Class L — one confirmation point)
./scripts/dg separate --plan config/delivery/my_separation_plan.json --execute
```

---

## Publish Lifecycle Model

`dg publish` is designed for **post-commit publishing**. After `dg commit --execute`, the ref has moved. The manifest's `expected_base_commit` is now the pre-commit HEAD. `dg publish` handles this by accepting HEAD one commit ahead of `expected_base_commit`.

Lifecycle fields in manifest:
- `expected_base_commit`: HEAD SHA before staging (pre-commit state)
- `expected_remote_base`: origin/main SHA before push (defaults to `expected_base_commit`)

`dg publish` verifications:
1. Branch = main
2. HEAD is at `expected_base_commit` (pre-commit combined) OR HEAD^ = `expected_base_commit` (post-commit)
3. Index is clean (nothing staged)
4. Divergence = 0 N (local is ahead)
5. No tag at HEAD
6. `origin/main == expected_remote_base`
7. Post-push: HEAD == origin/main, divergence 0:0

---

## Restore Behavior

`dg restore` reverses a separation operation using a restoration record generated by `dg separate --execute`.

Valid entry states:
- Transfer stash exists and SHA matches record
- Destination worktree exists and has no conflicts

Behavior:
- `--dry-run`: shows what would be applied, no mutation
- `--execute`: applies stash to destination worktree; reports path count; leaves stash intact

The stash is **never automatically dropped**. Operator must verify hash equality independently, then drop with explicit `git stash drop <sha>`.

Failure behavior:
- If stash object not found: exit DG_E_MANIFEST (stash was likely dropped prematurely)
- If stash not in stash list: exit DG_E_MANIFEST (stash was dropped without verification)
- If conflicts: exit DG_E_ALLOWLIST (stash preserved; investigate conflicts)
- If destination worktree missing: exit DG_E_REPO (stash preserved; recreate worktree first)

---

## Stash Lifecycle

```
dg separate --execute
  → transfer stash created (SHA logged)
  → restoration record written (reports/delivery-gate/separation/)
  → stash applied to destination worktree
  → stash RETAINED

dg restore --execute (using restoration record)
  → stash SHA verified
  → stash applied to destination worktree
  → path count verified
  → stash RETAINED (verification is caller's responsibility)

Human verification:
  → SHA-256 hash comparison: shasum -a 256 <restored-files> vs pre-separation manifest
  → If exact match: git stash drop <sha> (explicit, approved)
  → If mismatch: investigate; do NOT drop stash
```

---

## Separation Integrity

`dg verify` checks separation topology as part of standard verification:
- Lists all registered worktrees
- Reports each worktree's branch, HEAD, and dirty path count
- Warns if a worktree directory is missing (stale registration)

Content workstreams (e.g., Carousel / Instagram) must remain isolated in their dedicated worktrees. `dg publish` and `dg commit` only affect what is staged. Extra dirty files in the main working tree do not contaminate the commit.

---

## Failure Recovery

If any step fails, the error output answers:

1. **What failed?** — command and exit code
2. **Why?** — specific mismatch or precondition failure
3. **Was anything mutated?** — stated in output (CAS is atomic; push is atomic)
4. **Is data safe?** — stash retained unless explicitly dropped; backup retained
5. **What next?** — check the failed assertion; fix root cause; retry

Rules:
- Do **not** reset, amend, force-push, or delete backup
- Do **not** drop stash before verification
- Identify the failed step from exit code and log output
- CAS failure = remote moved; fetch and re-plan before retrying
- Push failure = network error or remote drift; do not retry with force

---

## Low Prompt Acceptance Criteria (P3)

Low Prompt PASS requires ALL of:

A. Representative delivery workflow ≤ 4 operator commands (stage, verify, commit, publish)
B. Routine read-only checks: 0 mutation approvals (Class R)
C. No safety regression:
   - CAS preserved
   - Allowlist enforced
   - Force push prohibited
   - No accidental cross-worktree mutation
D. Normal workflow simplicity: `dg stage → dg verify → dg commit → dg publish`
E. Recovery: actionable diagnostic output; stash and backup preserved on failure

Low Prompt PASS requires BOTH **Normal Operational Budget PASS** and **Recovery Budget PASS**.
A normal-path improvement does not qualify if recovery becomes harder, more approval-heavy, or less safe.

---

## Approval Budget — Measured Evidence

### Definitions

| Term | Definition |
|---|---|
| Operator command | Top-level command issued by the operator (one `dg <mode>` call or one raw `git` call) |
| Mutation approval | Approval dialog for a command that changes repo / index / remote state (1 Bash call = 1 approval) |
| Read-only approval | Approval for a read-only command (zero when environment allows narrowly scoped allowlist) |

### A. Baseline (Before `dg` CLI) — Stage A, 11 files

Measured from session history: manual `git add`, `git write-tree`, `git commit-tree`, `git update-ref`, `git push`, plus stash operations.

| Phase | Operator commands | Mutation approvals | Read-only approvals |
|---|---|---|---|
| Pre-stage verification | 11 | 0 | 11 |
| Staging (11 files, 1 Bash block) | 1 | 1 | 0 |
| commit-tree + CAS | 9 | 2 | 7 |
| Reverification | 7 | 0 | 7 |
| Quality + Catalog | 3 | 0 | 3 |
| Push + post-verify | 5 | 1 | 4 |
| Stash apply + drop | 5 | 2 | 3 |
| **Total** | **41** | **6** | **35** |

Total approvals (Baseline): **41** — Mutation: 6 (manual), Read-only: 35

### B. After — `dg` CLI, multi-workstream (carousel dirty state)

Measured from f11d86b Refinement commit session (6 files staged, carousel dirty).

| Step | Command | Approvals |
|---|---|---|
| Temp stash carousel (33 paths) | `git stash push -- [33 paths]` | **1** (mutation) |
| Stage 6 files | `dg stage --execute` | **1** (mutation) |
| Verify (Class R) | `dg verify` | **0** |
| Commit | `dg commit --execute` | **1** (mutation) |
| Publish | `dg publish --execute` | **1** (mutation) |
| Restore carousel | `git stash apply <sha>` | **1** (mutation) |
| Drop temp stash (after verification) | `git stash drop stash@{0}` | **1** (mutation) |
| **Total** | | **6 mutation, 0 read-only** |

Total approvals (After, multi-workstream): **6**

### C. Target — `dg` CLI, carousel separated to dedicated worktree

After Carousel/Instagram work is separated to `work/carousel-instagram-assets` worktree, carousel stash operations are eliminated from the main delivery workflow.

| Step | Command | Approvals |
|---|---|---|
| Stage | `dg stage --execute` | **1** (mutation) |
| Verify (Class R) | `dg verify` | **0** |
| Commit | `dg commit --execute` | **1** (mutation) |
| Publish | `dg publish --execute` | **1** (mutation) |
| **Total** | | **3 mutation, 0 read-only** |

Target total: **3 mutation approvals** — matches "≤ 4 operator commands" acceptance criterion.

### Approval Budget Summary

| Scenario | Mutation approvals | Read-only approvals | Total |
|---|---|---|---|
| Before (Stage A, manual git) | 6 | 35 | **41** |
| After (dg CLI, carousel dirty) | 6 | 0 | **6** |
| Target (dg CLI, carousel separated) | 3 | 0 | **3** |

**Normal Operational Budget: PASS** (3 mutation approvals for standard delivery; 0 read-only; ≤ 4 operator commands)

---

## Recovery Budget — Measured Evidence

Recovery Budget measures the operator cost to recover from supported failure states.
A recovery is measured from the point of failure to a safe, verified repository state.

### Recovery Scenario 1 — Failed `dg stage --execute` (partial staging)

**Trigger:** `git add` fails mid-operation (e.g., filesystem error, file locked).

**Automatic behavior (implemented):**
- `dg_stage_exact` catches failure and runs `git reset HEAD -- <allowlist>`
- Index restored to pre-stage state
- Exits `DG_E_ALLOWLIST`

**Operator actions required:**
| Step | Command | Approval |
|---|---|---|
| Investigate failure | `dg verify` (Class R) | 0 |
| Retry stage | `dg stage --execute` | **1** |

Recovery mutation approvals: **1** — Data loss: **0** — Index preserved by auto-rollback.

### Recovery Scenario 2 — Failed `dg commit --execute` (CAS conflict)

**Trigger:** `git update-ref` CAS fails because origin/main advanced concurrently.

**Behavior:** Exits `DG_E_CAS`. No commit created. No ref updated. Index unchanged.

**Operator actions required:**
| Step | Command | Approval |
|---|---|---|
| Fetch remote state | `git fetch origin main` | **1** (mutation) |
| Re-plan (update manifest `expected_base_commit`) | Edit manifest | 0 |
| Retry commit | `dg commit --execute` | **1** (mutation) |

Recovery mutation approvals: **2** — Data loss: **0** — Stash preserved, index preserved.

### Recovery Scenario 3 — Failed `dg publish --execute` (push rejected)

**Trigger:** Remote push rejected (remote drift, non-fast-forward).

**Behavior:** Exits `DG_E_PUSH`. No force retry. Remote unchanged. Local HEAD at new commit.

**Operator actions required:**
| Step | Command | Approval |
|---|---|---|
| Verify local state | `dg verify` (Class R) | 0 |
| Investigate remote | `git fetch origin main` | **1** (mutation) |
| Retry publish if divergence resolved | `dg publish --execute` | **1** (mutation) |

Recovery mutation approvals: **2** — Data loss: **0** — Local commit preserved; stash preserved.

### Recovery Scenario 4 — Failed `dg separate --execute` (separation aborted)

**Trigger:** Destination branch or path already exists; or HEAD mismatch.

**Behavior:** Exits before stash is created. No stash, no branch, no worktree created.

**Operator actions required:**
| Step | Command | Approval |
|---|---|---|
| Verify state | `dg verify` (Class R) | 0 |
| Fix plan (update `expected_head`, or remove stale worktree) | Edit plan / `git worktree remove` | **1** (mutation) |
| Retry separate | `dg separate --execute` | **1** (mutation) |

Recovery mutation approvals: **2** — Data loss: **0**.

### Recovery Budget Summary

| Scenario | Recovery mutation approvals | Data Loss | Stash preserved |
|---|---|---|---|
| Failed stage (partial) | **1** | 0 | N/A |
| Failed commit (CAS conflict) | **2** | 0 | Yes |
| Failed publish (push rejected) | **2** | 0 | Yes |
| Failed separate (plan mismatch) | **2** | 0 | N/A (not created) |

**Recovery Budget: PASS** — All supported failure states recover deterministically with ≤ 2 mutation approvals. Data loss = 0 in all measured scenarios. No manual `git reset --hard`, force-push, or stash drop required for recovery.

---

## Governance Verification

Delivery Gate enforces:

| Control | Value |
|---|---|
| Provider Authorization | None |
| Endpoint Approval | No |
| Real Provider | Prohibited |
| External IO | Prohibited |
| Automatic Publishing | Prohibited |
| Force Push | Prohibited |
| Tag Policy | none (no tag created) |
| Stage B | Not started |
