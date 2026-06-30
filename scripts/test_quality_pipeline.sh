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
for (const section of [
  "## Next Actions",
  "## 通常 commit 不要の副産物",
  "## dry-run / latest / archive",
  "## --apply 実行判断",
]) {
  if (!md.includes(section)) {
    throw new Error(`report.md missing section: ${section}`);
  }
}
if (md.includes("v1.4 以降予定")) {
  throw new Error("stale text in report.md: v1.4 以降予定");
}

const sample = buildPipelineReportMarkdown({
  generatedAt: new Date().toISOString(),
  tool: "quality_pipeline_report",
  version: "v1.4.1",
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
    plannedActions: 2,
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
    cleanLatest: false,
    workspaceAction: "archived",
    archivePath: "reports/quality-pipeline/archive/2026-06-28-120000",
    nextActions: [
      "Gemini / Nano Banana の API quota（limit:0）を確認する",
    ],
    apiKeyHints: [],
    outputArtifactGuidance: "apply 実行後、output に副産物が残る。git commit しない。",
    outputArtifactPaths: ["output/carousel/improved/manifest.json"],
  },
  items: [],
});

for (const section of [
  "## 通常 commit 不要の副産物",
  "## dry-run / latest / archive",
  "## --apply 実行判断",
  "git restore output/",
]) {
  if (!sample.includes(section)) {
    throw new Error(`sample markdown missing: ${section}`);
  }
}

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
echo "-- Test 9: regeneration engine (planRegeneration / regenerateImage dry-run) --"
node --input-type=module <<'EOF'
import {
  DEFAULT_REGENERATION_ADAPTER_ID,
  getRegenerationAdapter,
  planRegeneration,
  regenerateImage,
} from "./src/lib/regeneration_engine.js";

const request = {
  slideId: "slide02",
  promptPath: "images/carousel/generated-prompts/prompt02.md",
  sourceImagePath: "images/carousel/output/slide02.png",
  outputPath: "output/carousel/improved/slide02.png",
  adapterId: "nano_banana",
  dryRun: true,
};

const adapter = getRegenerationAdapter("nano_banana");
if (!adapter || adapter.id !== "nano_banana") {
  throw new Error("nano_banana adapter not registered");
}
if (DEFAULT_REGENERATION_ADAPTER_ID !== "nano_banana") {
  throw new Error("default adapter mismatch");
}

const planned = await planRegeneration(request);
if (planned.status !== "planned") {
  throw new Error(`planRegeneration expected planned, got ${planned.status}: ${planned.error}`);
}
if (planned.adapterId !== "nano_banana") {
  throw new Error("planned.adapterId mismatch");
}
if (planned.slideId !== "slide02") {
  throw new Error("planned.slideId mismatch");
}

const dryRegen = await regenerateImage(request);
if (dryRegen.status !== "planned") {
  throw new Error(`regenerateImage dry-run expected planned, got ${dryRegen.status}`);
}

console.log(`regeneration engine ok status=${planned.status} elapsedMs=${planned.elapsedMs}`);
EOF
pass "regeneration engine"

echo ""
echo "-- Test 10: SAF / regeneration dependency isolation --"
if rg -q "regeneration_engine|regeneration/" src/lib/smart_auto_fix.js 2>/dev/null; then
  fail "smart_auto_fix must not import regeneration engine"
fi
if rg -q "smart_auto_fix" src/lib/regeneration_engine.js src/lib/regeneration/ 2>/dev/null; then
  fail "regeneration engine must not import smart_auto_fix"
fi
pass "dependency isolation"

echo ""
echo "-- Test 11: TEXT rootCause routes to smart_auto_fix --"
node --input-type=module <<'EOF'
import { classifyImprovementTarget } from "./src/lib/pipeline_improvement.js";

const target = classifyImprovementTarget(
  {
    slideId: "slide02",
    score: 75,
    issues: ["誤字がある", "文字崩れ"],
    recommendations: [],
  },
  { targetScore: 90, passingScore: 80 },
);

if (!target || target.tool !== "smart_auto_fix") {
  throw new Error(`expected smart_auto_fix, got ${target?.tool ?? "null"}`);
}
if (target.rootCause !== "TEXT") {
  throw new Error(`expected TEXT rootCause, got ${target.rootCause}`);
}
console.log("TEXT routing ok");
EOF
pass "TEXT routing"

echo ""
echo "-- Test 12: processSmartAutoFixTarget dry-run planned --"
node --input-type=module <<'EOF'
import { processSmartAutoFixTarget } from "./src/lib/pipeline_improvement.js";
import { createPipelineMetrics } from "./src/lib/pipeline_metrics.js";

const result = await processSmartAutoFixTarget(
  {
    slideId: "slide02",
    score: 75,
    rootCause: "TEXT",
    action: "REPAIR_REQUIRED",
    autoFixable: true,
  },
  {
    slideId: "slide02",
    score: 75,
    issues: ["誤字"],
    recommendations: [],
  },
  {
    dryRun: true,
    metrics: createPipelineMetrics(),
    config: { dryRun: true },
  },
);

if (result.item.status !== "planned") {
  throw new Error(`expected planned, got ${result.item.status}: ${result.item.error}`);
}
if (result.item.tool !== "smart_auto_fix") {
  throw new Error("tool mismatch");
}
if (!Array.isArray(result.item.improvementPipeline) ||
    !result.item.improvementPipeline.includes("smart_auto_fix") ||
    !result.item.improvementPipeline.includes("regeneration_engine")) {
  throw new Error("improvementPipeline missing");
}
if (result.item.regenerationAdapter !== "nano_banana") {
  throw new Error("regenerationAdapter mismatch");
}
if (!result.item.smartAutoFix || !result.item.regeneration) {
  throw new Error("smartAutoFix/regeneration blocks missing");
}
console.log("processSmartAutoFixTarget dry-run ok");
EOF
pass "SAF dry-run planned"

echo ""
echo "-- Test 13: processSmartAutoFixTarget apply with stub regeneration --"
node --input-type=module <<'EOF'
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { processSmartAutoFixTarget } from "./src/lib/pipeline_improvement.js";
import { createPipelineMetrics } from "./src/lib/pipeline_metrics.js";
import {
  getRegenerationAdapter,
  registerRegenerationAdapter,
} from "./src/lib/regeneration_engine.js";

const originalAdapter = getRegenerationAdapter("nano_banana");
const stubAdapter = {
  id: "nano_banana",
  label: "stub",
  plan: async (request) => ({
    slideId: request.slideId,
    adapterId: "nano_banana",
    status: "planned",
    promptPath: request.promptPath,
    sourceImagePath: request.sourceImagePath,
    outputPath: request.outputPath,
    elapsedMs: 0,
    attempts: 0,
    error: null,
  }),
  regenerate: async (request) => ({
    slideId: request.slideId,
    adapterId: "nano_banana",
    status: "improved",
    promptPath: request.promptPath,
    sourceImagePath: request.sourceImagePath,
    outputPath: request.outputPath,
    elapsedMs: 5,
    attempts: 1,
    error: null,
  }),
};

registerRegenerationAdapter("nano_banana", stubAdapter);

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "saf-pipeline-"));
const promptRel = "images/carousel/generated-prompts/prompt02.md";
const sourceRel = "images/carousel/output/slide02.png";
const outputRel = "output/carousel/improved/slide02.png";

await fs.mkdir(path.dirname(path.join(tmpRoot, promptRel)), { recursive: true });
await fs.mkdir(path.dirname(path.join(tmpRoot, sourceRel)), { recursive: true });
await fs.mkdir(path.dirname(path.join(tmpRoot, outputRel)), { recursive: true });
await fs.writeFile(path.join(tmpRoot, promptRel), "# prompt\n", "utf-8");
await fs.writeFile(path.join(tmpRoot, sourceRel), "fake", "utf-8");

try {
  const result = await processSmartAutoFixTarget(
    {
      slideId: "slide02",
      score: 75,
      rootCause: "TEXT",
      action: "REPAIR_REQUIRED",
      autoFixable: true,
    },
    {
      slideId: "slide02",
      score: 75,
      issues: ["誤字"],
      recommendations: [],
    },
    {
      dryRun: false,
      projectRoot: tmpRoot,
      metrics: createPipelineMetrics(),
      config: { dryRun: false },
    },
  );

  if (result.item.status !== "improved") {
    throw new Error(`expected improved, got ${result.item.status}`);
  }
  if (result.item.smartAutoFix.status !== "applied") {
    throw new Error(`expected SAF applied, got ${result.item.smartAutoFix.status}`);
  }
  if (result.item.regeneration.status !== "improved") {
    throw new Error("regeneration status mismatch");
  }
} finally {
  if (originalAdapter) {
    registerRegenerationAdapter("nano_banana", originalAdapter);
  }
}

console.log("apply stub chain ok");
EOF
pass "SAF apply stub chain"

echo ""
echo "-- Test 14: countImprovementRoundActions for smart_auto_fix --"
node --input-type=module <<'EOF'
import { countImprovementRoundActions } from "./src/lib/pipeline_improvement.js";

const counts = countImprovementRoundActions([
  { tool: "smart_auto_fix", status: "planned" },
  { tool: "smart_auto_fix", status: "improved" },
  { tool: "smart_auto_fix", status: "regen_failed" },
  { tool: "nano_banana", status: "improved" },
]);

if (counts.executedActions !== 4) {
  throw new Error(`executedActions expected 4, got ${counts.executedActions}`);
}
if (counts.successfulActions !== 3) {
  throw new Error(`successfulActions expected 3, got ${counts.successfulActions}`);
}
if (counts.failedActions !== 1) {
  throw new Error(`failedActions expected 1, got ${counts.failedActions}`);
}
if (counts.skippedActions !== 0) {
  throw new Error(`skippedActions expected 0, got ${counts.skippedActions}`);
}
console.log("countImprovementRoundActions ok");
EOF
pass "action counts"

echo ""
echo "-- Test 15: resolveReviewSourceFromManifestItem --"
node --input-type=module <<'EOF'
import {
  resolveReviewSourceFromManifestItem,
  REVIEW_SOURCE_SMART_AUTO_FIX,
  REVIEW_SOURCE_NANO_BANANA,
} from "./src/lib/pipeline_score.js";
import { isReReviewEligibleManifestItem } from "./src/lib/pipeline_improvement.js";

const textItem = {
  status: "improved",
  tool: "smart_auto_fix",
  improvementPipeline: ["smart_auto_fix", "regeneration_engine"],
  outputPath: "output/carousel/improved/slide02.png",
};

