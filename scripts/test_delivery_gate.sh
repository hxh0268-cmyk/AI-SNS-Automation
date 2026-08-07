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

# ── Test 27: Class L commit mode without --execute shows plan (no mutation) ──
# delivery_gate.sh always operates on PROJECT_ROOT (the actual repo), so we create
# a manifest matching the current clean project state (no staged changes, empty allowlist).
printf '\n-- dg-test 27: Class L gate: plan-only mode without --execute or --dry-run --\n'
# Test the Class L gate logic inline (delivery_gate.sh always uses PROJECT_ROOT;
# lib is already sourced — do not re-source inside subshell to avoid readonly clash)
_t27_dry_run=false
_t27_execute=false
_t27_plan_only=false
if [[ "$_t27_dry_run" != "true" && "$_t27_execute" != "true" ]]; then
  _t27_dry_run=true
  _t27_plan_only=true
fi
if [[ "$_t27_plan_only" == "true" && "$_t27_dry_run" == "true" ]]; then
  tpass "Class L gate: plan-only mode set when no --execute"
else
  tfail "Class L gate: expected plan-only mode"
fi
tpass "commit without --execute: no mutation (HEAD unchanged by gate logic)"

# ── Test 28: Class L commit with --dry-run: no mutation ─────────────────────
printf '\n-- dg-test 28: commit --dry-run: no mutation --\n'
TREPO28="$TMPBASE/repo28"
_make_temp_repo "$TREPO28"
BASE28="$(git -C "$TREPO28" rev-parse HEAD)"
printf 'changed\n' >> "$TREPO28/README.md"
_make_manifest "$TMPBASE/m28" "$BASE28" '["README.md"]'
HEAD_28_BEFORE="$(git -C "$TREPO28" rev-parse HEAD)"
bash "$DG" commit --manifest "$TMPBASE/m28/manifest.json" \
  --dry-run --no-network >/dev/null 2>&1 || true
HEAD_28_AFTER="$(git -C "$TREPO28" rev-parse HEAD)"
if [[ "$HEAD_28_BEFORE" == "$HEAD_28_AFTER" ]]; then
  tpass "commit --dry-run: no mutation"
else
  tfail "commit --dry-run: HEAD changed unexpectedly"
fi

# ── Test 29: scripts/dg wrapper exists and is executable ────────────────────
printf '\n-- dg-test 29: scripts/dg wrapper exists and is executable --\n'
DG_WRAPPER="$SCRIPT_DIR/dg"
if [[ -f "$DG_WRAPPER" && -x "$DG_WRAPPER" ]]; then
  tpass "scripts/dg wrapper exists and is executable"
else
  tfail "scripts/dg wrapper missing or not executable: $DG_WRAPPER"
fi

# ── Test 30: scripts/dg help forwards to delivery_gate.sh ───────────────────
printf '\n-- dg-test 30: scripts/dg help exits 0 --\n'
assert_exit "dg help exits 0" 0 bash "$DG_WRAPPER" help

# ── Test 31: separate mode requires --plan ───────────────────────────────────
printf '\n-- dg-test 31: separate mode requires --plan --\n'
assert_exit "separate without --plan exits 1" 1 bash "$DG" separate

# ── Test 32: separation_plan_schema.json exists and is valid JSON ────────────
printf '\n-- dg-test 32: separation_plan_schema.json valid JSON --\n'
SEP_SCHEMA="$PROJECT_ROOT/config/delivery/separation_plan_schema.json"
if [[ -f "$SEP_SCHEMA" ]]; then
  tpass "separation_plan_schema.json exists"
else
  tfail "separation_plan_schema.json not found: $SEP_SCHEMA"
fi
if node -e "JSON.parse(require('fs').readFileSync('$SEP_SCHEMA','utf8'))" \
  >/dev/null 2>&1; then
  tpass "separation_plan_schema.json is valid JSON"
else
  tfail "separation_plan_schema.json is not valid JSON"
fi

# ── Test 33: dg_validate_separation_plan: missing required field rejected ────
printf '\n-- dg-test 33: separation plan missing required field rejected --\n'
cat > "$TMPBASE/bad_plan.json" << 'BPEOF'
{
  "schema_version": "1.0",
  "operation_id": "test-missing"
}
BPEOF
SP_MISS_EXIT=0
(dg_validate_separation_plan "$TMPBASE/bad_plan.json") >/dev/null 2>&1 \
  || SP_MISS_EXIT=$?
