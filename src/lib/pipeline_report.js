import fs from "node:fs/promises";
import path from "node:path";
import { SLIDE_COUNT } from "./carousel.js";
import { EXPORT_MANIFEST_FILENAME } from "./pipeline_export.js";
import { IMPROVEMENT_STOP_REASONS, IMPROVEMENT_TOOLS } from "./pipeline_improvement.js";
import { PIPELINE_METRICS_FILENAME } from "./pipeline_metrics.js";
import {
  DEFAULT_PIPELINE_STATE_DIR,
  PIPELINE_STATE_FILENAME,
  PROJECT_ROOT,
} from "./pipeline_state.js";

/** report.json スキーマ識別子（docs/REPORT_SCHEMA.md 参照） */
export const REPORT_SCHEMA_VERSION = "1.0";

/** quality pipeline report ツール識別子 */
export const REPORT_TOOL = "quality_pipeline_report";

/** レポート生成バージョン */
export const REPORT_VERSION = "v1.4.1";

/** scoreSummary / ReReview で使う source 値 */
const REVIEWED_SCORE_SOURCES = new Set([
  "nano_banana_re_review",
  "smart_auto_fix_re_review",
]);

/** apply 実行後に git status に出やすい output 副産物（commit 対象外） */
export const OUTPUT_ARTIFACT_PATHS = [
  "output/carousel/improved/manifest.json",
  "output/carousel/improved/slideXX.png",
  "output/instagram/package-info.json",
  "output/instagram/review-summary.md",
];

/** output 副産物の運用案内（README / report 共通） */
export const OUTPUT_ARTIFACT_GUIDANCE =
  "apply 実行後、`output/carousel/improved/` や `output/instagram/` に生成物が残ることがあります。これらは実行結果の副産物であり、通常は git commit しません。不要なら削除するか `.gitignore` で無視してください。";

/** report.json ファイル名 */
export const REPORT_JSON_FILENAME = "report.json";

/** report.md ファイル名 */
export const REPORT_MD_FILENAME = "report.md";

/**
 * stopReason 別の Next Actions 定義
 * @type {Record<string, string[]>}
 */
const STOP_REASON_NEXT_ACTIONS = {
  [IMPROVEMENT_STOP_REASONS.NO_SUCCESSFUL_ACTIONS_API_FAILED]: [
    "`.env` に必要な API キーを設定する（下記「API キー設定」を参照）",
    "`npm run health-check` でキー設定と quota を確認する",
    "`--dry-run` で改善計画を再確認してから `--apply` を実行する",
  ],
  [IMPROVEMENT_STOP_REASONS.NO_SUCCESSFUL_ACTIONS]: [
    "`.env` に必要な API キーを設定する（下記「API キー設定」を参照）",
    "`npm run health-check` でキー設定と quota を確認する",
    "`--dry-run` で改善計画を再確認してから `--apply` を実行する",
  ],
  [IMPROVEMENT_STOP_REASONS.LIMIT_ZERO_DETECTED]: [
    "Gemini / Nano Banana の API quota（limit:0）を確認する",
    "quota 回復まで待つか、別キー・課金プランを検討する",
    "`--max-api-calls` を下げて部分実行するか、翌日に再実行する",
  ],
  [IMPROVEMENT_STOP_REASONS.MAX_API_CALLS_REACHED]: [
    "`--max-api-calls` を増やして再実行する",
    "低スコアスライドのみ v1.2 個別スクリプト（`npm run image-improve` 等）で手動改善する",
    "`--dry-run` で改善対象を確認し、必要なら `--from-phase image-review` から再開する",
  ],
  [IMPROVEMENT_STOP_REASONS.MANUAL_REVIEW_ONLY]: [
    "手動レビューが必要なスライドを report のスライド別表で確認する",
    "TEXT rootCause は v1.4 以降 `smart_auto_fix` チェーンで pipeline 改善可能（`--apply` 時）",
    "PROMPT / openai_regenerate 対象は placeholder のため、個別スクリプトまたは手動対応",
  ],
  [IMPROVEMENT_STOP_REASONS.NO_SCORE_IMPROVEMENT]: [
    "rootCause と改善 tool の組み合わせを見直す（prompt / レイアウト / スタイル）",
    "`--max-rounds` を増やして再実行する",
    "改善前後の score を比較し、手動でスライド内容または画像を修正する",
  ],
};

