import fs from "node:fs";
import path from "node:path";
import {
  ANALYTICS_JSON_FILENAME,
  ANALYTICS_OUTPUT_DIR,
  extractAnalyticsPublicContract,
} from "./analytics.js";

export const CONTINUOUS_IMPROVEMENT_SCHEMA = "continuous-improvement/1.0";
export const CONTINUOUS_IMPROVEMENT_OUTPUT_DIR = "output/continuous-improvement";
export const CONTINUOUS_IMPROVEMENT_JSON_FILENAME = "improvement.json";
export const CONTINUOUS_IMPROVEMENT_MD_FILENAME = "improvement.md";

export const CONTINUOUS_IMPROVEMENT_SOURCE = "analytics-public-contract";
export const CONTINUOUS_IMPROVEMENT_TYPE = "pre-publish-improvement";
export const CONTINUOUS_IMPROVEMENT_STATUS = "draft-improvement";

export const CONTINUOUS_IMPROVEMENT_RECOMMENDATION = {
  READY: "ready",
  REVIEW: "review",
  NEEDS_WORK: "needs-work",
};

export const CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION = {
  PUBLISH_READY: "publish-ready",
  REVIEW_CONTENT: "review-content",
  REVISE_PACKAGE: "revise-package",
};

export const CONTINUOUS_IMPROVEMENT_PRIORITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

/**
 * @param {string | null | undefined} analyticsPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function loadAnalyticsPublicContract(analyticsPath, rootDir = process.cwd()) {
  const relativePath =
    analyticsPath ?? `${ANALYTICS_OUTPUT_DIR}/${ANALYTICS_JSON_FILENAME}`;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return extractAnalyticsPublicContract(null);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return extractAnalyticsPublicContract(raw);
}

/**
 * @param {unknown} rawArgs
 * @param {object | null | undefined} [analyticsContract]
 * @returns {{ analyticsContract: object }}
 */
export function parseContinuousImprovementArgs(rawArgs, analyticsContract = null) {
  const parsed = rawArgs && typeof rawArgs === "object" ? rawArgs : {};

  const contract =
    analyticsContract ??
    (parsed.analyticsContract && typeof parsed.analyticsContract === "object"
      ? extractAnalyticsPublicContract(parsed.analyticsContract)
      : extractAnalyticsPublicContract(null));

  return {
    analyticsContract: extractAnalyticsPublicContract(contract),
  };
}

/**
 * @param {string} recommendation
 * @returns {string}
 */
export function resolveSuggestedAction(recommendation) {
  if (recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.READY) {
    return CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.PUBLISH_READY;
  }

  if (recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.REVIEW) {
    return CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.REVIEW_CONTENT;
  }

  return CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.REVISE_PACKAGE;
}

/**
 * @param {string} recommendation
 * @param {number} rank
 * @returns {string}
 */
export function resolvePriority(recommendation, rank) {
  if (recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.NEEDS_WORK) {
    return CONTINUOUS_IMPROVEMENT_PRIORITY.HIGH;
  }

  if (recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.REVIEW) {
    return CONTINUOUS_IMPROVEMENT_PRIORITY.MEDIUM;
  }

  if (recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.READY) {
    return rank <= 2
      ? CONTINUOUS_IMPROVEMENT_PRIORITY.MEDIUM
      : CONTINUOUS_IMPROVEMENT_PRIORITY.LOW;
  }

  return CONTINUOUS_IMPROVEMENT_PRIORITY.HIGH;
}

/**
 * @param {string} recommendation
 * @param {number} rank
 * @returns {number}
 */
export function computePriorityScore(recommendation, rank) {
  const tierScore = {
    [CONTINUOUS_IMPROVEMENT_RECOMMENDATION.NEEDS_WORK]: 1,
    [CONTINUOUS_IMPROVEMENT_RECOMMENDATION.REVIEW]: 2,
    [CONTINUOUS_IMPROVEMENT_RECOMMENDATION.READY]: 3,
  }[recommendation] ?? 3;

  const normalizedRank = typeof rank === "number" ? rank : 99;
  return tierScore * 100 + normalizedRank;
}

/**
 * @param {object} report
 * @param {object} summary
 * @returns {string}
 */
