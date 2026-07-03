import fs from "node:fs";
import path from "node:path";

export const PUBLIC_CONTRACT_CATALOG_SCHEMA = "public-contract-catalog/1.0";
export const PUBLIC_CONTRACT_CATALOG_VERSION = "1.0";
export const PUBLIC_CONTRACT_CATALOG_OUTPUT_DIR =
  "reports/public-contract-catalog/latest";
export const PUBLIC_CONTRACT_CATALOG_JSON_FILENAME = "public-contract-catalog.json";
export const PUBLIC_CONTRACT_CATALOG_MD_FILENAME = "public-contract-catalog.md";

export const APPLICATION_LAYER_FOUNDATIONS = [
  {
    id: "idea-generation",
    name: "Idea Generation Foundation",
    version: "v1.41.0",
    layer: "application",
    schema: "content-ideas/1.0",
    module: "src/lib/content_idea.js",
    extractFunction: "extractContentIdeaPublicContract",
    npmScript: "content:ideas",
    outputJson: "output/content-ideas/content-ideas.json",
    status: "completed",
    upstreamFoundationId: null,
    upstreamPublicContract: null,
  },
  {
    id: "ai-idea-generation",
    name: "AI Idea Generation Foundation",
    version: "v1.42.0",
    layer: "application",
    schema: "content-ai-ideas/1.0",
    module: "src/lib/content_ai_idea.js",
    extractFunction: "extractAIIdeaPublicContract",
    npmScript: "content:ai-ideas",
    outputJson: "output/content-ideas/content-ai-ideas.json",
    status: "completed",
    upstreamFoundationId: null,
    upstreamPublicContract: null,
  },
  {
    id: "content-generation",
    name: "Content Generation Foundation",
    version: "v1.43.0",
    layer: "application",
    schema: "content-generation/2.0",
    module: "src/lib/content_generation.js",
    extractFunction: "extractContentGenerationPublicContract",
    npmScript: "content:generate",
    outputJson: "output/content-generation/content-generation.json",
    status: "completed",
    upstreamFoundationId: "ai-idea-generation",
    upstreamPublicContract: "extractAIIdeaPublicContract",
  },
  {
    id: "image-generation",
    name: "Image Generation Foundation",
    version: "v1.44.0",
    layer: "application",
    schema: "image-generation/1.0",
    module: "src/lib/image_generation.js",
    extractFunction: "extractImageGenerationPublicContract",
    npmScript: "image:generation",
    outputJson: "output/image-generation/image-generation.json",
    status: "completed",
    upstreamFoundationId: "content-generation",
    upstreamPublicContract: "extractContentGenerationPublicContract",
  },
  {
    id: "publishing",
    name: "Publishing Foundation",
    version: "v1.45.0",
    layer: "application",
    schema: "publishing/1.0",
    module: "src/lib/publishing.js",
    extractFunction: "extractPublishingPublicContract",
    npmScript: "publishing",
    outputJson: "output/publishing/publishing.json",
    status: "completed",
    upstreamFoundationId: "image-generation",
    upstreamPublicContract: "extractImageGenerationPublicContract",
  },
  {
    id: "analytics",
    name: "Analytics Foundation",
    version: "v1.46.0",
    layer: "application",
    schema: "analytics/1.0",
    module: "src/lib/analytics.js",
    extractFunction: "extractAnalyticsPublicContract",
    npmScript: "analytics",
    outputJson: "output/analytics/analytics.json",
    status: "completed",
    upstreamFoundationId: "publishing",
    upstreamPublicContract: "extractPublishingPublicContract",
  },
  {
    id: "continuous-improvement",
    name: "Continuous Improvement Foundation",
    version: "v1.47.0",
    layer: "application",
    schema: "continuous-improvement/1.0",
    module: "src/lib/continuous_improvement.js",
    extractFunction: "extractContinuousImprovementPublicContract",
    npmScript: "continuous:improvement",
    outputJson: "output/continuous-improvement/improvement.json",
    status: "completed",
    upstreamFoundationId: "analytics",
    upstreamPublicContract: "extractAnalyticsPublicContract",
  },
];