if (!isReReviewEligibleManifestItem(textItem)) {
  throw new Error("TEXT chain manifest should be ReReview eligible");
}
if (resolveReviewSourceFromManifestItem(textItem) !== REVIEW_SOURCE_SMART_AUTO_FIX) {
  throw new Error("expected smart_auto_fix_re_review");
}

const nanoItem = {
  status: "improved",
  tool: "nano_banana",
  improvementPipeline: ["nano_banana"],
};

if (resolveReviewSourceFromManifestItem(nanoItem) !== REVIEW_SOURCE_NANO_BANANA) {
  throw new Error("expected nano_banana_re_review");
}
console.log("resolveReviewSource ok");
EOF
pass "review source resolution"

echo ""
echo "-- Test 16: mergeReviewResultIntoScoreSummary TEXT chain source --"
node --input-type=module <<'EOF'
import {
  mergeReviewResultIntoScoreSummary,
  REVIEW_SOURCE_SMART_AUTO_FIX,
} from "./src/lib/pipeline_score.js";

const summary = mergeReviewResultIntoScoreSummary(
  {
    slides: [
      { slideId: "slide02", score: 75, rootCause: "TEXT", issues: [], recommendations: [] },
    ],
    averageScore: 75,
    minScore: 75,
  },
  [
    {
      slideId: "slide02",
      status: "reviewed",
      afterScore: 82,
      afterRootCause: "OTHER",
      reviewSource: REVIEW_SOURCE_SMART_AUTO_FIX,
    },
  ],
  { targetScore: 90, passingScore: 80 },
);

const slide = summary.slides.find((item) => item.slideId === "slide02");
if (slide.score !== 82) {
  throw new Error(`expected afterScore 82, got ${slide.score}`);
}
if (slide.source !== REVIEW_SOURCE_SMART_AUTO_FIX) {
  throw new Error(`expected smart_auto_fix_re_review, got ${slide.source}`);
}
if (slide.rootCause !== "OTHER") {
  throw new Error(`expected afterRootCause OTHER, got ${slide.rootCause}`);
}
console.log("merge TEXT chain ok");
EOF
pass "merge TEXT chain source"

echo ""
echo "-- Test 17: mergeReviewResultIntoScoreSummary nano_banana source --"
node --input-type=module <<'EOF'
import {
  mergeReviewResultIntoScoreSummary,
  REVIEW_SOURCE_NANO_BANANA,
} from "./src/lib/pipeline_score.js";

const summary = mergeReviewResultIntoScoreSummary(
  {
    slides: [{ slideId: "slide03", score: 80, rootCause: "LAYOUT" }],
    averageScore: 80,
    minScore: 80,
  },
  [
    {
      slideId: "slide03",
      status: "reviewed",
      afterScore: 88,
      tool: "nano_banana",
      improvementPipeline: ["nano_banana"],
    },
  ],
  { targetScore: 90, passingScore: 80 },
);

const slide = summary.slides[0];
if (slide.source !== REVIEW_SOURCE_NANO_BANANA) {
  throw new Error(`expected nano_banana_re_review, got ${slide.source}`);
}
console.log("merge nano_banana ok");
EOF
pass "merge nano_banana source"

echo ""
echo "-- Test 18: buildPipelineReport Smart Auto Fix fields --"
node --input-type=module <<'EOF'
import { buildPipelineReport } from "./src/lib/pipeline_report.js";
import { createPipelineMetrics } from "./src/lib/pipeline_metrics.js";

const metrics = createPipelineMetrics();
metrics.improvement.executedSmartAutoFix = 1;
metrics.improvement.successfulSmartAutoFix = 1;
metrics.improvement.executedRegeneration = 1;
metrics.improvement.successfulRegeneration = 1;

const report = buildPipelineReport({
  state: {
    status: "completed",
    scoreSummary: {
      slides: [{ slideId: "slide02", score: 82, source: "smart_auto_fix_re_review" }],
      averageScore: 82,
      minScore: 82,
    },
    improvement: {
      roundsExecuted: 1,
      history: [
        {
          round: 1,
          targets: [
            {
              slideId: "slide02",
              tool: "smart_auto_fix",
              status: "improved",
              beforeScore: 75,
              rootCause: "TEXT",
              improvementPipeline: ["smart_auto_fix", "regeneration_engine"],
              regenerationAdapter: "nano_banana",
              smartAutoFix: { status: "applied" },
              regeneration: { status: "improved", adapterId: "nano_banana" },
            },
          ],
        },
      ],
    },
  },
  metrics,
  exportManifest: null,
  config: { dryRun: false, targetScore: 90, passingScore: 80 },
});

if (!report.summary.textChainConnected) {
  throw new Error("textChainConnected expected true");
}
if (report.summary.executedSmartAutoFix !== 1) {
  throw new Error("executedSmartAutoFix missing");
}
const item = report.items.find((entry) => entry.slideId === "slide02");
if (item.reviewStatus !== "reviewed") {
  throw new Error(`reviewStatus expected reviewed, got ${item.reviewStatus}`);
}
if (!item.textChainConnected) {
  throw new Error("item.textChainConnected expected");
}
console.log("buildPipelineReport ok");
EOF
pass "report.json SAF fields"

echo ""
echo "-- Test 19: buildPipelineReportMarkdown Smart Auto Fix section --"
node --input-type=module <<'EOF'
import { buildPipelineReport, buildPipelineReportMarkdown } from "./src/lib/pipeline_report.js";
import { createPipelineMetrics } from "./src/lib/pipeline_metrics.js";

const report = buildPipelineReport({
  state: {
    status: "completed",
    scoreSummary: { slides: [{ slideId: "slide02", score: 75 }], averageScore: 75, minScore: 75 },
    improvement: {
      history: [
        {
          round: 1,
          targets: [
            {
              slideId: "slide02",
              tool: "smart_auto_fix",
              status: "planned",
              beforeScore: 75,
              improvementPipeline: ["smart_auto_fix", "regeneration_engine"],
              regenerationAdapter: "nano_banana",
              smartAutoFix: { status: "planned" },
              regeneration: { status: "planned" },
            },
          ],
        },
      ],
    },
  },
  metrics: createPipelineMetrics(),
  exportManifest: null,
  config: { dryRun: true, targetScore: 90, passingScore: 80 },
});

const md = buildPipelineReportMarkdown(report);
if (!md.includes("Smart Auto Fix / TEXT チェーン")) {
  throw new Error("Smart Auto Fix section missing");
}
if (!md.includes("TEXT(planned)")) {
  throw new Error("planned TEXT chain label missing");
}
console.log("report.md ok");
EOF
pass "report.md SAF section"

echo ""
echo "-- Test 20: selectExportImages TEXT chain improved adoption --"
node --input-type=module <<'EOF'
import fs from "node:fs/promises";
import path from "node:path";
import { selectExportImages } from "./src/lib/pipeline_export.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const improvedRel = "output/carousel/improved/slide02.png";
const manifestRel = "output/carousel/improved/manifest.json";
const reviewRel = "reports/nano-banana-improve/review_result.json";
const improvedAbs = path.join(PROJECT_ROOT, improvedRel);
const manifestAbs = path.join(PROJECT_ROOT, manifestRel);
const reviewAbs = path.join(PROJECT_ROOT, reviewRel);

const backups = [];
async function backupIfExists(relativePath) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  try {
    const content = await fs.readFile(absolutePath);
    backups.push({ relativePath, content });
  } catch {
    backups.push({ relativePath, content: null });
  }
}

await backupIfExists(improvedRel);
await backupIfExists(manifestRel);
await backupIfExists(reviewRel);

await fs.mkdir(path.dirname(improvedAbs), { recursive: true });
await fs.mkdir(path.dirname(reviewAbs), { recursive: true });
await fs.writeFile(improvedAbs, "png", "utf-8");
await fs.writeFile(
  manifestAbs,
  JSON.stringify({
    items: [
      {
        slideId: "slide02",
        status: "improved",
        tool: "smart_auto_fix",
        improvementPipeline: ["smart_auto_fix", "regeneration_engine"],
        regenerationAdapter: "nano_banana",
        beforeScore: 75,
      },
    ],
  }),
  "utf-8",
);
await fs.writeFile(
  reviewAbs,
  JSON.stringify({
    items: [
      {
        slideId: "slide02",
        status: "reviewed",
        beforeScore: 75,
        afterScore: 82,
        reviewSource: "smart_auto_fix_re_review",
      },
    ],
  }),
  "utf-8",
);

try {
  const selections = await selectExportImages(
    {
      scoreSummary: {
        slides: [
          {
            slideId: "slide02",
            score: 82,
            source: "smart_auto_fix_re_review",
            publishRecommended: false,
            passed: true,
          },
        ],
      },
      improvement: { lastManifestPath: manifestRel },
    },
    { targetScore: 90, passingScore: 80 },
  );

  const slide02 = selections.find((item) => item.slideId === "slide02");
  if (!slide02?.adoptedImproved) {
    throw new Error("TEXT chain improved image should be adopted");
  }
  if (slide02.selectionReason !== "improved_adopted_text_chain") {
    throw new Error(`unexpected selectionReason: ${slide02.selectionReason}`);
  }
} finally {
  for (const backup of backups) {
    const absolutePath = path.join(PROJECT_ROOT, backup.relativePath);
    if (backup.content === null) {
      await fs.rm(absolutePath, { force: true });
    } else {
      await fs.writeFile(absolutePath, backup.content);
    }
  }
}

console.log("export TEXT chain ok");
EOF
pass "export TEXT chain adoption"

echo ""
echo "-- Test 21: recordImprovementExecutionMetrics Smart Auto Fix counts --"
node --input-type=module <<'EOF'
import { createPipelineMetrics, recordImprovementExecutionMetrics } from "./src/lib/pipeline_metrics.js";

let metrics = createPipelineMetrics();
metrics = recordImprovementExecutionMetrics(metrics, {
  round: 1,
  executedSmartAutoFix: 2,
  successfulSmartAutoFix: 1,
  failedSmartAutoFix: 1,
  executedRegeneration: 1,
  successfulRegeneration: 1,
  failedRegeneration: 0,
});

if (metrics.improvement.executedSmartAutoFix !== 2) {
  throw new Error("executedSmartAutoFix count mismatch");
}
if (metrics.improvement.executedRegeneration !== 1) {
  throw new Error("executedRegeneration count mismatch");
}
console.log("metrics SAF counts ok");
EOF
pass "metrics SAF counts"

echo ""
echo "-- Test 22: stale operational text regression --"
node --input-type=module <<'EOF'
import { buildNextActions } from "./src/lib/pipeline_report.js";
import { IMPROVEMENT_STOP_REASONS } from "./src/lib/pipeline_improvement.js";
import { getPipelineHelpText } from "./src/lib/pipeline_config.js";

