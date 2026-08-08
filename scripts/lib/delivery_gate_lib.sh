#!/usr/bin/env bash
# Delivery Gate shared library — Bash 3.2 compatible (macOS default)
# Source this file; do not execute directly.

# ── Safety classes ───────────────────────────────────────────────────────────
# Class R — Read Only: no ref/index/remote/stash/worktree mutation
#   modes: help, verify, prepare, report
#   flags: no --execute required; --dry-run has no effect on mutations
#
# Class L — Local Mutation: manifest/plan-authorized local changes only
#   modes: commit, separate, restore
#   flags: requires --execute or --dry-run; default is plan-display (no mutation)
#   scope: staged → commit-tree + CAS; scoped-stash; branch/worktree creation; stash apply/drop
#
# Class N — Network Mutation: requires clean local state + Class L complete
#   modes: publish (includes push + post-push verify)
#   flags: requires --execute or --dry-run
#   constraints: main-only, no force, no tag push (tag_policy=none), remote CAS verified

# ── Exit codes ──────────────────────────────────────────────────────────────
readonly DG_E_SUCCESS=0
readonly DG_E_USAGE=1
readonly DG_E_REPO=2
readonly DG_E_DIRTY=3
readonly DG_E_STAGED=4
readonly DG_E_ALLOWLIST=5
readonly DG_E_FORBIDDEN=6
readonly DG_E_DELETE=7
readonly DG_E_RENAME=8
readonly DG_E_GOVERNANCE=9
readonly DG_E_QUALITY=10
readonly DG_E_CATALOG=11
readonly DG_E_COMMIT_ID=12
readonly DG_E_CAS=13
readonly DG_E_PUSH_PRE=14
readonly DG_E_PUSH=15
readonly DG_E_POST_PUSH=16
readonly DG_E_MANIFEST=17
readonly DG_E_UNTRACKED=18
readonly DG_E_HEALTH=19

# SNS content workstream paths — centralized; extend here to add new SNS workstreams
readonly _DG_SNS_PATH_PATTERN="^(content/carousel|images/carousel|output/instagram)"

# ── Logging ─────────────────────────────────────────────────────────────────
_dg_ts() { date '+%Y-%m-%dT%H:%M:%S'; }

dg_info()  { printf '[DG INFO]  %s %s\n' "$(_dg_ts)" "$*" >&2; }
dg_warn()  { printf '[DG WARN]  %s %s\n' "$(_dg_ts)" "$*" >&2; }
dg_error() { printf '[DG ERROR] %s %s\n' "$(_dg_ts)" "$*" >&2; }

dg_fail() {
  local code="$1"; shift
  dg_error "$*"
  exit "$code"
}

# Print command without executing (dry-run helper)
dg_dry_print() { printf '[DG DRY]   would run: %s\n' "$*" >&2; }

# ── Manifest parsing (Node.js — no external deps) ───────────────────────────
# Usage: _dg_mget_str  <manifest> <key>  → prints string value
_dg_mget_str() {
  local f="$1" k="$2"
  node - "$f" "$k" <<'EOF'
const [,,f,k]=process.argv;
try{
  const m=JSON.parse(require('fs').readFileSync(f,'utf8'));
  if(m[k]===undefined||m[k]===null){process.exit(1);}
  process.stdout.write(String(m[k])+'\n');
}catch(e){process.stderr.write(e.message+'\n');process.exit(2);}
EOF
}

# Usage: _dg_mget_arr  <manifest> <key>  → prints one array element per line
_dg_mget_arr() {
  local f="$1" k="$2"
  node - "$f" "$k" <<'EOF'
const [,,f,k]=process.argv;
try{
  const m=JSON.parse(require('fs').readFileSync(f,'utf8'));
  const v=m[k];
  if(!Array.isArray(v)){process.exit(1);}
  v.forEach(x=>process.stdout.write(String(x)+'\n'));
}catch(e){process.stderr.write(e.message+'\n');process.exit(2);}
EOF
}

# Usage: _dg_mbool <manifest> <key>  → exits 0 if true, 1 if false
_dg_mbool() {
  local f="$1" k="$2"
  node - "$f" "$k" <<'EOF'
const [,,f,k]=process.argv;
try{
  const m=JSON.parse(require('fs').readFileSync(f,'utf8'));
  process.exit(m[k]===true?0:1);
}catch(e){process.exit(2);}
EOF
}

# Validate manifest has required fields; exit DG_E_MANIFEST if invalid
dg_validate_manifest() {
  local manifest="$1"
  [[ -f "$manifest" ]] || dg_fail "$DG_E_MANIFEST" "manifest not found: $manifest"
  local required_fields="schema_version change_id commit_subject allowed_paths expected_file_count"
  local field
  for field in $required_fields; do
    _dg_mget_str "$manifest" "$field" >/dev/null 2>&1 \
      || dg_fail "$DG_E_MANIFEST" "manifest missing required field: $field"
  done
  dg_info "manifest validated: $manifest"
}

# ── Repository preflight ─────────────────────────────────────────────────────
# mode: "strict" (default) — HEAD must equal expected_base_commit
#       "publish" — HEAD may be expected_base_commit OR one commit ahead of it
dg_preflight_repo() {
  local manifest="$1"
  local project_root="$2"
  local mode="${3:-strict}"

  local expected_branch
  expected_branch="$(_dg_mget_str "$manifest" "base_branch" 2>/dev/null || echo "main")"

  local actual_branch
  actual_branch="$(git -C "$project_root" branch --show-current)"
  [[ "$actual_branch" == "$expected_branch" ]] \
    || dg_fail "$DG_E_REPO" "branch mismatch: expected=$expected_branch actual=$actual_branch"

  local expected_base
  expected_base="$(_dg_mget_str "$manifest" "expected_base_commit" 2>/dev/null || echo "")"
  if [[ -n "$expected_base" ]]; then
    local actual_head
    actual_head="$(git -C "$project_root" rev-parse HEAD)"
    if [[ "$mode" == "publish" ]]; then
      # Accept: HEAD == expected_base (pre-commit combined publish)
      #      OR HEAD^ == expected_base (post-commit separate publish)
      local head_parent
      head_parent="$(git -C "$project_root" rev-parse HEAD^ 2>/dev/null || echo "")"
      if [[ "$actual_head" != "$expected_base" && "$head_parent" != "$expected_base" ]]; then
        dg_fail "$DG_E_REPO" "publish preflight: HEAD ($actual_head) is not at or one commit ahead of expected_base_commit ($expected_base)"
      fi
      dg_info "publish preflight: HEAD relationship to base_commit verified (mode=publish)"
    else
      [[ "$actual_head" == "$expected_base" ]] \
        || dg_fail "$DG_E_REPO" "base commit mismatch: expected=$expected_base actual=$actual_head"
    fi
  fi

  dg_info "repo preflight passed: branch=$actual_branch"
}

# ── Working tree / staged state ──────────────────────────────────────────────
dg_check_clean_staged() {
  local project_root="$1"
  local staged
  staged="$(git -C "$project_root" diff --cached --name-status)"
  [[ -z "$staged" ]] \
    || dg_fail "$DG_E_STAGED" "index is not clean — unexpected staged files:\n$staged"
  dg_info "staged state: clean"
}