export const PLATFORM_LAYER_FOUNDATIONS = [
  {
    id: "developer-dashboard",
    name: "Developer Dashboard Foundation",
    version: "v1.36.0",
    layer: "platform",
    schema: "developer-automation/workflow-dashboard/1.0",
    module: "src/lib/developer_workflow_dashboard.js",
    extractFunction: "extractDashboardPublicContract",
    status: "completed-maintenance-only",
    upstreamFoundationId: null,
    upstreamPublicContract: null,
  },
  {
    id: "developer-analytics",
    name: "Developer Analytics Foundation",
    version: "v1.37.0",
    layer: "platform",
    schema: "developer-automation/workflow-analytics/1.0",
    module: "src/lib/developer_workflow_analytics.js",
    extractFunction: null,
    status: "completed-maintenance-only",
    upstreamFoundationId: "developer-dashboard",
    upstreamPublicContract: "extractDashboardPublicContract",
  },
  {
    id: "trend-analytics",
    name: "Trend Analytics Foundation",
    version: "v1.38.0",
    layer: "platform",
    schema: "developer-automation/workflow-trend/1.0",
    module: "src/lib/developer_workflow_trend.js",
    extractFunction: "extractTrendPublicContract",
    status: "completed-maintenance-only",
    upstreamFoundationId: "developer-dashboard",
    upstreamPublicContract: "extractDashboardPublicContract",
  },
  {
    id: "historical-analytics",
    name: "Historical Analytics Foundation",
    version: "v1.39.0",
    layer: "platform",
    schema: "developer-automation/workflow-history-analytics/1.0",
    module: "src/lib/developer_workflow_history_analytics.js",
    extractFunction: "extractHistoricalPublicContract",
    status: "completed-maintenance-only",
    upstreamFoundationId: "trend-analytics",
    upstreamPublicContract: "extractTrendPublicContract",
  },
  {
    id: "visualization",
    name: "Visualization Foundation",
    version: "v1.40.0",
    layer: "platform",
    schema: "developer-automation/workflow-visualization/1.0",
    module: "src/lib/developer_workflow_visualization.js",
    extractFunction: null,
    status: "completed-maintenance-only",
    upstreamFoundationId: "historical-analytics",
    upstreamPublicContract: "extractHistoricalPublicContract",
  },
];

export const PUBLIC_CONTRACT_DEFINITIONS = [
  {
    id: "content-idea-public-contract",
    foundationId: "idea-generation",
    extractFunction: "extractContentIdeaPublicContract",
    version: "1.0",
    fields: {
      metadata: ["schema", "generatedAt"],
      summary: ["ideaCount", "categoryCount", "candidateCount", "archivedCount"],
      ideas: ["id", "title", "category", "status", "priority", "tags"],
    },
  },
  {
    id: "ai-idea-public-contract",
    foundationId: "ai-idea-generation",
    extractFunction: "extractAIIdeaPublicContract",
    version: "1.0",
    fields: {
      metadata: ["schema", "generatedAt"],
      summary: ["ideaCount", "averageFinalScore", "topFinalScore"],
      ideas: ["id", "title", "category", "finalScore", "rank", "tags"],
    },
  },
  {
    id: "content-generation-public-contract",
    foundationId: "content-generation",
    extractFunction: "extractContentGenerationPublicContract",
    version: "2.0",
    fields: {
      metadata: ["schema", "generatedAt"],
      summary: ["draftCount", "averageWordCount", "topQualityScore"],
      drafts: ["id", "sourceIdeaId", "title", "hook", "format", "wordCount", "rank"],
    },
  },
  {
    id: "image-generation-public-contract",
    foundationId: "image-generation",
    extractFunction: "extractImageGenerationPublicContract",
    version: "1.0",
    fields: {
      metadata: ["schema", "generatedAt"],
      summary: ["promptCount", "style", "aspectRatio"],
      imagePrompts: [
        "id",
        "sourceDraftId",
        "title",
        "prompt",
        "style",
        "aspectRatio",
        "rank",
      ],
    },
  },
  {
    id: "publishing-public-contract",
    foundationId: "publishing",
    extractFunction: "extractPublishingPublicContract",
    version: "1.0",
    fields: {
      metadata: ["schema", "generatedAt"],
      summary: ["packageCount", "platform", "readyCount", "draftCount"],
      packages: [
        "id",
        "sourceImagePromptId",
        "title",
        "caption",
        "platform",
        "format",
        "status",
        "rank",
      ],
    },
  },
  {
    id: "analytics-public-contract",
    foundationId: "analytics",
    extractFunction: "extractAnalyticsPublicContract",
    version: "1.0",
    fields: {
      metadata: ["schema", "generatedAt"],
      summary: [
        "reportCount",
        "readyCount",
        "reviewCount",
        "needsWorkCount",
        "averageReadinessScore",
      ],
      reports: [
        "id",
        "sourcePackageId",
        "title",
        "platform",
        "format",
        "recommendation",
        "rank",
      ],
    },
  },
  {
    id: "continuous-improvement-public-contract",
    foundationId: "continuous-improvement",
    extractFunction: "extractContinuousImprovementPublicContract",
    version: "1.0",
    fields: {
      metadata: ["schema", "generatedAt"],
      summary: [
        "improvementCount",
        "publishReadyCount",
        "reviewContentCount",
        "revisePackageCount",
        "highPriorityCount",
        "mediumPriorityCount",
        "lowPriorityCount",
      ],
      improvements: [
        "id",
        "sourceReportId",
        "sourcePackageId",
        "title",
        "platform",
        "format",
        "recommendation",
        "priority",
        "suggestedAction",
        "rank",
      ],
    },
  },
];

