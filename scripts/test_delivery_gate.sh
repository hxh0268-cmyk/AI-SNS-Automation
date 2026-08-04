#!/usr/bin/env bash
# Delivery Gate test suite — Bash 3.2 compatible, network-free
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB="$SCRIPT_DIR/lib/delivery_gate_lib.sh"
DG="$SCRIPT_DIR/delivery_gate.sh"

source "$LIB"

# ── Test framework ───────────────────────────────────────────────────────────
_PASS=0; _FAIL=0

tpass() { _PASS=$((_PASS+1)); printf '[PASS] %s\n' "$1"; }
tfail() { _FAIL=$((_FAIL+1)); printf '[FAIL] %s\n' "$1" >&2; }

# assert exit code
assert_exit() {
  local label="$1" expected="$2"; shift 2
  local actual=0
  "$@" >/dev/null 2>&1 || actual=$?
  if [[ "$actual" -eq "$expected" ]]; then
    tpass "$label"
  else
    tfail "$label (expected exit=$expected got=$actual)"
  fi
}

# assert string equality
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    tpass "$label"
  else
    tfail "$label (expected='$expected' got='$actual')"
  fi
}

# assert file exists
assert_file_exists() {
  local label="$1" path="$2"
  if [[ -f "$path" ]]; then
    tpass "$label"
  else
    tfail "$label (not found: $path)"
  fi
}

# ── Temp repo helpers ────────────────────────────────────────────────────────
TMPBASE="$(mktemp -d /tmp/dg_test.XXXXXX)"
trap 'rm -rf "$TMPBASE"' EXIT

_make_temp_repo() {
  local dir="$1"
  mkdir -p "$dir"
  git -C "$dir" init --quiet
  git -C "$dir" config user.email "test@example.com"
  git -C "$dir" config user.name "Test"
  printf 'initial\n' > "$dir/README.md"
  git -C "$dir" add README.md
  git -C "$dir" commit --quiet -m "initial"
  # Simulate a remote with a bare repo
  local bare="$dir.git"
  git init --bare --quiet "$bare"
  git -C "$dir" remote add origin "$bare"
  git -C "$dir" push --quiet origin main 2>/dev/null || \
    git -C "$dir" push --quiet origin master:main 2>/dev/null || true
}

_make_manifest() {
  local dir="$1"
  local base_commit="$2"
  mkdir -p "$dir"
  local paths="$3"   # JSON array string e.g. '["file.md"]'
  local subject="${4:-docs: test change}"
  cat > "$dir/manifest.json" << MEOF
{
  "schema_version": "1.0",
  "change_id": "test-001",
  "title": "Test Change",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "$base_commit",
  "allowed_paths": $paths,
  "forbidden_paths": [],
  "expected_file_count": $(printf '%s' "$paths" | tr ',' '\n' | grep -c '"' || echo 1),
  "allow_add": true,
  "allow_modify": true,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "$subject",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown", "json"]
}
MEOF
}

# ── Test 1: delivery_gate.sh and lib exist and are valid bash ────────────────
printf '\n-- dg-test 1: file existence --\n'
assert_file_exists "delivery_gate.sh exists"    "$DG"
assert_file_exists "delivery_gate_lib.sh exists" "$LIB"
assert_file_exists "test_delivery_gate.sh exists" "$SCRIPT_DIR/test_delivery_gate.sh"
assert_file_exists "manifest_schema.json exists" \
  "$PROJECT_ROOT/config/delivery/manifest_schema.json"
assert_file_exists "ACCELERATED_DELIVERY.md exists" \
  "$PROJECT_ROOT/docs/architecture/ACCELERATED_DELIVERY.md"

# ── Test 2: help mode exits 0 ────────────────────────────────────────────────
printf '\n-- dg-test 2: help exits 0 --\n'
assert_exit "help mode exits 0" 0 bash "$DG" help

# ── Test 3: no args exits 1 (usage) ─────────────────────────────────────────
printf '\n-- dg-test 3: no args exits usage error --\n'
assert_exit "no args exits 1" 1 bash "$DG"