/** API キー設定案内の定義 */
const API_KEY_HINT_SPECS = [
  {
    id: "nano_banana",
    label: "Nano Banana API",
    envVars: ["NANO_BANANA_API_KEY", "GEMINI_API_KEY"],
    setup:
      "`.env` に `NANO_BANANA_API_KEY=...` を設定する（未設定時は `GEMINI_API_KEY` でも可。TEXT チェーンの Regeneration にも使用）",
    tools: [IMPROVEMENT_TOOLS.NANO_BANANA, IMPROVEMENT_TOOLS.SMART_AUTO_FIX],
    errorPatterns: [/NANO_BANANA_API_KEY/i, /Nano Banana.*API/i],
  },
  {
    id: "gemini",
    label: "Gemini API",
    envVars: ["GEMINI_API_KEY"],
    setup: "`.env` に `GEMINI_API_KEY=...` を設定する（Gemini 再レビュー・Nano Banana 代替キー用）",
    tools: [],
    errorPatterns: [/GEMINI_API_KEY/i, /GEMINI_QUOTA_EXCEEDED/i],
  },
  {
    id: "openai",
    label: "OpenAI API",
    envVars: ["OPENAI_API_KEY"],
    setup:
      "`.env` に `OPENAI_API_KEY=...` を設定する（openai_regenerate 用。pipeline では placeholder のまま）",
    tools: [IMPROVEMENT_TOOLS.OPENAI_REGENERATE],
    errorPatterns: [/OPENAI_API_KEY/i],
  },
];

/**
 * 環境変数が設定されているか（いずれかで可）
 * @param {string[]} envVars
 * @returns {boolean}
 */
function isAnyEnvVarSet(envVars) {
  return envVars.some((name) => Boolean(process.env[name]?.trim()));
}

/**
 * improvement history / items から使用 tool を収集する
 * @param {object} state
 * @param {object[]} items
 * @returns {Set<string>}
 */
function collectUsedTools(state, items) {
  /** @type {Set<string>} */
  const tools = new Set();

  for (const roundEntry of state.improvement?.history ?? []) {
    for (const target of roundEntry.targets ?? []) {
      if (target.tool) {
        tools.add(target.tool);
      }
    }
    for (const target of roundEntry.plan?.targets ?? []) {
      if (target.tool) {
        tools.add(target.tool);
      }
    }
  }

  for (const target of state.improvement?.lastPlan?.targets ?? []) {
    if (target.tool) {
      tools.add(target.tool);
    }
  }

  for (const item of items) {
    if (item.improvementTool) {
      tools.add(item.improvementTool);
    }
    if (item.textChainConnected) {
      tools.add(IMPROVEMENT_TOOLS.SMART_AUTO_FIX);
    }
  }

  if (tools.has(IMPROVEMENT_TOOLS.SMART_AUTO_FIX)) {
    tools.add(IMPROVEMENT_TOOLS.NANO_BANANA);
    tools.add("gemini_re_review");
  }

  if ((state.improvement?.roundsExecuted ?? 0) > 0 || tools.size > 0) {
    tools.add(IMPROVEMENT_TOOLS.NANO_BANANA);
    tools.add("gemini_re_review");
  }

  return tools;
}

/**
 * エラーメッセージを収集する
 * @param {object} state
 * @param {object[]} items
 * @returns {string[]}
 */
function collectErrorMessages(state, items) {
  /** @type {string[]} */
  const messages = [];

  for (const roundEntry of state.improvement?.history ?? []) {
    for (const target of roundEntry.targets ?? []) {
      if (target.error) {
        messages.push(String(target.error));
      }
    }
  }

  for (const item of items) {
    if (item.error) {
      messages.push(String(item.error));
    }
  }

  for (const step of state.failedSteps ?? []) {
    if (step.reason) {
      messages.push(String(step.reason));
    }
  }

  return messages;
}

/**
 * API キー未設定・エラーに基づく設定案内を生成する
 * @param {object} params
 * @returns {object[]}
 */