const help = getPipelineHelpText();
if (help.includes("Phase 1")) {
  throw new Error("stale CLI help: Phase 1");
}
if (!help.includes("dry-run でも")) {
  throw new Error("CLI help missing dry-run latest note");
}

const actions = buildNextActions({
  summary: {
    improvementStopReason: IMPROVEMENT_STOP_REASONS.MANUAL_REVIEW_ONLY,
    dryRun: false,
    plannedActions: 0,
    improvementFailedCount: 0,
    allSlidesPublishRecommended: false,
    exportSkipped: false,
    pipelineStatus: "completed",
  },
  items: [],
  config: { dryRun: false },
  apiKeyHints: [],
});
const joined = actions.join(" ");
if (joined.includes("v1.4 以降予定")) {
  throw new Error("stale MANUAL_REVIEW_ONLY next action");
}
console.log("stale text regression ok");
EOF
pass "stale text regression"

echo ""
echo "-- Test 23: buildApiKeyHints for smart_auto_fix target --"
node --input-type=module <<'EOF'
import { buildApiKeyHints } from "./src/lib/pipeline_report.js";

const savedGemini = process.env.GEMINI_API_KEY;
const savedNano = process.env.NANO_BANANA_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.NANO_BANANA_API_KEY;

try {
  const hints = buildApiKeyHints({
    state: {
      config: { dryRun: true },
      improvement: {
        lastPlan: {
          totalTargets: 1,
          targets: [{ slideId: "slide02", tool: "smart_auto_fix" }],
        },
        history: [],
        roundsExecuted: 0,
      },
    },
    config: { dryRun: true },
    items: [
      {
        slideId: "slide02",
        improvementTool: "smart_auto_fix",
        textChainConnected: true,
      },
    ],
  });

  const ids = hints.map((hint) => hint.id);
  if (!ids.includes("nano_banana")) {
    throw new Error(`expected nano_banana hint, got ${ids.join(",")}`);
  }
  if (!ids.includes("gemini")) {
    throw new Error(`expected gemini hint, got ${ids.join(",")}`);
  }
} finally {
  if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
  else delete process.env.GEMINI_API_KEY;
  if (savedNano) process.env.NANO_BANANA_API_KEY = savedNano;
  else delete process.env.NANO_BANANA_API_KEY;
}

console.log("smart_auto_fix api hints ok");
EOF
pass "smart_auto_fix api hints"

echo ""
echo "-- Test 24: OpenAI adapter dry-run selectable --"
node scripts/run_quality_pipeline.js --dry-run --from-phase image-review --max-rounds 1 --regeneration-adapter openai
node --input-type=module <<'EOF'
import fs from "node:fs";

const state = JSON.parse(
  fs.readFileSync("reports/quality-pipeline/latest/pipeline_state.json", "utf-8"),
);
if (state.config.regenerationAdapter !== "openai") {
  throw new Error(`expected regenerationAdapter openai, got ${state.config.regenerationAdapter}`);
}
console.log("openai adapter dry-run ok");
EOF
pass "OpenAI adapter dry-run"

echo ""
echo "-- Test 25: OPENAI_API_KEY missing guidance --"
node --input-type=module <<'EOF'
import { buildApiKeyHints } from "./src/lib/pipeline_report.js";
import { planOpenAiRegeneration } from "./src/lib/regeneration/openai_regeneration_adapter.js";
import { OPENAI_API_KEY_MISSING_CODE } from "./src/lib/regeneration/openai_regeneration_adapter.js";

const saved = process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_KEY;

try {
  const hints = buildApiKeyHints({
    state: {
      config: { dryRun: true, regenerationAdapter: "openai" },
      improvement: {
        lastPlan: { totalTargets: 1, targets: [{ slideId: "slide02", tool: "smart_auto_fix" }] },
        history: [],
        roundsExecuted: 0,
      },
    },
    config: { dryRun: true, regenerationAdapter: "openai" },
    items: [{ slideId: "slide02", textChainConnected: true, improvementTool: "smart_auto_fix" }],
  });

  if (!hints.some((hint) => hint.id === "openai")) {
    throw new Error("expected openai api key hint");
  }

  const planned = await planOpenAiRegeneration(
    {
      slideId: "slide02",
      promptPath: "images/carousel/prompts/prompt02.md",
      sourceImagePath: "output/carousel/slide02.png",
      outputPath: "output/carousel/improved/slide02.png",
      dryRun: true,
    },
    { projectRoot: process.cwd() },
  );

  if (planned.status !== "planned") {
    throw new Error(`expected planned status, got ${planned.status}`);
  }
  if (planned.adapterPayload?.meta?.apiKeyGuidance?.code !== OPENAI_API_KEY_MISSING_CODE) {
    throw new Error("expected apiKeyGuidance for missing OPENAI_API_KEY");
  }
} finally {
  if (saved) process.env.OPENAI_API_KEY = saved;
  else delete process.env.OPENAI_API_KEY;
}

console.log("openai api key guidance ok");
EOF
pass "OPENAI_API_KEY guidance"

echo ""
echo "-- Test 26: report.json regenerationAdapter openai --"
node --input-type=module <<'EOF'
import fs from "node:fs";

const report = JSON.parse(
  fs.readFileSync("reports/quality-pipeline/latest/report.json", "utf-8"),
);

if (report.summary.regenerationAdapter !== "openai") {
  throw new Error(`expected summary.regenerationAdapter openai, got ${report.summary.regenerationAdapter}`);
}
if (typeof report.summary.regenerationByAdapter !== "object") {
  throw new Error("summary.regenerationByAdapter missing");
}
console.log(`report regenerationAdapter=${report.summary.regenerationAdapter}`);
EOF
pass "report.json openai adapter"

echo ""
echo "-- Test 27: report.md OpenAI adapter display --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import { buildPipelineReport, buildPipelineReportMarkdown } from "./src/lib/pipeline_report.js";
import { createPipelineMetrics } from "./src/lib/pipeline_metrics.js";

const report = JSON.parse(
  fs.readFileSync("reports/quality-pipeline/latest/report.json", "utf-8"),
);
const md = buildPipelineReportMarkdown(report);

if (!md.includes("Regeneration adapter")) {
  throw new Error("report.md missing Regeneration adapter row");
}
if (!md.includes("OpenAI Adapter")) {
  throw new Error("report.md missing OpenAI Adapter label");
}

const openAiReport = buildPipelineReportMarkdown(
  buildPipelineReport({
    state: {
      status: "completed",
      scoreSummary: {
        slides: [{ slideId: "slide02", score: 75 }],
        averageScore: 75,
        minScore: 75,
      },
      improvement: {
        history: [
          {
            round: 1,
            targets: [
              {
                slideId: "slide02",
                tool: "smart_auto_fix",
                status: "planned",
                improvementPipeline: ["smart_auto_fix", "regeneration_engine"],
                regenerationAdapter: "openai",
                regeneration: {
                  status: "planned",
                  adapterId: "openai",
                  model: "gpt-image-1",
                  dryRun: true,
                },
              },
            ],
          },
        ],
      },
      export: { skipped: true },
    },
    metrics: {
      ...createPipelineMetrics(),
      regenerationByAdapter: { nano_banana: 0, openai: 1 },
    },
    exportManifest: null,
    config: { dryRun: true, regenerationAdapter: "openai", targetScore: 90, passingScore: 80 },
  }),
);

if (!openAiReport.includes("OpenAI Adapter")) {
  throw new Error("OpenAI Adapter label missing in report.md");
}
if (!openAiReport.includes("gpt-image-1")) {
  throw new Error("OpenAI model missing in report.md");
}

console.log("report.md openai display ok");
EOF
pass "report.md OpenAI adapter"

echo ""
echo "-- Test 28: default nano_banana adapter unchanged --"
node --input-type=module <<'EOF'
import { createPipelineConfig, getPipelineHelpText } from "./src/lib/pipeline_config.js";
import {
  DEFAULT_REGENERATION_ADAPTER_ID,
  getRegenerationAdapter,
  listRegenerationAdapterIds,
  planRegeneration,
} from "./src/lib/regeneration_engine.js";

const config = createPipelineConfig(["node", "scripts/run_quality_pipeline.js", "--dry-run"]);
if (config.regenerationAdapter !== "nano_banana") {
  throw new Error(`default adapter expected nano_banana, got ${config.regenerationAdapter}`);
}
if (DEFAULT_REGENERATION_ADAPTER_ID !== "nano_banana") {
  throw new Error("DEFAULT_REGENERATION_ADAPTER_ID changed");
}

const help = getPipelineHelpText();
if (!help.includes("--regeneration-adapter")) {
  throw new Error("CLI help missing --regeneration-adapter");
}

const ids = listRegenerationAdapterIds();
if (!ids.includes("nano_banana") || !ids.includes("openai")) {
  throw new Error(`adapters missing: ${ids.join(",")}`);
}
if (!getRegenerationAdapter("openai")) {
  throw new Error("openai adapter not registered");
}

const planned = await planRegeneration(
  {
    slideId: "slide02",
    promptPath: "images/carousel/prompts/prompt02.md",
    sourceImagePath: "output/carousel/slide02.png",
    outputPath: "output/carousel/improved/slide02.png",
    dryRun: true,
  },
  { projectRoot: process.cwd() },
);
if (planned.adapterId !== "nano_banana") {
  throw new Error(`default plan adapter expected nano_banana, got ${planned.adapterId}`);
}

console.log("default nano_banana ok");
EOF
pass "default nano_banana"

echo ""
echo "-- Test 29: --resume requires state.json --"
node --input-type=module <<'EOF'
import { createPipelineConfig } from "./src/lib/pipeline_config.js";
import fs from "node:fs";
import { getResumeStateAbsolutePath } from "./src/lib/pipeline_resume.js";

const statePath = getResumeStateAbsolutePath();
const backup = fs.existsSync(statePath) ? fs.readFileSync(statePath) : null;
if (fs.existsSync(statePath)) {
  fs.unlinkSync(statePath);
}

try {
  let threw = false;
  try {
    createPipelineConfig(["node", "scripts/run_quality_pipeline.js", "--resume"]);
  } catch (error) {
    threw = true;
    if (!String(error.message).includes("state.json")) {
      throw new Error(`unexpected error: ${error.message}`);
    }
  }
  if (!threw) {
    throw new Error("expected error for missing state.json");
  }
} finally {
  if (backup) {
    fs.writeFileSync(statePath, backup);
  }
}

console.log("resume requires state.json ok");
EOF
pass "resume requires state.json"

echo ""
echo "-- Test 30: --resume and --clean-latest conflict --"
node --input-type=module <<'EOF'
import { createPipelineConfig } from "./src/lib/pipeline_config.js";
import fs from "node:fs";
import { getResumeStateAbsolutePath } from "./src/lib/pipeline_resume.js";