dg_check_no_unexpected_untracked() {
  local project_root="$1"
  local manifest="$2"

  # Build allowed_paths set
  local allowed_path
  local actual_untracked
  actual_untracked="$(git -C "$project_root" ls-files --others --exclude-standard | sort)"
  [[ -z "$actual_untracked" ]] && { dg_info "untracked: none"; return 0; }

  # Check each untracked file is in allowed_paths
  while IFS= read -r upath; do
    local found=0
    while IFS= read -r apath; do
      [[ "$upath" == "$apath" ]] && { found=1; break; }
    done < <(_dg_mget_arr "$manifest" "allowed_paths")
    [[ "$found" -eq 1 ]] \
      || dg_fail "$DG_E_UNTRACKED" "unexpected untracked file: $upath"
  done <<EOF
$actual_untracked
EOF
  dg_info "untracked files: all within allowlist"
}

# ── Allowlist verification ───────────────────────────────────────────────────
dg_verify_allowlist() {
  local project_root="$1"
  local manifest="$2"

  # Collect actual changed paths
  local actual_modified actual_added
  actual_modified="$(git -C "$project_root" diff --name-only | sort)"
  actual_added="$(git -C "$project_root" ls-files --others --exclude-standard | sort)"

  # Combine and sort
  local actual_all
  actual_all="$(printf '%s\n%s\n' "$actual_modified" "$actual_added" | grep -v '^$' | sort -u)"

  # Get expected paths from manifest (sorted)
  local expected_all
  expected_all="$(_dg_mget_arr "$manifest" "allowed_paths" | sort -u)"

  # Compare
  local diff_out
  diff_out="$(diff <(printf '%s\n' "$expected_all") <(printf '%s\n' "$actual_all") 2>/dev/null || true)"
  if [[ -n "$diff_out" ]]; then
    dg_error "allowlist mismatch:"
    printf '%s\n' "$diff_out" >&2
    exit "$DG_E_ALLOWLIST"
  fi

  # Verify file count
  local expected_count actual_count
  expected_count="$(_dg_mget_str "$manifest" "expected_file_count")"
  actual_count="$(printf '%s\n' "$actual_all" | grep -c . || echo 0)"
  [[ "$actual_count" -eq "$expected_count" ]] \
    || dg_fail "$DG_E_ALLOWLIST" "file count mismatch: expected=$expected_count actual=$actual_count"

  # Check for deletes
  local allow_delete
  allow_delete="$(_dg_mget_str "$manifest" "allow_delete" 2>/dev/null || echo "false")"
  if [[ "$allow_delete" != "true" ]]; then
    local deletes
    deletes="$(git -C "$project_root" diff --name-only --diff-filter=D)"
    [[ -z "$deletes" ]] \
      || dg_fail "$DG_E_DELETE" "delete detected (allow_delete=false): $deletes"
  fi

  # Check for renames
  local allow_rename
  allow_rename="$(_dg_mget_str "$manifest" "allow_rename" 2>/dev/null || echo "false")"
  if [[ "$allow_rename" != "true" ]]; then
    local renames
    renames="$(git -C "$project_root" diff --name-only --diff-filter=R)"
    [[ -z "$renames" ]] \
      || dg_fail "$DG_E_RENAME" "rename detected (allow_rename=false): $renames"
  fi

  # Check forbidden_paths
  while IFS= read -r fpath; do
    [[ -z "$fpath" ]] && continue
    if printf '%s\n' "$actual_all" | grep -qxF "$fpath"; then
      dg_fail "$DG_E_FORBIDDEN" "forbidden path in changeset: $fpath"
    fi
  done < <(_dg_mget_arr "$manifest" "forbidden_paths" 2>/dev/null || true)

  # Check git diff --check (whitespace)
  git -C "$project_root" diff --check \
    || dg_fail "$DG_E_ALLOWLIST" "git diff --check failed (trailing whitespace or conflict markers)"

  dg_info "allowlist verified: $actual_count files match expected $expected_count"
}

# ── Governance verification ──────────────────────────────────────────────────
# Check: provider_authorization = "none" → Authorized Provider None in docs
_dg_gov_check_provider_auth() {
  local root="$1"
  grep -qE 'Authorized Provider.*None' \
    "$root/docs/architecture/PRODUCT_PROVIDER_SELECTION.md" \
    || dg_fail "$DG_E_GOVERNANCE" "governance: Authorized Provider not confirmed as None"
}

# Check: endpoint_approval = "none" → Endpoints Approved: No
_dg_gov_check_endpoint() {
  local root="$1"
  grep -qE 'Endpoints Approved.*No' \
    "$root/docs/architecture/PROVIDER_ENDPOINT_ALLOWLIST.md" \
    || dg_fail "$DG_E_GOVERNANCE" "governance: Endpoint approval not confirmed as No"
}

# Check: real_provider = "prohibited" → Real Provider Prohibited
_dg_gov_check_real_provider() {
  local root="$1"
  grep -rqE 'Real Provider.*Prohibited' \
    "$root/docs/architecture/NON_GOALS.md" \
    "$root/docs/VERSION.md" \
    || dg_fail "$DG_E_GOVERNANCE" "governance: Real Provider Prohibited not confirmed"
}

# Check: external_io = "prohibited" → External IO Prohibited
_dg_gov_check_external_io() {
  local root="$1"
  grep -rqE 'External IO.*Prohibited' \
    "$root/docs/architecture/NON_GOALS.md" \
    "$root/docs/VERSION.md" \
    || dg_fail "$DG_E_GOVERNANCE" "governance: External IO Prohibited not confirmed"
}

# Check: automatic_publishing = "prohibited" → Automatic SNS Prohibited
_dg_gov_check_auto_publish() {
  local root="$1"
  grep -rqE 'Automatic SNS.*Prohibited' \
    "$root/docs/VERSION.md" \
    || dg_fail "$DG_E_GOVERNANCE" "governance: Automatic SNS Prohibited not confirmed"
}

dg_verify_governance() {
  local project_root="$1"
  local manifest="$2"

  local prov_auth endpoint_app real_prov ext_io auto_pub
  prov_auth="$(_dg_mget_str "$manifest" "provider_authorization" 2>/dev/null || echo "")"
  endpoint_app="$(_dg_mget_str "$manifest" "endpoint_approval" 2>/dev/null || echo "")"
  real_prov="$(_dg_mget_str "$manifest" "real_provider" 2>/dev/null || echo "")"
  ext_io="$(_dg_mget_str "$manifest" "external_io" 2>/dev/null || echo "")"
  auto_pub="$(_dg_mget_str "$manifest" "automatic_publishing" 2>/dev/null || echo "")"

  [[ "$prov_auth"   == "none"       ]] && _dg_gov_check_provider_auth  "$project_root"
  [[ "$endpoint_app" == "none"      ]] && _dg_gov_check_endpoint        "$project_root"
  [[ "$real_prov"   == "prohibited" ]] && _dg_gov_check_real_provider   "$project_root"
  [[ "$ext_io"      == "prohibited" ]] && _dg_gov_check_external_io     "$project_root"
  [[ "$auto_pub"    == "prohibited" ]] && _dg_gov_check_auto_publish    "$project_root"

  dg_info "governance verification passed"
}