export function buildImprovementReason(report, summary) {
  /** @type {string[]} */
  const parts = [`recommendation:${report.recommendation}`];

  if (
    summary &&
    typeof summary.averageReadinessScore === "number" &&
    summary.averageReadinessScore > 0
  ) {
    parts.push(`average-readiness:${summary.averageReadinessScore}`);
  }

  if (report.recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.READY) {
    parts.push("pre-publish-threshold-met");
  } else if (report.recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.REVIEW) {
    parts.push("manual-review-required");
  } else {
    parts.push("package-revision-required");
  }

  if (!report.title) {
    parts.push("flag:missing-title");
  }

  if (!report.sourcePackageId) {
    parts.push("flag:missing-source-package");
  }

  return parts.join("; ");
}

/**
 * @param {string} recommendation
 * @returns {string[]}
 */
export function buildNextCheck(recommendation) {
  if (recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.READY) {
    return ["confirm-publish-readiness", "verify-platform-format"];
  }

  if (recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.REVIEW) {
    return ["review-title", "review-caption", "validate-package-fields"];
  }

  return ["revise-title", "revise-caption", "complete-required-fields"];
}

/**
 * @param {object} report
 * @returns {string[]}
 */
export function buildImprovementFlags(report) {
  /** @type {string[]} */
  const flags = [];

  if (report.recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.READY) {
    flags.push("publish-ready");
  } else if (report.recommendation === CONTINUOUS_IMPROVEMENT_RECOMMENDATION.REVIEW) {
    flags.push("needs-review");
  } else {
    flags.push("needs-revision");
  }

  if (!report.title) {
    flags.push("missing-title");
  }

  if (!report.sourcePackageId) {
    flags.push("missing-source-package");
  }

  if (report.platform !== "instagram") {
    flags.push("unexpected-platform");
  }

  if (report.format !== "feed") {
    flags.push("unexpected-format");
  }

  return flags;
}

/**
 * @param {object} report
 * @param {object} summary
 * @param {number} index
 * @returns {object}
 */
export function buildImprovementFromReport(report, summary, index) {
  const rank = typeof report.rank === "number" ? report.rank : index + 1;
  const recommendation =
    typeof report.recommendation === "string"
      ? report.recommendation
      : CONTINUOUS_IMPROVEMENT_RECOMMENDATION.NEEDS_WORK;

  return {
    id: `improvement-${String(index + 1).padStart(3, "0")}`,
    sourceReportId: typeof report.id === "string" ? report.id : "",
    sourcePackageId:
      typeof report.sourcePackageId === "string" ? report.sourcePackageId : "",
    title: typeof report.title === "string" ? report.title : "",
    platform: typeof report.platform === "string" ? report.platform : "",
    format: typeof report.format === "string" ? report.format : "",
    recommendation,
    priority: resolvePriority(recommendation, rank),
    priorityScore: computePriorityScore(recommendation, rank),
    improvementType: CONTINUOUS_IMPROVEMENT_TYPE,
    status: CONTINUOUS_IMPROVEMENT_STATUS,
    suggestedAction: resolveSuggestedAction(recommendation),
    reason: buildImprovementReason(report, summary),
    nextCheck: buildNextCheck(recommendation),
    rank,
    flags: buildImprovementFlags(report),
  };
}

/**
 * @param {object} analyticsContract
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildContinuousImprovement(analyticsContract, options = {}) {
  const contract = extractAnalyticsPublicContract(analyticsContract);
  const reports = Array.isArray(contract.reports) ? contract.reports : [];
  const summary = contract.summary ?? {};

  const improvements = reports
    .map((report, index) => buildImprovementFromReport(report, summary, index))
    .sort((left, right) => {
      if (left.priorityScore !== right.priorityScore) {
        return left.priorityScore - right.priorityScore;
      }

      return left.id.localeCompare(right.id);
    });

  let publishReadyCount = 0;
  let reviewContentCount = 0;
  let revisePackageCount = 0;
  let highPriorityCount = 0;
  let mediumPriorityCount = 0;
  let lowPriorityCount = 0;

  for (const item of improvements) {
    if (item.suggestedAction === CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.PUBLISH_READY) {
      publishReadyCount += 1;
    } else if (
      item.suggestedAction === CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.REVIEW_CONTENT
    ) {
      reviewContentCount += 1;
    } else {
      revisePackageCount += 1;
    }

    if (item.priority === CONTINUOUS_IMPROVEMENT_PRIORITY.HIGH) {
      highPriorityCount += 1;
    } else if (item.priority === CONTINUOUS_IMPROVEMENT_PRIORITY.MEDIUM) {
      mediumPriorityCount += 1;
    } else {
      lowPriorityCount += 1;
    }
  }

  return {
    schema: CONTINUOUS_IMPROVEMENT_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: CONTINUOUS_IMPROVEMENT_SOURCE,
    improvementType: CONTINUOUS_IMPROVEMENT_TYPE,
    status: CONTINUOUS_IMPROVEMENT_STATUS,
    improvements,
    summary: {
      improvementCount: improvements.length,
      publishReadyCount,
      reviewContentCount,
      revisePackageCount,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
    },
  };
}

/**
 * @param {unknown} item
 * @param {number} index
 * @returns {object}
 */