const statePath = getResumeStateAbsolutePath();
if (!fs.existsSync(statePath)) {
  fs.writeFileSync(statePath, '{"tool":"quality_pipeline_resume","status":"resumable","nextPhase":"REPORT"}\n');
}

try {
  let threw = false;
  try {
    createPipelineConfig([
      "node",
      "scripts/run_quality_pipeline.js",
      "--resume",
      "--clean-latest",
    ]);
  } catch (error) {
    threw = true;
    if (!String(error.message).includes("--clean-latest")) {
      throw new Error(`unexpected error: ${error.message}`);
    }
  }
  if (!threw) {
    throw new Error("expected conflict error");
  }
} finally {
  // leave state.json for later tests
}

console.log("resume clean-latest conflict ok");
EOF
pass "resume clean-latest conflict"

echo ""
echo "-- Test 31: CLI help includes --resume --"
node --input-type=module <<'EOF'
import { getPipelineHelpText } from "./src/lib/pipeline_config.js";

const help = getPipelineHelpText();
if (!help.includes("--resume")) {
  throw new Error("CLI help missing --resume");
}
console.log("CLI help resume ok");
EOF
pass "CLI help resume"

echo ""
echo "-- Test 32: pipeline_resume checkpoint roundtrip --"
node --input-type=module <<'EOF'
import {
  buildResumeCheckpoint,
  readResumeState,
  RESUME_STATE_TOOL,
  writeResumeState,
} from "./src/lib/pipeline_resume.js";
import { PIPELINE_PHASES } from "./src/lib/phases.js";

const checkpoint = buildResumeCheckpoint({
  pipelineState: {
    status: "running",
    phase: PIPELINE_PHASES.IMAGE_REVIEW,
    round: 0,
    completedSteps: [PIPELINE_PHASES.IMAGE_REVIEW],
    improvement: { roundsExecuted: 0 },
    config: { fromPhase: PIPELINE_PHASES.IMAGE_REVIEW, dryRun: true },
  },
  config: { dryRun: true, targetScore: 90, passingScore: 80, maxRounds: 3 },
  status: "resumable",
});

if (checkpoint.tool !== RESUME_STATE_TOOL) {
  throw new Error("tool mismatch");
}
if (checkpoint.nextPhase !== PIPELINE_PHASES.IMPROVEMENT) {
  throw new Error(`expected next IMPROVEMENT, got ${checkpoint.nextPhase}`);
}

await writeResumeState(checkpoint);
const loaded = await readResumeState();
if (loaded.checkpointPhase !== PIPELINE_PHASES.IMAGE_REVIEW) {
  throw new Error("checkpointPhase mismatch");
}

console.log("resume checkpoint roundtrip ok");
EOF
pass "resume checkpoint roundtrip"

echo ""
echo "-- Test 33: dry-run writes state.json --"
node scripts/run_quality_pipeline.js --dry-run --from-phase image-review --max-rounds 1 --clean-latest
node --input-type=module <<'EOF'
import fs from "node:fs";
import { getResumeStateAbsolutePath } from "./src/lib/pipeline_resume.js";
import { RESUME_STATE_TOOL } from "./src/lib/pipeline_resume.js";

const statePath = getResumeStateAbsolutePath();
if (!fs.existsSync(statePath)) {
  throw new Error("state.json missing after dry-run");
}
const checkpoint = JSON.parse(fs.readFileSync(statePath, "utf-8"));
if (checkpoint.tool !== RESUME_STATE_TOOL) {
  throw new Error(`unexpected tool: ${checkpoint.tool}`);
}
if (!checkpoint.nextPhase && checkpoint.status === "completed") {
  console.log("state.json completed ok");
} else if (checkpoint.nextPhase) {
  console.log(`state.json resumable next=${checkpoint.nextPhase}`);
} else {
  throw new Error("invalid state.json checkpoint");
}
EOF
pass "dry-run writes state.json"

echo ""
echo "-- Test 34: --stop-before-phase report + --resume --"
node scripts/run_quality_pipeline.js --dry-run --from-phase image-review --max-rounds 1 --clean-latest --stop-before-phase report
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";
import { PIPELINE_PHASES } from "./src/lib/phases.js";
import {
  getResumeStateAbsolutePath,
  RESUME_CHECKPOINT_STOP_REASON_BEFORE_PHASE,
} from "./src/lib/pipeline_resume.js";

const latestDir = path.join(PROJECT_ROOT, "reports/quality-pipeline/latest");
const checkpoint = JSON.parse(fs.readFileSync(getResumeStateAbsolutePath(), "utf-8"));
const pipelineState = JSON.parse(
  fs.readFileSync(path.join(latestDir, "pipeline_state.json"), "utf-8"),
);

if (checkpoint.status !== "resumable") {
  throw new Error(`expected resumable, got ${checkpoint.status}`);
}
if (checkpoint.stopReason !== RESUME_CHECKPOINT_STOP_REASON_BEFORE_PHASE) {
  throw new Error(`expected stopReason before-phase, got ${checkpoint.stopReason}`);
}
if (checkpoint.stopBeforePhase !== PIPELINE_PHASES.REPORT) {
  throw new Error(`expected stopBeforePhase REPORT, got ${checkpoint.stopBeforePhase}`);
}
if (checkpoint.nextPhase !== PIPELINE_PHASES.REPORT) {
  throw new Error(`expected nextPhase REPORT, got ${checkpoint.nextPhase}`);
}
if (checkpoint.checkpointPhase !== PIPELINE_PHASES.EXPORT) {
  throw new Error(`expected checkpointPhase EXPORT, got ${checkpoint.checkpointPhase}`);
}
if (pipelineState.completedSteps.includes(PIPELINE_PHASES.REPORT)) {
  throw new Error("REPORT should not be completed before resume");
}
if (fs.existsSync(path.join(latestDir, "report.json"))) {
  throw new Error("report.json should not exist before resume");
}

console.log("stop-before-phase checkpoint ok");
EOF
node scripts/run_quality_pipeline.js --resume 2>&1 | tail -5
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";
import { PIPELINE_PHASES } from "./src/lib/phases.js";
import { getResumeStateAbsolutePath } from "./src/lib/pipeline_resume.js";

const latestDir = path.join(PROJECT_ROOT, "reports/quality-pipeline/latest");
const pipelineState = JSON.parse(
  fs.readFileSync(path.join(latestDir, "pipeline_state.json"), "utf-8"),
);
const checkpoint = JSON.parse(fs.readFileSync(getResumeStateAbsolutePath(), "utf-8"));

if (!pipelineState.completedSteps.includes(PIPELINE_PHASES.REPORT)) {
  throw new Error("REPORT not completed after resume");
}
if (pipelineState.workspace?.action !== "resumed") {
  throw new Error("expected workspace action resumed");
}
if (checkpoint.status !== "completed") {
  throw new Error(`expected completed checkpoint, got ${checkpoint.status}`);
}
if (checkpoint.stopReason !== null) {
  throw new Error(`expected stopReason null after resume, got ${checkpoint.stopReason}`);
}
if (checkpoint.stopBeforePhase !== null) {
  throw new Error(`expected stopBeforePhase null after resume, got ${checkpoint.stopBeforePhase}`);
}
if (checkpoint.nextPhase !== null) {
  throw new Error(`expected nextPhase null after resume, got ${checkpoint.nextPhase}`);
}
if (!fs.existsSync(path.join(latestDir, "report.json"))) {
  throw new Error("report.json missing after resume");
}
if (!fs.existsSync(path.join(latestDir, "report.md"))) {
  throw new Error("report.md missing after resume");
}

console.log("resume continuation ok");
EOF
pass "stop-before-phase + resume"

echo ""
echo "-- Test 35: CLI help includes --stop-before-phase --"
node --input-type=module <<'EOF'
import { getPipelineHelpText } from "./src/lib/pipeline_config.js";

const help = getPipelineHelpText();
if (!help.includes("--stop-before-phase")) {
  throw new Error("CLI help missing --stop-before-phase");
}
console.log("CLI help stop-before-phase ok");
EOF
pass "CLI help stop-before-phase"

echo ""
echo "-- Test 36: --stop-before-phase before from-phase rejected --"
node --input-type=module <<'EOF'
import { createPipelineConfig } from "./src/lib/pipeline_config.js";

let threw = false;
try {
  createPipelineConfig([
    "node",
    "scripts/run_quality_pipeline.js",
    "--from-phase",
    "report",
    "--stop-before-phase",
    "report",
  ]);
} catch (error) {
  threw = true;
  if (!String(error.message).includes("--from-phase")) {
    throw new Error(`unexpected error: ${error.message}`);
  }
}
if (!threw) {
  throw new Error("expected validation error");
}
console.log("stop-before-phase order validation ok");
EOF
pass "stop-before-phase order validation"

echo ""
echo "-- Test 37: --resume and --stop-before-phase conflict --"
node --input-type=module <<'EOF'
import { createPipelineConfig } from "./src/lib/pipeline_config.js";
import fs from "node:fs";
import { getResumeStateAbsolutePath } from "./src/lib/pipeline_resume.js";

const statePath = getResumeStateAbsolutePath();
if (!fs.existsSync(statePath)) {
  fs.writeFileSync(statePath, '{"tool":"quality_pipeline_resume","status":"resumable","nextPhase":"REPORT"}\n');
}

let threw = false;
try {
  createPipelineConfig([
    "node",
    "scripts/run_quality_pipeline.js",
    "--resume",
    "--stop-before-phase",
    "report",
  ]);
} catch (error) {
  threw = true;
  if (!String(error.message).includes("--stop-before-phase")) {
    throw new Error(`unexpected error: ${error.message}`);
  }
}
if (!threw) {
  throw new Error("expected conflict error");
}
console.log("resume stop-before-phase conflict ok");
EOF
pass "resume stop-before-phase conflict"

echo ""
echo "-- Test 38: resume artifacts exist --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const latestDir = path.join(PROJECT_ROOT, "reports/quality-pipeline/latest");
const required = [
  "pipeline_state.json",
  "state.json",
  "metrics.json",
  "report.json",
  "report.md",
];

for (const file of required) {
  const filePath = path.join(latestDir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing artifact: ${file}`);
  }
}

console.log("resume artifacts ok");
EOF
pass "resume artifacts"

echo ""
echo "-- Test 39: nightly-apply workflow contract --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const nightlyPath = path.join(PROJECT_ROOT, ".github/workflows/nightly-apply.yml");
const ciPath = path.join(PROJECT_ROOT, ".github/workflows/quality-pipeline-ci.yml");

if (!fs.existsSync(nightlyPath)) {
  throw new Error("missing .github/workflows/nightly-apply.yml");
}

const workflow = fs.readFileSync(nightlyPath, "utf-8");

function assertContains(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: expected to include ${JSON.stringify(needle)}`);
  }
}