# ── Quality and Catalog gates ────────────────────────────────────────────────
dg_run_quality() {
  local project_root="$1"
  local manifest="$2"

  local required
  required="$(_dg_mget_str "$manifest" "quality_required" 2>/dev/null || echo "true")"
  [[ "$required" == "false" ]] && { dg_warn "quality gate skipped (manifest: quality_required=false)"; return 0; }

  dg_info "running quality pipeline..."
  bash "$project_root/scripts/test_quality_pipeline.sh" \
    || dg_fail "$DG_E_QUALITY" "quality pipeline failed"
  dg_info "quality pipeline passed"
}

dg_run_catalog() {
  local project_root="$1"
  local manifest="$2"

  local required
  required="$(_dg_mget_str "$manifest" "catalog_required" 2>/dev/null || echo "true")"
  [[ "$required" == "false" ]] && { dg_warn "catalog gate skipped (manifest: catalog_required=false)"; return 0; }

  dg_info "running public contract catalog..."
  (cd "$project_root" && npm run public-contract:catalog --silent) \
    || dg_fail "$DG_E_CATALOG" "public contract catalog failed"
  dg_info "catalog passed"
}

# ── Commit subject validation ────────────────────────────────────────────────
dg_validate_commit_subject() {
  local manifest="$1"

  local subject
  subject="$(_dg_mget_str "$manifest" "commit_subject")"

  # Must be single-line (no newlines)
  local line_count
  line_count="$(printf '%s' "$subject" | wc -l | tr -d ' ')"
  [[ "$line_count" -eq 0 ]] \
    || dg_fail "$DG_E_COMMIT_ID" "commit_subject must be single-line (got $((line_count+1)) lines)"

  # Must be non-empty
  [[ -n "$subject" ]] \
    || dg_fail "$DG_E_COMMIT_ID" "commit_subject is empty"

  # Must not contain trailer patterns (case-insensitive check)
  local lower_subject
  lower_subject="$(printf '%s' "$subject" | tr '[:upper:]' '[:lower:]')"
  if printf '%s' "$lower_subject" | grep -qE '^(co-authored-by|signed-off-by|reviewed-by|change-id|trailer):'; then
    dg_fail "$DG_E_COMMIT_ID" "commit_subject must not begin with trailer keyword"
  fi

  # Must not contain embedded newline trailer patterns
  if printf '%s' "$subject" | grep -qE '(Co-authored-by:|Signed-off-by:|Reviewed-by:)'; then
    dg_fail "$DG_E_COMMIT_ID" "commit_subject contains forbidden trailer: $subject"
  fi

  dg_info "commit subject validated: $subject"
  printf '%s' "$subject"
}

# ── Exact staging (commit mode only) ────────────────────────────────────────
dg_stage_allowlist() {
  local project_root="$1"
  local manifest="$2"
  local dry_run="${3:-false}"

  local paths_to_stage=()
  while IFS= read -r p; do
    [[ -n "$p" ]] && paths_to_stage+=("$p")
  done < <(_dg_mget_arr "$manifest" "allowed_paths")

  # Empty-Allowlist guard: zero entries must never reach git add
  if [[ "${#paths_to_stage[@]}" -eq 0 ]]; then
    dg_info "stage_allowlist: allowed_paths is empty — deterministic safe no-op"
    [[ "$dry_run" == "true" ]] && dg_dry_print "# empty allowlist: nothing to stage"
    return 0
  fi

  if [[ "$dry_run" == "true" ]]; then
    dg_dry_print "git -C $project_root add -- ${paths_to_stage[*]}"
    return 0
  fi

  git -C "$project_root" add -- "${paths_to_stage[@]}" \
    || dg_fail "$DG_E_ALLOWLIST" "git add failed"
  dg_info "staged ${#paths_to_stage[@]} files from allowlist"
}

# ── commit-tree + update-ref CAS ────────────────────────────────────────────
dg_commit_tree_cas() {
  local project_root="$1"
  local manifest="$2"
  local dry_run="${3:-false}"

  local subject parent tree new_commit
  subject="$(dg_validate_commit_subject "$manifest")"
  parent="$(git -C "$project_root" rev-parse HEAD)"

  local expected_base
  expected_base="$(_dg_mget_str "$manifest" "expected_base_commit" 2>/dev/null || echo "")"
  if [[ -n "$expected_base" ]]; then
    [[ "$parent" == "$expected_base" ]] \
      || dg_fail "$DG_E_CAS" "CAS precondition: HEAD ($parent) != expected_base_commit ($expected_base)"
  fi

  if [[ "$dry_run" == "true" ]]; then
    tree="$(git -C "$project_root" write-tree)"
    dg_dry_print "git commit-tree $tree -p $parent  (subject: $subject)"
    dg_dry_print "git update-ref refs/heads/main <new_commit> $parent"
    dg_info "dry-run: tree=$tree from current staged index — stage intended files first for an accurate preview; parent=$parent"
    return 0
  fi

  tree="$(git -C "$project_root" write-tree)"
  new_commit="$(printf '%s\n' "$subject" | git -C "$project_root" commit-tree "$tree" -p "$parent")"
  [[ -n "$new_commit" ]] \
    || dg_fail "$DG_E_COMMIT_ID" "commit-tree produced empty SHA"

  git -C "$project_root" update-ref \
    -m "$subject" \
    refs/heads/main \
    "$new_commit" \
    "$parent" \
    || dg_fail "$DG_E_CAS" "update-ref CAS failed (ref may have moved)"

  printf '%s' "$new_commit"
  dg_info "commit created and ref updated: $new_commit"
}

# ── Commit identity verification ─────────────────────────────────────────────
dg_verify_commit_identity() {
  local project_root="$1"
  local manifest="$2"
  local expected_commit="$3"

  local subject
  subject="$(_dg_mget_str "$manifest" "commit_subject")"

  # Verify type
  local obj_type
  obj_type="$(git -C "$project_root" cat-file -t "$expected_commit")"
  [[ "$obj_type" == "commit" ]] \
    || dg_fail "$DG_E_COMMIT_ID" "object type mismatch: expected=commit got=$obj_type"

  # Verify single parent
  local parent_count
  parent_count="$(git -C "$project_root" show -s --format='%P' "$expected_commit" | wc -w | tr -d ' ')"
  [[ "$parent_count" -eq 1 ]] \
    || dg_fail "$DG_E_COMMIT_ID" "parent count mismatch: expected=1 got=$parent_count"

  # Verify subject
  local actual_subject
  actual_subject="$(git -C "$project_root" show -s --format='%s' "$expected_commit")"
  [[ "$actual_subject" == "$subject" ]] \
    || dg_fail "$DG_E_COMMIT_ID" "subject mismatch: expected='$subject' got='$actual_subject'"

  # Verify empty body
  local body
  body="$(git -C "$project_root" show -s --format='%b' "$expected_commit")"
  [[ -z "$body" ]] \
    || dg_fail "$DG_E_COMMIT_ID" "commit body must be empty, got: $body"

  # Verify no trailers
  local trailers
  trailers="$(git -C "$project_root" show -s --format='%B' "$expected_commit" | \
    git -C "$project_root" interpret-trailers --parse)"
  [[ -z "$trailers" ]] \
    || dg_fail "$DG_E_COMMIT_ID" "unexpected trailers: $trailers"

  dg_info "commit identity verified: $expected_commit"
}