export const DEPENDENCY_RULES = [
  {
    id: "public-contract-only",
    rule: "Foundation dependencies must use upstream extract*PublicContract() only",
    enforcement: "required",
  },
  {
    id: "no-internal-import",
    rule: "Direct imports of upstream internal builders, normalizers, or private fields are forbidden",
    enforcement: "required",
  },
  {
    id: "no-circular-dependency",
    rule: "Circular dependencies between foundations are forbidden",
    enforcement: "required",
  },
  {
    id: "no-upstream-reverse-dependency",
    rule: "Upstream foundations must not depend on downstream foundations",
    enforcement: "required",
  },
  {
    id: "matrix-update-required",
    rule: "Compatibility Matrix must be updated when a new foundation dependency is added",
    enforcement: "required",
  },
  {
    id: "catalog-first-reference",
    rule: "New Provider, Adapter, Runtime, or external integration must declare compatible Public Contract IDs in this catalog",
    enforcement: "recommended",
  },
];

export const LAYER_RULES = [
  {
    id: "platform-independent-from-application",
    rule: "Platform Layer must not depend on Application Layer foundations",
    scope: "platform",
  },
  {
    id: "application-independent-from-platform-internals",
    rule: "Application Layer must not depend on Platform Layer internal structures",
    scope: "application",
  },
  {
    id: "application-independent-from-future-runtime",
    rule: "Application Layer must not depend on Future Provider, Runtime, or timed execution layers",
    scope: "application",
  },
  {
    id: "future-runtime-public-contract-only",
    rule: "Future Provider, Runtime, and timed execution layers may reference Public Contract extractors only",
    scope: "future",
  },
  {
    id: "no-internal-function-dependency",
    rule: "Cross-layer or cross-foundation internal function dependencies are forbidden",
    scope: "all",
  },
  {
    id: "no-circular-reference",
    rule: "Circular references across layers and foundations are forbidden",
    scope: "all",
  },
];

export const VERSION_RULES = [
  {
    type: "patch",
    semver: "X.Y.Z+1",
    description:
      "Bug fix, documentation update, or non-breaking internal refactor with unchanged Public Contract",
    publicContractImpact: "none",
  },
  {
    type: "minor",
    semver: "X.Y+1.0",
    description:
      "Backward compatible Public Contract addition such as optional fields or summary counts",
    publicContractImpact: "additive-only",
  },
  {
    type: "major",
    semver: "X+1.0.0",
    description:
      "Breaking Public Contract change such as removed fields, renamed extract functions, or schema replacement",
    publicContractImpact: "breaking",
  },
];