export function normalizeContinuousImprovementItem(item, index = 0) {
  if (!item || typeof item !== "object") {
    return {
      id: `improvement-${String(index + 1).padStart(3, "0")}`,
      sourceReportId: "",
      sourcePackageId: "",
      title: "",
      platform: "",
      format: "",
      recommendation: CONTINUOUS_IMPROVEMENT_RECOMMENDATION.NEEDS_WORK,
      priority: CONTINUOUS_IMPROVEMENT_PRIORITY.HIGH,
      priorityScore: computePriorityScore(
        CONTINUOUS_IMPROVEMENT_RECOMMENDATION.NEEDS_WORK,
        index + 1,
      ),
      improvementType: CONTINUOUS_IMPROVEMENT_TYPE,
      status: CONTINUOUS_IMPROVEMENT_STATUS,
      suggestedAction: CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.REVISE_PACKAGE,
      reason: "recommendation:needs-work; package-revision-required",
      nextCheck: buildNextCheck(CONTINUOUS_IMPROVEMENT_RECOMMENDATION.NEEDS_WORK),
      rank: index + 1,
      flags: ["needs-revision"],
    };
  }

  const recommendationValues = Object.values(CONTINUOUS_IMPROVEMENT_RECOMMENDATION);
  const recommendation = recommendationValues.includes(item.recommendation)
    ? item.recommendation
    : CONTINUOUS_IMPROVEMENT_RECOMMENDATION.NEEDS_WORK;
  const rank = typeof item.rank === "number" ? item.rank : index + 1;
  const priorityValues = Object.values(CONTINUOUS_IMPROVEMENT_PRIORITY);
  const priority = priorityValues.includes(item.priority)
    ? item.priority
    : resolvePriority(recommendation, rank);
  const suggestedActionValues = Object.values(CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION);
  const suggestedAction = suggestedActionValues.includes(item.suggestedAction)
    ? item.suggestedAction
    : resolveSuggestedAction(recommendation);

  return {
    id:
      typeof item.id === "string" && item.id.length > 0
        ? item.id
        : `improvement-${String(index + 1).padStart(3, "0")}`,
    sourceReportId:
      typeof item.sourceReportId === "string" ? item.sourceReportId : "",
    sourcePackageId:
      typeof item.sourcePackageId === "string" ? item.sourcePackageId : "",
    title: typeof item.title === "string" ? item.title : "",
    platform: typeof item.platform === "string" ? item.platform : "",
    format: typeof item.format === "string" ? item.format : "",
    recommendation,
    priority,
    priorityScore:
      typeof item.priorityScore === "number"
        ? item.priorityScore
        : computePriorityScore(recommendation, rank),
    improvementType: CONTINUOUS_IMPROVEMENT_TYPE,
    status: CONTINUOUS_IMPROVEMENT_STATUS,
    suggestedAction,
    reason: typeof item.reason === "string" ? item.reason : "",
    nextCheck: Array.isArray(item.nextCheck)
      ? item.nextCheck.filter((entry) => typeof entry === "string")
      : buildNextCheck(recommendation),
    rank,
    flags: Array.isArray(item.flags)
      ? item.flags.filter((flag) => typeof flag === "string")
      : [],
  };
}

/**
 * @param {object | null | undefined} improvement
 * @returns {object}
 */