# ── Push preflight ───────────────────────────────────────────────────────────
# Checks: branch=main, index clean (not working tree), divergence=0 N,
#         no tag at HEAD, origin/main == expected_remote_base
dg_push_preflight() {
  local project_root="$1"
  local manifest="$2"

  # Branch must be main
  local branch
  branch="$(git -C "$project_root" branch --show-current)"
  [[ "$branch" == "main" ]] \
    || dg_fail "$DG_E_PUSH_PRE" "push preflight: branch must be main, got $branch"

  # Index must be clean (nothing staged — working tree allowed to have unstaged changes)
  local staged
  staged="$(git -C "$project_root" diff --cached --name-status)"
  [[ -z "$staged" ]] \
    || dg_fail "$DG_E_PUSH_PRE" "push preflight: index is not clean — stage must be empty before push:\n$staged"

  # Divergence must be 0 N (local is ahead by at least 1)
  local diverge left right
  diverge="$(git -C "$project_root" rev-list --left-right --count origin/main...HEAD)"
  left="${diverge%%$'\t'*}"
  right="${diverge##*$'\t'}"
  [[ "$left" -eq 0 && "$right" -gt 0 ]] \
    || dg_fail "$DG_E_PUSH_PRE" "push preflight: unexpected divergence left=$left right=$right (expected 0 N)"

  # No tag at HEAD
  local head_tags
  head_tags="$(git -C "$project_root" tag --points-at HEAD)"
  [[ -z "$head_tags" ]] \
    || dg_fail "$DG_E_PUSH_PRE" "push preflight: unexpected tag at HEAD: $head_tags"

  # Force push prohibited
  local force_push
  force_push="$(_dg_mget_str "$manifest" "force_push" 2>/dev/null || echo "prohibited")"
  [[ "$force_push" != "allowed" ]] && dg_info "force_push=prohibited (safe)"

  # Tag push prohibited if tag_policy=none
  local tag_policy
  tag_policy="$(_dg_mget_str "$manifest" "tag_policy" 2>/dev/null || echo "none")"
  [[ "$tag_policy" == "none" ]] && dg_info "tag_policy=none: no tag will be pushed"

  # Verify origin/main against expected_remote_base (falls back to expected_base_commit)
  local expected_remote
  expected_remote="$(_dg_mget_str "$manifest" "expected_remote_base" 2>/dev/null || echo "")"
  if [[ -z "$expected_remote" ]]; then
    expected_remote="$(_dg_mget_str "$manifest" "expected_base_commit" 2>/dev/null || echo "")"
  fi
  if [[ -n "$expected_remote" ]]; then
    local actual_origin
    actual_origin="$(git -C "$project_root" rev-parse origin/main 2>/dev/null || echo "")"
    [[ "$actual_origin" == "$expected_remote" ]] \
      || dg_fail "$DG_E_PUSH_PRE" "push preflight: origin/main ($actual_origin) != expected_remote_base ($expected_remote) — remote may have advanced"
  fi

  dg_info "push preflight passed: branch=$branch diverge=0 $right"
}

# ── Push execution ───────────────────────────────────────────────────────────
dg_execute_push() {
  local project_root="$1"
  local manifest="$2"
  local dry_run="${3:-false}"

  if [[ "$dry_run" == "true" ]]; then
    dg_dry_print "git -C $project_root push origin main"
    return 0
  fi

  git -C "$project_root" push origin main \
    || dg_fail "$DG_E_PUSH" "git push failed"
  dg_info "push completed: origin main"
}

# ── Post-push verification ───────────────────────────────────────────────────
dg_post_push_verify() {
  local project_root="$1"

  git -C "$project_root" fetch origin main --quiet 2>/dev/null || true

  local head origin_main
  head="$(git -C "$project_root" rev-parse HEAD)"
  origin_main="$(git -C "$project_root" rev-parse origin/main)"

  [[ "$head" == "$origin_main" ]] \
    || dg_fail "$DG_E_POST_PUSH" "post-push: HEAD ($head) != origin/main ($origin_main)"

  local diverge
  diverge="$(git -C "$project_root" rev-list --left-right --count origin/main...HEAD)"
  [[ "$diverge" == "0	0" ]] \
    || dg_fail "$DG_E_POST_PUSH" "post-push: divergence not 0 0: $diverge"

  local head_tags
  head_tags="$(git -C "$project_root" tag --points-at HEAD)"
  [[ -z "$head_tags" ]] \
    || dg_fail "$DG_E_POST_PUSH" "post-push: unexpected tag at HEAD: $head_tags"

  dg_info "post-push verification passed: HEAD=$head divergence=0 0"
}

# ── Report generation ────────────────────────────────────────────────────────
dg_write_report() {
  local report_dir="$1"
  local mode="$2"
  local dry_run="$3"
  local manifest="$4"
  local project_root="$5"
  local decision="$6"
  local findings="${7:-}"

  mkdir -p "$report_dir"

  local ts branch head origin_main diverge
  ts="$(_dg_ts)"
  branch="$(git -C "$project_root" branch --show-current 2>/dev/null || echo "unknown")"
  head="$(git -C "$project_root" rev-parse HEAD 2>/dev/null || echo "unknown")"
  origin_main="$(git -C "$project_root" rev-parse origin/main 2>/dev/null || echo "unknown")"
  diverge="$(git -C "$project_root" rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo "?")"

  local change_id title commit_subject
  change_id="$(_dg_mget_str "$manifest" "change_id" 2>/dev/null || echo "unknown")"
  title="$(_dg_mget_str "$manifest" "title" 2>/dev/null || echo "unknown")"
  commit_subject="$(_dg_mget_str "$manifest" "commit_subject" 2>/dev/null || echo "unknown")"

  # Markdown report
  cat > "$report_dir/delivery-gate-report.md" << MDEOF
# Delivery Gate Report

| Item | Value |
|------|-------|
| Timestamp | $ts |
| Mode | $mode |
| Dry-run | $dry_run |
| Decision | $decision |
| Repository | $project_root |
| Branch | $branch |
| HEAD | $head |
| origin/main | $origin_main |
| Divergence | $diverge |
| Change ID | $change_id |
| Title | $title |
| Commit Subject | $commit_subject |

## Findings

$findings

## Exit

Decision: **$decision**
MDEOF

  # JSON report (via Node.js for safe serialization)
  node - "$report_dir/delivery-gate-report.json" \
    "$ts" "$mode" "$dry_run" "$decision" \
    "$project_root" "$branch" "$head" "$origin_main" "$diverge" \
    "$change_id" "$title" "$commit_subject" "$findings" <<'NODEEOF'
const [,,out,ts,mode,dry,dec,root,br,head,orig,div,cid,title,subj,find]=process.argv;
const obj={
  timestamp:ts, mode, dry_run:dry==='true', decision:dec,
  repository:root, branch:br, head, origin_main:orig, divergence:div,
  change_id:cid, title, commit_subject:subj, findings:find||''
};
require('fs').writeFileSync(out, JSON.stringify(obj,null,2)+'\n');
NODEEOF

  dg_info "reports written to $report_dir"
}

# ── Path safety ──────────────────────────────────────────────────────────────
# Returns 0 (safe) or 1 (unsafe). Does not exit — caller decides.
dg_is_safe_relative_path() {
  local p="$1"
  # Reject empty
  [[ -z "$p" ]] && return 1
  # Reject absolute paths
  [[ "$p" == /* ]] && return 1
  # Reject path traversal components
  case "$p" in
    ../*)  return 1 ;;
    */../*) return 1 ;;
    */..*)  return 1 ;;
    ..)    return 1 ;;
  esac
  # Reject newlines (bash pattern — IFS-safe)
  case "$p" in
    *$'\n'*) return 1 ;;
  esac
  return 0
}