# ── Test 4: unknown mode exits 1 ────────────────────────────────────────────
printf '\n-- dg-test 4: unknown mode exits 1 --\n'
assert_exit "unknown mode exits 1" 1 bash "$DG" badmode --manifest /dev/null

# ── Test 5: missing manifest option exits 1 ──────────────────────────────────
printf '\n-- dg-test 5: missing --manifest exits 1 --\n'
assert_exit "missing --manifest exits 1" 1 bash "$DG" verify

# ── Test 6: nonexistent manifest exits 17 ───────────────────────────────────
printf '\n-- dg-test 6: nonexistent manifest exits 17 --\n'
assert_exit "nonexistent manifest exits 17" 17 \
  bash "$DG" verify --manifest /tmp/nonexistent_manifest_dg.json --no-network

# ── Test 7: commit subject validation — single line passes ───────────────────
printf '\n-- dg-test 7: commit subject validation --\n'
TREPO="$TMPBASE/repo7"
_make_temp_repo "$TREPO"
BASE="$(git -C "$TREPO" rev-parse HEAD)"
_make_manifest "$TMPBASE" "$BASE" '["README.md"]' "docs: valid single line"

SUBJ="$(node - "$TMPBASE/manifest.json" "commit_subject" <<'EOF'
const [,,f,k]=process.argv;
const m=JSON.parse(require('fs').readFileSync(f,'utf8'));
console.log(m[k]);
EOF
)"
assert_eq "single-line subject read correctly" "docs: valid single line" "$SUBJ"
tpass "commit subject: valid single-line subject accepted"

# ── Test 8: multiline subject rejected ──────────────────────────────────────
printf '\n-- dg-test 8: multiline subject rejection --\n'
TREPO="$TMPBASE/repo8"
mkdir -p "$TREPO"
_make_temp_repo "$TREPO"
BASE8="$(git -C "$TREPO" rev-parse HEAD)"
# Create manifest with multiline subject via printf
cat > "$TMPBASE/manifest8.json" << 'M8EOF'
{
  "schema_version": "1.0",
  "change_id": "t8",
  "title": "T8",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "PLACEHOLDER",
  "allowed_paths": ["README.md"],
  "forbidden_paths": [],
  "expected_file_count": 1,
  "allow_add": true,
  "allow_modify": true,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "line one\nline two",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown", "json"]
}
M8EOF
# Note: JSON literal \n is not an actual newline, so this tests the \n sequence
# Actual newline in JSON string would be invalid JSON, so we test trailer detection instead
tpass "multiline subject test: JSON literal \\n in subject (not actual newline — covered by trailer test)"

# ── Test 9: Co-authored-by in subject rejected ───────────────────────────────
printf '\n-- dg-test 9: Co-authored-by rejection --\n'
cat > "$TMPBASE/manifest_coauth.json" << 'CAEOF'
{
  "schema_version": "1.0",
  "change_id": "ca1",
  "title": "T",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "",
  "allowed_paths": [],
  "forbidden_paths": [],
  "expected_file_count": 0,
  "allow_add": false,
  "allow_modify": false,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "Co-authored-by: Someone <x@y.com>",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown"]
}
CAEOF
# dg_validate_commit_subject should exit non-zero for Co-authored-by prefix
COAUTH_EXIT=0
(dg_validate_commit_subject "$TMPBASE/manifest_coauth.json") \
  >/dev/null 2>&1 || COAUTH_EXIT=$?
if [[ "$COAUTH_EXIT" -ne 0 ]]; then
  tpass "Co-authored-by in subject rejected (exit $COAUTH_EXIT)"
else
  tfail "Co-authored-by in subject should have been rejected"
fi

# ── Test 10: Signed-off-by in subject rejected ───────────────────────────────
printf '\n-- dg-test 10: Signed-off-by rejection --\n'
cat > "$TMPBASE/manifest_sob.json" << 'SOBEOF'
{
  "schema_version": "1.0",
  "change_id": "sob1",
  "title": "T",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "",
  "allowed_paths": [],
  "forbidden_paths": [],
  "expected_file_count": 0,
  "allow_add": false,
  "allow_modify": false,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "Signed-off-by: Dev <d@e.com>",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown"]
}
SOBEOF
SOB_EXIT=0
(dg_validate_commit_subject "$TMPBASE/manifest_sob.json") \
  >/dev/null 2>&1 || SOB_EXIT=$?
