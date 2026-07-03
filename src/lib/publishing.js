import fs from "node:fs";
import path from "node:path";
import {
  IMAGE_GENERATION_JSON_FILENAME,
  IMAGE_GENERATION_OUTPUT_DIR,
  extractImageGenerationPublicContract,
} from "./image_generation.js";

export const PUBLISHING_SCHEMA = "publishing/1.0";
export const PUBLISHING_OUTPUT_DIR = "output/publishing";
export const PUBLISHING_JSON_FILENAME = "publishing.json";
export const PUBLISHING_MD_FILENAME = "publishing.md";

export const PUBLISHING_PLATFORM = "instagram";
export const PUBLISHING_FORMAT = "feed";
export const PUBLISHING_STATUS = {
  DRAFT: "draft",
};

export const PUBLISHING_ASSET_TYPE = "image-prompt";

/**
 * @param {string | null | undefined} imageGenerationPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function loadImageGenerationPublicContract(
  imageGenerationPath,
  rootDir = process.cwd(),
) {
  const relativePath =
    imageGenerationPath ??
    `${IMAGE_GENERATION_OUTPUT_DIR}/${IMAGE_GENERATION_JSON_FILENAME}`;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return extractImageGenerationPublicContract(null);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return extractImageGenerationPublicContract(raw);
}

/**
 * @param {unknown} rawArgs
 * @param {object | null | undefined} [imageContract]
 * @returns {{ imageContract: object }}
 */
export function parsePublishingArgs(rawArgs, imageContract = null) {
  const parsed = rawArgs && typeof rawArgs === "object" ? rawArgs : {};

  const contract =
    imageContract ??
    (parsed.imageContract && typeof parsed.imageContract === "object"
      ? extractImageGenerationPublicContract(parsed.imageContract)
      : extractImageGenerationPublicContract(null));

  return {
    imageContract: extractImageGenerationPublicContract(contract),
  };
}

/**
 * @param {object} imagePrompt
 * @param {number} index
 * @returns {object}
 */
export function buildPublishingPackageFromPrompt(imagePrompt, index) {
  const title =
    typeof imagePrompt.title === "string" && imagePrompt.title.length > 0
      ? imagePrompt.title
      : `Package ${index + 1}`;
  const prompt =
    typeof imagePrompt.prompt === "string" ? imagePrompt.prompt : "";
  const caption = [title, prompt].filter((part) => part.length > 0).join("\n\n");

  return {
    id: `pkg-${String(index + 1).padStart(3, "0")}`,
    sourceImagePromptId:
      typeof imagePrompt.id === "string" ? imagePrompt.id : "",
    title,
    caption,
    imagePrompt: prompt,
    platform: PUBLISHING_PLATFORM,
    format: PUBLISHING_FORMAT,
    status: PUBLISHING_STATUS.DRAFT,
    asset: {
      type: PUBLISHING_ASSET_TYPE,
      ready: true,
    },
    checklist: [
      "Review caption text",
      "Confirm image prompt matches brand",
      "Prepare image asset manually",
      "Post via Instagram app",
    ],
    rank: typeof imagePrompt.rank === "number" ? imagePrompt.rank : index + 1,
  };
}

/**
 * @param {object} imageContract
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildPublishingPackages(imageContract, options = {}) {
  const contract = extractImageGenerationPublicContract(imageContract);
  const prompts = Array.isArray(contract.imagePrompts)
    ? contract.imagePrompts
    : [];

  const packages = prompts
    .map((prompt, index) => buildPublishingPackageFromPrompt(prompt, index))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.id.localeCompare(right.id);
    });

  let readyCount = 0;
  let draftCount = 0;

  for (const pkg of packages) {
    if (pkg.status === PUBLISHING_STATUS.DRAFT) {
      draftCount += 1;
    }

    if (pkg.asset?.ready === true) {
      readyCount += 1;
    }
  }

  return {
    schema: PUBLISHING_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      schema: contract.metadata.schema,
      generatedAt: contract.metadata.generatedAt,
      promptCount: contract.summary.promptCount,
    },
    packages,
    summary: {
      packageCount: packages.length,
      platform: PUBLISHING_PLATFORM,
      readyCount,
      draftCount,
    },
  };
}

/**
 * @param {unknown} pkg
 * @param {number} index
 * @returns {object}
 */