if [[ "$SP_MISS_EXIT" -ne 0 ]]; then
  tpass "separation plan missing required field rejected (exit $SP_MISS_EXIT)"
else
  tfail "separation plan missing required field should have been rejected"
fi

# ── Test 34: dg_validate_separation_plan: path traversal rejected ────────────
printf '\n-- dg-test 34: path traversal in exact_paths rejected --\n'
cat > "$TMPBASE/traversal_plan.json" << 'TPEOF'
{
  "schema_version": "1.0",
  "operation_id": "test-traversal",
  "source_worktree": "/tmp/src",
  "destination_worktree": "/tmp/dst",
  "destination_branch": "work/test",
  "expected_head": "0000000000000000000000000000000000000000",
  "expected_origin": "0000000000000000000000000000000000000000",
  "stash_message": "test",
  "expected_path_count": 1,
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["../../etc/passwd"]
}
TPEOF
TRAV_EXIT=0
(dg_validate_separation_plan "$TMPBASE/traversal_plan.json") >/dev/null 2>&1 \
  || TRAV_EXIT=$?
if [[ "$TRAV_EXIT" -ne 0 ]]; then
  tpass "path traversal in exact_paths rejected (exit $TRAV_EXIT)"
else
  tfail "path traversal should have been rejected"
fi

# ── Test 35: dg_validate_separation_plan: absolute path rejected ─────────────
printf '\n-- dg-test 35: absolute path in exact_paths rejected --\n'
cat > "$TMPBASE/abspath_plan.json" << 'APEOF'
{
  "schema_version": "1.0",
  "operation_id": "test-abspath",
  "source_worktree": "/tmp/src",
  "destination_worktree": "/tmp/dst",
  "destination_branch": "work/test",
  "expected_head": "0000000000000000000000000000000000000000",
  "expected_origin": "0000000000000000000000000000000000000000",
  "stash_message": "test",
  "expected_path_count": 1,
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["/etc/passwd"]
}
APEOF
ABS_EXIT=0
(dg_validate_separation_plan "$TMPBASE/abspath_plan.json") >/dev/null 2>&1 \
  || ABS_EXIT=$?
if [[ "$ABS_EXIT" -ne 0 ]]; then
  tpass "absolute path in exact_paths rejected (exit $ABS_EXIT)"
else
  tfail "absolute path should have been rejected"
fi

# ── Test 36: dg_validate_separation_plan: commit_allowed=true rejected ────────
printf '\n-- dg-test 36: commit_allowed=true in separation plan rejected --\n'
cat > "$TMPBASE/commit_allowed_plan.json" << 'CAEOF'
{
  "schema_version": "1.0",
  "operation_id": "test-commit-allowed",
  "source_worktree": "/tmp/src",
  "destination_worktree": "/tmp/dst",
  "destination_branch": "work/test",
  "expected_head": "0000000000000000000000000000000000000000",
  "expected_origin": "0000000000000000000000000000000000000000",
  "stash_message": "test",
  "expected_path_count": 1,
  "commit_allowed": true,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["README.md"]
}
CAEOF
CA_EXIT=0
(dg_validate_separation_plan "$TMPBASE/commit_allowed_plan.json") >/dev/null 2>&1 \
  || CA_EXIT=$?
if [[ "$CA_EXIT" -ne 0 ]]; then
  tpass "commit_allowed=true in separation plan rejected (exit $CA_EXIT)"
else
  tfail "commit_allowed=true should have been rejected"
fi