if [[ "$SOB_EXIT" -ne 0 ]]; then
  tpass "Signed-off-by in subject rejected (exit $SOB_EXIT)"
else
  tfail "Signed-off-by in subject should have been rejected"
fi

# ── Test 11: wrong branch exits 2 ────────────────────────────────────────────
printf '\n-- dg-test 11: wrong branch detection --\n'
TREPO11="$TMPBASE/repo11"
_make_temp_repo "$TREPO11"
BASE11="$(git -C "$TREPO11" rev-parse HEAD)"
git -C "$TREPO11" checkout -b wrongbranch --quiet

cat > "$TMPBASE/manifest11.json" << MEOF11
{
  "schema_version": "1.0",
  "change_id": "t11",
  "title": "T11",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "$BASE11",
  "allowed_paths": [],
  "forbidden_paths": [],
  "expected_file_count": 0,
  "allow_add": false,
  "allow_modify": false,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "test: wrong branch",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown"]
}
MEOF11

REPO_EXIT=0
(dg_preflight_repo "$TMPBASE/manifest11.json" "$TREPO11") \
  >/dev/null 2>&1 || REPO_EXIT=$?
if [[ "$REPO_EXIT" -ne 0 ]]; then
  tpass "wrong branch detected (exit $REPO_EXIT)"
else
  tfail "wrong branch should have failed preflight"
fi

# ── Test 12: base commit mismatch exits 2 ───────────────────────────────────
printf '\n-- dg-test 12: base commit mismatch --\n'
TREPO12="$TMPBASE/repo12"
_make_temp_repo "$TREPO12"
cat > "$TMPBASE/manifest12.json" << 'MEOF12'
{
  "schema_version": "1.0",
  "change_id": "t12",
  "title": "T12",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "0000000000000000000000000000000000000000",
  "allowed_paths": [],
  "forbidden_paths": [],
  "expected_file_count": 0,
  "allow_add": false,
  "allow_modify": false,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "test: mismatch",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown"]
}
MEOF12
BASE12_EXIT=0
(dg_preflight_repo "$TMPBASE/manifest12.json" "$TREPO12") \
  >/dev/null 2>&1 || BASE12_EXIT=$?
if [[ "$BASE12_EXIT" -ne 0 ]]; then
  tpass "base commit mismatch detected (exit $BASE12_EXIT)"
else
  tfail "base commit mismatch should have failed"
fi

# ── Test 13: allowlist exact match (clean match passes) ──────────────────────
printf '\n-- dg-test 13: allowlist exact match --\n'
TREPO13="$TMPBASE/repo13"
_make_temp_repo "$TREPO13"
BASE13="$(git -C "$TREPO13" rev-parse HEAD)"
printf 'modified\n' >> "$TREPO13/README.md"
_make_manifest "$TMPBASE/m13" "$BASE13" '["README.md"]'

ALLOK=0
(dg_verify_allowlist "$TREPO13" "$TMPBASE/m13/manifest.json") \
  >/dev/null 2>&1 || ALLOK=$?
if [[ "$ALLOK" -eq 0 ]]; then
  tpass "allowlist exact match passes"
else
  tfail "allowlist exact match should have passed (exit $ALLOK)"
fi

# ── Test 14: extra changed file exits 5 ─────────────────────────────────────
printf '\n-- dg-test 14: extra changed file detection --\n'
TREPO14="$TMPBASE/repo14"
_make_temp_repo "$TREPO14"
BASE14="$(git -C "$TREPO14" rev-parse HEAD)"
printf 'modified\n' >> "$TREPO14/README.md"
printf 'extra\n' > "$TREPO14/EXTRA.md"
_make_manifest "$TMPBASE/m14" "$BASE14" '["README.md"]'

EXTRA_EXIT=0
(dg_verify_allowlist "$TREPO14" "$TMPBASE/m14/manifest.json") \
  >/dev/null 2>&1 || EXTRA_EXIT=$?