export function normalizePublishingPackageItem(pkg, index = 0) {
  if (!pkg || typeof pkg !== "object") {
    return {
      id: `pkg-${String(index + 1).padStart(3, "0")}`,
      sourceImagePromptId: "",
      title: "",
      caption: "",
      imagePrompt: "",
      platform: PUBLISHING_PLATFORM,
      format: PUBLISHING_FORMAT,
      status: PUBLISHING_STATUS.DRAFT,
      asset: {
        type: PUBLISHING_ASSET_TYPE,
        ready: true,
      },
      checklist: [],
      rank: index + 1,
    };
  }

  return {
    id:
      typeof pkg.id === "string" && pkg.id.length > 0
        ? pkg.id
        : `pkg-${String(index + 1).padStart(3, "0")}`,
    sourceImagePromptId:
      typeof pkg.sourceImagePromptId === "string" ? pkg.sourceImagePromptId : "",
    title: typeof pkg.title === "string" ? pkg.title : "",
    caption: typeof pkg.caption === "string" ? pkg.caption : "",
    imagePrompt: typeof pkg.imagePrompt === "string" ? pkg.imagePrompt : "",
    platform: PUBLISHING_PLATFORM,
    format: PUBLISHING_FORMAT,
    status: PUBLISHING_STATUS.DRAFT,
    asset: {
      type: PUBLISHING_ASSET_TYPE,
      ready: pkg.asset?.ready !== false,
    },
    checklist: Array.isArray(pkg.checklist)
      ? pkg.checklist.filter((item) => typeof item === "string")
      : [],
    rank: typeof pkg.rank === "number" ? pkg.rank : index + 1,
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {object}
 */
export function normalizePublishingPackages(output) {
  if (!output || typeof output !== "object") {
    return buildPublishingPackages(extractImageGenerationPublicContract(null));
  }

  const packages = Array.isArray(output.packages)
    ? output.packages
        .map((pkg, index) => normalizePublishingPackageItem(pkg, index))
        .sort((left, right) => {
          if (left.rank !== right.rank) {
            return left.rank - right.rank;
          }

          return left.id.localeCompare(right.id);
        })
    : [];

  let readyCount = 0;
  let draftCount = 0;

  for (const pkg of packages) {
    if (pkg.status === PUBLISHING_STATUS.DRAFT) {
      draftCount += 1;
    }

    if (pkg.asset.ready === true) {
      readyCount += 1;
    }
  }

  return {
    schema: output.schema ?? PUBLISHING_SCHEMA,
    generatedAt: output.generatedAt ?? new Date().toISOString(),
    source: {
      schema: output.source?.schema ?? null,
      generatedAt: output.source?.generatedAt ?? null,
      promptCount: output.source?.promptCount ?? 0,
    },
    packages,
    summary: {
      packageCount: packages.length,
      platform: PUBLISHING_PLATFORM,
      readyCount,
      draftCount,
    },
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validatePublishingPackages(output) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!output || typeof output !== "object") {
    return {
      valid: false,
      errors: ["publishing output must be an object"],
      warnings: [],
    };
  }

  if (output.schema !== PUBLISHING_SCHEMA) {
    warnings.push(
      `publishing schema ${output.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!output.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!output.source || typeof output.source !== "object") {
    errors.push("source is required");
  }

  if (!output.summary || typeof output.summary !== "object") {
    errors.push("summary is required");
  }

  if (!Array.isArray(output.packages)) {
    errors.push("packages must be an array");
    return { valid: errors.length === 0, errors, warnings };
  }

  output.packages.forEach((pkg, index) => {
    if (!pkg || typeof pkg !== "object") {
      errors.push(`packages[${index}] must be an object`);
      return;
    }

    for (const field of [
      "id",
      "sourceImagePromptId",
      "title",
      "caption",
      "imagePrompt",
      "platform",
      "format",
      "status",
    ]) {
      if (typeof pkg[field] !== "string") {
        errors.push(`packages[${index}].${field} must be a string`);
      }
    }

    if (pkg.platform !== PUBLISHING_PLATFORM) {
      errors.push(`packages[${index}].platform must be instagram`);
    }

    if (pkg.format !== PUBLISHING_FORMAT) {
      errors.push(`packages[${index}].format must be feed`);
    }

    if (pkg.status !== PUBLISHING_STATUS.DRAFT) {
      errors.push(`packages[${index}].status must be draft`);
    }

    if (!pkg.asset || typeof pkg.asset !== "object") {
      errors.push(`packages[${index}].asset is required`);
    } else {
      if (pkg.asset.type !== PUBLISHING_ASSET_TYPE) {
        errors.push(`packages[${index}].asset.type must be image-prompt`);
      }

      if (typeof pkg.asset.ready !== "boolean") {
        errors.push(`packages[${index}].asset.ready must be a boolean`);
      }
    }

    if (!Array.isArray(pkg.checklist)) {
      errors.push(`packages[${index}].checklist must be an array`);
    }

    if (typeof pkg.rank !== "number") {
      errors.push(`packages[${index}].rank must be a number`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {object}
 */
export function extractPublishingPublicContract(output) {
  const normalized = normalizePublishingPackages(output);

  return {
    metadata: {
      schema: normalized.schema,
      generatedAt: normalized.generatedAt,
    },
    summary: {
      packageCount: normalized.summary.packageCount,
      platform: normalized.summary.platform,
      readyCount: normalized.summary.readyCount,
      draftCount: normalized.summary.draftCount,
    },
    packages: normalized.packages.map((pkg) => ({
      id: pkg.id,
      sourceImagePromptId: pkg.sourceImagePromptId,
      title: pkg.title,
      caption: pkg.caption,
      platform: pkg.platform,
      format: pkg.format,
      status: pkg.status,
      rank: pkg.rank,
    })),
  };
}

/**
 * @param {object} output
 * @returns {string}
 */
export function buildPublishingMarkdown(output) {
  const normalized = normalizePublishingPackages(output);
  const contract = extractPublishingPublicContract(normalized);

  const lines = [
    "# Publishing Report",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Source Schema | ${normalized.source.schema ?? "none"} |`,
    `| Package Count | ${contract.summary.packageCount} |`,
    `| Platform | ${contract.summary.platform} |`,
    `| Ready | ${contract.summary.readyCount} |`,
    `| Draft | ${contract.summary.draftCount} |`,
    "",
    "## Packages",
    "",
  ];

  for (const pkg of normalized.packages) {
    lines.push(`### ${pkg.rank}. ${pkg.title || pkg.id}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| ID | ${pkg.id} |`);
    lines.push(`| Source Image Prompt ID | ${pkg.sourceImagePromptId} |`);
    lines.push(`| Platform | ${pkg.platform} |`);
    lines.push(`| Format | ${pkg.format} |`);
    lines.push(`| Status | ${pkg.status} |`);
    lines.push(`| Asset Type | ${pkg.asset.type} |`);
    lines.push(`| Asset Ready | ${pkg.asset.ready} |`);
    lines.push(`| Rank | ${pkg.rank} |`);
    lines.push("");
    lines.push("#### Caption");
    lines.push("");
    lines.push(pkg.caption || "_empty_");
    lines.push("");
    lines.push("#### Image Prompt");
    lines.push("");
    lines.push(pkg.imagePrompt || "_empty_");
    lines.push("");
    lines.push("#### Checklist");
    lines.push("");
    for (const item of pkg.checklist) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {object} output
 * @returns {string}
 */
export function buildPublishingCliSummary(output) {
  const contract = extractPublishingPublicContract(output);

  return [
    "Publishing Summary",
    "",
    `Packages : ${contract.summary.packageCount}`,
    `Platform : ${contract.summary.platform}`,
    `Ready    : ${contract.summary.readyCount}`,
    `Draft    : ${contract.summary.draftCount}`,
    `Output   : ${PUBLISHING_OUTPUT_DIR}/`,
  ].join("\n");
}

/**
 * @param {object} output
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writePublishingArtifacts(output, rootDir = process.cwd()) {
  const normalized = normalizePublishingPackages(output);
  const validation = validatePublishingPackages(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, PUBLISHING_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, PUBLISHING_JSON_FILENAME);
  const markdownPath = path.join(outputDir, PUBLISHING_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    source: normalized.source,
    packages: normalized.packages,
    summary: normalized.summary,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${buildPublishingMarkdown(normalized)}\n`,
  );

  return {
    json: `${PUBLISHING_OUTPUT_DIR}/${PUBLISHING_JSON_FILENAME}`,
    markdown: `${PUBLISHING_OUTPUT_DIR}/${PUBLISHING_MD_FILENAME}`,
  };
}

/**
 * @param {object | null} [rawArgs]
 * @param {object} [options]
 * @param {string | null} [options.imageGenerationPath]
 * @param {string} [options.generatedAt]
 * @param {string} [options.rootDir]
 * @returns {{ output: object, paths: { json: string, markdown: string } }}
 */
export function buildPublishingPipeline(rawArgs = null, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const imageContract = loadImageGenerationPublicContract(
    options.imageGenerationPath,
    rootDir,
  );
  const args = parsePublishingArgs(rawArgs, imageContract);
  const output = normalizePublishingPackages(
    buildPublishingPackages(args.imageContract, {
      generatedAt: options.generatedAt,
    }),
  );
  const validation = validatePublishingPackages(output);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const paths = writePublishingArtifacts(output, rootDir);

  return { output, paths };
}
