/** Lifecycle states for the text post publishing flow (Stage A: no real "published" state). */
export const LIFECYCLE_STATE = {
  DRAFT: "draft",
  VALIDATED: "validated",
  APPROVED: "approved",
  PUBLISH_REQUESTED: "publish_requested",
  DRY_RUN_SUCCEEDED: "dry_run_succeeded",
  VALIDATION_FAILED: "validation_failed",
  APPROVAL_INVALIDATED: "approval_invalidated",
  REJECTED_BY_KILL_SWITCH: "rejected_by_kill_switch",
  DUPLICATE_REJECTED: "duplicate_rejected",
  PROVIDER_FAILED: "provider_failed",
};

/** Typed error codes for the text post domain. Provider-neutral. */
export const TEXT_POST_ERROR_KIND = {
  INVALID_CONTENT: "INVALID_CONTENT",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  APPROVAL_CONTENT_MISMATCH: "APPROVAL_CONTENT_MISMATCH",
  KILL_SWITCH_DISABLED: "KILL_SWITCH_DISABLED",
  DUPLICATE_REQUEST: "DUPLICATE_REQUEST",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  UNSUPPORTED_FEATURE: "UNSUPPORTED_FEATURE",
  PROVIDER_REJECTED: "PROVIDER_REJECTED",
  PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  PROVIDER_AUTHENTICATION_FAILED: "PROVIDER_AUTHENTICATION_FAILED",
  PROVIDER_AUTHORIZATION_FAILED: "PROVIDER_AUTHORIZATION_FAILED",
  PROVIDER_TRANSIENT_FAILURE: "PROVIDER_TRANSIENT_FAILURE",
  PROVIDER_PERMANENT_FAILURE: "PROVIDER_PERMANENT_FAILURE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

export class TextPostError extends Error {
  /**
   * @param {string} kind  - One of TEXT_POST_ERROR_KIND values
   * @param {string} message
   * @param {object | null} [details]
   */
  constructor(kind, message, details = null) {
    super(message);
    this.name = "TextPostError";
    this.kind = kind;
    this.details = details;
  }
}
