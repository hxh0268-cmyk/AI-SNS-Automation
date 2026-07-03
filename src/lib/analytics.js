import fs from "node:fs";
import path from "node:path";
import {
  PUBLISHING_JSON_FILENAME,
  PUBLISHING_OUTPUT_DIR,
  extractPublishingPublicContract,
} from "./publishing.js";

export const ANALYTICS_SCHEMA = "analytics/1.0";
export const ANALYTICS_OUTPUT_DIR = "output/analytics";
export const ANALYTICS_JSON_FILENAME = "analytics.json";
export const ANALYTICS_MD_FILENAME = "analytics.md";

export const ANALYTICS_SOURCE = "publishing-public-contract";
export const ANALYTICS_METRIC_TYPE = "pre-publish";
export const ANALYTICS_REPORT_STATUS = "draft-analysis";

export const ANALYTICS_RECOMMENDATION = {
  READY: "ready",
  REVIEW: "review",
  NEEDS_WORK: "needs-work",
};

/**
 * @param {string | null | undefined} publishingPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function loadPublishingPublicContract(publishingPath, rootDir = process.cwd()) {
  const relativePath =
    publishingPath ?? `${PUBLISHING_OUTPUT_DIR}/${PUBLISHING_JSON_FILENAME}`;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return extractPublishingPublicContract(null);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return extractPublishingPublicContract(raw);
}

/**
 * @param {unknown} rawArgs
 * @param {object | null | undefined} [publishingContract]
 * @returns {{ publishingContract: object }}
 */
export function parseAnalyticsArgs(rawArgs, publishingContract = null) {
  const parsed = rawArgs && typeof rawArgs === "object" ? rawArgs : {};

  const contract =
    publishingContract ??
    (parsed.publishingContract && typeof parsed.publishingContract === "object"
      ? extractPublishingPublicContract(parsed.publishingContract)
      : extractPublishingPublicContract(null));

  return {
    publishingContract: extractPublishingPublicContract(contract),
  };
}

/**
 * @param {object} pkg
 * @returns {number}
 */
export function computeReadinessScore(pkg) {
  let score = 0;

  if (typeof pkg.title === "string" && pkg.title.length > 0) {
    score += 0.25;
  }

  if (typeof pkg.caption === "string" && pkg.caption.length > 0) {
    score += 0.25;
  }

  if (pkg.platform === "instagram") {
    score += 0.25;
  }

  if (pkg.format === "feed" && pkg.status === "draft") {
    score += 0.25;
  }

  return Math.round(score * 1000) / 1000;
}

/**
 * @param {object} pkg
 * @returns {number}
 */
export function computeQualityScore(pkg) {
  let score = 0;
  const title = typeof pkg.title === "string" ? pkg.title : "";
  const caption = typeof pkg.caption === "string" ? pkg.caption : "";

  if (title.length >= 5) {
    score += 0.34;
  } else if (title.length > 0) {
    score += 0.17;
  }

  if (caption.length >= 20) {
    score += 0.33;
  } else if (caption.length > 0) {
    score += 0.17;
  }

  if (title.length > 0 && caption.length > 0) {
    score += 0.33;
  }

  return Math.min(1, Math.round(score * 1000) / 1000);
}

/**
 * @param {object} pkg
 * @returns {number}
 */
export function computeChecklistScore(pkg) {
  const checks = [
    pkg.id,
    pkg.sourceImagePromptId,
    pkg.title,
    pkg.caption,
    pkg.platform,
    pkg.format,
    pkg.status,
  ];
  const passed = checks.filter(
    (value) => typeof value === "string" && value.length > 0,
  ).length;

  return Math.round((passed / checks.length) * 1000) / 1000;
}

/**
 * @param {number} readinessScore
 * @param {number} qualityScore
 * @param {number} checklistScore
 * @returns {string}
 */
export function resolveRecommendation(
  readinessScore,
  qualityScore,
  checklistScore,
) {
  const average = (readinessScore + qualityScore + checklistScore) / 3;

  if (average >= 0.85 && readinessScore >= 0.75) {
    return ANALYTICS_RECOMMENDATION.READY;
  }

  if (average >= 0.6) {
    return ANALYTICS_RECOMMENDATION.REVIEW;
  }

  return ANALYTICS_RECOMMENDATION.NEEDS_WORK;
}