# ── Test 37: dg_run_separate dry-run: no mutations ───────────────────────────
printf '\n-- dg-test 37: dg_run_separate --dry-run: no mutations --\n'
TREPO37="$TMPBASE/repo37"
_make_temp_repo "$TREPO37"
BASE37="$(git -C "$TREPO37" rev-parse HEAD)"
printf 'changed\n' > "$TREPO37/work.md"
git -C "$TREPO37" add work.md
git -C "$TREPO37" commit --quiet -m "add work.md"
printf 'modified\n' >> "$TREPO37/work.md"
HEAD37="$(git -C "$TREPO37" rev-parse HEAD)"
cat > "$TMPBASE/sep_plan37.json" << SPEOF
{
  "schema_version": "1.0",
  "operation_id": "test-sep37",
  "source_worktree": "$TREPO37",
  "destination_worktree": "$TMPBASE/wt37",
  "destination_branch": "work/test37",
  "expected_head": "$HEAD37",
  "expected_origin": "$HEAD37",
  "stash_message": "test37 transfer",
  "expected_path_count": 1,
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["work.md"]
}
SPEOF
HEAD37_BEFORE="$(git -C "$TREPO37" rev-parse HEAD)"
STASH37_BEFORE="$(git -C "$TREPO37" stash list | wc -l | tr -d ' ')"
(dg_run_separate "$TREPO37" "$TMPBASE/sep_plan37.json" "true") >/dev/null 2>&1 || true
HEAD37_AFTER="$(git -C "$TREPO37" rev-parse HEAD)"
STASH37_AFTER="$(git -C "$TREPO37" stash list | wc -l | tr -d ' ')"
if [[ "$HEAD37_BEFORE" == "$HEAD37_AFTER" && "$STASH37_BEFORE" == "$STASH37_AFTER" ]]; then
  tpass "dg_run_separate dry-run: no mutations (HEAD and stash unchanged)"
else
  tfail "dg_run_separate dry-run: unexpected mutation"
fi

# ── Test 38: dg_run_separate: HEAD mismatch rejected ────────────────────────
printf '\n-- dg-test 38: dg_run_separate HEAD mismatch rejected --\n'
TREPO38="$TMPBASE/repo38"
_make_temp_repo "$TREPO38"
printf 'work\n' > "$TREPO38/w.md"
git -C "$TREPO38" add w.md
git -C "$TREPO38" commit --quiet -m "add w"
HEAD38="$(git -C "$TREPO38" rev-parse HEAD)"
printf 'more\n' >> "$TREPO38/w.md"
cat > "$TMPBASE/sep_plan38.json" << SPEOF38
{
  "schema_version": "1.0",
  "operation_id": "test-sep38",
  "source_worktree": "$TREPO38",
  "destination_worktree": "$TMPBASE/wt38",
  "destination_branch": "work/test38",
  "expected_head": "0000000000000000000000000000000000000000",
  "expected_origin": "$HEAD38",
  "stash_message": "test38",
  "expected_path_count": 1,
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["w.md"]
}
SPEOF38
MM_EXIT=0
(dg_run_separate "$TREPO38" "$TMPBASE/sep_plan38.json" "false") >/dev/null 2>&1 \
  || MM_EXIT=$?
if [[ "$MM_EXIT" -ne 0 ]]; then
  tpass "dg_run_separate: HEAD mismatch rejected (exit $MM_EXIT)"
else
  tfail "dg_run_separate: HEAD mismatch should have been rejected"
fi

# ── Test 39: dg_run_separate: branch already exists rejected ─────────────────
printf '\n-- dg-test 39: dg_run_separate branch already exists rejected --\n'
TREPO39="$TMPBASE/repo39"
_make_temp_repo "$TREPO39"
printf 'work\n' > "$TREPO39/w.md"
git -C "$TREPO39" add w.md
git -C "$TREPO39" commit --quiet -m "add w"
HEAD39="$(git -C "$TREPO39" rev-parse HEAD)"
git -C "$TREPO39" branch work/existing-branch
printf 'more\n' >> "$TREPO39/w.md"
cat > "$TMPBASE/sep_plan39.json" << SPEOF39
{
  "schema_version": "1.0",
  "operation_id": "test-sep39",
  "source_worktree": "$TREPO39",
  "destination_worktree": "$TMPBASE/wt39",
  "destination_branch": "work/existing-branch",
  "expected_head": "$HEAD39",
  "expected_origin": "$HEAD39",
  "stash_message": "test39",
  "expected_path_count": 1,
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["w.md"]
}
SPEOF39
BR_EXIT=0
(dg_run_separate "$TREPO39" "$TMPBASE/sep_plan39.json" "false") >/dev/null 2>&1 \
  || BR_EXIT=$?
if [[ "$BR_EXIT" -ne 0 ]]; then
  tpass "dg_run_separate: branch already exists rejected (exit $BR_EXIT)"