export function buildApiKeyHints({ state, config, items }) {
  const dryRun = config.dryRun ?? state.config?.dryRun ?? true;
  const usedTools = collectUsedTools(state, items);
  const errorMessages = collectErrorMessages(state, items);
  const stopReason =
    state.improvement?.stopReason ??
    null;
  const apiFailed =
    stopReason === IMPROVEMENT_STOP_REASONS.NO_SUCCESSFUL_ACTIONS_API_FAILED ||
    stopReason === IMPROVEMENT_STOP_REASONS.NO_SUCCESSFUL_ACTIONS;

  /** @type {object[]} */
  const hints = [];

  for (const spec of API_KEY_HINT_SPECS) {
    if (isAnyEnvVarSet(spec.envVars)) {
      continue;
    }

    const toolMatch = spec.tools.some((tool) => usedTools.has(tool));
    const errorMatch = errorMessages.some((message) =>
      spec.errorPatterns.some((pattern) => pattern.test(message)),
    );
    const geminiReReviewNeeded =
      spec.id === "gemini" &&
      (usedTools.has("gemini_re_review") ||
        usedTools.has(IMPROVEMENT_TOOLS.SMART_AUTO_FIX) ||
        (state.improvement?.roundsExecuted ?? 0) > 0);
    const applyNeedsKey = !dryRun && (toolMatch || geminiReReviewNeeded);
    const dryRunInformative =
      dryRun &&
      (toolMatch || geminiReReviewNeeded) &&
      (state.improvement?.lastPlan?.totalTargets ?? 0) > 0;

    if (errorMatch || apiFailed || applyNeedsKey || dryRunInformative) {
      hints.push({
        id: spec.id,
        label: spec.label,
        envVars: spec.envVars,
        setup: spec.setup,
        reason: errorMatch
          ? "error_detected"
          : apiFailed
            ? "api_failed"
            : dryRunInformative
              ? "planned_for_apply"
              : "apply_mode",
      });
    }
  }

  return hints;
}

/**
 * stopReason と実行結果から Next Actions を生成する
 * @param {object} params
 * @returns {string[]}
 */
export function buildNextActions({ summary, items, config, apiKeyHints }) {
  /** @type {string[]} */
  const actions = [];

  const stopReason = summary.improvementStopReason;
  if (stopReason && STOP_REASON_NEXT_ACTIONS[stopReason]) {
    actions.push(...STOP_REASON_NEXT_ACTIONS[stopReason]);
  }

  if (apiKeyHints.length > 0 && !actions.some((action) => action.includes("API キー"))) {
    actions.unshift("`.env` に不足している API キーを設定する（下記「API キー設定」を参照）");
  }

  if (summary.improvementFailedCount > 0 && !stopReason) {
    actions.push("改善失敗スライドをスライド別表で確認し、個別に再実行する");
  }

  if (
    !summary.dryRun &&
    !summary.allSlidesPublishRecommended &&
    summary.exportSkipped
  ) {
    actions.push(
      "targetScore 未達のため export がスキップされています。改善ループを継続するか `--allow-partial-export` を検討する",
    );
  }

  if (summary.dryRun && (summary.plannedActions ?? 0) > 0) {
    actions.unshift(
      "`reports/quality-pipeline/latest/report.md` で計画・API キー案内・apply 実行判断を確認する",
    );
    actions.push(
      "`npm run health-check` で API キーと quota を確認する",
      "問題なければ `npm run quality-pipeline:apply -- --from-phase image-review` を実行する",
    );
  } else if (summary.dryRun) {
    actions.push(
      "計画確認が完了したら `--apply` で本番実行する（API キーと quota を事前に確認）",
    );
  }

  if (actions.length === 0 && summary.pipelineStatus === "completed") {
    actions.push("特記事項なし。必要に応じて export 成果物と Instagram Package を確認する");
  }

  return [...new Set(actions)];
}

/** API キー hint の reason ラベル */
const API_KEY_HINT_REASON_LABELS = {
  error_detected: "エラー検出",
  api_failed: "API 失敗",
  planned_for_apply: "dry-run 計画（`--apply` 前に設定）",
  apply_mode: "apply 実行中",
};

/**
 * report.md 用: 通常 commit 不要の副産物セクション
 * @returns {string}
 */
export function buildNonCommittableArtifactsMarkdown() {
  return `## 通常 commit 不要の副産物

品質パイプライン実行後、次のパスが変更されることがあります。**通常は git commit しません。**

| パス | 更新タイミング | git への影響 |
|------|---------------|-------------|
| \`reports/quality-pipeline/latest/*\` | dry-run / apply 共通 | \`.gitignore\` 対象（\`git status\` に出ない） |
| \`output/carousel/improved/*\` | apply 時（dry-run では基本なし） | 追跡済みファイルは **M**、新規 PNG は **??** |
| \`output/instagram/*\` | apply + export 条件達成時 | 同上 |

${OUTPUT_ARTIFACT_GUIDANCE}

整理コマンド例:

\`\`\`bash
git restore output/
git clean -fd output/carousel/improved/
\`\`\`

よく残るパス:

${OUTPUT_ARTIFACT_PATHS.map((artifactPath) => `- \`${artifactPath}\``).join("\n")}
`;
}

/**
 * report.md 用: dry-run / latest / archive セクション
 * @param {object} summary
 * @returns {string}
 */
export function buildDryRunLatestArchiveMarkdown(summary) {
  const modeLabel = summary.dryRun ? "dry-run" : "apply";
  const cleanNote = summary.cleanLatest
    ? "- 今回は `--clean-latest` により、実行前に `latest` を削除しました（archive 退避なし）"
    : summary.workspaceAction === "archived" && summary.archivePath
      ? `- 今回の実行前に、前回の \`latest\` を \`${summary.archivePath}\` へ退避しました`
      : "- 今回の実行前に退避対象の `latest` はありませんでした";

  return `## dry-run / latest / archive

- 本実行モード: **${modeLabel}**
- **dry-run でも** \`reports/quality-pipeline/latest/\` は更新されます（計画結果・レポート保存のため）
- 次回 pipeline 実行時、既存 \`latest\` は \`reports/quality-pipeline/archive/YYYY-MM-DD-HHmmss/\` へ退避されてから上書きされます
- \`--clean-latest\` 指定時は退避せず \`latest\` を削除してから実行します

${cleanNote}
`;
}

