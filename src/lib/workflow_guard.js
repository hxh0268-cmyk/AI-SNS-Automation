import { GUARD_REASON } from "./workflow_guard_reason.js";
import { STEP_STATUS } from "./workflow_step_status.js";

/**
 * @param {string[]} knownStepIds
 * @param {string | null | undefined} stopBeforeStep
 * @returns {boolean}
 */
export function isKnownStopBeforeStep(knownStepIds, stopBeforeStep) {
  return Boolean(stopBeforeStep && knownStepIds.includes(stopBeforeStep));
}

/**
 * @param {string[]} knownStepIds
 * @param {string[]} skipSteps
 * @returns {string[]}
 */
export function filterKnownSkipSteps(knownStepIds, skipSteps) {
  return skipSteps.filter((stepId) => knownStepIds.includes(stepId));
}

/**
 * @param {{ options: { stopBeforeStep: string | null } }} context
 * @param {{ id: string }} step
 * @param {string[]} [knownStepIds]
 * @returns {boolean}
 */
export function shouldStopBeforeStep(context, step, knownStepIds = []) {
  const { stopBeforeStep } = context.options;

  if (!isKnownStopBeforeStep(knownStepIds, stopBeforeStep)) {
    return false;
  }

  return stopBeforeStep === step.id;
}

/**
 * @param {{ options: { skipSteps: string[] } }} context
 * @param {{ id: string }} step
 * @param {string[]} [knownStepIds]
 * @returns {boolean}
 */
export function shouldSkipStep(context, step, knownStepIds = []) {
  const knownSkipSteps = filterKnownSkipSteps(knownStepIds, context.options.skipSteps);
  return knownSkipSteps.includes(step.id);
}

/**
 * @param {{ options: { stopBeforeStep: string | null, skipSteps: string[] } }} context
 * @param {{ id: string }} step
 * @param {string[]} [knownStepIds]
 * @returns {boolean}
 */
export function shouldExecuteStep(context, step, knownStepIds = []) {
  if (shouldStopBeforeStep(context, step, knownStepIds)) {
    return false;
  }

  if (shouldSkipStep(context, step, knownStepIds)) {
    return false;
  }

  return true;
}

/**
 * @param {{ options: { stopBeforeStep: string | null, skipSteps: string[] } }} context
 * @param {{ id: string }} step
 * @param {string[]} [knownStepIds]
 * @returns {{ shouldExecute: boolean, reason: string }}
 */
export function evaluateGuard(context, step, knownStepIds = []) {
  if (shouldStopBeforeStep(context, step, knownStepIds)) {
    return {
      shouldExecute: false,
      reason: GUARD_REASON.STOP_BEFORE_STEP,
    };
  }

  if (shouldSkipStep(context, step, knownStepIds)) {
    return {
      shouldExecute: false,
      reason: GUARD_REASON.SKIP_STEP,
    };
  }

  return {
    shouldExecute: true,
    reason: GUARD_REASON.NONE,
  };
}

/**
 * @param {{ shouldExecute: boolean, reason: string }} guard
 * @returns {string}
 */
export function guardDecisionToStepStatus(guard) {
  if (guard.reason === GUARD_REASON.STOP_BEFORE_STEP) {
    return STEP_STATUS.STOPPED;
  }

  if (guard.reason === GUARD_REASON.SKIP_STEP) {
    return STEP_STATUS.SKIPPED;
  }

  return STEP_STATUS.PASS;
}
