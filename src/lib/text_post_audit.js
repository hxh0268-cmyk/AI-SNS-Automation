/** 11 audit event types for the Stage A text post lifecycle. */
export const AUDIT_EVENT_TYPE = {
  DRAFT_CREATED: "draft_created",
  VALIDATION_PASSED: "validation_passed",
  VALIDATION_FAILED: "validation_failed",
  APPROVAL_RECORDED: "approval_recorded",
  APPROVAL_REJECTED: "approval_rejected",
  PUBLISH_REQUESTED: "publish_requested",
  KILL_SWITCH_REJECTED: "kill_switch_rejected",
  DUPLICATE_REJECTED: "duplicate_rejected",
  FAKE_PROVIDER_INVOKED: "fake_provider_invoked",
  DRY_RUN_SUCCEEDED: "dry_run_succeeded",
  PROVIDER_FAILED: "provider_failed",
};

// Field names that must never appear in audit events
const FORBIDDEN_AUDIT_FIELDS = new Set([
  "accessToken",
  "accesstoken",
  "refreshToken",
  "refreshtoken",
  "clientSecret",
  "clientsecret",
  "credential",
  "password",
  "apiKey",
  "apikey",
  "oauth",
  "token",
  "secret",
]);

/**
 * @param {{
 *   now?: () => string,
 *   nextEventId?: () => string,
 * }} [opts]
 * @returns {{ record: (event: object) => void, getEvents: () => object[], size: () => number }}
 */
function createIdFactory(opts = {}) {
  let counter = 0;
  const nextEventId =
    opts.nextEventId ??
    (() => {
      counter += 1;
      return `evt-${String(counter).padStart(8, "0")}`;
    });
  const now = opts.now ?? (() => new Date().toISOString());
  return { nextEventId, now };
}

function hasForbiddenField(obj) {
  if (!obj || typeof obj !== "object") return false;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_AUDIT_FIELDS.has(key.toLowerCase())) return true;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      if (hasForbiddenField(obj[key])) return true;
    }
  }
  return false;
}

/**
 * In-memory audit sink for Stage A. Not persistent.
 * @param {{ now?: () => string, nextEventId?: () => string }} [opts]
 * @returns {{ record: (event: object) => void, getEvents: () => object[], size: () => number }}
 */
export function createInMemoryAuditSink(opts = {}) {
  const events = [];
  const { nextEventId, now } = createIdFactory(opts);

  return {
    /**
     * Record an audit event. Throws if any forbidden sensitive field is detected.
     * @param {object} event
     */
    record(event) {
      if (hasForbiddenField(event)) {
        throw new Error(
          "audit event rejected: contains forbidden sensitive field",
        );
      }
      events.push({
        event_id: nextEventId(),
        timestamp: event.timestamp ?? now(),
        event_type: event.event_type,
        correlation_id: event.correlation_id ?? null,
        idempotency_key: event.idempotency_key ?? null,
        actor_id: event.actor_id ?? null,
        content_digest: event.content_digest ?? null,
        lifecycle_state: event.lifecycle_state ?? null,
        error_category: event.error_category ?? null,
        dry_run: event.dry_run ?? false,
        metadata: event.metadata ?? null,
      });
    },

    /** @returns {object[]} */
    getEvents() {
      return [...events];
    },

    size() {
      return events.length;
    },
  };
}
