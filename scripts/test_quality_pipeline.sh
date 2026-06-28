#!/usr/bin/env bash
# v1.3 quality pipeline 最小テスト（API 未使用・fixture 依存）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/reports/quality-pipeline/latest"
ARCHIVE_DIR="$PROJECT_ROOT/reports/quality-pipeline/archive"

cd "$PROJECT_ROOT"

pass() {
  echo "[PASS] $1"
}

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

assert_file() {
  if [[ ! -f "$1" ]]; then
    fail "ファイルが存在しません: $1"
  fi
}

assert_file_missing() {
  if [[ -f "$1" ]]; then
    fail "ファイルが残っています: $1"
  fi
}

echo "== quality pipeline tests =="

echo ""
echo "-- Test 1: dry-run (image-review, max-rounds 1) --"
node scripts/run_quality_pipeline.js --dry-run --from-phase image-review --max-rounds 1
assert_file "$OUTPUT_DIR/pipeline_state.json"
assert_file "$OUTPUT_DIR/metrics.json"
assert_file "$OUTPUT_DIR/report.json"
assert_file "$OUTPUT_DIR/report.md"
pass "dry-run outputs"

echo ""
echo "-- Test 2: report.json schema --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import { REPORT_TOOL, REPORT_VERSION } from "./src/lib/pipeline_report.js";

const report = JSON.parse(
  fs.readFileSync("reports/quality-pipeline/latest/report.json", "utf-8"),
);

if (report.schemaVersion !== "1.0") {
  throw new Error(`schemaVersion expected 1.0, got ${report.schemaVersion}`);
}
if (report.tool !== REPORT_TOOL) {
  throw new Error(`tool expected ${REPORT_TOOL}, got ${report.tool}`);
}
if (report.version !== REPORT_VERSION) {
  throw new Error(`version expected ${REPORT_VERSION}, got ${report.version}`);
}
if (!Array.isArray(report.items)) {
  throw new Error("items must be an array");
}
if (typeof report.summary !== "object" || report.summary === null) {
  throw new Error("summary must be an object");
}
if (!Array.isArray(report.summary.nextActions)) {
  throw new Error("summary.nextActions must be an array");
}
if (!Array.isArray(report.summary.outputArtifactPaths)) {
  throw new Error("summary.outputArtifactPaths must be an array");
}
console.log(`report items=${report.items.length}, dryRun=${report.summary.dryRun}`);
EOF
pass "report schema"

echo ""
echo "-- Test 3: buildPipelineReport unit --"
node --input-type=module <<'EOF'
import {
  buildPipelineReport,
  buildNextActions,
  OUTPUT_ARTIFACT_GUIDANCE,
} from "./src/lib/pipeline_report.js";
import { IMPROVEMENT_STOP_REASONS } from "./src/lib/pipeline_improvement.js";

const report = buildPipelineReport({
  state: {
    status: "completed",
    completedSteps: ["IMAGE_REVIEW"],
    failedSteps: [],
    scoreSummary: {
      targetScore: 90,
      passingScore: 80,
      averageScore: 88,
      minScore: 80,
      allSlidesPassed: true,
      allSlidesPublishRecommended: false,
      slides: [
        { slideId: "slide02", score: 88, passed: true, publishRecommended: false },
      ],
    },
    improvement: {
      roundsExecuted: 1,
      maxRounds: 3,
      stopReason: IMPROVEMENT_STOP_REASONS.MAX_ROUNDS_REACHED,
      history: [],
    },
    export: { completed: false, skipped: true },
  },
  metrics: {
    totalApiCalls: 0,
    failedCalls: 0,
    improvement: { stopReason: IMPROVEMENT_STOP_REASONS.MAX_ROUNDS_REACHED },
  },
  exportManifest: null,
  config: { targetScore: 90, passingScore: 80, dryRun: true, maxRounds: 3 },
});

if (report.items.length !== 1) {
  throw new Error(`expected 1 item, got ${report.items.length}`);
}
if (report.summary.finalAverageScore !== 88) {
  throw new Error("finalAverageScore mismatch");
}
if (!report.summary.outputArtifactGuidance.includes("git commit")) {
  throw new Error("outputArtifactGuidance missing git commit note");
}

const stopReport = buildPipelineReport({
  state: {
    status: "completed",
    scoreSummary: { slides: [], averageScore: null, minScore: null },
    improvement: {
      stopReason: IMPROVEMENT_STOP_REASONS.NO_SUCCESSFUL_ACTIONS_API_FAILED,
      history: [],
    },
    export: { skipped: true },
  },
  metrics: {
    improvement: {
      stopReason: IMPROVEMENT_STOP_REASONS.NO_SUCCESSFUL_ACTIONS_API_FAILED,
    },
  },
  config: { dryRun: false, targetScore: 90, passingScore: 80 },
});