# ── Separation plan parsing ───────────────────────────────────────────────────
# Mirror of _dg_mget_str/_dg_mget_arr/_dg_mbool for separation plans
dg_spget_str() {
  local f="$1" k="$2"
  node - "$f" "$k" <<'EOF'
const [,,f,k]=process.argv;
try{
  const m=JSON.parse(require('fs').readFileSync(f,'utf8'));
  if(m[k]===undefined||m[k]===null){process.exit(1);}
  process.stdout.write(String(m[k])+'\n');
}catch(e){process.stderr.write(e.message+'\n');process.exit(2);}
EOF
}

dg_spget_arr() {
  local f="$1" k="$2"
  node - "$f" "$k" <<'EOF'
const [,,f,k]=process.argv;
try{
  const m=JSON.parse(require('fs').readFileSync(f,'utf8'));
  const v=m[k];
  if(!Array.isArray(v)){process.exit(1);}
  v.forEach(x=>process.stdout.write(String(x)+'\n'));
}catch(e){process.stderr.write(e.message+'\n');process.exit(2);}
EOF
}

dg_spbool() {
  local f="$1" k="$2"
  node - "$f" "$k" <<'EOF'
const [,,f,k]=process.argv;
try{
  const m=JSON.parse(require('fs').readFileSync(f,'utf8'));
  process.exit(m[k]===true?0:1);
}catch(e){process.exit(2);}
EOF
}

