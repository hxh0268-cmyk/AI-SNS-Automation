import { InputConfigurationError } from "./exit_codes.js";
import { PIPELINE_PHASES, resolveFromPhase } from "./phases.js";

/** @typedef {object} PipelineConfig
 * @property {number} targetScore
 * @property {number} passingScore
 * @property {number} maxRounds
 * @property {number | null} maxApiCalls
 * @property {boolean} dryRunDefault
 * @property {boolean} dryRun
 * @property {boolean} allowPartialExport
 * @property {boolean} skipContent
 * @property {boolean} skipExport
 * @property {boolean} cleanLatest
 * @property {string} fromPhase
 */

/** 品質パイプラインのデフォルト設定 */
export const DEFAULT_PIPELINE_CONFIG = {
  targetScore: 90,
  passingScore: 80,
  maxRounds: 3,
  maxApiCalls: null,
  dryRunDefault: true,
  allowPartialExport: false,
  skipContent: false,
  skipExport: false,
  cleanLatest: false,
  fromPhase: PIPELINE_PHASES.INIT,
};

/**
 * CLI 引数を解析する（生のオプション）
 * @param {string[]} argv
 * @returns {{ apply: boolean, dryRunExplicit: boolean, help: boolean, targetScore: number | null, passingScore: number | null, maxRounds: number | null, maxApiCalls: number | null, allowPartialExport: boolean, skipContent: boolean, skipExport: boolean, cleanLatest: boolean, fromPhase: string | null }}
 */
export function parsePipelineArgs(argv) {
  const options = {
    apply: false,
    dryRunExplicit: false,
    help: false,
    targetScore: null,
    passingScore: null,
    maxRounds: null,
    maxApiCalls: null,
    allowPartialExport: false,
    skipContent: false,
    skipExport: false,
    cleanLatest: false,
    fromPhase: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRunExplicit = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--allow-partial-export") {
      options.allowPartialExport = true;
      continue;
    }

    if (arg === "--skip-content") {
      options.skipContent = true;
      continue;
    }

    if (arg === "--skip-export") {
      options.skipExport = true;
      continue;
    }

    if (arg === "--clean-latest") {
      options.cleanLatest = true;
      continue;
    }

    if (arg === "--target-score") {
      options.targetScore = parseNumberArg(argv, ++index, "--target-score");
      continue;
    }

    if (arg === "--passing-score") {
      options.passingScore = parseNumberArg(argv, ++index, "--passing-score");
      continue;
    }

    if (arg === "--max-rounds") {
      options.maxRounds = parseNumberArg(argv, ++index, "--max-rounds");
      continue;
    }

    if (arg === "--max-api-calls") {
      options.maxApiCalls = parseNumberArg(argv, ++index, "--max-api-calls");
      continue;
    }

    if (arg === "--from-phase") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new InputConfigurationError(
          "--from-phase には Phase 名を指定してください。",
        );
      }
      options.fromPhase = value;
      index += 1;
      continue;
    }

    throw new InputConfigurationError(`不明な引数: ${arg}`);
  }

  return options;
}

/**
 * 数値 CLI 引数を解析する
 * @param {string[]} argv
 * @param {number} index
 * @param {string} label
 * @returns {number}
 */
function parseNumberArg(argv, index, label) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new InputConfigurationError(`${label} には数値を指定してください。`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new InputConfigurationError(`${label} には数値を指定してください。`);
  }

  return parsed;
}

/**
 * CLI 引数から PipelineConfig を生成する
 * @param {string[]} argv
 * @returns {PipelineConfig}
 */
export function createPipelineConfig(argv) {
  const args = parsePipelineArgs(argv);

  /** @type {PipelineConfig} */
  const config = {
    ...DEFAULT_PIPELINE_CONFIG,
    dryRun: DEFAULT_PIPELINE_CONFIG.dryRunDefault,
    allowPartialExport: args.allowPartialExport,
    skipContent: args.skipContent,
    skipExport: args.skipExport,
    cleanLatest: args.cleanLatest,
  };

  if (args.targetScore !== null) {
    config.targetScore = args.targetScore;
  }

  if (args.passingScore !== null) {
    config.passingScore = args.passingScore;
  }

  if (args.maxRounds !== null) {
    config.maxRounds = Math.floor(args.maxRounds);
  }

  if (args.maxApiCalls !== null) {
    config.maxApiCalls = Math.floor(args.maxApiCalls);
  }

  if (args.fromPhase !== null) {
    config.fromPhase = resolveFromPhase(args.fromPhase);
  }

  if (args.apply) {
    config.dryRun = false;
  }

  if (args.dryRunExplicit) {
    config.dryRun = true;
  }

  validatePipelineConfig(config);
  return config;
}

/**
 * PipelineConfig を検証する
 * @param {PipelineConfig} config
 */
export function validatePipelineConfig(config) {
  if (!Number.isFinite(config.targetScore)) {
    throw new InputConfigurationError("targetScore が不正です。");
  }

  if (!Number.isFinite(config.passingScore)) {
    throw new InputConfigurationError("passingScore が不正です。");
  }

  if (config.targetScore < config.passingScore) {
    throw new InputConfigurationError(
      "targetScore は passingScore 以上である必要があります。",
    );
  }

  if (!Number.isInteger(config.maxRounds) || config.maxRounds < 1) {
    throw new InputConfigurationError("maxRounds は 1 以上の整数である必要があります。");
  }

  if (
    config.maxApiCalls !== null &&
    (!Number.isInteger(config.maxApiCalls) || config.maxApiCalls < 1)
  ) {
    throw new InputConfigurationError(
      "maxApiCalls は 1 以上の整数、または未指定（null）である必要があります。",
    );
  }

  resolveFromPhase(config.fromPhase);
}

/**
 * ヘルプテキストを返す
 * @returns {string}
 */
export function getPipelineHelpText() {
  return `Usage: node scripts/run_quality_pipeline.js [options]

完全自動品質パイプライン（v1.4）

Options:
  --apply                   本番実行（API 呼び出し・output 変更あり。先に dry-run で report 確認）
  --dry-run                 dry-run を明示（デフォルト。latest / report は更新される）
  --target-score <number>   公開推奨ライン（デフォルト: 90）
  --passing-score <number>  合格ライン（デフォルト: 80）
  --max-rounds <number>     改善ループ上限（デフォルト: 3）
  --max-api-calls <number>  API 呼び出し上限
  --allow-partial-export    90 点未達でも export を許可
  --skip-content            投稿・カルーセル生成をスキップ
  --skip-export             Instagram Package 出力をスキップ
  --clean-latest            実行前に reports/quality-pipeline/latest を削除（archive 退避なし）
  --from-phase <phase>      開始 Phase（例: INIT, image-review）
  --help, -h                このヘルプを表示

デフォルトは dry-run です。dry-run でも reports/quality-pipeline/latest/ は計画結果として更新されます。
--apply 指定時のみ dryRun: false になり、API 呼び出しと output/ 副産物が発生する可能性があります。
`;
}