/**
 * @param {object} pkg
 * @returns {string[]}
 */
export function buildAnalyticsFlags(pkg) {
  /** @type {string[]} */
  const flags = [];

  if (!pkg.title) {
    flags.push("missing-title");
  }

  if (!pkg.caption) {
    flags.push("missing-caption");
  }

  if (pkg.platform !== "instagram") {
    flags.push("unexpected-platform");
  }

  if (pkg.format !== "feed") {
    flags.push("unexpected-format");
  }

  if (pkg.status !== "draft") {
    flags.push("unexpected-status");
  }

  return flags;
}

/**
 * @param {object} pkg
 * @param {number} index
 * @returns {object}
 */
export function buildAnalyticsReportFromPackage(pkg, index) {
  const readinessScore = computeReadinessScore(pkg);
  const qualityScore = computeQualityScore(pkg);
  const checklistScore = computeChecklistScore(pkg);

  return {
    id: `analytics-${String(index + 1).padStart(3, "0")}`,
    sourcePackageId: typeof pkg.id === "string" ? pkg.id : "",
    title: typeof pkg.title === "string" ? pkg.title : "",
    platform: typeof pkg.platform === "string" ? pkg.platform : "",
    format: typeof pkg.format === "string" ? pkg.format : "",
    status: ANALYTICS_REPORT_STATUS,
    rank: typeof pkg.rank === "number" ? pkg.rank : index + 1,
    readinessScore,
    qualityScore,
    checklistScore,
    recommendation: resolveRecommendation(
      readinessScore,
      qualityScore,
      checklistScore,
    ),
    flags: buildAnalyticsFlags(pkg),
  };
}

/**
 * @param {object} publishingContract
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildAnalytics(publishingContract, options = {}) {
  const contract = extractPublishingPublicContract(publishingContract);
  const packages = Array.isArray(contract.packages) ? contract.packages : [];

  const reports = packages
    .map((pkg, index) => buildAnalyticsReportFromPackage(pkg, index))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.id.localeCompare(right.id);
    });

  let readyCount = 0;
  let reviewCount = 0;
  let needsWorkCount = 0;
  let readinessTotal = 0;

  for (const report of reports) {
    readinessTotal += report.readinessScore;

    if (report.recommendation === ANALYTICS_RECOMMENDATION.READY) {
      readyCount += 1;
    } else if (report.recommendation === ANALYTICS_RECOMMENDATION.REVIEW) {
      reviewCount += 1;
    } else {
      needsWorkCount += 1;
    }
  }

  return {
    schema: ANALYTICS_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: ANALYTICS_SOURCE,
    metricType: ANALYTICS_METRIC_TYPE,
    reports,
    summary: {
      reportCount: reports.length,
      readyCount,
      reviewCount,
      needsWorkCount,
      averageReadinessScore:
        reports.length > 0
          ? Math.round((readinessTotal / reports.length) * 1000) / 1000
          : 0,
    },
  };
}

/**
 * @param {unknown} report
 * @param {number} index
 * @returns {object}
 */
export function normalizeAnalyticsReportItem(report, index = 0) {
  if (!report || typeof report !== "object") {
    return {
      id: `analytics-${String(index + 1).padStart(3, "0")}`,
      sourcePackageId: "",
      title: "",
      platform: "",
      format: "",
      status: ANALYTICS_REPORT_STATUS,
      rank: index + 1,
      readinessScore: 0,
      qualityScore: 0,
      checklistScore: 0,
      recommendation: ANALYTICS_RECOMMENDATION.NEEDS_WORK,
      flags: [],
    };
  }

  const readinessScore =
    typeof report.readinessScore === "number" ? report.readinessScore : 0;
  const qualityScore =
    typeof report.qualityScore === "number" ? report.qualityScore : 0;
  const checklistScore =
    typeof report.checklistScore === "number" ? report.checklistScore : 0;

  const recommendationValues = Object.values(ANALYTICS_RECOMMENDATION);
  const recommendation = recommendationValues.includes(report.recommendation)
    ? report.recommendation
    : resolveRecommendation(readinessScore, qualityScore, checklistScore);

  return {
    id:
      typeof report.id === "string" && report.id.length > 0
        ? report.id
        : `analytics-${String(index + 1).padStart(3, "0")}`,
    sourcePackageId:
      typeof report.sourcePackageId === "string" ? report.sourcePackageId : "",
    title: typeof report.title === "string" ? report.title : "",
    platform: typeof report.platform === "string" ? report.platform : "",
    format: typeof report.format === "string" ? report.format : "",
    status: ANALYTICS_REPORT_STATUS,
    rank: typeof report.rank === "number" ? report.rank : index + 1,
    readinessScore,
    qualityScore,
    checklistScore,
    recommendation,
    flags: Array.isArray(report.flags)
      ? report.flags.filter((flag) => typeof flag === "string")
      : [],
  };
}