# Validate separation plan has required fields and safe path values
dg_validate_separation_plan() {
  local plan="$1"
  [[ -f "$plan" ]] || dg_fail "$DG_E_MANIFEST" "separation plan not found: $plan"

  local required_fields="schema_version operation_id source_worktree destination_worktree destination_branch expected_head expected_origin stash_message expected_path_count"
  local field
  for field in $required_fields; do
    dg_spget_str "$plan" "$field" >/dev/null 2>&1 \
      || dg_fail "$DG_E_MANIFEST" "separation plan missing required field: $field"
  done

  # Validate safe defaults: commit_allowed and push_allowed must be false
  if dg_spbool "$plan" "commit_allowed" 2>/dev/null; then
    dg_fail "$DG_E_GOVERNANCE" "separation plan: commit_allowed must be false"
  fi
  if dg_spbool "$plan" "push_allowed" 2>/dev/null; then
    dg_fail "$DG_E_GOVERNANCE" "separation plan: push_allowed must be false"
  fi

  # Validate path safety for all exact_paths
  local path_entry
  while IFS= read -r path_entry; do
    [[ -z "$path_entry" ]] && continue
    dg_is_safe_relative_path "$path_entry" \
      || dg_fail "$DG_E_FORBIDDEN" "separation plan: unsafe path in exact_paths: $path_entry"
  done < <(dg_spget_arr "$plan" "exact_paths" 2>/dev/null || true)

  # Validate destination paths are absolute and not traversal
  local dest_wt dest_br
  dest_wt="$(dg_spget_str "$plan" "destination_worktree")"
  dest_br="$(dg_spget_str "$plan" "destination_branch")"
  [[ "$dest_wt" == /* ]] || dg_fail "$DG_E_MANIFEST" "destination_worktree must be absolute path: $dest_wt"
  case "$dest_wt" in
    */../*|*/..) dg_fail "$DG_E_FORBIDDEN" "destination_worktree contains traversal: $dest_wt" ;;
  esac
  [[ -n "$dest_br" ]] || dg_fail "$DG_E_MANIFEST" "destination_branch is empty"

  dg_info "separation plan validated: $plan"
}

# Execute or preview workstream separation
# dg_run_separate <project_root> <plan> <dry_run>
dg_run_separate() {
  local project_root="$1"
  local plan="$2"
  local dry_run="${3:-false}"

  dg_validate_separation_plan "$plan"

  local dest_wt dest_br expected_head stash_msg path_count
  dest_wt="$(dg_spget_str "$plan" "destination_worktree")"
  dest_br="$(dg_spget_str "$plan" "destination_branch")"
  expected_head="$(dg_spget_str "$plan" "expected_head")"
  stash_msg="$(dg_spget_str "$plan" "stash_message")"
  path_count="$(dg_spget_str "$plan" "expected_path_count")"

  # Preflight: HEAD matches
  local actual_head
  actual_head="$(git -C "$project_root" rev-parse HEAD)"
  [[ "$actual_head" == "$expected_head" ]] \
    || dg_fail "$DG_E_REPO" "separate: HEAD ($actual_head) != expected_head ($expected_head)"

  # Preflight: branch must not exist
  if git -C "$project_root" show-ref --verify --quiet "refs/heads/$dest_br" 2>/dev/null; then
    dg_fail "$DG_E_REPO" "separate: branch already exists: $dest_br"
  fi

  # Preflight: destination path must not exist
  if test -e "$dest_wt"; then
    dg_fail "$DG_E_REPO" "separate: destination path already exists: $dest_wt"
  fi

  # Collect paths
  local plan_paths=()
  while IFS= read -r p; do
    [[ -n "$p" ]] || continue
    dg_is_safe_relative_path "$p" \
      || dg_fail "$DG_E_FORBIDDEN" "separate: unsafe path: $p"
    plan_paths+=("$p")
  done < <(dg_spget_arr "$plan" "exact_paths")

  local actual_count="${#plan_paths[@]}"
  [[ "$actual_count" -eq "$path_count" ]] \
    || dg_fail "$DG_E_ALLOWLIST" "separate: path count mismatch: plan=$path_count actual=$actual_count"

  if [[ "$dry_run" == "true" ]]; then
    dg_dry_print "git -C $project_root stash push --include-untracked -m '$stash_msg' -- (${actual_count} paths)"
    dg_dry_print "git -C $project_root branch $dest_br"
    dg_dry_print "git -C $project_root worktree add $dest_wt $dest_br"
    dg_dry_print "git -C $dest_wt stash apply <TRANSFER_STASH_SHA>"
    dg_info "dry-run: $actual_count paths, branch=$dest_br worktree=$dest_wt"
    return 0
  fi

  # Execute: scoped stash
  git -C "$project_root" stash push \
    --include-untracked \
    -m "$stash_msg" \
    -- "${plan_paths[@]}" \
    || dg_fail "$DG_E_ALLOWLIST" "separate: git stash push failed"

  local transfer_stash
  transfer_stash="$(git -C "$project_root" rev-parse refs/stash)"
  dg_info "transfer stash created: $transfer_stash"

  # Create branch
  git -C "$project_root" branch "$dest_br" \
    || dg_fail "$DG_E_REPO" "separate: branch creation failed: $dest_br"
  dg_info "branch created: $dest_br"

  # Create worktree
  git -C "$project_root" worktree add "$dest_wt" "$dest_br" \
    || dg_fail "$DG_E_REPO" "separate: worktree add failed: $dest_wt"
  dg_info "worktree created: $dest_wt"

  # Apply stash to worktree
  git -C "$dest_wt" stash apply "$transfer_stash" \
    || dg_fail "$DG_E_ALLOWLIST" "separate: stash apply failed in worktree $dest_wt"
  dg_info "stash applied to worktree: $actual_count paths"

  dg_info "separation complete: transfer stash=$transfer_stash retained for hash verification"
  printf '%s\n' "$transfer_stash"
}

# ── Staging: exact bounded staging from manifest ──────────────────────────────
# dg_stage_exact: stages exactly the allowlist files, with pre and post verification.
# Pre-check: ensure no non-allowlist files are staged; allowlist files must be present.
# Post-check: staged set must equal allowlist exactly.
dg_stage_exact() {
  local project_root="$1"
  local manifest="$2"
  local dry_run="${3:-false}"

  # Read allowlist
  local stage_paths=()
  while IFS= read -r p; do
    [[ -n "$p" ]] && stage_paths+=("$p")
  done < <(_dg_mget_arr "$manifest" "allowed_paths")

  local expected_count
  expected_count="$(_dg_mget_str "$manifest" "expected_file_count")"

  if [[ "${#stage_paths[@]}" -eq 0 ]]; then
    dg_info "stage: allowed_paths is empty — nothing to stage"
    return 0
  fi

  if [[ "$dry_run" == "true" ]]; then
    dg_dry_print "git -C $project_root add -- ${stage_paths[*]}"
    dg_info "dry-run: would stage ${#stage_paths[@]} files (expected_file_count=$expected_count)"
    return 0
  fi

  if ! git -C "$project_root" add -- "${stage_paths[@]}"; then
    # Partial-stage rollback: unstage any files from allowlist that may have been staged
    dg_warn "stage: git add failed; rolling back staged allowlist files"
    git -C "$project_root" reset HEAD -- "${stage_paths[@]}" 2>/dev/null || true
    dg_fail "$DG_E_ALLOWLIST" "stage: git add failed; index rolled back to pre-stage state"
  fi

  dg_info "staged ${#stage_paths[@]} files from allowlist"
}

# Post-stage verification: staged set must match allowlist exactly.
dg_verify_staged_scope() {
  local project_root="$1"
  local manifest="$2"

  local staged_paths expected_paths
  staged_paths="$(git -C "$project_root" diff --cached --name-only | sort)"
  expected_paths="$(_dg_mget_arr "$manifest" "allowed_paths" | sort)"

  local expected_count staged_count
  expected_count="$(_dg_mget_str "$manifest" "expected_file_count")"
  staged_count="$(printf '%s\n' "$staged_paths" | grep -c . || echo 0)"

  local diff_out
  diff_out="$(diff <(printf '%s\n' "$expected_paths") <(printf '%s\n' "$staged_paths") 2>/dev/null || true)"
  if [[ -n "$diff_out" ]]; then
    dg_error "post-stage scope mismatch (expected vs staged):"
    printf '%s\n' "$diff_out" >&2
    exit "$DG_E_STAGED"
  fi

  [[ "$staged_count" -eq "$expected_count" ]] \
    || dg_fail "$DG_E_STAGED" "post-stage count: expected=$expected_count staged=$staged_count"

  git -C "$project_root" diff --cached --check \
    || dg_fail "$DG_E_ALLOWLIST" "post-stage diff --check failed (whitespace/conflict marker)"

  dg_info "post-stage verification: $staged_count files staged correctly"
}

# ── Verify: auto-detect delivery state and verify accordingly ──────────────────
# Detects: staged → check staged vs allowlist; working → check dirty vs allowlist
dg_detect_delivery_state() {
  local project_root="$1"
  local staged_count working_count
  staged_count="$(git -C "$project_root" diff --cached --name-only | grep -c . 2>/dev/null || echo 0)"
  working_count="$(git -C "$project_root" diff --name-only | grep -c . 2>/dev/null || echo 0)"
  if [[ "$staged_count" -gt 0 ]]; then
    printf 'staged\n'
  elif [[ "$working_count" -gt 0 ]]; then
    printf 'working\n'
  else
    printf 'clean\n'
  fi
}

# ── Worktree Health assessment ────────────────────────────────────────────────
# Returns one of: HEALTHY | SAFE_INTENTIONALLY_DIRTY | RECOVERY_REQUIRED | UNSAFE_OR_AMBIGUOUS
# HEALTHY:                 clean working tree or staged == allowlist exactly
# SAFE_INTENTIONALLY_DIRTY: unstaged SNS-only content, main not contaminated
# RECOVERY_REQUIRED:       detected conflicts or partial staging needing repair
# UNSAFE_OR_AMBIGUOUS:    SNS content staged in wrong worktree or unknown state
dg_worktree_health() {
  local project_root="$1"
  local manifest="${2:-}"

  local staged_count dirty_count conflict_count
  staged_count="$(git -C "$project_root" diff --cached --name-only 2>/dev/null | grep -c . || echo 0)"
  dirty_count="$(git -C "$project_root" diff --name-only 2>/dev/null | grep -c . || echo 0)"
  conflict_count="$(git -C "$project_root" diff --name-only --diff-filter=U 2>/dev/null | grep -c . || echo 0)"

  # Conflicts always require recovery
  if [[ "$conflict_count" -gt 0 ]]; then
    printf 'RECOVERY_REQUIRED\n'
    return
  fi

  # SNS content staged in main worktree = main contamination risk
  local sns_staged
  sns_staged="$(git -C "$project_root" diff --cached --name-only 2>/dev/null \
    | grep -E "$_DG_SNS_PATH_PATTERN" | head -1 || echo "")"
  if [[ -n "$sns_staged" ]]; then
    printf 'UNSAFE_OR_AMBIGUOUS\n'
    return
  fi

  # Nothing staged, nothing dirty = clean
  if [[ "$staged_count" -eq 0 && "$dirty_count" -eq 0 ]]; then
    printf 'HEALTHY\n'
    return
  fi

  # Staged present with manifest: verify exact match
  if [[ "$staged_count" -gt 0 && -n "$manifest" && -f "$manifest" ]]; then
    local staged_paths expected_paths
    staged_paths="$(git -C "$project_root" diff --cached --name-only 2>/dev/null | sort)"
    expected_paths="$(_dg_mget_arr "$manifest" "allowed_paths" 2>/dev/null | sort || echo "")"
    if [[ "$staged_paths" == "$expected_paths" ]]; then
      printf 'HEALTHY\n'
    else
      printf 'UNSAFE_OR_AMBIGUOUS\n'
    fi
    return
  fi

  # Staged present without manifest: report but don't block
  if [[ "$staged_count" -gt 0 ]]; then
    printf 'UNSAFE_OR_AMBIGUOUS\n'
    return
  fi

  # Only unstaged dirty: check if all dirty are SNS-isolation paths (intentional)
  local non_sns_dirty
  non_sns_dirty="$(git -C "$project_root" diff --name-only 2>/dev/null \
    | grep -vE "$_DG_SNS_PATH_PATTERN" | head -1 || echo "")"
  if [[ -z "$non_sns_dirty" && "$dirty_count" -gt 0 ]]; then
    printf 'SAFE_INTENTIONALLY_DIRTY\n'
    return
  fi

  # Mixed dirty (implementation + SNS content) — HEALTHY as long as nothing staged
  # Non-SNS dirty files are implementation work waiting to be staged
  printf 'HEALTHY\n'
}

# ── Operation Eligibility ─────────────────────────────────────────────────────
# Returns: ELIGIBLE | NOT_ELIGIBLE:<reason>
# operation: verify | stage | commit | publish | restore | separate | full
dg_operation_eligibility() {
  local project_root="$1"
  local manifest="${2:-}"
  local operation="${3:-verify}"

  local staged_count dirty_count
  staged_count="$(git -C "$project_root" diff --cached --name-only 2>/dev/null | grep -c . || echo 0)"
  dirty_count="$(git -C "$project_root" diff --name-only 2>/dev/null | grep -c . || echo 0)"

  case "$operation" in
    verify)
      # Always eligible — verify is read-only
      printf 'ELIGIBLE\n'
      ;;
    stage)
      # Eligible only when nothing staged (clean index)
      if [[ "$staged_count" -gt 0 ]]; then
        printf 'NOT_ELIGIBLE:index_not_clean\n'
      else
        printf 'ELIGIBLE\n'
      fi
      ;;
    commit)
      # Eligible when staged files match allowlist (or just in dry-run: manifest valid)
      if [[ "$staged_count" -eq 0 ]]; then
        printf 'NOT_ELIGIBLE:nothing_staged\n'
      else
        printf 'ELIGIBLE\n'
      fi
      ;;
    publish)
      # Eligible when: staged=0, HEAD ahead of origin, HEAD != origin/main
      if [[ "$staged_count" -gt 0 ]]; then
        printf 'NOT_ELIGIBLE:index_not_clean\n'
        return
      fi
      local diverge left right
      diverge="$(git -C "$project_root" rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo "0	0")"
      left="${diverge%%$'\t'*}"
      right="${diverge##*$'\t'}"
      if [[ "$left" -gt 0 ]]; then
        printf 'NOT_ELIGIBLE:local_behind_remote\n'
      elif [[ "$right" -eq 0 ]]; then
        printf 'NOT_ELIGIBLE:nothing_committed\n'
      else
        printf 'ELIGIBLE\n'
      fi
      ;;
    restore)
      printf 'ELIGIBLE\n'
      ;;
    separate)
      if [[ "$staged_count" -gt 0 ]]; then
        printf 'NOT_ELIGIBLE:index_not_clean\n'
      elif [[ "$dirty_count" -eq 0 ]]; then
        printf 'NOT_ELIGIBLE:nothing_to_separate\n'
      else
        printf 'ELIGIBLE\n'
      fi
      ;;
    full)
      # full is eligible when: nothing staged and working tree has changes
      if [[ "$staged_count" -gt 0 ]]; then
        printf 'NOT_ELIGIBLE:index_not_clean\n'
      else
        printf 'ELIGIBLE\n'
      fi
      ;;
    *)
      printf 'ELIGIBLE\n'
      ;;
  esac
}