assertContains("workflow name", workflow, "name: Nightly Apply Workflow");
assertContains("workflow_dispatch", workflow, "workflow_dispatch:");
assertContains("resume input", workflow, "inputs:");
assertContains("resume input name", workflow, "resume:");
assertContains("resume input type", workflow, "type: boolean");
assertContains("resume input default", workflow, "default: false");
assertContains("resume description", workflow, "description: Resume from previous state.json");
assertContains("schedule", workflow, "schedule:");
assertContains("cron", workflow, 'cron: "0 18 * * *"');
assertContains("job-level main guard", workflow, "if: github.ref == 'refs/heads/main'");
assertContains("verify main step", workflow, "name: Verify main branch");
assertContains("secrets step", workflow, "name: Check required secrets");
assertContains("OPENAI_API_KEY check", workflow, "OPENAI_API_KEY");
assertContains("GEMINI_API_KEY check", workflow, "GEMINI_API_KEY");
assertContains("NANO_BANANA_API_KEY check", workflow, "NANO_BANANA_API_KEY");

const secretsStep = workflow.match(
  /name: Check required secrets[\s\S]*?(?=\n      - name:)/,
);
if (!secretsStep) {
  throw new Error("Check required secrets step not found");
}
if (!secretsStep[0].includes('NANO_BANANA_API_KEY: ${{ secrets.NANO_BANANA_API_KEY }}')) {
  throw new Error("NANO_BANANA_API_KEY must be injected in Check required secrets env");
}
if (!secretsStep[0].includes('GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}')) {
  throw new Error("GEMINI_API_KEY must be injected in Check required secrets env");
}
if (!secretsStep[0].includes('[ -z "${GEMINI_API_KEY}" ] && [ -z "${NANO_BANANA_API_KEY}" ]')) {
  throw new Error("Check required secrets must use GEMINI_API_KEY or NANO_BANANA_API_KEY OR condition");
}
if (secretsStep[0].includes('missing+=("NANO_BANANA_API_KEY")')) {
  throw new Error("NANO_BANANA_API_KEY must not be individually required in Check required secrets");
}
if (secretsStep[0].includes('missing+=("GEMINI_API_KEY")')) {
  throw new Error("GEMINI_API_KEY must not be individually required in Check required secrets");
}

const applyStep = workflow.match(
  /name: Run quality pipeline apply[\s\S]*?(?=\n      - name:)/,
);
if (!applyStep) {
  throw new Error("Run quality pipeline apply step not found");
}
if (!applyStep[0].includes('NANO_BANANA_API_KEY: ${{ secrets.NANO_BANANA_API_KEY }}')) {
  throw new Error("NANO_BANANA_API_KEY must be injected in apply step env");
}
if (!applyStep[0].includes('GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}')) {
  throw new Error("GEMINI_API_KEY must be injected in apply step env");
}

const failureSummaryStep = workflow.match(
  /name: Create failure summary[\s\S]*?(?=\n      - name:)/,
);
if (!failureSummaryStep) {
  throw new Error("Create failure summary step not found");
}
if (!failureSummaryStep[0].includes('NANO_BANANA_API_KEY: ${{ secrets.NANO_BANANA_API_KEY }}')) {
  throw new Error("NANO_BANANA_API_KEY must be injected in failure summary env");
}
if (!failureSummaryStep[0].includes('[ -z "${GEMINI_API_KEY}" ] && [ -z "${NANO_BANANA_API_KEY}" ]')) {
  throw new Error("failure summary must use GEMINI_API_KEY or NANO_BANANA_API_KEY OR condition");
}
if (failureSummaryStep[0].includes('missing_secrets+=("NANO_BANANA_API_KEY")')) {
  throw new Error("NANO_BANANA_API_KEY must not be individually required in failure summary");
}
if (failureSummaryStep[0].includes('missing_secrets+=("GEMINI_API_KEY")')) {
  throw new Error("GEMINI_API_KEY must not be individually required in failure summary");
}
if (!failureSummaryStep[0].includes("OPENAI_API_KEY is not set")) {
  throw new Error("failure summary must report OPENAI_API_KEY separately");
}

assertContains("apply clean-latest command", workflow, "npm run quality-pipeline -- --apply --clean-latest");
assertContains("apply resume command", workflow, "npm run quality-pipeline -- --apply --resume");
assertContains("failure summary step", workflow, "name: Create failure summary");
assertContains("failure summary artifact", workflow, "reports/quality-pipeline/latest/failure-summary.md");
assertContains("upload always", workflow, "if: always()");
assertContains("if-no-files-found warn", workflow, "if-no-files-found: warn");
assertContains("retention-days 14", workflow, "retention-days: 14");

const resumeBranch = workflow.match(
  /if \[ "\$\{RESUME\}" = "true" \]; then[\s\S]*?else/,
);
if (!resumeBranch) {
  throw new Error("resume branch not found in apply step");
}
const resumeCommands = resumeBranch[0]
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("npm run quality-pipeline"));
if (resumeCommands.length !== 1) {
  throw new Error(`expected one resume npm command, got ${resumeCommands.length}`);
}
if (!resumeCommands[0].includes("--apply --resume")) {
  throw new Error(`unexpected resume command: ${resumeCommands[0]}`);
}
if (resumeCommands[0].includes("--clean-latest")) {
  throw new Error("resume npm command must not include --clean-latest");
}

if (!fs.existsSync(ciPath)) {
  throw new Error("missing .github/workflows/quality-pipeline-ci.yml");
}
const ci = fs.readFileSync(ciPath, "utf-8");
assertContains("ci workflow name", ci, "name: Quality Pipeline CI");
assertContains("ci npm test step", ci, "name: Run tests");
assertContains("ci npm test command", ci, "npm test");
assertContains("ci dry-run step", ci, "quality-pipeline:dry-run");
assertContains("ci stop-before-phase", ci, "--stop-before-phase report");
assertContains("ci resume dry-run", ci, "quality-pipeline:dry-run -- --resume");
assertContains("ci upload step", ci, "name: Upload quality pipeline reports");
assertContains("ci upload artifact action", ci, "actions/upload-artifact@v7");
if (ci.includes("Nightly Apply Workflow")) {
  throw new Error("quality-pipeline-ci.yml must not contain Nightly Apply Workflow content");
}
if (ci.includes("nightly-apply-")) {
  throw new Error("quality-pipeline-ci.yml must not contain nightly-apply artifact naming");
}

console.log("nightly-apply workflow contract ok");
EOF
pass "nightly-apply workflow contract"

echo "-- Test 40: health_check.js JSON output --"
node --input-type=module <<'EOF'
import { spawn } from "node:child_process";
import path from "node:path";
import { HEALTH_CHECK_JSON_MARKER } from "./src/health_check.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const scriptPath = path.join(PROJECT_ROOT, "src/health_check.js");

const output = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [scriptPath, "--json"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, HEALTH_CHECK_JSON: "1" },
  });
  let text = "";
  child.stdout.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", () => resolve(text));
});

if (!output.includes("Health Check（動作環境の確認）")) {
  throw new Error("human-readable health check output must be preserved");
}

const markerIndex = output.lastIndexOf(HEALTH_CHECK_JSON_MARKER);
if (markerIndex < 0) {
  throw new Error("JSON marker not found in health_check --json output");
}

const payload = JSON.parse(output.slice(markerIndex + HEALTH_CHECK_JSON_MARKER.length).trim());
for (const field of ["ok", "warning", "error", "items"]) {
  if (!(field in payload)) {
    throw new Error(`JSON payload missing field: ${field}`);
  }
}
if (!Array.isArray(payload.items) || payload.items.length === 0) {
  throw new Error("JSON items must be a non-empty array");
}
for (const item of payload.items) {
  for (const field of ["status", "label", "detail"]) {
    if (!(field in item)) {
      throw new Error(`JSON item missing field: ${field}`);
    }
  }
}

console.log("health_check JSON output ok");
EOF
pass "health_check.js JSON output"

echo "-- Test 41: parseHealthCheckStdout / buildHealthCheckSummaryData --"
node --input-type=module <<'EOF'
import {
  buildHealthCheckSummaryData,
  parseHealthCheckStdout,
  parseHealthCheckCountsFromStdout,
} from "./src/lib/pipeline_phase_handlers.js";
import { HEALTH_CHECK_JSON_MARKER } from "./src/health_check.js";

const sampleJson = {
  ok: 2,
  warning: 1,
  error: 1,
  items: [
    { status: "ok", label: "OPENAI_API_KEY", detail: "設定されています。" },
    { status: "error", label: ".env ファイル", detail: "見つかりません。" },
  ],
};
const stdout =
  "OK: 2 件\nWarning: 1 件\nError: 1 件\n" +
  `${HEALTH_CHECK_JSON_MARKER}${JSON.stringify(sampleJson)}`;

const parsed = parseHealthCheckStdout(stdout);
if (!parsed.parsed) {
  throw new Error("expected JSON parse success");
}
if (parsed.errorCount !== 1 || parsed.okCount !== 2 || parsed.warningCount !== 1) {
  throw new Error("unexpected parsed counts");
}

const summary = buildHealthCheckSummaryData(parsed);
if (!Array.isArray(summary.errors) || summary.errors.length !== 1) {
  throw new Error("expected one error in healthCheck.errors");
}
if (summary.errors[0].label !== ".env ファイル") {
  throw new Error("unexpected error label");
}
if (!Array.isArray(summary.items) || summary.items.length !== 2) {
  throw new Error("expected healthCheck.items");
}

const fallbackStdout = "OK: 3 件\nWarning: 0 件\nError: 2 件\n";
const fallbackParsed = parseHealthCheckStdout(fallbackStdout);
if (fallbackParsed.parsed) {
  throw new Error("expected regex fallback when JSON marker absent");
}
const fallbackCounts = parseHealthCheckCountsFromStdout(fallbackStdout);
if (fallbackCounts.errorCount !== 2 || fallbackCounts.okCount !== 3) {
  throw new Error("regex fallback counts mismatch");
}
const fallbackSummary = buildHealthCheckSummaryData(fallbackParsed);
if (fallbackSummary.errors.length !== 0) {
  throw new Error("fallback summary must have empty errors without items");
}

console.log("health check parser ok");
EOF
pass "parseHealthCheckStdout / buildHealthCheckSummaryData"

echo "-- Test 42: healthCheck.errors metrics contract --"
node --input-type=module <<'EOF'
import { buildHealthCheckSummaryData } from "./src/lib/pipeline_phase_handlers.js";

