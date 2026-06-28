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
echo "-- Test 34: --resume continues from checkpoint --"
node --input-type=module <<'EOF'
import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";
import { PIPELINE_PHASES } from "./src/lib/phases.js";
import { buildResumeCheckpoint, writeResumeState } from "./src/lib/pipeline_resume.js";

const latestDir = path.join(PROJECT_ROOT, "reports/quality-pipeline/latest");
const pipelineStatePath = path.join(latestDir, "pipeline_state.json");
const pipelineState = JSON.parse(await fs.readFile(pipelineStatePath, "utf-8"));

pipelineState.status = "running";
pipelineState.phase = PIPELINE_PHASES.EXPORT;
pipelineState.completedSteps = (pipelineState.completedSteps ?? []).filter(
  (phase) => phase !== PIPELINE_PHASES.REPORT && phase !== PIPELINE_PHASES.COMPLETE,
);
await fs.writeFile(pipelineStatePath, `${JSON.stringify(pipelineState, null, 2)}\n`);

const checkpoint = buildResumeCheckpoint({
  pipelineState,
  config: { ...pipelineState.config, dryRun: true },
  status: "resumable",
});
checkpoint.nextPhase = PIPELINE_PHASES.REPORT;
await writeResumeState(checkpoint);

console.log("checkpoint prepared for REPORT resume");
EOF
node scripts/run_quality_pipeline.js --resume 2>&1 | tail -5
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./src/lib/pipeline_state.js";

const pipelineState = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/quality-pipeline/latest/pipeline_state.json"),
    "utf-8",
  ),
);

if (!pipelineState.completedSteps.includes("REPORT")) {
  throw new Error("REPORT not completed after resume");
}
if (pipelineState.workspace?.action !== "resumed") {
  throw new Error("expected workspace action resumed");
}

const checkpoint = JSON.parse(
  fs.readFileSync(
    path.join(PROJECT_ROOT, "reports/quality-pipeline/latest/state.json"),
    "utf-8",
  ),
);
if (checkpoint.status !== "completed") {
  throw new Error(`expected completed checkpoint, got ${checkpoint.status}`);
}

console.log("resume continuation ok");
EOF
pass "resume continues from checkpoint"

echo ""
echo "All quality pipeline tests passed."