export function normalizeContinuousImprovement(improvement) {
  if (!improvement || typeof improvement !== "object") {
    return buildContinuousImprovement(extractAnalyticsPublicContract(null));
  }

  const improvements = Array.isArray(improvement.improvements)
    ? improvement.improvements
        .map((item, index) => normalizeContinuousImprovementItem(item, index))
        .sort((left, right) => {
          if (left.priorityScore !== right.priorityScore) {
            return left.priorityScore - right.priorityScore;
          }

          return left.id.localeCompare(right.id);
        })
    : [];

  let publishReadyCount = 0;
  let reviewContentCount = 0;
  let revisePackageCount = 0;
  let highPriorityCount = 0;
  let mediumPriorityCount = 0;
  let lowPriorityCount = 0;

  for (const item of improvements) {
    if (item.suggestedAction === CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.PUBLISH_READY) {
      publishReadyCount += 1;
    } else if (
      item.suggestedAction === CONTINUOUS_IMPROVEMENT_SUGGESTED_ACTION.REVIEW_CONTENT
    ) {
      reviewContentCount += 1;
    } else {
      revisePackageCount += 1;
    }

    if (item.priority === CONTINUOUS_IMPROVEMENT_PRIORITY.HIGH) {
      highPriorityCount += 1;
    } else if (item.priority === CONTINUOUS_IMPROVEMENT_PRIORITY.MEDIUM) {
      mediumPriorityCount += 1;
    } else {
      lowPriorityCount += 1;
    }
  }

  return {
    schema: improvement.schema ?? CONTINUOUS_IMPROVEMENT_SCHEMA,
    generatedAt: improvement.generatedAt ?? new Date().toISOString(),
    source: CONTINUOUS_IMPROVEMENT_SOURCE,
    improvementType: CONTINUOUS_IMPROVEMENT_TYPE,
    status: CONTINUOUS_IMPROVEMENT_STATUS,
    improvements,
    summary: {
      improvementCount: improvements.length,
      publishReadyCount,
      reviewContentCount,
      revisePackageCount,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
    },
  };
}

/**
 * @param {object | null | undefined} improvement
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateContinuousImprovement(improvement) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!improvement || typeof improvement !== "object") {
    return {
      valid: false,
      errors: ["continuous improvement output must be an object"],
      warnings: [],
    };
  }

  if (improvement.schema !== CONTINUOUS_IMPROVEMENT_SCHEMA) {
    warnings.push(
      `continuous improvement schema ${improvement.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!improvement.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (improvement.source !== CONTINUOUS_IMPROVEMENT_SOURCE) {
    errors.push("source must be analytics-public-contract");
  }

  if (improvement.improvementType !== CONTINUOUS_IMPROVEMENT_TYPE) {
    errors.push("improvementType must be pre-publish-improvement");
  }

  if (improvement.status !== CONTINUOUS_IMPROVEMENT_STATUS) {
    errors.push("status must be draft-improvement");
  }

  if (!improvement.summary || typeof improvement.summary !== "object") {
    errors.push("summary is required");
  }

  if (!Array.isArray(improvement.improvements)) {
    errors.push("improvements must be an array");
    return { valid: errors.length === 0, errors, warnings };
  }

  improvement.improvements.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      errors.push(`improvements[${index}] must be an object`);
      return;
    }

    for (const field of [
      "id",
      "sourceReportId",
      "sourcePackageId",
      "title",
      "platform",
      "format",
      "recommendation",
      "priority",
      "improvementType",
      "status",
      "suggestedAction",
      "reason",
    ]) {
      if (typeof item[field] !== "string") {
        errors.push(`improvements[${index}].${field} must be a string`);
      }
    }

    if (item.status !== CONTINUOUS_IMPROVEMENT_STATUS) {
      errors.push(`improvements[${index}].status must be draft-improvement`);
    }

    if (item.improvementType !== CONTINUOUS_IMPROVEMENT_TYPE) {
      errors.push(
        `improvements[${index}].improvementType must be pre-publish-improvement`,
      );
    }

    if (typeof item.priorityScore !== "number") {
      errors.push(`improvements[${index}].priorityScore must be a number`);
    }

    if (typeof item.rank !== "number") {
      errors.push(`improvements[${index}].rank must be a number`);
    }

    if (!Array.isArray(item.nextCheck)) {
      errors.push(`improvements[${index}].nextCheck must be an array`);
    }

    if (!Array.isArray(item.flags)) {
      errors.push(`improvements[${index}].flags must be an array`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object | null | undefined} improvement
 * @returns {object}
 */
export function extractContinuousImprovementPublicContract(improvement) {
  const normalized = normalizeContinuousImprovement(improvement);

  return {
    metadata: {
      schema: normalized.schema,
      generatedAt: normalized.generatedAt,
    },
    summary: {
      improvementCount: normalized.summary.improvementCount,
      publishReadyCount: normalized.summary.publishReadyCount,
      reviewContentCount: normalized.summary.reviewContentCount,
      revisePackageCount: normalized.summary.revisePackageCount,
      highPriorityCount: normalized.summary.highPriorityCount,
      mediumPriorityCount: normalized.summary.mediumPriorityCount,
      lowPriorityCount: normalized.summary.lowPriorityCount,
    },
    improvements: normalized.improvements.map((item) => ({
      id: item.id,
      sourceReportId: item.sourceReportId,
      sourcePackageId: item.sourcePackageId,
      title: item.title,
      platform: item.platform,
      format: item.format,
      recommendation: item.recommendation,
      priority: item.priority,
      suggestedAction: item.suggestedAction,
      rank: item.rank,
    })),
  };
}