/**
 * @param {object | null | undefined} analytics
 * @returns {object}
 */
export function normalizeAnalytics(analytics) {
  if (!analytics || typeof analytics !== "object") {
    return buildAnalytics(extractPublishingPublicContract(null));
  }

  const reports = Array.isArray(analytics.reports)
    ? analytics.reports
        .map((report, index) => normalizeAnalyticsReportItem(report, index))
        .sort((left, right) => {
          if (left.rank !== right.rank) {
            return left.rank - right.rank;
          }

          return left.id.localeCompare(right.id);
        })
    : [];

  let readyCount = 0;
  let reviewCount = 0;
  let needsWorkCount = 0;
  let readinessTotal = 0;

  for (const report of reports) {
    readinessTotal += report.readinessScore;

    if (report.recommendation === ANALYTICS_RECOMMENDATION.READY) {
      readyCount += 1;
    } else if (report.recommendation === ANALYTICS_RECOMMENDATION.REVIEW) {
      reviewCount += 1;
    } else {
      needsWorkCount += 1;
    }
  }

  return {
    schema: analytics.schema ?? ANALYTICS_SCHEMA,
    generatedAt: analytics.generatedAt ?? new Date().toISOString(),
    source: ANALYTICS_SOURCE,
    metricType: ANALYTICS_METRIC_TYPE,
    reports,
    summary: {
      reportCount: reports.length,
      readyCount,
      reviewCount,
      needsWorkCount,
      averageReadinessScore:
        reports.length > 0
          ? Math.round((readinessTotal / reports.length) * 1000) / 1000
          : 0,
    },
  };
}

/**
 * @param {object | null | undefined} analytics
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateAnalytics(analytics) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!analytics || typeof analytics !== "object") {
    return {
      valid: false,
      errors: ["analytics output must be an object"],
      warnings: [],
    };
  }

  if (analytics.schema !== ANALYTICS_SCHEMA) {
    warnings.push(
      `analytics schema ${analytics.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!analytics.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (analytics.source !== ANALYTICS_SOURCE) {
    errors.push("source must be publishing-public-contract");
  }

  if (analytics.metricType !== ANALYTICS_METRIC_TYPE) {
    errors.push("metricType must be pre-publish");
  }

  if (!analytics.summary || typeof analytics.summary !== "object") {
    errors.push("summary is required");
  }

  if (!Array.isArray(analytics.reports)) {
    errors.push("reports must be an array");
    return { valid: errors.length === 0, errors, warnings };
  }

  analytics.reports.forEach((report, index) => {
    if (!report || typeof report !== "object") {
      errors.push(`reports[${index}] must be an object`);
      return;
    }

    for (const field of [
      "id",
      "sourcePackageId",
      "title",
      "platform",
      "format",
      "status",
      "recommendation",
    ]) {
      if (typeof report[field] !== "string") {
        errors.push(`reports[${index}].${field} must be a string`);
      }
    }

    if (report.status !== ANALYTICS_REPORT_STATUS) {
      errors.push(`reports[${index}].status must be draft-analysis`);
    }

    for (const scoreField of [
      "readinessScore",
      "qualityScore",
      "checklistScore",
    ]) {
      if (typeof report[scoreField] !== "number") {
        errors.push(`reports[${index}].${scoreField} must be a number`);
      }
    }

    if (typeof report.rank !== "number") {
      errors.push(`reports[${index}].rank must be a number`);
    }

    if (!Array.isArray(report.flags)) {
      errors.push(`reports[${index}].flags must be an array`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object | null | undefined} analytics
 * @returns {object}
 */
