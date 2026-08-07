#!/usr/bin/env bash
# Delivery Gate — Accelerated Delivery entrypoint
# Bash 3.2 compatible (macOS default)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB="$SCRIPT_DIR/lib/delivery_gate_lib.sh"

[[ -f "$LIB" ]] || { echo "[DG ERROR] library not found: $LIB" >&2; exit 1; }
# shellcheck source=lib/delivery_gate_lib.sh
source "$LIB"

# ── Defaults ─────────────────────────────────────────────────────────────────
DG_DRY_RUN=false
DG_EXECUTE=false
DG_MANIFEST=""
DG_PLAN=""
DG_REPORT_DIR="$PROJECT_ROOT/reports/delivery-gate/latest"
DG_NO_NETWORK=false
DG_VERBOSE=false
DG_MODE=""
DG_PLAN_ONLY=false

# ── Usage ────────────────────────────────────────────────────────────────────
usage() {
  cat >&2 << 'USAGE'
Usage: delivery_gate.sh <mode> [options]
       ./scripts/dg    <mode> [options]   (short entry point)

Safety Classes:
  Class R — Read Only   : verify, prepare, report, help
    No --execute required. No --dry-run needed. No mutations.
  Class L — Local Mutation : commit, separate, restore
    Requires --execute to apply mutations.
    Without --execute or --dry-run: displays execution plan only (no mutations).
    --dry-run: shows detailed plan; still no mutations.
    --execute: applies bounded, auditable mutations.
  Class N — Network Mutation : publish (includes push)
    Requires --execute to push. Same --dry-run / --execute model as Class L.
    Force push prohibited. Tag push prohibited when tag_policy=none.

Modes:
  help                      [R] Show this help message
  verify   --manifest <f>   [R] Read-only: verify repo, scope, governance, Quality, Catalog
  prepare  --manifest <f>   [R] Verify + show what staging would do (always read-only)
  commit   --manifest <f>   [L] Verify + stage + commit-tree + CAS
  publish  --manifest <f>   [N] Verify + commit + push + post-push verify
  full     --manifest <f>   [L+N] All steps in sequence
  report   --manifest <f>   [R] Generate report from current repo state
  separate --plan <f>       [L] Separate exact path set to dedicated branch+worktree
  restore  --record <f>     [L] Restore previously separated work (planned — not yet implemented)

Options:
  --manifest <path>         Path to JSON manifest file (required for delivery modes)
  --plan <path>             Path to JSON separation plan file (required for separate mode)
  --execute                 Apply mutations (required for Class L/N without --dry-run)
  --dry-run                 Print planned actions; do NOT modify repo, index, or remote
  --report-dir <path>       Output directory for reports (default: reports/delivery-gate/latest)
  --no-network              Skip steps that require network access
  --verbose                 Enable verbose output

Confirmation-minimization model:
  Class R  : no confirmation needed — zero mutations possible
  Class L/N: one confirmation point per operation
    Without --execute  → execution plan displayed, exit 0, no mutations
    With --dry-run     → same as above (explicit preview)
    With --execute     → bounded operation executes; one Bash call per operation

Exit codes:
  0   success
  1   invalid usage
  2   repository identity failure
  3   dirty working tree
  4   staged state mismatch
  5   allowlist mismatch
  6   forbidden path detected
  7   delete detected
  8   rename detected
  9   governance violation
  10  quality failure
  11  catalog failure
  12  commit identity failure
  13  CAS failure
  14  push preflight failure
  15  push failure
  16  post-push verification failure
  17  manifest schema failure
  18  unexpected untracked file

Safety model:
  - default deny; explicit allowlist / plan only
  - no implicit git add . or git add -A
  - no normal git commit; commit-tree + update-ref CAS only
  - no automatic tag creation; no force push
  - no Provider Authorization; no Endpoint Approval; no Real Provider enablement
  - Class L/N: --execute required to apply any mutation

USAGE
  exit "${1:-$DG_E_USAGE}"
}

