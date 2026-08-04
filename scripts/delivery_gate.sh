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
DG_MANIFEST=""
DG_REPORT_DIR="$PROJECT_ROOT/reports/delivery-gate/latest"
DG_NO_NETWORK=false
DG_VERBOSE=false
DG_MODE=""

# ── Usage ────────────────────────────────────────────────────────────────────
usage() {
  cat >&2 << 'USAGE'
Usage: delivery_gate.sh <mode> [options]

Modes:
  help                      Show this help message
  verify   --manifest <f>   Read-only: verify repo, scope, governance, Quality, Catalog
  prepare  --manifest <f>   Verify + show what staging would do (always dry-run safe)
  commit   --manifest <f>   Verify + stage + commit-tree + CAS (requires --dry-run for preview)
  publish  --manifest <f>   Verify + commit + push + post-push verify
  full     --manifest <f>   All steps in sequence
  report   --manifest <f>   Generate report from current repo state

Options:
  --manifest <path>         Path to JSON manifest file (required for most modes)
  --dry-run                 Print planned actions; do NOT modify repo, index, or remote
  --report-dir <path>       Output directory for reports (default: reports/delivery-gate/latest)
  --no-network              Skip steps that require network access
  --verbose                 Enable verbose output

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
  - default deny; explicit allowlist only
  - no implicit git add . or git add -A
  - no normal git commit
  - commit-tree + update-ref CAS only
  - no automatic tag creation
  - no force push
  - no Provider Authorization
  - no Endpoint Approval
  - no Real Provider enablement

USAGE
  exit "${1:-$DG_E_USAGE}"
}

# ── Argument parsing ─────────────────────────────────────────────────────────
[[ $# -lt 1 ]] && usage "$DG_E_USAGE"
DG_MODE="$1"; shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)    [[ $# -gt 1 ]] || usage "$DG_E_USAGE"; DG_MANIFEST="$2"; shift 2 ;;
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

# All other modes require --manifest
[[ -n "$DG_MANIFEST" ]] || dg_fail "$DG_E_USAGE" "--manifest is required for mode: $DG_MODE"

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
    dg_info "=== DELIVERY GATE: verify mode (dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    DECISION="A.GO — verify passed"
    ;;

  prepare)
    dg_info "=== DELIVERY GATE: prepare mode (always reports what staging would do) ==="
    _run_verify_steps
    dg_validate_commit_subject "$DG_MANIFEST" >/dev/null
    # prepare is inherently read-only: it shows staging plan without executing
    dg_stage_allowlist "$PROJECT_ROOT" "$DG_MANIFEST" "true"
    dg_commit_tree_cas  "$PROJECT_ROOT" "$DG_MANIFEST" "true"
    DECISION="A.GO — prepare passed (dry-run output above)"
    ;;

  commit)
    dg_info "=== DELIVERY GATE: commit mode (dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    _run_commit_steps
    DECISION="A.GO — commit $([ "$DG_DRY_RUN" = true ] && echo "dry-run" || echo "complete")"
    ;;

  publish)
    dg_info "=== DELIVERY GATE: publish mode (dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    _run_commit_steps
    _run_publish_steps
    DECISION="A.GO — publish $([ "$DG_DRY_RUN" = true ] && echo "dry-run" || echo "complete")"
    ;;

  full)
    dg_info "=== DELIVERY GATE: full mode (dry-run=$DG_DRY_RUN) ==="
    _run_verify_steps
    _run_commit_steps
    _run_publish_steps
    DECISION="A.GO — full $([ "$DG_DRY_RUN" = true ] && echo "dry-run" || echo "complete")"
    ;;

  report)
    dg_info "=== DELIVERY GATE: report mode ==="
    dg_validate_manifest "$DG_MANIFEST"
    DECISION="REPORT — state captured"
    ;;

  *)
    dg_fail "$DG_E_USAGE" "unknown mode: $DG_MODE (run 'help' for usage)"
    ;;
esac

dg_write_report \
  "$DG_REPORT_DIR" \
  "$DG_MODE" \
  "$DG_DRY_RUN" \
  "$DG_MANIFEST" \
  "$PROJECT_ROOT" \
  "$DECISION" \
  "$FINDINGS"

dg_info "=== $DECISION ==="
exit "$DG_E_SUCCESS"