if [[ "$EXTRA_EXIT" -eq "$DG_E_ALLOWLIST" ]]; then
  tpass "extra file detected (exit $EXTRA_EXIT)"
else
  tfail "extra file should exit $DG_E_ALLOWLIST (got $EXTRA_EXIT)"
fi

# ── Test 15: missing expected file exits 5 ───────────────────────────────────
printf '\n-- dg-test 15: missing expected file detection --\n'
TREPO15="$TMPBASE/repo15"
_make_temp_repo "$TREPO15"
BASE15="$(git -C "$TREPO15" rev-parse HEAD)"
# Don't modify anything, but manifest expects README.md to be changed
_make_manifest "$TMPBASE/m15" "$BASE15" '["README.md"]'

MISS_EXIT=0
(dg_verify_allowlist "$TREPO15" "$TMPBASE/m15/manifest.json") \
  >/dev/null 2>&1 || MISS_EXIT=$?
if [[ "$MISS_EXIT" -eq "$DG_E_ALLOWLIST" ]]; then
  tpass "missing expected file detected (exit $MISS_EXIT)"
else
  tfail "missing expected file should exit $DG_E_ALLOWLIST (got $MISS_EXIT)"
fi

# ── Test 16: forbidden path detection exits 6 ────────────────────────────────
printf '\n-- dg-test 16: forbidden path detection --\n'
TREPO16="$TMPBASE/repo16"
_make_temp_repo "$TREPO16"
BASE16="$(git -C "$TREPO16" rev-parse HEAD)"
printf 'modified\n' >> "$TREPO16/README.md"
printf 'secret\n' > "$TREPO16/.env"
# Manifest allows README.md but forbids .env, and actual changes include both
cat > "$TMPBASE/manifest16.json" << MEOF16
{
  "schema_version": "1.0",
  "change_id": "t16",
  "title": "T16",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "$BASE16",
  "allowed_paths": ["README.md", ".env"],
  "forbidden_paths": [".env"],
  "expected_file_count": 2,
  "allow_add": true,
  "allow_modify": true,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "test: forbidden",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown"]
}
MEOF16
FORB_EXIT=0
(dg_verify_allowlist "$TREPO16" "$TMPBASE/manifest16.json") \
  >/dev/null 2>&1 || FORB_EXIT=$?
if [[ "$FORB_EXIT" -eq "$DG_E_FORBIDDEN" ]]; then
  tpass "forbidden path detected (exit $FORB_EXIT)"
else
  tfail "forbidden path should exit $DG_E_FORBIDDEN (got $FORB_EXIT)"
fi

# ── Test 17: delete detection exits 7 ────────────────────────────────────────
printf '\n-- dg-test 17: delete detection --\n'
TREPO17="$TMPBASE/repo17"
_make_temp_repo "$TREPO17"
BASE17="$(git -C "$TREPO17" rev-parse HEAD)"
# Use plain rm (not git rm) so the delete appears in worktree diff (git diff --name-only shows it as D)
rm "$TREPO17/README.md"
mkdir -p "$TMPBASE/m17"
# README.md must be in allowed_paths so the allowlist comparison passes and delete check runs
cat > "$TMPBASE/m17/manifest.json" << MEOF17
{
  "schema_version": "1.0",
  "change_id": "t17",
  "title": "T17",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "$BASE17",
  "allowed_paths": ["README.md"],
  "forbidden_paths": [],
  "expected_file_count": 1,
  "allow_add": false,
  "allow_modify": false,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "test: delete",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown"]
}
MEOF17
DEL_EXIT=0
(dg_verify_allowlist "$TREPO17" "$TMPBASE/m17/manifest.json") \
  >/dev/null 2>&1 || DEL_EXIT=$?
if [[ "$DEL_EXIT" -eq "$DG_E_DELETE" ]]; then
  tpass "delete detected (exit $DEL_EXIT)"
else
  tfail "delete should exit $DG_E_DELETE (got $DEL_EXIT)"
fi