# ── Argument parsing ─────────────────────────────────────────────────────────
[[ $# -lt 1 ]] && usage "$DG_E_USAGE"
DG_MODE="$1"; shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)    [[ $# -gt 1 ]] || usage "$DG_E_USAGE"; DG_MANIFEST="$2"; shift 2 ;;
    --plan)        [[ $# -gt 1 ]] || usage "$DG_E_USAGE"; DG_PLAN="$2"; shift 2 ;;
    --execute)     DG_EXECUTE=true; shift ;;
    --dry-run)     DG_DRY_RUN=true; shift ;;
    --report-dir)  [[ $# -gt 1 ]] || usage "$DG_E_USAGE"; DG_REPORT_DIR="$2"; shift 2 ;;
    --no-network)  DG_NO_NETWORK=true; shift ;;
    --verbose)     DG_VERBOSE=true; shift ;;
    --help|-h)     usage "$DG_E_SUCCESS" ;;
    *) dg_fail "$DG_E_USAGE" "unknown option: $1" ;;
  esac
done

[[ "$DG_VERBOSE" == "true" ]] && set -x

# ── Mode: help ───────────────────────────────────────────────────────────────
if [[ "$DG_MODE" == "help" ]]; then
  usage "$DG_E_SUCCESS"
fi

# ── Manifest / plan routing ───────────────────────────────────────────────────
if [[ "$DG_MODE" == "separate" ]]; then
  [[ -n "$DG_PLAN" ]] || dg_fail "$DG_E_USAGE" "--plan is required for mode: separate"
elif [[ "$DG_MODE" == "restore" ]]; then
  [[ -n "$DG_PLAN" ]] || dg_fail "$DG_E_USAGE" "--plan (record path) is required for mode: restore"
else
  [[ -n "$DG_MANIFEST" ]] || dg_fail "$DG_E_USAGE" "--manifest is required for mode: $DG_MODE"
fi

# ── Class L/N safety gate ─────────────────────────────────────────────────────
# For mutation modes: without --execute or --dry-run, display plan and exit 0
_dg_class_l_gate() {
  local mode="$1"
  if [[ "$DG_DRY_RUN" != "true" && "$DG_EXECUTE" != "true" ]]; then
    dg_warn "Class L/N '$mode': --execute not specified. Displaying execution plan."
    dg_warn "  --dry-run : preview execution plan (no mutations)"
    dg_warn "  --execute : apply bounded mutations"
    DG_DRY_RUN=true
    DG_PLAN_ONLY=true
  fi
}

# ── Common verify steps (shared by all operational modes) ────────────────────
_run_verify_steps() {
  dg_validate_manifest "$DG_MANIFEST"
  dg_preflight_repo "$DG_MANIFEST" "$PROJECT_ROOT"
  dg_check_clean_staged "$PROJECT_ROOT"
  dg_check_no_unexpected_untracked "$PROJECT_ROOT" "$DG_MANIFEST"
  dg_verify_allowlist "$PROJECT_ROOT" "$DG_MANIFEST"
  dg_verify_governance "$PROJECT_ROOT" "$DG_MANIFEST"
  dg_run_quality "$PROJECT_ROOT" "$DG_MANIFEST"
  dg_run_catalog "$PROJECT_ROOT" "$DG_MANIFEST"
}

# ── Common commit steps ──────────────────────────────────────────────────────
_run_commit_steps() {
  dg_validate_commit_subject "$DG_MANIFEST" >/dev/null
  dg_stage_allowlist "$PROJECT_ROOT" "$DG_MANIFEST" "$DG_DRY_RUN"
  if [[ "$DG_DRY_RUN" != "true" ]]; then
    local new_commit
    new_commit="$(dg_commit_tree_cas "$PROJECT_ROOT" "$DG_MANIFEST" "$DG_DRY_RUN")"
    dg_verify_commit_identity "$PROJECT_ROOT" "$DG_MANIFEST" "$new_commit"
    printf 'Commit: %s\n' "$new_commit"
  else
    dg_commit_tree_cas "$PROJECT_ROOT" "$DG_MANIFEST" "$DG_DRY_RUN"
  fi
}

# ── Common publish steps ─────────────────────────────────────────────────────
_run_publish_steps() {
  if [[ "$DG_NO_NETWORK" == "true" ]]; then
    dg_warn "skipping push (--no-network)"
    return 0
  fi
  dg_push_preflight "$PROJECT_ROOT" "$DG_MANIFEST"
  dg_execute_push "$PROJECT_ROOT" "$DG_MANIFEST" "$DG_DRY_RUN"
  if [[ "$DG_DRY_RUN" != "true" ]]; then
    dg_post_push_verify "$PROJECT_ROOT"
  fi
}