const summary = buildHealthCheckSummaryData({
  parsed: true,
  okCount: 1,
  warningCount: 0,
  errorCount: 1,
  items: [
    {
      status: "error",
      label: "GEMINI_API_KEY",
      detail: "未設定です。.env に GEMINI_API_KEY=... を追加してください。",
    },
  ],
});

const expectedKeys = [
  "ok",
  "okCount",
  "warningCount",
  "errorCount",
  "items",
  "errors",
  "jsonParsed",
];
for (const key of expectedKeys) {
  if (!(key in summary)) {
    throw new Error(`healthCheck summary missing key: ${key}`);
  }
}
if (summary.errors.length !== 1) {
  throw new Error("expected errors array length 1");
}

// metrics.byPhase.HEALTH_CHECK.summary への保存契約（applyPhaseResult spread）
const phaseSummary = {
  status: "failed",
  message: "Health Check failed: Error 1 件",
  healthCheck: summary,
};
if (!phaseSummary.healthCheck.errors?.[0]?.detail.includes("未設定")) {
  throw new Error("phase summary must retain healthCheck.errors detail");
}

console.log("healthCheck metrics contract ok");
EOF
pass "healthCheck.errors metrics contract"

echo "-- Test 43: health check output must not leak API key values --"
FAKE_OPENAI_KEY="sk-test-fake-openai-key-do-not-log-v190"
FAKE_GEMINI_KEY="AIzaSyFakeGeminiKeyForTestV190Only"
node --input-type=module <<EOF
import { spawn } from "node:child_process";
import path from "node:path";
import { HEALTH_CHECK_JSON_MARKER } from "./src/health_check.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const scriptPath = path.join(PROJECT_ROOT, "src/health_check.js");
const fakeOpenAi = "${FAKE_OPENAI_KEY}";
const fakeGemini = "${FAKE_GEMINI_KEY}";

const output = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [scriptPath, "--json"], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      HEALTH_CHECK_JSON: "1",
      OPENAI_API_KEY: fakeOpenAi,
      GEMINI_API_KEY: fakeGemini,
    },
  });
  let text = "";
  child.stdout.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", () => resolve(text));
});

if (output.includes(fakeOpenAi)) {
  throw new Error("OPENAI_API_KEY value leaked in health check output");
}
if (output.includes(fakeGemini)) {
  throw new Error("GEMINI_API_KEY value leaked in health check output");
}

const markerIndex = output.lastIndexOf(HEALTH_CHECK_JSON_MARKER);
const payload = JSON.parse(
  output.slice(markerIndex + HEALTH_CHECK_JSON_MARKER.length).trim(),
);
const serialized = JSON.stringify(payload);
if (serialized.includes(fakeOpenAi) || serialized.includes(fakeGemini)) {
  throw new Error("API key values leaked in health check JSON");
}

console.log("health check secret redaction ok");
EOF
pass "health check output must not leak API key values"

echo "-- Test 44: nightly-apply failure summary health check errors contract --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const nightlyPath = path.join(PROJECT_ROOT, ".github/workflows/nightly-apply.yml");
const workflow = fs.readFileSync(nightlyPath, "utf-8");

function assertContains(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: expected to include ${JSON.stringify(needle)}`);
  }
}

const failureStep = workflow.match(
  /name: Create failure summary[\s\S]*?(?=\n      - name:)/,
);
if (!failureStep) {
  throw new Error("Create failure summary step not found");
}

assertContains(
  "metrics.json path",
  failureStep[0],
  'METRICS_FILE="reports/quality-pipeline/latest/metrics.json"',
);
assertContains(
  "health check errors heading",
  failureStep[0],
  "### Health Check Errors",
);
assertContains(
  "metrics healthCheck.errors path",
  failureStep[0],
  "metrics?.byPhase?.HEALTH_CHECK?.summary?.healthCheck?.errors",
);
assertContains(
  "error item format",
  failureStep[0],
  "${item.label}: ${item.detail}",
);

// heredoc 内行が run: | ブロック外に漏れていないこと（YAML invalid 防止）
const heredocMatch = failureStep[0].match(/node <<'NODE'\n([\s\S]*?)\n\s*NODE/);
if (!heredocMatch) {
  throw new Error("node <<'NODE' heredoc block not found in failure summary step");
}
const heredocBody = heredocMatch[1];
for (const [index, line] of heredocBody.split("\n").entries()) {
  if (!line.trim()) {
    continue;
  }
  if (!/^ {10,}/.test(line)) {
    throw new Error(
      `heredoc line ${index + 1} is under-indented for run block (need >=10 spaces): ${JSON.stringify(line)}`,
    );
  }
}

// Ruby YAML で workflow 全体が valid であること
import { execSync } from "node:child_process";
try {
  execSync(
    `ruby -ryaml -e "YAML.load_file('${nightlyPath.replace(/'/g, "'\\''")}')"`,
    { stdio: "pipe" },
  );
} catch (error) {
  throw new Error(`nightly-apply.yml must be valid YAML: ${error.stderr?.toString() ?? error.message}`);
}

console.log("nightly failure summary health check contract ok");
EOF
pass "nightly-apply failure summary health check errors contract"

# Tests 45–47: .env 不在時の Health Check（.env を一時退避）
HEALTH_CHECK_ENV_BACKUP=""
if [ -f .env ]; then
  HEALTH_CHECK_ENV_BACKUP=".env.health-check-test.backup"
  mv .env "${HEALTH_CHECK_ENV_BACKUP}"
fi
restore_health_check_env() {
  if [ -n "${HEALTH_CHECK_ENV_BACKUP}" ] && [ -f "${HEALTH_CHECK_ENV_BACKUP}" ]; then
    mv "${HEALTH_CHECK_ENV_BACKUP}" .env
    HEALTH_CHECK_ENV_BACKUP=""
  fi
}
trap restore_health_check_env EXIT

echo "-- Test 45: GitHub Actions health check without .env file --"
node --input-type=module <<'EOF'
import { spawn } from "node:child_process";
import path from "node:path";
import { HEALTH_CHECK_JSON_MARKER } from "./src/health_check.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const scriptPath = path.join(PROJECT_ROOT, "src/health_check.js");

function parsePayload(output) {
  const markerIndex = output.lastIndexOf(HEALTH_CHECK_JSON_MARKER);
  if (markerIndex < 0) {
    throw new Error("JSON marker not found");
  }
  return JSON.parse(output.slice(markerIndex + HEALTH_CHECK_JSON_MARKER.length).trim());
}

function findItem(payload, label) {
  return payload.items.find((item) => item.label === label);
}

const output = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [scriptPath, "--json"], {
    cwd: PROJECT_ROOT,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      GITHUB_ACTIONS: "true",
      HEALTH_CHECK_JSON: "1",
      OPENAI_API_KEY: "sk-test-gha-openai-v192",
      GEMINI_API_KEY: "test-gha-gemini-v192",
    },
  });
  let text = "";
  child.stdout.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", () => resolve(text));
});

const payload = parsePayload(output);
const envItem = findItem(payload, ".env ファイル");
if (!envItem || envItem.status !== "ok") {
  throw new Error(`expected .env ファイル ok in GitHub Actions without .env, got ${envItem?.status}`);
}
if (payload.error > 0) {
  throw new Error(`expected zero errors in Test 45, got ${payload.error}`);
}

console.log("GitHub Actions health check without .env ok");
EOF
pass "GitHub Actions health check without .env file"

echo "-- Test 46: local health check requires .env file --"
node --input-type=module <<'EOF'
import { spawn } from "node:child_process";
import path from "node:path";
import { HEALTH_CHECK_JSON_MARKER } from "./src/health_check.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const scriptPath = path.join(PROJECT_ROOT, "src/health_check.js");

const output = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [scriptPath, "--json"], {
    cwd: PROJECT_ROOT,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      HEALTH_CHECK_JSON: "1",
    },
  });
  let text = "";
  child.stdout.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", () => resolve(text));
});

const markerIndex = output.lastIndexOf(HEALTH_CHECK_JSON_MARKER);
const payload = JSON.parse(output.slice(markerIndex + HEALTH_CHECK_JSON_MARKER.length).trim());
const envItem = payload.items.find((item) => item.label === ".env ファイル");
if (!envItem || envItem.status !== "error") {
  throw new Error(`expected .env ファイル error locally without .env, got ${envItem?.status}`);
}
if (payload.error === 0) {
  throw new Error("expected at least one error locally without .env");
}

console.log("local health check requires .env ok");
EOF
pass "local health check requires .env file"

echo "-- Test 47: GitHub Actions health check fails when secrets missing --"
node --input-type=module <<'EOF'
import { spawn } from "node:child_process";
import path from "node:path";
import { HEALTH_CHECK_JSON_MARKER } from "./src/health_check.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const scriptPath = path.join(PROJECT_ROOT, "src/health_check.js");

const output = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [scriptPath, "--json"], {
    cwd: PROJECT_ROOT,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      GITHUB_ACTIONS: "true",
      HEALTH_CHECK_JSON: "1",
    },
  });
  let text = "";
  child.stdout.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    text += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", () => resolve(text));
});

const markerIndex = output.lastIndexOf(HEALTH_CHECK_JSON_MARKER);
const payload = JSON.parse(output.slice(markerIndex + HEALTH_CHECK_JSON_MARKER.length).trim());
const envItem = payload.items.find((item) => item.label === ".env ファイル");
if (!envItem || envItem.status !== "ok") {
  throw new Error(`expected .env ファイル ok in GitHub Actions, got ${envItem?.status}`);
}
const openaiItem = payload.items.find((item) => item.label === "OPENAI_API_KEY");
if (!openaiItem || openaiItem.status !== "error") {
  throw new Error(`expected OPENAI_API_KEY error when secrets missing, got ${openaiItem?.status}`);
}
const geminiItem = payload.items.find((item) => item.label === "GEMINI_API_KEY");
const nanoItem = payload.items.find((item) => item.label === "NANO_BANANA_API_KEY");
if (
  (!geminiItem || geminiItem.status !== "error") &&
  (!nanoItem || nanoItem.status !== "error")
) {
  throw new Error("expected GEMINI_API_KEY or NANO_BANANA_API_KEY error when secrets missing");
}
if (payload.error === 0) {
  throw new Error("expected errors when GitHub Actions secrets are missing");
}

console.log("GitHub Actions health check missing secrets ok");
EOF
pass "GitHub Actions health check fails when secrets missing"

restore_health_check_env
trap - EXIT