export function extractAnalyticsPublicContract(analytics) {
  const normalized = normalizeAnalytics(analytics);

  return {
    metadata: {
      schema: normalized.schema,
      generatedAt: normalized.generatedAt,
    },
    summary: {
      reportCount: normalized.summary.reportCount,
      readyCount: normalized.summary.readyCount,
      reviewCount: normalized.summary.reviewCount,
      needsWorkCount: normalized.summary.needsWorkCount,
      averageReadinessScore: normalized.summary.averageReadinessScore,
    },
    reports: normalized.reports.map((report) => ({
      id: report.id,
      sourcePackageId: report.sourcePackageId,
      title: report.title,
      platform: report.platform,
      format: report.format,
      recommendation: report.recommendation,
      rank: report.rank,
    })),
  };
}

/**
 * @param {object} analytics
 * @returns {string}
 */
export function renderAnalyticsMarkdown(analytics) {
  const normalized = normalizeAnalytics(analytics);
  const contract = extractAnalyticsPublicContract(normalized);

  const lines = [
    "# Analytics Report",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Source | ${normalized.source} |`,
    `| Metric Type | ${normalized.metricType} |`,
    `| Report Count | ${contract.summary.reportCount} |`,
    `| Ready | ${contract.summary.readyCount} |`,
    `| Review | ${contract.summary.reviewCount} |`,
    `| Needs Work | ${contract.summary.needsWorkCount} |`,
    `| Average Readiness Score | ${contract.summary.averageReadinessScore} |`,
    "",
    "## Reports",
    "",
  ];

  for (const report of normalized.reports) {
    lines.push(`### ${report.rank}. ${report.title || report.id}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| ID | ${report.id} |`);
    lines.push(`| Source Package ID | ${report.sourcePackageId} |`);
    lines.push(`| Platform | ${report.platform} |`);
    lines.push(`| Format | ${report.format} |`);
    lines.push(`| Status | ${report.status} |`);
    lines.push(`| Readiness Score | ${report.readinessScore} |`);
    lines.push(`| Quality Score | ${report.qualityScore} |`);
    lines.push(`| Checklist Score | ${report.checklistScore} |`);
    lines.push(`| Recommendation | ${report.recommendation} |`);
    lines.push(`| Rank | ${report.rank} |`);
    lines.push(
      `| Flags | ${report.flags.length > 0 ? report.flags.join(", ") : "none"} |`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {object} analytics
 * @returns {string}
 */
export function printAnalyticsSummary(analytics) {
  const contract = extractAnalyticsPublicContract(analytics);

  return [
    "Analytics Summary",
    `Reports: ${contract.summary.reportCount}`,
    `Ready: ${contract.summary.readyCount}`,
    `Review: ${contract.summary.reviewCount}`,
    `Needs Work: ${contract.summary.needsWorkCount}`,
    `Average Readiness: ${contract.summary.averageReadinessScore}`,
  ].join("\n");
}

/**
 * @param {object} analytics
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeAnalyticsArtifacts(analytics, rootDir = process.cwd()) {
  const normalized = normalizeAnalytics(analytics);
  const validation = validateAnalytics(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, ANALYTICS_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, ANALYTICS_JSON_FILENAME);
  const markdownPath = path.join(outputDir, ANALYTICS_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    source: normalized.source,
    metricType: normalized.metricType,
    reports: normalized.reports,
    summary: normalized.summary,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${renderAnalyticsMarkdown(normalized)}\n`);

  return {
    json: `${ANALYTICS_OUTPUT_DIR}/${ANALYTICS_JSON_FILENAME}`,
    markdown: `${ANALYTICS_OUTPUT_DIR}/${ANALYTICS_MD_FILENAME}`,
  };
}

/**
 * @param {object | null} [rawArgs]
 * @param {object} [options]
 * @param {string | null} [options.publishingPath]
 * @param {string} [options.generatedAt]
 * @param {string} [options.rootDir]
 * @returns {{ analytics: object, paths: { json: string, markdown: string } }}
 */
export function buildAnalyticsPipeline(rawArgs = null, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const publishingContract = loadPublishingPublicContract(
    options.publishingPath,
    rootDir,
  );
  const args = parseAnalyticsArgs(rawArgs, publishingContract);
  const analytics = normalizeAnalytics(
    buildAnalytics(args.publishingContract, {
      generatedAt: options.generatedAt,
    }),
  );
  const validation = validateAnalytics(analytics);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const paths = writeAnalyticsArtifacts(analytics, rootDir);

  return { analytics, paths };
}