/**
 * @param {object} improvement
 * @returns {string}
 */
export function renderContinuousImprovementMarkdown(improvement) {
  const normalized = normalizeContinuousImprovement(improvement);
  const contract = extractContinuousImprovementPublicContract(normalized);

  const lines = [
    "# Continuous Improvement Report",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Source | ${normalized.source} |`,
    `| Improvement Type | ${normalized.improvementType} |`,
    `| Status | ${normalized.status} |`,
    `| Improvement Count | ${contract.summary.improvementCount} |`,
    `| Publish Ready | ${contract.summary.publishReadyCount} |`,
    `| Review Content | ${contract.summary.reviewContentCount} |`,
    `| Revise Package | ${contract.summary.revisePackageCount} |`,
    `| High Priority | ${contract.summary.highPriorityCount} |`,
    `| Medium Priority | ${contract.summary.mediumPriorityCount} |`,
    `| Low Priority | ${contract.summary.lowPriorityCount} |`,
    "",
    "## Improvements",
    "",
  ];

  for (const item of normalized.improvements) {
    lines.push(`### ${item.rank}. ${item.title || item.id}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| ID | ${item.id} |`);
    lines.push(`| Source Report ID | ${item.sourceReportId} |`);
    lines.push(`| Source Package ID | ${item.sourcePackageId} |`);
    lines.push(`| Platform | ${item.platform} |`);
    lines.push(`| Format | ${item.format} |`);
    lines.push(`| Recommendation | ${item.recommendation} |`);
    lines.push(`| Priority | ${item.priority} |`);
    lines.push(`| Priority Score | ${item.priorityScore} |`);
    lines.push(`| Suggested Action | ${item.suggestedAction} |`);
    lines.push(`| Reason | ${item.reason} |`);
    lines.push(
      `| Next Check | ${item.nextCheck.length > 0 ? item.nextCheck.join(", ") : "none"} |`,
    );
    lines.push(
      `| Flags | ${item.flags.length > 0 ? item.flags.join(", ") : "none"} |`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {object} improvement
 * @returns {string}
 */
export function printContinuousImprovementSummary(improvement) {
  const contract = extractContinuousImprovementPublicContract(improvement);

  return [
    "Continuous Improvement Summary",
    `Improvements: ${contract.summary.improvementCount}`,
    `Publish Ready: ${contract.summary.publishReadyCount}`,
    `Review Content: ${contract.summary.reviewContentCount}`,
    `Revise Package: ${contract.summary.revisePackageCount}`,
    `High Priority: ${contract.summary.highPriorityCount}`,
  ].join("\n");
}

/**
 * @param {object} improvement
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeContinuousImprovementArtifacts(
  improvement,
  rootDir = process.cwd(),
) {
  const normalized = normalizeContinuousImprovement(improvement);
  const validation = validateContinuousImprovement(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, CONTINUOUS_IMPROVEMENT_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, CONTINUOUS_IMPROVEMENT_JSON_FILENAME);
  const markdownPath = path.join(outputDir, CONTINUOUS_IMPROVEMENT_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    source: normalized.source,
    improvementType: normalized.improvementType,
    status: normalized.status,
    improvements: normalized.improvements,
    summary: normalized.summary,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${renderContinuousImprovementMarkdown(normalized)}\n`,
  );

  return {
    json: `${CONTINUOUS_IMPROVEMENT_OUTPUT_DIR}/${CONTINUOUS_IMPROVEMENT_JSON_FILENAME}`,
    markdown: `${CONTINUOUS_IMPROVEMENT_OUTPUT_DIR}/${CONTINUOUS_IMPROVEMENT_MD_FILENAME}`,
  };
}

/**
 * @param {object | null} [rawArgs]
 * @param {object} [options]
 * @param {string | null} [options.analyticsPath]
 * @param {string} [options.generatedAt]
 * @param {string} [options.rootDir]
 * @returns {{ improvement: object, paths: { json: string, markdown: string } }}
 */
export function buildContinuousImprovementPipeline(rawArgs = null, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const analyticsContract = loadAnalyticsPublicContract(
    options.analyticsPath,
    rootDir,
  );
  const args = parseContinuousImprovementArgs(rawArgs, analyticsContract);
  const improvement = normalizeContinuousImprovement(
    buildContinuousImprovement(args.analyticsContract, {
      generatedAt: options.generatedAt,
    }),
  );
  const validation = validateContinuousImprovement(improvement);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const paths = writeContinuousImprovementArtifacts(improvement, rootDir);

  return { improvement, paths };
}
