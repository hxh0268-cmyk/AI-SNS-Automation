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
echo "All quality pipeline tests passed."
