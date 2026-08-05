/**
 * Text Post Service — Stage A orchestrator.
 *
 * Flow: Draft → Validation → Manual Approval → Publish Request →
 *       Kill-switch → Idempotency → Fake X Text Provider → Dry-run → Audit
 *
 * No Real Provider. No External IO. No automatic publishing.
 * Success states are dry-run only (never "published").
 */

import {
  contentDigest,
  validateNoUnsupportedFeatures,
  validatePostContent,
} from "./text_post_content.js";
import {
  AUDIT_EVENT_TYPE,
  createInMemoryAuditSink,
} from "./text_post_audit.js";
import {
  checkIdempotency,
  createInMemoryIdempotencyStore,
} from "./text_post_idempotency.js";
import {
  createKillSwitch,
  createNoNetworkGuard,
} from "./text_post_kill_switch.js";
import {
  LIFECYCLE_STATE,
  TEXT_POST_ERROR_KIND,
  TextPostError,
} from "./text_post_lifecycle.js";
import {
  capability as MOCK_CAPABILITY,
  invokeMockTextPost,
} from "./x_text_post_mock_provider.js";

/** Provider-neutral boundary name (planning: FakeXTextPostProvider). */
export const FakeXTextPostProvider = {
  capability: MOCK_CAPABILITY,
  invoke: invokeMockTextPost,
};

const SAFE_PROVIDER_KIND = new Set([
  TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
  TEXT_POST_ERROR_KIND.PROVIDER_RATE_LIMITED,
  TEXT_POST_ERROR_KIND.PROVIDER_AUTHENTICATION_FAILED,
  TEXT_POST_ERROR_KIND.PROVIDER_AUTHORIZATION_FAILED,
  TEXT_POST_ERROR_KIND.PROVIDER_TRANSIENT_FAILURE,
  TEXT_POST_ERROR_KIND.PROVIDER_PERMANENT_FAILURE,
]);

/**
 * Map provider error envelope to typed TextPostError without leaking raw payloads.
 * @param {{ kind?: string, message?: string } | null | undefined} providerError
 * @returns {TextPostError}
 */
export function mapProviderError(providerError) {
  const rawKind =
    providerError && typeof providerError.kind === "string"
      ? providerError.kind
      : "";
  if (SAFE_PROVIDER_KIND.has(rawKind)) {
    return new TextPostError(rawKind, `provider failure: ${rawKind}`, {
      mapped: true,
    });
  }
  return new TextPostError(
    TEXT_POST_ERROR_KIND.PROVIDER_PERMANENT_FAILURE,
    "provider failure: unmapped error",
    { mapped: true, safe: true },
  );
}

/**
 * @param {{
 *   killSwitch?: ReturnType<typeof createKillSwitch>,
 *   auditSink?: ReturnType<typeof createInMemoryAuditSink>,
 *   idempotencyStore?: ReturnType<typeof createInMemoryIdempotencyStore>,
 *   noNetworkGuard?: ReturnType<typeof createNoNetworkGuard>,
 *   providerInvoke?: typeof invokeMockTextPost,
 *   now?: () => string,
 *   createCorrelationId?: () => string,
 *   maxLength?: number,
 *   networkEnabledByDefault?: boolean,
 * }} [deps]
 */