/**
 * report.md 用: --apply 実行判断セクション
 * @param {object} summary
 * @returns {string}
 */
export function buildApplyDecisionMarkdown(summary) {
  const hints = summary.apiKeyHints ?? [];
  const missingKeys =
    hints.length > 0
      ? hints.map((hint) => `- **${hint.label}**: ${hint.envVars.map((name) => `\`${name}\``).join(" / ")}`).join("\n")
      : "- （不足キーなし — 計画上必要なキーは設定済み）";

  const applyRecommendation = summary.dryRun
    ? hints.length > 0
      ? "**dry-run 完了。API キー設定後に `--apply` を実行してください。**"
      : summary.plannedActions > 0
        ? "**dry-run 完了。report 確認後、`--apply` 実行可能です。**"
        : "**dry-run 完了。改善 target がなければ apply は不要です。**"
    : summary.limitZeroDetected
      ? "**quota limit:0 検出。翌日まで待つか quota を確認してください。**"
      : hints.length > 0
        ? "**apply 実行中または完了。不足 API キーを設定して再実行してください。**"
        : "**apply 実行完了。export / スライド別表を確認してください。**";

  return `## --apply 実行判断

${applyRecommendation}

| 条件 | 推奨 |
|------|------|
| dry-run 完了 + report 確認済み + 必要 API キー設定済み | \`npm run quality-pipeline:apply -- --from-phase image-review\` |
| \`GEMINI_API_KEY\` 未設定 + ReReview 予定あり | 先に \`.env\` を設定 |
| 改善 target あり + API キー不足 | \`NO_SUCCESSFUL_ACTIONS_API_FAILED\` 等で失敗する可能性 |
| quota limit:0 検出 | 翌日以降に再実行、または quota / 課金プランを確認 |

### 不足している API キー（計画 / 実行に基づく）

${missingKeys}

### rootCause 別に必要な処理（apply 時）

| rootCause | 処理 |
|-----------|------|
| **LAYOUT / STYLE / BOOST** | Nano Banana 直呼び → Gemini ReReview（\`GEMINI_API_KEY\` または \`NANO_BANANA_API_KEY\`） |
| **TEXT** | Smart Auto Fix（slide/prompt 追記）→ Regeneration Engine → Nano Banana adapter → Gemini ReReview |
| **PROMPT** | \`openai_regenerate\`（pipeline では placeholder） |
`;
}

/**
 * export manifest を読み込む
 * @param {string} [outputDir]
 * @returns {Promise<object | null>}
 */