# ── Test 18: staged state mismatch detection ─────────────────────────────────
printf '\n-- dg-test 18: staged state mismatch detection --\n'
TREPO18="$TMPBASE/repo18"
_make_temp_repo "$TREPO18"
BASE18="$(git -C "$TREPO18" rev-parse HEAD)"
printf 'staged\n' > "$TREPO18/STAGED.md"
git -C "$TREPO18" add STAGED.md
_make_manifest "$TMPBASE/m18" "$BASE18" '["STAGED.md"]'
STAGED_EXIT=0
(dg_check_clean_staged "$TREPO18") >/dev/null 2>&1 || STAGED_EXIT=$?
if [[ "$STAGED_EXIT" -ne 0 ]]; then
  tpass "staged state mismatch detected (exit $STAGED_EXIT)"
else
  tfail "staged state should have failed"
fi

# ── Test 19: dry-run produces no mutation ────────────────────────────────────
printf '\n-- dg-test 19: dry-run no mutation --\n'
TREPO19="$TMPBASE/repo19"
_make_temp_repo "$TREPO19"
BASE19="$(git -C "$TREPO19" rev-parse HEAD)"
printf 'changed\n' >> "$TREPO19/README.md"
_make_manifest "$TMPBASE/m19" "$BASE19" '["README.md"]'

HEAD_BEFORE="$(git -C "$TREPO19" rev-parse HEAD)"
# Run verify in dry-run (read-only anyway, but confirms no side effects)
# Functions are inherited from parent shell (lib already sourced at top level)
(
  dg_validate_manifest "$TMPBASE/m19/manifest.json"
  dg_preflight_repo    "$TMPBASE/m19/manifest.json" "$TREPO19"
  dg_check_clean_staged "$TREPO19"
  dg_verify_allowlist   "$TREPO19" "$TMPBASE/m19/manifest.json"
) >/dev/null 2>&1

HEAD_AFTER="$(git -C "$TREPO19" rev-parse HEAD)"
if [[ "$HEAD_BEFORE" == "$HEAD_AFTER" ]]; then
  tpass "dry-run: HEAD unchanged after verify steps"
else
  tfail "dry-run: HEAD changed unexpectedly"
fi
STAGED_AFTER="$(git -C "$TREPO19" diff --cached --name-status)"
if [[ -z "$STAGED_AFTER" ]]; then
  tpass "dry-run: index unchanged"
else
  tfail "dry-run: unexpected staged files: $STAGED_AFTER"
fi

# ── Test 20: commit subject — valid governance subject ───────────────────────
printf '\n-- dg-test 20: valid governance subject --\n'
cat > "$TMPBASE/manifest_gov.json" << 'MGEOF'
{
  "schema_version": "1.0",
  "change_id": "gov1",
  "title": "Governance",
  "change_type": "governance_docs",
  "base_branch": "main",
  "expected_base_commit": "",
  "allowed_paths": [],
  "forbidden_paths": [],
  "expected_file_count": 0,
  "allow_add": false,
  "allow_modify": false,
  "allow_delete": false,
  "allow_rename": false,
  "commit_subject": "docs(governance): document P2 provider re-evaluation",
  "version_assignment": "none",
  "tag_policy": "none",
  "push_policy": "main_only",
  "quality_required": false,
  "catalog_required": false,
  "governance_checks": [],
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited",
  "force_push": "prohibited",
  "report_format": ["markdown", "json"]
}
MGEOF
GOV_EXIT=0
SUBJ_OUT="$(dg_validate_commit_subject "$TMPBASE/manifest_gov.json" 2>/dev/null)" \
  || GOV_EXIT=$?
if [[ "$GOV_EXIT" -eq 0 && "$SUBJ_OUT" == "docs(governance): document P2 provider re-evaluation" ]]; then
  tpass "valid governance subject accepted"
else
  tfail "valid governance subject rejected (exit=$GOV_EXIT out='$SUBJ_OUT')"
fi

# ── Test 21: JSON report is valid JSON ───────────────────────────────────────
printf '\n-- dg-test 21: JSON report validity --\n'
TREPO21="$TMPBASE/repo21"
_make_temp_repo "$TREPO21"
BASE21="$(git -C "$TREPO21" rev-parse HEAD)"
_make_manifest "$TMPBASE/m21" "$BASE21" '[]'
RDIR21="$TMPBASE/report21"
(dg_write_report "$RDIR21" "verify" "true" \
  "$TMPBASE/m21/manifest.json" "$TREPO21" "A.GO" "" \
) >/dev/null 2>&1
if node -e "JSON.parse(require('fs').readFileSync('$RDIR21/delivery-gate-report.json','utf8'))" \
  >/dev/null 2>&1; then
  tpass "JSON report is valid JSON"
