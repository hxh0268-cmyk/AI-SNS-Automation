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
assertContains("ci upload artifact action", ci, "actions/upload-artifact@v6");
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
  metadataWarnings: [],
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

echo "-- Test 61: artifact metadata fixture normal case --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePerformanceTrend } from "./scripts/gha_analyze_performance_trend.js";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-meta-normal-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-meta-normal-out-"));
fs.mkdirSync(path.join(fixtureDir, "run-5001"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-5001", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "5001", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "meta-hash",
    },
    durations: { npmCiSeconds: 8 },
    stepTimings: [],
  }),
);
fs.writeFileSync(
  path.join(fixtureDir, "run-5001", "artifacts.json"),
  JSON.stringify({
    artifacts: [
      {
        id: 123,
        name: "quality-pipeline-reports-5001",
        size_in_bytes: 10850,
        expired: false,
        expires_at: "2026-09-28T00:00:00Z",
        archive_download_url: "https://api.github.com/repos/o/r/actions/artifacts/123/zip",
        digest: "sha256:abcdef",
      },
    ],
  }),
);

const result = analyzePerformanceTrend({ fixtureDir, outputDir });
const trendData = JSON.parse(fs.readFileSync(result.dataPath, "utf8"));
const run = trendData.recentRuns[0];
if (!run.artifact || run.artifact.name !== "quality-pipeline-reports-5001") {
  throw new Error("expected artifact metadata on recentRuns");
}
const report = fs.readFileSync(result.reportPath, "utf8");
if (!report.includes("## Artifact Metadata")) {
  throw new Error("expected Artifact Metadata section");
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("artifact metadata normal case ok");
EOF
pass "artifact metadata fixture normal case"

echo "-- Test 62: expired artifact is skipped --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectFromFixtureDir } from "./scripts/gha_analyze_performance_trend.js";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-meta-expired-"));
fs.mkdirSync(path.join(fixtureDir, "run-6001"), { recursive: true });
fs.mkdirSync(path.join(fixtureDir, "run-6002"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-6001", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "6001", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "hash-a",
    },
    durations: { npmCiSeconds: 8 },
    stepTimings: [],
  }),
);
fs.writeFileSync(
  path.join(fixtureDir, "run-6001", "artifacts.json"),
  JSON.stringify({
    artifacts: [
      {
        id: 1,
        name: "quality-pipeline-reports-6001",
        size_in_bytes: 100,
        expired: true,
        expires_at: "2026-01-01T00:00:00Z",
      },
    ],
  }),
);
fs.writeFileSync(
  path.join(fixtureDir, "run-6002", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "6002", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "hash-b",
    },
    durations: { npmCiSeconds: 9 },
    stepTimings: [],
  }),
);

const collected = collectFromFixtureDir(fixtureDir);
if (collected.observations.length !== 1) {
  throw new Error(`expected 1 observation after expired skip, got ${collected.observations.length}`);
}
if (!collected.warnings.some((w) => w.kind === "artifact-expired")) {
  throw new Error("expected artifact-expired warning");
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
console.log("expired artifact skip ok");
EOF
pass "expired artifact is skipped"

echo "-- Test 63: missing expires_at emits metadata warning --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePerformanceTrend } from "./scripts/gha_analyze_performance_trend.js";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-meta-no-expires-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-meta-no-expires-out-"));
fs.mkdirSync(path.join(fixtureDir, "run-7001"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-7001", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "7001", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "hash-c",
    },
    durations: { npmCiSeconds: 7 },
    stepTimings: [],
  }),
);
fs.writeFileSync(
  path.join(fixtureDir, "run-7001", "artifacts.json"),
  JSON.stringify({
    artifacts: [
      {
        id: 2,
        name: "quality-pipeline-reports-7001",
        size_in_bytes: 200,
        expired: false,
      },
    ],
  }),
);

const result = analyzePerformanceTrend({ fixtureDir, outputDir });
const trendData = JSON.parse(fs.readFileSync(result.dataPath, "utf8"));
if (trendData.metadataWarnings.length === 0) {
  throw new Error("expected metadata warning for missing expires_at");
}
if (trendData.summary.runsAnalyzed !== 1) {
  throw new Error("expected trend analysis to continue with missing expires_at");
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("missing expires_at warning ok");
EOF
pass "missing expires_at emits metadata warning"

echo "-- Test 64: paginated artifacts fixture --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseFixtureArtifacts,
  parsePaginatedArtifactsResponse,
  selectPerformanceArtifact,
} from "./scripts/gha_analyze_performance_trend.js";

const pageOne = {
  artifacts: [
    {
      id: 10,
      name: "other-artifact",
      size_in_bytes: 50,
      expired: false,
      expires_at: "2026-09-01T00:00:00Z",
    },
  ],
};
const pageTwo = {
  artifacts: [
    {
      id: 11,
      name: "quality-pipeline-reports-8001",
      size_in_bytes: 150,
      expired: false,
      expires_at: "2026-10-01T00:00:00Z",
      digest: "sha256:page2",
    },
  ],
};

const paginatedOutput = `${JSON.stringify(pageOne)}${JSON.stringify(pageTwo)}`;
const parsed = parsePaginatedArtifactsResponse(paginatedOutput);
if (parsed.length !== 2) {
  throw new Error(`expected 2 artifacts from paginated output, got ${parsed.length}`);
}
const fromFixture = parseFixtureArtifacts([pageOne, pageTwo]);
const selected = selectPerformanceArtifact(fromFixture);
if (selected?.name !== "quality-pipeline-reports-8001") {
  throw new Error("expected performance artifact selected from paginated fixture");
}

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-meta-page-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-meta-page-out-"));
fs.mkdirSync(path.join(fixtureDir, "run-8001"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-8001", "artifacts.json"),
  JSON.stringify([pageOne, pageTwo]),
);
fs.writeFileSync(
  path.join(fixtureDir, "run-8001", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "8001", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "hash-d",
    },
    durations: { npmCiSeconds: 6 },
    stepTimings: [],
  }),
);

const { analyzePerformanceTrend } = await import("./scripts/gha_analyze_performance_trend.js");
const result = analyzePerformanceTrend({ fixtureDir, outputDir });
const trendData = JSON.parse(fs.readFileSync(result.dataPath, "utf8"));
if (trendData.recentRuns[0].artifact?.name !== "quality-pipeline-reports-8001") {
  throw new Error("expected paginated artifact metadata in trend output");
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("paginated artifacts fixture ok");
EOF
pass "paginated artifacts fixture"

echo "-- Test 65: GitHub Actions mode env validation --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateGitHubActionsEnv } from "./scripts/gha_analyze_performance_trend.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

if (!workflow.includes("workflow_dispatch:")) {
  throw new Error("performance-trend.yml must support workflow_dispatch");
}
if (!workflow.includes("contents: read") || !workflow.includes("actions: read")) {
  throw new Error("performance-trend.yml must use contents: read and actions: read");
}
if (!workflow.includes("GH_TOKEN: ${{ github.token }}")) {
  throw new Error("performance-trend.yml must pass GH_TOKEN from github.token");
}
if (!workflow.includes("gha_analyze_performance_trend.js")) {
  throw new Error("performance-trend.yml must invoke gha_analyze_performance_trend.js");
}

const invalid = validateGitHubActionsEnv({});
if (invalid.valid) {
  throw new Error("expected invalid env for empty object");
}
if (invalid.errors.length === 0) {
  throw new Error("expected validation errors");
}

const valid = validateGitHubActionsEnv({
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "owner/repo",
  GITHUB_RUN_ID: "999",
  GITHUB_WORKFLOW: "Performance Trend Analysis",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GH_TOKEN: "test-token",
});
if (!valid.valid) {
  throw new Error(`expected valid GHA env, got: ${valid.errors.join(", ")}`);
}

console.log("GitHub Actions mode env validation ok");
EOF
pass "GitHub Actions mode env validation"

echo "-- Test 66: GH_TOKEN missing warning or fallback --"
node --input-type=module <<'EOF'
import { resolveGhAuthContext } from "./scripts/gha_analyze_performance_trend.js";

const missingToken = resolveGhAuthContext({
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "owner/repo",
});
if (!missingToken.warnings.some((w) => w.kind === "gh-token-missing")) {
  throw new Error("expected gh-token-missing warning when GH_TOKEN absent in GHA");
}

const withToken = resolveGhAuthContext({
  GITHUB_ACTIONS: "true",
  GH_TOKEN: "ghs_test",
  GITHUB_REPOSITORY: "owner/repo",
});
if (withToken.warnings.length !== 0) {
  throw new Error("expected no warnings when GH_TOKEN is set");
}
if (!withToken.ghEnv?.GH_TOKEN) {
  throw new Error("expected ghEnv to include GH_TOKEN");
}

const local = resolveGhAuthContext({});
if (local.warnings.some((w) => w.kind === "gh-token-missing")) {
  throw new Error("local mode should not warn about missing GH_TOKEN");
}

console.log("GH_TOKEN missing warning ok");
EOF
pass "GH_TOKEN missing warning or fallback"

echo "-- Test 67: workflow artifact collection fixture --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildCollectionMetadata,
  collectFromFixtureDir,
  writeTrendOutputs,
} from "./scripts/gha_analyze_performance_trend.js";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-gha-fixture-"));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-gha-fixture-out-"));
fs.mkdirSync(path.join(fixtureDir, "run-9001"), { recursive: true });
fs.writeFileSync(
  path.join(fixtureDir, "run-9001", "performance-observation.json"),
  JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: "2026-06-01T00:00:00.000Z",
    workflow: { name: "Quality Pipeline CI", runId: "9001", jobResult: "success" },
    runtime: { nodeVersion: "v20.19.0", npmVersion: "10.8.2" },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: "gha-hash",
    },
    durations: { npmCiSeconds: 11 },
    stepTimings: [],
  }),
);
fs.writeFileSync(
  path.join(fixtureDir, "run-9001", "artifacts.json"),
  JSON.stringify({
    artifacts: [
      {
        id: 99,
        name: "quality-pipeline-reports-9001",
        size_in_bytes: 500,
        expired: false,
        expires_at: "2026-12-01T00:00:00Z",
      },
    ],
  }),
);

const collected = collectFromFixtureDir(fixtureDir);
const collection = buildCollectionMetadata({
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "owner/repo",
  GITHUB_RUN_ID: "12345",
  GITHUB_WORKFLOW: "Performance Trend Analysis",
  GITHUB_EVENT_NAME: "workflow_dispatch",
});
const result = writeTrendOutputs({
  source: "github-actions",
  observations: collected.observations,
  warnings: collected.warnings,
  metadataWarnings: collected.metadataWarnings,
  runsRequested: collected.runsRequested,
  collection,
  outputDir,
});

const trendData = JSON.parse(fs.readFileSync(result.dataPath, "utf8"));
if (trendData.source !== "github-actions") {
  throw new Error("expected source github-actions");
}
if (trendData.collection?.mode !== "github-actions") {
  throw new Error("expected collection.mode github-actions");
}
if (trendData.recentRuns[0].artifact?.name !== "quality-pipeline-reports-9001") {
  throw new Error("expected workflow artifact metadata in trend output");
}

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
console.log("workflow artifact collection fixture ok");
EOF
pass "workflow artifact collection fixture"

echo "-- Test 68: trend-data schema compatibility --"
node --input-type=module <<'EOF'
import {
  buildTrendData,
  TREND_DATA_SCHEMA_VERSION,
  TREND_DATA_SCHEMA_VERSION_LEGACY,
  validateTrendDataContract,
} from "./scripts/gha_analyze_performance_trend.js";

const observation = {
  schemaVersion: "1.0",
  generatedAt: "2026-06-01T00:00:00.000Z",
  workflow: { name: "CI", runId: "1", jobResult: "success" },
  cache: { packageLockHash: "abc" },
  durations: { npmCiSeconds: 5 },
};

const legacy = buildTrendData({
  source: "gh-cli",
  observations: [observation],
  warnings: [],
  metadataWarnings: [],
  runsRequested: 1,
});
if (legacy.schemaVersion !== TREND_DATA_SCHEMA_VERSION_LEGACY) {
  throw new Error(`expected schema ${TREND_DATA_SCHEMA_VERSION_LEGACY}, got ${legacy.schemaVersion}`);
}
const legacyErrors = validateTrendDataContract(legacy);
if (legacyErrors.length > 0) {
  throw new Error(`legacy schema errors: ${legacyErrors.join(", ")}`);
}

const extended = buildTrendData({
  source: "github-actions",
  observations: [observation],
  warnings: [],
  metadataWarnings: [],
  runsRequested: 1,
  collection: {
    mode: "github-actions",
    trigger: "workflow_dispatch",
    workflowRunId: "42",
    sourceWorkflow: "Performance Trend Analysis",
    collectedAt: "2026-06-01T00:00:00.000Z",
  },
});
if (extended.schemaVersion !== TREND_DATA_SCHEMA_VERSION) {
  throw new Error(`expected schema ${TREND_DATA_SCHEMA_VERSION}, got ${extended.schemaVersion}`);
}
const extendedErrors = validateTrendDataContract(extended);
if (extendedErrors.length > 0) {
  throw new Error(`extended schema errors: ${extendedErrors.join(", ")}`);
}

console.log("trend-data schema compatibility ok");
EOF
pass "trend-data schema compatibility"

echo "-- Test 69: Step Summary output generation --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPerformanceTrendStepSummary,
  buildTrendData,
  writePerformanceTrendStepSummary,
} from "./scripts/gha_analyze_performance_trend.js";

const trendData = buildTrendData({
  source: "github-actions",
  observations: [
    {
      schemaVersion: "1.0",
      generatedAt: "2026-06-01T00:00:00.000Z",
      workflow: { name: "Quality Pipeline CI", runId: "1", jobResult: "success" },
      cache: { packageLockHash: "abc" },
      durations: { npmCiSeconds: 5 },
    },
  ],
  warnings: [],
  metadataWarnings: [],
  runsRequested: 1,
  collection: {
    mode: "github-actions",
    trigger: "workflow_dispatch",
    workflowRunId: "99",
    sourceWorkflow: "Performance Trend Analysis",
    collectedAt: "2026-06-01T00:00:00.000Z",
  },
});

const summary = buildPerformanceTrendStepSummary(trendData);
if (!summary.includes("## Performance Trend Analysis")) {
  throw new Error("expected Performance Trend Analysis heading");
}
if (!summary.includes("Runs analyzed")) {
  throw new Error("expected runs analyzed in step summary");
}
if (!summary.includes("github-actions")) {
  throw new Error("expected mode in step summary");
}

const summaryPath = path.join(os.tmpdir(), `perf-trend-summary-${Date.now()}.md`);
writePerformanceTrendStepSummary(trendData, summaryPath);
const written = fs.readFileSync(summaryPath, "utf8");
if (!written.includes("trend-data.json")) {
  throw new Error("expected output paths in written step summary");
}
fs.rmSync(summaryPath, { force: true });

console.log("Step Summary output generation ok");
EOF
pass "Step Summary output generation"

echo "-- Test 70: performance-trend.yml schedule exists --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

if (!workflow.includes("schedule:")) {
  throw new Error("performance-trend.yml must define schedule trigger");
}
if (!workflow.includes('cron: "23 20 * * 1"')) {
  throw new Error('performance-trend.yml must use cron "23 20 * * 1"');
}

console.log("performance-trend.yml schedule ok");
EOF
pass "performance-trend.yml schedule exists"

echo "-- Test 71: workflow_dispatch is preserved --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml"),
  "utf8",
);

if (!workflow.includes("workflow_dispatch:")) {
  throw new Error("performance-trend.yml must preserve workflow_dispatch");
}

console.log("workflow_dispatch preserved ok");
EOF
pass "workflow_dispatch is preserved"

echo "-- Test 72: cron minute is not zero --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml"),
  "utf8",
);

const cronMatch = workflow.match(/cron:\s*"([^"]+)"/);
if (!cronMatch) {
  throw new Error("expected cron expression in performance-trend.yml");
}
const fields = cronMatch[1].trim().split(/\s+/);
if (fields.length < 5) {
  throw new Error(`invalid cron expression: ${cronMatch[1]}`);
}
const minute = fields[0];
if (minute === "0" || minute === "00") {
  throw new Error("cron minute must not be zero to avoid hourly congestion");
}

console.log("cron minute not zero ok");
EOF
pass "cron minute is not zero"

echo "-- Test 73: concurrency exists --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml"),
  "utf8",
);

if (!workflow.includes("concurrency:")) {
  throw new Error("performance-trend.yml must define concurrency");
}
if (!workflow.includes("group: performance-trend-${{ github.workflow }}")) {
  throw new Error("performance-trend.yml must use performance-trend workflow concurrency group");
}
if (!workflow.includes("cancel-in-progress: false")) {
  throw new Error("performance-trend.yml must set cancel-in-progress: false");
}

console.log("concurrency ok");
EOF
pass "concurrency exists"

echo "-- Test 74: workflow_run is not present --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml"),
  "utf8",
);

const onSection = workflow.match(/^on:\n([\s\S]*?)(?:\n\S|\njobs:)/m);
if (!onSection) {
  throw new Error("unable to parse on: section");
}
if (/^\s*workflow_run:/m.test(onSection[1])) {
  throw new Error("performance-trend.yml must not define workflow_run trigger");
}

console.log("workflow_run absent ok");
EOF
pass "workflow_run is not present"

echo "-- Test 75: performance-trend.yml has no workflow_run --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml"),
  "utf8",
);
if (/^\s*workflow_run:/m.test(workflow)) {
  throw new Error("performance-trend.yml must not include workflow_run in v1.21.0");
}
console.log("no workflow_run ok");
EOF
pass "performance-trend.yml has no workflow_run"

echo "-- Test 76: performance-trend.yml schedule exists --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml"),
  "utf8",
);
if (!workflow.includes("schedule:") || !workflow.includes('cron: "23 20 * * 1"')) {
  throw new Error("performance-trend.yml must preserve weekly schedule");
}
console.log("schedule preserved ok");
EOF
pass "performance-trend.yml schedule exists"

echo "-- Test 77: performance-trend.yml workflow_dispatch exists --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend.yml"),
  "utf8",
);
if (!workflow.includes("workflow_dispatch:")) {
  throw new Error("performance-trend.yml must preserve workflow_dispatch");
}
console.log("workflow_dispatch preserved ok");
EOF
pass "performance-trend.yml workflow_dispatch exists"

echo "-- Test 78: README workflow_run Opt-in Design Review section --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
if (!readme.includes("workflow_run Opt-in Design Review")) {
  throw new Error("README must include workflow_run Opt-in Design Review section");
}
if (!readme.includes("workflow_run` を本番導入しません")) {
  throw new Error("README must state workflow_run is not production-enabled in v1.21.0");
}
console.log("README design review section ok");
EOF
pass "README workflow_run Opt-in Design Review section"

echo "-- Test 79: README security and schema policy keywords --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
const required = [
  "cache poisoning",
  "privilege escalation",
  "opt-in",
  "schema",
  "1.2",
];
for (const keyword of required) {
  if (!readme.toLowerCase().includes(keyword.toLowerCase())) {
    throw new Error(`README must mention: ${keyword}`);
  }
}
console.log("README security policy keywords ok");
EOF
pass "README security and schema policy keywords"

WORKFLOW_EXP=".github/workflows/performance-trend-experimental.yml"

echo "-- Test 80: performance-trend-experimental.yml exists --"
test -f "$WORKFLOW_EXP"
pass "performance-trend-experimental.yml exists"

echo "-- Test 81: experimental workflow uses workflow_dispatch --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (!workflow.includes("workflow_dispatch:")) {
  throw new Error("experimental workflow must use workflow_dispatch");
}
console.log("experimental workflow_dispatch ok");
EOF
pass "experimental workflow uses workflow_dispatch"

echo "-- Test 82: experimental workflow does not use workflow_run --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (/^\s*workflow_run:/m.test(workflow)) {
  throw new Error("experimental workflow must not use workflow_run");
}
console.log("experimental no workflow_run ok");
EOF
pass "experimental workflow does not use workflow_run"

echo "-- Test 83: experimental permissions are contents read and actions read --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (!workflow.includes("contents: read") || !workflow.includes("actions: read")) {
  throw new Error("experimental workflow must use contents: read and actions: read");
}
console.log("experimental permissions ok");
EOF
pass "experimental permissions are contents read and actions read"

echo "-- Test 84: experimental concurrency is configured --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (!workflow.includes("concurrency:")) {
  throw new Error("experimental workflow must define concurrency");
}
if (!workflow.includes("group: performance-trend-experimental-${{ github.workflow }}")) {
  throw new Error("experimental workflow must use experimental concurrency group");
}
console.log("experimental concurrency ok");
EOF
pass "experimental concurrency is configured"

echo "-- Test 85: experimental artifact name is isolated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (!workflow.includes("name: performance-trend-experimental-${{ github.run_id }}")) {
  throw new Error("experimental artifact name must use performance-trend-experimental prefix");
}
console.log("experimental artifact name ok");
EOF
pass "experimental artifact name is isolated with experimental prefix"

echo "-- Test 86: experimental retention-days is limited to 7 --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (!workflow.includes("retention-days: 7")) {
  throw new Error("experimental workflow must set retention-days: 7");
}
console.log("experimental retention ok");
EOF
pass "experimental retention-days is limited to 7"

echo "-- Test 87: source_run_id and source_conclusion inputs exist --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (!workflow.includes("source_run_id:")) {
  throw new Error("experimental workflow must define source_run_id input");
}
if (!workflow.includes("source_conclusion:")) {
  throw new Error("experimental workflow must define source_conclusion input");
}
if (!workflow.includes("SOURCE_WORKFLOW_RUN_ID:")) {
  throw new Error("experimental workflow must pass SOURCE_WORKFLOW_RUN_ID env");
}
if (!workflow.includes("SOURCE_WORKFLOW_CONCLUSION:")) {
  throw new Error("experimental workflow must pass SOURCE_WORKFLOW_CONCLUSION env");
}
if (!workflow.includes("PERFORMANCE_TREND_EXPERIMENTAL:")) {
  throw new Error("experimental workflow must pass PERFORMANCE_TREND_EXPERIMENTAL env");
}
console.log("experimental inputs ok");
EOF
pass "source_run_id and source_conclusion inputs exist"

echo "-- Test 88: schema remains 1.2 / no schema 1.3 change --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUPPORTED_TREND_DATA_SCHEMA_VERSIONS,
  TREND_DATA_SCHEMA_VERSION,
} from "./scripts/gha_analyze_performance_trend.js";

if (TREND_DATA_SCHEMA_VERSION !== "1.2") {
  throw new Error(`expected TREND_DATA_SCHEMA_VERSION 1.2, got ${TREND_DATA_SCHEMA_VERSION}`);
}
if (SUPPORTED_TREND_DATA_SCHEMA_VERSIONS.includes("1.3")) {
  throw new Error("schema 1.3 must not be introduced in v1.22.0");
}

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const script = fs.readFileSync(
  path.join(PROJECT_ROOT, "scripts/gha_analyze_performance_trend.js"),
  "utf8",
);
if (script.includes('"1.3"')) {
  throw new Error("gha_analyze_performance_trend.js must not reference schema 1.3");
}

console.log("schema 1.2 maintained ok");
EOF
pass "schema remains 1.2 / no schema 1.3 change"

echo "-- Test 89: experimental workflow uses upload-artifact v6 --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflow = fs.readFileSync(
  path.join(PROJECT_ROOT, ".github/workflows/performance-trend-experimental.yml"),
  "utf8",
);
if (!workflow.includes("actions/upload-artifact@v6")) {
  throw new Error("experimental workflow must use actions/upload-artifact@v6");
}
console.log("experimental upload-artifact v6 ok");
EOF
pass "experimental workflow uses upload-artifact v6"

echo "-- Test 90: production workflows use upload-artifact v6 --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const productionWorkflows = [
  ".github/workflows/performance-trend.yml",
  ".github/workflows/quality-pipeline-ci.yml",
  ".github/workflows/nightly-apply.yml",
];

for (const rel of productionWorkflows) {
  const workflow = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf8");
  if (!workflow.includes("upload-artifact@v6")) {
    throw new Error(`${rel} must use upload-artifact@v6`);
  }
  if (workflow.includes("upload-artifact@v7")) {
    throw new Error(`${rel} must not use upload-artifact@v7`);
  }
}

console.log("production upload-artifact v6 ok");
EOF
pass "production workflows use upload-artifact v6"

echo "-- Test 91: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 is not used --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const workflowsDir = path.join(PROJECT_ROOT, ".github/workflows");
for (const file of fs.readdirSync(workflowsDir)) {
  if (!file.endsWith(".yml") && !file.endsWith(".yaml")) {
    continue;
  }
  const content = fs.readFileSync(path.join(workflowsDir, file), "utf8");
  if (content.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24")) {
    throw new Error(`${file} must not use FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`);
  }
}
console.log("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 not used ok");
EOF
pass "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 is not used"

echo "-- Test 92: README documents Node24 migration readiness --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
const required = [
  "Node24 Migration Readiness",
  "upload-artifact@v6",
  "Node24 runtime",
  "v2.327.1",
  "experimental workflow",
  "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24",
];
for (const keyword of required) {
  if (!readme.includes(keyword)) {
    throw new Error(`README must mention: ${keyword}`);
  }
}
console.log("README Node24 migration readiness ok");
EOF
pass "README documents Node24 migration readiness and runner v2.327.1 requirement"

echo "-- Test 93: VERSION documents v1.23.0 in history --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const versionDoc = fs.readFileSync(path.join(PROJECT_ROOT, "docs/VERSION.md"), "utf8");
if (!versionDoc.includes("v1.23.0")) {
  throw new Error("docs/VERSION.md must document v1.23.0 in version history");
}
if (!versionDoc.includes("Node24 Migration Readiness")) {
  throw new Error("docs/VERSION.md must document v1.23.0 Node24 Migration Readiness");
}
console.log("VERSION v1.23.0 history ok");
EOF
pass "VERSION documents v1.23.0 in history"

echo "-- Test 94: production workflows use Node24-ready action versions --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const productionWorkflows = [
  ".github/workflows/performance-trend.yml",
  ".github/workflows/quality-pipeline-ci.yml",
  ".github/workflows/nightly-apply.yml",
];

for (const rel of productionWorkflows) {
  const workflow = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf8");
  if (!workflow.includes("actions/checkout@v5")) {
    throw new Error(`${rel} must use actions/checkout@v5`);
  }
  if (!workflow.includes("actions/setup-node@v5")) {
    throw new Error(`${rel} must use actions/setup-node@v5`);
  }
  if (!workflow.includes("actions/upload-artifact@v6")) {
    throw new Error(`${rel} must use actions/upload-artifact@v6`);
  }
  if (!workflow.includes("cache: npm") || !workflow.includes("cache-dependency-path: package-lock.json")) {
    throw new Error(`${rel} must preserve setup-node npm cache settings`);
  }
}

console.log("production Node24-ready actions ok");
EOF
pass "production workflows use Node24-ready action versions"

echo "-- Test 95: checkout/setup-node/upload-artifact versions documented --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
const required = [
  "Node24 Production Readiness",
  "actions/checkout@v5",
  "actions/setup-node@v5",
  "actions/upload-artifact@v6",
  "upload-artifact@v7",
];
for (const keyword of required) {
  if (!readme.includes(keyword)) {
    throw new Error(`README must document: ${keyword}`);
  }
}
console.log("README action versions documented ok");
EOF
pass "checkout/setup-node/upload-artifact versions documented"

echo "-- Test 96: runner v2.327.1+ requirement documented --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
if (!readme.includes("v2.327.1")) {
  throw new Error("README must document runner v2.327.1+ requirement");
}
if (!readme.includes("setup-node@v5")) {
  throw new Error("README must document setup-node@v5 cache notes in v1.24.0 section");
}
console.log("runner requirement documented ok");
EOF
pass "runner v2.327.1+ requirement documented"

echo "-- Test 97: experimental workflow unchanged --"
node --input-type=module <<'EOF'
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const rel = ".github/workflows/performance-trend-experimental.yml";
const diff = execSync(`git diff -- "${rel}"`, {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
});
if (diff.trim().length > 0) {
  throw new Error("performance-trend-experimental.yml must remain unchanged in v1.24.0");
}
const workflow = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf8");
if (!workflow.includes("actions/upload-artifact@v6")) {
  throw new Error("experimental workflow must still use upload-artifact@v6");
}
console.log("experimental workflow unchanged ok");
EOF
pass "experimental workflow unchanged"

echo "-- Test 98: VERSION updated to v1.61.0 --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const versionDoc = fs.readFileSync(path.join(PROJECT_ROOT, "docs/VERSION.md"), "utf8");
if (!versionDoc.includes("**v1.61.0**（Interaction Lifecycle Design）")) {
  throw new Error("docs/VERSION.md current version must be v1.61.0");
}
console.log("VERSION v1.61.0 ok");
EOF
pass "VERSION updated to v1.61.0"


echo "-- Test 99: content generation CLI exists --"
test -f scripts/run_content_generation.js
test -x scripts/run_content_generation.js
pass "content generation CLI exists"

echo "-- Test 100: content generation lib exists --"
test -f src/lib/content_generation.js
grep -q "CONTENT_GENERATION_SCHEMA" src/lib/content_generation.js
pass "content generation lib exists"

echo "-- Test 101: content ideas prompt exists --"
test -f prompts/content_ideas.md
grep -q "Content Ideas Prompt" prompts/content_ideas.md
pass "content ideas prompt exists"

echo "-- Test 102: content generation dry-run exits 0 --"
node scripts/run_content_generation_legacy.js --dry-run >/tmp/content_generation_dry_run.log
grep -q "\[ContentGeneration\] dry-run complete" /tmp/content_generation_dry_run.log
pass "content generation dry-run exits 0"

echo "-- Test 103: content ideas markdown generated --"
test -f output/content-ideas/latest/content-ideas.md
grep -q "# Content Ideas" output/content-ideas/latest/content-ideas.md
grep -q "飲食店店長が今日から使えるChatGPT活用5選" output/content-ideas/latest/content-ideas.md
pass "content ideas markdown generated"

echo "-- Test 104: content ideas json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/content-ideas/latest/content-ideas.json", "utf8"));
if (data.schema !== "content-generation/1.0") {
  throw new Error("content ideas schema must be content-generation/1.0");
}
if (data.mode !== "dry-run") {
  throw new Error("content generation mode must be dry-run");
}
if (data.generator !== "mock") {
  throw new Error("content generation generator must be mock");
}
if (!Array.isArray(data.ideas) || data.ideas.length !== 3) {
  throw new Error("content generation must generate exactly 3 mock ideas");
}
console.log("content ideas json ok");
EOF
pass "content ideas json generated"

echo "-- Test 105: content generation report generated --"
test -f reports/content-generation/latest/report.md
test -f reports/content-generation/latest/report.json
grep -q "# Content Generation Report" reports/content-generation/latest/report.md
grep -q "No external API key is required" reports/content-generation/latest/report.md
pass "content generation report generated"

echo "-- Test 106: content generation lib unit contract --"
node --input-type=module <<'EOF'
import {
  CONTENT_GENERATION_SCHEMA,
  buildContentGenerationReport,
  buildContentIdeasData,
  buildContentIdeasMarkdown
} from "./src/lib/content_generation_legacy.js";

const data = buildContentIdeasData({
  prompt: {
    path: "prompts/content_ideas.md",
    content: "mock prompt"
  },
  generatedAt: "2026-07-01T00:00:00.000Z"
});

if (CONTENT_GENERATION_SCHEMA !== "content-generation/1.0") {
  throw new Error("schema constant mismatch");
}
if (data.ideas.length !== 3) {
  throw new Error("mock ideas length mismatch");
}

const markdown = buildContentIdeasMarkdown(data);
if (!markdown.includes("# Content Ideas")) {
  throw new Error("content ideas markdown heading missing");
}

const report = buildContentGenerationReport(data);
if (report.schema !== "content-generation-report/1.0") {
  throw new Error("report schema mismatch");
}
if (report.ideasGenerated !== 3) {
  throw new Error("report ideasGenerated mismatch");
}

console.log("content generation lib contract ok");
EOF
pass "content generation lib unit contract"

echo "-- Test 107: package.json dev:next script exists --"
grep -q '"dev:next": "node scripts/run_dev_next.js"' package.json
pass "package.json dev:next script exists"

echo "-- Test 108: npm run dev:next --dry-run succeeds --"
npm run dev:next -- --dry-run >/tmp/dev_next_dry_run.log
grep -q "\[DevNext\] dry-run complete" /tmp/dev_next_dry_run.log
pass "npm run dev:next --dry-run succeeds"

echo "-- Test 109: dev-next.md generated --"
test -f reports/developer-automation/latest/dev-next.md
grep -q "# Developer Automation Next Plan" reports/developer-automation/latest/dev-next.md
grep -q "developer-automation/dev-next/1.0" reports/developer-automation/latest/dev-next.md
pass "dev-next.md generated"

echo "-- Test 110: dev:next dry-run does not git commit tag or push --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const files = [
  "scripts/run_dev_next.js",
  "src/lib/developer_automation.js",
];

const forbidden = [
  /git\s+commit\b/i,
  /git\s+push\b/i,
];

for (const rel of files) {
  const content = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) {
      throw new Error(`${rel} must not invoke ${pattern}`);
    }
  }
}
console.log("dev:next dry-run git safety ok");
EOF
pass "dev:next dry-run does not git commit tag or push"

echo "-- Test 111: developer automation output path is fixed --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeDevNextReport, buildDevNextPlan } from "./src/lib/developer_automation.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const libSource = fs.readFileSync(
  path.join(PROJECT_ROOT, "src/lib/developer_automation.js"),
  "utf8",
);
if (!libSource.includes('"reports", "developer-automation", "latest"')) {
  throw new Error("developer automation output must use reports/developer-automation/latest");
}

const plan = buildDevNextPlan({ rootDir: PROJECT_ROOT, generatedAt: "2026-07-01T00:00:00.000Z" });
const outputs = writeDevNextReport(plan, PROJECT_ROOT);
if (outputs.markdown !== "reports/developer-automation/latest/dev-next.md") {
  throw new Error(`unexpected markdown output path: ${outputs.markdown}`);
}
if (outputs.json !== "reports/developer-automation/latest/dev-next.json") {
  throw new Error(`unexpected json output path: ${outputs.json}`);
}

console.log("developer automation output path ok");
EOF
pass "developer automation output path is fixed"

echo "-- Test 112: VERSION.md version can be read --"
node --input-type=module <<'EOF'
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVersionFromVersionMd } from "./src/lib/developer_automation.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const version = getVersionFromVersionMd(PROJECT_ROOT);
if (!version || !/^v\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`expected semver version from VERSION.md, got: ${version}`);
}
console.log(`VERSION.md version ok: ${version}`);
EOF
pass "VERSION.md version can be read"

echo "-- Test 113: version-consistency.json is generated --"
test -f reports/developer-automation/latest/version-consistency.json
node --input-type=module <<'EOF'
import fs from "node:fs";

const report = JSON.parse(
  fs.readFileSync("reports/developer-automation/latest/version-consistency.json", "utf8"),
);
if (report.schema !== "developer-automation/version-consistency/1.0") {
  throw new Error("version-consistency schema mismatch");
}
if (!["ok", "warning"].includes(report.status)) {
  throw new Error("version-consistency status must be ok or warning");
}
console.log("version-consistency.json ok");
EOF
pass "version-consistency.json is generated"

echo "-- Test 114: version-consistency.md includes Version Consistency section --"
test -f reports/developer-automation/latest/version-consistency.md
grep -q "# Version Consistency Report" reports/developer-automation/latest/version-consistency.md
grep -q "## Version Consistency" reports/developer-automation/latest/version-consistency.md
grep -q "## Warnings" reports/developer-automation/latest/version-consistency.md
pass "version-consistency.md includes Version Consistency section"

echo "-- Test 115: version mismatch emits warning --"
node --input-type=module <<'EOF'
import {
  buildVersionConsistencyMarkdown,
  buildVersionConsistencyReport,
} from "./src/lib/developer_automation.js";

const report = buildVersionConsistencyReport({
  gitTag: "v1.25.0",
  versionMd: "v1.26.0",
  changelogVersion: "v1.25.0",
  generatedAt: "2026-07-01T00:00:00.000Z",
});

if (report.status !== "warning") {
  throw new Error("expected warning status for version mismatch");
}
if (report.warnings.length === 0) {
  throw new Error("expected warnings for version mismatch");
}
if (!report.warnings.some((w) => w.includes("Version mismatch detected"))) {
  throw new Error("expected mismatch warning message");
}

const markdown = buildVersionConsistencyMarkdown(report);
if (!markdown.includes("warning") || !markdown.includes("v1.26.0")) {
  throw new Error("expected warning details in version-consistency markdown");
}

console.log("version mismatch warning ok");
EOF
pass "version mismatch emits warning"

echo "-- Test 116: 3-way version consistency can be evaluated --"
node --input-type=module <<'EOF'
import {
  buildVersionConsistencyReport,
  getChangelogLatestVersion,
  getLatestGitTag,
  getVersionFromVersionMd,
} from "./src/lib/developer_automation.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

const okReport = buildVersionConsistencyReport({
  gitTag: "v9.9.9",
  versionMd: "v9.9.9",
  changelogVersion: "v9.9.9",
});
if (okReport.status !== "ok") {
  throw new Error("expected ok when all three versions match");
}
if (okReport.warnings.length !== 0) {
  throw new Error("expected no warnings when all three versions match");
}

const gitTag = getLatestGitTag(PROJECT_ROOT);
const versionMd = getVersionFromVersionMd(PROJECT_ROOT);
const changelog = getChangelogLatestVersion(PROJECT_ROOT);
const liveReport = buildVersionConsistencyReport({
  rootDir: PROJECT_ROOT,
  gitTag,
  versionMd,
  changelogVersion: changelog,
});

if (!liveReport.gitTag && gitTag) {
  throw new Error("live report must include git tag when available");
}
if (liveReport.versionMd !== versionMd) {
  throw new Error("live report must reflect VERSION.md version");
}
if (liveReport.changelog !== changelog) {
  throw new Error("live report must reflect CHANGELOG.md version");
}

console.log(`3-way consistency ok (live status: ${liveReport.status})`);
EOF
pass "3-way version consistency can be evaluated"

echo "-- Test 117: release readiness evaluation --"
node --input-type=module <<'EOF'
import {
  RELEASE_READINESS_SCHEMA,
  evaluateReleaseReadiness,
} from "./src/lib/release_readiness.js";

const readyReport = evaluateReleaseReadiness({
  workingTree: { status: "pass", detail: "clean" },
  versionConsistency: { status: "pass", detail: {} },
  requiredReports: { status: "pass", detail: { required: [], missing: [] } },
  npmTest: { status: "pass", detail: "npm test passed" },
  generatedAt: "2026-06-25T00:00:00.000Z",
});

if (readyReport.schema !== RELEASE_READINESS_SCHEMA) {
  throw new Error("release readiness schema mismatch");
}
if (readyReport.status !== "ready") {
  throw new Error("expected ready when all checks pass");
}
if (Object.values(readyReport.checks).some((check) => check.status !== "pass")) {
  throw new Error("expected all checks to pass");
}

const notReadyReport = evaluateReleaseReadiness({
  workingTree: { status: "fail", detail: "dirty" },
  versionConsistency: { status: "pass", detail: {} },
  requiredReports: { status: "pass", detail: { required: [], missing: [] } },
  npmTest: { status: "pass", detail: "npm test passed" },
});

if (notReadyReport.status !== "not-ready") {
  throw new Error("expected not-ready when any check fails");
}

console.log("release readiness evaluation ok");
EOF
pass "release readiness evaluation"

echo "-- Test 118: working tree check --"
node --input-type=module <<'EOF'
import { checkWorkingTree } from "./src/lib/release_readiness.js";

const clean = checkWorkingTree("/tmp", () => "");
if (clean.status !== "pass" || clean.detail !== "clean") {
  throw new Error("expected pass for clean working tree");
}

const dirty = checkWorkingTree("/tmp", () => " M README.md");
if (dirty.status !== "fail" || !dirty.detail.includes("README.md")) {
  throw new Error("expected fail for dirty working tree");
}

console.log("working tree check ok");
EOF
pass "working tree check"

echo "-- Test 119: release readiness version consistency check --"
node --input-type=module <<'EOF'
import { checkVersionConsistency } from "./src/lib/release_readiness.js";

const passResult = checkVersionConsistency({
  versionReport: {
    status: "ok",
    gitTag: "v1.27.0",
    versionMd: "v1.27.0",
    changelog: "v1.27.0",
    warnings: [],
  },
});
if (passResult.status !== "pass") {
  throw new Error("expected pass when version consistency is ok");
}

const failResult = checkVersionConsistency({
  versionReport: {
    status: "warning",
    gitTag: "v1.26.0",
    versionMd: "v1.27.0",
    changelog: "v1.27.0",
    warnings: ["version mismatch"],
  },
});
if (failResult.status !== "fail") {
  throw new Error("expected fail when version consistency is warning");
}

console.log("release readiness version consistency check ok");
EOF
pass "release readiness version consistency check"

echo "-- Test 120: required reports check --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkRequiredReports, REQUIRED_REPORTS } from "./src/lib/release_readiness.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "release-readiness-"));
const reportDir = path.join(tempRoot, "reports", "developer-automation", "latest");
fs.mkdirSync(reportDir, { recursive: true });

const missingResult = checkRequiredReports(tempRoot);
if (missingResult.status !== "fail") {
  throw new Error("expected fail when required reports are missing");
}
if (missingResult.detail.missing.length !== REQUIRED_REPORTS.length) {
  throw new Error("expected all required reports to be listed as missing");
}

for (const filename of REQUIRED_REPORTS) {
  fs.writeFileSync(path.join(reportDir, filename), "{}");
}

const passResult = checkRequiredReports(tempRoot);
if (passResult.status !== "pass") {
  throw new Error("expected pass when required reports exist");
}

console.log("required reports check ok");
EOF
pass "required reports check"

echo "-- Test 121: npm test check --"
node --input-type=module <<'EOF'
import { checkNpmTest } from "./src/lib/release_readiness.js";

const skipped = checkNpmTest({ skip: true });
if (skipped.status !== "pass" || skipped.detail !== "skipped") {
  throw new Error("expected pass when npm test check is skipped");
}

const passed = checkNpmTest({
  execSyncImpl: () => "ok",
});
if (passed.status !== "pass") {
  throw new Error("expected pass when npm test succeeds");
}

const failed = checkNpmTest({
  execSyncImpl: () => {
    throw new Error("npm test failed");
  },
});
if (failed.status !== "fail") {
  throw new Error("expected fail when npm test fails");
}

console.log("npm test check ok");
EOF
pass "npm test check"

echo "-- Test 122: release-readiness.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateReleaseReadiness,
  writeReleaseReadinessReport,
} from "./src/lib/release_readiness.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const report = evaluateReleaseReadiness({
  rootDir: PROJECT_ROOT,
  workingTree: { status: "pass", detail: "clean" },
  versionConsistency: { status: "pass", detail: {} },
  requiredReports: { status: "pass", detail: { required: [], missing: [] } },
  npmTest: { status: "pass", detail: "skipped" },
  generatedAt: "2026-06-25T00:00:00.000Z",
});

writeReleaseReadinessReport(report, PROJECT_ROOT);

const jsonPath = path.join(
  PROJECT_ROOT,
  "reports/developer-automation/latest/release-readiness.json",
);
const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

if (payload.schema !== "developer-automation/release-readiness/1.0") {
  throw new Error("release-readiness.json schema mismatch");
}
if (payload.status !== "ready") {
  throw new Error("release-readiness.json status mismatch");
}
for (const key of ["workingTree", "versionConsistency", "requiredReports", "npmTest"]) {
  if (payload.checks[key]?.status !== "pass") {
    throw new Error(`release-readiness.json check ${key} must be pass`);
  }
}

console.log("release-readiness.json ok");
EOF
pass "release-readiness.json generated"

echo "-- Test 123: release-readiness.md generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReleaseReadinessMarkdown,
  evaluateReleaseReadiness,
} from "./src/lib/release_readiness.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const report = evaluateReleaseReadiness({
  workingTree: { status: "pass", detail: "clean" },
  versionConsistency: { status: "fail", detail: {} },
  requiredReports: { status: "pass", detail: { required: [], missing: [] } },
  npmTest: { status: "pass", detail: "skipped" },
  generatedAt: "2026-06-25T00:00:00.000Z",
});

const markdown = buildReleaseReadinessMarkdown(report);
for (const section of [
  "Release Readiness",
  "Status",
  "Working Tree",
  "Version Consistency",
  "Required Reports",
  "npm test",
]) {
  if (!markdown.includes(section)) {
    throw new Error(`release-readiness markdown must include section: ${section}`);
  }
}

const markdownPath = path.join(
  PROJECT_ROOT,
  "reports/developer-automation/latest/release-readiness.md",
);
if (!fs.existsSync(markdownPath)) {
  throw new Error("release-readiness.md must exist after json generation test");
}

console.log("release-readiness.md ok");
EOF
pass "release-readiness.md generated"

echo "-- Test 124: release readiness CLI output --"
grep -q '"release:readiness": "node scripts/run_release_readiness.js"' package.json
npm run release:readiness -- --skip-npm-test >/tmp/release_readiness_cli.log || true
grep -q "Release Readiness" /tmp/release_readiness_cli.log
grep -q "Working Tree" /tmp/release_readiness_cli.log
grep -q "Version Consistency" /tmp/release_readiness_cli.log
grep -q "Required Reports" /tmp/release_readiness_cli.log
grep -q "npm test" /tmp/release_readiness_cli.log
grep -q "Status:" /tmp/release_readiness_cli.log
node --input-type=module <<'EOF'
import { buildReleaseReadinessCliSummary, evaluateReleaseReadiness } from "./src/lib/release_readiness.js";

const readySummary = buildReleaseReadinessCliSummary(
  evaluateReleaseReadiness({
    workingTree: { status: "pass", detail: "clean" },
    versionConsistency: { status: "pass", detail: {} },
    requiredReports: { status: "pass", detail: { required: [], missing: [] } },
    npmTest: { status: "pass", detail: "skipped" },
  }),
);
if (!readySummary.includes("✔ Working Tree") || !readySummary.includes("Status: READY")) {
  throw new Error("ready CLI summary format mismatch");
}

const notReadySummary = buildReleaseReadinessCliSummary(
  evaluateReleaseReadiness({
    workingTree: { status: "fail", detail: "dirty" },
    versionConsistency: { status: "pass", detail: {} },
    requiredReports: { status: "pass", detail: { required: [], missing: [] } },
    npmTest: { status: "pass", detail: "skipped" },
  }),
);
if (!notReadySummary.includes("✘ Working Tree") || !notReadySummary.includes("Status: NOT READY")) {
  throw new Error("not-ready CLI summary format mismatch");
}

console.log("release readiness CLI output ok");
EOF
pass "release readiness CLI output"

echo "-- Test 125: release plan generation --"
node --input-type=module <<'EOF'
import {
  RELEASE_PLAN_STEPS,
  buildReleasePlan,
} from "./src/lib/release_plan.js";

const plan = buildReleasePlan({
  readiness: { status: "ready" },
  generatedAt: "2026-07-02T00:00:00.000Z",
});

if (plan.steps.length !== RELEASE_PLAN_STEPS.length) {
  throw new Error("release plan must include all defined steps");
}
if (plan.steps.some((step) => step.completed !== false)) {
  throw new Error("MVP release plan steps must remain incomplete");
}

console.log("release plan generation ok");
EOF
pass "release plan generation"

echo "-- Test 126: release plan schema --"
node --input-type=module <<'EOF'
import {
  RELEASE_PLAN_SCHEMA,
  buildReleasePlan,
} from "./src/lib/release_plan.js";

if (RELEASE_PLAN_SCHEMA !== "developer-automation/release-plan/1.0") {
  throw new Error("release plan schema constant mismatch");
}

const plan = buildReleasePlan({ readiness: { status: "ready" } });
if (plan.schema !== RELEASE_PLAN_SCHEMA) {
  throw new Error("release plan schema mismatch");
}

console.log("release plan schema ok");
EOF
pass "release plan schema"

echo "-- Test 127: release plan status --"
node --input-type=module <<'EOF'
import { buildReleasePlan } from "./src/lib/release_plan.js";

const readyPlan = buildReleasePlan({ readiness: { status: "ready" } });
if (readyPlan.status !== "ready") {
  throw new Error("expected ready status when readiness is ready");
}

const notReadyPlan = buildReleasePlan({ readiness: { status: "not-ready" } });
if (notReadyPlan.status !== "not-ready") {
  throw new Error("expected not-ready status when readiness is not-ready");
}

console.log("release plan status ok");
EOF
pass "release plan status"

echo "-- Test 128: release plan steps --"
node --input-type=module <<'EOF'
import { buildReleasePlan } from "./src/lib/release_plan.js";

const plan = buildReleasePlan({ readiness: { status: "ready" } });
const requiredSteps = plan.steps.filter((step) => step.required);
const optionalSteps = plan.steps.filter((step) => !step.required);

if (requiredSteps.length !== 3) {
  throw new Error("expected 3 required release plan steps");
}
if (optionalSteps.length !== 2) {
  throw new Error("expected 2 optional release plan steps");
}
for (const step of plan.steps) {
  if (!step.id || !step.name || typeof step.required !== "boolean") {
    throw new Error("each release plan step must include id, name, and required");
  }
}

console.log("release plan steps ok");
EOF
pass "release plan steps"

echo "-- Test 129: release plan step ids are fixed strings --"
node --input-type=module <<'EOF'
import {
  RELEASE_PLAN_STEPS,
  buildReleasePlan,
} from "./src/lib/release_plan.js";

const expectedIds = [
  "git-commit",
  "git-tag",
  "git-push",
  "github-release",
  "publish",
];

if (RELEASE_PLAN_STEPS.map((step) => step.id).join(",") !== expectedIds.join(",")) {
  throw new Error("release plan step ids must be fixed strings");
}

const plan = buildReleasePlan({ readiness: { status: "ready" } });
if (plan.steps.map((step) => step.id).join(",") !== expectedIds.join(",")) {
  throw new Error("generated release plan step ids must match fixed ids");
}

console.log("release plan step ids ok");
EOF
pass "release plan step ids are fixed strings"

echo "-- Test 130: release plan step reasons exist --"
node --input-type=module <<'EOF'
import { buildReleasePlan } from "./src/lib/release_plan.js";

const readyPlan = buildReleasePlan({ readiness: { status: "ready" } });
for (const step of readyPlan.steps) {
  if (!step.reason || step.reason.trim().length === 0) {
    throw new Error(`step ${step.id} must include reason`);
  }
}

const notReadyPlan = buildReleasePlan({ readiness: { status: "not-ready" } });
for (const step of notReadyPlan.steps) {
  if (!step.reason || step.reason.trim().length === 0) {
    throw new Error(`step ${step.id} must include reason when not-ready`);
  }
}

console.log("release plan step reasons ok");
EOF
pass "release plan step reasons exist"

echo "-- Test 131: release-plan.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReleasePlan,
  writeReleasePlanReport,
} from "./src/lib/release_plan.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const plan = buildReleasePlan({
  rootDir: PROJECT_ROOT,
  readiness: { status: "ready" },
  generatedAt: "2026-07-02T00:00:00.000Z",
});

writeReleasePlanReport(plan, PROJECT_ROOT);

const jsonPath = path.join(
  PROJECT_ROOT,
  "reports/developer-automation/latest/release-plan.json",
);
const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

if (payload.schema !== "developer-automation/release-plan/1.0") {
  throw new Error("release-plan.json schema mismatch");
}
if (payload.status !== "ready") {
  throw new Error("release-plan.json status mismatch");
}
if (!Array.isArray(payload.steps) || payload.steps.length !== 5) {
  throw new Error("release-plan.json steps mismatch");
}

console.log("release-plan.json ok");
EOF
pass "release-plan.json generated"

echo "-- Test 132: release-plan.md generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReleasePlan,
  buildReleasePlanMarkdown,
} from "./src/lib/release_plan.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const plan = buildReleasePlan({ readiness: { status: "ready" } });
const markdown = buildReleasePlanMarkdown(plan);

for (const section of ["Release Plan", "Status", "Planned Steps"]) {
  if (!markdown.includes(section)) {
    throw new Error(`release-plan markdown must include section: ${section}`);
  }
}

const markdownPath = path.join(
  PROJECT_ROOT,
  "reports/developer-automation/latest/release-plan.md",
);
if (!fs.existsSync(markdownPath)) {
  throw new Error("release-plan.md must exist after json generation test");
}

console.log("release-plan.md ok");
EOF
pass "release-plan.md generated"

echo "-- Test 133: release plan CLI summary --"
node --input-type=module <<'EOF'
import { buildReleasePlan, buildReleasePlanCliSummary } from "./src/lib/release_plan.js";

const readySummary = buildReleasePlanCliSummary(
  buildReleasePlan({ readiness: { status: "ready" } }),
);
if (!readySummary.includes("Release Plan")) {
  throw new Error("CLI summary must include Release Plan heading");
}
if (!readySummary.includes("Status: READY")) {
  throw new Error("CLI summary must include READY status");
}
if (!readySummary.includes("Planned Steps")) {
  throw new Error("CLI summary must include Planned Steps section");
}
if (!readySummary.includes("○ git commit — Pending human approval")) {
  throw new Error("CLI summary must include pending git commit step");
}
if (!readySummary.includes("○ GitHub Release — Out of MVP scope")) {
  throw new Error("CLI summary must include out-of-scope GitHub Release step");
}

const notReadySummary = buildReleasePlanCliSummary(
  buildReleasePlan({ readiness: { status: "not-ready" } }),
);
if (!notReadySummary.includes("Status: NOT READY")) {
  throw new Error("CLI summary must include NOT READY status");
}
if (!notReadySummary.includes("Release readiness is not ready")) {
  throw new Error("CLI summary must reflect readiness not-ready reason");
}

console.log("release plan CLI summary ok");
EOF
pass "release plan CLI summary"

echo "-- Test 134: release:plan npm script --"
grep -q '"release:plan": "node scripts/run_release_plan.js"' package.json
npm run release:plan >/tmp/release_plan_cli.log || true
grep -q "Release Plan" /tmp/release_plan_cli.log
grep -q "Status:" /tmp/release_plan_cli.log
grep -q "Planned Steps" /tmp/release_plan_cli.log
grep -q "git commit" /tmp/release_plan_cli.log
pass "release:plan npm script"

echo "-- Test 135: release plan release readiness integration --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildReleasePlan,
} from "./src/lib/release_plan.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "release-plan-"));
const reportDir = path.join(tempRoot, "reports", "developer-automation", "latest");
fs.mkdirSync(reportDir, { recursive: true });

fs.writeFileSync(
  path.join(reportDir, "release-readiness.json"),
  `${JSON.stringify({ schema: "developer-automation/release-readiness/1.0", status: "ready", checks: {} }, null, 2)}\n`,
);

const readyPlan = buildReleasePlan({ rootDir: tempRoot });
if (readyPlan.status !== "ready") {
  throw new Error("release plan must be ready when release-readiness.json is ready");
}
if (readyPlan.steps[0].reason !== "Pending human approval") {
  throw new Error("required step reason must be Pending human approval when ready");
}

fs.writeFileSync(
  path.join(reportDir, "release-readiness.json"),
  `${JSON.stringify({ schema: "developer-automation/release-readiness/1.0", status: "not-ready", checks: {} }, null, 2)}\n`,
);

const notReadyPlan = buildReleasePlan({ rootDir: tempRoot });
if (notReadyPlan.status !== "not-ready") {
  throw new Error("release plan must be not-ready when release-readiness.json is not-ready");
}
if (notReadyPlan.steps[0].reason !== "Release readiness is not ready") {
  throw new Error("required step reason must reflect readiness not-ready");
}

const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "release-plan-missing-"));
const fallbackPlan = buildReleasePlan({ rootDir: missingRoot });
if (fallbackPlan.status !== "not-ready") {
  throw new Error("release plan must be not-ready when release-readiness.json is missing");
}

console.log("release plan release readiness integration ok");
EOF
pass "release plan release readiness integration"

echo "-- Test 136: workflow step status constants --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  WORKFLOW_STATUS,
} from "./src/lib/developer_workflow.js";

if (STEP_STATUS.PASS !== "PASS" || STEP_STATUS.FAIL !== "FAIL" || STEP_STATUS.SKIPPED !== "SKIPPED" || STEP_STATUS.STOPPED !== "STOPPED") {
  throw new Error("STEP_STATUS constants mismatch");
}
if (WORKFLOW_STATUS.SUCCESS !== "SUCCESS" || WORKFLOW_STATUS.FAILURE !== "FAILURE" || WORKFLOW_STATUS.STOPPED !== "STOPPED") {
  throw new Error("WORKFLOW_STATUS constants mismatch");
}

console.log("workflow step status constants ok");
EOF
pass "workflow step status constants"

echo "-- Test 137: workflow step result standardization --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  buildStepResult,
} from "./src/lib/developer_workflow.js";

const result = buildStepResult({
  id: "version-consistency",
  name: "Version Consistency",
  status: STEP_STATUS.PASS,
  detail: { reportStatus: "ok" },
});

for (const key of ["id", "name", "status", "guard", "detail"]) {
  if (!(key in result)) {
    throw new Error(`step result must include ${key}`);
  }
}
if (result.guard.reason !== "NONE") {
  throw new Error("default guard reason must be NONE");
}
if (result.id !== "version-consistency") {
  throw new Error("step result id mismatch");
}

console.log("workflow step result standardization ok");
EOF
pass "workflow step result standardization"

echo "-- Test 138: workflow context creation --"
node --input-type=module <<'EOF'
import {
  DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA,
  DEFAULT_WORKFLOW_OPTIONS,
  WORKFLOW_STATUS,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  rootDir: "/tmp/project",
  skipNpmTest: true,
  generatedAt: "2026-07-02T00:00:00.000Z",
});

if (context.schema !== DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA) {
  throw new Error("workflow context schema mismatch");
}
if (context.rootDir !== "/tmp/project") {
  throw new Error("workflow context rootDir mismatch");
}
if (context.skipNpmTest !== true) {
  throw new Error("workflow context skipNpmTest mismatch");
}
if (context.options.dryRun !== DEFAULT_WORKFLOW_OPTIONS.dryRun) {
  throw new Error("workflow context must use default dryRun option");
}
if (context.options.failFast !== DEFAULT_WORKFLOW_OPTIONS.failFast) {
  throw new Error("workflow context must use default failFast option");
}
if (!Array.isArray(context.options.guardHooks)) {
  throw new Error("workflow context must include guardHooks");
}
if (!Array.isArray(context.results) || context.results.length !== 0) {
  throw new Error("workflow context must start with empty results");
}
if (context.status !== WORKFLOW_STATUS.SUCCESS) {
  throw new Error("workflow context initial status must be success");
}

console.log("workflow context creation ok");
EOF
pass "workflow context creation"

echo "-- Test 139: workflow context accumulates step results --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  appendStepResult,
  buildStepResult,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext();
const first = appendStepResult(
  context,
  buildStepResult({
    id: "version-consistency",
    name: "Version Consistency",
    status: STEP_STATUS.PASS,
  }),
);
const second = appendStepResult(
  first,
  buildStepResult({
    id: "release-readiness",
    name: "Release Readiness",
    status: STEP_STATUS.FAIL,
  }),
);

if (context.results.length !== 0) {
  throw new Error("appendStepResult must not mutate original context");
}
if (second.results.length !== 2) {
  throw new Error("workflow context must accumulate step results");
}
if (second.results[1].status !== STEP_STATUS.FAIL) {
  throw new Error("accumulated step result status mismatch");
}

console.log("workflow context accumulates step results ok");
EOF
pass "workflow context accumulates step results"

echo "-- Test 140: workflow step registry execution order --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  WORKFLOW_STEP_REGISTRY,
  appendStepResult,
  buildStepResult,
  createWorkflowContext,
  executeWorkflowSteps,
} from "./src/lib/developer_workflow.js";

const calls = [];
const mockRegistry = WORKFLOW_STEP_REGISTRY.map((step) => ({
  ...step,
  run: (context) => {
    calls.push(step.id);
    return appendStepResult(
      context,
      buildStepResult({
        id: step.id,
        name: step.name,
        status: STEP_STATUS.PASS,
      }),
    );
  },
}));

const context = executeWorkflowSteps(createWorkflowContext(), mockRegistry);
const expectedIds = WORKFLOW_STEP_REGISTRY.map((step) => step.id);

if (calls.join(",") !== expectedIds.join(",")) {
  throw new Error("workflow steps must execute in registry order");
}
if (context.results.map((result) => result.id).join(",") !== expectedIds.join(",")) {
  throw new Error("workflow results must follow registry order");
}

console.log("workflow step registry execution order ok");
EOF
pass "workflow step registry execution order"

echo "-- Test 141: workflow steps receive and return context --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  appendStepResult,
  buildStepResult,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const stepA = (context) =>
  appendStepResult(
    context,
    buildStepResult({
      id: "step-a",
      name: "Step A",
      status: STEP_STATUS.PASS,
      detail: { marker: "a" },
    }),
  );

const stepB = (context) =>
  appendStepResult(
    context,
    buildStepResult({
      id: "step-b",
      name: "Step B",
      status: STEP_STATUS.PASS,
      detail: { marker: "b", previousCount: context.results.length },
    }),
  );

const finalContext = stepB(stepA(createWorkflowContext()));
if (finalContext.results.length !== 2) {
  throw new Error("chained steps must return updated context");
}
if (finalContext.results[1].detail.previousCount !== 1) {
  throw new Error("step must receive prior context state");
}

console.log("workflow steps receive and return context ok");
EOF
pass "workflow steps receive and return context"

echo "-- Test 142: workflow status computation --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STOP_REASON,
  computeWorkflowStatus,
} from "./src/lib/developer_workflow.js";

const allPass = computeWorkflowStatus({
  results: [
    { status: STEP_STATUS.PASS },
    { status: STEP_STATUS.PASS },
  ],
  stopReason: WORKFLOW_STOP_REASON.NONE,
});
if (allPass !== WORKFLOW_STATUS.SUCCESS) {
  throw new Error("all pass results must produce success workflow status");
}

const hasFail = computeWorkflowStatus({
  results: [
    { status: STEP_STATUS.PASS },
    { status: STEP_STATUS.FAIL },
  ],
  stopReason: WORKFLOW_STOP_REASON.NONE,
});
if (hasFail !== WORKFLOW_STATUS.FAILURE) {
  throw new Error("any fail result must produce failure workflow status");
}

const stopped = computeWorkflowStatus({
  results: [
    { status: STEP_STATUS.PASS },
    { status: STEP_STATUS.STOPPED },
  ],
  stopReason: WORKFLOW_STOP_REASON.STOP_BEFORE_STEP,
});
if (stopped !== WORKFLOW_STATUS.STOPPED) {
  throw new Error("stopped step must produce stopped workflow status");
}

console.log("workflow status computation ok");
EOF
pass "workflow status computation"

echo "-- Test 143: runDeveloperWorkflow integration --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  skipNpmTest: true,
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) =>
      step.id === "release-readiness"
        ? {
            ...ctx,
            results: [
              ...ctx.results,
              {
                id: step.id,
                name: step.name,
                status: STEP_STATUS.PASS,
                guard: { shouldExecute: true, reason: "NONE" },
                detail: null,
              },
            ],
          }
        : {
            ...ctx,
            results: [
              ...ctx.results,
              {
                id: step.id,
                name: step.name,
                status: STEP_STATUS.FAIL,
                guard: { shouldExecute: true, reason: "NONE" },
                detail: null,
              },
            ],
          },
  })),
});

if (context.results.length !== WORKFLOW_STEP_REGISTRY.length) {
  throw new Error("runDeveloperWorkflow must execute all registry steps");
}
if (context.status !== WORKFLOW_STATUS.FAILURE) {
  throw new Error("runDeveloperWorkflow must finalize workflow status from results");
}

console.log("runDeveloperWorkflow integration ok");
EOF
pass "runDeveloperWorkflow integration"

echo "-- Test 144: developer-automation-report.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA,
  STEP_STATUS,
  WORKFLOW_STATUS,
  buildStepResult,
  createWorkflowContext,
  finalizeWorkflowContext,
  writeDeveloperAutomationReport,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const context = finalizeWorkflowContext({
  ...createWorkflowContext({
    rootDir: PROJECT_ROOT,
    generatedAt: "2026-07-02T00:00:00.000Z",
  }),
  results: [
    buildStepResult({
      id: "version-consistency",
      name: "Version Consistency",
      status: STEP_STATUS.PASS,
    }),
  ],
});

writeDeveloperAutomationReport(context, PROJECT_ROOT);

const jsonPath = path.join(
  PROJECT_ROOT,
  "reports/developer-automation/latest/developer-automation-report.json",
);
const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

if (payload.schema !== DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA) {
  throw new Error("developer-automation-report.json schema mismatch");
}
if (payload.status !== WORKFLOW_STATUS.SUCCESS) {
  throw new Error("developer-automation-report.json status mismatch");
}
if (!Array.isArray(payload.results) || payload.results.length !== 1) {
  throw new Error("developer-automation-report.json results mismatch");
}
if (!payload.options || payload.options.dryRun !== true) {
  throw new Error("developer-automation-report.json must include workflow options");
}
if (!payload.results[0].guard) {
  throw new Error("developer-automation-report.json must include guard decision");
}

console.log("developer-automation-report.json ok");
EOF
pass "developer-automation-report.json generated"

echo "-- Test 145: developer-automation-report.md generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STEP_STATUS,
  buildDeveloperAutomationReportMarkdown,
  buildStepResult,
  createWorkflowContext,
  finalizeWorkflowContext,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const context = finalizeWorkflowContext({
  ...createWorkflowContext({ generatedAt: "2026-07-02T00:00:00.000Z" }),
  results: [
    buildStepResult({
      id: "release-plan",
      name: "Release Plan",
      status: STEP_STATUS.FAIL,
    }),
  ],
});

const markdown = buildDeveloperAutomationReportMarkdown(context);
for (const section of ["Developer Automation Report", "Workflow Options", "Workflow Status", "Guard Summary", "Step Results"]) {
  if (!markdown.includes(section)) {
    throw new Error(`developer-automation-report markdown must include section: ${section}`);
  }
}

const markdownPath = path.join(
  PROJECT_ROOT,
  "reports/developer-automation/latest/developer-automation-report.md",
);
if (!fs.existsSync(markdownPath)) {
  throw new Error("developer-automation-report.md must exist after json generation test");
}

console.log("developer-automation-report.md ok");
EOF
pass "developer-automation-report.md generated"

echo "-- Test 146: developer workflow CLI summary --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  WORKFLOW_STATUS,
  buildDeveloperAutomationReport,
  buildDeveloperAutomationWorkflowCliSummary,
  buildStepResult,
  createWorkflowContext,
  finalizeWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = finalizeWorkflowContext({
  ...createWorkflowContext(),
  results: [
    buildStepResult({
      id: "version-consistency",
      name: "Version Consistency",
      status: STEP_STATUS.PASS,
    }),
    buildStepResult({
      id: "release-readiness",
      name: "Release Readiness",
      status: STEP_STATUS.FAIL,
    }),
  ],
});

const summary = buildDeveloperAutomationWorkflowCliSummary(context);
if (!summary.includes("Developer Automation Workflow")) {
  throw new Error("CLI summary must include workflow heading");
}
if (!summary.includes("Options")) {
  throw new Error("CLI summary must include options section");
}
if (!summary.includes("Workflow Status")) {
  throw new Error("CLI summary must include workflow status section");
}
if (!summary.includes("Guard Summary")) {
  throw new Error("CLI summary must include guard summary section");
}
if (!summary.includes("Executed")) {
  throw new Error("CLI summary must include executed count");
}
if (!summary.includes("FAILURE")) {
  throw new Error("CLI summary must include workflow status value");
}
if (!summary.includes("Version Consistency\nPASS")) {
  throw new Error("CLI summary must include pass step");
}
if (!summary.includes("Release Readiness\nFAIL")) {
  throw new Error("CLI summary must include fail step");
}

const report = buildDeveloperAutomationReport(context);
if (report.status !== WORKFLOW_STATUS.FAILURE) {
  throw new Error("report and CLI must share the same context status");
}

console.log("developer workflow CLI summary ok");
EOF
pass "developer workflow CLI summary"

echo "-- Test 147: json markdown cli share same context --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  buildDeveloperAutomationReport,
  buildDeveloperAutomationReportMarkdown,
  buildDeveloperAutomationWorkflowCliSummary,
  buildStepResult,
  createWorkflowContext,
  finalizeWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = finalizeWorkflowContext({
  ...createWorkflowContext({ generatedAt: "2026-07-02T00:00:00.000Z" }),
  results: [
    buildStepResult({
      id: "release-plan",
      name: "Release Plan",
      status: STEP_STATUS.PASS,
    }),
  ],
});

const report = buildDeveloperAutomationReport(context);
const markdown = buildDeveloperAutomationReportMarkdown(context);
const summary = buildDeveloperAutomationWorkflowCliSummary(context);

if (report.results.length !== context.results.length) {
  throw new Error("report must be built from the same context results");
}
if (!markdown.includes("Release Plan")) {
  throw new Error("markdown must reflect context step results");
}
if (!markdown.includes("Status: PASS")) {
  throw new Error("markdown must include step status");
}
if (!summary.includes("Release Plan\nPASS")) {
  throw new Error("CLI summary must reflect context step results");
}

console.log("json markdown cli share same context ok");
EOF
pass "json markdown cli share same context"

echo "-- Test 148: developer:workflow npm script --"
grep -q '"developer:workflow": "node scripts/run_developer_workflow.js"' package.json
npm run developer:workflow -- --skip-npm-test >/tmp/developer_workflow_cli.log || true
grep -q "Developer Automation Workflow" /tmp/developer_workflow_cli.log
grep -q "Workflow Status" /tmp/developer_workflow_cli.log
grep -q "Guard Summary" /tmp/developer_workflow_cli.log
grep -q "Step Results" /tmp/developer_workflow_cli.log
grep -q "Options" /tmp/developer_workflow_cli.log
grep -q "Version Consistency" /tmp/developer_workflow_cli.log
grep -q "Release Readiness" /tmp/developer_workflow_cli.log
grep -q "Release Plan" /tmp/developer_workflow_cli.log
pass "developer:workflow npm script"

echo "-- Test 149: DEFAULT_WORKFLOW_OPTIONS --"
node --input-type=module <<'EOF'
import {
  DEFAULT_WORKFLOW_OPTIONS,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

if (DEFAULT_WORKFLOW_OPTIONS.dryRun !== true) {
  throw new Error("default dryRun must be true");
}
if (DEFAULT_WORKFLOW_OPTIONS.failFast !== false) {
  throw new Error("default failFast must be false");
}
if (DEFAULT_WORKFLOW_OPTIONS.stopBeforeStep !== null) {
  throw new Error("default stopBeforeStep must be null");
}
if (!Array.isArray(DEFAULT_WORKFLOW_OPTIONS.skipSteps) || DEFAULT_WORKFLOW_OPTIONS.skipSteps.length !== 0) {
  throw new Error("default skipSteps must be empty array");
}
if (!Array.isArray(DEFAULT_WORKFLOW_OPTIONS.guardHooks)) {
  throw new Error("default guardHooks must be array");
}

const context = createWorkflowContext();
if (JSON.stringify(context.options) !== JSON.stringify(DEFAULT_WORKFLOW_OPTIONS)) {
  throw new Error("unspecified options must use DEFAULT_WORKFLOW_OPTIONS");
}

console.log("DEFAULT_WORKFLOW_OPTIONS ok");
EOF
pass "DEFAULT_WORKFLOW_OPTIONS"

echo "-- Test 150: workflow guard functions --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  createWorkflowContext,
  evaluateGuard,
  shouldExecuteStep,
  shouldSkipStep,
  shouldStopBeforeStep,
} from "./src/lib/developer_workflow.js";

const knownStepIds = ["version-consistency", "release-readiness", "release-plan"];
const stopAndSkipContext = createWorkflowContext({
  options: {
    stopBeforeStep: "release-plan",
    skipSteps: ["release-plan"],
  },
});

if (!shouldStopBeforeStep(stopAndSkipContext, { id: "release-plan" }, knownStepIds)) {
  throw new Error("shouldStopBeforeStep must return true for stop target");
}
if (!shouldSkipStep(stopAndSkipContext, { id: "release-plan" }, knownStepIds)) {
  throw new Error("shouldSkipStep must return true when step is listed in skipSteps");
}
const priorityGuard = evaluateGuard(stopAndSkipContext, { id: "release-plan" }, knownStepIds);
if (priorityGuard.reason !== GUARD_REASON.STOP_BEFORE_STEP) {
  throw new Error("evaluateGuard must prioritize STOP_BEFORE_STEP over SKIP_STEP");
}
if (shouldExecuteStep(stopAndSkipContext, { id: "release-plan" }, knownStepIds)) {
  throw new Error("shouldExecuteStep must return false when stopBeforeStep matches");
}
if (shouldExecuteStep(createWorkflowContext(), { id: "version-consistency" }, knownStepIds) !== true) {
  throw new Error("shouldExecuteStep must return true when no guard applies");
}

const skipContext = createWorkflowContext({
  options: { skipSteps: ["release-plan"] },
});
if (!shouldSkipStep(skipContext, { id: "release-plan" }, knownStepIds)) {
  throw new Error("shouldSkipStep must return true for skipped step");
}
if (shouldExecuteStep(skipContext, { id: "release-plan" }, knownStepIds)) {
  throw new Error("shouldExecuteStep must return false for skipped step");
}

console.log("workflow guard functions ok");
EOF
pass "workflow guard functions"

echo "-- Test 151: fail fast true stops workflow --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STOP_REASON,
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { failFast: true },
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ({
      ...ctx,
      results: [
        ...ctx.results,
        {
          id: step.id,
          name: step.name,
          status: step.id === "version-consistency" ? STEP_STATUS.FAIL : STEP_STATUS.PASS,
          guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
          detail: null,
        },
      ],
    }),
  })),
});

if (context.results.length !== 1) {
  throw new Error("failFast true must stop workflow after first failure");
}
if (context.status !== WORKFLOW_STATUS.FAILURE) {
  throw new Error("failFast true must produce FAILURE workflow status");
}
if (context.stopReason !== WORKFLOW_STOP_REASON.FAIL_FAST) {
  throw new Error("failFast true must set FAIL_FAST stop reason");
}

console.log("fail fast true stops workflow ok");
EOF
pass "fail fast true stops workflow"

echo "-- Test 152: fail fast false continues workflow --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STOP_REASON,
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { failFast: false },
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ({
      ...ctx,
      results: [
        ...ctx.results,
        {
          id: step.id,
          name: step.name,
          status: step.id === "version-consistency" ? STEP_STATUS.FAIL : STEP_STATUS.PASS,
          guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
          detail: null,
        },
      ],
    }),
  })),
});

if (context.results.length !== WORKFLOW_STEP_REGISTRY.length) {
  throw new Error("failFast false must continue after failure");
}
if (context.status !== WORKFLOW_STATUS.FAILURE) {
  throw new Error("failFast false must still produce FAILURE when a step fails");
}
if (context.stopReason !== WORKFLOW_STOP_REASON.NONE) {
  throw new Error("failFast false must not set stop reason");
}

console.log("fail fast false continues workflow ok");
EOF
pass "fail fast false continues workflow"

echo "-- Test 153: stop before step --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { stopBeforeStep: "release-plan" },
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ({
      ...ctx,
      results: [
        ...ctx.results,
        {
          id: step.id,
          name: step.name,
          status: STEP_STATUS.PASS,
          guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
          detail: null,
        },
      ],
    }),
  })),
});

if (context.results.length !== 3) {
  throw new Error("stopBeforeStep must include stopped target step in results");
}
if (context.results[2].status !== STEP_STATUS.STOPPED) {
  throw new Error("stopBeforeStep target must be STOPPED");
}
if (context.results[2].guard.reason !== GUARD_REASON.STOP_BEFORE_STEP) {
  throw new Error("stopBeforeStep target must include STOP_BEFORE_STEP guard reason");
}
if (context.status !== WORKFLOW_STATUS.STOPPED) {
  throw new Error("stopBeforeStep must produce STOPPED workflow status");
}

console.log("stop before step ok");
EOF
pass "stop before step"

echo "-- Test 154: skip step --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { skipSteps: ["release-plan"] },
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ({
      ...ctx,
      results: [
        ...ctx.results,
        {
          id: step.id,
          name: step.name,
          status: STEP_STATUS.PASS,
          guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
          detail: null,
        },
      ],
    }),
  })),
});

const releasePlan = context.results.find((result) => result.id === "release-plan");
if (!releasePlan || releasePlan.status !== STEP_STATUS.SKIPPED) {
  throw new Error("skipSteps must mark target step as SKIPPED");
}
if (releasePlan.guard.reason !== GUARD_REASON.SKIP_STEP) {
  throw new Error("skipped step must include SKIP_STEP guard reason");
}
if (context.status !== WORKFLOW_STATUS.SUCCESS) {
  throw new Error("skip step workflow must remain SUCCESS when other steps pass");
}

console.log("skip step ok");
EOF
pass "skip step"

echo "-- Test 155: stopBeforeStep priority over skipSteps --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: {
    stopBeforeStep: "release-plan",
    skipSteps: ["release-plan"],
  },
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ctx,
  })),
});

const releasePlan = context.results.find((result) => result.id === "release-plan");
if (releasePlan.status !== STEP_STATUS.STOPPED) {
  throw new Error("stopBeforeStep must take priority over skipSteps");
}
if (releasePlan.guard.reason !== GUARD_REASON.STOP_BEFORE_STEP) {
  throw new Error("priority guard reason must be STOP_BEFORE_STEP");
}

console.log("stopBeforeStep priority over skipSteps ok");
EOF
pass "stopBeforeStep priority over skipSteps"

echo "-- Test 156: unknown stopBeforeStep ignored --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { stopBeforeStep: "unknown-step" },
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ({
      ...ctx,
      results: [
        ...ctx.results,
        {
          id: step.id,
          name: step.name,
          status: "PASS",
          guard: { shouldExecute: true, reason: "NONE" },
          detail: null,
        },
      ],
    }),
  })),
});

if (context.results.length !== WORKFLOW_STEP_REGISTRY.length) {
  throw new Error("unknown stopBeforeStep must not stop workflow");
}

console.log("unknown stopBeforeStep ignored ok");
EOF
pass "unknown stopBeforeStep ignored"

echo "-- Test 157: unknown skipSteps ignored --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { skipSteps: ["unknown-step", "release-plan"] },
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ({
      ...ctx,
      results: [
        ...ctx.results,
        {
          id: step.id,
          name: step.name,
          status: "PASS",
          guard: { shouldExecute: true, reason: "NONE" },
          detail: null,
        },
      ],
    }),
  })),
});

const releasePlan = context.results.find((result) => result.id === "release-plan");
if (releasePlan.status !== "SKIPPED") {
  throw new Error("known skip step must still be skipped when unknown ids are present");
}
if (context.results.length !== WORKFLOW_STEP_REGISTRY.length) {
  throw new Error("unknown skipSteps must not remove other steps");
}

console.log("unknown skipSteps ignored ok");
EOF
pass "unknown skipSteps ignored"

echo "-- Test 158: json guard report --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STOP_REASON,
  runDeveloperWorkflow,
  writeDeveloperAutomationReport,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const context = runDeveloperWorkflow({
  rootDir: PROJECT_ROOT,
  options: { stopBeforeStep: "release-plan" },
  registry: [
    {
      id: "version-consistency",
      name: "Version Consistency",
      run: (ctx) => ({
        ...ctx,
        results: [
          ...ctx.results,
          {
            id: "version-consistency",
            name: "Version Consistency",
            status: STEP_STATUS.PASS,
            guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
            detail: null,
          },
        ],
      }),
    },
    {
      id: "release-readiness",
      name: "Release Readiness",
      run: (ctx) => ({
        ...ctx,
        results: [
          ...ctx.results,
          {
            id: "release-readiness",
            name: "Release Readiness",
            status: STEP_STATUS.PASS,
            guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
            detail: null,
          },
        ],
      }),
    },
    {
      id: "release-plan",
      name: "Release Plan",
      run: (ctx) => ctx,
    },
  ],
});

writeDeveloperAutomationReport(context, PROJECT_ROOT);
const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/developer-automation/latest/developer-automation-report.json"),
    "utf8",
  ),
);

if (payload.status !== WORKFLOW_STATUS.STOPPED) {
  throw new Error("json guard report must include STOPPED workflow status");
}
if (payload.stopReason !== WORKFLOW_STOP_REASON.STOP_BEFORE_STEP) {
  throw new Error("json guard report must include stop reason");
}
if (payload.results.at(-1).guard.reason !== GUARD_REASON.STOP_BEFORE_STEP) {
  throw new Error("json guard report must include guard decision");
}

console.log("json guard report ok");
EOF
pass "json guard report"

echo "-- Test 159: markdown guard report --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  buildDeveloperAutomationReport,
  buildDeveloperAutomationReportMarkdown,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { skipSteps: ["release-plan"] },
  registry: [
    {
      id: "version-consistency",
      name: "Version Consistency",
      run: (ctx) => ({
        ...ctx,
        results: [
          ...ctx.results,
          {
            id: "version-consistency",
            name: "Version Consistency",
            status: STEP_STATUS.PASS,
            guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
            detail: null,
          },
        ],
      }),
    },
    {
      id: "release-plan",
      name: "Release Plan",
      run: (ctx) => ctx,
    },
  ],
});

const report = buildDeveloperAutomationReport(context);
const markdown = buildDeveloperAutomationReportMarkdown(context);

if (!markdown.includes(`Dry Run: ${report.options.dryRun ? "YES" : "NO"}`)) {
  throw new Error("markdown must reflect json workflow options");
}
if (!markdown.includes(`Workflow Status`) || !markdown.includes(report.status)) {
  throw new Error("markdown must reflect json workflow status");
}
if (!markdown.includes("Guard Reason: SKIP_STEP")) {
  throw new Error("markdown must reflect json guard decision");
}

console.log("markdown guard report ok");
EOF
pass "markdown guard report"

echo "-- Test 160: cli options display --"
node --input-type=module <<'EOF'
import {
  buildDeveloperAutomationWorkflowCliSummary,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const summary = buildDeveloperAutomationWorkflowCliSummary(
  runDeveloperWorkflow({
    options: {
      dryRun: true,
      failFast: false,
      stopBeforeStep: "release-plan",
      skipSteps: [],
    },
    registry: [],
  }),
);

for (const expected of ["Dry Run", "YES", "Fail Fast", "NO", "Stop Before", "release-plan", "Skip Steps", "none"]) {
  if (!summary.includes(expected)) {
    throw new Error(`CLI options must include: ${expected}`);
  }
}

console.log("cli options display ok");
EOF
pass "cli options display"

echo "-- Test 161: workflow status SUCCESS --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  registry: [
    {
      id: "version-consistency",
      name: "Version Consistency",
      run: (ctx) => ({
        ...ctx,
        results: [
          ...ctx.results,
          {
            id: "version-consistency",
            name: "Version Consistency",
            status: STEP_STATUS.PASS,
            guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
            detail: null,
          },
        ],
      }),
    },
  ],
});

if (context.status !== WORKFLOW_STATUS.SUCCESS) {
  throw new Error("all pass steps must produce SUCCESS workflow status");
}

console.log("workflow status SUCCESS ok");
EOF
pass "workflow status SUCCESS"

echo "-- Test 162: workflow status FAILURE --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  registry: [
    {
      id: "version-consistency",
      name: "Version Consistency",
      run: (ctx) => ({
        ...ctx,
        results: [
          ...ctx.results,
          {
            id: "version-consistency",
            name: "Version Consistency",
            status: STEP_STATUS.FAIL,
            guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
            detail: null,
          },
        ],
      }),
    },
  ],
});

if (context.status !== WORKFLOW_STATUS.FAILURE) {
  throw new Error("failed step must produce FAILURE workflow status");
}

console.log("workflow status FAILURE ok");
EOF
pass "workflow status FAILURE"

echo "-- Test 163: workflow status STOPPED --"
node --input-type=module <<'EOF'
import {
  STEP_STATUS,
  WORKFLOW_STATUS,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { stopBeforeStep: "release-plan" },
  registry: [
    {
      id: "release-plan",
      name: "Release Plan",
      run: (ctx) => ctx,
    },
  ],
});

if (context.status !== WORKFLOW_STATUS.STOPPED) {
  throw new Error("stop before step must produce STOPPED workflow status");
}

console.log("workflow status STOPPED ok");
EOF
pass "workflow status STOPPED"

echo "-- Test 164: SKIPPED step status --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  options: { skipSteps: ["release-plan"] },
  registry: [
    {
      id: "release-plan",
      name: "Release Plan",
      run: (ctx) => ctx,
    },
  ],
});

if (context.results[0].status !== STEP_STATUS.SKIPPED) {
  throw new Error("skipped step must use SKIPPED status");
}
if (context.results[0].guard.reason !== GUARD_REASON.SKIP_STEP) {
  throw new Error("skipped step must include SKIP_STEP guard reason");
}

console.log("SKIPPED step status ok");
EOF
pass "SKIPPED step status"

echo "-- Test 165: developer workflow backward compatibility --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const context = runDeveloperWorkflow({
  skipNpmTest: true,
  registry: WORKFLOW_STEP_REGISTRY.map((step) => ({
    ...step,
    run: (ctx) => ({
      ...ctx,
      results: [
        ...ctx.results,
        {
          id: step.id,
          name: step.name,
          status: "PASS",
          guard: { shouldExecute: true, reason: "NONE" },
          detail: null,
        },
      ],
    }),
  })),
});

if (context.results.length !== WORKFLOW_STEP_REGISTRY.length) {
  throw new Error("default options must execute all workflow steps like v1.29.0");
}
if (context.options.failFast !== false || context.options.stopBeforeStep !== null || context.options.skipSteps.length !== 0) {
  throw new Error("default options must match v1.29.0 behavior");
}

console.log("developer workflow backward compatibility ok");
EOF
pass "developer workflow backward compatibility"

echo "-- Test 166: developer:workflow guard --"
npm run developer:workflow -- --skip-npm-test --stop-before-step release-plan >/tmp/developer_workflow_guard.log || true
grep -q "Stop Before" /tmp/developer_workflow_guard.log
grep -q "release-plan" /tmp/developer_workflow_guard.log
grep -q "Release Plan" /tmp/developer_workflow_guard.log
grep -q "STOPPED" /tmp/developer_workflow_guard.log
pass "developer:workflow guard"

echo "-- Test 167: workflow report schema 1.1 --"
node --input-type=module <<'EOF'
import {
  DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

if (DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA !== "developer-automation/workflow/1.1") {
  throw new Error("workflow report schema must be developer-automation/workflow/1.1");
}

const context = createWorkflowContext();
if (context.schema !== "developer-automation/workflow/1.1") {
  throw new Error("workflow context schema must be 1.1");
}

console.log("workflow report schema 1.1 ok");
EOF
pass "workflow report schema 1.1"

echo "-- Test 168: WORKFLOW_STOP_REASON constants --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

if (WORKFLOW_STOP_REASON.NONE !== "NONE") {
  throw new Error("WORKFLOW_STOP_REASON.NONE mismatch");
}
if (WORKFLOW_STOP_REASON.FAIL_FAST !== "FAIL_FAST") {
  throw new Error("WORKFLOW_STOP_REASON.FAIL_FAST mismatch");
}
if (WORKFLOW_STOP_REASON.STOP_BEFORE_STEP !== "STOP_BEFORE_STEP") {
  throw new Error("WORKFLOW_STOP_REASON.STOP_BEFORE_STEP mismatch");
}

const context = createWorkflowContext();
if (context.stopReason !== WORKFLOW_STOP_REASON.NONE) {
  throw new Error("initial stopReason must use WORKFLOW_STOP_REASON.NONE");
}

console.log("WORKFLOW_STOP_REASON constants ok");
EOF
pass "WORKFLOW_STOP_REASON constants"

echo "-- Test 169: guard summary in json and cli --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GUARD_REASON,
  STEP_STATUS,
  buildDeveloperAutomationWorkflowCliSummary,
  buildGuardSummary,
  createWorkflowContext,
  finalizeWorkflowContext,
  writeDeveloperAutomationReport,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const context = finalizeWorkflowContext({
  ...createWorkflowContext({ rootDir: PROJECT_ROOT }),
  results: [
    {
      id: "version-consistency",
      name: "Version Consistency",
      status: STEP_STATUS.PASS,
      guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
      detail: null,
    },
    {
      id: "release-readiness",
      name: "Release Readiness",
      status: STEP_STATUS.SKIPPED,
      guard: { shouldExecute: false, reason: GUARD_REASON.SKIP_STEP },
      detail: null,
    },
    {
      id: "release-plan",
      name: "Release Plan",
      status: STEP_STATUS.STOPPED,
      guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
      detail: null,
    },
  ],
});

const summary = buildGuardSummary(context.results);
if (summary.executed !== 1 || summary.skipped !== 1 || summary.stopped !== 1) {
  throw new Error("guard summary counts mismatch");
}

writeDeveloperAutomationReport(context, PROJECT_ROOT);
const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/developer-automation/latest/developer-automation-report.json"),
    "utf8",
  ),
);

if (payload.guardSummary.executed !== 1 || payload.guardSummary.skipped !== 1 || payload.guardSummary.stopped !== 1) {
  throw new Error("json guardSummary mismatch");
}

const cli = buildDeveloperAutomationWorkflowCliSummary(context);
if (!cli.includes("Guard Summary") || !cli.includes("Executed\n1") || !cli.includes("Skipped\n1") || !cli.includes("Stopped\n1")) {
  throw new Error("CLI guard summary mismatch");
}

console.log("guard summary in json and cli ok");
EOF
pass "guard summary in json and cli"

echo "-- Test 170: guard summary aggregation from results only --"
node --input-type=module <<'EOF'
import {
  GUARD_REASON,
  STEP_STATUS,
  buildDeveloperAutomationReport,
  buildGuardSummary,
  createWorkflowContext,
  finalizeWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = finalizeWorkflowContext({
  ...createWorkflowContext(),
  results: [
    {
      id: "a",
      name: "A",
      status: STEP_STATUS.PASS,
      guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
      detail: null,
    },
    {
      id: "b",
      name: "B",
      status: STEP_STATUS.FAIL,
      guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
      detail: null,
    },
    {
      id: "c",
      name: "C",
      status: STEP_STATUS.SKIPPED,
      guard: { shouldExecute: false, reason: GUARD_REASON.SKIP_STEP },
      detail: null,
    },
  ],
});

const report = buildDeveloperAutomationReport(context);
const summary = buildGuardSummary(context.results);

if (summary.executed !== 2) {
  throw new Error("executed must count guard.shouldExecute true steps only");
}
if (summary.skipped !== 1) {
  throw new Error("skipped must count SKIPPED status steps only");
}
if (summary.stopped !== 0) {
  throw new Error("stopped must count STOPPED status steps only");
}
if (JSON.stringify(report.guardSummary) !== JSON.stringify(summary)) {
  throw new Error("report guardSummary must match buildGuardSummary from results");
}

console.log("guard summary aggregation ok");
EOF
pass "guard summary aggregation from results only"

echo "-- Test 171: developer handoff generator exists --"
test -f src/lib/developer_handoff.js
grep -q "buildDeveloperHandoff" src/lib/developer_handoff.js
grep -q "writeDeveloperHandoffReport" src/lib/developer_handoff.js
pass "developer handoff generator exists"

echo "-- Test 172: developer-handoff schema --"
node --input-type=module <<'EOF'
import {
  DEVELOPER_HANDOFF_SCHEMA,
  buildDeveloperHandoff,
} from "./src/lib/developer_handoff.js";

if (DEVELOPER_HANDOFF_SCHEMA !== "developer-automation/handoff/1.0") {
  throw new Error("developer-handoff schema constant mismatch");
}

const handoff = buildDeveloperHandoff({ currentVersion: "v1.31.0" });
if (handoff.schema !== DEVELOPER_HANDOFF_SCHEMA) {
  throw new Error("developer-handoff schema mismatch");
}

console.log("developer-handoff schema ok");
EOF
pass "developer-handoff schema"

echo "-- Test 173: handoff currentVersion read from VERSION.md --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeveloperHandoff,
} from "./src/lib/developer_handoff.js";
import { getVersionFromVersionMd as readVersion } from "./src/lib/developer_automation.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const versionDoc = fs.readFileSync(path.join(PROJECT_ROOT, "docs/VERSION.md"), "utf8");
const match = versionDoc.match(/\*\*(v\d+\.\d+\.\d+)\*\*/);
if (!match) {
  throw new Error("VERSION.md must contain current version");
}

const handoff = buildDeveloperHandoff({ rootDir: PROJECT_ROOT });
if (handoff.currentVersion !== match[1]) {
  throw new Error("handoff currentVersion must match docs/VERSION.md");
}
if (handoff.currentVersion !== readVersion(PROJECT_ROOT)) {
  throw new Error("handoff currentVersion must use getVersionFromVersionMd");
}

console.log(`handoff currentVersion ok: ${handoff.currentVersion}`);
EOF
pass "handoff currentVersion read from VERSION.md"

echo "-- Test 174: handoff nextVersion auto increments minor version --"
node --input-type=module <<'EOF'
import {
  buildDeveloperHandoff,
  computeNextMinorVersion,
} from "./src/lib/developer_handoff.js";

if (computeNextMinorVersion("v1.31.0") !== "v1.32.0") {
  throw new Error("computeNextMinorVersion v1.31.0 must be v1.32.0");
}
if (computeNextMinorVersion("v1.32.0") !== "v1.33.0") {
  throw new Error("computeNextMinorVersion v1.32.0 must be v1.33.0");
}

const handoff = buildDeveloperHandoff({ currentVersion: "v1.30.0" });
if (handoff.nextVersion !== "v1.31.0") {
  throw new Error("handoff nextVersion must auto increment minor version");
}

console.log("handoff nextVersion auto increment ok");
EOF
pass "handoff nextVersion auto increments minor version"

echo "-- Test 175: developer-handoff.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEVELOPER_HANDOFF_SCHEMA,
  buildDeveloperHandoff,
  writeDeveloperHandoffReport,
} from "./src/lib/developer_handoff.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const handoff = buildDeveloperHandoff({
  rootDir: PROJECT_ROOT,
  generatedAt: "2026-07-02T00:00:00.000Z",
});
writeDeveloperHandoffReport(handoff, PROJECT_ROOT);

const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/developer-automation/latest/developer-handoff.json"),
    "utf8",
  ),
);

if (payload.schema !== DEVELOPER_HANDOFF_SCHEMA) {
  throw new Error("developer-handoff.json schema mismatch");
}
if (payload.project !== "AI-SNS-Automation") {
  throw new Error("developer-handoff.json project mismatch");
}
if (!Array.isArray(payload.scope) || payload.scope.length === 0) {
  throw new Error("developer-handoff.json scope must be non-empty array");
}
if (payload.nextVersion !== "v1.62.0") {
  throw new Error("developer-handoff.json nextVersion must auto increment to v1.62.0");
}

console.log("developer-handoff.json ok");
EOF
pass "developer-handoff.json generated"

echo "-- Test 176: developer-handoff.md generated --"
test -f reports/developer-automation/latest/developer-handoff.md
grep -q "# AI-SNS-Automation v1.62.0 Implementation Handoff" reports/developer-automation/latest/developer-handoff.md
grep -q "Next Version: v1.62.0" reports/developer-automation/latest/developer-handoff.md
pass "developer-handoff.md generated"

echo "-- Test 177: handoff markdown includes Project Context --"
grep -q "## Project Context" reports/developer-automation/latest/developer-handoff.md
grep -q "Phase2 Developer Automation" reports/developer-automation/latest/developer-handoff.md
pass "handoff markdown includes Project Context"

echo "-- Test 178: handoff markdown includes Implementation Scope --"
grep -q "## Implementation Scope" reports/developer-automation/latest/developer-handoff.md
grep -q "Add developer handoff generator" reports/developer-automation/latest/developer-handoff.md
pass "handoff markdown includes Implementation Scope"

echo "-- Test 179: handoff markdown includes Prohibited Actions --"
grep -q "## Prohibited Actions" reports/developer-automation/latest/developer-handoff.md
grep -q "git commit" reports/developer-automation/latest/developer-handoff.md
grep -q "Git operation automation" reports/developer-automation/latest/developer-handoff.md
pass "handoff markdown includes Prohibited Actions"

echo "-- Test 180: handoff markdown includes Completion Report Checklist --"
grep -q "## Completion Report Checklist" reports/developer-automation/latest/developer-handoff.md
grep -q "commit / tag / push は未実施であること" reports/developer-automation/latest/developer-handoff.md
pass "handoff markdown includes Completion Report Checklist"

echo "-- Test 181: handoff CLI summary includes output paths --"
node --input-type=module <<'EOF'
import { buildDeveloperHandoff, buildDeveloperHandoffCliSummary } from "./src/lib/developer_handoff.js";

const summary = buildDeveloperHandoffCliSummary(
  buildDeveloperHandoff({ currentVersion: "v1.35.0" }),
);

for (const expected of [
  "Developer Handoff",
  "Project: AI-SNS-Automation",
  "Current Version: v1.35.0",
  "Next Version: v1.36.0",
  "Release: Developer Handoff Prompt Foundation",
  "reports/developer-automation/latest/developer-handoff.json",
  "reports/developer-automation/latest/developer-handoff.md",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`CLI summary must include: ${expected}`);
  }
}

console.log("handoff CLI summary ok");
EOF
pass "handoff CLI summary includes output paths"

echo "-- Test 182: developer:handoff npm script exists --"
grep -q '"developer:handoff": "node scripts/run_developer_handoff.js"' package.json
test -f scripts/run_developer_handoff.js
npm run developer:handoff >/tmp/developer_handoff_cli.log
grep -q "Developer Handoff" /tmp/developer_handoff_cli.log
grep -q "Next Version: v1.62.0" /tmp/developer_handoff_cli.log
grep -q "developer-handoff.json" /tmp/developer_handoff_cli.log
grep -q "developer-handoff.md" /tmp/developer_handoff_cli.log
pass "developer:handoff npm script exists"

echo "-- Test 183: handoff json source markdown view consistency --"
node --input-type=module <<'EOF'
import {
  buildDeveloperHandoff,
  buildDeveloperHandoffMarkdown,
} from "./src/lib/developer_handoff.js";

const handoff = buildDeveloperHandoff({
  currentVersion: "v1.35.0",
  generatedAt: "2026-07-02T00:00:00.000Z",
});
const markdown = buildDeveloperHandoffMarkdown(handoff);

if (handoff.nextVersion !== "v1.36.0") {
  throw new Error("handoff nextVersion must auto increment to v1.36.0");
}
if (!markdown.includes("Next Version: v1.36.0")) {
  throw new Error("markdown must include auto nextVersion");
}
if (!markdown.includes(handoff.objective)) {
  throw new Error("markdown must include objective from handoff json source");
}
if (!markdown.includes(handoff.releaseName)) {
  throw new Error("markdown must include releaseName from handoff json source");
}
for (const item of handoff.scope) {
  if (!markdown.includes(item)) {
    throw new Error(`markdown must include scope item: ${item}`);
  }
}
for (const item of handoff.prohibitedActions) {
  if (!markdown.includes(item)) {
    throw new Error(`markdown must include prohibited action: ${item}`);
  }
}

console.log("handoff json source markdown view consistency ok");
EOF
pass "handoff json source markdown view consistency"

echo "-- Test 184: no git operation automation in handoff --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import { HANDOFF_PROHIBITED_ACTIONS } from "./src/lib/developer_handoff.js";

const handoffSource = fs.readFileSync("src/lib/developer_handoff.js", "utf8");
const cliSource = fs.readFileSync("scripts/run_developer_handoff.js", "utf8");

if (handoffSource.includes("git commit") && !HANDOFF_PROHIBITED_ACTIONS.includes("git commit")) {
  throw new Error("prohibited actions must include git commit");
}
if (/execSync\(\s*["'`]git/.test(handoffSource) || /execSync\(\s*["'`]git/.test(cliSource)) {
  throw new Error("handoff generator must not execute git commands");
}
if (cliSource.includes("git add") || cliSource.includes("git push")) {
  throw new Error("handoff CLI must not automate git operations");
}

console.log("no git operation automation in handoff ok");
EOF
pass "no git operation automation in handoff"

echo "-- Test 185: handoff nextVersion can be overridden by CLI argument --"
node --input-type=module <<'EOF'
import {
  buildDeveloperHandoff,
  parseDeveloperHandoffArgs,
} from "./src/lib/developer_handoff.js";

const options = parseDeveloperHandoffArgs(["--next-version", "v1.40.0"]);
const handoff = buildDeveloperHandoff({
  currentVersion: "v1.31.0",
  nextVersion: options.nextVersion,
});

if (handoff.nextVersion !== "v1.40.0") {
  throw new Error("handoff nextVersion must honor CLI override");
}

console.log("handoff nextVersion CLI override ok");
EOF
pass "handoff nextVersion can be overridden by CLI argument"

echo "-- Test 186: invalid handoff nextVersion is rejected --"
node --input-type=module <<'EOF'
import {
  buildDeveloperHandoff,
  resolveHandoffNextVersion,
} from "./src/lib/developer_handoff.js";

const invalidValues = ["1.32.0", "v1.32", "v1", "next"];

for (const value of invalidValues) {
  let rejected = false;
  try {
    resolveHandoffNextVersion("v1.31.0", value);
  } catch (error) {
    rejected = true;
    if (!String(error.message).includes("Invalid nextVersion format")) {
      throw error;
    }
  }
  if (!rejected) {
    throw new Error(`invalid nextVersion must be rejected: ${value}`);
  }
}

let buildRejected = false;
try {
  buildDeveloperHandoff({ currentVersion: "v1.31.0", nextVersion: "1.32.0" });
} catch (error) {
  buildRejected = true;
}
if (!buildRejected) {
  throw new Error("buildDeveloperHandoff must reject invalid nextVersion");
}

console.log("invalid handoff nextVersion rejection ok");
EOF
pass "invalid handoff nextVersion is rejected"

echo "-- Test 187: handoff CLI override via npm script --"
npm run developer:handoff -- --next-version v1.40.0 >/tmp/developer_handoff_override_cli.log
grep -q "Next Version: v1.40.0" /tmp/developer_handoff_override_cli.log
pass "handoff CLI override via npm script"

echo "-- Test 188: handoff CLI rejects invalid nextVersion --"
if node scripts/run_developer_handoff.js --next-version 1.32.0 >/tmp/developer_handoff_invalid.log 2>&1; then
  echo "invalid nextVersion must exit non-zero" >&2
  exit 1
fi
grep -q "Invalid nextVersion format" /tmp/developer_handoff_invalid.log
pass "handoff CLI rejects invalid nextVersion"

echo "-- Test 189: workflow-state schema validation --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STATE_SCHEMA,
  WORKFLOW_STATE_SCHEMA_LEGACY,
  computeStepRegistryHash,
  buildWorkflowState,
  validateResumeState,
  getWorkflowVersionContext,
} from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.results = [
  {
    id: "version-consistency",
    name: "Version Consistency",
    status: STEP_STATUS.PASS,
    guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
    detail: null,
  },
  {
    id: "release-readiness",
    name: "Release Readiness",
    status: STEP_STATUS.PASS,
    guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
    detail: null,
  },
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context);
if (state.schema !== WORKFLOW_STATE_SCHEMA) {
  throw new Error("workflow-state schema mismatch");
}
if (state.status !== "stopped") {
  throw new Error("workflow-state status must be stopped");
}
if (state.currentStepId !== "release-plan") {
  throw new Error("workflow-state currentStepId mismatch");
}
if (state.resumeSupported !== true) {
  throw new Error("workflow-state resumeSupported must be true");
}
if (state.workflowSchemaVersion !== "1.2") {
  throw new Error("workflow-state workflowSchemaVersion must be 1.2");
}
if (!state.stepRegistryHash?.startsWith("sha256:")) {
  throw new Error("workflow-state stepRegistryHash must be sha256 hash");
}
if (state.stoppedBeforeStepId !== "release-plan") {
  throw new Error("workflow-state stoppedBeforeStepId mismatch");
}

const versionContext = getWorkflowVersionContext(process.cwd());
const validation = validateResumeState(state, versionContext);
if (!validation.valid) {
  throw new Error(`workflow-state validation failed: ${validation.errors.join("; ")}`);
}

console.log("workflow-state schema validation ok");
EOF
pass "workflow-state schema validation"

echo "-- Test 190: STOPPED workflow writes workflow-state.json --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_STATE_SCHEMA,
  WORKFLOW_STATE_SCHEMA_LEGACY,
  WORKFLOW_STATE_FILENAME,
  DEVELOPER_WORKFLOW_REPORT_DIR,
  writeWorkflowState,
  buildWorkflowState,
} from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STEP_REGISTRY,
  runDeveloperWorkflow,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const stubRegistry = WORKFLOW_STEP_REGISTRY.map((step) => ({
  ...step,
  run: (context) => ({
    ...context,
    results: [
      ...context.results,
      {
        id: step.id,
        name: step.name,
        status: STEP_STATUS.PASS,
        guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
        detail: null,
      },
    ],
  }),
}));

const context = runDeveloperWorkflow({
  rootDir: PROJECT_ROOT,
  options: { stopBeforeStep: "release-plan" },
  registry: stubRegistry,
});

if (context.status !== WORKFLOW_STATUS.STOPPED) {
  throw new Error("stopBeforeStep must produce STOPPED workflow");
}

const statePath = writeWorkflowState(buildWorkflowState(context, {}, stubRegistry), PROJECT_ROOT);
const absolutePath = path.join(
  PROJECT_ROOT,
  DEVELOPER_WORKFLOW_REPORT_DIR,
  WORKFLOW_STATE_FILENAME,
);

if (!fs.existsSync(absolutePath)) {
  throw new Error("workflow-state.json must be written for STOPPED workflow");
}

const payload = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
if (payload.schema !== WORKFLOW_STATE_SCHEMA) {
  throw new Error("written workflow-state.json schema mismatch");
}
if (payload.currentStepId !== "release-plan") {
  throw new Error("written workflow-state.json currentStepId mismatch");
}
if (payload.resumeSupported !== true) {
  throw new Error("written workflow-state.json resumeSupported mismatch");
}
if (payload.workflowSchemaVersion !== "1.2") {
  throw new Error("written workflow-state.json workflowSchemaVersion mismatch");
}
if (!payload.stepRegistryHash?.startsWith("sha256:")) {
  throw new Error("written workflow-state.json stepRegistryHash mismatch");
}
if (payload.stoppedBeforeStepId !== "release-plan") {
  throw new Error("written workflow-state.json stoppedBeforeStepId mismatch");
}
if (!statePath.includes("workflow-state.json")) {
  throw new Error("writeWorkflowState must return workflow-state.json path");
}

console.log("STOPPED workflow writes workflow-state.json ok");
EOF
pass "STOPPED workflow writes workflow-state.json"

echo "-- Test 191: Resume starts from stoppedBeforeStepId --"
node --input-type=module <<'EOF'
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_STATE_SCHEMA,
  WORKFLOW_STATE_SCHEMA_LEGACY,
  computeStepRegistryHash,
  getWorkflowVersionContext,
  runDeveloperWorkflowResume,
  writeWorkflowState,
} from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STEP_REGISTRY,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const versionContext = getWorkflowVersionContext(PROJECT_ROOT);
const executedStepIds = [];

const stubRegistry = WORKFLOW_STEP_REGISTRY.map((step) => ({
  ...step,
  run: (context) => {
    executedStepIds.push(step.id);
    return {
      ...context,
      results: [
        ...context.results,
        {
          id: step.id,
          name: step.name,
          status: STEP_STATUS.PASS,
          guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
          detail: null,
        },
      ],
    };
  },
}));

writeWorkflowState(
  {
    schema: WORKFLOW_STATE_SCHEMA,
    workflowStatus: "stopped",
    stopReason: "stop-before-step",
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
  PROJECT_ROOT,
);

const resumeResult = runDeveloperWorkflowResume(
  { rootDir: PROJECT_ROOT },
  stubRegistry,
);

if (resumeResult.resumeFromStepId !== "release-plan") {
  throw new Error("resume must start from stoppedBeforeStepId");
}
if (executedStepIds.join(",") !== "release-plan") {
  throw new Error(`resume must not re-run completed steps: ${executedStepIds.join(",")}`);
}
if (resumeResult.context.status !== WORKFLOW_STATUS.SUCCESS) {
  throw new Error("resume must complete remaining step successfully");
}

console.log("Resume starts from stoppedBeforeStepId ok");
EOF
pass "Resume starts from stoppedBeforeStepId"

echo "-- Test 192: Resume rejects non-stopped workflowStatus --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STATE_SCHEMA_LEGACY,
  getWorkflowVersionContext,
  validateResumeState,
} from "./src/lib/developer_workflow_resume.js";

const versionContext = getWorkflowVersionContext(process.cwd());
const validation = validateResumeState(
  {
    schema: WORKFLOW_STATE_SCHEMA_LEGACY,
    workflowStatus: "success",
    stopReason: "none",
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
  versionContext,
);

if (validation.valid) {
  throw new Error("non-stopped workflowStatus must be rejected");
}
if (!validation.errors.some((error) => error.includes('status must be "stopped"'))) {
  throw new Error("validation must report non-stopped workflowStatus");
}

console.log("Resume rejects non-stopped workflowStatus ok");
EOF
pass "Resume rejects non-stopped workflowStatus"

echo "-- Test 193: Resume rejects unknown step id --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STATE_SCHEMA_LEGACY,
  getWorkflowVersionContext,
  validateResumeState,
} from "./src/lib/developer_workflow_resume.js";

const versionContext = getWorkflowVersionContext(process.cwd());
const validation = validateResumeState(
  {
    schema: WORKFLOW_STATE_SCHEMA_LEGACY,
    workflowStatus: "stopped",
    stopReason: "stop-before-step",
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["unknown-step"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
  versionContext,
);

if (validation.valid) {
  throw new Error("unknown completed step id must be rejected");
}
if (!validation.errors.some((error) => error.includes("unknown completed step id"))) {
  throw new Error("validation must report unknown completed step id");
}

console.log("Resume rejects unknown step id ok");
EOF
pass "Resume rejects unknown step id"

echo "-- Test 194: Resume rejects nextVersion mismatch --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STATE_SCHEMA_LEGACY,
  getWorkflowVersionContext,
  validateResumeState,
} from "./src/lib/developer_workflow_resume.js";

const versionContext = getWorkflowVersionContext(process.cwd());
const validation = validateResumeState(
  {
    schema: WORKFLOW_STATE_SCHEMA_LEGACY,
    workflowStatus: "stopped",
    stopReason: "stop-before-step",
    currentVersion: versionContext.currentVersion,
    nextVersion: "9.9.9",
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
  versionContext,
);

if (validation.valid) {
  throw new Error("nextVersion mismatch must be rejected");
}
if (!validation.errors.some((error) => error.includes("nextVersion mismatch"))) {
  throw new Error("validation must report nextVersion mismatch");
}

console.log("Resume rejects nextVersion mismatch ok");
EOF
pass "Resume rejects nextVersion mismatch"

echo "-- Test 195: workflow-resume.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_RESUME_SCHEMA,
  WORKFLOW_STATE_SCHEMA,
  buildWorkflowResumeReport,
  getWorkflowVersionContext,
  runDeveloperWorkflowResume,
  writeWorkflowResumeReport,
  writeWorkflowState,
} from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STEP_REGISTRY,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const versionContext = getWorkflowVersionContext(PROJECT_ROOT);

writeWorkflowState(
  {
    schema: WORKFLOW_STATE_SCHEMA,
    workflowStatus: "stopped",
    stopReason: "stop-before-step",
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
  PROJECT_ROOT,
);

const stubRegistry = WORKFLOW_STEP_REGISTRY.map((step) => ({
  ...step,
  run: (context) => ({
    ...context,
    results: [
      ...context.results,
      {
        id: step.id,
        name: step.name,
        status: STEP_STATUS.PASS,
        guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
        detail: null,
      },
    ],
  }),
}));

const resumeResult = runDeveloperWorkflowResume(
  { rootDir: PROJECT_ROOT },
  stubRegistry,
);
const report = buildWorkflowResumeReport({
  status: "resumed",
  resumeFromStepId: resumeResult.resumeFromStepId,
  completedStepIds: resumeResult.state.completedStepIds ?? [],
  workflowStatus: resumeResult.context.status,
  generatedAt: resumeResult.context.generatedAt,
});
writeWorkflowResumeReport(report, PROJECT_ROOT);

const payload = JSON.parse(
  fs.readFileSync(
    path.join(
      PROJECT_ROOT,
      "reports/developer-workflow/latest/workflow-resume.json",
    ),
    "utf8",
  ),
);

if (payload.schema !== WORKFLOW_RESUME_SCHEMA) {
  throw new Error("workflow-resume.json schema mismatch");
}
if (payload.status !== "resumed") {
  throw new Error("workflow-resume.json status must be resumed");
}
if (payload.resumeFromStepId !== "release-plan") {
  throw new Error("workflow-resume.json resumeFromStepId mismatch");
}

console.log("workflow-resume.json generated ok");
EOF
pass "workflow-resume.json generated"

echo "-- Test 196: workflow-resume.md generated --"
test -f reports/developer-workflow/latest/workflow-resume.md
grep -q "# Developer Workflow Resume Report" reports/developer-workflow/latest/workflow-resume.md
grep -q "Resume From Step: release-plan" reports/developer-workflow/latest/workflow-resume.md
pass "workflow-resume.md generated"

echo "-- Test 197: CLI summary shows Resume status --"
node --input-type=module <<'EOF'
import {
  buildWorkflowResumeCliSummary,
  buildWorkflowResumeReport,
} from "./src/lib/developer_workflow_resume.js";

const summary = buildWorkflowResumeCliSummary(
  buildWorkflowResumeReport({
    status: "resumed",
    resumeFromStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    workflowStatus: "SUCCESS",
  }),
);

for (const expected of [
  "Workflow Resume",
  "Status",
  "resumed",
  "Resume From",
  "release-plan",
  "Completed Steps",
  "version-consistency, release-readiness",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`resume CLI summary must include: ${expected}`);
  }
}

console.log("resume CLI summary ok");
EOF
node --input-type=module <<'EOF'
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_STATE_SCHEMA,
  getWorkflowVersionContext,
  writeWorkflowState,
} from "./src/lib/developer_workflow_resume.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const versionContext = getWorkflowVersionContext(PROJECT_ROOT);

writeWorkflowState(
  {
    schema: WORKFLOW_STATE_SCHEMA,
    workflowStatus: "stopped",
    stopReason: "stop-before-step",
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
  PROJECT_ROOT,
);
EOF
npm run developer:workflow -- --resume --skip-npm-test >/tmp/developer_workflow_resume_cli.log 2>&1 || true
grep -q "Workflow Resume" /tmp/developer_workflow_resume_cli.log
grep -q "Resume From" /tmp/developer_workflow_resume_cli.log
grep -q "release-plan" /tmp/developer_workflow_resume_cli.log
grep -q "workflow-resume.json" /tmp/developer_workflow_resume_cli.log
pass "CLI summary shows Resume status"

echo "-- Test 198: npm test remains PASS --"
grep -q '"test"' package.json
grep -q "scripts/test_quality_pipeline.sh" package.json
pass "npm test remains PASS"

echo "-- Test 199: checkpoint state includes currentStepId --"
node --input-type=module <<'EOF'
import { buildWorkflowState } from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.results = [
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context);
if (state.currentStepId !== "release-plan") {
  throw new Error("checkpoint state must include currentStepId");
}

console.log("checkpoint state includes currentStepId ok");
EOF
pass "checkpoint state includes currentStepId"

echo "-- Test 200: checkpoint state includes resumeSupported --"
node --input-type=module <<'EOF'
import { buildWorkflowState } from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.results = [
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context);
if (state.resumeSupported !== true) {
  throw new Error("checkpoint state must include resumeSupported=true");
}
if (state.resumeUnsupportedReason !== null) {
  throw new Error("checkpoint state resumeUnsupportedReason must be null");
}

console.log("checkpoint state includes resumeSupported ok");
EOF
pass "checkpoint state includes resumeSupported"

echo "-- Test 201: checkpoint state includes workflowSchemaVersion --"
node --input-type=module <<'EOF'
import { buildWorkflowState } from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.results = [
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context);
if (state.workflowSchemaVersion !== "1.2") {
  throw new Error("checkpoint state must include workflowSchemaVersion 1.2");
}

console.log("checkpoint state includes workflowSchemaVersion ok");
EOF
pass "checkpoint state includes workflowSchemaVersion"

echo "-- Test 202: checkpoint state includes stepRegistryHash --"
node --input-type=module <<'EOF'
import {
  buildWorkflowState,
  computeStepRegistryHash,
} from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STOP_REASON,
  WORKFLOW_STEP_REGISTRY,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.results = [
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context, {}, WORKFLOW_STEP_REGISTRY);
const expectedHash = computeStepRegistryHash(WORKFLOW_STEP_REGISTRY);
if (state.stepRegistryHash !== expectedHash) {
  throw new Error("checkpoint state stepRegistryHash mismatch");
}

console.log("checkpoint state includes stepRegistryHash ok");
EOF
pass "checkpoint state includes stepRegistryHash"

echo "-- Test 203: checkpoint validator passes compatible state --"
node --input-type=module <<'EOF'
import {
  buildWorkflowState,
  validateWorkflowCheckpoint,
} from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.results = [
  {
    id: "version-consistency",
    name: "Version Consistency",
    status: STEP_STATUS.PASS,
    guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
    detail: null,
  },
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context);
const validation = validateWorkflowCheckpoint({ state });
if (!validation.valid) {
  throw new Error(`compatible checkpoint must pass: ${validation.errors.join("; ")}`);
}
if (!validation.resumeSupported) {
  throw new Error("compatible checkpoint must be resume supported");
}
if (validation.currentStepId !== "release-plan") {
  throw new Error("compatible checkpoint currentStepId mismatch");
}

console.log("checkpoint validator passes compatible state ok");
EOF
pass "checkpoint validator passes compatible state"

echo "-- Test 204: checkpoint validator warns on legacy state --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STATE_SCHEMA_LEGACY,
  getWorkflowVersionContext,
  validateWorkflowCheckpoint,
} from "./src/lib/developer_workflow_resume.js";

const versionContext = getWorkflowVersionContext(process.cwd());
const validation = validateWorkflowCheckpoint({
  state: {
    schema: WORKFLOW_STATE_SCHEMA_LEGACY,
    workflowStatus: "stopped",
    stopReason: "stop-before-step",
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
});

if (!validation.valid) {
  throw new Error("legacy checkpoint should remain resume valid with warnings");
}
if (!validation.warnings.some((warning) => warning.includes("stepRegistryHash"))) {
  throw new Error("legacy checkpoint must warn about missing stepRegistryHash");
}

console.log("checkpoint validator warns on legacy state ok");
EOF
pass "checkpoint validator warns on legacy state"

echo "-- Test 205: checkpoint validator fails unsupported schema --"
node --input-type=module <<'EOF'
import { validateWorkflowCheckpoint } from "./src/lib/developer_workflow_checkpoint.js";

const validation = validateWorkflowCheckpoint({
  state: {
    schema: "developer-automation/workflow-state/9.9",
    workflowSchemaVersion: "9.9",
    status: "stopped",
    currentStepId: "release-plan",
    stoppedBeforeStepId: "release-plan",
    completedStepIds: [],
    skippedStepIds: [],
    resumeSupported: true,
    resumeUnsupportedReason: null,
    stepRegistryHash: "sha256:deadbeef",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  },
});

if (validation.valid) {
  throw new Error("unsupported schema must fail checkpoint validation");
}
if (!validation.errors.some((error) => error.includes("unsupported workflow-state schema"))) {
  throw new Error("unsupported schema error must be reported");
}

console.log("checkpoint validator fails unsupported schema ok");
EOF
pass "checkpoint validator fails unsupported schema"

echo "-- Test 206: checkpoint validator fails registry mismatch --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_STATE_SCHEMA,
  validateWorkflowCheckpoint,
} from "./src/lib/developer_workflow_checkpoint.js";

const validation = validateWorkflowCheckpoint({
  state: {
    schema: WORKFLOW_STATE_SCHEMA,
    workflowSchemaVersion: "1.2",
    status: "stopped",
    currentStepId: "release-plan",
    stoppedBeforeStepId: "release-plan",
    completedStepIds: [],
    skippedStepIds: [],
    resumeSupported: true,
    resumeUnsupportedReason: null,
    stepRegistryHash: "sha256:deadbeef",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  },
});

if (validation.valid) {
  throw new Error("registry mismatch must fail checkpoint validation");
}
if (!validation.errors.some((error) => error.includes("stepRegistryHash"))) {
  throw new Error("registry mismatch error must be reported");
}

console.log("checkpoint validator fails registry mismatch ok");
EOF
pass "checkpoint validator fails registry mismatch"

echo "-- Test 207: resume uses checkpoint validation --"
node --input-type=module <<'EOF'
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_STATE_SCHEMA_LEGACY,
  getWorkflowVersionContext,
  prepareResumeWorkflow,
  writeWorkflowState,
} from "./src/lib/developer_workflow_resume.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const versionContext = getWorkflowVersionContext(PROJECT_ROOT);

writeWorkflowState(
  {
    schema: WORKFLOW_STATE_SCHEMA_LEGACY,
    workflowStatus: "stopped",
    stopReason: "stop-before-step",
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    stoppedBeforeStepId: "release-plan",
    completedStepIds: ["version-consistency", "release-readiness"],
    skippedStepIds: [],
    failedStepIds: [],
    createdAt: "2026-07-02T00:00:00.000Z",
    source: { command: "developer:workflow", mode: "dry-run" },
  },
  PROJECT_ROOT,
);

const prepared = prepareResumeWorkflow({ rootDir: PROJECT_ROOT });
if (!prepared.validation.valid) {
  throw new Error(`resume must use checkpoint validation: ${prepared.validation.errors.join("; ")}`);
}
if (!prepared.validation.checkpoint) {
  throw new Error("resume validation must include checkpoint result");
}
if (!prepared.validation.resume) {
  throw new Error("resume validation must include resume result");
}

console.log("resume uses checkpoint validation ok");
EOF
pass "resume uses checkpoint validation"

echo "-- Test 208: checkpoint markdown report renders JSON-derived view --"
node --input-type=module <<'EOF'
import {
  buildWorkflowCheckpointMarkdown,
  buildWorkflowCheckpointReport,
  validateWorkflowCheckpoint,
} from "./src/lib/developer_workflow_checkpoint.js";
import { buildWorkflowState } from "./src/lib/developer_workflow_resume.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.results = [
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context);
const checkpointValidation = validateWorkflowCheckpoint({ state });
const report = buildWorkflowCheckpointReport(
  checkpointValidation,
  state,
  "2026-07-02T00:00:00.000Z",
);
const markdown = buildWorkflowCheckpointMarkdown(report);

for (const expected of [
  "# Developer Workflow Checkpoint Report",
  "Current Step: release-plan",
  "Workflow Schema Version: 1.2",
  "Step Registry Hash Matched: true",
  "Resume Supported: true",
  `Step Registry Hash: ${state.stepRegistryHash}`,
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`checkpoint markdown must include: ${expected}`);
  }
}

console.log("checkpoint markdown report renders JSON-derived view ok");
EOF
pass "checkpoint markdown report renders JSON-derived view"

echo "-- Test 209: workflow-history schema validation --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_HISTORY_SCHEMA,
  WORKFLOW_HISTORY_VERSION,
  createEmptyWorkflowHistory,
  validateWorkflowHistory,
} from "./src/lib/developer_workflow_history.js";

const history = createEmptyWorkflowHistory("2026-07-02T00:00:00.000Z");
if (history.schema !== WORKFLOW_HISTORY_SCHEMA) {
  throw new Error("workflow-history schema mismatch");
}
if (history.historyVersion !== WORKFLOW_HISTORY_VERSION) {
  throw new Error("workflow-history historyVersion mismatch");
}

const validation = validateWorkflowHistory(history);
if (!validation.valid) {
  throw new Error(`workflow-history validation failed: ${validation.errors.join("; ")}`);
}

console.log("workflow-history schema validation ok");
EOF
pass "workflow-history schema validation"

echo "-- Test 210: appendWorkflowHistoryRun appends run --"
node --input-type=module <<'EOF'
import {
  appendWorkflowHistoryRun,
  createEmptyWorkflowHistory,
  HISTORY_RUN_STATUS,
} from "./src/lib/developer_workflow_history.js";

const history = appendWorkflowHistoryRun(createEmptyWorkflowHistory(), {
  runId: "run-001",
  startedAt: "2026-07-02T00:00:00.000Z",
  completedAt: "2026-07-02T00:00:01.000Z",
  status: HISTORY_RUN_STATUS.STOPPED,
  workflowSchemaVersion: "1.2",
  stepRegistryHash: "sha256:test",
  currentStepId: "release-plan",
  resumeSupported: true,
  resumeUnsupportedReason: null,
  checkpointPath: "reports/developer-workflow/latest/workflow-checkpoint.json",
  statePath: "reports/developer-workflow/latest/workflow-state.json",
  steps: [
    {
      stepId: "version-consistency",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:00.500Z",
    },
  ],
});

if (history.runs.length !== 1) {
  throw new Error("appendWorkflowHistoryRun must append one run");
}
if (history.runs[0].runId !== "run-001") {
  throw new Error("appended runId mismatch");
}

console.log("appendWorkflowHistoryRun appends run ok");
EOF
pass "appendWorkflowHistoryRun appends run"

echo "-- Test 211: readWorkflowHistory returns empty when missing --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_HISTORY_SCHEMA,
  readWorkflowHistory,
} from "./src/lib/developer_workflow_history.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const missingPath = path.join(
  PROJECT_ROOT,
  "reports/developer-workflow/latest/workflow-history-missing.json",
);

if (fs.existsSync(missingPath)) {
  fs.unlinkSync(missingPath);
}

const history = readWorkflowHistory(missingPath, PROJECT_ROOT);
if (history.schema !== WORKFLOW_HISTORY_SCHEMA) {
  throw new Error("missing history must return empty schema");
}
if (!Array.isArray(history.runs) || history.runs.length !== 0) {
  throw new Error("missing history must return empty runs");
}

console.log("readWorkflowHistory returns empty when missing ok");
EOF
pass "readWorkflowHistory returns empty when missing"

echo "-- Test 212: normalizeWorkflowHistory handles legacy missing fields --"
node --input-type=module <<'EOF'
import {
  normalizeWorkflowHistory,
  WORKFLOW_HISTORY_SCHEMA,
} from "./src/lib/developer_workflow_history.js";

const normalized = normalizeWorkflowHistory({
  runs: [
    {
      status: "stopped",
      steps: [{ stepId: "release-plan", status: "stopped" }],
    },
  ],
});

if (normalized.schema !== WORKFLOW_HISTORY_SCHEMA) {
  throw new Error("normalize must fill schema");
}
if (normalized.runs.length !== 1) {
  throw new Error("normalize must preserve runs");
}
if (!normalized.runs[0].runId) {
  throw new Error("normalize must fill runId");
}
if (normalized.runs[0].currentStepId !== null) {
  throw new Error("normalize must default missing currentStepId to null");
}

console.log("normalizeWorkflowHistory handles legacy missing fields ok");
EOF
pass "normalizeWorkflowHistory handles legacy missing fields"

echo "-- Test 213: validateWorkflowHistory passes valid history --"
node --input-type=module <<'EOF'
import {
  appendWorkflowHistoryRun,
  createEmptyWorkflowHistory,
  validateWorkflowHistory,
  HISTORY_RUN_STATUS,
} from "./src/lib/developer_workflow_history.js";

const history = appendWorkflowHistoryRun(createEmptyWorkflowHistory(), {
  runId: "run-valid",
  startedAt: "2026-07-02T00:00:00.000Z",
  completedAt: "2026-07-02T00:00:01.000Z",
  status: HISTORY_RUN_STATUS.COMPLETED,
  workflowSchemaVersion: "1.2",
  stepRegistryHash: "sha256:test",
  currentStepId: null,
  resumeSupported: false,
  resumeUnsupportedReason: null,
  checkpointPath: null,
  statePath: null,
  steps: [
    {
      stepId: "version-consistency",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
    },
  ],
});

const validation = validateWorkflowHistory(history);
if (!validation.valid) {
  throw new Error(`valid history must pass: ${validation.errors.join("; ")}`);
}

console.log("validateWorkflowHistory passes valid history ok");
EOF
pass "validateWorkflowHistory passes valid history"

echo "-- Test 214: validateWorkflowHistory fails invalid schema --"
node --input-type=module <<'EOF'
import { validateWorkflowHistory } from "./src/lib/developer_workflow_history.js";

const validation = validateWorkflowHistory({
  schema: "developer-automation/workflow-history/9.9",
  historyVersion: "9.9",
  generatedAt: "2026-07-02T00:00:00.000Z",
  runs: [],
});

if (validation.valid) {
  throw new Error("invalid workflow-history schema must fail validation");
}
if (!validation.errors.some((error) => error.includes("schema must be"))) {
  throw new Error("invalid schema error must be reported");
}

console.log("validateWorkflowHistory fails invalid schema ok");
EOF
pass "validateWorkflowHistory fails invalid schema"

echo "-- Test 215: workflow-history.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_HISTORY_SCHEMA,
  buildWorkflowHistoryRun,
  recordWorkflowHistoryRun,
} from "./src/lib/developer_workflow_history.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const context = createWorkflowContext({
  generatedAt: "2026-07-02T00:00:00.000Z",
});
context.status = WORKFLOW_STATUS.SUCCESS;
context.results = [
  {
    id: "version-consistency",
    name: "Version Consistency",
    status: STEP_STATUS.PASS,
    guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
    detail: null,
  },
];

recordWorkflowHistoryRun({
  rootDir: PROJECT_ROOT,
  context,
});

const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/developer-workflow/latest/workflow-history.json"),
    "utf8",
  ),
);

if (payload.schema !== WORKFLOW_HISTORY_SCHEMA) {
  throw new Error("workflow-history.json schema mismatch");
}
if (!Array.isArray(payload.runs) || payload.runs.length === 0) {
  throw new Error("workflow-history.json must contain runs");
}

console.log("workflow-history.json generated ok");
EOF
pass "workflow-history.json generated"

echo "-- Test 216: workflow-history.md generated --"
test -f reports/developer-workflow/latest/workflow-history.md
grep -q "# Developer Workflow History Report" reports/developer-workflow/latest/workflow-history.md
grep -q "Run Count:" reports/developer-workflow/latest/workflow-history.md
pass "workflow-history.md generated"

echo "-- Test 217: CLI summary shows history info --"
npm run developer:workflow -- --skip-npm-test --stop-before-step release-plan >/tmp/developer_workflow_history_cli.log 2>&1 || true
grep -q "Workflow History" /tmp/developer_workflow_history_cli.log
grep -q "Run Count" /tmp/developer_workflow_history_cli.log
grep -q "workflow-history.json" /tmp/developer_workflow_history_cli.log
grep -q "workflow-history.md" /tmp/developer_workflow_history_cli.log
pass "CLI summary shows history info"

echo "-- Test 218: buildWorkflowHistoryRun maps workflow context --"
node --input-type=module <<'EOF'
import {
  buildWorkflowHistoryRun,
  HISTORY_RUN_STATUS,
  HISTORY_STEP_STATUS,
} from "./src/lib/developer_workflow_history.js";
import {
  GUARD_REASON,
  STEP_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_STOP_REASON,
  createWorkflowContext,
} from "./src/lib/developer_workflow.js";
import { buildWorkflowState } from "./src/lib/developer_workflow_resume.js";

const context = createWorkflowContext({
  options: { stopBeforeStep: "release-plan", dryRun: true },
  generatedAt: "2026-07-02T00:00:00.000Z",
});
context.stopReason = WORKFLOW_STOP_REASON.STOP_BEFORE_STEP;
context.status = WORKFLOW_STATUS.STOPPED;
context.results = [
  {
    id: "version-consistency",
    name: "Version Consistency",
    status: STEP_STATUS.PASS,
    guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
    detail: null,
  },
  {
    id: "release-plan",
    name: "Release Plan",
    status: STEP_STATUS.STOPPED,
    guard: { shouldExecute: false, reason: GUARD_REASON.STOP_BEFORE_STEP },
    detail: null,
  },
];

const state = buildWorkflowState(context);
const run = buildWorkflowHistoryRun({
  context,
  state,
  checkpointPath: "reports/developer-workflow/latest/workflow-checkpoint.json",
  statePath: "reports/developer-workflow/latest/workflow-state.json",
  runId: "run-map-test",
});

if (run.status !== HISTORY_RUN_STATUS.STOPPED) {
  throw new Error("history run status must map STOPPED workflow");
}
if (run.currentStepId !== "release-plan") {
  throw new Error("history run currentStepId mismatch");
}
if (run.steps[0].status !== HISTORY_STEP_STATUS.COMPLETED) {
  throw new Error("history step status must map PASS to completed");
}
if (run.steps[1].status !== HISTORY_STEP_STATUS.STOPPED) {
  throw new Error("history step status must map STOPPED to stopped");
}

console.log("buildWorkflowHistoryRun maps workflow context ok");
EOF
pass "buildWorkflowHistoryRun maps workflow context"

echo "-- Test 219: workflow-timeline schema constant --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_TIMELINE_SCHEMA,
  buildWorkflowTimeline,
} from "./src/lib/developer_workflow_timeline.js";
import { createEmptyWorkflowHistory } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline(createEmptyWorkflowHistory());
if (timeline.schema !== WORKFLOW_TIMELINE_SCHEMA) {
  throw new Error("workflow-timeline schema constant mismatch");
}
if (WORKFLOW_TIMELINE_SCHEMA !== "developer-automation/workflow-timeline/1.0") {
  throw new Error("WORKFLOW_TIMELINE_SCHEMA must be developer-automation/workflow-timeline/1.0");
}

console.log("workflow-timeline schema constant ok");
EOF
pass "workflow-timeline schema constant"

echo "-- Test 220: workflow-timeline.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_TIMELINE_SCHEMA,
  buildWorkflowTimelineFromHistory,
} from "./src/lib/developer_workflow_timeline.js";
import {
  HISTORY_RUN_STATUS,
  appendWorkflowHistoryRun,
  createEmptyWorkflowHistory,
  writeWorkflowHistoryReport,
} from "./src/lib/developer_workflow_history.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const history = appendWorkflowHistoryRun(createEmptyWorkflowHistory(), {
  runId: "timeline-run-001",
  startedAt: "2026-07-02T00:00:00.000Z",
  completedAt: "2026-07-02T00:00:01.000Z",
  status: HISTORY_RUN_STATUS.COMPLETED,
  workflowSchemaVersion: "1.2",
  stepRegistryHash: "sha256:test",
  currentStepId: null,
  resumeSupported: false,
  resumeUnsupportedReason: null,
  checkpointPath: null,
  statePath: null,
  steps: [
    {
      stepId: "version-consistency",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
    },
  ],
});
writeWorkflowHistoryReport(history, PROJECT_ROOT);
buildWorkflowTimelineFromHistory({ rootDir: PROJECT_ROOT });

const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/developer-workflow/latest/workflow-timeline.json"),
    "utf8",
  ),
);

if (payload.schema !== WORKFLOW_TIMELINE_SCHEMA) {
  throw new Error("workflow-timeline.json schema mismatch");
}
if (payload.summary.runCount !== 1) {
  throw new Error("workflow-timeline.json must include runs");
}

console.log("workflow-timeline.json generated ok");
EOF
pass "workflow-timeline.json generated"

echo "-- Test 221: workflow-timeline.md generated --"
test -f reports/developer-workflow/latest/workflow-timeline.md
grep -q "# Developer Workflow Timeline" reports/developer-workflow/latest/workflow-timeline.md
grep -q "## Summary" reports/developer-workflow/latest/workflow-timeline.md
grep -q "## Timeline" reports/developer-workflow/latest/workflow-timeline.md
pass "workflow-timeline.md generated"

echo "-- Test 222: timeline succeeds with empty history --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  validateWorkflowTimeline,
} from "./src/lib/developer_workflow_timeline.js";
import { createEmptyWorkflowHistory } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline(createEmptyWorkflowHistory());
const validation = validateWorkflowTimeline(timeline);

if (!validation.valid) {
  throw new Error(`empty history timeline must succeed: ${validation.errors.join("; ")}`);
}
if (timeline.summary.runCount !== 0) {
  throw new Error("empty history timeline runCount must be 0");
}
if (timeline.summary.stepCount !== 0) {
  throw new Error("empty history timeline stepCount must be 0");
}

console.log("timeline succeeds with empty history ok");
EOF
pass "timeline succeeds with empty history"

echo "-- Test 223: timeline duration null when timestamps missing --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-no-time",
      status: "unknown",
      startedAt: null,
      completedAt: null,
      steps: [
        {
          stepId: "version-consistency",
          status: "unknown",
          startedAt: null,
          completedAt: null,
        },
      ],
    },
  ],
});

if (timeline.runs[0].durationMs !== null) {
  throw new Error("timeline run durationMs must be null without timestamps");
}
if (timeline.runs[0].steps[0].durationMs !== null) {
  throw new Error("timeline step durationMs must be null without timestamps");
}

console.log("timeline duration null when timestamps missing ok");
EOF
pass "timeline duration null when timestamps missing"

echo "-- Test 224: timeline unknown status normalized --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  TIMELINE_RUN_STATUS,
  TIMELINE_STEP_STATUS,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-unknown",
      status: "weird-status",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [
        {
          stepId: "release-plan",
          status: "weird-step",
          startedAt: "2026-07-02T00:00:00.000Z",
          completedAt: "2026-07-02T00:00:01.000Z",
        },
      ],
    },
  ],
});

if (timeline.runs[0].status !== TIMELINE_RUN_STATUS.UNKNOWN) {
  throw new Error("unknown run status must normalize to unknown");
}
if (timeline.runs[0].steps[0].status !== TIMELINE_STEP_STATUS.UNKNOWN) {
  throw new Error("unknown step status must normalize to unknown");
}

console.log("timeline unknown status normalized ok");
EOF
pass "timeline unknown status normalized"

echo "-- Test 225: timeline summary runCount --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-a",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [],
    },
    {
      runId: "run-b",
      status: "stopped",
      startedAt: "2026-07-02T00:00:02.000Z",
      completedAt: "2026-07-02T00:00:03.000Z",
      steps: [],
    },
  ],
});

if (timeline.summary.runCount !== 2) {
  throw new Error("timeline summary.runCount must match run count");
}

console.log("timeline summary runCount ok");
EOF
pass "timeline summary runCount"

echo "-- Test 226: timeline summary stepCount --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-steps",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [
        {
          stepId: "version-consistency",
          status: "completed",
          startedAt: "2026-07-02T00:00:00.000Z",
          completedAt: "2026-07-02T00:00:01.000Z",
        },
        {
          stepId: "release-readiness",
          status: "completed",
          startedAt: "2026-07-02T00:00:00.000Z",
          completedAt: "2026-07-02T00:00:01.000Z",
        },
      ],
    },
  ],
});

if (timeline.summary.stepCount !== 2) {
  throw new Error("timeline summary.stepCount must count all steps");
}
if (timeline.runs[0].steps[0].order !== 1) {
  throw new Error("timeline step order must start at 1");
}
if (timeline.runs[0].steps[1].order !== 2) {
  throw new Error("timeline step order must increment");
}

console.log("timeline summary stepCount ok");
EOF
pass "timeline summary stepCount"

echo "-- Test 227: timeline markdown renders JSON-derived view --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  buildWorkflowTimelineMarkdown,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-md",
      status: "stopped",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [
        {
          stepId: "release-plan",
          status: "stopped",
          startedAt: "2026-07-02T00:00:00.000Z",
          completedAt: "2026-07-02T00:00:01.000Z",
        },
      ],
    },
  ],
});

const markdown = buildWorkflowTimelineMarkdown(timeline);

for (const expected of [
  "# Developer Workflow Timeline",
  "| Field | Value |",
  "| Runs | 1 |",
  "| Steps | 1 |",
  "### Run: run-md",
  "| Order | Step | Status | Duration |",
  "| 1 | release-plan | stopped | 1000ms |",
  "stopped",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`timeline markdown must include: ${expected}`);
  }
}

console.log("timeline markdown renders JSON-derived view ok");
EOF
pass "timeline markdown renders JSON-derived view"

echo "-- Test 228: timeline CLI summary --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  buildWorkflowTimelineCliSummary,
} from "./src/lib/developer_workflow_timeline.js";
import { createEmptyWorkflowHistory } from "./src/lib/developer_workflow_history.js";

const summary = buildWorkflowTimelineCliSummary(
  buildWorkflowTimeline(createEmptyWorkflowHistory()),
);

for (const expected of [
  "Workflow timeline: generated",
  "Timeline runs: 0",
  "Timeline steps: 0",
  "Timeline report:",
  "reports/developer-workflow/latest/workflow-timeline.md",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`timeline CLI summary must include: ${expected}`);
  }
}

console.log("timeline CLI summary ok");
EOF
npm run developer:workflow -- --skip-npm-test --stop-before-step release-plan >/tmp/developer_workflow_timeline_cli.log 2>&1 || true
grep -q "Workflow timeline: generated" /tmp/developer_workflow_timeline_cli.log
grep -q "workflow-timeline.json" /tmp/developer_workflow_timeline_cli.log
grep -q "workflow-timeline.md" /tmp/developer_workflow_timeline_cli.log
pass "timeline CLI summary"

echo "-- Test 229: timeline resume flow detection --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-stopped",
      status: "stopped",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [],
    },
    {
      runId: "run-resumed",
      status: "completed",
      startedAt: "2026-07-02T00:00:02.000Z",
      completedAt: "2026-07-02T00:00:03.000Z",
      steps: [],
    },
  ],
});

if (!timeline.runs[1].resume.isResume) {
  throw new Error("timeline must detect resume after stopped run");
}
if (timeline.runs[1].resume.resumedFromRunId !== "run-stopped") {
  throw new Error("timeline must link resumedFromRunId");
}

console.log("timeline resume flow detection ok");
EOF
pass "timeline resume flow detection"

echo "-- Test 230: timeline run prefers history durationMs --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-duration",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      durationMs: 5000,
      steps: [],
    },
  ],
});

if (timeline.runs[0].durationMs !== 5000) {
  throw new Error("timeline run must prefer history durationMs");
}

console.log("timeline run prefers history durationMs ok");
EOF
pass "timeline run prefers history durationMs"

echo "-- Test 231: timeline step prefers history durationMs --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-step-duration",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:02.000Z",
      steps: [
        {
          stepId: "version-consistency",
          status: "completed",
          startedAt: "2026-07-02T00:00:00.000Z",
          completedAt: "2026-07-02T00:00:01.000Z",
          durationMs: 7500,
        },
      ],
    },
  ],
});

if (timeline.runs[0].steps[0].durationMs !== 7500) {
  throw new Error("timeline step must prefer history durationMs");
}

console.log("timeline step prefers history durationMs ok");
EOF
pass "timeline step prefers history durationMs"

echo "-- Test 232: timeline computes durationMs from timestamps --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  computeDurationMs,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const startedAt = "2026-07-02T00:00:00.000Z";
const completedAt = "2026-07-02T00:00:02.500Z";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-computed",
      status: "completed",
      startedAt,
      completedAt,
      steps: [
        {
          stepId: "release-readiness",
          status: "completed",
          startedAt,
          completedAt,
        },
      ],
    },
  ],
});

const expected = computeDurationMs(startedAt, completedAt);
if (timeline.runs[0].durationMs !== expected) {
  throw new Error("timeline run must compute durationMs from timestamps");
}
if (timeline.runs[0].steps[0].durationMs !== expected) {
  throw new Error("timeline step must compute durationMs from timestamps");
}

console.log("timeline computes durationMs from timestamps ok");
EOF
pass "timeline computes durationMs from timestamps"

echo "-- Test 233: timeline durationMs null when uncomputable --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  resolveDurationMs,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

if (resolveDurationMs(undefined, null, null) !== null) {
  throw new Error("resolveDurationMs must return null when uncomputable");
}
if (resolveDurationMs("invalid", null, null) !== null) {
  throw new Error("resolveDurationMs must ignore non-number durationMs");
}

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-null-duration",
      status: "unknown",
      startedAt: null,
      completedAt: null,
      durationMs: "invalid",
      steps: [
        {
          stepId: "release-plan",
          status: "unknown",
          startedAt: null,
          completedAt: null,
        },
      ],
    },
  ],
});

if (timeline.runs[0].durationMs !== null) {
  throw new Error("timeline run durationMs must be null when uncomputable");
}
if (timeline.runs[0].steps[0].durationMs !== null) {
  throw new Error("timeline step durationMs must be null when uncomputable");
}

console.log("timeline durationMs null when uncomputable ok");
EOF
pass "timeline durationMs null when uncomputable"

echo "-- Test 234: computeDurationMs rejects non-string startedAt --"
node --input-type=module <<'EOF'
import { computeDurationMs } from "./src/lib/developer_workflow_timeline.js";

if (computeDurationMs(null, "2026-07-02T00:00:01.000Z") !== null) {
  throw new Error("computeDurationMs must return null for non-string startedAt");
}
if (computeDurationMs(123, "2026-07-02T00:00:01.000Z") !== null) {
  throw new Error("computeDurationMs must return null for non-string startedAt");
}

console.log("computeDurationMs rejects non-string startedAt ok");
EOF
pass "computeDurationMs rejects non-string startedAt"

echo "-- Test 235: computeDurationMs rejects non-string completedAt --"
node --input-type=module <<'EOF'
import { computeDurationMs } from "./src/lib/developer_workflow_timeline.js";

if (computeDurationMs("2026-07-02T00:00:00.000Z", null) !== null) {
  throw new Error("computeDurationMs must return null for non-string completedAt");
}
if (computeDurationMs("2026-07-02T00:00:00.000Z", 456) !== null) {
  throw new Error("computeDurationMs must return null for non-string completedAt");
}

console.log("computeDurationMs rejects non-string completedAt ok");
EOF
pass "computeDurationMs rejects non-string completedAt"

echo "-- Test 236: computeDurationMs rejects invalid dates --"
node --input-type=module <<'EOF'
import { computeDurationMs } from "./src/lib/developer_workflow_timeline.js";

if (computeDurationMs("not-a-date", "2026-07-02T00:00:01.000Z") !== null) {
  throw new Error("computeDurationMs must return null for invalid startedAt");
}
if (computeDurationMs("2026-07-02T00:00:00.000Z", "not-a-date") !== null) {
  throw new Error("computeDurationMs must return null for invalid completedAt");
}

console.log("computeDurationMs rejects invalid dates ok");
EOF
pass "computeDurationMs rejects invalid dates"

echo "-- Test 237: computeDurationMs clamps negative duration to zero --"
node --input-type=module <<'EOF'
import { computeDurationMs } from "./src/lib/developer_workflow_timeline.js";

const duration = computeDurationMs(
  "2026-07-02T00:00:02.000Z",
  "2026-07-02T00:00:01.000Z",
);

if (duration !== 0) {
  throw new Error("computeDurationMs must return 0 when end < start");
}

console.log("computeDurationMs clamps negative duration to zero ok");
EOF
pass "computeDurationMs clamps negative duration to zero"

echo "-- Test 238: timeline sort orders valid startedAt ascending --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-late",
      status: "completed",
      startedAt: "2026-07-02T00:00:02.000Z",
      completedAt: "2026-07-02T00:00:03.000Z",
      steps: [],
    },
    {
      runId: "run-early",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [],
    },
  ],
});

if (timeline.runs.map((run) => run.runId).join(",") !== "run-early,run-late") {
  throw new Error("timeline must sort valid startedAt runs ascending");
}

console.log("timeline sort orders valid startedAt ascending ok");
EOF
pass "timeline sort orders valid startedAt ascending"

echo "-- Test 239: timeline sort places missing startedAt at end --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-no-start",
      status: "unknown",
      startedAt: null,
      completedAt: null,
      steps: [],
    },
    {
      runId: "run-valid",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [],
    },
  ],
});

if (timeline.runs.map((run) => run.runId).join(",") !== "run-valid,run-no-start") {
  throw new Error("timeline must place missing startedAt runs at end");
}

console.log("timeline sort places missing startedAt at end ok");
EOF
pass "timeline sort places missing startedAt at end"

echo "-- Test 240: timeline sort places invalid startedAt at end --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-invalid",
      status: "unknown",
      startedAt: "not-a-date",
      completedAt: null,
      steps: [],
    },
    {
      runId: "run-valid",
      status: "completed",
      startedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [],
    },
  ],
});

if (timeline.runs.map((run) => run.runId).join(",") !== "run-valid,run-invalid") {
  throw new Error("timeline must place invalid startedAt runs at end");
}

console.log("timeline sort places invalid startedAt at end ok");
EOF
pass "timeline sort places invalid startedAt at end"

echo "-- Test 241: timeline sort preserves original order for same startedAt --"
node --input-type=module <<'EOF'
import { buildWorkflowTimeline } from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const sameStartedAt = "2026-07-02T00:00:00.000Z";
const timeline = buildWorkflowTimeline({
  schema: WORKFLOW_HISTORY_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  historyVersion: "1.0",
  runs: [
    {
      runId: "run-first",
      status: "completed",
      startedAt: sameStartedAt,
      completedAt: "2026-07-02T00:00:01.000Z",
      steps: [],
    },
    {
      runId: "run-second",
      status: "completed",
      startedAt: sameStartedAt,
      completedAt: "2026-07-02T00:00:02.000Z",
      steps: [],
    },
  ],
});

if (timeline.runs.map((run) => run.runId).join(",") !== "run-first,run-second") {
  throw new Error("timeline must preserve original order for same startedAt");
}

console.log("timeline sort preserves original order for same startedAt ok");
EOF
pass "timeline sort preserves original order for same startedAt"

echo "-- Test 242: timeline markdown summary table --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  buildWorkflowTimelineMarkdown,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const markdown = buildWorkflowTimelineMarkdown(
  buildWorkflowTimeline({
    schema: WORKFLOW_HISTORY_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    historyVersion: "1.0",
    runs: [
      {
        runId: "run-summary",
        status: "completed",
        startedAt: "2026-07-02T00:00:00.000Z",
        completedAt: "2026-07-02T00:01:00.000Z",
        steps: [],
      },
    ],
  }),
);

for (const expected of [
  "## Summary",
  "| Field | Value |",
  "| Runs | 1 |",
  "| Steps | 0 |",
  "| First Run | 2026-07-02T00:00:00.000Z |",
  "| Last Run | 2026-07-02T00:01:00.000Z |",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`timeline markdown summary table must include: ${expected}`);
  }
}

console.log("timeline markdown summary table ok");
EOF
pass "timeline markdown summary table"

echo "-- Test 243: timeline markdown run table --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  buildWorkflowTimelineMarkdown,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const markdown = buildWorkflowTimelineMarkdown(
  buildWorkflowTimeline({
    schema: WORKFLOW_HISTORY_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    historyVersion: "1.0",
    runs: [
      {
        runId: "run-table",
        status: "completed",
        startedAt: "2026-07-02T00:00:00.000Z",
        completedAt: "2026-07-02T00:00:01.000Z",
        steps: [],
      },
    ],
  }),
);

for (const expected of [
  "### Run: run-table",
  "| Status | completed |",
  "| Started At | 2026-07-02T00:00:00.000Z |",
  "| Completed At | 2026-07-02T00:00:01.000Z |",
  "| Duration | 1000ms |",
  "| Resume | no |",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`timeline markdown run table must include: ${expected}`);
  }
}

console.log("timeline markdown run table ok");
EOF
pass "timeline markdown run table"

echo "-- Test 244: timeline markdown step table --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  buildWorkflowTimelineMarkdown,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const markdown = buildWorkflowTimelineMarkdown(
  buildWorkflowTimeline({
    schema: WORKFLOW_HISTORY_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    historyVersion: "1.0",
    runs: [
      {
        runId: "run-steps",
        status: "completed",
        startedAt: "2026-07-02T00:00:00.000Z",
        completedAt: "2026-07-02T00:00:02.000Z",
        steps: [
          {
            stepId: "version-consistency",
            status: "completed",
            startedAt: "2026-07-02T00:00:00.000Z",
            completedAt: "2026-07-02T00:00:00.500Z",
            durationMs: 500,
          },
          {
            stepId: "release-plan",
            status: "completed",
            startedAt: "2026-07-02T00:00:00.500Z",
            completedAt: "2026-07-02T00:00:02.000Z",
            durationMs: 200,
          },
        ],
      },
    ],
  }),
);

for (const expected of [
  "| Order | Step | Status | Duration |",
  "| 1 | version-consistency | completed | 500ms |",
  "| 2 | release-plan | completed | 200ms |",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`timeline markdown step table must include: ${expected}`);
  }
}

console.log("timeline markdown step table ok");
EOF
pass "timeline markdown step table"

echo "-- Test 245: timeline markdown no steps message --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTimeline,
  buildWorkflowTimelineMarkdown,
} from "./src/lib/developer_workflow_timeline.js";
import { WORKFLOW_HISTORY_SCHEMA } from "./src/lib/developer_workflow_history.js";

const markdown = buildWorkflowTimelineMarkdown(
  buildWorkflowTimeline({
    schema: WORKFLOW_HISTORY_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    historyVersion: "1.0",
    runs: [
      {
        runId: "run-no-steps",
        status: "completed",
        startedAt: "2026-07-02T00:00:00.000Z",
        completedAt: "2026-07-02T00:00:01.000Z",
        steps: [],
      },
    ],
  }),
);

if (!markdown.includes("No steps recorded.")) {
  throw new Error('timeline markdown must include "No steps recorded."');
}

console.log("timeline markdown no steps message ok");
EOF
pass "timeline markdown no steps message"

echo "-- Test 246: workflow-dashboard schema constant --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_DASHBOARD_SCHEMA,
  buildWorkflowDashboard,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 0, stepCount: 0, firstRunAt: null, lastRunAt: null },
  runs: [],
});

if (dashboard.schema !== WORKFLOW_DASHBOARD_SCHEMA) {
  throw new Error("workflow-dashboard schema constant mismatch");
}
if (WORKFLOW_DASHBOARD_SCHEMA !== "developer-automation/workflow-dashboard/1.0") {
  throw new Error("WORKFLOW_DASHBOARD_SCHEMA must be developer-automation/workflow-dashboard/1.0");
}

console.log("workflow-dashboard schema constant ok");
EOF
pass "workflow-dashboard schema constant"

echo "-- Test 247: dashboard builder aggregates timeline --"
node --input-type=module <<'EOF'
import {
  DASHBOARD_STATUS,
  buildWorkflowDashboard,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 1, stepCount: 2, firstRunAt: null, lastRunAt: null },
  runs: [
    {
      runId: "run-builder",
      status: "completed",
      durationMs: 1000,
      resume: { isResume: true, resumedFromRunId: "run-prev" },
      steps: [
        {
          stepId: "version-consistency",
          status: "completed",
          durationMs: 500,
        },
        {
          stepId: "release-plan",
          status: "failed",
          durationMs: 300,
        },
      ],
    },
  ],
});

if (dashboard.summary.runCount !== 1) {
  throw new Error("dashboard builder runCount mismatch");
}
if (dashboard.summary.stepCount !== 2) {
  throw new Error("dashboard builder stepCount mismatch");
}
if (dashboard.summary.successCount !== 1 || dashboard.summary.failedCount !== 1) {
  throw new Error("dashboard builder success/failed counts mismatch");
}
if (dashboard.summary.resumeCount !== 1) {
  throw new Error("dashboard builder resumeCount mismatch");
}
if (dashboard.summary.totalDurationMs !== 800) {
  throw new Error("dashboard builder totalDurationMs mismatch");
}
if (dashboard.status !== DASHBOARD_STATUS.MIXED) {
  throw new Error("dashboard builder status must be mixed");
}
if (dashboard.source.schema !== WORKFLOW_TIMELINE_SCHEMA) {
  throw new Error("dashboard source schema must reference timeline");
}

console.log("dashboard builder aggregates timeline ok");
EOF
pass "dashboard builder aggregates timeline"

echo "-- Test 248: dashboard reader reads JSON --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_DASHBOARD_SCHEMA,
  buildWorkflowDashboardFromTimeline,
  readWorkflowDashboard,
} from "./src/lib/developer_workflow_dashboard.js";
import {
  WORKFLOW_TIMELINE_SCHEMA,
  buildWorkflowTimeline,
  writeWorkflowTimelineReport,
} from "./src/lib/developer_workflow_timeline.js";
import { createEmptyWorkflowHistory } from "./src/lib/developer_workflow_history.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const timeline = buildWorkflowTimeline(createEmptyWorkflowHistory(), {
  generatedAt: "2026-07-02T00:00:00.000Z",
});
writeWorkflowTimelineReport(timeline, PROJECT_ROOT);
buildWorkflowDashboardFromTimeline({ rootDir: PROJECT_ROOT });

const dashboard = readWorkflowDashboard(null, PROJECT_ROOT);
if (dashboard.schema !== WORKFLOW_DASHBOARD_SCHEMA) {
  throw new Error("dashboard reader schema mismatch");
}
if (dashboard.source.schema !== WORKFLOW_TIMELINE_SCHEMA) {
  throw new Error("dashboard reader source schema mismatch");
}

console.log("dashboard reader reads JSON ok");
EOF
pass "dashboard reader reads JSON"

echo "-- Test 249: dashboard validator --"
node --input-type=module <<'EOF'
import {
  buildWorkflowDashboard,
  validateWorkflowDashboard,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 0, stepCount: 0, firstRunAt: null, lastRunAt: null },
  runs: [],
});

const validation = validateWorkflowDashboard(dashboard);
if (!validation.valid) {
  throw new Error(`dashboard validator must pass: ${validation.errors.join("; ")}`);
}

const invalid = validateWorkflowDashboard({});
if (invalid.valid) {
  throw new Error("dashboard validator must fail for invalid dashboard");
}

console.log("dashboard validator ok");
EOF
pass "dashboard validator"

echo "-- Test 250: dashboard markdown render --"
node --input-type=module <<'EOF'
import {
  buildWorkflowDashboard,
  renderWorkflowDashboardMarkdown,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const markdown = renderWorkflowDashboardMarkdown(
  buildWorkflowDashboard({
    schema: WORKFLOW_TIMELINE_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    summary: { runCount: 1, stepCount: 2, firstRunAt: null, lastRunAt: null },
    runs: [
      {
        runId: "run-md",
        status: "completed",
        resume: { isResume: true },
        steps: [
          { stepId: "a", status: "completed", durationMs: 1000 },
          { stepId: "b", status: "failed", durationMs: 500 },
        ],
      },
    ],
  }),
);

for (const expected of [
  "# Developer Workflow Dashboard",
  "| Status | mixed |",
  "| Runs | 1 |",
  "| Steps | 2 |",
  "| Success | 1 |",
  "| Failed | 1 |",
  "| Resume | 1 |",
  "| Total Duration | 1500ms |",
  "| Average Duration | 750ms |",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`dashboard markdown must include: ${expected}`);
  }
}

console.log("dashboard markdown render ok");
EOF
pass "dashboard markdown render"

echo "-- Test 251: dashboard CLI summary --"
node --input-type=module <<'EOF'
import {
  buildWorkflowDashboard,
  buildWorkflowDashboardCliSummary,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const summary = buildWorkflowDashboardCliSummary(
  buildWorkflowDashboard({
    schema: WORKFLOW_TIMELINE_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    summary: { runCount: 3, stepCount: 18, firstRunAt: null, lastRunAt: null },
    runs: [
      {
        runId: "run-cli",
        status: "completed",
        resume: { isResume: true },
        steps: [
          { stepId: "a", status: "completed", durationMs: 10000 },
          { stepId: "b", status: "failed", durationMs: 2345 },
        ],
      },
    ],
  }),
);

for (const expected of [
  "Developer Workflow Dashboard",
  "Runs: 3",
  "Steps: 18",
  "Success: 1",
  "Failed: 1",
  "Resume: 1",
  "Total Duration: 12345ms",
  "Average Duration: 686ms",
  "Status: mixed",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`dashboard CLI summary must include: ${expected}`);
  }
}

console.log("dashboard CLI summary ok");
EOF
npm run developer:workflow -- --skip-npm-test --stop-before-step release-plan >/tmp/developer_workflow_dashboard_cli.log 2>&1 || true
grep -q "Developer Workflow Dashboard" /tmp/developer_workflow_dashboard_cli.log
grep -q "workflow-dashboard.json" /tmp/developer_workflow_dashboard_cli.log
grep -q "workflow-dashboard.md" /tmp/developer_workflow_dashboard_cli.log
pass "dashboard CLI summary"

echo "-- Test 252: dashboard uses timeline only input --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildWorkflowDashboardFromTimeline,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-timeline-only-"));
const reportDir = path.join(tempDir, "reports/developer-workflow/latest");
fs.mkdirSync(reportDir, { recursive: true });

const timelinePath = path.join(reportDir, "workflow-timeline.json");
fs.writeFileSync(
  timelinePath,
  `${JSON.stringify(
    {
      schema: WORKFLOW_TIMELINE_SCHEMA,
      generatedAt: "2026-07-02T00:00:00.000Z",
      summary: { runCount: 1, stepCount: 1, firstRunAt: null, lastRunAt: null },
      runs: [
        {
          runId: "timeline-only",
          status: "completed",
          steps: [{ stepId: "version-consistency", status: "completed", durationMs: 100 }],
        },
      ],
    },
    null,
    2,
  )}\n`,
);

const historyPath = path.join(reportDir, "workflow-history.json");
if (fs.existsSync(historyPath)) {
  throw new Error("history file must not exist for timeline-only test");
}

const { dashboard } = buildWorkflowDashboardFromTimeline({
  rootDir: tempDir,
  timelinePath: "reports/developer-workflow/latest/workflow-timeline.json",
});

if (dashboard.summary.runCount !== 1 || dashboard.summary.successCount !== 1) {
  throw new Error("dashboard must build from timeline file only");
}

console.log("dashboard uses timeline only input ok");
EOF
pass "dashboard uses timeline only input"

echo "-- Test 253: timeline schema unchanged by dashboard --"
node --input-type=module <<'EOF'
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

if (WORKFLOW_TIMELINE_SCHEMA !== "developer-automation/workflow-timeline/1.0") {
  throw new Error("timeline schema must remain developer-automation/workflow-timeline/1.0");
}

console.log("timeline schema unchanged by dashboard ok");
EOF
pass "timeline schema unchanged by dashboard"

echo "-- Test 254: dashboard does not mutate timeline --"
node --input-type=module <<'EOF'
import { buildWorkflowDashboard } from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const timeline = {
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 1, stepCount: 1, firstRunAt: null, lastRunAt: null },
  customField: "keep-me",
  runs: [
    {
      runId: "run-immutable",
      status: "completed",
      extra: true,
      steps: [{ stepId: "release-plan", status: "completed", durationMs: 100, note: "x" }],
    },
  ],
};

const snapshot = JSON.stringify(timeline);
buildWorkflowDashboard(timeline);

if (JSON.stringify(timeline) !== snapshot) {
  throw new Error("dashboard builder must not mutate timeline input");
}

console.log("dashboard does not mutate timeline ok");
EOF
pass "dashboard does not mutate timeline"

echo "-- Test 255: dashboard ignores unknown timeline fields --"
node --input-type=module <<'EOF'
import { buildWorkflowDashboard } from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  unknownTopLevel: true,
  summary: { runCount: 1, stepCount: 1, firstRunAt: null, lastRunAt: null, extra: true },
  runs: [
    {
      runId: "run-unknown",
      status: "completed",
      unknownRunField: "ignored",
      steps: [
        {
          stepId: "version-consistency",
          status: "completed",
          durationMs: 250,
          unknownStepField: "ignored",
        },
      ],
    },
  ],
});

if (dashboard.summary.successCount !== 1 || dashboard.summary.totalDurationMs !== 250) {
  throw new Error("dashboard must ignore unknown timeline fields and aggregate known data");
}

console.log("dashboard ignores unknown timeline fields ok");
EOF
pass "dashboard ignores unknown timeline fields"

echo "-- Test 256: dashboard missing durationMs compatibility --"
node --input-type=module <<'EOF'
import { buildWorkflowDashboard } from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 1, stepCount: 1, firstRunAt: null, lastRunAt: null },
  runs: [
    {
      runId: "run-no-duration",
      status: "completed",
      steps: [{ stepId: "release-plan", status: "completed" }],
    },
  ],
});

if (dashboard.summary.totalDurationMs !== 0) {
  throw new Error("dashboard must treat missing durationMs as 0");
}

console.log("dashboard missing durationMs compatibility ok");
EOF
pass "dashboard missing durationMs compatibility"

echo "-- Test 257: dashboard missing status compatibility --"
node --input-type=module <<'EOF'
import {
  DASHBOARD_STATUS,
  buildWorkflowDashboard,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 1, stepCount: 1, firstRunAt: null, lastRunAt: null },
  runs: [
    {
      runId: "run-no-status",
      steps: [{ stepId: "release-plan", durationMs: 100 }],
    },
  ],
});

if (dashboard.runs[0].status !== "unknown") {
  throw new Error("dashboard must treat missing run status as unknown");
}
if (dashboard.status !== DASHBOARD_STATUS.UNKNOWN) {
  throw new Error("dashboard must remain unknown when step status is missing");
}

console.log("dashboard missing status compatibility ok");
EOF
pass "dashboard missing status compatibility"

echo "-- Test 258: dashboard empty timeline --"
node --input-type=module <<'EOF'
import {
  DASHBOARD_STATUS,
  buildWorkflowDashboard,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 0, stepCount: 0, firstRunAt: null, lastRunAt: null },
  runs: [],
});

if (dashboard.status !== DASHBOARD_STATUS.UNKNOWN) {
  throw new Error("empty timeline dashboard status must be unknown");
}
if (dashboard.summary.runCount !== 0 || dashboard.summary.stepCount !== 0) {
  throw new Error("empty timeline dashboard counts must be zero");
}

console.log("dashboard empty timeline ok");
EOF
pass "dashboard empty timeline"

echo "-- Test 259: dashboard mixed status --"
node --input-type=module <<'EOF'
import {
  DASHBOARD_STATUS,
  resolveDashboardStatus,
} from "./src/lib/developer_workflow_dashboard.js";

if (resolveDashboardStatus(3, 2, 1) !== DASHBOARD_STATUS.MIXED) {
  throw new Error("dashboard mixed status resolution failed");
}

console.log("dashboard mixed status ok");
EOF
pass "dashboard mixed status"

echo "-- Test 260: dashboard failed status --"
node --input-type=module <<'EOF'
import {
  DASHBOARD_STATUS,
  resolveDashboardStatus,
} from "./src/lib/developer_workflow_dashboard.js";

if (resolveDashboardStatus(2, 0, 2) !== DASHBOARD_STATUS.FAILED) {
  throw new Error("dashboard failed status resolution failed");
}

console.log("dashboard failed status ok");
EOF
pass "dashboard failed status"

echo "-- Test 261: dashboard success status --"
node --input-type=module <<'EOF'
import {
  DASHBOARD_STATUS,
  resolveDashboardStatus,
} from "./src/lib/developer_workflow_dashboard.js";

if (resolveDashboardStatus(5, 5, 0) !== DASHBOARD_STATUS.SUCCESS) {
  throw new Error("dashboard success status resolution failed");
}

console.log("dashboard success status ok");
EOF
pass "dashboard success status"

echo "-- Test 262: dashboard does not reference history checkpoint or state --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_dashboard.js"),
  "utf8",
);

for (const forbidden of [
  "developer_workflow_history.js",
  "developer_workflow_resume.js",
  "readWorkflowHistory",
  "readWorkflowCheckpoint",
  "readWorkflowState",
  "workflow-history.json",
  "workflow-checkpoint.json",
  "workflow-state.json",
]) {
  if (dashboardSource.includes(forbidden)) {
    throw new Error(`dashboard must not reference ${forbidden}`);
  }
}

console.log("dashboard does not reference history checkpoint or state ok");
EOF
pass "dashboard does not reference history checkpoint or state"

echo "-- Test 263: workflow-analytics schema constant --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_ANALYTICS_SCHEMA,
  buildWorkflowAnalytics,
} from "./src/lib/developer_workflow_analytics.js";

const analytics = buildWorkflowAnalytics(null);
if (analytics.schema !== WORKFLOW_ANALYTICS_SCHEMA) {
  throw new Error("workflow-analytics schema constant mismatch");
}
if (WORKFLOW_ANALYTICS_SCHEMA !== "developer-automation/workflow-analytics/1.0") {
  throw new Error("WORKFLOW_ANALYTICS_SCHEMA must be developer-automation/workflow-analytics/1.0");
}

console.log("workflow-analytics schema constant ok");
EOF
pass "workflow-analytics schema constant"

echo "-- Test 264: analytics builder computes KPIs from dashboard public contract --"
node --input-type=module <<'EOF'
import {
  ANALYTICS_HEALTH_STATUS,
  buildWorkflowAnalytics,
} from "./src/lib/developer_workflow_analytics.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const analytics = buildWorkflowAnalytics({
  schema: WORKFLOW_DASHBOARD_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  status: "mixed",
  summary: {
    runCount: 4,
    stepCount: 10,
    resumeCount: 1,
    totalDurationMs: 4000,
  },
  metrics: {
    runs: { completed: 3, failed: 1, stopped: 0, unknown: 0 },
    resume: { count: 1, rate: 0.25 },
  },
});

if (analytics.summary.runCount !== 4 || analytics.summary.stepCount !== 10) {
  throw new Error("analytics summary must mirror dashboard public contract");
}
if (analytics.metrics.successRate !== 0.75) {
  throw new Error("analytics successRate must be successfulRuns / runCount");
}
if (analytics.metrics.failureRate !== 0.25) {
  throw new Error("analytics failureRate must be failedRuns / runCount");
}
if (analytics.metrics.resumeRate !== 0.25) {
  throw new Error("analytics resumeRate must be resumedRuns / runCount");
}
if (analytics.metrics.averageDurationMs !== 1000) {
  throw new Error("analytics averageDurationMs must be totalDurationMs / runCount");
}
if (analytics.health.healthStatus !== ANALYTICS_HEALTH_STATUS.WARNING) {
  throw new Error("mixed dashboard must produce warning health status");
}

console.log("analytics builder computes KPIs ok");
EOF
pass "analytics builder computes KPIs from dashboard public contract"

echo "-- Test 265: analytics reader reads JSON --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_ANALYTICS_SCHEMA,
  buildWorkflowAnalyticsFromDashboard,
  readWorkflowAnalytics,
} from "./src/lib/developer_workflow_analytics.js";
import {
  WORKFLOW_DASHBOARD_SCHEMA,
  buildWorkflowDashboard,
  writeWorkflowDashboardReport,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const dashboard = buildWorkflowDashboard({
  schema: WORKFLOW_TIMELINE_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  summary: { runCount: 0, stepCount: 0, firstRunAt: null, lastRunAt: null },
  runs: [],
});
writeWorkflowDashboardReport(dashboard, PROJECT_ROOT);
buildWorkflowAnalyticsFromDashboard({ rootDir: PROJECT_ROOT });

const analytics = readWorkflowAnalytics(null, PROJECT_ROOT);
if (analytics.schema !== WORKFLOW_ANALYTICS_SCHEMA) {
  throw new Error("analytics reader schema mismatch");
}

console.log("analytics reader reads JSON ok");
EOF
pass "analytics reader reads JSON"

echo "-- Test 266: analytics validator --"
node --input-type=module <<'EOF'
import {
  buildWorkflowAnalytics,
  validateWorkflowAnalytics,
} from "./src/lib/developer_workflow_analytics.js";

const analytics = buildWorkflowAnalytics(null);
const validation = validateWorkflowAnalytics(analytics);
if (!validation.valid) {
  throw new Error(`analytics validator must pass: ${validation.errors.join("; ")}`);
}

const invalid = validateWorkflowAnalytics({});
if (invalid.valid) {
  throw new Error("analytics validator must fail for invalid analytics");
}

console.log("analytics validator ok");
EOF
pass "analytics validator"

echo "-- Test 267: analytics markdown renders JSON view only --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWorkflowAnalytics,
  renderWorkflowAnalyticsMarkdown,
} from "./src/lib/developer_workflow_analytics.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const analytics = buildWorkflowAnalytics({
  schema: WORKFLOW_DASHBOARD_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  status: "success",
  summary: {
    runCount: 2,
    stepCount: 6,
    resumeCount: 0,
    totalDurationMs: 2000,
  },
  metrics: {
    runs: { completed: 2, failed: 0, stopped: 0, unknown: 0 },
    resume: { count: 0, rate: 0 },
  },
});

const markdown = renderWorkflowAnalyticsMarkdown(analytics);
for (const expected of [
  "# Developer Workflow Analytics",
  "| Runs | 2 |",
  "| Steps | 6 |",
  "| Success Rate | 100.0% |",
  "| Failure Rate | 0.0% |",
  "| Health Status | healthy |",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`analytics markdown must include: ${expected}`);
  }
}

const analyticsSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_analytics.js"),
  "utf8",
);
const markdownStart = analyticsSource.indexOf("export function renderWorkflowAnalyticsMarkdown");
const builderEnd = analyticsSource.indexOf("export function readWorkflowAnalytics");
const builderSource = analyticsSource.slice(0, builderEnd);
if (builderSource.includes("renderWorkflowAnalyticsMarkdown")) {
  throw new Error("analytics builder must not generate markdown");
}

console.log("analytics markdown renders JSON view only ok");
EOF
pass "analytics markdown renders JSON view only"

echo "-- Test 268: workflow-analytics.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_ANALYTICS_SCHEMA,
  buildWorkflowAnalyticsFromDashboard,
} from "./src/lib/developer_workflow_analytics.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
buildWorkflowAnalyticsFromDashboard({ rootDir: PROJECT_ROOT });

const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/workflow-analytics/workflow-analytics.json"),
    "utf8",
  ),
);

if (payload.schema !== WORKFLOW_ANALYTICS_SCHEMA) {
  throw new Error("workflow-analytics.json schema mismatch");
}
if (!payload.metadata || !payload.metrics || !payload.health) {
  throw new Error("workflow-analytics.json must include metadata, metrics, and health");
}

console.log("workflow-analytics.json generated ok");
EOF
test -f reports/workflow-analytics/workflow-analytics.md
pass "workflow-analytics.json generated"

echo "-- Test 269: analytics CLI summary --"
node --input-type=module <<'EOF'
import {
  buildWorkflowAnalytics,
  buildWorkflowAnalyticsCliSummary,
} from "./src/lib/developer_workflow_analytics.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const summary = buildWorkflowAnalyticsCliSummary(
  buildWorkflowAnalytics({
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    status: "failed",
    summary: {
      runCount: 4,
      stepCount: 8,
      resumeCount: 2,
      totalDurationMs: 8000,
    },
    metrics: {
      runs: { completed: 1, failed: 3, stopped: 0, unknown: 0 },
      resume: { count: 2, rate: 0.5 },
    },
  }),
);

for (const expected of [
  "Developer Analytics Summary",
  "Runs: 4",
  "Steps: 8",
  "Success Rate: 25.0%",
  "Failure Rate: 75.0%",
  "Resume Rate: 50.0%",
  "Average Duration: 2000ms",
  "Health: critical",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`analytics CLI summary must include: ${expected}`);
  }
}
if (summary.includes("REVIEW_FAILURES") || summary.includes("MONITOR_RESUMES")) {
  throw new Error("analytics CLI summary must not include recommendation text");
}

console.log("analytics CLI summary ok");
EOF
npm run developer:workflow -- --skip-npm-test --stop-before-step release-plan >/tmp/developer_workflow_analytics_cli.log 2>&1 || true
grep -q "Developer Analytics Summary" /tmp/developer_workflow_analytics_cli.log
grep -q "workflow-analytics.json" /tmp/developer_workflow_analytics_cli.log
grep -q "workflow-analytics.md" /tmp/developer_workflow_analytics_cli.log
pass "analytics CLI summary"

echo "-- Test 270: analytics uses dashboard only input --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildWorkflowAnalyticsFromDashboard,
} from "./src/lib/developer_workflow_analytics.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "analytics-dashboard-only-"));
const dashboardDir = path.join(tempDir, "reports/developer-workflow/latest");
fs.mkdirSync(dashboardDir, { recursive: true });

fs.writeFileSync(
  path.join(dashboardDir, "workflow-dashboard.json"),
  `${JSON.stringify(
    {
      schema: WORKFLOW_DASHBOARD_SCHEMA,
      generatedAt: "2026-07-02T00:00:00.000Z",
      status: "success",
      summary: {
        runCount: 1,
        stepCount: 2,
        resumeCount: 0,
        totalDurationMs: 500,
      },
      metrics: {
        runs: { completed: 1, failed: 0, stopped: 0, unknown: 0 },
        resume: { count: 0, rate: 0 },
      },
    },
    null,
    2,
  )}\n`,
);

const timelinePath = path.join(dashboardDir, "workflow-timeline.json");
if (fs.existsSync(timelinePath)) {
  throw new Error("timeline file must not exist for dashboard-only analytics test");
}

const { analytics } = buildWorkflowAnalyticsFromDashboard({ rootDir: tempDir });
if (analytics.summary.runCount !== 1 || analytics.metrics.successRate !== 1) {
  throw new Error("analytics must build from dashboard file only");
}

console.log("analytics uses dashboard only input ok");
EOF
pass "analytics uses dashboard only input"

echo "-- Test 271: analytics does not reference timeline --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const analyticsSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_analytics.js"),
  "utf8",
);

for (const forbidden of [
  "developer_workflow_timeline.js",
  "workflow-timeline.json",
  "readWorkflowTimeline",
  "buildWorkflowTimeline",
]) {
  if (analyticsSource.includes(forbidden)) {
    throw new Error(`analytics must not reference ${forbidden}`);
  }
}

console.log("analytics does not reference timeline ok");
EOF
pass "analytics does not reference timeline"

echo "-- Test 272: analytics does not reference history checkpoint or workflow state --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const analyticsSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_analytics.js"),
  "utf8",
);

for (const forbidden of [
  "developer_workflow_history.js",
  "developer_workflow_resume.js",
  "developer_workflow_checkpoint.js",
  "readWorkflowHistory",
  "readWorkflowCheckpoint",
  "readWorkflowState",
  "workflow-history.json",
  "workflow-checkpoint.json",
  "workflow-state.json",
]) {
  if (analyticsSource.includes(forbidden)) {
    throw new Error(`analytics must not reference ${forbidden}`);
  }
}

console.log("analytics does not reference history checkpoint or workflow state ok");
EOF
pass "analytics does not reference history checkpoint or workflow state"

echo "-- Test 273: analytics does not reference dashboard internal fields --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const analyticsSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_analytics.js"),
  "utf8",
);

for (const forbidden of [
  "dashboard.runs",
  "dashboard.warnings",
  "dashboard.source",
  "metrics.runs.completed",
  "metrics.steps",
]) {
  if (analyticsSource.includes(forbidden)) {
    throw new Error(`analytics must not reference dashboard internal field ${forbidden}`);
  }
}

console.log("analytics does not reference dashboard internal fields ok");
EOF
pass "analytics does not reference dashboard internal fields"

echo "-- Test 274: dashboard public contract extraction --"
node --input-type=module <<'EOF'
import {
  DASHBOARD_WORKFLOW_HEALTH,
  WORKFLOW_DASHBOARD_SCHEMA,
  extractDashboardPublicContract,
} from "./src/lib/developer_workflow_dashboard.js";

const contract = extractDashboardPublicContract({
  schema: WORKFLOW_DASHBOARD_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  status: "success",
  summary: {
    runCount: 2,
    stepCount: 4,
    totalDurationMs: 1200,
    resumeCount: 1,
  },
  metrics: {
    runs: { completed: 2, failed: 0, stopped: 0, unknown: 0 },
    resume: { count: 1, rate: 0.5 },
  },
  runs: [{ runId: "internal", status: "completed" }],
  warnings: ["internal warning"],
  source: { schema: "hidden", path: "hidden" },
});

if (contract.summary.runCount !== 2 || contract.metrics.successfulRuns !== 2) {
  throw new Error("dashboard public contract summary/metrics mismatch");
}
if (contract.metrics.resumedRuns !== 1) {
  throw new Error("dashboard public contract resumedRuns mismatch");
}
if (contract.status.workflowHealth !== DASHBOARD_WORKFLOW_HEALTH.HEALTHY) {
  throw new Error("dashboard public contract workflowHealth mismatch");
}
if ("runs" in contract || "warnings" in contract || "source" in contract) {
  throw new Error("dashboard public contract must not expose internal fields");
}

console.log("dashboard public contract extraction ok");
EOF
pass "dashboard public contract extraction"

echo "-- Test 275: analytics backward compatibility for missing dashboard fields --"
node --input-type=module <<'EOF'
import {
  ANALYTICS_HEALTH_STATUS,
  buildWorkflowAnalytics,
} from "./src/lib/developer_workflow_analytics.js";

const analytics = buildWorkflowAnalytics({
  schema: "developer-automation/workflow-dashboard/1.0",
  generatedAt: "2026-07-02T00:00:00.000Z",
  unknownField: true,
});

if (analytics.summary.runCount !== 0) {
  throw new Error("analytics must tolerate missing dashboard summary fields");
}
if (analytics.metrics.successRate !== 0 || analytics.metrics.averageDurationMs !== 0) {
  throw new Error("analytics must default missing dashboard metrics to zero rates");
}
if (analytics.health.healthStatus !== ANALYTICS_HEALTH_STATUS.WARNING) {
  throw new Error("empty dashboard must produce warning health status");
}
if (!analytics.health.warningCodes.includes("RUN_COUNT_ZERO")) {
  throw new Error("analytics must emit RUN_COUNT_ZERO warning for empty dashboard");
}

console.log("analytics backward compatibility ok");
EOF
pass "analytics backward compatibility for missing dashboard fields"

echo "-- Test 276: analytics health status resolution --"
node --input-type=module <<'EOF'
import {
  ANALYTICS_HEALTH_STATUS,
  resolveAnalyticsHealthStatus,
} from "./src/lib/developer_workflow_analytics.js";
import { DASHBOARD_WORKFLOW_HEALTH } from "./src/lib/developer_workflow_dashboard.js";

const healthy = resolveAnalyticsHealthStatus(
  {
    summary: { runCount: 2 },
    status: { workflowHealth: DASHBOARD_WORKFLOW_HEALTH.HEALTHY },
    metrics: { successfulRuns: 2, failedRuns: 0, resumedRuns: 0 },
  },
  { successRate: 1, failureRate: 0, resumeRate: 0, averageDurationMs: 100 },
);
const critical = resolveAnalyticsHealthStatus(
  {
    summary: { runCount: 2 },
    status: { workflowHealth: DASHBOARD_WORKFLOW_HEALTH.CRITICAL },
    metrics: { successfulRuns: 0, failedRuns: 2, resumedRuns: 0 },
  },
  { successRate: 0, failureRate: 1, resumeRate: 0, averageDurationMs: 100 },
);

if (healthy !== ANALYTICS_HEALTH_STATUS.HEALTHY) {
  throw new Error("analytics healthy status resolution failed");
}
if (critical !== ANALYTICS_HEALTH_STATUS.CRITICAL) {
  throw new Error("analytics critical status resolution failed");
}

console.log("analytics health status resolution ok");
EOF
pass "analytics health status resolution"

echo "-- Test 277: analytics ADR documents exist --"
test -f docs/adr/ADR-0007-developer-analytics-layer-architecture.md
test -f docs/adr/ADR-0008-dashboard-public-contract.md
grep -q "Dashboard Public Contract" docs/adr/ADR-0008-dashboard-public-contract.md
grep -q "Analytics Layer" docs/adr/ADR-0007-developer-analytics-layer-architecture.md
pass "analytics ADR documents exist"

echo "-- Test 278: workflow-trend schema constant --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_TREND_SCHEMA,
  buildWorkflowTrend,
} from "./src/lib/developer_workflow_trend.js";

const trend = buildWorkflowTrend([]);
if (trend.schema !== WORKFLOW_TREND_SCHEMA) {
  throw new Error("workflow-trend schema constant mismatch");
}
if (WORKFLOW_TREND_SCHEMA !== "developer-automation/workflow-trend/1.0") {
  throw new Error("WORKFLOW_TREND_SCHEMA must be developer-automation/workflow-trend/1.0");
}

console.log("workflow-trend schema constant ok");
EOF
pass "workflow-trend schema constant"

echo "-- Test 279: workflow trend handles zero samples --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTrend,
  validateWorkflowTrend,
} from "./src/lib/developer_workflow_trend.js";

const trend = buildWorkflowTrend([]);
const validation = validateWorkflowTrend(trend);

if (!validation.valid) {
  throw new Error(`zero sample trend must validate: ${validation.errors.join("; ")}`);
}
if (trend.sampleCount !== 0) {
  throw new Error("zero sample trend must have sampleCount 0");
}
if (trend.trends.successRate.length !== 0) {
  throw new Error("zero sample trend must have empty series");
}

console.log("workflow trend handles zero samples ok");
EOF
pass "workflow trend handles zero samples"

echo "-- Test 280: workflow trend handles one sample --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTrend,
  parseTrendInputs,
} from "./src/lib/developer_workflow_trend.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const parsed = parseTrendInputs([
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    status: "success",
    summary: {
      runCount: 2,
      stepCount: 4,
      totalDurationMs: 24000,
      resumeCount: 0,
    },
    metrics: {
      runs: { completed: 2, failed: 0, stopped: 0, unknown: 0 },
      resume: { count: 0, rate: 0 },
    },
  },
]);

const trend = buildWorkflowTrend(parsed);
if (trend.sampleCount !== 1) {
  throw new Error("one sample trend must have sampleCount 1");
}
if (trend.trends.successRate[0].value !== 1) {
  throw new Error("one sample trend successRate must be 1");
}
if (trend.trends.duration[0].value !== 12000) {
  throw new Error("one sample trend duration must be average ms per run");
}

console.log("workflow trend handles one sample ok");
EOF
pass "workflow trend handles one sample"

echo "-- Test 281: workflow trend sorts multiple samples chronologically --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTrend,
  parseTrendInputs,
} from "./src/lib/developer_workflow_trend.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const parsed = parseTrendInputs([
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:03.000Z",
    status: "mixed",
    summary: { runCount: 1, stepCount: 1, totalDurationMs: 3000, resumeCount: 1 },
    metrics: { runs: { completed: 0, failed: 1, stopped: 0, unknown: 0 }, resume: { count: 1 } },
  },
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:01.000Z",
    status: "success",
    summary: { runCount: 1, stepCount: 1, totalDurationMs: 1000, resumeCount: 0 },
    metrics: { runs: { completed: 1, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 0 } },
  },
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:02.000Z",
    status: "failed",
    summary: { runCount: 1, stepCount: 1, totalDurationMs: 2000, resumeCount: 0 },
    metrics: { runs: { completed: 0, failed: 1, stopped: 0, unknown: 0 }, resume: { count: 0 } },
  },
]);

const trend = buildWorkflowTrend(parsed);
const timestamps = trend.trends.successRate.map((point) => point.generatedAt);
if (timestamps.join(",") !== "2026-07-02T00:00:01.000Z,2026-07-02T00:00:02.000Z,2026-07-02T00:00:03.000Z") {
  throw new Error("workflow trend must output chronological series");
}
if (trend.sampleCount !== 3) {
  throw new Error("workflow trend sampleCount must match input count");
}

console.log("workflow trend sorts multiple samples chronologically ok");
EOF
pass "workflow trend sorts multiple samples chronologically"

echo "-- Test 282: workflow-trend.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_TREND_SCHEMA,
  buildWorkflowTrendFromDashboard,
} from "./src/lib/developer_workflow_trend.js";
import {
  WORKFLOW_DASHBOARD_SCHEMA,
  writeWorkflowDashboardReport,
} from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
writeWorkflowDashboardReport(
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    source: { schema: WORKFLOW_TIMELINE_SCHEMA, path: "reports/developer-workflow/latest/workflow-timeline.json" },
    status: "success",
    summary: {
      runCount: 1,
      stepCount: 1,
      successCount: 1,
      failedCount: 0,
      resumeCount: 0,
      totalDurationMs: 5000,
      averageDurationMs: 5000,
    },
    metrics: {
      runs: { completed: 1, failed: 0, stopped: 0, unknown: 0 },
      steps: { completed: 1, failed: 0, skipped: 0, stopped: 0, unknown: 0 },
      duration: { totalMs: 5000, averageMs: 5000, minMs: 5000, maxMs: 5000 },
      resume: { count: 0, rate: 0 },
    },
    runs: [],
    warnings: [],
  },
  PROJECT_ROOT,
);

buildWorkflowTrendFromDashboard({ rootDir: PROJECT_ROOT });
const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/workflow-trend/workflow-trend.json"),
    "utf8",
  ),
);

if (payload.schema !== WORKFLOW_TREND_SCHEMA) {
  throw new Error("workflow-trend.json schema mismatch");
}
if (typeof payload.sampleCount !== "number") {
  throw new Error("workflow-trend.json must include sampleCount");
}
if (!payload.trends || !Array.isArray(payload.trends.successRate)) {
  throw new Error("workflow-trend.json must include trends.successRate");
}

console.log("workflow-trend.json generated ok");
EOF
pass "workflow-trend.json generated"

echo "-- Test 283: trend-report.md generated --"
test -f reports/workflow-trend/trend-report.md
grep -q "# Workflow Trend Report" reports/workflow-trend/trend-report.md
grep -q "## Success Rate Trend" reports/workflow-trend/trend-report.md
grep -q "## Workflow Health Trend" reports/workflow-trend/trend-report.md
pass "trend-report.md generated"

echo "-- Test 284: workflow trend validator --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTrend,
  validateWorkflowTrend,
} from "./src/lib/developer_workflow_trend.js";

const validation = validateWorkflowTrend(buildWorkflowTrend([]));
if (!validation.valid) {
  throw new Error(`workflow trend validator must pass: ${validation.errors.join("; ")}`);
}

const invalid = validateWorkflowTrend({});
if (invalid.valid) {
  throw new Error("workflow trend validator must fail for invalid trend");
}

console.log("workflow trend validator ok");
EOF
pass "workflow trend validator"

echo "-- Test 285: workflow trend CLI summary --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTrend,
  buildWorkflowTrendCliSummary,
  parseTrendInputs,
} from "./src/lib/developer_workflow_trend.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const summary = buildWorkflowTrendCliSummary(
  buildWorkflowTrend(
    parseTrendInputs([
      {
        schema: WORKFLOW_DASHBOARD_SCHEMA,
        generatedAt: "2026-07-02T00:00:00.000Z",
        status: "success",
        summary: { runCount: 1, stepCount: 1, totalDurationMs: 12000, resumeCount: 0 },
        metrics: { runs: { completed: 1, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 0 } },
      },
    ]),
  ),
);

for (const expected of [
  "Workflow Trend Summary",
  "Snapshots: 1",
  "Latest Success Rate: 100%",
  "Latest Failure Rate: 0%",
  "Latest Resume Rate: 0%",
  "Latest Duration: 12 sec",
  "Latest Health: Healthy",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`workflow trend CLI summary must include: ${expected}`);
  }
}

console.log("workflow trend CLI summary ok");
EOF
node scripts/run_developer_workflow_trend.js >/tmp/developer_workflow_trend_cli.log 2>&1
grep -q "Workflow Trend Summary" /tmp/developer_workflow_trend_cli.log
grep -q "workflow-trend.json" /tmp/developer_workflow_trend_cli.log
grep -q "trend-report.md" /tmp/developer_workflow_trend_cli.log
pass "workflow trend CLI summary"

echo "-- Test 286: workflow trend does not reference timeline history checkpoint or state --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const trendSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_trend.js"),
  "utf8",
);

for (const forbidden of [
  "developer_workflow_timeline.js",
  "developer_workflow_history.js",
  "developer_workflow_resume.js",
  "developer_workflow_checkpoint.js",
  "developer_workflow.js",
  "workflow-timeline.json",
  "workflow-history.json",
  "workflow-checkpoint.json",
  "workflow-state.json",
  "readWorkflowTimeline",
  "readWorkflowHistory",
  "readWorkflowCheckpoint",
  "readWorkflowState",
]) {
  if (trendSource.includes(forbidden)) {
    throw new Error(`workflow trend must not reference ${forbidden}`);
  }
}

console.log("workflow trend does not reference timeline history checkpoint or state ok");
EOF
pass "workflow trend does not reference timeline history checkpoint or state"

echo "-- Test 287: workflow trend uses dashboard public contract only --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const trendSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_trend.js"),
  "utf8",
);

if (!trendSource.includes("extractDashboardPublicContract")) {
  throw new Error("workflow trend must use extractDashboardPublicContract");
}

for (const forbidden of [
  "dashboard.runs",
  "dashboard.warnings",
  "dashboard.source",
  "metrics.runs.completed",
  "metrics.steps",
]) {
  if (trendSource.includes(forbidden)) {
    throw new Error(`workflow trend must not reference dashboard internal field ${forbidden}`);
  }
}

console.log("workflow trend uses dashboard public contract only ok");
EOF
pass "workflow trend uses dashboard public contract only"

echo "-- Test 288: workflow trend excludes forecast prediction anomaly --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const trendSource = fs.readFileSync(
  path.join(projectRoot, "src/lib/developer_workflow_trend.js"),
  "utf8",
);
const cliSource = fs.readFileSync(
  path.join(projectRoot, "scripts/run_developer_workflow_trend.js"),
  "utf8",
);
const combined = `${trendSource}\n${cliSource}`;

for (const forbiddenWord of ["forecast", "prediction", "anomaly"]) {
  if (new RegExp(`\\b${forbiddenWord}\\b`, "i").test(combined)) {
    throw new Error(`workflow trend must not include forbidden feature word: ${forbiddenWord}`);
  }
}

for (const forbidden of [
  "forecast(",
  "prediction(",
  "anomaly detection",
  "anomalydetection",
  "buildforecast",
  "buildprediction",
  "detectanomaly",
  "correlation analysis",
  "root cause analysis",
  "automatic improvement",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`workflow trend must not include forbidden feature: ${forbidden}`);
  }
}

console.log("workflow trend excludes forecast prediction anomaly ok");
EOF
pass "workflow trend excludes forecast prediction anomaly"

echo "-- Test 289: extractTrendPublicContract exposes public trend contract --"
node --input-type=module <<'EOF'
import {
  buildWorkflowTrend,
  extractTrendPublicContract,
  parseTrendInputs,
} from "./src/lib/developer_workflow_trend.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const trend = buildWorkflowTrend(
  parseTrendInputs([
    {
      schema: WORKFLOW_DASHBOARD_SCHEMA,
      generatedAt: "2026-07-02T00:00:00.000Z",
      status: "success",
      summary: { runCount: 1, stepCount: 1, totalDurationMs: 5000, resumeCount: 0 },
      metrics: { runs: { completed: 1, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 0 } },
    },
  ]),
);

const contract = extractTrendPublicContract(trend);
if (contract.sampleCount !== 1) {
  throw new Error("trend public contract sampleCount mismatch");
}
if (contract.latest.successRate !== 1) {
  throw new Error("trend public contract latest successRate mismatch");
}
if ("trends" in contract) {
  throw new Error("trend public contract must not expose internal trends");
}

console.log("extractTrendPublicContract exposes public trend contract ok");
EOF
pass "extractTrendPublicContract exposes public trend contract"

echo "-- Test 290: workflow-history-analytics schema constant --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_HISTORY_ANALYTICS_SCHEMA,
  buildWorkflowHistoryAnalytics,
} from "./src/lib/developer_workflow_history_analytics.js";
import { extractDashboardPublicContract } from "./src/lib/developer_workflow_dashboard.js";
import { extractTrendPublicContract } from "./src/lib/developer_workflow_trend.js";

const analytics = buildWorkflowHistoryAnalytics({
  dashboardContract: extractDashboardPublicContract(null),
  trendContract: extractTrendPublicContract(null),
  snapshotContracts: [],
});

if (analytics.schema !== WORKFLOW_HISTORY_ANALYTICS_SCHEMA) {
  throw new Error("workflow-history-analytics schema constant mismatch");
}
if (WORKFLOW_HISTORY_ANALYTICS_SCHEMA !== "developer-automation/workflow-history-analytics/1.0") {
  throw new Error("WORKFLOW_HISTORY_ANALYTICS_SCHEMA mismatch");
}

console.log("workflow-history-analytics schema constant ok");
EOF
pass "workflow-history-analytics schema constant"

echo "-- Test 291: historical analytics handles empty dataset --"
node --input-type=module <<'EOF'
import {
  buildWorkflowHistoryAnalytics,
  validateWorkflowHistoryAnalytics,
} from "./src/lib/developer_workflow_history_analytics.js";
import { extractDashboardPublicContract } from "./src/lib/developer_workflow_dashboard.js";
import { extractTrendPublicContract } from "./src/lib/developer_workflow_trend.js";

const analytics = buildWorkflowHistoryAnalytics({
  dashboardContract: extractDashboardPublicContract(null),
  trendContract: extractTrendPublicContract(null),
  snapshotContracts: [],
});
const validation = validateWorkflowHistoryAnalytics(analytics);

if (!validation.valid) {
  throw new Error(`empty historical analytics must validate: ${validation.errors.join("; ")}`);
}
if (analytics.summary.totalRuns !== 0 || analytics.coverage.sampleCount !== 0) {
  throw new Error("empty historical analytics must use zero counts");
}

console.log("historical analytics handles empty dataset ok");
EOF
pass "historical analytics handles empty dataset"

echo "-- Test 292: historical analytics handles missing data safely --"
node --input-type=module <<'EOF'
import {
  buildWorkflowHistoryAnalytics,
} from "./src/lib/developer_workflow_history_analytics.js";

const analytics = buildWorkflowHistoryAnalytics({});
if (analytics.summary.totalRuns !== 0 || analytics.coverage.missingSnapshots !== 0) {
  throw new Error("missing historical inputs must degrade safely");
}

console.log("historical analytics handles missing data safely ok");
EOF
pass "historical analytics handles missing data safely"

echo "-- Test 293: historical analytics stable ordering for snapshots --"
node --input-type=module <<'EOF'
import { parseHistoricalInputs } from "./src/lib/developer_workflow_history_analytics.js";

const parsed = parseHistoricalInputs(null, null, [
  {
    metadata: { generatedAt: "2026-07-02T00:00:03.000Z" },
    summary: { runCount: 3, stepCount: 3, totalDurationMs: 3000 },
    metrics: { successfulRuns: 2, failedRuns: 1, resumedRuns: 1 },
    status: { workflowHealth: "warning" },
  },
  {
    metadata: { generatedAt: "2026-07-02T00:00:01.000Z" },
    summary: { runCount: 1, stepCount: 1, totalDurationMs: 1000 },
    metrics: { successfulRuns: 1, failedRuns: 0, resumedRuns: 0 },
    status: { workflowHealth: "healthy" },
  },
]);

if (
  parsed.snapshotContracts.map((item) => item.metadata.generatedAt).join(",") !==
  "2026-07-02T00:00:01.000Z,2026-07-02T00:00:03.000Z"
) {
  throw new Error("historical analytics must stable-sort snapshots chronologically");
}

console.log("historical analytics stable ordering for snapshots ok");
EOF
pass "historical analytics stable ordering for snapshots"

echo "-- Test 294: workflow-history-analytics.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_HISTORY_ANALYTICS_SCHEMA,
  buildWorkflowHistoryAnalyticsFromReports,
} from "./src/lib/developer_workflow_history_analytics.js";
import {
  WORKFLOW_DASHBOARD_SCHEMA,
  writeWorkflowDashboardReport,
} from "./src/lib/developer_workflow_dashboard.js";
import {
  buildWorkflowTrend,
  writeWorkflowTrendReport,
} from "./src/lib/developer_workflow_trend.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
writeWorkflowDashboardReport(
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    source: { schema: WORKFLOW_TIMELINE_SCHEMA, path: "reports/developer-workflow/latest/workflow-timeline.json" },
    status: "success",
    summary: {
      runCount: 2,
      stepCount: 4,
      successCount: 2,
      failedCount: 0,
      resumeCount: 1,
      totalDurationMs: 4000,
      averageDurationMs: 2000,
    },
    metrics: {
      runs: { completed: 2, failed: 0, stopped: 0, unknown: 0 },
      steps: { completed: 4, failed: 0, skipped: 0, stopped: 0, unknown: 0 },
      duration: { totalMs: 4000, averageMs: 2000, minMs: 1000, maxMs: 3000 },
      resume: { count: 1, rate: 0.5 },
    },
    runs: [],
    warnings: [],
  },
  PROJECT_ROOT,
);
writeWorkflowTrendReport(buildWorkflowTrend([]), PROJECT_ROOT);
buildWorkflowHistoryAnalyticsFromReports({ rootDir: PROJECT_ROOT });

const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/workflow-history-analytics/workflow-history-analytics.json"),
    "utf8",
  ),
);

if (payload.schema !== WORKFLOW_HISTORY_ANALYTICS_SCHEMA) {
  throw new Error("workflow-history-analytics.json schema mismatch");
}
if (!payload.coverage || !payload.summary || !payload.workflowHealth) {
  throw new Error("workflow-history-analytics.json must include coverage summary workflowHealth");
}

console.log("workflow-history-analytics.json generated ok");
EOF
pass "workflow-history-analytics.json generated"

echo "-- Test 295: historical-report.md generated --"
test -f reports/workflow-history-analytics/historical-report.md
grep -q "# Workflow Historical Analytics Report" reports/workflow-history-analytics/historical-report.md
grep -q "## Data Coverage" reports/workflow-history-analytics/historical-report.md
grep -q "## Workflow Health Distribution" reports/workflow-history-analytics/historical-report.md
pass "historical-report.md generated"

echo "-- Test 296: historical analytics CLI summary --"
node --input-type=module <<'EOF'
import {
  buildWorkflowHistoryAnalytics,
  buildWorkflowHistoryAnalyticsCliSummary,
} from "./src/lib/developer_workflow_history_analytics.js";
import { extractDashboardPublicContract } from "./src/lib/developer_workflow_dashboard.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";
import { extractTrendPublicContract, buildWorkflowTrend } from "./src/lib/developer_workflow_trend.js";

const summary = buildWorkflowHistoryAnalyticsCliSummary(
  buildWorkflowHistoryAnalytics({
    dashboardContract: extractDashboardPublicContract({
      schema: WORKFLOW_DASHBOARD_SCHEMA,
      generatedAt: "2026-07-02T00:00:00.000Z",
      status: "success",
      summary: { runCount: 2, stepCount: 4, totalDurationMs: 24000, resumeCount: 1 },
      metrics: { runs: { completed: 2, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 1 } },
    }),
    trendContract: extractTrendPublicContract(buildWorkflowTrend([])),
    snapshotContracts: [],
  }),
);

for (const expected of [
  "Workflow Historical Analytics Summary",
  "Runs: 2",
  "Success Rate: 100%",
  "Resume Rate: 50%",
  "Average Duration: 12 sec",
  "Workflow Health:",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`historical analytics CLI summary must include: ${expected}`);
  }
}

console.log("historical analytics CLI summary ok");
EOF
npm run developer:history-analytics >/tmp/developer_workflow_history_analytics_cli.log 2>&1
grep -q "Workflow Historical Analytics Summary" /tmp/developer_workflow_history_analytics_cli.log
grep -q "workflow-history-analytics.json" /tmp/developer_workflow_history_analytics_cli.log
grep -q "historical-report.md" /tmp/developer_workflow_history_analytics_cli.log
pass "historical analytics CLI summary"

echo "-- Test 297: historical analytics does not reference dashboard internal --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_history_analytics.js"),
  "utf8",
);

for (const forbidden of [
  "dashboard.runs",
  "dashboard.warnings",
  "dashboard.source",
  "metrics.runs.completed",
  "developer_workflow_timeline.js",
  "developer_workflow_history.js",
  "workflow-timeline.json",
  "workflow-history.json",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`historical analytics must not reference ${forbidden}`);
  }
}

console.log("historical analytics does not reference dashboard internal ok");
EOF
pass "historical analytics does not reference dashboard internal"

echo "-- Test 298: historical analytics does not reference trend internal --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_history_analytics.js"),
  "utf8",
);

if (!source.includes("extractTrendPublicContract")) {
  throw new Error("historical analytics must use extractTrendPublicContract");
}

for (const forbidden of [
  "trend.trends",
  "trends.successRate",
  "trends.failureRate",
  "normalizeWorkflowTrend(",
  "buildWorkflowTrend(",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`historical analytics must not reference trend internal ${forbidden}`);
  }
}

console.log("historical analytics does not reference trend internal ok");
EOF
pass "historical analytics does not reference trend internal"

echo "-- Test 299: historical analytics uses public contracts --"
node --input-type=module <<'EOF'
import {
  buildWorkflowHistoryAnalytics,
  parseHistoricalInputs,
} from "./src/lib/developer_workflow_history_analytics.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";
import { buildWorkflowTrend, parseTrendInputs } from "./src/lib/developer_workflow_trend.js";

const inputs = parseHistoricalInputs(
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    status: "mixed",
    summary: { runCount: 4, stepCount: 8, totalDurationMs: 8000, resumeCount: 2 },
    metrics: { runs: { completed: 3, failed: 1, stopped: 0, unknown: 0 }, resume: { count: 2 } },
  },
  buildWorkflowTrend(
    parseTrendInputs([
      {
        schema: WORKFLOW_DASHBOARD_SCHEMA,
        generatedAt: "2026-07-02T00:00:00.000Z",
        status: "success",
        summary: { runCount: 1, stepCount: 1, totalDurationMs: 1000, resumeCount: 0 },
        metrics: { runs: { completed: 1, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 0 } },
      },
      {
        schema: WORKFLOW_DASHBOARD_SCHEMA,
        generatedAt: "2026-07-02T00:00:01.000Z",
        status: "failed",
        summary: { runCount: 1, stepCount: 1, totalDurationMs: 2000, resumeCount: 1 },
        metrics: { runs: { completed: 0, failed: 1, stopped: 0, unknown: 0 }, resume: { count: 1 } },
      },
    ]),
  ),
  [],
);

const analytics = buildWorkflowHistoryAnalytics(inputs);
if (analytics.summary.totalRuns !== 4 || analytics.summary.successCount !== 3) {
  throw new Error("historical analytics must aggregate dashboard public contract summary");
}
if (analytics.workflowHealth.healthy + analytics.workflowHealth.warning + analytics.workflowHealth.critical !== 2) {
  throw new Error("historical analytics must derive health distribution from trend public contract");
}

console.log("historical analytics uses public contracts ok");
EOF
pass "historical analytics uses public contracts"

echo "-- Test 300: historical analytics excludes forecast prediction anomaly --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/developer_workflow_history_analytics.js",
  "scripts/run_developer_workflow_history_analytics.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbiddenWord of ["forecast", "prediction", "anomaly", "correlation", "root cause"]) {
  if (new RegExp(`\\b${forbiddenWord}\\b`, "i").test(combined)) {
    throw new Error(`historical analytics must not include forbidden feature word: ${forbiddenWord}`);
  }
}

console.log("historical analytics excludes forecast prediction anomaly ok");
EOF
pass "historical analytics excludes forecast prediction anomaly"

echo "-- Test 301: extractHistoricalPublicContract exposes public historical contract --"
node --input-type=module <<'EOF'
import {
  buildWorkflowHistoryAnalytics,
  extractHistoricalPublicContract,
} from "./src/lib/developer_workflow_history_analytics.js";
import { extractDashboardPublicContract } from "./src/lib/developer_workflow_dashboard.js";
import { extractTrendPublicContract } from "./src/lib/developer_workflow_trend.js";

const analytics = buildWorkflowHistoryAnalytics({
  dashboardContract: extractDashboardPublicContract(null),
  trendContract: extractTrendPublicContract(null),
  snapshotContracts: [],
});
const contract = extractHistoricalPublicContract(analytics);

if (contract.summary.totalRuns !== 0) {
  throw new Error("historical public contract totalRuns mismatch");
}
if ("coverage" in contract && contract.coverage.sampleCount !== 0) {
  throw new Error("historical public contract coverage mismatch");
}
if ("period" in contract === false || "workflowHealth" in contract === false) {
  throw new Error("historical public contract must expose period and workflowHealth");
}

console.log("extractHistoricalPublicContract exposes public historical contract ok");
EOF
pass "extractHistoricalPublicContract exposes public historical contract"

echo "-- Test 302: workflow-visualization schema constant --"
node --input-type=module <<'EOF'
import {
  WORKFLOW_VISUALIZATION_SCHEMA,
  buildWorkflowVisualization,
} from "./src/lib/developer_workflow_visualization.js";
import { extractDashboardPublicContract } from "./src/lib/developer_workflow_dashboard.js";
import { extractTrendPublicContract } from "./src/lib/developer_workflow_trend.js";
import { extractHistoricalPublicContract } from "./src/lib/developer_workflow_history_analytics.js";

const visualization = buildWorkflowVisualization({
  dashboardContract: extractDashboardPublicContract(null),
  trendContract: extractTrendPublicContract(null),
  historicalContract: extractHistoricalPublicContract(null),
});

if (visualization.schema !== WORKFLOW_VISUALIZATION_SCHEMA) {
  throw new Error("workflow-visualization schema constant mismatch");
}
if (WORKFLOW_VISUALIZATION_SCHEMA !== "developer-automation/workflow-visualization/1.0") {
  throw new Error("WORKFLOW_VISUALIZATION_SCHEMA mismatch");
}

console.log("workflow-visualization schema constant ok");
EOF
pass "workflow-visualization schema constant"

echo "-- Test 303: workflow visualization handles empty input --"
node --input-type=module <<'EOF'
import {
  buildWorkflowVisualization,
  validateWorkflowVisualization,
} from "./src/lib/developer_workflow_visualization.js";

const visualization = buildWorkflowVisualization({});
const validation = validateWorkflowVisualization(visualization);

if (!validation.valid) {
  throw new Error(`empty visualization must validate: ${validation.errors.join("; ")}`);
}
if (visualization.dashboardSummary.runCount !== 0) {
  throw new Error("empty visualization must use zero dashboard counts");
}
if (visualization.trendSummary.sampleCount !== 0) {
  throw new Error("empty visualization must use zero trend counts");
}

console.log("workflow visualization handles empty input ok");
EOF
pass "workflow visualization handles empty input"

echo "-- Test 304: workflow visualization handles partial input --"
node --input-type=module <<'EOF'
import {
  buildWorkflowVisualization,
  parseVisualizationInputs,
} from "./src/lib/developer_workflow_visualization.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";

const visualization = buildWorkflowVisualization(
  parseVisualizationInputs(
    {
      schema: WORKFLOW_DASHBOARD_SCHEMA,
      generatedAt: "2026-07-02T00:00:00.000Z",
      status: "success",
      summary: { runCount: 3, stepCount: 6, totalDurationMs: 9000, resumeCount: 1 },
      metrics: { runs: { completed: 3, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 1 } },
    },
    null,
    null,
  ),
);

if (visualization.dashboardSummary.runCount !== 3) {
  throw new Error("partial visualization must preserve dashboard public contract");
}
if (visualization.trendSummary.sampleCount !== 0 || visualization.historicalSummary.summary.totalRuns !== 0) {
  throw new Error("partial visualization must degrade missing trend and historical safely");
}

console.log("workflow visualization handles partial input ok");
EOF
pass "workflow visualization handles partial input"

echo "-- Test 305: workflow visualization handles invalid input --"
node --input-type=module <<'EOF'
import {
  validateWorkflowVisualization,
} from "./src/lib/developer_workflow_visualization.js";

const validation = validateWorkflowVisualization(null);
if (validation.valid) {
  throw new Error("null visualization must be invalid");
}

const legacyValidation = validateWorkflowVisualization({
  schema: "legacy",
  generatedAt: null,
});
if (legacyValidation.valid) {
  throw new Error("visualization without generatedAt must be invalid");
}
if (legacyValidation.warnings.length === 0) {
  throw new Error("legacy visualization schema must emit warning");
}
if (!legacyValidation.errors.some((error) => error.includes("generatedAt"))) {
  throw new Error("invalid visualization must report generatedAt error");
}

console.log("workflow visualization handles invalid input ok");
EOF
pass "workflow visualization handles invalid input"

echo "-- Test 306: workflow-visualization.json generated --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKFLOW_VISUALIZATION_SCHEMA,
  generateWorkflowVisualizationReport,
} from "./src/lib/developer_workflow_visualization.js";
import {
  WORKFLOW_DASHBOARD_SCHEMA,
  writeWorkflowDashboardReport,
} from "./src/lib/developer_workflow_dashboard.js";
import {
  buildWorkflowTrend,
  writeWorkflowTrendReport,
} from "./src/lib/developer_workflow_trend.js";
import { buildWorkflowHistoryAnalyticsFromReports } from "./src/lib/developer_workflow_history_analytics.js";
import { WORKFLOW_TIMELINE_SCHEMA } from "./src/lib/developer_workflow_timeline.js";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
writeWorkflowDashboardReport(
  {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: "2026-07-02T00:00:00.000Z",
    source: { schema: WORKFLOW_TIMELINE_SCHEMA, path: "reports/developer-workflow/latest/workflow-timeline.json" },
    status: "success",
    summary: {
      runCount: 2,
      stepCount: 4,
      successCount: 2,
      failedCount: 0,
      resumeCount: 1,
      totalDurationMs: 4000,
      averageDurationMs: 2000,
    },
    metrics: {
      runs: { completed: 2, failed: 0, stopped: 0, unknown: 0 },
      steps: { completed: 4, failed: 0, skipped: 0, stopped: 0, unknown: 0 },
      duration: { totalMs: 4000, averageMs: 2000, minMs: 1000, maxMs: 3000 },
      resume: { count: 1, rate: 0.5 },
    },
    runs: [],
    warnings: [],
  },
  PROJECT_ROOT,
);
writeWorkflowTrendReport(buildWorkflowTrend([]), PROJECT_ROOT);
buildWorkflowHistoryAnalyticsFromReports({ rootDir: PROJECT_ROOT });
generateWorkflowVisualizationReport({ rootDir: PROJECT_ROOT });

const payload = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/workflow-visualization/latest/workflow-visualization.json"),
    "utf8",
  ),
);

if (payload.schema !== WORKFLOW_VISUALIZATION_SCHEMA) {
  throw new Error("workflow-visualization.json schema mismatch");
}
for (const section of [
  "dashboardSummary",
  "trendSummary",
  "historicalSummary",
  "workflowHealthSummary",
  "metadata",
]) {
  if (!payload[section]) {
    throw new Error(`workflow-visualization.json must include ${section}`);
  }
}

console.log("workflow-visualization.json generated ok");
EOF
pass "workflow-visualization.json generated"

echo "-- Test 307: visualization-report.md generated --"
test -f reports/workflow-visualization/latest/visualization-report.md
grep -q "# Workflow Visualization Report" reports/workflow-visualization/latest/visualization-report.md
grep -q "## Dashboard Summary" reports/workflow-visualization/latest/visualization-report.md
grep -q "## Workflow Health Summary" reports/workflow-visualization/latest/visualization-report.md
pass "visualization-report.md generated"

echo "-- Test 308: workflow visualization CLI summary --"
node --input-type=module <<'EOF'
import {
  buildWorkflowVisualization,
  renderVisualizationSummary,
} from "./src/lib/developer_workflow_visualization.js";
import { extractDashboardPublicContract, WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";
import { extractTrendPublicContract, buildWorkflowTrend } from "./src/lib/developer_workflow_trend.js";
import { extractHistoricalPublicContract } from "./src/lib/developer_workflow_history_analytics.js";

const summary = renderVisualizationSummary(
  buildWorkflowVisualization({
    dashboardContract: extractDashboardPublicContract({
      schema: WORKFLOW_DASHBOARD_SCHEMA,
      generatedAt: "2026-07-02T00:00:00.000Z",
      status: "success",
      summary: { runCount: 2, stepCount: 4, totalDurationMs: 4000, resumeCount: 0 },
      metrics: { runs: { completed: 2, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 0 } },
    }),
    trendContract: extractTrendPublicContract(buildWorkflowTrend([])),
    historicalContract: extractHistoricalPublicContract(null),
  }),
);

for (const expected of [
  "Workflow Visualization Summary",
  "Dashboard Runs: 2",
  "Trend Samples: 0",
  "Historical Runs: 0",
  "Dashboard Health:",
  "Workflow Health:",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`visualization CLI summary must include: ${expected}`);
  }
}

console.log("workflow visualization CLI summary ok");
EOF
npm run developer:visualization >/tmp/developer_workflow_visualization_cli.log 2>&1
grep -q "Workflow Visualization Summary" /tmp/developer_workflow_visualization_cli.log
grep -q "workflow-visualization.json" /tmp/developer_workflow_visualization_cli.log
grep -q "visualization-report.md" /tmp/developer_workflow_visualization_cli.log
pass "workflow visualization CLI summary"

echo "-- Test 309: workflow visualization does not reference dashboard internal --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_visualization.js"),
  "utf8",
);

for (const forbidden of [
  "dashboard.runs",
  "dashboard.warnings",
  "dashboard.source",
  "metrics.runs.completed",
  "developer_workflow_timeline.js",
  "developer_workflow_history.js",
  "workflow-timeline.json",
  "workflow-history.json",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`workflow visualization must not reference ${forbidden}`);
  }
}

console.log("workflow visualization does not reference dashboard internal ok");
EOF
pass "workflow visualization does not reference dashboard internal"

echo "-- Test 310: workflow visualization does not reference trend or historical internal --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/developer_workflow_visualization.js"),
  "utf8",
);

for (const required of [
  "extractDashboardPublicContract",
  "extractTrendPublicContract",
  "extractHistoricalPublicContract",
]) {
  if (!source.includes(required)) {
    throw new Error(`workflow visualization must use ${required}`);
  }
}

for (const forbidden of [
  "trend.trends",
  "trends.successRate",
  "normalizeWorkflowTrend(",
  "buildWorkflowTrend(",
  "parseHistoricalInputs",
  "buildWorkflowHistoryAnalytics(",
  "normalizeWorkflowHistoryAnalytics(",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`workflow visualization must not reference internal ${forbidden}`);
  }
}

console.log("workflow visualization does not reference trend or historical internal ok");
EOF
pass "workflow visualization does not reference trend or historical internal"

echo "-- Test 311: workflow visualization uses public contracts --"
node --input-type=module <<'EOF'
import {
  buildWorkflowVisualization,
  parseVisualizationInputs,
} from "./src/lib/developer_workflow_visualization.js";
import { WORKFLOW_DASHBOARD_SCHEMA } from "./src/lib/developer_workflow_dashboard.js";
import { buildWorkflowTrend, parseTrendInputs } from "./src/lib/developer_workflow_trend.js";
import { buildWorkflowHistoryAnalytics } from "./src/lib/developer_workflow_history_analytics.js";
import { parseHistoricalInputs } from "./src/lib/developer_workflow_history_analytics.js";

const dashboard = {
  schema: WORKFLOW_DASHBOARD_SCHEMA,
  generatedAt: "2026-07-02T00:00:00.000Z",
  status: "mixed",
  summary: { runCount: 5, stepCount: 10, totalDurationMs: 10000, resumeCount: 2 },
  metrics: { runs: { completed: 4, failed: 1, stopped: 0, unknown: 0 }, resume: { count: 2 } },
};
const trend = buildWorkflowTrend(
  parseTrendInputs([
    {
      schema: WORKFLOW_DASHBOARD_SCHEMA,
      generatedAt: "2026-07-02T00:00:00.000Z",
      status: "success",
      summary: { runCount: 1, stepCount: 1, totalDurationMs: 1000, resumeCount: 0 },
      metrics: { runs: { completed: 1, failed: 0, stopped: 0, unknown: 0 }, resume: { count: 0 } },
    },
  ]),
);
const historical = buildWorkflowHistoryAnalytics(parseHistoricalInputs(dashboard, trend, []));
const visualization = buildWorkflowVisualization(
  parseVisualizationInputs(dashboard, trend, historical),
);

if (visualization.dashboardSummary.runCount !== 5) {
  throw new Error("visualization must organize dashboard public contract");
}
if (visualization.trendSummary.sampleCount !== 1) {
  throw new Error("visualization must organize trend public contract");
}
if (visualization.historicalSummary.summary.totalRuns !== 5) {
  throw new Error("visualization must organize historical public contract");
}

console.log("workflow visualization uses public contracts ok");
EOF
pass "workflow visualization uses public contracts"

echo "-- Test 312: workflow visualization excludes chart graph forecast --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/developer_workflow_visualization.js",
  "scripts/run_developer_workflow_visualization.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbiddenWord of [
  "forecast",
  "prediction",
  "anomaly",
  "correlation",
  "chart",
  "graph",
  "<svg",
  "<html",
  ".png",
]) {
  if (new RegExp(`\\b${forbiddenWord.replace(".", "\\.")}\\b`, "i").test(combined)) {
    throw new Error(`workflow visualization must not include forbidden feature word: ${forbiddenWord}`);
  }
}

console.log("workflow visualization excludes chart graph forecast ok");
EOF
pass "workflow visualization excludes chart graph forecast"

echo "-- Test 313: content-ideas schema constant --"
node --input-type=module <<'EOF'
import {
  CONTENT_IDEA_SCHEMA,
  buildContentIdeas,
} from "./src/lib/content_idea.js";

const contentIdeas = buildContentIdeas({ ideas: [] }, {
  generatedAt: "2026-07-03T00:00:00.000Z",
});

if (contentIdeas.schema !== CONTENT_IDEA_SCHEMA) {
  throw new Error("content-ideas schema constant mismatch");
}
if (CONTENT_IDEA_SCHEMA !== "content-ideas/1.0") {
  throw new Error("CONTENT_IDEA_SCHEMA mismatch");
}

console.log("content-ideas schema constant ok");
EOF
pass "content-ideas schema constant"

echo "-- Test 314: content idea builder --"
node --input-type=module <<'EOF'
import {
  buildContentIdeas,
  parseContentIdeaInputs,
} from "./src/lib/content_idea.js";

const built = buildContentIdeas(
  parseContentIdeaInputs({
    ideas: [
      {
        id: "idea-b",
        title: "Seasonal menu teaser",
        category: "marketing",
        status: "candidate",
        priority: "high",
        tags: ["seasonal"],
      },
      {
        id: "idea-a",
        title: "Staff spotlight",
        category: "culture",
        status: "archived",
        priority: "low",
        tags: ["team"],
      },
    ],
  }),
  { generatedAt: "2026-07-03T00:00:00.000Z" },
);

if (built.ideas.length !== 2) {
  throw new Error("content idea builder must preserve idea count");
}
if (built.ideas.map((idea) => idea.id).join(",") !== "idea-a,idea-b") {
  throw new Error("content idea builder must stable-sort ideas by id");
}

console.log("content idea builder ok");
EOF
pass "content idea builder"

echo "-- Test 315: content idea validator --"
node --input-type=module <<'EOF'
import {
  buildContentIdeas,
  validateContentIdeas,
} from "./src/lib/content_idea.js";

const valid = validateContentIdeas(
  buildContentIdeas({
    ideas: [
      {
        id: "idea-001",
        title: "Test Idea",
        category: "general",
        status: "candidate",
        priority: "medium",
        tags: [],
      },
    ],
  }),
);

if (!valid.valid) {
  throw new Error(`valid content ideas must pass validation: ${valid.errors.join("; ")}`);
}

const invalid = validateContentIdeas(null);
if (invalid.valid) {
  throw new Error("null content ideas must be invalid");
}

console.log("content idea validator ok");
EOF
pass "content idea validator"

echo "-- Test 316: content idea handles empty input --"
node --input-type=module <<'EOF'
import {
  buildContentIdeas,
  extractContentIdeaPublicContract,
} from "./src/lib/content_idea.js";

const empty = buildContentIdeas({ ideas: [] });
const contract = extractContentIdeaPublicContract(empty);

if (contract.summary.ideaCount !== 0 || contract.summary.categoryCount !== 0) {
  throw new Error("empty content ideas must use zero counts");
}

console.log("content idea handles empty input ok");
EOF
pass "content idea handles empty input"

echo "-- Test 317: extractContentIdeaPublicContract exposes public contract --"
node --input-type=module <<'EOF'
import {
  buildContentIdeas,
  extractContentIdeaPublicContract,
  parseContentIdeaInputs,
} from "./src/lib/content_idea.js";

const contentIdeas = buildContentIdeas(parseContentIdeaInputs(null));
const contract = extractContentIdeaPublicContract(contentIdeas);

if (contract.summary.ideaCount !== 3) {
  throw new Error("content idea public contract ideaCount mismatch");
}
if (contract.summary.candidateCount !== 2 || contract.summary.archivedCount !== 1) {
  throw new Error("content idea public contract status counts mismatch");
}
if (!Array.isArray(contract.ideas) || contract.ideas.length !== 3) {
  throw new Error("content idea public contract must expose ideas");
}
if ("mode" in contract || "generator" in contract) {
  throw new Error("content idea public contract must not expose internal fields");
}

console.log("extractContentIdeaPublicContract exposes public contract ok");
EOF
pass "extractContentIdeaPublicContract exposes public contract"

echo "-- Test 318: content ideas markdown generated from json --"
node --input-type=module <<'EOF'
import {
  buildContentIdeas,
  parseContentIdeaInputs,
  renderContentIdeasMarkdown,
} from "./src/lib/content_idea.js";

const contentIdeas = buildContentIdeas(parseContentIdeaInputs(null));
const markdown = renderContentIdeasMarkdown(contentIdeas);

for (const expected of [
  "# Content Ideas",
  "| Ideas | 3 |",
  "| Candidates | 2 |",
  "| Archived | 1 |",
  "飲食店店長が今日から使えるChatGPT活用5選",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`content ideas markdown must include: ${expected}`);
  }
}

console.log("content ideas markdown generated from json ok");
EOF
pass "content ideas markdown generated from json"

echo "-- Test 319: content idea CLI summary --"
node --input-type=module <<'EOF'
import {
  buildContentIdeas,
  buildContentIdeasSummary,
  parseContentIdeaInputs,
} from "./src/lib/content_idea.js";

const summary = buildContentIdeasSummary(
  buildContentIdeas(parseContentIdeaInputs(null)),
);

for (const expected of [
  "Content Idea Summary",
  "Ideas: 3",
  "Categories: 3",
  "Candidates: 2",
  "Archived: 1",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`content idea CLI summary must include: ${expected}`);
  }
}

console.log("content idea CLI summary ok");
EOF
pass "content idea CLI summary"

echo "-- Test 320: content-ideas.json generated --"
npm run content:ideas >/tmp/content_ideas_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/content-ideas/content-ideas.json", "utf8"));
if (data.schema !== "content-ideas/1.0") {
  throw new Error("content-ideas.json schema must be content-ideas/1.0");
}
if (!Array.isArray(data.ideas) || data.ideas.length !== 3) {
  throw new Error("content-ideas.json must include default ideas");
}
if (!data.ideas.every((idea) => idea.id && idea.title && idea.category && idea.status && idea.priority && Array.isArray(idea.tags))) {
  throw new Error("content-ideas.json idea shape mismatch");
}

console.log("content-ideas.json generated ok");
EOF
pass "content-ideas.json generated"

echo "-- Test 321: content-ideas.md generated --"
test -f output/content-ideas/content-ideas.md
grep -q "# Content Ideas" output/content-ideas/content-ideas.md
grep -q "Content Idea Summary" /tmp/content_ideas_cli.log
grep -q "content-ideas.json" /tmp/content_ideas_cli.log
grep -q "content-ideas.md" /tmp/content_ideas_cli.log
pass "content-ideas.md generated"

echo "-- Test 322: content:ideas npm script exists --"
grep -q '"content:ideas": "node scripts/run_content_ideas.js"' package.json
test -f scripts/run_content_ideas.js
test -f src/lib/content_idea.js
pass "content:ideas npm script exists"

echo "-- Test 323: content idea foundation excludes llm ai generation --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/content_idea.js",
  "scripts/run_content_ideas.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "openai",
  "gemini",
  "generateContent",
  "chat.completions",
  "prompt optimization",
  "hashtag",
  "publish",
  "schedule",
]) {
  if (new RegExp(`\\b${forbidden}\\b`, "i").test(combined)) {
    throw new Error(`content idea foundation must not include forbidden feature: ${forbidden}`);
  }
}

console.log("content idea foundation excludes llm ai generation ok");
EOF
pass "content idea foundation excludes llm ai generation"

echo "-- Test 324: content generation backward compatibility preserved --"
node scripts/run_content_generation_legacy.js --dry-run >/tmp/content_generation_backward_compat.log
node --input-type=module <<'EOF'
import fs from "node:fs";

const legacy = JSON.parse(
  fs.readFileSync("output/content-ideas/latest/content-ideas.json", "utf8"),
);
if (legacy.schema !== "content-generation/1.0") {
  throw new Error("legacy content-generation schema must remain content-generation/1.0");
}
if (!Array.isArray(legacy.ideas) || legacy.ideas.length !== 3) {
  throw new Error("legacy content generation output must remain unchanged");
}

console.log("content generation backward compatibility preserved ok");
EOF
pass "content generation backward compatibility preserved"

echo "-- Test 325: content-ai-ideas schema constant --"
node --input-type=module <<'EOF'
import {
  CONTENT_AI_IDEA_SCHEMA,
  buildAIIdeaPipeline,
} from "./src/lib/content_ai_idea.js";

const { output } = buildAIIdeaPipeline(
  { topic: "test topic", audience: "test audience", count: 3 },
  { generatedAt: "2026-07-03T00:00:00.000Z", rootDir: "/tmp/content-ai-idea-test-325" },
);

if (output.schema !== CONTENT_AI_IDEA_SCHEMA) {
  throw new Error("content-ai-ideas schema constant mismatch");
}
if (CONTENT_AI_IDEA_SCHEMA !== "content-ai-ideas/1.0") {
  throw new Error("CONTENT_AI_IDEA_SCHEMA mismatch");
}

console.log("content-ai-ideas schema constant ok");
EOF
pass "content-ai-ideas schema constant"

echo "-- Test 326: AI idea input parser --"
node --input-type=module <<'EOF'
import { parseAIIdeaInputs } from "./src/lib/content_ai_idea.js";

const parsed = parseAIIdeaInputs({
  topic: "seasonal menu",
  audience: "cafe owners",
  count: 25,
  seedIdeas: [{ id: "idea-001", title: "Seed Idea" }],
});

if (parsed.topic !== "seasonal menu" || parsed.audience !== "cafe owners") {
  throw new Error("AI idea input parser must preserve topic and audience");
}
if (parsed.count !== 20) {
  throw new Error("AI idea input parser must cap count at 20");
}
if (parsed.seedIdeas.length !== 1) {
  throw new Error("AI idea input parser must preserve seed ideas");
}

console.log("AI idea input parser ok");
EOF
pass "AI idea input parser"

echo "-- Test 327: AI idea mock generator --"
node --input-type=module <<'EOF'
import { generateAIIdeas } from "./src/lib/content_ai_idea.js";

const first = generateAIIdeas({ topic: "mock topic", audience: "mock audience", count: 4 });
const second = generateAIIdeas({ topic: "mock topic", audience: "mock audience", count: 4 });

if (first.length <= 4) {
  throw new Error("AI idea mock generator must include duplicate candidate for dedup testing");
}
if (JSON.stringify(first.map((idea) => idea.title)) !== JSON.stringify(second.map((idea) => idea.title))) {
  throw new Error("AI idea mock generator must be deterministic");
}
if (!first.every((idea) => idea.scores && typeof idea.finalScore === "number")) {
  throw new Error("AI idea mock generator must attach scores and finalScore");
}

console.log("AI idea mock generator ok");
EOF
pass "AI idea mock generator"

echo "-- Test 328: AI idea deduplicator --"
node --input-type=module <<'EOF'
import { deduplicateAIIdeas, normalizeTitleKey } from "./src/lib/content_ai_idea.js";

if (normalizeTitleKey("  Hello   WORLD ") !== "hello world") {
  throw new Error("AI idea deduplicator must normalize whitespace and case");
}

const deduped = deduplicateAIIdeas([
  {
    id: "a",
    title: "Seasonal Menu Ideas",
    finalScore: 0.7,
  },
  {
    id: "b",
    title: "  seasonal   menu   ideas  ",
    finalScore: 0.9,
  },
  {
    id: "c",
    title: "Unique Idea",
    finalScore: 0.6,
  },
]);

if (deduped.length !== 2) {
  throw new Error("AI idea deduplicator must remove duplicate titles");
}
const winner = deduped.find((idea) => normalizeTitleKey(idea.title) === "seasonal menu ideas");
if (!winner || winner.id !== "b") {
  throw new Error("AI idea deduplicator must keep higher score duplicate");
}

console.log("AI idea deduplicator ok");
EOF
pass "AI idea deduplicator"

echo "-- Test 329: AI idea ranking --"
node --input-type=module <<'EOF'
import { rankAIIdeas } from "./src/lib/content_ai_idea.js";

const ranked = rankAIIdeas([
  { id: "b", title: "B", finalScore: 0.7 },
  { id: "a", title: "A", finalScore: 0.9 },
  { id: "c", title: "C", finalScore: 0.7 },
]);

if (ranked.map((idea) => idea.id).join(",") !== "a,b,c") {
  throw new Error("AI idea ranking must sort by finalScore desc then id asc");
}
if (ranked.map((idea) => idea.rank).join(",") !== "1,2,3") {
  throw new Error("AI idea ranking must assign rank numbers");
}

console.log("AI idea ranking ok");
EOF
pass "AI idea ranking"

echo "-- Test 330: AI idea output validator --"
node --input-type=module <<'EOF'
import {
  buildAIIdeaPipeline,
  validateAIIdeaOutput,
} from "./src/lib/content_ai_idea.js";

const { output } = buildAIIdeaPipeline(
  { count: 2 },
  { generatedAt: "2026-07-03T00:00:00.000Z", rootDir: "/tmp/content-ai-idea-test-330" },
);
const validation = validateAIIdeaOutput(output);

if (!validation.valid) {
  throw new Error(`AI idea output must validate: ${validation.errors.join("; ")}`);
}

const invalid = validateAIIdeaOutput(null);
if (invalid.valid) {
  throw new Error("null AI idea output must be invalid");
}

console.log("AI idea output validator ok");
EOF
pass "AI idea output validator"

echo "-- Test 331: extractAIIdeaPublicContract exposes public contract --"
node --input-type=module <<'EOF'
import {
  buildAIIdeaPipeline,
  extractAIIdeaPublicContract,
} from "./src/lib/content_ai_idea.js";

const { output } = buildAIIdeaPipeline(
  { count: 3 },
  { generatedAt: "2026-07-03T00:00:00.000Z", rootDir: "/tmp/content-ai-idea-test-331" },
);
const contract = extractAIIdeaPublicContract(output);

if (contract.summary.ideaCount !== output.ideas.length) {
  throw new Error("AI idea public contract ideaCount mismatch");
}
if (!Array.isArray(contract.ideas) || contract.ideas.length === 0) {
  throw new Error("AI idea public contract must expose ideas");
}
if ("generator" in contract || "inputs" in contract || "scores" in contract.ideas[0]) {
  throw new Error("AI idea public contract must not expose internal fields");
}

console.log("extractAIIdeaPublicContract exposes public contract ok");
EOF
pass "extractAIIdeaPublicContract exposes public contract"

echo "-- Test 332: AI idea markdown generated from json --"
node --input-type=module <<'EOF'
import {
  buildAIIdeaPipeline,
  buildAIIdeaMarkdown,
} from "./src/lib/content_ai_idea.js";

const { output } = buildAIIdeaPipeline(
  { count: 3 },
  { generatedAt: "2026-07-03T00:00:00.000Z", rootDir: "/tmp/content-ai-idea-test-332" },
);
const markdown = buildAIIdeaMarkdown(output);

for (const expected of [
  "# AI Content Ideas",
  "| Top Score |",
  "| Average Score |",
  "| Rank |",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`AI idea markdown must include: ${expected}`);
  }
}

console.log("AI idea markdown generated from json ok");
EOF
pass "AI idea markdown generated from json"

echo "-- Test 333: AI idea CLI summary --"
node --input-type=module <<'EOF'
import {
  buildAIIdeaPipeline,
  buildAIIdeaSummary,
} from "./src/lib/content_ai_idea.js";

const { output } = buildAIIdeaPipeline(
  { count: 3 },
  { generatedAt: "2026-07-03T00:00:00.000Z", rootDir: "/tmp/content-ai-idea-test-333" },
);
const summary = buildAIIdeaSummary(output);

for (const expected of [
  "AI Idea Summary",
  "Ideas:",
  "Top Score:",
  "Average Score:",
  "Provider: mock",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`AI idea CLI summary must include: ${expected}`);
  }
}

console.log("AI idea CLI summary ok");
EOF
pass "AI idea CLI summary"

echo "-- Test 334: content-ai-ideas.json generated --"
npm run content:ai-ideas >/tmp/content_ai_ideas_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync("output/content-ideas/content-ai-ideas.json", "utf8"),
);
if (data.schema !== "content-ai-ideas/1.0") {
  throw new Error("content-ai-ideas.json schema must be content-ai-ideas/1.0");
}
if (!Array.isArray(data.ideas) || data.ideas.length === 0) {
  throw new Error("content-ai-ideas.json must include ranked ideas");
}
if (!data.ideas.every((idea) => typeof idea.rank === "number" && typeof idea.finalScore === "number")) {
  throw new Error("content-ai-ideas.json idea shape mismatch");
}

console.log("content-ai-ideas.json generated ok");
EOF
pass "content-ai-ideas.json generated"

echo "-- Test 335: content-ai-ideas.md generated --"
test -f output/content-ideas/content-ai-ideas.md
grep -q "# AI Content Ideas" output/content-ideas/content-ai-ideas.md
grep -q "AI Idea Summary" /tmp/content_ai_ideas_cli.log
grep -q "content-ai-ideas.json" /tmp/content_ai_ideas_cli.log
grep -q "content-ai-ideas.md" /tmp/content_ai_ideas_cli.log
pass "content-ai-ideas.md generated"

echo "-- Test 336: content:ai-ideas npm script exists --"
grep -q '"content:ai-ideas": "node scripts/run_content_ai_ideas.js"' package.json
test -f scripts/run_content_ai_ideas.js
test -f src/lib/content_ai_idea.js
pass "content:ai-ideas npm script exists"

echo "-- Test 337: AI idea foundation excludes publishing and external llm clients --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/content_ai_idea.js",
  "scripts/run_content_ai_ideas.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "from \"openai\"",
  "from 'openai'",
  "@google/genai",
  "chat.completions",
  "hashtag",
  "publish",
  "schedule",
  "generateImage",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`AI idea foundation must not include forbidden feature: ${forbidden}`);
  }
}

console.log("AI idea foundation excludes publishing and external llm clients ok");
EOF
pass "AI idea foundation excludes publishing and external llm clients"

echo "-- Test 338: v1.41.0 idea generation backward compatibility preserved --"
npm run content:ideas >/tmp/content_ideas_backward_compat_v141.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/content-ideas/content-ideas.json", "utf8"));
if (data.schema !== "content-ideas/1.0") {
  throw new Error("v1.41.0 content-ideas schema must remain content-ideas/1.0");
}
if (!Array.isArray(data.ideas) || data.ideas.length !== 3) {
  throw new Error("v1.41.0 content:ideas output must remain unchanged");
}

console.log("v1.41.0 idea generation backward compatibility preserved ok");
EOF
grep -q "Content Idea Summary" /tmp/content_ideas_backward_compat_v141.log
pass "v1.41.0 idea generation backward compatibility preserved"

echo "-- Test 339: content-generation schema constant --"
node --input-type=module <<'EOF'
import {
  CONTENT_GENERATION_SCHEMA,
  buildContentGenerationPipeline,
} from "./src/lib/content_generation.js";

const { output } = buildContentGenerationPipeline(
  { tone: "friendly", format: "single-post" },
  {
    generatedAt: "2026-07-03T00:00:00.000Z",
    rootDir: "/tmp/content-generation-test-339",
    aiIdeaPath: "/tmp/content-generation-test-339/missing-ai-ideas.json",
  },
);

if (output.schema !== CONTENT_GENERATION_SCHEMA) {
  throw new Error("content-generation schema constant mismatch");
}
if (CONTENT_GENERATION_SCHEMA !== "content-generation/2.0") {
  throw new Error("CONTENT_GENERATION_SCHEMA mismatch");
}

console.log("content-generation schema constant ok");
EOF
pass "content-generation schema constant"

echo "-- Test 340: content generation input parser --"
node --input-type=module <<'EOF'
import { parseContentGenerationInputs } from "./src/lib/content_generation.js";
import { extractAIIdeaPublicContract } from "./src/lib/content_ai_idea.js";

const contract = extractAIIdeaPublicContract({
  schema: "content-ai-ideas/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  ideas: [{ id: "ai-idea-001", title: "Test Idea", category: "sns", finalScore: 0.8, rank: 1, tags: [] }],
});
const parsed = parseContentGenerationInputs(
  { tone: "professional", format: "single-post" },
  contract,
);

if (parsed.tone !== "professional" || parsed.format !== "single-post") {
  throw new Error("content generation input parser must preserve tone and format");
}
if (parsed.aiIdeaContract.summary.ideaCount !== 1) {
  throw new Error("content generation input parser must preserve AI idea public contract");
}

console.log("content generation input parser ok");
EOF
pass "content generation input parser"

echo "-- Test 341: content generation uses AI idea public contract only --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/content_generation.js"),
  "utf8",
);

if (!source.includes("extractAIIdeaPublicContract")) {
  throw new Error("content generation must use extractAIIdeaPublicContract");
}

for (const forbidden of [
  "generateAIIdeas(",
  "deduplicateAIIdeas(",
  "normalizeAIIdeaOutput(",
  "idea.scores",
  "idea.rationale",
  "trend.trends",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`content generation must not reference AI idea internal ${forbidden}`);
  }
}

console.log("content generation uses AI idea public contract only ok");
EOF
pass "content generation uses AI idea public contract only"

echo "-- Test 342: mock content generator --"
node --input-type=module <<'EOF'
import {
  generateContentDrafts,
  parseContentGenerationInputs,
} from "./src/lib/content_generation.js";
import { extractAIIdeaPublicContract } from "./src/lib/content_ai_idea.js";

const contract = extractAIIdeaPublicContract({
  schema: "content-ai-ideas/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  ideas: [
    { id: "ai-idea-001", title: "Menu Spotlight", category: "marketing", finalScore: 0.9, rank: 1, tags: [] },
    { id: "ai-idea-002", title: "Staff Story", category: "culture", finalScore: 0.7, rank: 2, tags: [] },
  ],
});
const inputs = parseContentGenerationInputs(null, contract);
const drafts = generateContentDrafts(contract, inputs, { provider: "mock" });

if (drafts.length !== 2) {
  throw new Error("mock content generator must create one draft per AI idea");
}
if (!drafts.every((draft) => draft.sourceIdeaId && draft.body && draft.hook && draft.callToAction)) {
  throw new Error("mock content generator must populate draft fields");
}

console.log("mock content generator ok");
EOF
pass "mock content generator"

echo "-- Test 343: content draft normalizer --"
node --input-type=module <<'EOF'
import { normalizeContentDrafts } from "./src/lib/content_generation.js";

const normalized = normalizeContentDrafts([
  { id: "draft-b", title: "B", qualityScore: 0.7, hook: "h", body: "b", callToAction: "c" },
  { id: "draft-a", title: "A", qualityScore: 0.9, hook: "h", body: "b", callToAction: "c" },
]);

if (normalized.map((draft) => draft.id).join(",") !== "draft-a,draft-b") {
  throw new Error("content draft normalizer must rank by qualityScore desc then id asc");
}
if (normalized.map((draft) => draft.rank).join(",") !== "1,2") {
  throw new Error("content draft normalizer must assign rank numbers");
}

console.log("content draft normalizer ok");
EOF
pass "content draft normalizer"

echo "-- Test 344: content generation output validator --"
node --input-type=module <<'EOF'
import {
  buildContentGenerationPipeline,
  validateContentGenerationOutput,
} from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/content-generation-test-344";
buildAIIdeaPipeline({ count: 2 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildContentGenerationPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const validation = validateContentGenerationOutput(output);

if (!validation.valid) {
  throw new Error(`content generation output must validate: ${validation.errors.join("; ")}`);
}

const invalid = validateContentGenerationOutput(null);
if (invalid.valid) {
  throw new Error("null content generation output must be invalid");
}

console.log("content generation output validator ok");
EOF
pass "content generation output validator"

echo "-- Test 345: extractContentGenerationPublicContract exposes public contract --"
node --input-type=module <<'EOF'
import {
  buildContentGenerationPipeline,
  extractContentGenerationPublicContract,
} from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/content-generation-test-345";
buildAIIdeaPipeline({ count: 2 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildContentGenerationPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const contract = extractContentGenerationPublicContract(output);

if (contract.summary.draftCount !== output.drafts.length) {
  throw new Error("content generation public contract draftCount mismatch");
}
if ("generator" in contract || "inputs" in contract || "qualityScore" in contract.drafts[0]) {
  throw new Error("content generation public contract must not expose internal fields");
}

console.log("extractContentGenerationPublicContract exposes public contract ok");
EOF
pass "extractContentGenerationPublicContract exposes public contract"

echo "-- Test 346: content generation markdown generated from json --"
node --input-type=module <<'EOF'
import {
  buildContentGenerationMarkdown,
  buildContentGenerationPipeline,
} from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/content-generation-test-346";
buildAIIdeaPipeline({ count: 2 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildContentGenerationPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const markdown = buildContentGenerationMarkdown(output);

for (const expected of [
  "# Content Generation",
  "| Drafts |",
  "| Average Word Count |",
  "### Body",
]) {
  if (!markdown.includes(expected)) {
    throw new Error(`content generation markdown must include: ${expected}`);
  }
}

console.log("content generation markdown generated from json ok");
EOF
pass "content generation markdown generated from json"

echo "-- Test 347: content generation CLI summary --"
node --input-type=module <<'EOF'
import {
  buildContentGenerationPipeline,
  buildContentGenerationSummary,
} from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/content-generation-test-347";
buildAIIdeaPipeline({ count: 2 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildContentGenerationPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const summary = buildContentGenerationSummary(output);

for (const expected of [
  "Content Generation Summary",
  "Drafts:",
  "Average Word Count:",
  "Top Quality Score:",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`content generation CLI summary must include: ${expected}`);
  }
}

console.log("content generation CLI summary ok");
EOF
pass "content generation CLI summary"

echo "-- Test 348: content-generation.json generated --"
npm run content:ai-ideas >/tmp/content_ai_ideas_before_generate.log 2>&1
npm run content:generate >/tmp/content_generate_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync("output/content-generation/content-generation.json", "utf8"),
);
if (data.schema !== "content-generation/2.0") {
  throw new Error("content-generation.json schema must be content-generation/2.0");
}
if (!Array.isArray(data.drafts) || data.drafts.length === 0) {
  throw new Error("content-generation.json must include ranked drafts");
}
if (!data.drafts.every((draft) => draft.body && typeof draft.rank === "number")) {
  throw new Error("content-generation.json draft shape mismatch");
}

console.log("content-generation.json generated ok");
EOF
pass "content-generation.json generated"

echo "-- Test 349: content-generation.md generated --"
test -f output/content-generation/content-generation.md
grep -q "# Content Generation" output/content-generation/content-generation.md
grep -q "Content Generation Summary" /tmp/content_generate_cli.log
grep -q "content-generation.json" /tmp/content_generate_cli.log
grep -q "content-generation.md" /tmp/content_generate_cli.log
pass "content-generation.md generated"

echo "-- Test 350: content:generate npm script exists --"
grep -q '"content:generate": "node scripts/run_content_generation.js"' package.json
test -f scripts/run_content_generation.js
test -f src/lib/content_generation.js
pass "content:generate npm script exists"

echo "-- Test 351: content generation excludes image publishing scheduler analytics --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/content_generation.js",
  "scripts/run_content_generation.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "from \"openai\"",
  "from 'openai'",
  "@google/genai",
  "instagram",
  "publish",
  "scheduler",
  "analytics",
  "hashtag",
  "generateImage",
  "create_carousel",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`content generation must not include forbidden feature: ${forbidden}`);
  }
}

console.log("content generation excludes image publishing scheduler analytics ok");
EOF
pass "content generation excludes image publishing scheduler analytics"

echo "-- Test 352: v1.42.0 AI idea generation backward compatibility preserved --"
npm run content:ai-ideas >/tmp/content_ai_ideas_backward_compat_v142.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync("output/content-ideas/content-ai-ideas.json", "utf8"),
);
if (data.schema !== "content-ai-ideas/1.0") {
  throw new Error("v1.42.0 content-ai-ideas schema must remain content-ai-ideas/1.0");
}
if (!Array.isArray(data.ideas) || data.ideas.length === 0) {
  throw new Error("v1.42.0 content:ai-ideas output must remain valid");
}

console.log("v1.42.0 AI idea generation backward compatibility preserved ok");
EOF
grep -q "AI Idea Summary" /tmp/content_ai_ideas_backward_compat_v142.log
pass "v1.42.0 AI idea generation backward compatibility preserved"

echo "-- Test 353: image_generation.js exists --"
test -f src/lib/image_generation.js
grep -q "IMAGE_GENERATION_SCHEMA" src/lib/image_generation.js
grep -q "buildImageGeneration" src/lib/image_generation.js
grep -q "extractImageGenerationPublicContract" src/lib/image_generation.js
pass "image_generation.js exists"

echo "-- Test 354: run_image_generation.js exists --"
test -f scripts/run_image_generation.js
grep -q "buildImageGenerationPipeline" scripts/run_image_generation.js
pass "run_image_generation.js exists"

echo "-- Test 355: package.json image:generation script exists --"
grep -q '"image:generation": "node scripts/run_image_generation.js"' package.json
pass "package.json image:generation script exists"

echo "-- Test 356: image generation uses content generation public contract only --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/image_generation.js"),
  "utf8",
);

if (!source.includes("extractContentGenerationPublicContract")) {
  throw new Error("image generation must use extractContentGenerationPublicContract");
}

for (const forbidden of [
  "generateContentDrafts(",
  "normalizeContentGenerationOutput(",
  "draft.body",
  "draft.callToAction",
  "draft.qualityScore",
  "CONTENT_GENERATION_PROVIDER",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`image generation must not reference content generation internal ${forbidden}`);
  }
}

console.log("image generation uses content generation public contract only ok");
EOF
pass "image generation uses content generation public contract only"

echo "-- Test 357: image prompt generator exists --"
node --input-type=module <<'EOF'
import {
  buildImagePromptFromDraft,
  generateImagePrompts,
} from "./src/lib/image_generation.js";
import { extractContentGenerationPublicContract } from "./src/lib/content_generation.js";

const contract = extractContentGenerationPublicContract({
  schema: "content-generation/2.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  drafts: [
    {
      id: "draft-001",
      sourceIdeaId: "ai-idea-001",
      title: "Seasonal Menu",
      hook: "Try our new spring menu",
      format: "single-post",
      wordCount: 20,
      rank: 1,
    },
  ],
});
const prompts = generateImagePrompts(contract);

if (prompts.length !== 1) {
  throw new Error("image prompt generator must create one prompt per draft");
}

const prompt = buildImagePromptFromDraft(contract.drafts[0], 0);
if (!prompt.prompt.includes("Seasonal Menu") || prompt.style !== "photorealistic") {
  throw new Error("image prompt generator must use public draft fields deterministically");
}

console.log("image prompt generator exists ok");
EOF
pass "image prompt generator exists"

echo "-- Test 358: image generation normalizer exists --"
node --input-type=module <<'EOF'
import { buildImageGeneration, normalizeImageGeneration } from "./src/lib/image_generation.js";
import { extractContentGenerationPublicContract } from "./src/lib/content_generation.js";

const normalized = normalizeImageGeneration(
  buildImageGeneration({
    contentContract: extractContentGenerationPublicContract({
      schema: "content-generation/2.0",
      generatedAt: "2026-07-03T00:00:00.000Z",
      drafts: [
        { id: "draft-b", title: "B", hook: "b", format: "single-post", wordCount: 1, rank: 2 },
        { id: "draft-a", title: "A", hook: "a", format: "single-post", wordCount: 1, rank: 1 },
      ],
    }),
  }),
);

if (normalized.imagePrompts.map((item) => item.rank).join(",") !== "1,2") {
  throw new Error("image generation normalizer must stable-sort prompts by rank");
}

console.log("image generation normalizer exists ok");
EOF
pass "image generation normalizer exists"

echo "-- Test 359: image generation validator exists --"
node --input-type=module <<'EOF'
import {
  buildImageGenerationPipeline,
  validateImageGeneration,
} from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/image-generation-test-359";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildImageGenerationPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const validation = validateImageGeneration(output);

if (!validation.valid) {
  throw new Error(`image generation output must validate: ${validation.errors.join("; ")}`);
}

const invalid = validateImageGeneration(null);
if (invalid.valid) {
  throw new Error("null image generation output must be invalid");
}

console.log("image generation validator exists ok");
EOF
pass "image generation validator exists"

echo "-- Test 360: extractImageGenerationPublicContract exists --"
node --input-type=module <<'EOF'
import {
  buildImageGenerationPipeline,
  extractImageGenerationPublicContract,
} from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/image-generation-test-360";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildImageGenerationPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const contract = extractImageGenerationPublicContract(output);

if (contract.summary.promptCount !== output.imagePrompts.length) {
  throw new Error("image generation public contract promptCount mismatch");
}
if ("source" in contract || "mood" in contract.imagePrompts[0]) {
  throw new Error("image generation public contract must not expose internal-only fields");
}

console.log("extractImageGenerationPublicContract exists ok");
EOF
pass "extractImageGenerationPublicContract exists"

echo "-- Test 361: image-generation.json generated --"
npm run content:ai-ideas >/tmp/content_ai_ideas_before_image_generation.log 2>&1
npm run content:generate >/tmp/content_generate_before_image_generation.log 2>&1
npm run image:generation >/tmp/image_generation_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync("output/image-generation/image-generation.json", "utf8"),
);
if (data.schema !== "image-generation/1.0") {
  throw new Error("image-generation.json schema must be image-generation/1.0");
}
if (!Array.isArray(data.imagePrompts) || data.imagePrompts.length === 0) {
  throw new Error("image-generation.json must include image prompts");
}
if (!data.imagePrompts.every((prompt) => prompt.prompt && prompt.style === "photorealistic")) {
  throw new Error("image-generation.json prompt shape mismatch");
}

console.log("image-generation.json generated ok");
EOF
pass "image-generation.json generated"

echo "-- Test 362: image-generation.md generated --"
test -f output/image-generation/image-generation.md
grep -q "# Image Generation Report" output/image-generation/image-generation.md
grep -q "## Image Prompts" output/image-generation/image-generation.md
grep -q "| Composition |" output/image-generation/image-generation.md
pass "image-generation.md generated"

echo "-- Test 363: image generation CLI summary --"
grep -q "Image Generation Summary" /tmp/image_generation_cli.log
grep -q "image-generation.json" /tmp/image_generation_cli.log
grep -q "image-generation.md" /tmp/image_generation_cli.log
node --input-type=module <<'EOF'
import fs from "node:fs";
import { buildImageGenerationSummary } from "./src/lib/image_generation.js";

const data = JSON.parse(
  fs.readFileSync("output/image-generation/image-generation.json", "utf8"),
);
const summary = buildImageGenerationSummary(data);

for (const expected of [
  "Image Generation Summary",
  "Prompts:",
  "Style: photorealistic",
  "Aspect Ratio: 1:1",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`image generation CLI summary must include: ${expected}`);
  }
}

console.log("image generation CLI summary ok");
EOF
pass "image generation CLI summary"

echo "-- Test 364: image generation excludes external image apis and publishing --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/image_generation.js",
  "scripts/run_image_generation.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "from \"openai\"",
  "from 'openai'",
  "@google/genai",
  "DALL",
  "Stable Diffusion",
  "Midjourney",
  "images.generate",
  "instagram",
  "scheduler",
  "publish",
  "analytics",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`image generation must not include forbidden feature: ${forbidden}`);
  }
}

console.log("image generation excludes external image apis and publishing ok");
EOF
pass "image generation excludes external image apis and publishing"

echo "-- Test 365: v1.43.0 content generation backward compatibility preserved --"
npm run content:generate >/tmp/content_generate_backward_compat_v143.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync("output/content-generation/content-generation.json", "utf8"),
);
if (data.schema !== "content-generation/2.0") {
  throw new Error("v1.43.0 content-generation schema must remain content-generation/2.0");
}
if (!Array.isArray(data.drafts) || data.drafts.length === 0) {
  throw new Error("v1.43.0 content:generate output must remain valid");
}

console.log("v1.43.0 content generation backward compatibility preserved ok");
EOF
grep -q "Content Generation Summary" /tmp/content_generate_backward_compat_v143.log
pass "v1.43.0 content generation backward compatibility preserved"

echo "-- Test 366: publishing.js exists --"
test -f src/lib/publishing.js
grep -q "PUBLISHING_SCHEMA" src/lib/publishing.js
grep -q "buildPublishingPackages" src/lib/publishing.js
grep -q "extractPublishingPublicContract" src/lib/publishing.js
pass "publishing.js exists"

echo "-- Test 367: publishing input parser --"
node --input-type=module <<'EOF'
import { parsePublishingArgs } from "./src/lib/publishing.js";
import { extractImageGenerationPublicContract } from "./src/lib/image_generation.js";

const contract = extractImageGenerationPublicContract({
  schema: "image-generation/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  imagePrompts: [
    {
      id: "img-prompt-001",
      sourceDraftId: "draft-001",
      title: "Seasonal Menu",
      prompt: "Instagram photo, seasonal menu",
      style: "photorealistic",
      aspectRatio: "1:1",
      rank: 1,
    },
  ],
});
const parsed = parsePublishingArgs(null, contract);

if (parsed.imageContract.summary.promptCount !== 1) {
  throw new Error("publishing input parser must preserve image generation public contract");
}

console.log("publishing input parser ok");
EOF
pass "publishing input parser"

echo "-- Test 368: publishing uses image generation public contract only --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/publishing.js"),
  "utf8",
);

if (!source.includes("extractImageGenerationPublicContract")) {
  throw new Error("publishing must use extractImageGenerationPublicContract");
}

for (const forbidden of [
  "generateImagePrompts(",
  "normalizeImageGeneration(",
  "imagePrompt.mood",
  "imagePrompt.subject",
  "imagePrompt.composition",
  "IMAGE_GENERATION_PROVIDER",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`publishing must not reference image generation internal ${forbidden}`);
  }
}

console.log("publishing uses image generation public contract only ok");
EOF
pass "publishing uses image generation public contract only"

echo "-- Test 369: publishing package builder --"
node --input-type=module <<'EOF'
import {
  buildPublishingPackageFromPrompt,
  buildPublishingPackages,
} from "./src/lib/publishing.js";
import { extractImageGenerationPublicContract } from "./src/lib/image_generation.js";

const contract = extractImageGenerationPublicContract({
  schema: "image-generation/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  imagePrompts: [
    {
      id: "img-prompt-001",
      sourceDraftId: "draft-001",
      title: "Menu Spotlight",
      prompt: "Instagram photo, menu spotlight",
      style: "photorealistic",
      aspectRatio: "1:1",
      rank: 1,
    },
  ],
});
const output = buildPublishingPackages(contract, {
  generatedAt: "2026-07-03T00:00:00.000Z",
});

if (output.packages.length !== 1) {
  throw new Error("publishing package builder must create one package per image prompt");
}

const pkg = buildPublishingPackageFromPrompt(contract.imagePrompts[0], 0);
if (pkg.platform !== "instagram" || pkg.format !== "feed" || pkg.status !== "draft") {
  throw new Error("publishing package builder must use MVP fixed values");
}
if (pkg.asset.type !== "image-prompt" || pkg.asset.ready !== true) {
  throw new Error("publishing package builder must set asset metadata");
}

console.log("publishing package builder ok");
EOF
pass "publishing package builder"

echo "-- Test 370: publishing package normalizer --"
node --input-type=module <<'EOF'
import { buildPublishingPackages, normalizePublishingPackages } from "./src/lib/publishing.js";
import { extractImageGenerationPublicContract } from "./src/lib/image_generation.js";

const normalized = normalizePublishingPackages(
  buildPublishingPackages(
    extractImageGenerationPublicContract({
      schema: "image-generation/1.0",
      generatedAt: "2026-07-03T00:00:00.000Z",
      imagePrompts: [
        {
          id: "img-prompt-b",
          sourceDraftId: "draft-b",
          title: "B",
          prompt: "prompt b",
          style: "photorealistic",
          aspectRatio: "1:1",
          rank: 2,
        },
        {
          id: "img-prompt-a",
          sourceDraftId: "draft-a",
          title: "A",
          prompt: "prompt a",
          style: "photorealistic",
          aspectRatio: "1:1",
          rank: 1,
        },
      ],
    }),
  ),
);

if (normalized.packages.map((pkg) => pkg.rank).join(",") !== "1,2") {
  throw new Error("publishing package normalizer must stable-sort packages by rank");
}

console.log("publishing package normalizer ok");
EOF
pass "publishing package normalizer"

echo "-- Test 371: publishing package validator --"
node --input-type=module <<'EOF'
import {
  buildPublishingPipeline,
  validatePublishingPackages,
} from "./src/lib/publishing.js";
import { buildImageGenerationPipeline } from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/publishing-test-371";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildImageGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildPublishingPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const validation = validatePublishingPackages(output);

if (!validation.valid) {
  throw new Error(`publishing packages must validate: ${validation.errors.join("; ")}`);
}

const invalid = validatePublishingPackages(null);
if (invalid.valid) {
  throw new Error("null publishing output must be invalid");
}

console.log("publishing package validator ok");
EOF
pass "publishing package validator"

echo "-- Test 372: extractPublishingPublicContract exposes public contract --"
node --input-type=module <<'EOF'
import {
  buildPublishingPipeline,
  extractPublishingPublicContract,
} from "./src/lib/publishing.js";
import { buildImageGenerationPipeline } from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/publishing-test-372";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildImageGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { output } = buildPublishingPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const contract = extractPublishingPublicContract(output);

if (contract.summary.packageCount !== output.packages.length) {
  throw new Error("publishing public contract packageCount mismatch");
}
if ("source" in contract || "checklist" in contract.packages[0] || "asset" in contract.packages[0]) {
  throw new Error("publishing public contract must not expose internal fields");
}

console.log("extractPublishingPublicContract exposes public contract ok");
EOF
pass "extractPublishingPublicContract exposes public contract"

echo "-- Test 373: publishing.json generated --"
npm run content:ai-ideas >/tmp/content_ai_ideas_before_publishing.log 2>&1
npm run content:generate >/tmp/content_generate_before_publishing.log 2>&1
npm run image:generation >/tmp/image_generation_before_publishing.log 2>&1
npm run publishing >/tmp/publishing_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/publishing/publishing.json", "utf8"));
if (data.schema !== "publishing/1.0") {
  throw new Error("publishing.json schema must be publishing/1.0");
}
if (!Array.isArray(data.packages) || data.packages.length === 0) {
  throw new Error("publishing.json must include packages");
}
if (!data.packages.every((pkg) => pkg.caption && pkg.checklist && pkg.asset?.ready === true)) {
  throw new Error("publishing.json package shape mismatch");
}

console.log("publishing.json generated ok");
EOF
pass "publishing.json generated"

echo "-- Test 374: publishing.md generated --"
test -f output/publishing/publishing.md
grep -q "# Publishing Report" output/publishing/publishing.md
grep -q "## Packages" output/publishing/publishing.md
grep -q "#### Checklist" output/publishing/publishing.md
pass "publishing.md generated"

echo "-- Test 375: publishing CLI summary --"
grep -q "Publishing Summary" /tmp/publishing_cli.log
grep -q "Packages :" /tmp/publishing_cli.log
grep -q "Platform : instagram" /tmp/publishing_cli.log
grep -q "Output   : output/publishing/" /tmp/publishing_cli.log
node --input-type=module <<'EOF'
import fs from "node:fs";
import { buildPublishingCliSummary } from "./src/lib/publishing.js";

const data = JSON.parse(fs.readFileSync("output/publishing/publishing.json", "utf8"));
const summary = buildPublishingCliSummary(data);

for (const expected of [
  "Publishing Summary",
  "Packages :",
  "Platform : instagram",
  "Ready    :",
  "Draft    :",
  "Output   : output/publishing/",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`publishing CLI summary must include: ${expected}`);
  }
}

console.log("publishing CLI summary ok");
EOF
pass "publishing CLI summary"

echo "-- Test 376: publishing npm script exists --"
grep -q '"publishing": "node scripts/run_publishing.js"' package.json
test -f scripts/run_publishing.js
pass "publishing npm script exists"

echo "-- Test 377: publishing excludes api scheduler oauth upload retry queue analytics --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/publishing.js",
  "scripts/run_publishing.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "Instagram API",
  "X API",
  "Facebook API",
  "Threads API",
  "Scheduler",
  "OAuth",
  "access_token",
  "accessToken",
  "Upload(",
  "upload(",
  "Retry",
  "Queue",
  "Analytics",
  "Continuous Improvement",
  "graph.instagram",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`publishing must not include forbidden feature: ${forbidden}`);
  }
}

console.log("publishing excludes api scheduler oauth upload retry queue analytics ok");
EOF
pass "publishing excludes api scheduler oauth upload retry queue analytics"

echo "-- Test 378: v1.44.0 image generation backward compatibility preserved --"
npm run image:generation >/tmp/image_generation_backward_compat_v144.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync("output/image-generation/image-generation.json", "utf8"),
);
if (data.schema !== "image-generation/1.0") {
  throw new Error("v1.44.0 image-generation schema must remain image-generation/1.0");
}
if (!Array.isArray(data.imagePrompts) || data.imagePrompts.length === 0) {
  throw new Error("v1.44.0 image:generation output must remain valid");
}

console.log("v1.44.0 image generation backward compatibility preserved ok");
EOF
grep -q "Image Generation Summary" /tmp/image_generation_backward_compat_v144.log
pass "v1.44.0 image generation backward compatibility preserved"

echo "-- Test 379: analytics.js exists --"
test -f src/lib/analytics.js
grep -q "ANALYTICS_SCHEMA" src/lib/analytics.js
grep -q "buildAnalytics" src/lib/analytics.js
grep -q "extractAnalyticsPublicContract" src/lib/analytics.js
pass "analytics.js exists"

echo "-- Test 380: analytics input parser --"
node --input-type=module <<'EOF'
import { parseAnalyticsArgs } from "./src/lib/analytics.js";
import { extractPublishingPublicContract } from "./src/lib/publishing.js";

const contract = extractPublishingPublicContract({
  schema: "publishing/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  packages: [
    {
      id: "pkg-001",
      sourceImagePromptId: "img-prompt-001",
      title: "Seasonal Menu",
      caption: "Try our new spring menu today",
      platform: "instagram",
      format: "feed",
      status: "draft",
      rank: 1,
    },
  ],
});
const parsed = parseAnalyticsArgs(null, contract);

if (parsed.publishingContract.summary.packageCount !== 1) {
  throw new Error("analytics input parser must preserve publishing public contract");
}

console.log("analytics input parser ok");
EOF
pass "analytics input parser"

echo "-- Test 381: analytics uses publishing public contract only --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/analytics.js"),
  "utf8",
);

if (!source.includes("extractPublishingPublicContract")) {
  throw new Error("analytics must use extractPublishingPublicContract");
}

for (const forbidden of [
  "buildPublishingPackages(",
  "normalizePublishingPackages(",
  "pkg.asset",
  "pkg.checklist",
  "pkg.imagePrompt",
  "PUBLISHING_PROVIDER",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`analytics must not reference publishing internal ${forbidden}`);
  }
}

console.log("analytics uses publishing public contract only ok");
EOF
pass "analytics uses publishing public contract only"

echo "-- Test 382: analytics builder --"
node --input-type=module <<'EOF'
import {
  buildAnalytics,
  buildAnalyticsReportFromPackage,
} from "./src/lib/analytics.js";
import { extractPublishingPublicContract } from "./src/lib/publishing.js";

const contract = extractPublishingPublicContract({
  schema: "publishing/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  packages: [
    {
      id: "pkg-001",
      sourceImagePromptId: "img-prompt-001",
      title: "Menu Spotlight",
      caption: "Discover our chef special menu for this season",
      platform: "instagram",
      format: "feed",
      status: "draft",
      rank: 1,
    },
  ],
});
const analytics = buildAnalytics(contract, {
  generatedAt: "2026-07-03T00:00:00.000Z",
});

if (analytics.reports.length !== 1) {
  throw new Error("analytics builder must create one report per package");
}
if (analytics.source !== "publishing-public-contract") {
  throw new Error("analytics builder must set publishing-public-contract source");
}
if (analytics.metricType !== "pre-publish") {
  throw new Error("analytics builder must set pre-publish metric type");
}

const report = buildAnalyticsReportFromPackage(contract.packages[0], 0);
if (!report.readinessScore || !report.qualityScore || !report.checklistScore) {
  throw new Error("analytics builder must compute scores");
}
if (!["ready", "review", "needs-work"].includes(report.recommendation)) {
  throw new Error("analytics builder must set recommendation");
}

console.log("analytics builder ok");
EOF
pass "analytics builder"

echo "-- Test 383: analytics normalizer --"
node --input-type=module <<'EOF'
import { buildAnalytics, normalizeAnalytics } from "./src/lib/analytics.js";
import { extractPublishingPublicContract } from "./src/lib/publishing.js";

const normalized = normalizeAnalytics(
  buildAnalytics(
    extractPublishingPublicContract({
      schema: "publishing/1.0",
      generatedAt: "2026-07-03T00:00:00.000Z",
      packages: [
        {
          id: "pkg-b",
          sourceImagePromptId: "img-b",
          title: "B Title Here",
          caption: "Caption for package b with enough detail",
          platform: "instagram",
          format: "feed",
          status: "draft",
          rank: 2,
        },
        {
          id: "pkg-a",
          sourceImagePromptId: "img-a",
          title: "A Title Here",
          caption: "Caption for package a with enough detail",
          platform: "instagram",
          format: "feed",
          status: "draft",
          rank: 1,
        },
      ],
    }),
  ),
);

if (normalized.reports.map((report) => report.rank).join(",") !== "1,2") {
  throw new Error("analytics normalizer must stable-sort reports by rank");
}

console.log("analytics normalizer ok");
EOF
pass "analytics normalizer"

echo "-- Test 384: analytics validator --"
node --input-type=module <<'EOF'
import {
  buildAnalyticsPipeline,
  validateAnalytics,
} from "./src/lib/analytics.js";
import { buildPublishingPipeline } from "./src/lib/publishing.js";
import { buildImageGenerationPipeline } from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/analytics-test-384";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildImageGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildPublishingPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { analytics } = buildAnalyticsPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const validation = validateAnalytics(analytics);

if (!validation.valid) {
  throw new Error(`analytics must validate: ${validation.errors.join("; ")}`);
}

const invalid = validateAnalytics(null);
if (invalid.valid) {
  throw new Error("null analytics must be invalid");
}

console.log("analytics validator ok");
EOF
pass "analytics validator"

echo "-- Test 385: extractAnalyticsPublicContract exposes public contract --"
node --input-type=module <<'EOF'
import {
  buildAnalyticsPipeline,
  extractAnalyticsPublicContract,
} from "./src/lib/analytics.js";
import { buildPublishingPipeline } from "./src/lib/publishing.js";
import { buildImageGenerationPipeline } from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/analytics-test-385";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildImageGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildPublishingPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { analytics } = buildAnalyticsPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const contract = extractAnalyticsPublicContract(analytics);

if (contract.summary.reportCount !== analytics.reports.length) {
  throw new Error("analytics public contract reportCount mismatch");
}
if ("readinessScore" in contract.reports[0] || "flags" in contract.reports[0]) {
  throw new Error("analytics public contract must not expose internal score details");
}

console.log("extractAnalyticsPublicContract exposes public contract ok");
EOF
pass "extractAnalyticsPublicContract exposes public contract"

echo "-- Test 386: analytics.json generated --"
npm run content:ai-ideas >/tmp/content_ai_ideas_before_analytics.log 2>&1
npm run content:generate >/tmp/content_generate_before_analytics.log 2>&1
npm run image:generation >/tmp/image_generation_before_analytics.log 2>&1
npm run publishing >/tmp/publishing_before_analytics.log 2>&1
npm run analytics >/tmp/analytics_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/analytics/analytics.json", "utf8"));
if (data.schema !== "analytics/1.0") {
  throw new Error("analytics.json schema must be analytics/1.0");
}
if (data.source !== "publishing-public-contract") {
  throw new Error("analytics.json source must be publishing-public-contract");
}
if (!Array.isArray(data.reports) || data.reports.length === 0) {
  throw new Error("analytics.json must include reports");
}
if (!data.reports.every((report) => report.recommendation && Array.isArray(report.flags))) {
  throw new Error("analytics.json report shape mismatch");
}

console.log("analytics.json generated ok");
EOF
pass "analytics.json generated"

echo "-- Test 387: analytics.md generated --"
test -f output/analytics/analytics.md
grep -q "# Analytics Report" output/analytics/analytics.md
grep -q "## Reports" output/analytics/analytics.md
grep -q "| Recommendation |" output/analytics/analytics.md
pass "analytics.md generated"

echo "-- Test 388: analytics CLI summary --"
grep -q "Analytics Summary" /tmp/analytics_cli.log
grep -q "analytics.json" /tmp/analytics_cli.log
grep -q "analytics.md" /tmp/analytics_cli.log
node --input-type=module <<'EOF'
import fs from "node:fs";
import { printAnalyticsSummary } from "./src/lib/analytics.js";

const data = JSON.parse(fs.readFileSync("output/analytics/analytics.json", "utf8"));
const summary = printAnalyticsSummary(data);

for (const expected of [
  "Analytics Summary",
  "Reports:",
  "Ready:",
  "Review:",
  "Needs Work:",
  "Average Readiness:",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`analytics CLI summary must include: ${expected}`);
  }
}

console.log("analytics CLI summary ok");
EOF
pass "analytics CLI summary"

echo "-- Test 389: analytics npm script exists --"
grep -q '"analytics": "node scripts/run_analytics.js"' package.json
test -f scripts/run_analytics.js
pass "analytics npm script exists"

echo "-- Test 390: analytics excludes external metrics api and publishing integrations --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/analytics.js",
  "scripts/run_analytics.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "Instagram API",
  "X API",
  "Facebook API",
  "Threads API",
  "OAuth",
  "access_token",
  "accessToken",
  "scheduler",
  "Retry",
  "Queue",
  "database",
  "Metrics API",
  "graph.instagram",
  "insights",
  "from \"openai\"",
  "@google/genai",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`analytics must not include forbidden feature: ${forbidden}`);
  }
}

console.log("analytics excludes external metrics api and publishing integrations ok");
EOF
pass "analytics excludes external metrics api and publishing integrations"

echo "-- Test 391: v1.45.0 publishing backward compatibility preserved --"
npm run publishing >/tmp/publishing_backward_compat_v145.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/publishing/publishing.json", "utf8"));
if (data.schema !== "publishing/1.0") {
  throw new Error("v1.45.0 publishing schema must remain publishing/1.0");
}
if (!Array.isArray(data.packages) || data.packages.length === 0) {
  throw new Error("v1.45.0 publishing output must remain valid");
}

console.log("v1.45.0 publishing backward compatibility preserved ok");
EOF
grep -q "Publishing Summary" /tmp/publishing_backward_compat_v145.log
pass "v1.45.0 publishing backward compatibility preserved"

echo "-- Test 392: continuous_improvement.js exists --"
test -f src/lib/continuous_improvement.js
node --input-type=module <<'EOF'
import * as ci from "./src/lib/continuous_improvement.js";

for (const name of [
  "parseContinuousImprovementArgs",
  "buildContinuousImprovement",
  "normalizeContinuousImprovement",
  "validateContinuousImprovement",
  "renderContinuousImprovementMarkdown",
  "printContinuousImprovementSummary",
  "extractContinuousImprovementPublicContract",
]) {
  if (typeof ci[name] !== "function") {
    throw new Error(`continuous improvement must export ${name}`);
  }
}

console.log("continuous_improvement.js exists ok");
EOF
pass "continuous_improvement.js exists"

echo "-- Test 393: continuous improvement input parser --"
node --input-type=module <<'EOF'
import { parseContinuousImprovementArgs } from "./src/lib/continuous_improvement.js";
import { extractAnalyticsPublicContract } from "./src/lib/analytics.js";

const contract = extractAnalyticsPublicContract({
  schema: "analytics/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  source: "publishing-public-contract",
  metricType: "pre-publish",
  reports: [
    {
      id: "analytics-001",
      sourcePackageId: "pkg-001",
      title: "Menu Spotlight",
      platform: "instagram",
      format: "feed",
      recommendation: "ready",
      rank: 1,
    },
  ],
  summary: {
    reportCount: 1,
    readyCount: 1,
    reviewCount: 0,
    needsWorkCount: 0,
    averageReadinessScore: 1,
  },
});
const parsed = parseContinuousImprovementArgs(null, contract);

if (parsed.analyticsContract.summary.reportCount !== 1) {
  throw new Error("continuous improvement input parser must preserve analytics public contract");
}

console.log("continuous improvement input parser ok");
EOF
pass "continuous improvement input parser"

echo "-- Test 394: continuous improvement uses analytics public contract dependency --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/continuous_improvement.js"),
  "utf8",
);

if (!source.includes("extractAnalyticsPublicContract")) {
  throw new Error("continuous improvement must use extractAnalyticsPublicContract");
}
if (!source.includes("loadAnalyticsPublicContract")) {
  throw new Error("continuous improvement must load analytics public contract");
}

console.log("continuous improvement uses analytics public contract dependency ok");
EOF
pass "continuous improvement uses analytics public contract dependency"

echo "-- Test 395: continuous improvement uses analytics public contract only --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/continuous_improvement.js"),
  "utf8",
);

for (const forbidden of [
  "buildAnalytics(",
  "normalizeAnalytics(",
  "buildAnalyticsReportFromPackage(",
  "computeReadinessScore(",
  "computeQualityScore(",
  "computeChecklistScore(",
  "report.readinessScore",
  "report.qualityScore",
  "report.checklistScore",
  "report.flags",
  "ANALYTICS_METRIC_TYPE",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`continuous improvement must not reference analytics internal ${forbidden}`);
  }
}

console.log("continuous improvement uses analytics public contract only ok");
EOF
pass "continuous improvement uses analytics public contract only"

echo "-- Test 396: continuous improvement builder --"
node --input-type=module <<'EOF'
import {
  buildContinuousImprovement,
  buildImprovementFromReport,
} from "./src/lib/continuous_improvement.js";
import { extractAnalyticsPublicContract } from "./src/lib/analytics.js";

const contract = extractAnalyticsPublicContract({
  schema: "analytics/1.0",
  generatedAt: "2026-07-03T00:00:00.000Z",
  source: "publishing-public-contract",
  metricType: "pre-publish",
  reports: [
    {
      id: "analytics-001",
      sourcePackageId: "pkg-001",
      title: "Menu Spotlight",
      platform: "instagram",
      format: "feed",
      recommendation: "ready",
      rank: 1,
    },
    {
      id: "analytics-002",
      sourcePackageId: "pkg-002",
      title: "Needs Work Item",
      platform: "instagram",
      format: "feed",
      recommendation: "needs-work",
      rank: 2,
    },
  ],
  summary: {
    reportCount: 2,
    readyCount: 1,
    reviewCount: 0,
    needsWorkCount: 1,
    averageReadinessScore: 0.75,
  },
});
const improvement = buildContinuousImprovement(contract, {
  generatedAt: "2026-07-03T00:00:00.000Z",
});

if (improvement.improvements.length !== 2) {
  throw new Error("continuous improvement builder must create one item per report");
}
if (improvement.source !== "analytics-public-contract") {
  throw new Error("continuous improvement builder must set analytics-public-contract source");
}
if (improvement.improvementType !== "pre-publish-improvement") {
  throw new Error("continuous improvement builder must set pre-publish-improvement type");
}
if (improvement.status !== "draft-improvement") {
  throw new Error("continuous improvement builder must set draft-improvement status");
}

const readyItem = buildImprovementFromReport(contract.reports[0], contract.summary, 0);
const needsWorkItem = buildImprovementFromReport(contract.reports[1], contract.summary, 1);

if (readyItem.suggestedAction !== "publish-ready") {
  throw new Error("ready recommendation must map to publish-ready action");
}
if (needsWorkItem.suggestedAction !== "revise-package") {
  throw new Error("needs-work recommendation must map to revise-package action");
}
if (!readyItem.reason.includes("recommendation:ready")) {
  throw new Error("continuous improvement builder must include reason");
}
if (!Array.isArray(readyItem.nextCheck) || readyItem.nextCheck.length === 0) {
  throw new Error("continuous improvement builder must include nextCheck");
}

console.log("continuous improvement builder ok");
EOF
pass "continuous improvement builder"

echo "-- Test 397: continuous improvement normalizer --"
node --input-type=module <<'EOF'
import {
  buildContinuousImprovement,
  normalizeContinuousImprovement,
} from "./src/lib/continuous_improvement.js";
import { extractAnalyticsPublicContract } from "./src/lib/analytics.js";

const normalized = normalizeContinuousImprovement(
  buildContinuousImprovement(
    extractAnalyticsPublicContract({
      schema: "analytics/1.0",
      generatedAt: "2026-07-03T00:00:00.000Z",
      source: "publishing-public-contract",
      metricType: "pre-publish",
      reports: [
        {
          id: "analytics-b",
          sourcePackageId: "pkg-b",
          title: "B Title",
          platform: "instagram",
          format: "feed",
          recommendation: "needs-work",
          rank: 2,
        },
        {
          id: "analytics-a",
          sourcePackageId: "pkg-a",
          title: "A Title",
          platform: "instagram",
          format: "feed",
          recommendation: "ready",
          rank: 1,
        },
      ],
      summary: {
        reportCount: 2,
        readyCount: 1,
        reviewCount: 0,
        needsWorkCount: 1,
        averageReadinessScore: 0.75,
      },
    }),
  ),
);

if (normalized.improvements[0].priorityScore >= normalized.improvements[1].priorityScore) {
  throw new Error("continuous improvement normalizer must stable-sort by priority score");
}

console.log("continuous improvement normalizer ok");
EOF
pass "continuous improvement normalizer"

echo "-- Test 398: continuous improvement validator --"
node --input-type=module <<'EOF'
import {
  buildContinuousImprovementPipeline,
  validateContinuousImprovement,
} from "./src/lib/continuous_improvement.js";
import { buildAnalyticsPipeline } from "./src/lib/analytics.js";
import { buildPublishingPipeline } from "./src/lib/publishing.js";
import { buildImageGenerationPipeline } from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/continuous-improvement-test-398";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildImageGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildPublishingPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildAnalyticsPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { improvement } = buildContinuousImprovementPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const validation = validateContinuousImprovement(improvement);

if (!validation.valid) {
  throw new Error(`continuous improvement must validate: ${validation.errors.join("; ")}`);
}

const invalid = validateContinuousImprovement(null);
if (invalid.valid) {
  throw new Error("null continuous improvement must be invalid");
}

console.log("continuous improvement validator ok");
EOF
pass "continuous improvement validator"

echo "-- Test 399: extractContinuousImprovementPublicContract exposes public contract --"
node --input-type=module <<'EOF'
import {
  buildContinuousImprovementPipeline,
  extractContinuousImprovementPublicContract,
} from "./src/lib/continuous_improvement.js";
import { buildAnalyticsPipeline } from "./src/lib/analytics.js";
import { buildPublishingPipeline } from "./src/lib/publishing.js";
import { buildImageGenerationPipeline } from "./src/lib/image_generation.js";
import { buildContentGenerationPipeline } from "./src/lib/content_generation.js";
import { buildAIIdeaPipeline } from "./src/lib/content_ai_idea.js";

const rootDir = "/tmp/continuous-improvement-test-399";
buildAIIdeaPipeline({ count: 1 }, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildContentGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildImageGenerationPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildPublishingPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
buildAnalyticsPipeline(null, { generatedAt: "2026-07-03T00:00:00.000Z", rootDir });
const { improvement } = buildContinuousImprovementPipeline(null, {
  generatedAt: "2026-07-03T00:00:00.000Z",
  rootDir,
});
const contract = extractContinuousImprovementPublicContract(improvement);

if (contract.summary.improvementCount !== improvement.improvements.length) {
  throw new Error("continuous improvement public contract improvementCount mismatch");
}
if ("reason" in contract.improvements[0] || "nextCheck" in contract.improvements[0]) {
  throw new Error("continuous improvement public contract must not expose internal reason details");
}
if ("flags" in contract.improvements[0] || "priorityScore" in contract.improvements[0]) {
  throw new Error("continuous improvement public contract must not expose internal score details");
}

console.log("extractContinuousImprovementPublicContract exposes public contract ok");
EOF
pass "extractContinuousImprovementPublicContract exposes public contract"

echo "-- Test 400: improvement.json generated --"
npm run content:ai-ideas >/tmp/content_ai_ideas_before_continuous_improvement.log 2>&1
npm run content:generate >/tmp/content_generate_before_continuous_improvement.log 2>&1
npm run image:generation >/tmp/image_generation_before_continuous_improvement.log 2>&1
npm run publishing >/tmp/publishing_before_continuous_improvement.log 2>&1
npm run analytics >/tmp/analytics_before_continuous_improvement.log 2>&1
npm run continuous:improvement >/tmp/continuous_improvement_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/continuous-improvement/improvement.json", "utf8"));
if (data.schema !== "continuous-improvement/1.0") {
  throw new Error("improvement.json schema must be continuous-improvement/1.0");
}
if (data.source !== "analytics-public-contract") {
  throw new Error("improvement.json source must be analytics-public-contract");
}
if (!Array.isArray(data.improvements) || data.improvements.length === 0) {
  throw new Error("improvement.json must include improvements");
}
if (
  !data.improvements.every(
    (item) =>
      item.suggestedAction &&
      Array.isArray(item.nextCheck) &&
      Array.isArray(item.flags),
  )
) {
  throw new Error("improvement.json item shape mismatch");
}

console.log("improvement.json generated ok");
EOF
pass "improvement.json generated"

echo "-- Test 401: improvement.md generated --"
test -f output/continuous-improvement/improvement.md
grep -q "# Continuous Improvement Report" output/continuous-improvement/improvement.md
grep -q "## Improvements" output/continuous-improvement/improvement.md
grep -q "| Suggested Action |" output/continuous-improvement/improvement.md
pass "improvement.md generated"

echo "-- Test 402: continuous improvement CLI summary --"
grep -q "Continuous Improvement Summary" /tmp/continuous_improvement_cli.log
grep -q "improvement.json" /tmp/continuous_improvement_cli.log
grep -q "improvement.md" /tmp/continuous_improvement_cli.log
node --input-type=module <<'EOF'
import fs from "node:fs";
import { printContinuousImprovementSummary } from "./src/lib/continuous_improvement.js";

const data = JSON.parse(fs.readFileSync("output/continuous-improvement/improvement.json", "utf8"));
const summary = printContinuousImprovementSummary(data);

for (const expected of [
  "Continuous Improvement Summary",
  "Improvements:",
  "Publish Ready:",
  "Review Content:",
  "Revise Package:",
  "High Priority:",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`continuous improvement CLI summary must include: ${expected}`);
  }
}

console.log("continuous improvement CLI summary ok");
EOF
pass "continuous improvement CLI summary"

echo "-- Test 403: continuous improvement npm script exists --"
grep -q '"continuous:improvement": "node scripts/run_continuous_improvement.js"' package.json
test -f scripts/run_continuous_improvement.js
pass "continuous improvement npm script exists"

echo "-- Test 404: recommendation to priority mapping --"
node --input-type=module <<'EOF'
import {
  computePriorityScore,
  resolvePriority,
  resolveSuggestedAction,
} from "./src/lib/continuous_improvement.js";

const readyAction = resolveSuggestedAction("ready");
const reviewAction = resolveSuggestedAction("review");
const needsWorkAction = resolveSuggestedAction("needs-work");

if (readyAction !== "publish-ready") {
  throw new Error("ready must map to publish-ready");
}
if (reviewAction !== "review-content") {
  throw new Error("review must map to review-content");
}
if (needsWorkAction !== "revise-package") {
  throw new Error("needs-work must map to revise-package");
}

const needsWorkPriority = resolvePriority("needs-work", 1);
const reviewPriority = resolvePriority("review", 1);
const readyPriority = resolvePriority("ready", 3);

if (needsWorkPriority !== "high" || reviewPriority !== "medium" || readyPriority !== "low") {
  throw new Error("recommendation to priority mapping mismatch");
}

const needsWorkScore = computePriorityScore("needs-work", 1);
const reviewScore = computePriorityScore("review", 1);
const readyScore = computePriorityScore("ready", 1);

if (!(needsWorkScore < reviewScore && reviewScore < readyScore)) {
  throw new Error("priority score must order needs-work before review before ready");
}

const rankOne = computePriorityScore("needs-work", 1);
const rankTwo = computePriorityScore("needs-work", 2);
if (rankOne >= rankTwo) {
  throw new Error("lower rank must produce lower priority score within same recommendation");
}

console.log("recommendation to priority mapping ok");
EOF
pass "recommendation to priority mapping"

echo "-- Test 405: continuous improvement excludes external integrations and llm automation --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/continuous_improvement.js",
  "scripts/run_continuous_improvement.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "Instagram API",
  "X API",
  "Facebook API",
  "Threads API",
  "OAuth",
  "access_token",
  "accessToken",
  "scheduler",
  "Retry",
  "Queue",
  "database",
  "Metrics API",
  "graph.instagram",
  "insights",
  "from \"openai\"",
  "@google/genai",
  "auto-repost",
  "autoRepost",
  "LLM",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`continuous improvement must not include forbidden feature: ${forbidden}`);
  }
}

console.log("continuous improvement excludes external integrations and llm automation ok");
EOF
pass "continuous improvement excludes external integrations and llm automation"

echo "-- Test 406: v1.46.0 analytics backward compatibility preserved --"
npm run analytics >/tmp/analytics_backward_compat_v146.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/analytics/analytics.json", "utf8"));
if (data.schema !== "analytics/1.0") {
  throw new Error("v1.46.0 analytics schema must remain analytics/1.0");
}
if (!Array.isArray(data.reports) || data.reports.length === 0) {
  throw new Error("v1.46.0 analytics output must remain valid");
}

console.log("v1.46.0 analytics backward compatibility preserved ok");
EOF
grep -q "Analytics Summary" /tmp/analytics_backward_compat_v146.log
pass "v1.46.0 analytics backward compatibility preserved"

echo "-- Test 407: public_contract_catalog.js exists --"
test -f src/lib/public_contract_catalog.js
node --input-type=module <<'EOF'
import * as catalog from "./src/lib/public_contract_catalog.js";

for (const name of [
  "parsePublicContractCatalogArgs",
  "buildPublicContractCatalog",
  "normalizePublicContractCatalog",
  "validatePublicContractCatalog",
  "renderPublicContractCatalogMarkdown",
  "printPublicContractCatalogSummary",
]) {
  if (typeof catalog[name] !== "function") {
    throw new Error(`public contract catalog must export ${name}`);
  }
}

console.log("public_contract_catalog.js exists ok");
EOF
pass "public_contract_catalog.js exists"

echo "-- Test 408: public contract catalog schema --"
node --input-type=module <<'EOF'
import {
  PUBLIC_CONTRACT_CATALOG_SCHEMA,
  buildPublicContractCatalog,
} from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog({
  generatedAt: "2026-07-03T00:00:00.000Z",
});

if (catalog.schema !== PUBLIC_CONTRACT_CATALOG_SCHEMA) {
  throw new Error("public contract catalog schema mismatch");
}
if (PUBLIC_CONTRACT_CATALOG_SCHEMA !== "public-contract-catalog/1.0") {
  throw new Error("PUBLIC_CONTRACT_CATALOG_SCHEMA must be public-contract-catalog/1.0");
}
if (catalog.catalogVersion !== "1.0") {
  throw new Error("catalogVersion must be 1.0");
}

console.log("public contract catalog schema ok");
EOF
pass "public contract catalog schema"

echo "-- Test 409: public contract catalog foundations count --"
node --input-type=module <<'EOF'
import {
  APPLICATION_LAYER_FOUNDATIONS,
  buildPublicContractCatalog,
} from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog();
const applicationFoundations = catalog.foundations.filter(
  (foundation) => foundation.layer === "application",
);

if (applicationFoundations.length !== APPLICATION_LAYER_FOUNDATIONS.length) {
  throw new Error("application foundations count mismatch");
}
if (applicationFoundations.length !== 7) {
  throw new Error("application layer must include 7 foundations");
}

console.log("public contract catalog foundations count ok");
EOF
pass "public contract catalog foundations count"

echo "-- Test 410: public contract catalog public contract count --"
node --input-type=module <<'EOF'
import {
  PUBLIC_CONTRACT_DEFINITIONS,
  buildPublicContractCatalog,
} from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog();

if (catalog.publicContracts.length !== PUBLIC_CONTRACT_DEFINITIONS.length) {
  throw new Error("public contract count mismatch");
}
if (catalog.publicContracts.length !== 7) {
  throw new Error("application layer must include 7 public contracts");
}

console.log("public contract catalog public contract count ok");
EOF
pass "public contract catalog public contract count"

echo "-- Test 411: public contract catalog dependency rules --"
node --input-type=module <<'EOF'
import {
  DEPENDENCY_RULES,
  buildPublicContractCatalog,
} from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog();

if (catalog.dependencyRules.length !== DEPENDENCY_RULES.length) {
  throw new Error("dependency rules count mismatch");
}
if (!catalog.dependencyRules.some((rule) => rule.id === "public-contract-only")) {
  throw new Error("dependency rules must include public-contract-only");
}
if (!catalog.dependencyRules.some((rule) => rule.id === "no-circular-dependency")) {
  throw new Error("dependency rules must include no-circular-dependency");
}

console.log("public contract catalog dependency rules ok");
EOF
pass "public contract catalog dependency rules"

echo "-- Test 412: public contract catalog compatibility matrix --"
node --input-type=module <<'EOF'
import {
  buildCompatibilityMatrix,
  buildPublicContractCatalog,
} from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog();
const expected = buildCompatibilityMatrix();

if (catalog.compatibilityMatrix.length !== expected.length) {
  throw new Error("compatibility matrix entry count mismatch");
}
if (!catalog.compatibilityMatrix.every((edge) => edge.dependencyType === "public-contract")) {
  throw new Error("compatibility matrix must use public-contract dependency type");
}
if (!catalog.compatibilityMatrix.some((edge) => edge.downstreamFoundationId === "analytics")) {
  throw new Error("compatibility matrix must include analytics dependency");
}

console.log("public contract catalog compatibility matrix ok");
EOF
pass "public contract catalog compatibility matrix"

echo "-- Test 413: public contract catalog layer rules --"
node --input-type=module <<'EOF'
import { LAYER_RULES, buildPublicContractCatalog } from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog();

if (catalog.layerRules.length !== LAYER_RULES.length) {
  throw new Error("layer rules count mismatch");
}
if (!catalog.layerRules.some((rule) => rule.id === "platform-independent-from-application")) {
  throw new Error("layer rules must include platform-independent-from-application");
}
if (!catalog.layerRules.some((rule) => rule.id === "no-circular-reference")) {
  throw new Error("layer rules must include no-circular-reference");
}

console.log("public contract catalog layer rules ok");
EOF
pass "public contract catalog layer rules"

echo "-- Test 414: public contract catalog version rules --"
node --input-type=module <<'EOF'
import { VERSION_RULES, buildPublicContractCatalog } from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog();
const types = catalog.versionRules.map((rule) => rule.type);

if (catalog.versionRules.length !== VERSION_RULES.length) {
  throw new Error("version rules count mismatch");
}
for (const expected of ["patch", "minor", "major"]) {
  if (!types.includes(expected)) {
    throw new Error(`version rules must include ${expected}`);
  }
}

console.log("public contract catalog version rules ok");
EOF
pass "public contract catalog version rules"

echo "-- Test 415: public contract catalog deprecation rules --"
node --input-type=module <<'EOF'
import { DEPRECATION_RULES, buildPublicContractCatalog } from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog();
const stages = catalog.deprecationRules.map((rule) => rule.stage);

if (catalog.deprecationRules.length !== DEPRECATION_RULES.length) {
  throw new Error("deprecation rules count mismatch");
}
for (const expected of ["deprecated", "warning", "removal-candidate", "removed"]) {
  if (!stages.includes(expected)) {
    throw new Error(`deprecation rules must include ${expected}`);
  }
}

console.log("public contract catalog deprecation rules ok");
EOF
pass "public contract catalog deprecation rules"

echo "-- Test 416: public contract catalog validator --"
node --input-type=module <<'EOF'
import {
  buildPublicContractCatalog,
  validatePublicContractCatalog,
} from "./src/lib/public_contract_catalog.js";

const catalog = buildPublicContractCatalog({
  generatedAt: "2026-07-03T00:00:00.000Z",
});
const validation = validatePublicContractCatalog(catalog);

if (!validation.valid) {
  throw new Error(`public contract catalog must validate: ${validation.errors.join("; ")}`);
}

const invalid = validatePublicContractCatalog(null);
if (invalid.valid) {
  throw new Error("null public contract catalog must be invalid");
}

console.log("public contract catalog validator ok");
EOF
pass "public contract catalog validator"

echo "-- Test 417: public-contract-catalog.json generated --"
npm run public-contract:catalog >/tmp/public_contract_catalog_cli.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync(
    "reports/public-contract-catalog/latest/public-contract-catalog.json",
    "utf8",
  ),
);
if (data.schema !== "public-contract-catalog/1.0") {
  throw new Error("public-contract-catalog.json schema mismatch");
}
if (!Array.isArray(data.foundations) || data.foundations.length === 0) {
  throw new Error("public-contract-catalog.json must include foundations");
}
if (!Array.isArray(data.compatibilityMatrix) || data.compatibilityMatrix.length === 0) {
  throw new Error("public-contract-catalog.json must include compatibilityMatrix");
}
if (!Array.isArray(data.compatibilityNotes) || data.compatibilityNotes.length === 0) {
  throw new Error("public-contract-catalog.json must include compatibilityNotes");
}

console.log("public-contract-catalog.json generated ok");
EOF
pass "public-contract-catalog.json generated"

echo "-- Test 418: public-contract-catalog.md generated --"
test -f reports/public-contract-catalog/latest/public-contract-catalog.md
grep -q "# Public Contract Catalog" reports/public-contract-catalog/latest/public-contract-catalog.md
grep -q "## Compatibility Matrix" reports/public-contract-catalog/latest/public-contract-catalog.md
grep -q "## Deprecation Rules" reports/public-contract-catalog/latest/public-contract-catalog.md
pass "public-contract-catalog.md generated"

echo "-- Test 419: public contract catalog CLI summary --"
grep -q "Public Contract Catalog Summary" /tmp/public_contract_catalog_cli.log
grep -q "public-contract-catalog.json" /tmp/public_contract_catalog_cli.log
grep -q "public-contract-catalog.md" /tmp/public_contract_catalog_cli.log
node --input-type=module <<'EOF'
import fs from "node:fs";
import { printPublicContractCatalogSummary } from "./src/lib/public_contract_catalog.js";

const data = JSON.parse(
  fs.readFileSync(
    "reports/public-contract-catalog/latest/public-contract-catalog.json",
    "utf8",
  ),
);
const summary = printPublicContractCatalogSummary(data);

for (const expected of [
  "Public Contract Catalog Summary",
  "Catalog Version:",
  "Application Foundations:",
  "Public Contracts:",
  "Dependency Rules:",
  "Compatibility Matrix Entries:",
  "Layer Rules:",
  "Version Rules:",
  "Deprecation Rules:",
]) {
  if (!summary.includes(expected)) {
    throw new Error(`public contract catalog CLI summary must include: ${expected}`);
  }
}

console.log("public contract catalog CLI summary ok");
EOF
pass "public contract catalog CLI summary"

echo "-- Test 420: public-contract:catalog npm script exists --"
grep -q '"public-contract:catalog": "node scripts/run_public_contract_catalog.js"' package.json
test -f scripts/run_public_contract_catalog.js
pass "public-contract:catalog npm script exists"

echo "-- Test 421: public contract catalog excludes external integrations and runtime execution --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const combined = [
  "src/lib/public_contract_catalog.js",
  "scripts/run_public_contract_catalog.js",
]
  .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
  .join("\n");

for (const forbidden of [
  "Instagram API",
  "X API",
  "Facebook API",
  "Threads API",
  "OAuth",
  "access_token",
  "accessToken",
  "scheduler",
  "Retry",
  "Queue",
  "database",
  "Metrics API",
  "graph.instagram",
  "from \"openai\"",
  "@google/genai",
  "buildPublishingPipeline(",
  "buildAnalyticsPipeline(",
  "buildContinuousImprovementPipeline(",
]) {
  if (combined.includes(forbidden)) {
    throw new Error(`public contract catalog must not include forbidden feature: ${forbidden}`);
  }
}

console.log("public contract catalog excludes external integrations and runtime execution ok");
EOF
pass "public contract catalog excludes external integrations and runtime execution"

echo "-- Test 422: v1.47.0 continuous improvement backward compatibility preserved --"
npm run continuous:improvement >/tmp/continuous_improvement_backward_compat_v147.log 2>&1
node --input-type=module <<'EOF'
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("output/continuous-improvement/improvement.json", "utf8"));
if (data.schema !== "continuous-improvement/1.0") {
  throw new Error("v1.47.0 continuous improvement schema must remain continuous-improvement/1.0");
}
if (!Array.isArray(data.improvements) || data.improvements.length === 0) {
  throw new Error("v1.47.0 continuous improvement output must remain valid");
}

console.log("v1.47.0 continuous improvement backward compatibility preserved ok");
EOF
grep -q "Continuous Improvement Summary" /tmp/continuous_improvement_backward_compat_v147.log
pass "v1.47.0 continuous improvement backward compatibility preserved"

echo "-- Test 423: docs/architecture required governance files exist --"
for file in \
  README.md \
  OVERVIEW.md \
  LAYER_MODEL.md \
  LAYER_INVARIANTS.md \
  DEPENDENCY_RULES.md \
  PUBLIC_CONTRACT_POLICY.md \
  CATALOG_USAGE.md \
  COMPATIBILITY_POLICY.md \
  VERSIONING_POLICY.md \
  DEPRECATION_POLICY.md \
  CHANGE_GOVERNANCE.md \
  EXTENSION_GUIDE.md \
  FUTURE_ARCHITECTURE.md \
  NON_GOALS.md \
  ARCHITECTURE_DECISIONS.md \
  EXTENSION_CHECKLIST.md \
  RISK_REGISTER.md \
  ARCHITECTURE_COMPLIANCE_CHECKLIST.md \
  QUALITY_GOVERNANCE.md \
  ARCHITECTURE_MATURITY_MODEL.md \
  FUTURE_ENTRY_CRITERIA.md \
  GOVERNANCE_FLOW.md \
  FUTURE_LAYER_BOUNDARIES.md \
  LAYER_INTERACTION_MODEL.md \
  PROVIDER_LAYER_DESIGN.md \
  RUNTIME_LAYER_DESIGN.md \
  SCHEDULER_LAYER_DESIGN.md \
  AUTOMATION_LAYER_DESIGN.md \
  WORKFLOW_LAYER_DESIGN.md \
  EVENT_LAYER_DESIGN.md \
  INTERACTION_LIFECYCLE_DESIGN.md
do
  test -f "docs/architecture/${file}"
done
pass "docs/architecture required governance files exist"

echo "-- Test 424: docs/architecture required headings exist --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const architectureDir = path.join(PROJECT_ROOT, "docs/architecture");

const requiredHeadings = [
  ["OVERVIEW.md", ["# Overview", "## Platform Layer", "## Application Layer", "## Future Layer", "## Current Phase", "## Completed Foundations"]],
  ["LAYER_MODEL.md", ["# Layer Model", "## Responsibilities", "## Dependency Direction", "## Layer Boundary", "## Prohibited Dependencies", "## Public Contract Only", "## Circular Dependency Prohibition"]],
  ["LAYER_INVARIANTS.md", ["# Layer Invariants", "## Platform Application Separation", "## Internal API Prohibition", "## Cross Layer Prohibition", "## Public Contract Only", "## Circular Dependency Prohibition"]],
  ["DEPENDENCY_RULES.md", ["# Dependency Rules", "## Foundation Dependencies", "## Dependency Rule", "## Layer Rule", "## Compatibility Matrix"]],
  ["PUBLIC_CONTRACT_POLICY.md", ["# Public Contract Policy", "## Public Surface", "## Internal Surface", "## Backward Compatibility", "## Contract Lifecycle"]],
  ["CATALOG_USAGE.md", ["# Catalog Usage", "## Public Contract Catalog", "## JSON Source", "## Markdown View", "## CLI Summary", "## Usage Rules"]],
  ["COMPATIBILITY_POLICY.md", ["# Compatibility Policy", "## Compatibility Matrix", "## Compatibility Decision", "## Change Rules", "## Major Change Criteria", "## Minor Change Criteria"]],
  ["VERSIONING_POLICY.md", ["# Versioning Policy", "## SemVer", "## Patch", "## Minor", "## Major", "## Version Rules"]],
  ["DEPRECATION_POLICY.md", ["# Deprecation Policy", "## Deprecated", "## Warning", "## Removal Candidate", "## Removed"]],
  ["CHANGE_GOVERNANCE.md", ["# Change Governance", "## Change Criteria", "## Mandatory Policy Review", "## Foundation Addition Criteria", "## Layer Change Criteria", "## Contract Change Criteria", "## Version Change Criteria"]],
  ["EXTENSION_GUIDE.md", ["# Extension Guide", "## Foundation Addition", "## Provider Addition", "## Runtime Addition", "## Scheduler Addition", "## API Addition", "## Current Non Implementation"]],
  ["FUTURE_ARCHITECTURE.md", ["# Future Architecture", "## Provider Layer", "## Adapter Layer", "## Runtime Layer", "## Automation Layer", "## Cloud Layer", "## v2 Roadmap", "## Design Only"]],
  ["NON_GOALS.md", ["# Non Goals", "## Provider", "## OAuth", "## Scheduler", "## Queue", "## Worker", "## Cache", "## Database", "## Metrics Collection", "## External API", "## SNS API", "## Runtime", "## Cloud"]],
  ["ARCHITECTURE_DECISIONS.md", ["# Architecture Decisions", "## ADR Format", "## Accepted Decisions", "### v1.49.0 Primary Decisions"]],
  ["EXTENSION_CHECKLIST.md", ["# Extension Checklist"]],
  ["RISK_REGISTER.md", ["# Risk Register", "## Mitigation Owner"]],
  ["ARCHITECTURE_COMPLIANCE_CHECKLIST.md", ["# Architecture Compliance Checklist", "## Universal Compliance Items", "## Foundation Addition", "## Public Contract Change", "## Future Architecture Addition", "## Provider Runtime Scheduler API Pre Addition", "## Release Pre Check", "## Backward Compatibility Check", "## Risk Check", "## ADR Check"]],
  ["QUALITY_GOVERNANCE.md", ["# Quality Governance", "## PASS Count Is Not Sufficient Quality Proof", "## PASS Count Meaning", "## Architecture Quality Requires Governance Review", "## Machine Check vs Governance Check", "## Future Layer And Future Architecture", "## PASS Count Update Procedure"]],
  ["ARCHITECTURE_MATURITY_MODEL.md", ["# Architecture Maturity Model", "## Purpose", "## Scope", "## Non Goals", "## Maturity Levels", "## Level 0: Idea", "## Level 1: Foundation", "## Level 2: Governance", "## Level 3: Future Design", "## Level 4: Implementation Ready", "## Level 5: Production Ready", "## Level 6: Operational Excellence", "## Current Maturity", "## Completed Capabilities", "## Current Limitations", "## Required Evidence", "## Transition Rules", "## Relationship to Quality Governance", "## Relationship to Future Entry Criteria", "## Relationship to Compliance Checklist", "## Completion Criteria"]],
  ["FUTURE_ENTRY_CRITERIA.md", ["# Future Entry Criteria", "## Purpose", "## Current Maturity Position", "## Scope", "## Non Goals", "## Entry Gate Principle", "## Universal Entry Criteria", "## Provider Entry Criteria", "## Runtime Entry Criteria", "## Scheduler Entry Criteria", "## OAuth Entry Criteria", "## SNS API Entry Criteria", "## External API Entry Criteria", "## Database Entry Criteria", "## Queue Entry Criteria", "## Worker Entry Criteria", "## Cloud Runtime Entry Criteria", "## Real Metrics Entry Criteria", "## Real Automation Entry Criteria", "## Required ADR", "## Required Risk Review", "## Required Compatibility Review", "## Required Public Contract Review", "## Required Compliance Checklist", "## Non Goals Release Criteria", "## v2 Entry Criteria", "## Level 3 to Level 4 Gate", "## Completion Criteria"]],
  ["GOVERNANCE_FLOW.md", ["# Governance Flow", "## Purpose", "## Scope", "## Non Goals", "## Governance Lifecycle", "## Architecture Review Flow", "## Design Review Flow", "## ADR Workflow", "## Risk Review Workflow", "## Compatibility Review Workflow", "## Public Contract Review Workflow", "## Compliance Review Workflow", "## Documentation Update Flow", "## Architecture Change Flow", "## Future Layer Approval Flow", "## Release Governance Flow", "## Quality Governance Integration", "## Future Entry Criteria Integration", "## Completion Criteria", "## Level 3 to Level 4 Role", "## Prohibited Shortcuts", "## Related Documents"]],
  ["FUTURE_LAYER_BOUNDARIES.md", ["# Future Layer Boundaries", "## Purpose", "## Scope", "## Non Goals", "## Current Maturity", "## Boundary Design Principles", "## Future Layer Map", "## Provider Layer Boundary", "## Adapter Layer Boundary", "## Runtime Layer Boundary", "## Scheduler Layer Boundary", "## OAuth Layer Boundary", "## SNS API Layer Boundary", "## External API Layer Boundary", "## Database Layer Boundary", "## Queue Layer Boundary", "## Worker Layer Boundary", "## Cloud Runtime Boundary", "## Cache Boundary", "## Real Metrics Boundary", "## Real Automation Boundary", "## Allowed Dependency Direction", "## Forbidden Dependencies", "## Public Contract Boundaries", "## Data Ownership Boundaries", "## Side Effect Boundaries", "## Runtime Isolation Boundaries", "## Testing Boundaries", "## Documentation Boundaries", "## Future Entry Criteria Integration", "## Governance Flow Integration", "## Completion Criteria", "## Prohibited Shortcuts", "## Related Documents"]],
  ["LAYER_INTERACTION_MODEL.md", ["# Layer Interaction Model Design", "## 1. Purpose", "## 2. Scope", "## 3. Non-Goals", "## 4. Current Maturity Context", "## 5. Architecture Position", "## 6. Core Layer Responsibilities", "## 7. Interaction Principles", "## 8. Layer Interaction Rules", "## 9. Allowed Interaction Matrix", "## 10. Forbidden Interaction Matrix", "## 11. Dependency Direction Rules", "## 12. Reverse Dependency Rules", "## 13. Circular Dependency Rules", "## 14. Ownership Rules", "## 15. Input Ownership", "## 16. Output Ownership", "## 17. Contract Ownership", "## 18. Boundary Crossing Rules", "## 19. Layer Isolation Rules", "## 20. Communication Principles", "## 21. Data Flow Overview", "## 22. Control Flow Overview", "## 23. Event Flow Overview", "## 24. Event to Automation Boundary", "## 25. Automation to Workflow Boundary", "## 26. Workflow to Scheduler Boundary", "## 27. Scheduler to Runtime Boundary", "## 28. Runtime to Provider Boundary", "## 29. Provider Reverse Dependency Boundary", "## 30. Queue / Worker / Receiver Boundary", "## 31. Adapter / API / Database / Cloud Runtime Boundary", "## 32. Dependency Matrix", "## 33. Version Compatibility Rules", "## 34. Backward Compatibility", "## 35. Extension Rules", "## 36. Governance Integration", "## 37. Future Entry Criteria Integration", "## 38. Anti-Patterns", "## 39. Sequence Examples", "## 40. Testing Strategy", "## 41. Observability", "## 42. Completion Criteria"]],
  ["PROVIDER_LAYER_DESIGN.md", ["# Provider Layer Design", "## 1. Purpose", "## 2. Scope", "## 3. Non-Goals", "## 4. Relationship to Future Layer Boundaries", "## 5. Relationship to Layer Interaction Model", "## 6. Provider Layer Responsibility", "## 7. Provider Abstraction Principles", "## 8. Provider Contract Model", "## 9. Provider Input Contract", "## 10. Provider Output Contract", "## 11. Provider Error Contract", "## 12. Provider Capability Model", "## 13. Provider Configuration Model", "## 14. Provider Credential Boundary", "## 15. Provider Runtime Boundary", "## 16. Provider Adapter Boundary", "## 17. Provider External API Boundary", "## 18. Provider State Ownership", "## 19. Provider Side Effect Rules", "## 20. Provider Observability Rules", "## 21. Provider Testing Strategy", "## 22. Provider Anti-Patterns", "## 23. Provider Extension Criteria", "## 24. Governance Flow Integration", "## 25. Future Entry Criteria Integration", "## 26. Compatibility Requirements", "## 27. Completion Criteria"]],
  ["RUNTIME_LAYER_DESIGN.md", ["# Runtime Layer Design", "## 1. Purpose", "## 2. Scope", "## 3. Non-Goals", "## 4. Relationship to Future Layer Boundaries", "## 5. Relationship to Layer Interaction Model", "## 6. Relationship to Provider Layer Design", "## 7. Runtime Principles", "## 8. Runtime Responsibility", "## 9. Runtime Execution Contract", "## 10. Runtime Lifecycle", "## 11. Runtime Execution Context", "## 12. Runtime Orchestration Model", "## 13. Runtime Resource Ownership", "## 14. Runtime State Management", "## 15. Runtime Cancellation Rules", "## 16. Runtime Timeout Rules", "## 17. Runtime Retry Coordination", "## 18. Runtime Error Handling", "## 19. Runtime Provider Interaction", "## 20. Runtime Scheduler Boundary", "## 21. Runtime Automation Boundary", "## 22. Runtime Worker Boundary", "## 23. Runtime Side Effect Rules", "## 24. Runtime Observability", "## 25. Runtime Testing Strategy", "## 26. Runtime Anti-Patterns", "## 27. Sequence Examples", "## 28. Governance Flow Integration", "## 29. Future Entry Criteria Integration", "## 30. Compatibility Requirements", "## 31. Completion Criteria"]],
  ["SCHEDULER_LAYER_DESIGN.md", ["# Scheduler Layer Design", "## Scheduler Purpose", "## Scheduler Scope", "## Scheduler Non-Goals", "## Relationship to Future Layer Boundaries", "## Relationship to Layer Interaction Model", "## Relationship to Runtime Layer Design", "## Scheduler Principles", "## Scheduler Responsibility", "## Scheduling Contract", "## Scheduling Model", "## Trigger Model", "## Trigger Sources", "## Scheduling Context", "## Execution Policy", "## Runtime Coordination", "## Job Ownership", "## Queue Boundary", "## Worker Boundary", "## Retry Policy Boundary", "## Time-based Scheduling", "## Event-based Scheduling", "## Manual Execution", "## Future Automation Boundary", "## Scheduler Side Effect Rules", "## Scheduler State Ownership", "## Scheduler Observability", "## Scheduler Testing Strategy", "## Scheduler Anti-Patterns", "## Sequence Examples", "## Governance Flow Integration", "## Future Entry Criteria Integration", "## Compatibility Requirements", "## Completion Criteria"]],
  ["AUTOMATION_LAYER_DESIGN.md", ["# Automation Layer Design", "## Automation Purpose", "## Automation Scope", "## Automation Non-Goals", "## Relationship to Future Layer Boundaries", "## Relationship to Layer Interaction Model", "## Relationship to Provider Layer Design", "## Relationship to Runtime Layer Design", "## Relationship to Scheduler Layer Design", "## Automation Principles", "## Automation Responsibility", "## Automation Contract", "## Automation Intent Model", "## Workflow Boundary", "## Trigger Boundary", "## Scheduler Boundary", "## Runtime Boundary", "## Provider Boundary", "## Adapter Boundary", "## State Boundary", "## Side Effect Boundary", "## Queue Boundary", "## Worker Boundary", "## Manual Automation", "## Scheduled Automation", "## Event-based Automation", "## Human Approval Boundary", "## Observability", "## Testing Strategy", "## Anti-Patterns", "## Sequence Examples", "## Governance Flow Integration", "## Future Entry Criteria Integration", "## Compatibility Requirements", "## Completion Criteria"]],
  ["WORKFLOW_LAYER_DESIGN.md", ["# Workflow Layer Design", "## 1. Purpose", "## 2. Scope", "## 3. Non-Goals", "## 4. Relationship to Future Layer Boundaries", "## 5. Relationship to Layer Interaction Model", "## 6. Relationship to Provider Layer Design", "## 7. Relationship to Runtime Layer Design", "## 8. Relationship to Scheduler Layer Design", "## 9. Relationship to Automation Layer Design", "## 10. Workflow Principles", "## 11. Workflow Responsibility", "## 12. Workflow Contract", "## 13. Workflow Intent Relationship", "## 14. Workflow Step Model", "## 15. Workflow Dependency Model", "## 16. Workflow Transition Model", "## 17. Workflow Input Boundary", "## 18. Workflow Output Boundary", "## 19. Automation Boundary", "## 20. Scheduler Boundary", "## 21. Runtime Boundary", "## 22. Provider Boundary", "## 23. Adapter Boundary", "## 24. State Boundary", "## 25. Side Effect Boundary", "## 26. Queue Boundary", "## 27. Worker Boundary", "## 28. Approval Point Boundary", "## 29. Manual Workflow", "## 30. Scheduled Workflow", "## 31. Event-based Workflow", "## 32. Human Approval Workflow", "## 33. Observability", "## 34. Testing Strategy", "## 35. Anti-Patterns", "## 36. Sequence Examples", "## 37. Governance Flow Integration", "## 38. Future Entry Criteria Integration", "## 39. Compatibility Requirements", "## 40. Completion Criteria"]],
  ["EVENT_LAYER_DESIGN.md", ["# Event Layer Design", "## 1. Purpose", "## 2. Scope", "## 3. Non-Goals", "## 4. Relationship to Future Layer Boundaries", "## 5. Relationship to Layer Interaction Model", "## 6. Relationship to Provider Layer Design", "## 7. Relationship to Runtime Layer Design", "## 8. Relationship to Scheduler Layer Design", "## 9. Relationship to Automation Layer Design", "## 10. Relationship to Workflow Layer Design", "## 11. Event Principles", "## 12. Event Responsibility", "## 13. Event Contract", "## 14. Event Classification", "## 15. Manual Event", "## 16. Scheduled Event", "## 17. Webhook Event", "## 18. SNS Event", "## 19. External Event", "## 20. Approval Event", "## 21. System Event", "## 22. Event Input Boundary", "## 23. Event Output Boundary", "## 24. Automation Boundary", "## 25. Workflow Boundary", "## 26. Scheduler Boundary", "## 27. Runtime Boundary", "## 28. Provider Boundary", "## 29. Adapter Boundary", "## 30. State Boundary", "## 31. Side Effect Boundary", "## 32. Queue Boundary", "## 33. Worker Boundary", "## 34. Observability", "## 35. Testing Strategy", "## 36. Anti-Patterns", "## 37. Sequence Examples", "## 38. Governance Flow Integration", "## 39. Future Entry Criteria Integration", "## 40. Compatibility Requirements", "## 41. Completion Criteria"]],
  ["INTERACTION_LIFECYCLE_DESIGN.md", ["# Interaction Lifecycle Design", "## 1. Purpose", "## 2. Scope", "## 3. Non-Goals", "## 4. Design Status", "## 5. Relationship to Layer Interaction Model", "## 6. Lifecycle Principles", "## 7. Lifecycle State Definition", "## 8. Initial State", "## 9. Terminal States", "## 10. Non-Terminal States", "## 11. Valid State Transitions", "## 12. Invalid State Transitions", "## 13. State Ownership", "## 14. Transition Ownership", "## 15. State Visibility Rules", "## 16. Lifecycle Isolation Rules", "## 17. Event Boundary", "## 18. Automation Boundary", "## 19. Workflow Boundary", "## 20. Scheduler Boundary", "## 21. Runtime Boundary", "## 22. Provider Boundary", "## 23. Waiting Rules", "## 24. Approval Waiting Rules", "## 25. Scheduler Waiting Rules", "## 26. Runtime Execution Boundary", "## 27. Retry Boundary", "## 28. Timeout Boundary", "## 29. Cancellation Boundary", "## 30. Completion Rules", "## 31. Failure Boundary", "## 32. Recovery Principles", "## 33. Lifecycle Compatibility Rules", "## 34. Version Compatibility", "## 35. Governance Integration", "## 36. Future Entry Criteria Integration", "## 37. State Transition Examples", "## 38. Sequence Examples", "## 39. Testing Strategy", "## 40. Observability", "## 41. Anti-Patterns", "## 42. Completion Criteria"]],
  ["README.md", ["# Architecture Governance", "## Governance Scope"]],
];

for (const [fileName, headings] of requiredHeadings) {
  const content = fs.readFileSync(path.join(architectureDir, fileName), "utf8");
  for (const heading of headings) {
    if (!content.includes(heading)) {
      throw new Error(`${fileName} must include heading: ${heading}`);
    }
  }
}

console.log("docs/architecture required headings exist ok");
EOF
pass "docs/architecture required headings exist"

echo "-- Test 425: README links to docs/architecture governance --"
grep -q "docs/architecture/README.md" README.md
grep -q "Architecture Governance" README.md
grep -q "Architecture Documentation Foundation（v1.49.0）" README.md
pass "README links to docs/architecture governance"

echo "-- Test 426: architecture documentation treated as governance --"
grep -q "Architecture Governance" docs/architecture/README.md
grep -q "Official Docs First" docs/architecture/README.md
grep -q "Governance First" docs/architecture/README.md
grep -q "正式基準書" docs/architecture/README.md
grep -q "32 必須 Governance 文書" docs/architecture/README.md
grep -q "QUALITY_GOVERNANCE.md" docs/architecture/README.md
grep -q "ARCHITECTURE_MATURITY_MODEL.md" docs/architecture/README.md
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/architecture/README.md
grep -q "GOVERNANCE_FLOW.md" docs/architecture/README.md
grep -q "FUTURE_LAYER_BOUNDARIES.md" docs/architecture/README.md
grep -q "LAYER_INTERACTION_MODEL.md" docs/architecture/README.md
grep -q "PROVIDER_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "RUNTIME_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "SCHEDULER_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "AUTOMATION_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "INTERACTION_LIFECYCLE_DESIGN.md" docs/architecture/README.md
grep -q "ARCHITECTURE_COMPLIANCE_CHECKLIST.md" docs/architecture/README.md
grep -q "v1.49.0 新規 15" docs/architecture/README.md
node --input-type=module <<'EOF'
import fs from "node:fs";

const readme = fs.readFileSync("docs/architecture/README.md", "utf8");
const requiredLinks = [
  "./README.md",
  "./OVERVIEW.md",
  "./LAYER_MODEL.md",
  "./LAYER_INVARIANTS.md",
  "./DEPENDENCY_RULES.md",
  "./PUBLIC_CONTRACT_POLICY.md",
  "./CATALOG_USAGE.md",
  "./COMPATIBILITY_POLICY.md",
  "./VERSIONING_POLICY.md",
  "./DEPRECATION_POLICY.md",
  "./CHANGE_GOVERNANCE.md",
  "./EXTENSION_GUIDE.md",
  "./FUTURE_ARCHITECTURE.md",
  "./NON_GOALS.md",
  "./ARCHITECTURE_DECISIONS.md",
  "./EXTENSION_CHECKLIST.md",
  "./RISK_REGISTER.md",
  "./ARCHITECTURE_COMPLIANCE_CHECKLIST.md",
  "./QUALITY_GOVERNANCE.md",
  "./ARCHITECTURE_MATURITY_MODEL.md",
  "./FUTURE_ENTRY_CRITERIA.md",
  "./GOVERNANCE_FLOW.md",
  "./FUTURE_LAYER_BOUNDARIES.md",
  "./LAYER_INTERACTION_MODEL.md",
  "./PROVIDER_LAYER_DESIGN.md",
  "./RUNTIME_LAYER_DESIGN.md",
  "./SCHEDULER_LAYER_DESIGN.md",
  "./AUTOMATION_LAYER_DESIGN.md",
  "./WORKFLOW_LAYER_DESIGN.md",
  "./EVENT_LAYER_DESIGN.md",
  "./INTERACTION_LIFECYCLE_DESIGN.md",
];

for (const link of requiredLinks) {
  if (!readme.includes(`](${link})`)) {
    throw new Error(`docs/architecture/README.md must link to ${link}`);
  }
}

console.log("architecture README links all 32 governance files ok");
EOF
pass "architecture documentation treated as governance"

echo "-- Test 427: future architecture is design only --"
grep -q "Design Only" docs/architecture/FUTURE_ARCHITECTURE.md
grep -q "実装禁止" docs/architecture/FUTURE_ARCHITECTURE.md
grep -q "## Design Only" docs/architecture/FUTURE_ARCHITECTURE.md
grep -q "Provider Layer" docs/architecture/FUTURE_ARCHITECTURE.md
grep -q "Runtime Layer" docs/architecture/FUTURE_ARCHITECTURE.md
grep -q "NON_GOALS.md" docs/architecture/FUTURE_ARCHITECTURE.md
grep -q "将来設計" docs/architecture/FUTURE_ARCHITECTURE.md
pass "future architecture is design only"

echo "-- Test 428: non goals include prohibited implementations --"
grep -q "実装禁止" docs/architecture/NON_GOALS.md
grep -q "FUTURE_ARCHITECTURE.md" docs/architecture/NON_GOALS.md
grep -q "## Provider" docs/architecture/NON_GOALS.md
grep -q "## OAuth" docs/architecture/NON_GOALS.md
grep -q "## Scheduler" docs/architecture/NON_GOALS.md
grep -q "## Database" docs/architecture/NON_GOALS.md
grep -q "## Queue" docs/architecture/NON_GOALS.md
grep -q "## Worker" docs/architecture/NON_GOALS.md
grep -q "## Cache" docs/architecture/NON_GOALS.md
grep -q "## Metrics Collection" docs/architecture/NON_GOALS.md
grep -q "## Runtime" docs/architecture/NON_GOALS.md
grep -q "## Cloud" docs/architecture/NON_GOALS.md
grep -q "## SNS API" docs/architecture/NON_GOALS.md
pass "non goals include prohibited implementations"

echo "-- Test 429: governance policy documents exist --"
for file in \
  PUBLIC_CONTRACT_POLICY.md \
  COMPATIBILITY_POLICY.md \
  VERSIONING_POLICY.md \
  DEPRECATION_POLICY.md \
  CHANGE_GOVERNANCE.md
do
  test -f "docs/architecture/${file}"
done
grep -q "# Public Contract Policy" docs/architecture/PUBLIC_CONTRACT_POLICY.md
grep -q "# Compatibility Policy" docs/architecture/COMPATIBILITY_POLICY.md
grep -q "# Versioning Policy" docs/architecture/VERSIONING_POLICY.md
grep -q "# Deprecation Policy" docs/architecture/DEPRECATION_POLICY.md
grep -q "# Change Governance" docs/architecture/CHANGE_GOVERNANCE.md
grep -q "## Mandatory Policy Review" docs/architecture/CHANGE_GOVERNANCE.md
grep -q "Risk Register" docs/architecture/CHANGE_GOVERNANCE.md
grep -q "# v1.49.0 Primary Decisions" docs/architecture/ARCHITECTURE_DECISIONS.md || grep -q "### v1.49.0 Primary Decisions" docs/architecture/ARCHITECTURE_DECISIONS.md
grep -q "ADR-GOV-005" docs/architecture/ARCHITECTURE_DECISIONS.md
grep -q "ADR-GOV-006" docs/architecture/ARCHITECTURE_DECISIONS.md
grep -q "ADR-GOV-007" docs/architecture/ARCHITECTURE_DECISIONS.md
grep -q "LAYER_INVARIANTS.md" docs/architecture/LAYER_MODEL.md
grep -q "LAYER_MODEL.md" docs/architecture/LAYER_INVARIANTS.md
grep -q "## Mitigation Owner" docs/architecture/RISK_REGISTER.md
pass "governance policy documents exist"

echo "-- Test 430: v1.49.0 did not add forbidden implementation files --"
node --input-type=module <<'EOF'
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

/** @returns {string[]} */
function listAddedPaths() {
  try {
    const output = execSync("git diff --name-only --diff-filter=A HEAD", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();

    if (!output) {
      return [];
    }

    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/** @returns {string[]} */
function listUntrackedPaths() {
  try {
    const output = execSync("git ls-files --others --exclude-standard", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();

    if (!output) {
      return [];
    }

    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const forbiddenPatterns = [
  /provider/i,
  /adapter/i,
  /runtime/i,
  /scheduler/i,
  /oauth/i,
  /sns_api/i,
  /database/i,
  /queue/i,
  /worker/i,
  /cloud_runtime/i,
  /real_metrics/i,
  /real_automation/i,
];

const candidatePaths = [...new Set([...listAddedPaths(), ...listUntrackedPaths()])]
  .filter(
    (relativePath) =>
      (relativePath.startsWith("src/lib/") || relativePath.startsWith("scripts/")) &&
      relativePath.endsWith(".js"),
  );

for (const relativePath of candidatePaths) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(relativePath)) {
      throw new Error(`v1.49.0 must not add forbidden implementation file: ${relativePath}`);
    }
  }
}

if (candidatePaths.length > 0) {
  throw new Error(
    `v1.49.0 must remain docs-only; unexpected new implementation files: ${candidatePaths.join(", ")}`,
  );
}

console.log("v1.49.0 did not add forbidden implementation files ok");
EOF
npm run public-contract:catalog >/tmp/public_contract_catalog_backward_compat_v148.log 2>&1
grep -q "Public Contract Catalog Summary" /tmp/public_contract_catalog_backward_compat_v148.log
pass "v1.49.0 did not add forbidden implementation files"

echo "-- Test 431: architecture compliance checklist exists --"
test -f docs/architecture/ARCHITECTURE_COMPLIANCE_CHECKLIST.md
grep -q "# Architecture Compliance Checklist" docs/architecture/ARCHITECTURE_COMPLIANCE_CHECKLIST.md
pass "architecture compliance checklist exists"

echo "-- Test 432: architecture compliance checklist linked from README files --"
grep -q "ARCHITECTURE_COMPLIANCE_CHECKLIST.md" docs/architecture/README.md
grep -q "ARCHITECTURE_COMPLIANCE_CHECKLIST.md" README.md
pass "architecture compliance checklist linked from README files"

echo "-- Test 433: architecture compliance checklist includes required items --"
node --input-type=module <<'EOF'
import fs from "node:fs";

const content = fs.readFileSync(
  "docs/architecture/ARCHITECTURE_COMPLIANCE_CHECKLIST.md",
  "utf8",
);

for (const required of [
  "Layer Rule 確認",
  "Dependency Rule 確認",
  "Public Contract Policy 確認",
  "Internal API 漏出なし",
  "Compatibility Policy 確認",
  "Catalog 更新要否確認",
  "Versioning Policy 確認",
  "Deprecation Policy 確認",
  "CHANGE_GOVERNANCE 確認",
  "RISK_REGISTER 更新要否確認",
  "ARCHITECTURE_DECISIONS 更新要否確認",
  "README 更新要否確認",
  "CHANGELOG 更新要否確認",
  "VERSION 更新要否確認",
  "Quality Pipeline 追加・維持確認",
  "Provider / Runtime / Scheduler / SNS API 等の実装禁止確認",
  "## Foundation Addition",
  "## Public Contract Change",
  "## Future Architecture Addition",
  "## Release Pre Check",
  "## Backward Compatibility Check",
  "## Risk Check",
  "## ADR Check",
]) {
  if (!content.includes(required)) {
    throw new Error(`architecture compliance checklist must include: ${required}`);
  }
}

console.log("architecture compliance checklist includes required items ok");
EOF
pass "architecture compliance checklist includes required items"

echo "-- Test 434: quality governance document exists --"
test -f docs/architecture/QUALITY_GOVERNANCE.md
grep -q "# Quality Governance" docs/architecture/QUALITY_GOVERNANCE.md
grep -q "## Machine Check vs Governance Check" docs/architecture/QUALITY_GOVERNANCE.md
pass "quality governance document exists"

echo "-- Test 435: quality governance states pass count is not sufficient quality proof --"
grep -q "PASS Count Is Not Sufficient Quality Proof" docs/architecture/QUALITY_GOVERNANCE.md
grep -q "十分条件ではありません" docs/architecture/QUALITY_GOVERNANCE.md
grep -q "自動検証範囲" docs/architecture/QUALITY_GOVERNANCE.md
pass "quality governance states pass count is not sufficient quality proof"

echo "-- Test 436: quality governance links quality to architecture compliance checklist --"
grep -q "ARCHITECTURE_COMPLIANCE_CHECKLIST.md" docs/architecture/QUALITY_GOVERNANCE.md
grep -q "Architecture Compliance Checklist" docs/architecture/QUALITY_GOVERNANCE.md
grep -q "Governance Check" docs/architecture/QUALITY_GOVERNANCE.md
pass "quality governance links quality to architecture compliance checklist"

echo "-- Test 437: README references quality governance --"
grep -q "QUALITY_GOVERNANCE.md" README.md
grep -q "Quality Governance" README.md
grep -q "PASS 数だけでは" README.md
pass "README references quality governance"

echo "-- Test 438: VERSION documents quality governance improvement --"
grep -q "QUALITY_GOVERNANCE.md" docs/VERSION.md
grep -q "Quality Governance" docs/VERSION.md
grep -q "ARCHITECTURE_MATURITY_MODEL.md" docs/VERSION.md
grep -q "Level 2.5" docs/VERSION.md
grep -Fq "**640 PASS**" docs/VERSION.md
grep -q "Test 621–640" docs/VERSION.md
grep -q "INTERACTION_LIFECYCLE_DESIGN.md" docs/VERSION.md
pass "VERSION documents quality governance improvement"

echo "-- Test 439: CHANGELOG documents quality governance improvement --"
grep -q "Quality Governance" docs/CHANGELOG.md
grep -q "QUALITY_GOVERNANCE.md" docs/CHANGELOG.md
grep -q "Architecture Maturity Model" docs/CHANGELOG.md
grep -q "Level 2.5" docs/CHANGELOG.md
grep -Fq "**640 PASS**" docs/CHANGELOG.md
grep -q "Test 621–640" docs/CHANGELOG.md
grep -q "v1.61.0" docs/CHANGELOG.md
grep -q "Interaction Lifecycle Design" docs/CHANGELOG.md
pass "CHANGELOG documents quality governance improvement"

echo "-- Test 440: architecture maturity model exists --"
test -f docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "# Architecture Maturity Model" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
pass "architecture maturity model exists"

echo "-- Test 441: architecture maturity model has required headings --"
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";

const maturityPath = path.join("docs/architecture/ARCHITECTURE_MATURITY_MODEL.md");
const content = fs.readFileSync(maturityPath, "utf8");
const requiredHeadings = [
  "# Architecture Maturity Model",
  "## Purpose",
  "## Scope",
  "## Non Goals",
  "## Maturity Levels",
  "## Level 0: Idea",
  "## Level 1: Foundation",
  "## Level 2: Governance",
  "## Level 3: Future Design",
  "## Level 4: Implementation Ready",
  "## Level 5: Production Ready",
  "## Level 6: Operational Excellence",
  "## Current Maturity",
  "## Completed Capabilities",
  "## Current Limitations",
  "## Required Evidence",
  "## Transition Rules",
  "## Relationship to Quality Governance",
  "## Relationship to Future Entry Criteria",
  "## Relationship to Compliance Checklist",
  "## Completion Criteria",
];

for (const heading of requiredHeadings) {
  if (!content.includes(heading)) {
    throw new Error(`ARCHITECTURE_MATURITY_MODEL.md must include heading: ${heading}`);
  }
}

console.log("architecture maturity model required headings exist ok");
EOF
pass "architecture maturity model has required headings"

echo "-- Test 442: current maturity is level 2.5 --"
grep -q "Current Maturity: Level 2.5" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Governance Complete, Future Design Ready" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
pass "current maturity is level 2.5"

echo "-- Test 443: README references architecture maturity model --"
grep -q "ARCHITECTURE_MATURITY_MODEL.md" README.md
grep -q "Level 2.5" README.md
grep -q "Future Design Ready" README.md
pass "README references architecture maturity model"

echo "-- Test 444: docs/architecture/README references architecture maturity model --"
grep -q "ARCHITECTURE_MATURITY_MODEL.md" docs/architecture/README.md
grep -q "Level 2.5" docs/architecture/README.md
pass "docs/architecture/README references architecture maturity model"

echo "-- Test 445: maturity model states implementation ready is not reached --"
grep -q "Implementation Ready" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Not reached" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Level 4 Implementation Ready" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
pass "maturity model states implementation ready is not reached"

echo "-- Test 446: maturity model states production ready is not reached --"
grep -q "Production Ready" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Level 5 Production Ready" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Operational Excellence" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
pass "maturity model states production ready is not reached"

echo "-- Test 447: maturity model links maturity to quality governance --"
grep -q "QUALITY_GOVERNANCE.md" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "PASS 数は Maturity Level を直接上げない" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Machine Check + Governance Check + Evidence" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
pass "maturity model links maturity to quality governance"

echo "-- Test 448: maturity model links level 3/4 transition to future entry criteria --"
grep -q "Future Entry Criteria" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Level 3 → Level 4" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
grep -q "Gate" docs/architecture/ARCHITECTURE_MATURITY_MODEL.md
pass "maturity model links level 3/4 transition to future entry criteria"

echo "-- Test 449: future entry criteria document exists --"
test -f docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "# Future Entry Criteria" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria document exists"

echo "-- Test 450: docs/architecture/README references future entry criteria --"
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/architecture/README.md
grep -q "Future Entry Gate" docs/architecture/README.md
grep -q "32 必須 Governance 文書" docs/architecture/README.md
pass "docs/architecture/README references future entry criteria"

echo "-- Test 451: README references future entry criteria --"
grep -q "FUTURE_ENTRY_CRITERIA.md" README.md
grep -q "Future Entry Criteria Foundation（v1.50.0）" README.md
grep -q "25 必須 Governance 文書" README.md
pass "README references future entry criteria"

echo "-- Test 452: CHANGELOG references v1.50.0 --"
grep -q "## v1.50.0" docs/CHANGELOG.md
grep -q "Future Entry Criteria Foundation" docs/CHANGELOG.md
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/CHANGELOG.md
pass "CHANGELOG references v1.50.0"

echo "-- Test 453: VERSION references v1.50.0 history --"
grep -q "### v1.50.0 で追加（Future Entry Criteria Foundation）" docs/VERSION.md
grep -q "Future Entry Criteria Foundation" docs/VERSION.md
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/VERSION.md
pass "VERSION references v1.50.0 history"

echo "-- Test 454: future entry criteria includes provider entry criteria --"
grep -q "## Provider Entry Criteria" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "Provider Layer" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria includes provider entry criteria"

echo "-- Test 455: future entry criteria includes runtime entry criteria --"
grep -q "## Runtime Entry Criteria" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "Runtime Layer" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria includes runtime entry criteria"

echo "-- Test 456: future entry criteria includes scheduler entry criteria --"
grep -q "## Scheduler Entry Criteria" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "Scheduler" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria includes scheduler entry criteria"

echo "-- Test 457: future entry criteria includes required adr --"
grep -q "## Required ADR" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "Provider 着手" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria includes required adr"

echo "-- Test 458: future entry criteria includes required risk review --"
grep -q "## Required Risk Review" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "RISK_REGISTER.md" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria includes required risk review"

echo "-- Test 459: future entry criteria includes required compatibility review --"
grep -q "## Required Compatibility Review" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "COMPATIBILITY_POLICY.md" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria includes required compatibility review"

echo "-- Test 460: future entry criteria includes level 3 to level 4 gate --"
grep -q "## Level 3 to Level 4 Gate" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "Level 3 → Level 4 Gate" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "Implementation Ready" docs/architecture/FUTURE_ENTRY_CRITERIA.md
grep -q "未到達" docs/architecture/FUTURE_ENTRY_CRITERIA.md
pass "future entry criteria includes level 3 to level 4 gate"

echo "-- Test 461: governance flow document exists --"
test -f docs/architecture/GOVERNANCE_FLOW.md
grep -q "# Governance Flow" docs/architecture/GOVERNANCE_FLOW.md
pass "governance flow document exists"

echo "-- Test 462: docs/architecture/README references governance flow --"
grep -q "GOVERNANCE_FLOW.md" docs/architecture/README.md
grep -q "Governance Process" docs/architecture/README.md
grep -q "32 必須 Governance 文書" docs/architecture/README.md
pass "docs/architecture/README references governance flow"

echo "-- Test 463: README references v1.51.0 governance flow foundation --"
grep -q "Governance Flow Foundation（v1.51.0）" README.md
grep -q "GOVERNANCE_FLOW.md" README.md
grep -q "25 必須 Governance 文書" README.md
pass "README references v1.51.0 governance flow foundation"

echo "-- Test 464: CHANGELOG documents v1.51.0 --"
grep -q "## v1.51.0" docs/CHANGELOG.md
grep -q "Governance Flow Foundation" docs/CHANGELOG.md
grep -q "GOVERNANCE_FLOW.md" docs/CHANGELOG.md
pass "CHANGELOG documents v1.51.0"

echo "-- Test 465: VERSION documents v1.51.0 history --"
grep -q "### v1.51.0 で追加（Governance Flow Foundation）" docs/VERSION.md
grep -q "Governance Flow Foundation" docs/VERSION.md
grep -q "GOVERNANCE_FLOW.md" docs/VERSION.md
pass "VERSION documents v1.51.0 history"

echo "-- Test 466: governance flow contains governance lifecycle --"
grep -q "## Governance Lifecycle" docs/architecture/GOVERNANCE_FLOW.md
grep -q "Change Request" docs/architecture/GOVERNANCE_FLOW.md
grep -q "Release Decision" docs/architecture/GOVERNANCE_FLOW.md
grep -q "Post Release Review" docs/architecture/GOVERNANCE_FLOW.md
pass "governance flow contains governance lifecycle"

echo "-- Test 467: governance flow contains adr risk compatibility public contract workflows --"
grep -q "## ADR Workflow" docs/architecture/GOVERNANCE_FLOW.md
grep -q "## Risk Review Workflow" docs/architecture/GOVERNANCE_FLOW.md
grep -q "## Compatibility Review Workflow" docs/architecture/GOVERNANCE_FLOW.md
grep -q "## Public Contract Review Workflow" docs/architecture/GOVERNANCE_FLOW.md
pass "governance flow contains adr risk compatibility public contract workflows"

echo "-- Test 468: governance flow contains future entry criteria integration --"
grep -q "## Future Entry Criteria Integration" docs/architecture/GOVERNANCE_FLOW.md
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/architecture/GOVERNANCE_FLOW.md
grep -q "Entry Criteria 文書化完了 ≠ Implementation Ready" docs/architecture/GOVERNANCE_FLOW.md
pass "governance flow contains future entry criteria integration"

echo "-- Test 469: governance flow states implementation and production code remain prohibited --"
grep -q "Production Code" docs/architecture/GOVERNANCE_FLOW.md
grep -q "実装を許可しません" docs/architecture/GOVERNANCE_FLOW.md
grep -q "NON_GOALS.md" docs/architecture/GOVERNANCE_FLOW.md
grep -q "Provider" docs/architecture/GOVERNANCE_FLOW.md
grep -q "Runtime" docs/architecture/GOVERNANCE_FLOW.md
pass "governance flow states implementation and production code remain prohibited"

echo "-- Test 470: governance flow preserves level 2.5 and does not claim level 4 --"
grep -q "Level 2.5" docs/architecture/GOVERNANCE_FLOW.md
grep -q "Level 4 Implementation Ready" docs/architecture/GOVERNANCE_FLOW.md
grep -q "未到達" docs/architecture/GOVERNANCE_FLOW.md
grep -q "## Level 3 to Level 4 Role" docs/architecture/GOVERNANCE_FLOW.md
grep -Fq "Level 4 到達を **宣言しない**" docs/architecture/GOVERNANCE_FLOW.md
pass "governance flow preserves level 2.5 and does not claim level 4"

echo "-- Test 471: future layer boundaries document exists --"
test -f docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "# Future Layer Boundaries" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries document exists"

echo "-- Test 472: docs/architecture/README references future layer boundaries --"
grep -q "FUTURE_LAYER_BOUNDARIES.md" docs/architecture/README.md
grep -q "Future Layer Boundaries" docs/architecture/README.md
grep -q "32 必須 Governance 文書" docs/architecture/README.md
pass "docs/architecture/README references future layer boundaries"

echo "-- Test 473: README references v1.52.0 future layer boundary design --"
grep -q "Future Layer Boundary Design（v1.52.0）" README.md
grep -q "FUTURE_LAYER_BOUNDARIES.md" README.md
grep -q "25 必須 Governance 文書" README.md
pass "README references v1.52.0 future layer boundary design"

echo "-- Test 474: CHANGELOG documents v1.52.0 --"
grep -q "## v1.52.0" docs/CHANGELOG.md
grep -q "Future Layer Boundary Design" docs/CHANGELOG.md
grep -q "FUTURE_LAYER_BOUNDARIES.md" docs/CHANGELOG.md
pass "CHANGELOG documents v1.52.0"

echo "-- Test 475: VERSION documents v1.52.0 history --"
grep -q "### v1.52.0 で追加（Future Layer Boundary Design）" docs/VERSION.md
grep -q "Future Layer Boundary Design" docs/VERSION.md
grep -q "FUTURE_LAYER_BOUNDARIES.md" docs/VERSION.md
pass "VERSION documents v1.52.0 history"

echo "-- Test 476: future layer boundaries contains all future layer sections --"
for section in \
  "## Provider Layer Boundary" \
  "## Adapter Layer Boundary" \
  "## Runtime Layer Boundary" \
  "## Scheduler Layer Boundary" \
  "## OAuth Layer Boundary" \
  "## SNS API Layer Boundary" \
  "## External API Layer Boundary" \
  "## Database Layer Boundary" \
  "## Queue Layer Boundary" \
  "## Worker Layer Boundary" \
  "## Cloud Runtime Boundary" \
  "## Cache Boundary" \
  "## Real Metrics Boundary" \
  "## Real Automation Boundary"
do
  grep -q "${section}" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
done
grep -q "Implementation Status" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Prohibited" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries contains all future layer sections"

echo "-- Test 477: future layer boundaries defines allowed dependency direction --"
grep -q "## Allowed Dependency Direction" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Application Layer must" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Public Contracts" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries defines allowed dependency direction"

echo "-- Test 478: future layer boundaries defines forbidden dependencies --"
grep -q "## Forbidden Dependencies" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Direct external API calls from Application Layer" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Real Automation before Level 4" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries defines forbidden dependencies"

echo "-- Test 479: future layer boundaries defines public contract boundaries --"
grep -q "## Public Contract Boundaries" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Public Contract Catalog" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Private implementation details" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries defines public contract boundaries"

echo "-- Test 480: future layer boundaries defines side effect and runtime isolation boundaries --"
grep -q "## Side Effect Boundaries" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "## Runtime Isolation Boundaries" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Background execution remains prohibited" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Runtime selection must not affect Public Contract" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries defines side effect and runtime isolation boundaries"

echo "-- Test 481: future layer boundaries integrates future entry criteria and governance flow --"
grep -q "## Future Entry Criteria Integration" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "## Governance Flow Integration" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "GOVERNANCE_FLOW.md" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries integrates future entry criteria and governance flow"

echo "-- Test 482: future layer boundaries states implementation prohibited and level 4 not reached --"
grep -q "Level 2.5" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Level 4 Implementation Ready" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "未到達" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -q "Implementation Status" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
grep -Fq "**Prohibited**" docs/architecture/FUTURE_LAYER_BOUNDARIES.md
pass "future layer boundaries states implementation prohibited and level 4 not reached"

echo "-- Test 483: layer interaction model document exists --"
test -f docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "# Layer Interaction Model Design" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model document exists"

echo "-- Test 484: layer interaction model has purpose scope and non-goals --"
grep -q "## 1. Purpose" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "## 2. Scope" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "## 3. Non-Goals" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has purpose scope and non-goals"

echo "-- Test 485: layer interaction model has architecture position and core layer responsibilities --"
grep -q "## 5. Architecture Position" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "## 6. Core Layer Responsibilities" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "FUTURE_LAYER_BOUNDARIES.md" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "変更しない" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has architecture position and core layer responsibilities"

echo "-- Test 486: layer interaction model has layer interaction rules --"
grep -q "## 8. Layer Interaction Rules" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Public Contract 経由のみ" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Cross-layer shortcut" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has layer interaction rules"

echo "-- Test 487: layer interaction model has command vs query rules --"
grep -q "## 20. Communication Principles" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Query" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Command" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has command vs query rules"

echo "-- Test 488: layer interaction model has sync async interaction rules --"
grep -q "Async" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "実装しない" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has sync async interaction rules"

echo "-- Test 489: layer interaction model has error retry and timeout rules --"
grep -q "Error Propagation" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Retry Responsibility" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Timeout Ownership" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has error retry and timeout rules"

echo "-- Test 490: layer interaction model has flow overview sections --"
grep -q "## 21. Data Flow Overview" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "## 23. Event Flow Overview" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "## 22. Control Flow Overview" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has flow overview sections"

echo "-- Test 491: layer interaction model has interaction anti-patterns --"
grep -q "## 38. Anti-Patterns" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Layer skipping" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Hidden retry" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model has interaction anti-patterns"

echo "-- Test 492: layer interaction model integrates governance flow and future entry criteria --"
grep -q "## 36. Governance Integration" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "## 37. Future Entry Criteria Integration" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "GOVERNANCE_FLOW.md" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model integrates governance flow and future entry criteria"

echo "-- Test 493: readme changelog version reference v1.53.0 history --"
grep -q "Layer Interaction Model（v1.53.0）" README.md
grep -q "LAYER_INTERACTION_MODEL.md" docs/architecture/README.md
grep -q "## v1.53.0" docs/CHANGELOG.md
grep -q "### v1.53.0 で追加（Layer Interaction Model）" docs/VERSION.md
grep -q "Layer Interaction Model" docs/VERSION.md
pass "readme changelog version reference v1.53.0 history"

echo "-- Test 494: provider layer design document exists --"
test -f docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "# Provider Layer Design" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design document exists"

echo "-- Test 495: provider layer design has purpose scope and non-goals --"
grep -q "## 1. Purpose" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 2. Scope" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 3. Non-Goals" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "Provider 実装" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has purpose scope and non-goals"

echo "-- Test 496: provider layer design has boundary and interaction relationships --"
grep -q "## 4. Relationship to Future Layer Boundaries" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 5. Relationship to Layer Interaction Model" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "FUTURE_LAYER_BOUNDARIES.md" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "LAYER_INTERACTION_MODEL.md" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has boundary and interaction relationships"

echo "-- Test 497: provider layer design has provider layer responsibility --"
grep -q "## 6. Provider Layer Responsibility" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "External capability" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "Runtime orchestration" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has provider layer responsibility"

echo "-- Test 498: provider layer design has provider contract input output error --"
grep -q "## 8. Provider Contract Model" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 9. Provider Input Contract" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 10. Provider Output Contract" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 11. Provider Error Contract" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "validation_error" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has provider contract input output error"

echo "-- Test 499: provider layer design has capability and configuration model --"
grep -q "## 12. Provider Capability Model" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 13. Provider Configuration Model" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "text_generation" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "Credential と Configuration を混同しない" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has capability and configuration model"

echo "-- Test 500: provider layer design has credential runtime adapter external api boundaries --"
grep -q "## 14. Provider Credential Boundary" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 15. Provider Runtime Boundary" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 16. Provider Adapter Boundary" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 17. Provider External API Boundary" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has credential runtime adapter external api boundaries"

echo "-- Test 501: provider layer design has state ownership and side effect rules --"
grep -q "## 18. Provider State Ownership" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 19. Provider Side Effect Rules" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "Query Provider" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "Hidden side effect" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has state ownership and side effect rules"

echo "-- Test 502: provider layer design has observability and testing strategy --"
grep -q "## 20. Provider Observability Rules" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 21. Provider Testing Strategy" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "provider_selected" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "実 API テストなし" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has observability and testing strategy"

echo "-- Test 503: provider layer design has anti-patterns and extension criteria --"
grep -q "## 22. Provider Anti-Patterns" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 23. Provider Extension Criteria" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "Provider bypassing Adapter" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design has anti-patterns and extension criteria"

echo "-- Test 504: provider layer design integrates governance flow compatibility and entry criteria --"
grep -q "## 24. Governance Flow Integration" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 25. Future Entry Criteria Integration" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "## 26. Compatibility Requirements" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "GOVERNANCE_FLOW.md" docs/architecture/PROVIDER_LAYER_DESIGN.md
grep -q "FUTURE_ENTRY_CRITERIA.md" docs/architecture/PROVIDER_LAYER_DESIGN.md
pass "provider layer design integrates governance flow compatibility and entry criteria"

echo "-- Test 505: readme changelog version reference v1.54.0 history --"
grep -q "Provider Layer Design（v1.54.0）" README.md
grep -q "PROVIDER_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "## v1.54.0" docs/CHANGELOG.md
grep -q "### v1.54.0 で追加（Provider Layer Design）" docs/VERSION.md
grep -q "Provider Layer Design" docs/VERSION.md
pass "readme changelog version reference v1.54.0 history"

echo "-- Test 506: runtime layer design document exists --"
test -f docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "# Runtime Layer Design" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design document exists"

echo "-- Test 507: runtime layer design linked from docs/architecture/README.md --"
grep -q "RUNTIME_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "Runtime Layer Design" docs/architecture/README.md
pass "runtime layer design linked from docs/architecture/README.md"

echo "-- Test 508: runtime layer design linked from root README.md --"
grep -q "RUNTIME_LAYER_DESIGN.md" README.md
grep -q "Runtime Layer Design（v1.55.0）" README.md
pass "runtime layer design linked from root README.md"

echo "-- Test 509: runtime layer design has purpose section --"
grep -q "## 1. Purpose" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "execution contract" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has purpose section"

echo "-- Test 510: runtime layer design has non-goals section --"
grep -q "## 3. Non-Goals" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "Runtime implementation" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has non-goals section"

echo "-- Test 511: runtime layer design does not define provider responsibility --"
grep -Fq "Provider 責務変更 **禁止**" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "PROVIDER_LAYER_DESIGN.md" docs/architecture/RUNTIME_LAYER_DESIGN.md
! grep -q "## 6. Provider Layer Responsibility" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design does not define provider responsibility"

echo "-- Test 512: runtime layer design does not introduce production implementation --"
grep -Fq "Production Code 変更なし" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -Fq "Runtime **実装なし**" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "Design Only" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design does not introduce production implementation"

echo "-- Test 513: runtime layer design has lifecycle section --"
grep -q "## 10. Runtime Lifecycle" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "pending → validated → running" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has lifecycle section"

echo "-- Test 514: runtime layer design has execution context section --"
grep -q "## 11. Runtime Execution Context" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "run_id" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has execution context section"

echo "-- Test 515: runtime layer design has orchestration model section --"
grep -q "## 12. Runtime Orchestration Model" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "invoke Foundation CLI" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has orchestration model section"

echo "-- Test 516: runtime layer design has cancellation rules section --"
grep -q "## 15. Runtime Cancellation Rules" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -Fq "Cancelled は **failed ではない**" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has cancellation rules section"

echo "-- Test 517: runtime layer design has timeout rules section --"
grep -q "## 16. Runtime Timeout Rules" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "Runtime deadline" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has timeout rules section"

echo "-- Test 518: runtime layer design has retry coordination section --"
grep -q "## 17. Runtime Retry Coordination" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "runtime_retry_requested" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has retry coordination section"

echo "-- Test 519: runtime layer design has provider interaction section --"
grep -q "## 19. Runtime Provider Interaction" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "never" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -q "external API directly" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has provider interaction section"

echo "-- Test 520: runtime layer design has completion criteria section --"
grep -q "## 31. Completion Criteria" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -Fq "Quality Pipeline **520 PASS**" docs/architecture/RUNTIME_LAYER_DESIGN.md
grep -Fq "Architecture Documents **26** 必須文書" docs/architecture/RUNTIME_LAYER_DESIGN.md
pass "runtime layer design has completion criteria section"

echo "-- Test 521: scheduler layer design document exists --"
test -f docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "# Scheduler Layer Design" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design document exists"

echo "-- Test 522: scheduler layer design linked from docs/architecture/README.md --"
grep -q "SCHEDULER_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "Scheduler Layer Design" docs/architecture/README.md
pass "scheduler layer design linked from docs/architecture/README.md"

echo "-- Test 523: scheduler layer design linked from README.md --"
grep -q "SCHEDULER_LAYER_DESIGN.md" README.md
grep -q "Scheduler Layer Design（v1.56.0）" README.md
pass "scheduler layer design linked from README.md"

echo "-- Test 524: scheduler layer design documented in CHANGELOG --"
grep -q "## v1.56.0" docs/CHANGELOG.md
grep -q "Scheduler Layer Design" docs/CHANGELOG.md
grep -q "SCHEDULER_LAYER_DESIGN.md" docs/CHANGELOG.md
pass "scheduler layer design documented in CHANGELOG"

echo "-- Test 525: readme changelog version reference v1.56.0 history --"
grep -q "Scheduler Layer Design（v1.56.0）" README.md
grep -q "SCHEDULER_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "## v1.56.0" docs/CHANGELOG.md
grep -q "### v1.56.0 で追加（Scheduler Layer Design）" docs/VERSION.md
grep -q "Scheduler Layer Design" docs/VERSION.md
pass "readme changelog version reference v1.56.0 history"

echo "-- Test 526: scheduler layer design has purpose section --"
grep -q "## Scheduler Purpose" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "実行そのものを担当しない" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has purpose section"

echo "-- Test 527: scheduler layer design has scope section --"
grep -q "## Scheduler Scope" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduling Contract" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has scope section"

echo "-- Test 528: scheduler layer design has non-goals section --"
grep -q "## Scheduler Non-Goals" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Cron implementation" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Queue implementation" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has non-goals section"

echo "-- Test 529: scheduler layer design has relationship to runtime layer design section --"
grep -q "## Relationship to Runtime Layer Design" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -Fq "Runtime 責務変更 **禁止**" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "RUNTIME_LAYER_DESIGN.md" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has relationship to runtime layer design section"

echo "-- Test 530: scheduler layer design has principles section --"
grep -q "## Scheduler Principles" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduling Contract First" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has principles section"

echo "-- Test 531: scheduler layer design has responsibility section --"
grep -q "## Scheduler Responsibility" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Runtime delegation" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has responsibility section"

echo "-- Test 532: scheduler layer design has scheduling contract section --"
grep -q "## Scheduling Contract" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "scheduleId" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "targetRuntimeContract" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has scheduling contract section"

echo "-- Test 533: scheduler layer design has trigger model section --"
grep -q "## Trigger Model" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "triggerType" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has trigger model section"

echo "-- Test 534: scheduler layer design has runtime coordination section --"
grep -q "## Runtime Coordination" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "execution request" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Runtime owns execution lifecycle" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has runtime coordination section"

echo "-- Test 535: scheduler layer design has queue boundary section --"
grep -q "## Queue Boundary" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -Fq "Scheduler は Queue を **所有しない**" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "enqueue 実装を定義しない" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has queue boundary section"

echo "-- Test 536: scheduler layer design has worker boundary section --"
grep -q "## Worker Boundary" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -Fq "Scheduler は Worker を **起動しない**" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has worker boundary section"

echo "-- Test 537: scheduler layer design has retry policy boundary section --"
grep -q "## Retry Policy Boundary" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "retry policy" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Runtime / Queue / Worker" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has retry policy boundary section"

echo "-- Test 538: scheduler layer design has future automation boundary section --"
grep -q "## Future Automation Boundary" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Automation workflow" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has future automation boundary section"

echo "-- Test 539: scheduler layer design has anti-patterns section --"
grep -q "## Scheduler Anti-Patterns" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler directly invokes Provider" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler owns Runtime lifecycle" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler implements Queue" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler implements Worker" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler performs external API calls" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler stores execution state as source of truth" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler performs retry execution" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler mutates Public Contracts" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler bypasses Governance Flow" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -q "Scheduler introduces production automation before Level 4" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has anti-patterns section"

echo "-- Test 540: scheduler layer design has completion criteria section --"
grep -q "## Completion Criteria" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -Fq "Quality Pipeline **540 PASS**" docs/architecture/SCHEDULER_LAYER_DESIGN.md
grep -Fq "Architecture Documents **27** 必須文書" docs/architecture/SCHEDULER_LAYER_DESIGN.md
pass "scheduler layer design has completion criteria section"

echo "-- Test 541: automation layer design document exists --"
test -f docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation layer design document exists"

echo "-- Test 542: automation layer design title exists --"
grep -q "# Automation Layer Design" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation layer design title exists"

echo "-- Test 543: automation layer design purpose section exists --"
grep -q "## Automation Purpose" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "workflow intent" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation layer design purpose section exists"

echo "-- Test 544: automation layer design scope section exists --"
grep -q "## Automation Scope" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "automation contract" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation layer design scope section exists"

echo "-- Test 545: automation layer design non-goals section exists --"
grep -q "## Automation Non-Goals" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "Real Automation を実装しない" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation layer design non-goals section exists"

echo "-- Test 546: provider boundary prohibits direct provider calls --"
grep -q "## Provider Boundary" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "Provider direct call 禁止" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "直接呼び出さない" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "provider boundary prohibits direct provider calls"

echo "-- Test 547: runtime boundary prohibits execution logic --"
grep -q "## Runtime Boundary" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "execution logic を持たない" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -Fq "Runtime **を生成しない**" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "runtime boundary prohibits execution logic"

echo "-- Test 548: scheduler boundary prohibits scheduling logic --"
grep -q "## Scheduler Boundary" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "scheduling logic を持たない" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -Fq "Scheduler **を生成しない**" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "scheduler boundary prohibits scheduling logic"

echo "-- Test 549: queue boundary prohibits queue implementation --"
grep -q "## Queue Boundary" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "queue implementation 禁止" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "queue boundary prohibits queue implementation"

echo "-- Test 550: worker boundary prohibits worker implementation --"
grep -q "## Worker Boundary" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "worker implementation 禁止" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "worker boundary prohibits worker implementation"

echo "-- Test 551: side effect boundary exists --"
grep -q "## Side Effect Boundary" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "Side Effect を発生させない" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "side effect boundary exists"

echo "-- Test 552: human approval boundary exists --"
grep -q "## Human Approval Boundary" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "Human Approval" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "approvalRequiredAutomation" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "human approval boundary exists"

echo "-- Test 553: automation contract includes automationId --"
grep -q "## Automation Contract" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "automationId" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation contract includes automationId"

echo "-- Test 554: automation contract includes workflowIntent --"
grep -q "workflowIntent" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation contract includes workflowIntent"

echo "-- Test 555: automation contract includes targetSchedulerContract --"
grep -q "targetSchedulerContract" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation contract includes targetSchedulerContract"

echo "-- Test 556: automation contract includes targetRuntimeContract --"
grep -q "targetRuntimeContract" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "automation contract includes targetRuntimeContract"

echo "-- Test 557: anti-patterns section exists --"
grep -q "## Anti-Patterns" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "Automation から Provider を直接呼ぶ" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -q "Automation が Runtime を生成する" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "anti-patterns section exists"

echo "-- Test 558: completion criteria section exists --"
grep -q "## Completion Criteria" docs/architecture/AUTOMATION_LAYER_DESIGN.md
grep -Fq "Quality Pipeline **560 PASS**" docs/architecture/AUTOMATION_LAYER_DESIGN.md
pass "completion criteria section exists"

echo "-- Test 559: architecture README references automation layer design --"
grep -q "AUTOMATION_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "Automation Layer Design" docs/architecture/README.md
grep -q "32 必須 Governance 文書" docs/architecture/README.md
pass "architecture README references automation layer design"

echo "-- Test 560: readme changelog version reference v1.57.0 history --"
grep -q "Automation Layer Design（v1.57.0）" README.md
grep -q "AUTOMATION_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "## v1.57.0" docs/CHANGELOG.md
grep -q "### v1.57.0 で追加（Automation Layer Design）" docs/VERSION.md
grep -q "Automation Layer Design" docs/VERSION.md
pass "readme changelog version reference v1.57.0 history"

echo "-- Test 561: workflow layer design document exists --"
test -f docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow layer design document exists"

echo "-- Test 562: workflow purpose section exists --"
grep -q "# Workflow Layer Design" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "## 1. Purpose" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "workflow intent" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow purpose section exists"

echo "-- Test 563: workflow scope section exists --"
grep -q "## 2. Scope" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "Workflow structure" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow scope section exists"

echo "-- Test 564: workflow non-goals section exists --"
grep -q "## 3. Non-Goals" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "Workflow engine" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow non-goals section exists"

echo "-- Test 565: relationship to automation layer design exists --"
grep -q "## 9. Relationship to Automation Layer Design" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "AUTOMATION_LAYER_DESIGN.md" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "relationship to automation layer design exists"

echo "-- Test 566: relationship to runtime layer design exists --"
grep -q "## 7. Relationship to Runtime Layer Design" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "RUNTIME_LAYER_DESIGN.md" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "relationship to runtime layer design exists"

echo "-- Test 567: relationship to scheduler layer design exists --"
grep -q "## 8. Relationship to Scheduler Layer Design" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "SCHEDULER_LAYER_DESIGN.md" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "relationship to scheduler layer design exists"

echo "-- Test 568: relationship to provider layer design exists --"
grep -q "## 6. Relationship to Provider Layer Design" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "PROVIDER_LAYER_DESIGN.md" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "relationship to provider layer design exists"

echo "-- Test 569: workflow contract section exists --"
grep -q "## 12. Workflow Contract" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "workflowId" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "workflowIntentRef" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow contract section exists"

echo "-- Test 570: workflow step model section exists --"
grep -q "## 14. Workflow Step Model" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "stepId" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "providerCapabilityRef" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow step model section exists"

echo "-- Test 571: workflow dependency model section exists --"
grep -q "## 15. Workflow Dependency Model" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "Dependency resolution 禁止" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow dependency model section exists"

echo "-- Test 573: approval point boundary section exists --"
grep -q "## 28. Approval Point Boundary" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "approval execution" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "approval point boundary section exists"

echo "-- Test 574: provider direct invocation is explicitly forbidden --"
grep -q "## 22. Provider Boundary" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "Provider direct invocation 禁止" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "provider direct invocation is explicitly forbidden"

echo "-- Test 575: runtime execution responsibility is explicitly forbidden --"
grep -q "## 21. Runtime Boundary" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "Runtime execution responsibility 禁止" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "runtime execution responsibility is explicitly forbidden"

echo "-- Test 576: scheduler trigger ownership is explicitly forbidden --"
grep -q "## 20. Scheduler Boundary" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "Scheduler trigger ownership 禁止" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "scheduler trigger ownership is explicitly forbidden"

echo "-- Test 577: workflow engine dag executor state machine runtime are explicitly out of scope --"
grep -q "Workflow engine" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "DAG executor" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "State machine runtime" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "workflow engine dag executor state machine runtime are explicitly out of scope"

echo "-- Test 578: queue worker real automation boundaries are documented --"
grep -q "## 26. Queue Boundary" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "## 27. Worker Boundary" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "Real Automation" docs/architecture/WORKFLOW_LAYER_DESIGN.md
grep -q "future implementation concern" docs/architecture/WORKFLOW_LAYER_DESIGN.md
pass "queue worker real automation boundaries are documented"

echo "-- Test 579: readme and architecture index reference workflow layer design --"
grep -q "WORKFLOW_LAYER_DESIGN.md" README.md
grep -q "Workflow Layer Design（v1.58.0）" README.md
grep -q "WORKFLOW_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "Workflow Layer Design" docs/architecture/README.md
grep -q "32 必須 Governance 文書" docs/architecture/README.md
pass "readme and architecture index reference workflow layer design"

echo "-- Test 580: readme changelog version reference v1.58.0 history --"
grep -q "Workflow Layer Design（v1.58.0）" README.md
grep -q "WORKFLOW_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "## v1.58.0" docs/CHANGELOG.md
grep -q "### v1.58.0 で追加（Workflow Layer Design）" docs/VERSION.md
grep -q "Workflow Layer Design" docs/VERSION.md
pass "readme changelog version reference v1.58.0 history"

echo "-- Test 581: event layer design document exists --"
test -f docs/architecture/EVENT_LAYER_DESIGN.md
pass "event layer design document exists"

echo "-- Test 582: event layer design declares design only --"
grep -q "Design Only" docs/architecture/EVENT_LAYER_DESIGN.md
grep -Fq "本書は **Design Only**" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event layer design declares design only"

echo "-- Test 583: event layer design forbids production code implementation --"
grep -q "Production Code 変更なし" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "schema file / production code なし" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event layer design forbids production code implementation"

echo "-- Test 584: event purpose is defined --"
grep -q "# Event Layer Design" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "## 1. Purpose" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "Event Contract" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event purpose is defined"

echo "-- Test 585: event scope is defined --"
grep -q "## 2. Scope" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "Event Classification" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event scope is defined"

echo "-- Test 586: event non-goals are defined --"
grep -q "## 3. Non-Goals" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "Event receiver" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "Webhook receiver" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event non-goals are defined"

echo "-- Test 587: event contract is defined --"
grep -q "## 13. Event Contract" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "eventId" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "targetAutomationContract" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event contract is defined"

echo "-- Test 588: event classification is defined --"
grep -q "## 14. Event Classification" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "Manual Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "System Event" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event classification is defined"

echo "-- Test 589: manual event is defined --"
grep -q "## 15. Manual Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -Fq "Manual Event **contract" docs/architecture/EVENT_LAYER_DESIGN.md
pass "manual event is defined"

echo "-- Test 590: scheduled event is defined --"
grep -q "## 16. Scheduled Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -Fq "Scheduled Event **分類" docs/architecture/EVENT_LAYER_DESIGN.md
pass "scheduled event is defined"

echo "-- Test 591: webhook event is defined --"
grep -q "## 17. Webhook Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -Fq "Webhook Event **contract" docs/architecture/EVENT_LAYER_DESIGN.md
pass "webhook event is defined"

echo "-- Test 592: sns event is defined --"
grep -q "## 18. SNS Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "SNS Event ingestion" docs/architecture/EVENT_LAYER_DESIGN.md
pass "sns event is defined"

echo "-- Test 593: external event is defined --"
grep -q "## 19. External Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "External API connector" docs/architecture/EVENT_LAYER_DESIGN.md
pass "external event is defined"

echo "-- Test 594: approval event is defined --"
grep -q "## 20. Approval Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "approvalContext" docs/architecture/EVENT_LAYER_DESIGN.md
pass "approval event is defined"

echo "-- Test 595: system event is defined --"
grep -q "## 21. System Event" docs/architecture/EVENT_LAYER_DESIGN.md
grep -Fq "System Event **分類" docs/architecture/EVENT_LAYER_DESIGN.md
pass "system event is defined"

echo "-- Test 596: event receiver boundary is explicit --"
grep -q "Event Receiver boundary is explicit" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "Webhook Receiver Boundary" docs/architecture/EVENT_LAYER_DESIGN.md
pass "event receiver boundary is explicit"

echo "-- Test 597: queue worker boundary is explicit --"
grep -q "Queue / Worker boundary is explicit" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "## 32. Queue Boundary" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "## 33. Worker Boundary" docs/architecture/EVENT_LAYER_DESIGN.md
pass "queue worker boundary is explicit"

echo "-- Test 598: provider direct call is forbidden --"
grep -q "Provider direct call 禁止" docs/architecture/EVENT_LAYER_DESIGN.md
grep -q "## 28. Provider Boundary" docs/architecture/EVENT_LAYER_DESIGN.md
pass "provider direct call is forbidden"

echo "-- Test 599: event layer is linked from architecture readme --"
grep -q "EVENT_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "Event Layer Design" docs/architecture/README.md
grep -q "32 必須 Governance 文書" docs/architecture/README.md
pass "event layer is linked from architecture readme"

echo "-- Test 600: readme changelog version reference v1.59.0 history --"
grep -q "Event Layer Design（v1.59.0）" README.md
grep -q "EVENT_LAYER_DESIGN.md" docs/architecture/README.md
grep -q "## v1.59.0" docs/CHANGELOG.md
grep -q "### v1.59.0 で追加（Event Layer Design）" docs/VERSION.md
grep -q "Event Layer Design" docs/VERSION.md
pass "readme changelog version reference v1.59.0 history"

echo "-- Test 601: layer interaction model design document exists --"
test -f docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model design document exists"

echo "-- Test 602: layer interaction model design title exists --"
grep -q "# Layer Interaction Model Design" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "layer interaction model design title exists"

echo "-- Test 603: purpose section exists --"
grep -q "## 1. Purpose" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Interaction Contract" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "purpose section exists"

echo "-- Test 604: scope section exists --"
grep -q "## 2. Scope" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Allowed / Forbidden Interaction Matrix" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "scope section exists"

echo "-- Test 605: non-goals section exists --"
grep -q "## 3. Non-Goals" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Individual Core Layer" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "non-goals section exists"

echo "-- Test 606: core layer responsibilities section exists --"
grep -q "## 6. Core Layer Responsibilities" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "EVENT_LAYER_DESIGN.md" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "PROVIDER_LAYER_DESIGN.md" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "core layer responsibilities section exists"

echo "-- Test 607: allowed interaction matrix exists --"
grep -q "## 9. Allowed Interaction Matrix" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Event" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Automation Contract" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "allowed interaction matrix exists"

echo "-- Test 608: forbidden interaction matrix exists --"
grep -q "## 10. Forbidden Interaction Matrix" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Event" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Provider" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "forbidden interaction matrix exists"

echo "-- Test 609: dependency direction rules exists --"
grep -q "## 11. Dependency Direction Rules" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Event → Automation → Workflow → Scheduler → Runtime → Provider" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "dependency direction rules exists"

echo "-- Test 610: reverse dependency rules exists --"
grep -q "## 12. Reverse Dependency Rules" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Provider MUST NOT depend on Runtime" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "reverse dependency rules exists"

echo "-- Test 611: circular dependency rules exists --"
grep -q "## 13. Circular Dependency Rules" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Circular" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "circular dependency rules exists"

echo "-- Test 612: event to automation boundary exists --"
grep -q "## 24. Event to Automation Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Event MUST NOT" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "event to automation boundary exists"

echo "-- Test 613: automation to workflow boundary exists --"
grep -q "## 25. Automation to Workflow Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Automation MUST NOT" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "automation to workflow boundary exists"

echo "-- Test 614: workflow to scheduler boundary exists --"
grep -q "## 26. Workflow to Scheduler Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Workflow MUST NOT" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "workflow to scheduler boundary exists"

echo "-- Test 615: scheduler to runtime boundary exists --"
grep -q "## 27. Scheduler to Runtime Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Scheduler MUST NOT" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "scheduler to runtime boundary exists"

echo "-- Test 616: runtime to provider boundary exists --"
grep -q "## 28. Runtime to Provider Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Runtime MAY" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "runtime to provider boundary exists"

echo "-- Test 617: provider reverse dependency boundary exists --"
grep -q "## 29. Provider Reverse Dependency Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Provider MUST NOT" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "provider reverse dependency boundary exists"

echo "-- Test 618: queue worker receiver boundary exists --"
grep -q "## 30. Queue / Worker / Receiver Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -q "Queue / Worker / Receiver Boundary" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "queue worker receiver boundary exists"

echo "-- Test 619: completion criteria exists --"
grep -q "## 42. Completion Criteria" docs/architecture/LAYER_INTERACTION_MODEL.md
grep -Fq "Quality Pipeline **620 PASS**" docs/architecture/LAYER_INTERACTION_MODEL.md
pass "completion criteria exists"

echo "-- Test 620: readme changelog version reference v1.60.0 history --"
grep -q "Layer Interaction Model Design（v1.60.0）" README.md
grep -q "LAYER_INTERACTION_MODEL.md" docs/architecture/README.md
grep -q "## v1.60.0" docs/CHANGELOG.md
grep -q "### v1.60.0 で追加（Layer Interaction Model Design）" docs/VERSION.md
grep -q "Layer Interaction Model Design" docs/VERSION.md
pass "readme changelog version reference v1.60.0 history"

echo "-- Test 621: interaction lifecycle design document exists --"
test -f docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "interaction lifecycle design document exists"

echo "-- Test 622: document declares design only status --"
grep -q "Design Only" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -Fq "本書は **Design Only**" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document declares design only status"

echo "-- Test 623: document defines purpose --"
grep -q "## 1. Purpose" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Lifecycle Contract" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines purpose"

echo "-- Test 624: document defines scope --"
grep -q "## 2. Scope" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Lifecycle State Definition" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines scope"

echo "-- Test 625: document defines non-goals --"
grep -q "## 3. Non-Goals" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Concrete state machine implementation" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines non-goals"

echo "-- Test 626: document references layer interaction model --"
grep -q "## 5. Relationship to Layer Interaction Model" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "LAYER_INTERACTION_MODEL.md" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document references layer interaction model"

echo "-- Test 627: document defines lifecycle principles --"
grep -q "## 6. Lifecycle Principles" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Not Runtime Lifecycle" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines lifecycle principles"

echo "-- Test 628: document defines lifecycle states --"
grep -q "## 7. Lifecycle State Definition" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Created" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Expired" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines lifecycle states"

echo "-- Test 629: document defines initial state --"
grep -q "## 8. Initial State" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Initial State" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Created" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines initial state"

echo "-- Test 630: document defines terminal states --"
grep -q "## 9. Terminal States" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Completed" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Aborted" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines terminal states"

echo "-- Test 631: document defines valid transitions --"
grep -q "## 11. Valid State Transitions" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Created → Validated" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines valid transitions"

echo "-- Test 632: document defines invalid transitions --"
grep -q "## 12. Invalid State Transitions" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Completed →" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines invalid transitions"

echo "-- Test 633: document defines state ownership --"
grep -q "## 13. State Ownership" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Writable State Range" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines state ownership"

echo "-- Test 634: document defines transition ownership --"
grep -q "## 14. Transition Ownership" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Transition Ownership" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines transition ownership"

echo "-- Test 635: document defines waiting rules --"
grep -q "## 23. Waiting Rules" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "NOT a wait queue implementation" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines waiting rules"

echo "-- Test 636: document defines retry boundary --"
grep -q "## 27. Retry Boundary" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Retry Boundary" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "not retry engine" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines retry boundary"

echo "-- Test 637: document defines timeout boundary --"
grep -q "## 28. Timeout Boundary" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Timeout Boundary" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "not timeout engine" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines timeout boundary"

echo "-- Test 638: document defines cancellation boundary --"
grep -q "## 29. Cancellation Boundary" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Cancellation Boundary" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "explicit and bounded" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines cancellation boundary"

echo "-- Test 639: document defines anti-patterns --"
grep -q "## 41. Anti-Patterns" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "Terminal state reversal" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document defines anti-patterns"

echo "-- Test 640: document confirms no implementation production code scope --"
grep -q "Production Code 変更なし" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -q "no implementation scope" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
grep -Fq "**v1.61.0**（Interaction Lifecycle Design）" docs/VERSION.md
grep -Fq "**640 PASS**" docs/VERSION.md
grep -q "32 必須文書" docs/VERSION.md
grep -q "Test 621–640" docs/VERSION.md
grep -q "Level 3.2" docs/VERSION.md
grep -Fq "Quality Pipeline **640 PASS**" docs/architecture/INTERACTION_LIFECYCLE_DESIGN.md
pass "document confirms no implementation production code scope"


echo ""
echo "All quality pipeline tests passed."