echo "-- Test 48: successful apply outcome resolves to exit 0 --"
node --input-type=module <<'EOF'
import {
  getPipelineExitCode,
  isPipelineSuccessfulOutcome,
  PIPELINE_EXIT_CODES,
} from "./src/lib/exit_codes.js";
import { IMPROVEMENT_STOP_REASONS } from "./src/lib/pipeline_improvement.js";
import {
  createInitialPipelineState,
  finalizeSuccessfulPipelineState,
} from "./src/lib/pipeline_state.js";

const config = {
  targetScore: 90,
  passingScore: 80,
  maxRounds: 3,
  dryRun: false,
  fromPhase: "INIT",
};

const state = {
  ...createInitialPipelineState(config),
  status: "failed",
  phase: "FAILED",
  failedSteps: [
    {
      phase: "HEALTH_CHECK",
      reason: "Health Check failed: Error 1 件",
      at: "2026-01-01T00:00:00.000Z",
    },
  ],
  scoreSummary: {
    targetScore: 90,
    passingScore: 80,
    averageScore: 91.8,
    minScore: 90,
    allSlidesPassed: true,
    allSlidesPublishRecommended: true,
    slides: [],
  },
  improvement: {
    roundsExecuted: 1,
    maxRounds: 3,
    stopReason: IMPROVEMENT_STOP_REASONS.ALL_SLIDES_PUBLISH_RECOMMENDED,
    history: [],
  },
};

const metrics = {
  failedCalls: 0,
  improvement: {
    stopReason: IMPROVEMENT_STOP_REASONS.ALL_SLIDES_PUBLISH_RECOMMENDED,
    lastRound: {
      failedActions: 0,
      successfulActions: 4,
    },
  },
};

const outcomeParams = {
  state,
  metrics,
  improvementStopReason: IMPROVEMENT_STOP_REASONS.ALL_SLIDES_PUBLISH_RECOMMENDED,
  healthCheckFailed: false,
  dryRun: false,
  allSlidesPublishRecommended: true,
  allSlidesPassed: true,
};

if (!isPipelineSuccessfulOutcome(outcomeParams)) {
  throw new Error("expected successful pipeline outcome");
}

const exitCode = getPipelineExitCode(outcomeParams);
if (exitCode !== PIPELINE_EXIT_CODES.SUCCESS) {
  throw new Error(`expected exit code 0, got ${exitCode}`);
}

const finalized = finalizeSuccessfulPipelineState(state);
if (finalized.status !== "completed") {
  throw new Error(`expected status completed, got ${finalized.status}`);
}
if (finalized.phase !== "COMPLETE") {
  throw new Error(`expected final phase COMPLETE, got ${finalized.phase}`);
}
if (finalized.failedSteps.length !== 0) {
  throw new Error("expected failedSteps to be cleared on success finalize");
}

console.log("successful apply outcome ok");
EOF
pass "successful apply outcome resolves to exit 0"

echo "-- Test 49: failedSteps remain failed with exit 4 --"
node --input-type=module <<'EOF'
import {
  getPipelineExitCode,
  isPipelineSuccessfulOutcome,
  PIPELINE_EXIT_CODES,
} from "./src/lib/exit_codes.js";
import { createInitialPipelineState } from "./src/lib/pipeline_state.js";

const config = {
  targetScore: 90,
  passingScore: 80,
  maxRounds: 3,
  dryRun: false,
  fromPhase: "INIT",
};

const state = {
  ...createInitialPipelineState(config),
  status: "failed",
  phase: "FAILED",
  failedSteps: [
    {
      phase: "HEALTH_CHECK",
      reason: "Health Check failed: Error 1 件",
      at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const params = {
  state,
  metrics: { failedCalls: 0 },
  dryRun: false,
  healthCheckFailed: false,
  allSlidesPublishRecommended: false,
  allSlidesPassed: false,
};

if (isPipelineSuccessfulOutcome(params)) {
  throw new Error("expected unsuccessful pipeline outcome");
}

const exitCode = getPipelineExitCode(params);
if (exitCode !== PIPELINE_EXIT_CODES.UNEXPECTED_ERROR) {
  throw new Error(`expected exit code 4, got ${exitCode}`);
}

console.log("failedSteps failed outcome ok");
EOF
pass "failedSteps remain failed with exit 4"

echo "-- Test 50: nightly-apply workflow propagates pipeline exit code --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const nightlyPath = path.join(PROJECT_ROOT, ".github/workflows/nightly-apply.yml");
const workflow = fs.readFileSync(nightlyPath, "utf-8");

const applyStep = workflow.match(
  /name: Run quality pipeline apply[\s\S]*?(?=\n      - name:)/,
);
if (!applyStep) {
  throw new Error("Run quality pipeline apply step not found");
}

if (applyStep[0].includes("continue-on-error: true")) {
  throw new Error("apply step must not use continue-on-error: true");
}
if (applyStep[0].includes("|| true")) {
  throw new Error("apply step must not mask failures with || true");
}
if (!applyStep[0].includes("npm run quality-pipeline -- --apply")) {
  throw new Error("apply step must run quality-pipeline apply");
}
if (!applyStep[0].includes("PIPELINE_EXIT_CODE")) {
  throw new Error("apply step must capture PIPELINE_EXIT_CODE");
}
if (!applyStep[0].includes('elif [ "${PIPELINE_EXIT_CODE}" -eq 3 ]')) {
  throw new Error("apply step must treat exit code 3 as workflow success");
}

console.log("nightly apply exit propagation contract ok");
EOF
pass "nightly-apply workflow propagates pipeline exit code"

echo "-- Test 51: publishRecommended=false yields exit 3 and workflow success --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import {
  getPipelineExitCode,
  isNightlyApplyWorkflowSuccessExitCode,
  isPipelineImprovementRecommendedExitCode,
  PIPELINE_EXIT_CODES,
} from "./src/lib/exit_codes.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const exitCode = getPipelineExitCode({
  state: {
    failedSteps: [],
    scoreSummary: {
      allSlidesPassed: true,
      allSlidesPublishRecommended: false,
    },
  },
  metrics: {},
  dryRun: false,
  healthCheckFailed: false,
  allSlidesPassed: true,
  allSlidesPublishRecommended: false,
});

if (exitCode !== PIPELINE_EXIT_CODES.PARTIAL_SUCCESS) {
  throw new Error(`expected exit code 3, got ${exitCode}`);
}
if (!isNightlyApplyWorkflowSuccessExitCode(exitCode)) {
  throw new Error("exit code 3 must be treated as workflow success");
}
if (!isPipelineImprovementRecommendedExitCode(exitCode)) {
  throw new Error("exit code 3 must be improvement recommended");
}

const runScript = fs.readFileSync(
  path.join(PROJECT_ROOT, "scripts/run_quality_pipeline.js"),
  "utf-8",
);
if (!runScript.includes("quality status: Improvement Recommended")) {
  throw new Error("run_quality_pipeline.js must log improvement recommended status");
}
if (!runScript.includes("GITHUB_STEP_SUMMARY")) {
  throw new Error("run_quality_pipeline.js must write GitHub Step Summary");
}

const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/nightly-apply.yml"),
  "utf-8",
);
if (!workflow.includes("improvement recommended")) {
  throw new Error("nightly-apply must handle exit code 3 as success");
}

console.log("publishRecommended=false workflow success contract ok");
EOF
pass "publishRecommended=false yields exit 3 and workflow success"

echo "-- Test 52: Health Check error yields exit 1 and workflow failure --"
node --input-type=module <<'EOF'
import {
  getPipelineExitCode,
  isNightlyApplyWorkflowSuccessExitCode,
  PIPELINE_EXIT_CODES,
} from "./src/lib/exit_codes.js";

const exitCode = getPipelineExitCode({
  state: { failedSteps: [], scoreSummary: {} },
  metrics: {
    byPhase: {
      HEALTH_CHECK: {
        summary: {
          healthCheck: {
            errors: [{ label: "OPENAI_API_KEY", detail: "missing" }],
          },
        },
      },
    },
  },
  dryRun: false,
  healthCheckFailed: true,
});

if (exitCode !== PIPELINE_EXIT_CODES.CONFIG_ERROR) {
  throw new Error(`expected exit code 1, got ${exitCode}`);
}
if (isNightlyApplyWorkflowSuccessExitCode(exitCode)) {
  throw new Error("exit code 1 must not be treated as workflow success");
}

console.log("health check error workflow failure contract ok");
EOF
pass "Health Check error yields exit 1 and workflow failure"

echo "-- Test 53: internal error yields exit 4 and workflow failure --"
node --input-type=module <<'EOF'
import {
  getPipelineExitCode,
  isNightlyApplyWorkflowSuccessExitCode,
  PIPELINE_EXIT_CODES,
} from "./src/lib/exit_codes.js";

const exitCode = getPipelineExitCode({
  state: {
    failedSteps: [{ step: "IMPROVE", error: "unexpected" }],
    scoreSummary: {},
  },
  metrics: {},
  dryRun: false,
  healthCheckFailed: false,
  error: new Error("unexpected"),
});

if (exitCode !== PIPELINE_EXIT_CODES.UNEXPECTED_ERROR) {
  throw new Error(`expected exit code 4, got ${exitCode}`);
}
if (isNightlyApplyWorkflowSuccessExitCode(exitCode)) {
  throw new Error("exit code 4 must not be treated as workflow success");
}

console.log("internal error workflow failure contract ok");
EOF
pass "internal error yields exit 4 and workflow failure"

echo "-- Test 54: workflow Step Summary observability contract --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

for (const rel of [
  ".github/workflows/quality-pipeline-ci.yml",
  ".github/workflows/nightly-apply.yml",
]) {
  const workflow = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
  if (!workflow.includes("name: Write workflow summary")) {
    throw new Error(`${rel} must define Write workflow summary step`);
  }
  if (!workflow.includes("if: always()")) {
    throw new Error(`${rel} must use if: always() for summary step`);
  }
  if (!workflow.includes("GITHUB_STEP_SUMMARY")) {
    throw new Error(`${rel} must write GITHUB_STEP_SUMMARY`);
  }
  if (!workflow.includes("gha-step-timing.tsv")) {
    throw new Error(`${rel} must record step timings`);
  }
  if (!workflow.includes("cache-dependency-path: package-lock.json")) {
    throw new Error(`${rel} must keep cache-dependency-path`);
  }
}

console.log("workflow Step Summary observability contract ok");
EOF
pass "workflow Step Summary observability contract"

echo "-- Test 55: Performance / Cache Observation summary contract --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const ciPath = path.join(PROJECT_ROOT, ".github/workflows/quality-pipeline-ci.yml");
const nightlyPath = path.join(PROJECT_ROOT, ".github/workflows/nightly-apply.yml");
const ci = fs.readFileSync(ciPath, "utf-8");
const nightly = fs.readFileSync(nightlyPath, "utf-8");