export async function readExportManifest(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const manifestPath = path.join(outputDir, EXPORT_MANIFEST_FILENAME);
  const absolutePath = path.join(PROJECT_ROOT, manifestPath);

  try {
    const raw = await fs.readFile(absolutePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * improvement history から slide 別の改善情報を集約する
 * @param {object} state
 * @returns {Map<string, object>}
 */
function buildImprovementBySlideId(state) {
  /** @type {Map<string, object>} */
  const bySlideId = new Map();

  for (const roundEntry of state.improvement?.history ?? []) {
    for (const target of roundEntry.targets ?? []) {
      if (!target.slideId) {
        continue;
      }

      bySlideId.set(target.slideId, {
        round: roundEntry.round,
        tool: target.tool ?? null,
        improvementStatus: target.status ?? null,
        beforeScore: target.beforeScore ?? null,
        rootCause: target.rootCause ?? null,
        error: target.error ?? null,
        action: target.action ?? null,
        improvementPipeline: target.improvementPipeline ?? null,
        regenerationAdapter:
          target.regenerationAdapter ?? target.regeneration?.adapterId ?? null,
        smartAutoFix: target.smartAutoFix ?? null,
        regeneration: target.regeneration ?? null,
      });
    }
  }

  return bySlideId;
}

/**
 * export manifest から slide 別の export 情報を集約する
 * @param {object | null | undefined} exportManifest
 * @returns {Map<string, object>}
 */
function buildExportSelectionBySlideId(exportManifest) {
  /** @type {Map<string, object>} */
  const bySlideId = new Map();

  for (const selection of exportManifest?.selections ?? []) {
    if (!selection.slideId) {
      continue;
    }
    bySlideId.set(selection.slideId, selection);
  }

  return bySlideId;
}

/**
 * recommendation を判定する
 * @param {object} params
 * @returns {string}
 */
function resolveRecommendation(params) {
  const {
    finalScore,
    targetScore,
    passingScore,
    improvementStatus,
    dryRun,
    wasImprovementTarget,
  } = params;

  if (improvementStatus === "failed" || improvementStatus === "saf_failed" || improvementStatus === "regen_failed") {
    return "improvement_failed";
  }

  if (improvementStatus === "planned" && dryRun) {
    return "review_pending";
  }

  if (typeof finalScore === "number") {
    if (finalScore >= targetScore) {
      return "publish_recommended";
    }
    if (finalScore >= passingScore) {
      return "passed";
    }
    return "needs_re_improvement";
  }

  if (dryRun && wasImprovementTarget) {
    return "review_pending";
  }

  return "review_pending";
}

/**
 * quality pipeline レポートを組み立てる
 * @param {object} params
 * @param {object} params.state
 * @param {object} params.metrics
 * @param {object | null} [params.exportManifest]
 * @param {object} params.config
 * @returns {object}
 */
export function buildPipelineReport({ state, metrics, exportManifest = null, config }) {
  const targetScore = config.targetScore ?? state.config?.targetScore ?? 90;
  const passingScore = config.passingScore ?? state.config?.passingScore ?? 80;
  const dryRun = config.dryRun ?? state.config?.dryRun ?? false;
  const scoreSummary = state.scoreSummary ?? { slides: [] };
  const improvementBySlideId = buildImprovementBySlideId(state);
  const exportBySlideId = buildExportSelectionBySlideId(exportManifest);
  const exportInfo = state.export ?? metrics.export ?? {};

  const improvementHistory = state.improvement?.history ?? [];
  const textChainConnected = improvementHistory.some((roundEntry) =>
    (roundEntry.targets ?? []).some(
      (target) =>
        target.tool === IMPROVEMENT_TOOLS.SMART_AUTO_FIX ||
        (target.improvementPipeline ?? []).includes("regeneration_engine"),
    ),
  );

  const items = (scoreSummary.slides ?? []).map((slide) => {
    const improvement = improvementBySlideId.get(slide.slideId) ?? null;
    const exportSelection = exportBySlideId.get(slide.slideId) ?? null;
    const beforeScore =
      improvement?.beforeScore ??
      exportSelection?.beforeScore ??
      slide.score ??
      null;
    const afterScore = slide.score ?? exportSelection?.score ?? null;
    const deltaScore =
      typeof beforeScore === "number" && typeof afterScore === "number"
        ? afterScore - beforeScore
        : null;

    const wasImprovementTarget = improvement !== null;

    const textChainSlide =
      improvement?.tool === IMPROVEMENT_TOOLS.SMART_AUTO_FIX ||
      (improvement?.improvementPipeline ?? []).includes("regeneration_engine");

    return {
      slideId: slide.slideId,
      beforeScore,
      afterScore,
      deltaScore,
      rootCause: improvement?.rootCause ?? slide.rootCause ?? null,
      improvementTool: improvement?.tool ?? null,
      improvementStatus: improvement?.improvementStatus ?? null,
      improvementPipeline: improvement?.improvementPipeline ?? null,
      regenerationAdapter: improvement?.regenerationAdapter ?? null,
      smartAutoFixStatus: improvement?.smartAutoFix?.status ?? null,
      regenerationStatus: improvement?.regeneration?.status ?? null,
      textChainConnected: textChainSlide,
      reviewStatus:
        REVIEWED_SCORE_SOURCES.has(slide.source)
          ? "reviewed"
          : improvement?.improvementStatus === "planned"
            ? "planned"
            : improvement?.improvementStatus === "improved"
              ? "review_pending"
              : null,
      exportSource: exportSelection?.source ?? null,
      adoptedImproved: exportSelection?.adoptedImproved ?? false,
      publishRecommended: slide.publishRecommended ?? false,
      passed: slide.passed ?? false,
      source: slide.source ?? null,
      error: improvement?.error ?? null,
      recommendation: resolveRecommendation({
        finalScore: afterScore,
        targetScore,
        passingScore,
        improvementStatus: improvement?.improvementStatus ?? null,
        dryRun,
        wasImprovementTarget,
      }),
    };
  });

  const summary = {
    dryRun,
    targetScore,
    passingScore,
    finalAverageScore: scoreSummary.averageScore ?? null,
    finalMinScore: scoreSummary.minScore ?? null,
    allSlidesPassed: scoreSummary.allSlidesPassed ?? false,
    allSlidesPublishRecommended: scoreSummary.allSlidesPublishRecommended ?? false,
    totalSlides: scoreSummary.slides?.length ?? SLIDE_COUNT,
    roundsExecuted: state.improvement?.roundsExecuted ?? metrics.improvement?.roundsExecuted ?? 0,
    maxRounds: state.improvement?.maxRounds ?? config.maxRounds ?? 3,
    improvementStopReason:
      state.improvement?.stopReason ?? metrics.improvement?.stopReason ?? null,
    plannedActions: metrics.improvement?.plannedActions ?? 0,
    executedNanoBanana: metrics.improvement?.executedNanoBanana ?? 0,
    executedGeminiReReview: metrics.improvement?.executedGeminiReReview ?? 0,
    executedSmartAutoFix: metrics.improvement?.executedSmartAutoFix ?? 0,
    successfulSmartAutoFix: metrics.improvement?.successfulSmartAutoFix ?? 0,
    failedSmartAutoFix: metrics.improvement?.failedSmartAutoFix ?? 0,
    executedRegeneration: metrics.improvement?.executedRegeneration ?? 0,
    successfulRegeneration: metrics.improvement?.successfulRegeneration ?? 0,
    failedRegeneration: metrics.improvement?.failedRegeneration ?? 0,
    textChainConnected,
    totalApiCalls: metrics.totalApiCalls ?? 0,
    failedCalls: metrics.failedCalls ?? 0,
    limitZeroDetected: metrics.limitZeroDetected ?? false,
    elapsedMs: metrics.elapsedMs ?? null,
    exportCompleted: exportInfo.completed ?? false,
    exportSkipped: exportInfo.skipped ?? true,
    exportSkipReason: exportInfo.skipReason ?? exportManifest?.skipReason ?? null,
    exportMode: exportInfo.mode ?? exportManifest?.mode ?? null,
    exportPath: exportInfo.path ?? exportManifest?.exportPath ?? null,
    allowPartialExport: config.allowPartialExport ?? state.config?.allowPartialExport ?? false,
    improvedAdoptedCount:
      exportInfo.improvedAdoptedCount ?? exportManifest?.improvedAdoptedCount ?? 0,
    publishRecommendedCount: items.filter(
      (item) => item.recommendation === "publish_recommended",
    ).length,
    passCount: items.filter((item) => item.recommendation === "passed").length,
    needsReImprovementCount: items.filter(
      (item) => item.recommendation === "needs_re_improvement",
    ).length,
    improvementFailedCount: items.filter(
      (item) => item.recommendation === "improvement_failed",
    ).length,
    reviewPendingCount: items.filter((item) => item.recommendation === "review_pending").length,
    pipelineStatus: state.status ?? null,
    completedSteps: state.completedSteps?.length ?? 0,
    failedSteps: state.failedSteps?.length ?? 0,
    workspaceAction: state.workspace?.action ?? null,
    archivePath: state.workspace?.archivePath ?? null,
    cleanLatest: config.cleanLatest ?? state.config?.cleanLatest ?? false,
  };

  const apiKeyHints = buildApiKeyHints({ state, config, items });
  const nextActions = buildNextActions({ summary, items, config, apiKeyHints });

  summary.apiKeyHints = apiKeyHints;
  summary.nextActions = nextActions;
  summary.outputArtifactGuidance = OUTPUT_ARTIFACT_GUIDANCE;
  summary.outputArtifactPaths = OUTPUT_ARTIFACT_PATHS;

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: REPORT_TOOL,
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    pipelineStateFile: `${DEFAULT_PIPELINE_STATE_DIR}/${PIPELINE_STATE_FILENAME}`,
    metricsFile: `${DEFAULT_PIPELINE_STATE_DIR}/${PIPELINE_METRICS_FILENAME}`,
    exportManifestFile: exportManifest
      ? `${DEFAULT_PIPELINE_STATE_DIR}/${EXPORT_MANIFEST_FILENAME}`
      : null,
    summary,
    items,
  };
}

/**
 * recommendation の日本語ラベル
 * @param {string} recommendation
 * @returns {string}
 */
function recommendationLabel(recommendation) {
  const labels = {
    publish_recommended: "公開推奨",
    passed: "合格",
    needs_re_improvement: "再改善候補",
    improvement_failed: "改善失敗",
    review_pending: "レビュー未実施",
  };
  return labels[recommendation] ?? recommendation;
}

/**
 * score を表示用に整形する
 * @param {number | null | undefined} score
 * @returns {string}
 */
function formatScore(score) {
  return typeof score === "number" ? String(score) : "—";
}

/**
 * delta を表示用に整形する
 * @param {number | null | undefined} delta
 * @returns {string}
 */
function formatDelta(delta) {
  if (typeof delta !== "number") {
    return "—";
  }
  return delta >= 0 ? `+${delta}` : String(delta);
}

/**
 * report.md 本文を生成する
 * @param {object} report
 * @returns {string}
 */
export function buildPipelineReportMarkdown(report) {
  const { summary, items } = report;

  const summaryRows = [
    ["モード", summary.dryRun ? "dry-run" : "apply"],
    ["パイプライン status", summary.pipelineStatus ?? "—"],
    ["targetScore", summary.targetScore],
    ["passingScore", summary.passingScore],
    ["最終平均 score", summary.finalAverageScore ?? "—"],
    ["最終最低 score", summary.finalMinScore ?? "—"],
    ["全スライド合格", summary.allSlidesPassed ? "はい" : "いいえ"],
    ["全スライド公開推奨", summary.allSlidesPublishRecommended ? "はい" : "いいえ"],
    ["改善ラウンド", `${summary.roundsExecuted}/${summary.maxRounds}`],
    ["改善停止理由", summary.improvementStopReason ?? "—"],
    ["TEXT チェーン接続", summary.textChainConnected ? "はい" : "いいえ"],
    ["Smart Auto Fix 実行", summary.executedSmartAutoFix ?? 0],
    ["Smart Auto Fix 成功", summary.successfulSmartAutoFix ?? 0],
    ["Smart Auto Fix 失敗", summary.failedSmartAutoFix ?? 0],
    ["Regeneration 実行", summary.executedRegeneration ?? 0],
    ["Regeneration 成功", summary.successfulRegeneration ?? 0],
    ["Regeneration 失敗", summary.failedRegeneration ?? 0],
    ["Gemini ReReview 実行", summary.executedGeminiReReview ?? 0],
    ["API 呼び出し", summary.totalApiCalls],
    ["API 失敗", summary.failedCalls],
    ["limit:0 検出", summary.limitZeroDetected ? "はい" : "いいえ"],
    ["Export 完了", summary.exportCompleted ? "はい" : "いいえ"],
    ["Export モード", summary.exportMode ?? "—"],
    ["Export スキップ理由", summary.exportSkipReason ?? "—"],
    ["improved 採用数", summary.improvedAdoptedCount],
    ["公開推奨", summary.publishRecommendedCount],
    ["合格", summary.passCount],
    ["再改善候補", summary.needsReImprovementCount],
    ["改善失敗", summary.improvementFailedCount],
    ["経過時間 (ms)", summary.elapsedMs ?? "—"],
  ];

  const summaryTable = [
    "| 項目 | 値 |",
    "|------|-----|",
    ...summaryRows.map(([label, value]) => `| ${label} | ${value} |`),
  ].join("\n");

  const slideTable = [
    "| スライド | 改善前 | 改善後 | 差分 | rootCause | tool | pipeline | export | 推奨 |",
    "|----------|--------|--------|------|-----------|------|----------|--------|------|",
    ...items.map((item) => {
      const exportLabel = item.adoptedImproved
        ? "improved"
        : item.exportSource ?? "—";
      const pipelineLabel =
        item.textChainConnected && item.improvementStatus === "planned"
          ? "TEXT(planned)"
          : item.textChainConnected
            ? "TEXT"
            : item.improvementPipeline?.join("→") ?? "—";
      return `| ${item.slideId} | ${formatScore(item.beforeScore)} | ${formatScore(item.afterScore)} | ${formatDelta(item.deltaScore)} | ${item.rootCause ?? "—"} | ${item.improvementTool ?? "—"} | ${pipelineLabel} | ${exportLabel} | ${recommendationLabel(item.recommendation)} |`;
    }),
  ].join("\n");

  const smartAutoFixItems = items.filter((item) => item.textChainConnected);
  const smartAutoFixSection =
    smartAutoFixItems.length > 0
      ? `## Smart Auto Fix / TEXT チェーン\n\n| スライド | SAF | Regeneration | adapter | ReReview | before | after |\n|----------|-----|--------------|---------|----------|--------|-------|\n${smartAutoFixItems
          .map(
            (item) =>
              `| ${item.slideId} | ${item.smartAutoFixStatus ?? (item.improvementStatus === "planned" ? "planned" : "—")} | ${item.regenerationStatus ?? (item.improvementStatus === "planned" ? "planned" : "—")} | ${item.regenerationAdapter ?? "—"} | ${item.reviewStatus ?? "—"} | ${formatScore(item.beforeScore)} | ${formatScore(item.afterScore)} |`,
          )
          .join("\n")}\n`
      : "";

  const warnings = [];
  if (!summary.allSlidesPublishRecommended && !summary.dryRun) {
    warnings.push("- 全スライドが targetScore 未達です。");
  }
  if (summary.allowPartialExport && summary.exportCompleted && summary.exportMode === "partial") {
    warnings.push("- allowPartialExport により 90 点未達でも export されています。");
  }
  if (summary.improvementFailedCount > 0) {
    warnings.push(`- 改善失敗スライド: ${summary.improvementFailedCount} 件`);
  }
  if (summary.limitZeroDetected) {
    warnings.push("- API quota limit:0 が検出されました。");
  }

  const warningsSection =
    warnings.length > 0
      ? `## 警告\n\n${warnings.join("\n")}\n`
      : "## 警告\n\n- なし\n";

  const nextActions = summary.nextActions ?? [];
  const nextActionsSection =
    nextActions.length > 0
      ? `## Next Actions\n\n${nextActions.map((action) => `- ${action}`).join("\n")}\n`
      : "";

  const apiKeyHints = summary.apiKeyHints ?? [];
  const apiKeySection =
    apiKeyHints.length > 0
      ? `## API キー設定\n\n${apiKeyHints
          .map((hint) => {
            const reasonLabel = API_KEY_HINT_REASON_LABELS[hint.reason] ?? hint.reason;
            return `### ${hint.label}（${reasonLabel}）\n\n- 設定変数: ${hint.envVars.map((name) => `\`${name}\``).join(" / ")}\n- ${hint.setup}\n`;
          })
          .join("\n")}`
      : "";

  const workspaceLines = [];
  if (summary.cleanLatest) {
    workspaceLines.push("- `--clean-latest` により実行前に `latest` を削除しました");
  } else if (summary.workspaceAction === "archived" && summary.archivePath) {
    workspaceLines.push(
      `- 実行前に \`latest\` を退避しました: \`${summary.archivePath}\``,
    );
  }

  const outputArtifactSection = buildNonCommittableArtifactsMarkdown();
  const dryRunLatestSection = buildDryRunLatestArchiveMarkdown(summary);
  const applyDecisionSection = buildApplyDecisionMarkdown(summary);

  const operationalSection =
    workspaceLines.length > 0
      ? `## 運用メモ\n\n${workspaceLines.join("\n")}\n\n`
      : "";

  return `# Quality Pipeline レポート

生成日時: ${report.generatedAt}
tool: ${report.tool}
version: ${report.version}

## サマリー

${summaryTable}

${warningsSection}
${nextActionsSection}${apiKeySection ? `${apiKeySection}\n` : ""}${operationalSection}${smartAutoFixSection}${dryRunLatestSection}
${applyDecisionSection}
${outputArtifactSection}
## スライド別

${slideTable}

## 参照ファイル

- pipeline state: \`${report.pipelineStateFile}\`
- metrics: \`${report.metricsFile}\`
${report.exportManifestFile ? `- export manifest: \`${report.exportManifestFile}\`` : "- export manifest: （なし）"}
`;
}

/**
 * report.json を書き込む
 * @param {object} report
 * @param {string} [outputDir]
 * @returns {Promise<string>}
 */
export async function writePipelineReport(report, outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const relativePath = path.join(outputDir, REPORT_JSON_FILENAME);
  const absolutePath = path.join(PROJECT_ROOT, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  return relativePath;
}

/**
 * report.md を書き込む
 * @param {object} report
 * @param {string} [outputDir]
 * @returns {Promise<string>}
 */
export async function writePipelineMarkdownReport(
  report,
  outputDir = DEFAULT_PIPELINE_STATE_DIR,
) {
  const relativePath = path.join(outputDir, REPORT_MD_FILENAME);
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  const markdown = buildPipelineReportMarkdown(report);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, markdown, "utf-8");

  return relativePath;
}

/**
 * レポートを生成して書き込む
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function generatePipelineReport(context) {
  const outputDir = context.outputDir ?? DEFAULT_PIPELINE_STATE_DIR;
  const exportManifest = await readExportManifest(outputDir);
  const report = buildPipelineReport({
    state: context.state,
    metrics: context.metrics,
    exportManifest,
    config: context.config,
  });

  const jsonPath = await writePipelineReport(report, outputDir);
  const mdPath = await writePipelineMarkdownReport(report, outputDir);

  return {
    report,
    jsonPath,
    mdPath,
  };
}
