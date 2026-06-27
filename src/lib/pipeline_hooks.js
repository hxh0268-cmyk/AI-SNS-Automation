/** @typedef {object} PipelineHookContext
 * @property {object} [config]
 * @property {object} [state]
 * @property {object} [metrics]
 * @property {string} [phase]
 * @property {number} [round]
 * @property {object} [result]
 * @property {number} [exitCode]
 * @property {unknown} [error]
 * @property {string} [exportPath]
 * @property {object} [scoreSummary]
 */

/** @typedef {object} PipelineHooks
 * @property {(ctx: PipelineHookContext) => Promise<void>} beforePipeline
 * @property {(ctx: PipelineHookContext) => Promise<void>} afterPipeline
 * @property {(ctx: PipelineHookContext) => Promise<void>} beforePhase
 * @property {(ctx: PipelineHookContext) => Promise<void>} afterPhase
 * @property {(ctx: PipelineHookContext) => Promise<void>} beforeRound
 * @property {(ctx: PipelineHookContext) => Promise<void>} afterRound
 * @property {(ctx: PipelineHookContext) => Promise<void>} onSuccess
 * @property {(ctx: PipelineHookContext) => Promise<void>} onFailure
 */

/** v1.3 デフォルト no-op hooks */
export const NOOP_HOOKS = {
  /** @type {PipelineHooks["beforePipeline"]} */
  beforePipeline: async () => {},

  /** @type {PipelineHooks["afterPipeline"]} */
  afterPipeline: async () => {},

  /** @type {PipelineHooks["beforePhase"]} */
  beforePhase: async () => {},

  /** @type {PipelineHooks["afterPhase"]} */
  afterPhase: async () => {},

  /** @type {PipelineHooks["beforeRound"]} */
  beforeRound: async () => {},

  /** @type {PipelineHooks["afterRound"]} */
  afterRound: async () => {},

  /** @type {PipelineHooks["onSuccess"]} */
  onSuccess: async () => {},

  /** @type {PipelineHooks["onFailure"]} */
  onFailure: async () => {},
};

/**
 * カスタム hooks を NOOP_HOOKS にマージする
 * @param {Partial<PipelineHooks>} [customHooks]
 * @returns {PipelineHooks}
 */
export function mergeHooks(customHooks = {}) {
  return {
    beforePipeline: customHooks.beforePipeline ?? NOOP_HOOKS.beforePipeline,
    afterPipeline: customHooks.afterPipeline ?? NOOP_HOOKS.afterPipeline,
    beforePhase: customHooks.beforePhase ?? NOOP_HOOKS.beforePhase,
    afterPhase: customHooks.afterPhase ?? NOOP_HOOKS.afterPhase,
    beforeRound: customHooks.beforeRound ?? NOOP_HOOKS.beforeRound,
    afterRound: customHooks.afterRound ?? NOOP_HOOKS.afterRound,
    onSuccess: customHooks.onSuccess ?? NOOP_HOOKS.onSuccess,
    onFailure: customHooks.onFailure ?? NOOP_HOOKS.onFailure,
  };
}