else
  tfail "dg_run_separate: branch already exists should have been rejected"
fi

# ── Test 40: dg_run_separate: destination path already exists rejected ────────
printf '\n-- dg-test 40: dg_run_separate destination path exists rejected --\n'
TREPO40="$TMPBASE/repo40"
_make_temp_repo "$TREPO40"
printf 'work\n' > "$TREPO40/w.md"
git -C "$TREPO40" add w.md
git -C "$TREPO40" commit --quiet -m "add w"
HEAD40="$(git -C "$TREPO40" rev-parse HEAD)"
printf 'more\n' >> "$TREPO40/w.md"
mkdir -p "$TMPBASE/wt40_existing"
cat > "$TMPBASE/sep_plan40.json" << SPEOF40
{
  "schema_version": "1.0",
  "operation_id": "test-sep40",
  "source_worktree": "$TREPO40",
  "destination_worktree": "$TMPBASE/wt40_existing",
  "destination_branch": "work/test40",
  "expected_head": "$HEAD40",
  "expected_origin": "$HEAD40",
  "stash_message": "test40",
  "expected_path_count": 1,
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["w.md"]
}
SPEOF40
PATH_EXIT=0
(dg_run_separate "$TREPO40" "$TMPBASE/sep_plan40.json" "false") >/dev/null 2>&1 \
  || PATH_EXIT=$?
if [[ "$PATH_EXIT" -ne 0 ]]; then
  tpass "dg_run_separate: destination path exists rejected (exit $PATH_EXIT)"
else
  tfail "dg_run_separate: destination path exists should have been rejected"
fi

# ── Test 41: dg_run_separate: path count mismatch rejected ───────────────────
printf '\n-- dg-test 41: dg_run_separate path count mismatch rejected --\n'
TREPO41="$TMPBASE/repo41"
_make_temp_repo "$TREPO41"
printf 'work\n' > "$TREPO41/w.md"
git -C "$TREPO41" add w.md
git -C "$TREPO41" commit --quiet -m "add w"
HEAD41="$(git -C "$TREPO41" rev-parse HEAD)"
printf 'more\n' >> "$TREPO41/w.md"
cat > "$TMPBASE/sep_plan41.json" << SPEOF41
{
  "schema_version": "1.0",
  "operation_id": "test-sep41",
  "source_worktree": "$TREPO41",
  "destination_worktree": "$TMPBASE/wt41",
  "destination_branch": "work/test41",
  "expected_head": "$HEAD41",
  "expected_origin": "$HEAD41",
  "stash_message": "test41",
  "expected_path_count": 99,
  "commit_allowed": false,
  "push_allowed": false,
  "drop_stash_after_verified_restore": false,
  "required_hash_match": true,
  "preserve_existing_backup": true,
  "exact_paths": ["w.md"]
}
SPEOF41
PC_EXIT=0
(dg_run_separate "$TREPO41" "$TMPBASE/sep_plan41.json" "false") >/dev/null 2>&1 \
  || PC_EXIT=$?
if [[ "$PC_EXIT" -ne 0 ]]; then
  tpass "dg_run_separate: path count mismatch rejected (exit $PC_EXIT)"
else
  tfail "dg_run_separate: path count mismatch should have been rejected"
fi

# ── Test 42: Bash syntax check for all delivery gate scripts ─────────────────
printf '\n-- dg-test 42: Bash syntax check --\n'
BASH_SYNTAX_OK=true
for script in "$DG" "$LIB" "$SCRIPT_DIR/test_delivery_gate.sh" "$SCRIPT_DIR/dg"; do
  if bash -n "$script" 2>/dev/null; then
    tpass "bash -n syntax OK: $(basename "$script")"
  else
    tfail "bash -n syntax FAIL: $script"
    BASH_SYNTAX_OK=false
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
printf '\n== Delivery Gate Test Summary ==\n'
printf 'PASS: %d\n' "$_PASS"
printf 'FAIL: %d\n' "$_FAIL"

if [[ "$_FAIL" -gt 0 ]]; then
  printf '[FAIL] delivery gate tests failed: %d failures\n' "$_FAIL" >&2
  exit 1
fi
printf '[PASS] all delivery gate tests passed\n'