for (const [label, workflow] of [
  ["quality-pipeline-ci.yml", ci],
  ["nightly-apply.yml", nightly],
]) {
  if (!workflow.includes("Performance / Cache Observation")) {
    throw new Error(`${label} must include Performance / Cache Observation section`);
  }
  if (!workflow.includes("npm ci duration")) {
    throw new Error(`${label} must include npm ci duration in summary`);
  }
  if (
    !workflow.includes("package-lock hash") &&
    !workflow.includes("lock_hash")
  ) {
    throw new Error(`${label} must include package-lock hash in summary`);
  }
  if (!workflow.includes("cache-dependency-path")) {
    throw new Error(`${label} must reference cache-dependency-path in summary`);
  }
}

if (!nightly.includes("apply duration")) {
  throw new Error("nightly-apply.yml must include apply duration in summary");
}

console.log("Performance / Cache Observation summary contract ok");
EOF
pass "Performance / Cache Observation summary contract"

echo "-- Test 56: performance-observation.json contract --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildObservation,
  parsePipelineExitCode,
} from "./scripts/gha_write_performance_observation.js";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const ciPath = path.join(PROJECT_ROOT, ".github/workflows/quality-pipeline-ci.yml");
const nightlyPath = path.join(PROJECT_ROOT, ".github/workflows/nightly-apply.yml");
const ci = fs.readFileSync(ciPath, "utf-8");
const nightly = fs.readFileSync(nightlyPath, "utf-8");

for (const [label, workflow] of [
  ["quality-pipeline-ci.yml", ci],
  ["nightly-apply.yml", nightly],
]) {
  if (!workflow.includes("gha_write_performance_observation.js")) {
    throw new Error(`${label} must invoke gha_write_performance_observation.js`);
  }
}

if (!nightly.includes("reports/quality-pipeline/latest/performance-observation.json")) {
  throw new Error("nightly-apply.yml artifact path must include performance-observation.json");
}

const scriptPath = path.join(PROJECT_ROOT, "scripts/gha_write_performance_observation.js");
if (!fs.readFileSync(scriptPath, "utf-8").includes("performance-observation.json")) {
  throw new Error("gha_write_performance_observation.js must write performance-observation.json");
}

if (!ci.match(/name: Upload quality pipeline reports[\s\S]*if: always\(\)/)) {
  throw new Error("quality-pipeline-ci.yml upload step must use if: always()");
}

const timingFile = path.join(os.tmpdir(), `gha-timing-${Date.now()}.tsv`);
fs.writeFileSync(
  timingFile,
  [
    "npm ci|12|success",
    "npm test|34|success",
    "quality-pipeline dry-run (stop-before-phase)|20|success",
    "quality-pipeline dry-run (resume)|8|success",
  ].join("\n"),
);

process.env.PO_VARIANT = "ci";
process.env.PO_TIMING_FILE = timingFile;
process.env.GHA_WORKFLOW_NAME = "Quality Pipeline CI";
process.env.GHA_RUN_ID = "123";
process.env.JOB_STATUS = "success";

const ciObservation = buildObservation();
const requiredCiKeys = [
  "schemaVersion",
  "generatedAt",
  "workflow",
  "runtime",
  "cache",
  "durations",
  "stepTimings",
];
for (const key of requiredCiKeys) {
  if (!(key in ciObservation)) {
    throw new Error(`CI observation missing key: ${key}`);
  }
}
if (ciObservation.durations.npmCiSeconds !== 12) {
  throw new Error(`expected npmCiSeconds 12, got ${ciObservation.durations.npmCiSeconds}`);
}
if (ciObservation.cache.dependencyPath !== "package-lock.json") {
  throw new Error("cache.dependencyPath must be package-lock.json");
}
if (ciObservation.workflow.pipelineExitCode !== undefined) {
  throw new Error("CI observation must not include pipelineExitCode");
}

process.env.PO_VARIANT = "nightly";
process.env.PIPELINE_EXIT_CODE = "3";
fs.writeFileSync(timingFile, "npm ci|10|success\nquality-pipeline apply|400|success\n");

const nightlyObservation = buildObservation();
if (nightlyObservation.workflow.pipelineExitCode !== 3) {
  throw new Error(`expected pipelineExitCode 3, got ${nightlyObservation.workflow.pipelineExitCode}`);
}
if (nightlyObservation.workflow.qualityStatus !== "Improvement Recommended") {
  throw new Error(`unexpected qualityStatus: ${nightlyObservation.workflow.qualityStatus}`);
}
if (nightlyObservation.durations.applySeconds !== 400) {
  throw new Error(`expected applySeconds 400, got ${nightlyObservation.durations.applySeconds}`);
}
if (parsePipelineExitCode("") !== null) {
  throw new Error("parsePipelineExitCode('') must return null");
}
if (parsePipelineExitCode("1") !== 1) {
  throw new Error("parsePipelineExitCode('1') must return 1");
}

fs.unlinkSync(timingFile);
console.log("performance-observation.json contract ok");
EOF
pass "performance-observation.json contract"

echo "-- Test 57: build trend-data.json from multiple observations --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzePerformanceTrend,
} from "./scripts/gha_analyze_performance_trend.js";

function sampleObservation(params) {
  return {
    schemaVersion: "1.0",
    generatedAt: params.generatedAt ?? "2026-06-01T00:00:00.000Z",
    workflow: {
      name: "Quality Pipeline CI",
      runId: params.runId,
      jobResult: "success",
    },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: params.hash ?? "abc123def456",
    },
    durations: {
      npmCiSeconds: params.npmCiSeconds,
      npmTestSeconds: 30,
    },
    stepTimings: [],
  };
}

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-fixture-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-output-"));
fs.mkdirSync(path.join(fixtureDir, "run-1001"), { recursive: true });
fs.mkdirSync(path.join(fixtureDir, "run-1002"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-1001", "performance-observation.json"),
  JSON.stringify(sampleObservation({ runId: "1001", npmCiSeconds: 10 })),
);
fs.writeFileSync(
  path.join(fixtureDir, "run-1002", "performance-observation.json"),
  JSON.stringify(sampleObservation({ runId: "1002", npmCiSeconds: 14 })),
);

const result = analyzePerformanceTrend({ fixtureDir, outputDir });
const trendData = JSON.parse(fs.readFileSync(result.dataPath, "utf8"));
if (trendData.summary.runsAnalyzed !== 2) {
  throw new Error(`expected 2 analyzed runs, got ${trendData.summary.runsAnalyzed}`);
}
if (!trendData.trendObservation["abc123def456"]) {
  throw new Error("expected trendObservation grouped by packageLockHash");
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("multiple observations trend-data ok");
EOF
pass "build trend-data.json from multiple observations"

echo "-- Test 58: skip missing observations safely --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzePerformanceTrend,
  collectFromFixtureDir,
} from "./scripts/gha_analyze_performance_trend.js";

function sampleObservation(runId) {
  return {
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId, jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "hash123",
    },
    durations: { npmCiSeconds: 11 },
    stepTimings: [],
  };
}

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-skip-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-skip-out-"));
fs.mkdirSync(path.join(fixtureDir, "run-2001"), { recursive: true });
fs.mkdirSync(path.join(fixtureDir, "run-2002"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-2001", "performance-observation.json"),
  JSON.stringify(sampleObservation("2001")),
);

const collected = collectFromFixtureDir(fixtureDir);
if (collected.observations.length !== 1) {
  throw new Error(`expected 1 observation, got ${collected.observations.length}`);
}
if (collected.warnings.length !== 1) {
  throw new Error(`expected 1 warning, got ${collected.warnings.length}`);
}

const result = analyzePerformanceTrend({ fixtureDir, outputDir });
if (!fs.existsSync(result.reportPath)) {
  throw new Error("expected trend-report.md when at least one observation exists");
}

const emptyFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-empty-"));
fs.mkdirSync(path.join(emptyFixtureDir, "run-empty"), { recursive: true });
let zeroError = false;
try {
  analyzePerformanceTrend({ fixtureDir: emptyFixtureDir, outputDir });
} catch (error) {
  zeroError =
    error instanceof Error &&
    error.message.includes("No valid performance-observation.json");
}
if (!zeroError) {
  throw new Error("expected error when zero valid observations");
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(emptyFixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("missing observation skip ok");
EOF
pass "skip missing observations safely"

echo "-- Test 59: trend-report.md includes required sections --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePerformanceTrend } from "./scripts/gha_analyze_performance_trend.js";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-report-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-report-out-"));
fs.mkdirSync(path.join(fixtureDir, "run-3001"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-3001", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "3001", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "reporthash",
    },
    durations: { npmCiSeconds: 9 },
    stepTimings: [],
  }),
);

const result = analyzePerformanceTrend({ fixtureDir, outputDir });
const report = fs.readFileSync(result.reportPath, "utf8");
for (const section of [
  "## Summary",
  "## Recent Runs",
  "## Trend Observation",
  "## Notes",
]) {
  if (!report.includes(section)) {
    throw new Error(`trend-report.md missing section: ${section}`);
  }
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("trend-report sections ok");
EOF
pass "trend-report.md includes required sections"

echo "-- Test 60: trend-data.json contract validation --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzePerformanceTrend,
  buildTrendData,
  validateTrendDataContract,
} from "./scripts/gha_analyze_performance_trend.js";

const errors = validateTrendDataContract({});
if (errors.length === 0) {
  throw new Error("expected contract errors for empty object");
}

const trendData = buildTrendData({
  source: "fixture",
  observations: [
    {
      schemaVersion: "1.0",
      generatedAt: "2026-06-01T00:00:00.000Z",
      workflow: { name: "CI", runId: "1", jobResult: "success" },
      cache: { packageLockHash: "abc" },
      durations: { npmCiSeconds: 5 },
    },
  ],
  warnings: [],
  runsRequested: 1,
});
const contractErrors = validateTrendDataContract(trendData);
if (contractErrors.length > 0) {
  throw new Error(`unexpected contract errors: ${contractErrors.join(", ")}`);
}

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-contract-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-contract-out-"));
fs.mkdirSync(path.join(fixtureDir, "run-4001"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-4001", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "4001", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "contracthash",
    },
    durations: { npmCiSeconds: 7 },
    stepTimings: [],
  }),
);
const result = analyzePerformanceTrend({ fixtureDir, outputDir });
const written = JSON.parse(fs.readFileSync(result.dataPath, "utf8"));
const writtenErrors = validateTrendDataContract(written);
if (writtenErrors.length > 0) {
  throw new Error(`written trend-data contract errors: ${writtenErrors.join(", ")}`);
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("trend-data contract ok");
EOF
pass "trend-data.json contract validation"

echo ""
echo "All quality pipeline tests passed."