export const DEPRECATION_RULES = [
  {
    stage: "deprecated",
    description:
      "Feature or contract field is deprecated but still available; consumers should migrate",
    requiredAction: "document replacement and timeline",
  },
  {
    stage: "warning",
    description:
      "Deprecated usage emits warnings in validators, CLI summary, or documentation",
    requiredAction: "keep backward compatibility for at least one minor release",
  },
  {
    stage: "removal-candidate",
    description:
      "Removal is planned; compatibility matrix and catalog must list affected foundations",
    requiredAction: "update Compatibility Matrix and migration notes before removal",
  },
  {
    stage: "removed",
    description:
      "Feature or contract field is removed after passing through deprecated, warning, and removal-candidate stages",
    requiredAction: "major version bump and explicit changelog entry",
  },
];

export const EXTENSION_WARNINGS = [
  {
    id: "provider-not-implemented",
    warning:
      "Provider and Adapter implementations are not part of v1.48.0; only Public Contract boundaries are cataloged",
  },
  {
    id: "runtime-not-implemented",
    warning:
      "Runtime execution layers are future scope; catalog defines compatibility rules only",
  },
  {
    id: "external-integration-not-implemented",
    warning:
      "External SNS integration, auth token exchange, and live metrics collection remain out of scope",
  },
  {
    id: "platform-maintenance-only",
    warning:
      "Developer Automation Platform Layer is completed at v1.40.0 and is maintenance-only",
  },
];

/**
 * @returns {object[]}
 */
export function buildCompatibilityMatrix() {
  return APPLICATION_LAYER_FOUNDATIONS.filter(
    (foundation) => foundation.upstreamFoundationId,
  ).map((foundation) => ({
    downstreamFoundationId: foundation.id,
    downstreamFoundation: foundation.name,
    downstreamVersion: foundation.version,
    upstreamFoundationId: foundation.upstreamFoundationId,
    upstreamPublicContract: foundation.upstreamPublicContract,
    dependencyType: "public-contract",
    cyclic: false,
  }));
}

/**
 * @param {unknown} rawArgs
 * @returns {{ includePlatformLayer: boolean }}
 */
export function parsePublicContractCatalogArgs(rawArgs) {
  const parsed = rawArgs && typeof rawArgs === "object" ? rawArgs : {};

  return {
    includePlatformLayer: parsed.includePlatformLayer !== false,
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @param {boolean} [options.includePlatformLayer]
 * @returns {object}
 */
export function buildPublicContractCatalog(options = {}) {
  const includePlatformLayer = options.includePlatformLayer !== false;
  const foundations = includePlatformLayer
    ? [...APPLICATION_LAYER_FOUNDATIONS, ...PLATFORM_LAYER_FOUNDATIONS]
    : [...APPLICATION_LAYER_FOUNDATIONS];

  return {
    schema: PUBLIC_CONTRACT_CATALOG_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    catalogVersion: PUBLIC_CONTRACT_CATALOG_VERSION,
    foundations,
    publicContracts: PUBLIC_CONTRACT_DEFINITIONS.map((contract) => ({ ...contract })),
    dependencyRules: DEPENDENCY_RULES.map((rule) => ({ ...rule })),
    compatibilityMatrix: buildCompatibilityMatrix(),
    layerRules: LAYER_RULES.map((rule) => ({ ...rule })),
    versionRules: VERSION_RULES.map((rule) => ({ ...rule })),
    deprecationRules: DEPRECATION_RULES.map((rule) => ({ ...rule })),
    extensionWarnings: EXTENSION_WARNINGS.map((warning) => ({ ...warning })),
    compatibilityNotes: [
      "Application Layer pipeline order: Idea Generation and AI Idea Generation are independent roots; Content Generation consumes AI Idea Public Contract; Image Generation consumes Content Generation Public Contract; Publishing consumes Image Generation Public Contract; Analytics consumes Publishing Public Contract; Continuous Improvement consumes Analytics Public Contract.",
      "Platform Layer completed at v1.40.0 and must remain independent from Application Layer internals.",
      "Future Provider, Adapter, Runtime, and external SNS integrations must consume Public Contract extractors only and update this catalog before release.",
      "Breaking Public Contract changes require a major version bump and staged deprecation before removal.",
    ],
  };
}

/**
 * @param {object | null | undefined} catalog
 * @returns {object}
 */
export function normalizePublicContractCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") {
    return buildPublicContractCatalog();
  }

  const includePlatformLayer =
    Array.isArray(catalog.foundations) &&
    catalog.foundations.some((foundation) => foundation?.layer === "platform");

  const normalized = buildPublicContractCatalog({
    generatedAt: catalog.generatedAt,
    includePlatformLayer,
  });

  return {
    ...normalized,
    schema: catalog.schema ?? PUBLIC_CONTRACT_CATALOG_SCHEMA,
    generatedAt: catalog.generatedAt ?? normalized.generatedAt,
    catalogVersion: catalog.catalogVersion ?? PUBLIC_CONTRACT_CATALOG_VERSION,
  };
}

