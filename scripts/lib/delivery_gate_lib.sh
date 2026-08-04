#!/usr/bin/env bash
# Delivery Gate shared library — Bash 3.2 compatible (macOS default)
# Source this file; do not execute directly.

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
# Check branch, HEAD vs expected_base_commit, divergence
dg_preflight_repo() {
  local manifest="$1"
  local project_root="$2"

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
    [[ "$actual_head" == "$expected_base" ]] \
      || dg_fail "$DG_E_REPO" "base commit mismatch: expected=$expected_base actual=$actual_head"
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
    dg_info "dry-run: commit-tree + CAS would target parent=$parent tree=$tree"
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
dg_push_preflight() {
  local project_root="$1"
  local manifest="$2"

  # Branch must be main
  local branch
  branch="$(git -C "$project_root" branch --show-current)"
  [[ "$branch" == "main" ]] \
    || dg_fail "$DG_E_PUSH_PRE" "push preflight: branch must be main, got $branch"

  # Working tree must be clean
  local dirty
  dirty="$(git -C "$project_root" status --short)"
  [[ -z "$dirty" ]] \
    || dg_fail "$DG_E_PUSH_PRE" "push preflight: working tree not clean"

  # Divergence must be 0 N (ahead, not behind)
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