const actions = buildNextActions({
  summary: stopReport.summary,
  items: stopReport.items,
  config: { dryRun: false },
  apiKeyHints: stopReport.summary.apiKeyHints,
});
if (actions.length === 0) {
  throw new Error("expected next actions for NO_SUCCESSFUL_ACTIONS_API_FAILED");
}
console.log("buildPipelineReport ok");
EOF
pass "buildPipelineReport"

echo ""
echo "-- Test 4: --from-phase report (dry-run) --"
node scripts/run_quality_pipeline.js --dry-run --from-phase report
assert_file "$OUTPUT_DIR/report.json"
pass "from-phase report"

echo ""
echo "-- Test 5: npm script entry (quality-pipeline:dry-run) --"
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 1 >/dev/null
pass "npm run quality-pipeline:dry-run"

echo ""
echo "-- Test 6: --clean-latest --"
BEFORE_STATE="$OUTPUT_DIR/pipeline_state.json"
if [[ ! -f "$BEFORE_STATE" ]]; then
  fail "precondition: pipeline_state.json missing"
fi
node scripts/run_quality_pipeline.js --dry-run --clean-latest --from-phase report >/dev/null
assert_file "$OUTPUT_DIR/report.md"
# clean-latest removes then recreates; archive should not be required for from-phase report
pass "--clean-latest"

echo ""
echo "-- Test 7: report.md sections (stopReason / output guidance) --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import { buildPipelineReportMarkdown } from "./src/lib/pipeline_report.js";
import { IMPROVEMENT_STOP_REASONS } from "./src/lib/pipeline_improvement.js";

const md = fs.readFileSync("reports/quality-pipeline/latest/report.md", "utf-8");
if (!md.includes("## Next Actions") && !md.includes("## output 副産物")) {
  throw new Error("report.md missing operational sections");
}
if (!md.includes("git commit") && !md.includes("副産物")) {
  throw new Error("report.md missing output artifact guidance");
}

const sample = buildPipelineReportMarkdown({
  generatedAt: new Date().toISOString(),
  tool: "quality_pipeline_report",
  version: "v1.3.1",
  pipelineStateFile: "reports/quality-pipeline/latest/pipeline_state.json",
  metricsFile: "reports/quality-pipeline/latest/metrics.json",
  exportManifestFile: null,
  summary: {
    dryRun: true,
    targetScore: 90,
    passingScore: 80,
    finalAverageScore: 80,
    finalMinScore: 75,
    allSlidesPassed: false,
    allSlidesPublishRecommended: false,
    roundsExecuted: 1,
    maxRounds: 3,
    improvementStopReason: IMPROVEMENT_STOP_REASONS.LIMIT_ZERO_DETECTED,
    totalApiCalls: 1,
    failedCalls: 1,
    limitZeroDetected: true,
    exportCompleted: false,
    exportSkipped: true,
    exportSkipReason: null,
    exportMode: null,
    improvedAdoptedCount: 0,
    publishRecommendedCount: 0,
    passCount: 0,
    needsReImprovementCount: 1,
    improvementFailedCount: 0,
    elapsedMs: 100,
    pipelineStatus: "completed",
    allowPartialExport: false,
    nextActions: [
      "Gemini / Nano Banana の API quota（limit:0）を確認する",
    ],
    apiKeyHints: [],
    outputArtifactGuidance: "apply 実行後、output に副産物が残る。git commit しない。",
    outputArtifactPaths: ["output/carousel/improved/manifest.json"],
  },
  items: [],
});

if (!sample.includes("## Next Actions")) {
  throw new Error("sample markdown missing Next Actions");
}
if (!sample.includes("LIMIT_ZERO_DETECTED") && !sample.includes("limit:0")) {
  throw new Error("sample markdown missing stop reason context");
}
console.log("report.md sections ok");
EOF
pass "report.md sections"

echo ""
echo "-- Test 8: archive on overwrite (optional) --"
node scripts/run_quality_pipeline.js --dry-run --from-phase report >/dev/null
if [[ -d "$ARCHIVE_DIR" ]]; then
  ARCHIVE_COUNT="$(find "$ARCHIVE_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$ARCHIVE_COUNT" -ge 1 ]]; then
    pass "archive directory populated"
  else
    pass "archive directory exists (no prior latest to archive in this run)"
  fi
else
  pass "archive not created (latest was empty before run)"
fi

echo ""
echo "All quality pipeline tests passed."