# ── Operational Health Report ─────────────────────────────────────────────────
# Emits structured health lines to stderr. Exits 0 if operationally ready.
# Parameters: project_root manifest operation
dg_operational_health_report() {
  local project_root="$1"
  local manifest="${2:-}"
  local operation="${3:-verify}"

  local all_pass=true

  _dg_health_line() {
    local category="$1" status="$2"
    if [[ "$status" == PASS* || "$status" == HEALTHY* || "$status" == SAFE_INTENTIONALLY_DIRTY* || "$status" == ELIGIBLE* ]]; then
      printf '[DG HEALTH] %-22s %s\n' "$category" "$status" >&2
    else
      printf '[DG HEALTH] %-22s %s\n' "$category" "$status" >&2
      all_pass=false
    fi
  }

  # Repository Health
  local branch
  branch="$(git -C "$project_root" branch --show-current 2>/dev/null || echo "unknown")"
  local expected_branch
  expected_branch="$( [[ -n "$manifest" && -f "$manifest" ]] && _dg_mget_str "$manifest" "base_branch" 2>/dev/null || echo "main" )"
  if [[ "$branch" == "$expected_branch" ]]; then
    _dg_health_line "Repository" "PASS branch=$branch"
  else
    _dg_health_line "Repository" "FAIL branch=$branch expected=$expected_branch"
  fi

  # Allowlist Health (if manifest provided)
  if [[ -n "$manifest" && -f "$manifest" ]]; then
    local expected_count
    expected_count="$(_dg_mget_str "$manifest" "expected_file_count" 2>/dev/null || echo "?")"
    _dg_health_line "Allowlist" "PASS expected_count=$expected_count"
  else
    _dg_health_line "Allowlist" "PASS (no manifest)"
  fi

  # CAS Health: HEAD identity
  local head head_short
  head="$(git -C "$project_root" rev-parse HEAD 2>/dev/null || echo "unknown")"
  head_short="${head:0:12}"
  local diverge
  diverge="$(git -C "$project_root" rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo "?")"
  _dg_health_line "CAS" "PASS head=${head_short} diverge=${diverge}"

  # Worktree Health
  local wt_health
  wt_health="$(dg_worktree_health "$project_root" "${manifest:-}")"
  _dg_health_line "Worktree" "$wt_health"

  # Separation Health (advisory — does not fail)
  local wt_count
  wt_count="$(git -C "$project_root" worktree list --porcelain 2>/dev/null | grep -c '^worktree ' || echo 0)"
  _dg_health_line "Separation" "PASS worktrees=$wt_count"

  # Quality and Catalog health below reflect results from dg_run_quality and
  # dg_run_catalog already executed by the canonical verify flow. This section
  # does not re-execute those checks; it confirms required/skipped status.
  # Quality Health (only if quality_required and manifest present)
  if [[ -n "$manifest" && -f "$manifest" ]]; then
    local quality_req
    quality_req="$(_dg_mget_str "$manifest" "quality_required" 2>/dev/null || echo "true")"
    if [[ "$quality_req" == "false" ]]; then
      _dg_health_line "Quality" "PASS (quality_required=false)"
    else
      _dg_health_line "Quality" "PASS (verified by dg_run_quality)"
    fi
  else
    _dg_health_line "Quality" "PASS (no manifest)"
  fi

  # Catalog Health
  if [[ -n "$manifest" && -f "$manifest" ]]; then
    local catalog_req
    catalog_req="$(_dg_mget_str "$manifest" "catalog_required" 2>/dev/null || echo "true")"
    if [[ "$catalog_req" == "false" ]]; then
      _dg_health_line "Catalog" "PASS (catalog_required=false)"
    else
      _dg_health_line "Catalog" "PASS (verified by dg_run_catalog)"
    fi
  else
    _dg_health_line "Catalog" "PASS (no manifest)"
  fi

  # Operation Eligibility
  local eligibility
  eligibility="$(dg_operation_eligibility "$project_root" "${manifest:-}" "$operation")"
  _dg_health_line "Eligibility[$operation]" "$eligibility"

  # Summary
  printf '[DG HEALTH] ──────────────────────────────────────\n' >&2
  if [[ "$all_pass" == "true" ]]; then
    printf '[DG HEALTH] OPERATIONAL READY\n' >&2
    return 0
  else
    printf '[DG HEALTH] SAFE STOP\n' >&2
    return "$DG_E_HEALTH"
  fi
}