/**
 * @param {object | null | undefined} catalog
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validatePublicContractCatalog(catalog) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!catalog || typeof catalog !== "object") {
    return {
      valid: false,
      errors: ["public contract catalog output must be an object"],
      warnings: [],
    };
  }

  if (catalog.schema !== PUBLIC_CONTRACT_CATALOG_SCHEMA) {
    warnings.push(
      `public contract catalog schema ${catalog.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!catalog.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (catalog.catalogVersion !== PUBLIC_CONTRACT_CATALOG_VERSION) {
    errors.push("catalogVersion must be 1.0");
  }

  for (const field of [
    "foundations",
    "publicContracts",
    "dependencyRules",
    "compatibilityMatrix",
    "layerRules",
    "versionRules",
    "deprecationRules",
    "extensionWarnings",
    "compatibilityNotes",
  ]) {
    if (!Array.isArray(catalog[field])) {
      errors.push(`${field} must be an array`);
    }
  }

  const applicationFoundations = Array.isArray(catalog.foundations)
    ? catalog.foundations.filter((foundation) => foundation?.layer === "application")
    : [];

  if (applicationFoundations.length !== APPLICATION_LAYER_FOUNDATIONS.length) {
    errors.push(
      `foundations must include ${APPLICATION_LAYER_FOUNDATIONS.length} application layer entries`,
    );
  }

  if (
    Array.isArray(catalog.publicContracts) &&
    catalog.publicContracts.length !== PUBLIC_CONTRACT_DEFINITIONS.length
  ) {
    errors.push(
      `publicContracts must include ${PUBLIC_CONTRACT_DEFINITIONS.length} application layer contracts`,
    );
  }

  if (
    Array.isArray(catalog.compatibilityMatrix) &&
    catalog.compatibilityMatrix.length !== buildCompatibilityMatrix().length
  ) {
    errors.push("compatibilityMatrix entry count mismatch");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object} catalog
 * @returns {string}
 */
export function renderPublicContractCatalogMarkdown(catalog) {
  const normalized = normalizePublicContractCatalog(catalog);

  const lines = [
    "# Public Contract Catalog",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Catalog Version | ${normalized.catalogVersion} |`,
    `| Foundation Count | ${normalized.foundations.length} |`,
    `| Public Contract Count | ${normalized.publicContracts.length} |`,
    `| Dependency Rules | ${normalized.dependencyRules.length} |`,
    `| Compatibility Matrix Entries | ${normalized.compatibilityMatrix.length} |`,
    "",
    "## Application Layer Foundations",
    "",
    "| ID | Foundation | Version | Schema | Public Contract | Upstream Contract |",
    "|---|---|---|---|---|---|",
  ];

  for (const foundation of normalized.foundations.filter(
    (entry) => entry.layer === "application",
  )) {
    lines.push(
      `| ${foundation.id} | ${foundation.name} | ${foundation.version} | ${foundation.schema} | ${foundation.extractFunction ?? "n/a"} | ${foundation.upstreamPublicContract ?? "none"} |`,
    );
  }

  lines.push("", "## Compatibility Matrix", "", "| Downstream | Upstream Contract | Type |", "|---|---|---|");

  for (const edge of normalized.compatibilityMatrix) {
    lines.push(
      `| ${edge.downstreamFoundation} (${edge.downstreamVersion}) | ${edge.upstreamPublicContract} | ${edge.dependencyType} |`,
    );
  }

  lines.push("", "## Dependency Rules", "");

  for (const rule of normalized.dependencyRules) {
    lines.push(`- **${rule.id}** (${rule.enforcement}): ${rule.rule}`);
  }

  lines.push("", "## Layer Rules", "");

  for (const rule of normalized.layerRules) {
    lines.push(`- **${rule.id}** [${rule.scope}]: ${rule.rule}`);
  }

  lines.push("", "## Version Rules", "", "| Type | SemVer | Public Contract Impact | Description |", "|---|---|---|---|");

  for (const rule of normalized.versionRules) {
    lines.push(
      `| ${rule.type} | ${rule.semver} | ${rule.publicContractImpact} | ${rule.description} |`,
    );
  }

  lines.push("", "## Deprecation Rules", "", "| Stage | Required Action | Description |", "|---|---|---|");

  for (const rule of normalized.deprecationRules) {
    lines.push(`| ${rule.stage} | ${rule.requiredAction} | ${rule.description} |`);
  }

  lines.push("", "## Public Contracts", "");

  for (const contract of normalized.publicContracts) {
    lines.push(`### ${contract.id}`);
    lines.push("");
    lines.push(`- Extract Function: \`${contract.extractFunction}\``);
    lines.push(`- Foundation: \`${contract.foundationId}\``);
    lines.push(`- Version: \`${contract.version}\``);
    lines.push("");
  }

  lines.push("## Extension Warnings", "");

  for (const warning of normalized.extensionWarnings) {
    lines.push(`- **${warning.id}**: ${warning.warning}`);
  }

  lines.push("", "## Compatibility Notes", "");

  for (const note of normalized.compatibilityNotes) {
    lines.push(`- ${note}`);
  }

  return lines.join("\n");
}