# ── Mode dispatch ────────────────────────────────────────────────────────────
DECISION="PENDING"
FINDINGS=""

case "$DG_MODE" in

  verify)
    dg_info "=== DELIVERY GATE: verify mode [R] (dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    DECISION="A.GO — verify passed"
    ;;

  prepare)
    dg_info "=== DELIVERY GATE: prepare mode [R] (always read-only) ==="
    _run_verify_steps
    dg_validate_commit_subject "$DG_MANIFEST" >/dev/null
    dg_stage_allowlist "$PROJECT_ROOT" "$DG_MANIFEST" "true"
    dg_commit_tree_cas  "$PROJECT_ROOT" "$DG_MANIFEST" "true"
    DECISION="A.GO — prepare passed (read-only plan above)"
    ;;

  commit)
    _dg_class_l_gate "commit"
    dg_info "=== DELIVERY GATE: commit mode [L] (execute=$DG_EXECUTE dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    _run_commit_steps
    if [[ "$DG_PLAN_ONLY" == "true" ]]; then
      DECISION="PLAN — commit: re-run with --execute to apply"
    else
      DECISION="A.GO — commit $([ "$DG_DRY_RUN" = true ] && echo "dry-run" || echo "complete")"
    fi
    ;;

  publish)
    _dg_class_l_gate "publish"
    dg_info "=== DELIVERY GATE: publish mode [N] (execute=$DG_EXECUTE dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    _run_commit_steps
    _run_publish_steps
    if [[ "$DG_PLAN_ONLY" == "true" ]]; then
      DECISION="PLAN — publish: re-run with --execute to apply"
    else
      DECISION="A.GO — publish $([ "$DG_DRY_RUN" = true ] && echo "dry-run" || echo "complete")"
    fi
    ;;

  full)
    _dg_class_l_gate "full"
    dg_info "=== DELIVERY GATE: full mode [L+N] (execute=$DG_EXECUTE dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    _run_commit_steps
    _run_publish_steps
    if [[ "$DG_PLAN_ONLY" == "true" ]]; then
      DECISION="PLAN — full: re-run with --execute to apply"
    else
      DECISION="A.GO — full $([ "$DG_DRY_RUN" = true ] && echo "dry-run" || echo "complete")"
    fi
    ;;

  report)
    dg_info "=== DELIVERY GATE: report mode [R] ==="
    dg_validate_manifest "$DG_MANIFEST"
    DECISION="REPORT — state captured"
    ;;

  separate)
    _dg_class_l_gate "separate"
    dg_info "=== DELIVERY GATE: separate mode [L] (execute=$DG_EXECUTE dry-run=$DG_DRY_RUN) ==="
    dg_run_separate "$PROJECT_ROOT" "$DG_PLAN" "$DG_DRY_RUN"
    if [[ "$DG_PLAN_ONLY" == "true" ]]; then
      DECISION="PLAN — separate: re-run with --execute to apply"
    else
      DECISION="A.GO — separate $([ "$DG_DRY_RUN" = true ] && echo "dry-run" || echo "complete")"
    fi
    ;;

  restore)
    _dg_class_l_gate "restore"
    dg_info "=== DELIVERY GATE: restore mode [L] ==="
    dg_fail "$DG_E_USAGE" "restore mode is planned but not yet implemented. Use 'git stash apply <SHA>' with manual verification."
    ;;

  *)
    dg_fail "$DG_E_USAGE" "unknown mode: $DG_MODE (run 'help' for usage)"
    ;;
esac

# For separate/restore modes, report uses the plan file as the manifest reference
_DG_REPORT_REF="${DG_MANIFEST:-${DG_PLAN:-/dev/null}}"

dg_write_report \
  "$DG_REPORT_DIR" \
  "$DG_MODE" \
  "$DG_DRY_RUN" \
  "$_DG_REPORT_REF" \
  "$PROJECT_ROOT" \
  "$DECISION" \
  "$FINDINGS"

dg_info "=== $DECISION ==="
exit "$DG_E_SUCCESS"
