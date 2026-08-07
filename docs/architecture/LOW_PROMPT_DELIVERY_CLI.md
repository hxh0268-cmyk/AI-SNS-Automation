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

## Entry Points

```bash
./scripts/dg <mode> [options]          # short entry point (recommended)
./scripts/delivery_gate.sh <mode> [options]  # full path
```

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

## Failure Recovery

If any step fails:
1. Do **not** reset, amend, force-push, or delete backup
2. Report exact state (HEAD, stash list, worktree list, staged state)
3. Identify the failed step from exit code and log output
4. Address root cause before retrying
5. The stash is retained; apply it to the original worktree if needed

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