/**
 * @param {object} catalog
 * @returns {string}
 */
export function printPublicContractCatalogSummary(catalog) {
  const normalized = normalizePublicContractCatalog(catalog);
  const applicationCount = normalized.foundations.filter(
    (foundation) => foundation.layer === "application",
  ).length;

  return [
    "Public Contract Catalog Summary",
    `Catalog Version: ${normalized.catalogVersion}`,
    `Application Foundations: ${applicationCount}`,
    `Public Contracts: ${normalized.publicContracts.length}`,
    `Dependency Rules: ${normalized.dependencyRules.length}`,
    `Compatibility Matrix Entries: ${normalized.compatibilityMatrix.length}`,
    `Layer Rules: ${normalized.layerRules.length}`,
    `Version Rules: ${normalized.versionRules.length}`,
    `Deprecation Rules: ${normalized.deprecationRules.length}`,
  ].join("\n");
}

/**
 * @param {object} catalog
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writePublicContractCatalogArtifacts(catalog, rootDir = process.cwd()) {
  const normalized = normalizePublicContractCatalog(catalog);
  const validation = validatePublicContractCatalog(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, PUBLIC_CONTRACT_CATALOG_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, PUBLIC_CONTRACT_CATALOG_JSON_FILENAME);
  const markdownPath = path.join(outputDir, PUBLIC_CONTRACT_CATALOG_MD_FILENAME);

  fs.writeFileSync(jsonPath, `${JSON.stringify(normalized, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${renderPublicContractCatalogMarkdown(normalized)}\n`,
  );

  return {
    json: `${PUBLIC_CONTRACT_CATALOG_OUTPUT_DIR}/${PUBLIC_CONTRACT_CATALOG_JSON_FILENAME}`,
    markdown: `${PUBLIC_CONTRACT_CATALOG_OUTPUT_DIR}/${PUBLIC_CONTRACT_CATALOG_MD_FILENAME}`,
  };
}

/**
 * @param {object | null} [rawArgs]
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @param {boolean} [options.includePlatformLayer]
 * @param {string} [options.rootDir]
 * @returns {{ catalog: object, paths: { json: string, markdown: string } }}
 */
export function buildPublicContractCatalogPipeline(rawArgs = null, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const args = parsePublicContractCatalogArgs(rawArgs);
  const catalog = normalizePublicContractCatalog(
    buildPublicContractCatalog({
      generatedAt: options.generatedAt,
      includePlatformLayer:
        options.includePlatformLayer ?? args.includePlatformLayer,
    }),
  );
  const validation = validatePublicContractCatalog(catalog);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const paths = writePublicContractCatalogArtifacts(catalog, rootDir);

  return { catalog, paths };
}
