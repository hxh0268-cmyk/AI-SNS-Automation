export const DEFAULT_WORKFLOW_OPTIONS = {
  dryRun: true,
  failFast: false,
  stopBeforeStep: null,
  skipSteps: [],
  guardHooks: [],
};

/**
 * @param {Partial<typeof DEFAULT_WORKFLOW_OPTIONS>} [options]
 * @returns {typeof DEFAULT_WORKFLOW_OPTIONS}
 */
export function normalizeWorkflowOptions(options = {}) {
  return {
    ...DEFAULT_WORKFLOW_OPTIONS,
    ...options,
    skipSteps: [...(options.skipSteps ?? DEFAULT_WORKFLOW_OPTIONS.skipSteps)],
    guardHooks: [...(options.guardHooks ?? DEFAULT_WORKFLOW_OPTIONS.guardHooks)],
  };
}