export function createTextPostService(deps = {}) {
  const killSwitch = deps.killSwitch ?? createKillSwitch({ enabled: false });
  const auditSink = deps.auditSink ?? createInMemoryAuditSink();
  const idempotencyStore =
    deps.idempotencyStore ?? createInMemoryIdempotencyStore();
  const noNetworkGuard = deps.noNetworkGuard ?? createNoNetworkGuard();
  const providerInvoke = deps.providerInvoke ?? invokeMockTextPost;
  const now = deps.now ?? (() => new Date().toISOString());
  let corrSeq = 0;
  const createCorrelationId =
    deps.createCorrelationId ??
    (() => {
      corrSeq += 1;
      return `corr-${String(corrSeq).padStart(8, "0")}`;
    });
  const maxLength = deps.maxLength ?? 280;
  // Stage A: network disabled by default (guard + no real client).
  const networkEnabledByDefault = deps.networkEnabledByDefault ?? false;

  let providerInvokeCount = 0;
  const inFlightKeys = new Set();

  function recordAudit(partial) {
    auditSink.record({
      timestamp: now(),
      ...partial,
    });
  }

  function fail(kind, message, details = null) {
    return {
      ok: false,
      error: new TextPostError(kind, message, details),
    };
  }

  /**
   * Create a draft (no provider).
   * @param {unknown} rawText
   * @param {Record<string, unknown>} [features]
   */
  function createDraft(rawText, features = {}) {
    const correlationId = createCorrelationId();
    try {
      recordAudit({
        event_type: AUDIT_EVENT_TYPE.DRAFT_CREATED,
        correlation_id: correlationId,
        lifecycle_state: LIFECYCLE_STATE.DRAFT,
        dry_run: true,
        metadata: { charHint: typeof rawText === "string" ? rawText.length : 0 },
      });
    } catch (err) {
      return fail(
        TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
        "audit sink failure on draft_created",
        { cause: err instanceof Error ? err.message : "unknown" },
      );
    }
    return {
      ok: true,
      draft: {
        correlationId,
        rawText,
        features,
        state: LIFECYCLE_STATE.DRAFT,
        createdAt: now(),
      },
    };
  }

  /**
   * Validate draft content + unsupported features.
   * @param {{ correlationId: string, rawText: unknown, features?: Record<string, unknown> }} draft
   */
  function validateDraft(draft) {
    const correlationId = draft?.correlationId ?? createCorrelationId();
    const featureCheck = validateNoUnsupportedFeatures(draft?.features ?? {});
    if (!featureCheck.ok) {
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.VALIDATION_FAILED,
          correlation_id: correlationId,
          lifecycle_state: LIFECYCLE_STATE.VALIDATION_FAILED,
          error_category: featureCheck.error.kind,
          dry_run: true,
        });
      } catch {
        /* audit failure secondary */
      }
      return { ok: false, error: featureCheck.error, state: LIFECYCLE_STATE.VALIDATION_FAILED };
    }

    const validated = validatePostContent(draft.rawText, { maxLength });
    if (!validated.ok) {
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.VALIDATION_FAILED,
          correlation_id: correlationId,
          lifecycle_state: LIFECYCLE_STATE.VALIDATION_FAILED,
          error_category: validated.error.kind,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return { ok: false, error: validated.error, state: LIFECYCLE_STATE.VALIDATION_FAILED };
    }

    try {
      recordAudit({
        event_type: AUDIT_EVENT_TYPE.VALIDATION_PASSED,
        correlation_id: correlationId,
        content_digest: validated.content.digest,
        lifecycle_state: LIFECYCLE_STATE.VALIDATED,
        dry_run: true,
      });
    } catch (err) {
      return fail(
        TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
        "audit sink failure on validation_passed",
        { cause: err instanceof Error ? err.message : "unknown" },
      );
    }

    return {
      ok: true,
      content: validated.content,
      correlationId,
      state: LIFECYCLE_STATE.VALIDATED,
    };
  }

  /**
   * Record manual approval bound to content digest.
   * @param {{
   *   correlationId: string,
   *   content: { normalizedText: string, digest: string, charCount: number },
   *   actorId: string,
   * }} args
   */
  function approve({ correlationId, content, actorId }) {
    if (!actorId || typeof actorId !== "string" || actorId.trim().length === 0) {
      const error = new TextPostError(
        TEXT_POST_ERROR_KIND.APPROVAL_REQUIRED,
        "approval actor is required",
      );
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.APPROVAL_REJECTED,
          correlation_id: correlationId,
          error_category: error.kind,
          lifecycle_state: LIFECYCLE_STATE.APPROVAL_INVALIDATED,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return { ok: false, error, state: LIFECYCLE_STATE.APPROVAL_INVALIDATED };
    }

    if (!content?.digest || !content?.normalizedText) {
      return fail(
        TEXT_POST_ERROR_KIND.APPROVAL_REQUIRED,
        "validated content is required for approval",
      );
    }

    const expected = contentDigest(content.normalizedText);
    if (expected !== content.digest) {
      const error = new TextPostError(
        TEXT_POST_ERROR_KIND.APPROVAL_CONTENT_MISMATCH,
        "content digest inconsistent with normalized text",
      );
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.APPROVAL_REJECTED,
          correlation_id: correlationId,
          content_digest: content.digest,
          error_category: error.kind,
          lifecycle_state: LIFECYCLE_STATE.APPROVAL_INVALIDATED,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return { ok: false, error, state: LIFECYCLE_STATE.APPROVAL_INVALIDATED };
    }

    const approval = {
      actorId: actorId.trim(),
      approvedAt: now(),
      contentDigest: content.digest,
      normalizedText: content.normalizedText,
    };

    try {
      recordAudit({
        event_type: AUDIT_EVENT_TYPE.APPROVAL_RECORDED,
        correlation_id: correlationId,
        actor_id: approval.actorId,
        content_digest: approval.contentDigest,
        lifecycle_state: LIFECYCLE_STATE.APPROVED,
        dry_run: true,
      });
    } catch (err) {
      return fail(
        TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
        "audit sink failure on approval_recorded",
        { cause: err instanceof Error ? err.message : "unknown" },
      );
    }

    return {
      ok: true,
      approval,
      state: LIFECYCLE_STATE.APPROVED,
    };
  }

  /**
   * Execute Stage A dry-run publish path (fake provider only).
   * @param {{
   *   correlationId: string,
   *   content: { normalizedText: string, digest: string, charCount: number },
   *   approval: { actorId: string, approvedAt: string, contentDigest: string, normalizedText: string } | null,
   *   idempotencyKey: string,
   *   features?: Record<string, unknown>,
   *   simulateError?: string,
   *   hostname?: string | null,
   *   mutatedNormalizedText?: string,
   * }} args
   */
  function requestDryRunPublish(args) {
    const correlationId = args.correlationId ?? createCorrelationId();
    const idempotencyKey = args.idempotencyKey;
    const content = args.content;

    try {
      noNetworkGuard.assertNoNetwork(args.hostname ?? null);
      if (networkEnabledByDefault) {
        return fail(
          TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
          "network must be disabled by default in Stage A",
        );
      }
    } catch (err) {
      if (err instanceof TextPostError) {
        return { ok: false, error: err };
      }
      return fail(TEXT_POST_ERROR_KIND.INTERNAL_ERROR, "no-network guard failure");
    }

    try {
      recordAudit({
        event_type: AUDIT_EVENT_TYPE.PUBLISH_REQUESTED,
        correlation_id: correlationId,
        idempotency_key: idempotencyKey,
        content_digest: content?.digest ?? null,
        actor_id: args.approval?.actorId ?? null,
        lifecycle_state: LIFECYCLE_STATE.PUBLISH_REQUESTED,
        dry_run: true,
      });
    } catch (err) {
      return fail(
        TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
        "audit sink failure on publish_requested",
        { cause: err instanceof Error ? err.message : "unknown" },
      );
    }

    if (!args.approval) {
      const error = new TextPostError(
        TEXT_POST_ERROR_KIND.APPROVAL_REQUIRED,
        "manual approval is required before dry-run publish",
      );
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.APPROVAL_REJECTED,
          correlation_id: correlationId,
          idempotency_key: idempotencyKey,
          error_category: error.kind,
          lifecycle_state: LIFECYCLE_STATE.APPROVAL_INVALIDATED,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return { ok: false, error, state: LIFECYCLE_STATE.APPROVAL_INVALIDATED, providerInvokeCount };
    }

    // Content mutation after approval: compare live text to approved digest.
    const liveText =
      typeof args.mutatedNormalizedText === "string"
        ? args.mutatedNormalizedText
        : content.normalizedText;
    const liveDigest = contentDigest(liveText);
    if (
      liveDigest !== args.approval.contentDigest ||
      liveDigest !== content.digest ||
      liveText !== args.approval.normalizedText
    ) {
      const error = new TextPostError(
        TEXT_POST_ERROR_KIND.APPROVAL_CONTENT_MISMATCH,
        "content changed after approval",
      );
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.APPROVAL_REJECTED,
          correlation_id: correlationId,
          idempotency_key: idempotencyKey,
          content_digest: liveDigest,
          error_category: error.kind,
          lifecycle_state: LIFECYCLE_STATE.APPROVAL_INVALIDATED,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return { ok: false, error, state: LIFECYCLE_STATE.APPROVAL_INVALIDATED, providerInvokeCount };
    }

    if (!killSwitch.isEnabled()) {
      const error = new TextPostError(
        TEXT_POST_ERROR_KIND.KILL_SWITCH_DISABLED,
        "kill switch is disabled; fake provider invocation blocked",
      );
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.KILL_SWITCH_REJECTED,
          correlation_id: correlationId,
          idempotency_key: idempotencyKey,
          content_digest: content.digest,
          error_category: error.kind,
          lifecycle_state: LIFECYCLE_STATE.REJECTED_BY_KILL_SWITCH,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return {
        ok: false,
        error,
        state: LIFECYCLE_STATE.REJECTED_BY_KILL_SWITCH,
        providerInvokeCount,
      };
    }

    const featureCheck = validateNoUnsupportedFeatures(args.features ?? {});
    if (!featureCheck.ok) {
      return { ok: false, error: featureCheck.error, providerInvokeCount };
    }

    const idem = checkIdempotency(idempotencyStore, idempotencyKey, content.digest);
    if (!idem.ok) {
      const state =
        idem.error.kind === TEXT_POST_ERROR_KIND.DUPLICATE_REQUEST
          ? LIFECYCLE_STATE.DUPLICATE_REJECTED
          : LIFECYCLE_STATE.PROVIDER_FAILED;
      try {
        recordAudit({
          event_type:
            idem.error.kind === TEXT_POST_ERROR_KIND.DUPLICATE_REQUEST
              ? AUDIT_EVENT_TYPE.DUPLICATE_REJECTED
              : AUDIT_EVENT_TYPE.PROVIDER_FAILED,
          correlation_id: correlationId,
          idempotency_key: idempotencyKey,
          content_digest: content.digest,
          error_category: idem.error.kind,
          lifecycle_state: state,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return { ok: false, error: idem.error, state, providerInvokeCount };
    }

    if (idem.cached) {
      // Terminal replay — do not invoke provider again.
      return {
        ok: true,
        replay: true,
        result: idem.cached,
        state: idem.cached.status,
        providerInvokeCount,
      };
    }

    if (inFlightKeys.has(idempotencyKey)) {
      return fail(
        TEXT_POST_ERROR_KIND.DUPLICATE_REQUEST,
        "same idempotency key is already in flight",
        { concurrency: true },
      );
    }

    inFlightKeys.add(idempotencyKey);
    let providerResult;
    try {
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.FAKE_PROVIDER_INVOKED,
          correlation_id: correlationId,
          idempotency_key: idempotencyKey,
          content_digest: content.digest,
          lifecycle_state: LIFECYCLE_STATE.PUBLISH_REQUESTED,
          dry_run: true,
        });
      } catch (err) {
        return fail(
          TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
          "audit sink failure on fake_provider_invoked",
          { cause: err instanceof Error ? err.message : "unknown" },
        );
      }

      providerInvokeCount += 1;
      const request = {
        capability: MOCK_CAPABILITY,
        applicationContract: {
          normalizedText: content.normalizedText,
          requestedAt: now(),
          ...(args.simulateError ? { simulateError: args.simulateError } : {}),
        },
      };
      providerResult = providerInvoke(request);
    } finally {
      inFlightKeys.delete(idempotencyKey);
    }

    if (!providerResult || providerResult.ok !== true) {
      const mapped = mapProviderError(providerResult?.error);
      try {
        recordAudit({
          event_type: AUDIT_EVENT_TYPE.PROVIDER_FAILED,
          correlation_id: correlationId,
          idempotency_key: idempotencyKey,
          content_digest: content.digest,
          error_category: mapped.kind,
          lifecycle_state: LIFECYCLE_STATE.PROVIDER_FAILED,
          dry_run: true,
        });
      } catch {
        /* secondary */
      }
      return {
        ok: false,
        error: mapped,
        state: LIFECYCLE_STATE.PROVIDER_FAILED,
        providerInvokeCount,
      };
    }

    const providerStatus = providerResult.result?.status;
    if (providerStatus === "published" || providerStatus === "live_published") {
      return fail(
        TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
        "Stage A must not produce real published status",
      );
    }

    const typedResult = {
      status: LIFECYCLE_STATE.DRY_RUN_SUCCEEDED,
      acceptance: "accepted_by_fake_provider",
      simulated: "simulated_success",
      dryRun: true,
      published: false,
      correlationId,
      idempotencyKey,
      contentDigest: content.digest,
      normalizedText: content.normalizedText,
      providerId: providerResult.providerId,
      providerVersion: providerResult.providerVersion,
      providerStatus: providerStatus ?? "dry_run_accepted",
      actorId: args.approval.actorId,
      completedAt: now(),
    };

    idempotencyStore.set(idempotencyKey, content.digest, typedResult);

    try {
      recordAudit({
        event_type: AUDIT_EVENT_TYPE.DRY_RUN_SUCCEEDED,
        correlation_id: correlationId,
        idempotency_key: idempotencyKey,
        actor_id: args.approval.actorId,
        content_digest: content.digest,
        lifecycle_state: LIFECYCLE_STATE.DRY_RUN_SUCCEEDED,
        dry_run: true,
        metadata: {
          acceptance: typedResult.acceptance,
          providerId: typedResult.providerId,
        },
      });
    } catch (err) {
      return fail(
        TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
        "audit sink failure on dry_run_succeeded",
        { cause: err instanceof Error ? err.message : "unknown" },
      );
    }

    return {
      ok: true,
      replay: false,
      result: typedResult,
      state: LIFECYCLE_STATE.DRY_RUN_SUCCEEDED,
      providerInvokeCount,
    };
  }

  /**
   * Convenience happy-path helper for tests.
   * @param {{
   *   rawText: string,
   *   actorId: string,
   *   idempotencyKey: string,
   *   features?: Record<string, unknown>,
   *   simulateError?: string,
   *   hostname?: string | null,
   *   enableKillSwitch?: boolean,
   * }} input
   */
  function runStageADryRun(input) {
    const draftRes = createDraft(input.rawText, input.features ?? {});
    if (!draftRes.ok) return draftRes;

    const valRes = validateDraft(draftRes.draft);
    if (!valRes.ok) return valRes;

    const apprRes = approve({
      correlationId: valRes.correlationId,
      content: valRes.content,
      actorId: input.actorId,
    });
    if (!apprRes.ok) return apprRes;

    if (input.enableKillSwitch !== false) {
      killSwitch.enable();
    }

    return requestDryRunPublish({
      correlationId: valRes.correlationId,
      content: valRes.content,
      approval: apprRes.approval,
      idempotencyKey: input.idempotencyKey,
      features: input.features,
      simulateError: input.simulateError,
      hostname: input.hostname,
    });
  }

  return {
    createDraft,
    validateDraft,
    approve,
    requestDryRunPublish,
    runStageADryRun,
    getProviderInvokeCount: () => providerInvokeCount,
    getAuditEvents: () => auditSink.getEvents(),
    getKillSwitch: () => killSwitch,
    getIdempotencyStore: () => idempotencyStore,
    getNoNetworkGuard: () => noNetworkGuard,
  };
}