# ── Separation topology verification ─────────────────────────────────────────
# Checks registered worktrees are in expected state. Also checks main worktree
# for SNS content contamination. Reports advisory findings; does not fail.
dg_verify_separation_topology() {
  local project_root="$1"
  local worktrees
  worktrees="$(git -C "$project_root" worktree list --porcelain)"

  local wt_count
  wt_count="$(printf '%s\n' "$worktrees" | grep -c '^worktree ' || echo 0)"

  dg_info "separation topology: $wt_count worktree(s) registered"

  # Main contamination check: SNS content staged in main
  local sns_staged_count
  sns_staged_count="$(git -C "$project_root" diff --cached --name-only 2>/dev/null \
    | grep -cE "$_DG_SNS_PATH_PATTERN" || echo 0)"
  if [[ "$sns_staged_count" -gt 0 ]]; then
    dg_warn "separation: MAIN CONTAMINATION — $sns_staged_count SNS path(s) staged in main worktree"
  fi

  # Report each linked worktree
  local wt_path wt_head wt_branch
  while IFS= read -r line; do
    case "$line" in
      worktree\ *) wt_path="${line#worktree }"; wt_head=""; wt_branch="" ;;
      HEAD\ *)     wt_head="${line#HEAD }" ;;
      branch\ *)   wt_branch="${line#branch refs/heads/}" ;;
      "")
        if [[ -n "$wt_path" && "$wt_path" != "$project_root" ]]; then
          if [[ -d "$wt_path" ]]; then
            local dirty_count
            dirty_count="$(git -C "$wt_path" diff --name-only 2>/dev/null | grep -c . || echo 0)"
            local wt_health
            wt_health="$(dg_worktree_health "$wt_path" "")"
            dg_info "  worktree: $wt_path branch=$wt_branch head=${wt_head:0:12} dirty=$dirty_count health=$wt_health"
          else
            dg_warn "  worktree: $wt_path — directory MISSING (stale registration)"
          fi
        fi
        ;;
    esac
  done <<EOF
$worktrees

EOF
}

# ── Restore: apply transfer stash from a restoration record ───────────────────
# dg_run_restore <project_root> <record_file> <dry_run>
dg_run_restore() {
  local project_root="$1"
  local record="$2"
  local dry_run="${3:-false}"

  [[ -f "$record" ]] || dg_fail "$DG_E_MANIFEST" "restore: record file not found: $record"

  # Read record fields
  local stash_sha stash_msg expected_count dest_wt
  stash_sha="$(dg_spget_str "$record" "stash_sha" 2>/dev/null)" \
    || dg_fail "$DG_E_MANIFEST" "restore: record missing stash_sha"
  stash_msg="$(dg_spget_str "$record" "stash_message" 2>/dev/null)" \
    || dg_fail "$DG_E_MANIFEST" "restore: record missing stash_message"
  expected_count="$(dg_spget_str "$record" "expected_path_count" 2>/dev/null)" \
    || dg_fail "$DG_E_MANIFEST" "restore: record missing expected_path_count"
  dest_wt="$(dg_spget_str "$record" "destination_worktree" 2>/dev/null)" \
    || dg_fail "$DG_E_MANIFEST" "restore: record missing destination_worktree"

  # Verify stash object exists and identity matches
  local actual_stash_type
  actual_stash_type="$(git -C "$project_root" cat-file -t "$stash_sha" 2>/dev/null || echo "")"
  [[ "$actual_stash_type" == "commit" ]] \
    || dg_fail "$DG_E_MANIFEST" "restore: stash object not found or not a commit: $stash_sha"

  # Verify stash is still registered (in stash list)
  local stash_list_sha
  stash_list_sha="$(git -C "$project_root" stash list --format='%H' | grep -F "$stash_sha" || echo "")"
  [[ -n "$stash_list_sha" ]] \
    || dg_fail "$DG_E_MANIFEST" "restore: stash $stash_sha is not in stash list (may have been dropped)"

  # Verify destination worktree exists
  [[ -d "$dest_wt" ]] \
    || dg_fail "$DG_E_REPO" "restore: destination worktree not found: $dest_wt"

  # Verify destination worktree has no conflicts
  local dest_conflicts
  dest_conflicts="$(git -C "$dest_wt" diff --name-only --diff-filter=U 2>/dev/null || echo "")"
  [[ -z "$dest_conflicts" ]] \
    || dg_fail "$DG_E_ALLOWLIST" "restore: destination worktree has conflicts: $dest_conflicts"

  dg_info "restore: stash identity verified ($stash_sha)"
  dg_info "restore: destination worktree exists ($dest_wt)"

  if [[ "$dry_run" == "true" ]]; then
    dg_dry_print "git -C $dest_wt stash apply $stash_sha"
    dg_info "dry-run: would apply $expected_count paths to $dest_wt"
    return 0
  fi

  # Apply stash to destination worktree
  git -C "$dest_wt" stash apply "$stash_sha" \
    || dg_fail "$DG_E_ALLOWLIST" "restore: stash apply failed in $dest_wt"

  # Post-apply count verification
  local restored_count
  restored_count="$(git -C "$dest_wt" diff --name-only | grep -c . || echo 0)"
  [[ "$restored_count" -ge "$expected_count" ]] \
    || dg_fail "$DG_E_ALLOWLIST" "restore: path count after apply: expected>=$expected_count got=$restored_count"

  dg_info "restore: $restored_count paths applied to $dest_wt"
  dg_info "restore: stash $stash_sha RETAINED — run hash verification before dropping"
  printf '%s\n' "$stash_sha"
}

# ── Separate: generate restoration record after successful separation ──────────
# Called from dg_run_separate after successful apply; writes record to report dir.
_dg_write_restoration_record() {
  local project_root="$1"
  local plan="$2"
  local stash_sha="$3"
  local report_dir="$4"

  mkdir -p "$report_dir"

  local operation_id dest_wt dest_br expected_head stash_msg path_count
  operation_id="$(dg_spget_str "$plan" "operation_id" 2>/dev/null || echo "unknown")"
  dest_wt="$(dg_spget_str "$plan" "destination_worktree")"
  dest_br="$(dg_spget_str "$plan" "destination_branch")"
  expected_head="$(dg_spget_str "$plan" "expected_head")"
  stash_msg="$(dg_spget_str "$plan" "stash_message")"
  path_count="$(dg_spget_str "$plan" "expected_path_count")"

  local ts record_id
  ts="$(date '+%Y-%m-%dT%H:%M:%S')"
  record_id="${operation_id}-$(date '+%Y%m%d_%H%M%S')"

  local record_path="$report_dir/restoration-record-${record_id}.json"

  # Build exact_paths JSON array via Node.js
  node - "$plan" "$record_path" \
    "$record_id" "$ts" "$operation_id" "$stash_sha" "$stash_msg" \
    "$project_root" "$dest_wt" "$dest_br" "$expected_head" "$path_count" <<'NODEEOF'
const [,,plan,out,rid,ts,opid,sha,msg,src,dwt,dbr,head,cnt]=process.argv;
const fs=require('fs');
const m=JSON.parse(fs.readFileSync(plan,'utf8'));
const rec={
  schema_version:'1.0',
  record_id:rid,
  created_at:ts,
  operation_id:opid,
  stash_sha:sha,
  stash_message:msg,
  source_worktree:src,
  destination_worktree:dwt,
  destination_branch:dbr,
  expected_head_at_separation:head,
  exact_paths:m.exact_paths||[],
  expected_path_count:parseInt(cnt,10),
  stash_dropped:false,
  verified:false
};
fs.writeFileSync(out,JSON.stringify(rec,null,2)+'\n');
NODEEOF

  dg_info "restoration record written: $record_path"
  printf '%s\n' "$record_path"
}