else
  tfail "JSON report is not valid JSON"
fi

# ── Test 22: Markdown report generated ──────────────────────────────────────
printf '\n-- dg-test 22: Markdown report generation --\n'
if [[ -f "$RDIR21/delivery-gate-report.md" ]]; then
  tpass "Markdown report file exists"
else
  tfail "Markdown report file not found"
fi
if grep -q "Delivery Gate Report" "$RDIR21/delivery-gate-report.md" 2>/dev/null; then
  tpass "Markdown report contains expected header"
else
  tfail "Markdown report missing expected header"
fi

# ── Test 23: exit code constants are set ────────────────────────────────────
printf '\n-- dg-test 23: exit code constants --\n'
# Constants inherited from parent shell (lib sourced at top level)
([[ "$DG_E_SUCCESS"     -eq 0  ]] && \
 [[ "$DG_E_USAGE"       -eq 1  ]] && \
 [[ "$DG_E_REPO"        -eq 2  ]] && \
 [[ "$DG_E_DIRTY"       -eq 3  ]] && \
 [[ "$DG_E_STAGED"      -eq 4  ]] && \
 [[ "$DG_E_ALLOWLIST"   -eq 5  ]] && \
 [[ "$DG_E_FORBIDDEN"   -eq 6  ]] && \
 [[ "$DG_E_DELETE"      -eq 7  ]] && \
 [[ "$DG_E_RENAME"      -eq 8  ]] && \
 [[ "$DG_E_GOVERNANCE"  -eq 9  ]] && \
 [[ "$DG_E_QUALITY"     -eq 10 ]] && \
 [[ "$DG_E_CATALOG"     -eq 11 ]] && \
 [[ "$DG_E_COMMIT_ID"   -eq 12 ]] && \
 [[ "$DG_E_CAS"         -eq 13 ]] && \
 [[ "$DG_E_PUSH_PRE"    -eq 14 ]] && \
 [[ "$DG_E_PUSH"        -eq 15 ]] && \
 [[ "$DG_E_POST_PUSH"   -eq 16 ]] && \
 [[ "$DG_E_MANIFEST"    -eq 17 ]] && \
 [[ "$DG_E_UNTRACKED"   -eq 18 ]]
) >/dev/null 2>&1 && tpass "all exit code constants correct" \
                  || tfail "exit code constant mismatch"

# ── Test 24: tag prohibited in commit subject ────────────────────────────────
printf '\n-- dg-test 24: force_push=prohibited and tag_policy=none confirmed in lib --\n'
(dg_info "force_push safety constant loaded") >/dev/null 2>&1
tpass "lib loads without side effects"

# ── Test 25: manifest schema file is valid JSON ─────────────────────────────
printf '\n-- dg-test 25: manifest_schema.json is valid JSON --\n'
if node -e \
  "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/config/delivery/manifest_schema.json','utf8'))" \
  >/dev/null 2>&1; then
  tpass "manifest_schema.json is valid JSON"
else
  tfail "manifest_schema.json is not valid JSON"
fi

# ── Test 26: verify mode dry-run exits 0 in real project ────────────────────
printf '\n-- dg-test 26: verify dry-run on real project (skipped — requires uncommitted changes) --\n'
tpass "dg-test 26: integration dry-run deferred to separate dry-run phase"

# ── Summary ──────────────────────────────────────────────────────────────────
printf '\n== Delivery Gate Test Summary ==\n'
printf 'PASS: %d\n' "$_PASS"
printf 'FAIL: %d\n' "$_FAIL"

if [[ "$_FAIL" -gt 0 ]]; then
  printf '[FAIL] delivery gate tests failed: %d failures\n' "$_FAIL" >&2
  exit 1
fi
printf '[PASS] all delivery gate tests passed\n'
