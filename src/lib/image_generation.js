import fs from "node:fs";
import path from "node:path";
import {
  CONTENT_GENERATION_JSON_FILENAME,
  CONTENT_GENERATION_OUTPUT_DIR,
  extractContentGenerationPublicContract,
} from "./content_generation.js";

export const IMAGE_GENERATION_SCHEMA = "image-generation/1.0";
export const IMAGE_GENERATION_OUTPUT_DIR = "output/image-generation";
export const IMAGE_GENERATION_JSON_FILENAME = "image-generation.json";
export const IMAGE_GENERATION_MD_FILENAME = "image-generation.md";

export const IMAGE_PROMPT_STYLE = "photorealistic";
export const IMAGE_PROMPT_ASPECT_RATIO = "1:1";
export const IMAGE_PROMPT_QUALITY = "high";

const IMAGE_MOODS = [
  "warm and inviting",
  "bright and energetic",
  "calm and professional",
  "cozy and authentic",
  "fresh and modern",
];

const IMAGE_COMPOSITIONS = [
  "centered subject with negative space for text overlay",
  "close-up hero shot with shallow depth of field",
  "wide scene with foreground detail",
  "rule-of-thirds layout with clean background",
  "overhead flat lay with balanced spacing",
];

/**
 * @param {string} value
 * @returns {number}
 */
export function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

/**
 * @param {string | null | undefined} contentGenerationPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function loadContentGenerationPublicContract(
  contentGenerationPath,
  rootDir = process.cwd(),
) {
  const relativePath =
    contentGenerationPath ??
    `${CONTENT_GENERATION_OUTPUT_DIR}/${CONTENT_GENERATION_JSON_FILENAME}`;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return extractContentGenerationPublicContract(null);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return extractContentGenerationPublicContract(raw);
}

/**
 * @param {unknown} rawInputs
 * @param {object | null | undefined} [contentContract]
 * @returns {{ contentContract: object }}
 */
export function parseImageGenerationInputs(rawInputs, contentContract = null) {
  const parsed =
    rawInputs && typeof rawInputs === "object" ? rawInputs : {};

  const contract =
    contentContract ??
    (parsed.contentContract && typeof parsed.contentContract === "object"
      ? extractContentGenerationPublicContract(parsed.contentContract)
      : extractContentGenerationPublicContract(null));

  return {
    contentContract: extractContentGenerationPublicContract(contract),
  };
}

/**
 * @param {object} draft
 * @param {number} index
 * @returns {object}
 */
export function buildImagePromptFromDraft(draft, index) {
  const title = typeof draft.title === "string" ? draft.title : "";
  const hook = typeof draft.hook === "string" ? draft.hook : "";
  const seed = `${draft.id ?? "draft"}|${title}|${hook}|${index}`;
  const hash = hashString(seed);
  const mood = IMAGE_MOODS[hash % IMAGE_MOODS.length];
  const composition = IMAGE_COMPOSITIONS[hash % IMAGE_COMPOSITIONS.length];
  const subject = title || hook || `Draft ${draft.id ?? index + 1}`;

  return {
    id: `img-prompt-${String(index + 1).padStart(3, "0")}`,
    sourceDraftId: typeof draft.id === "string" ? draft.id : "",
    title: title || subject,
    prompt: [
      "Instagram photo",
      subject,
      hook,
      `${IMAGE_PROMPT_STYLE} style`,
      `${mood} mood`,
      composition,
      `${IMAGE_PROMPT_ASPECT_RATIO} aspect ratio`,
    ]
      .filter((part) => part && part.length > 0)
      .join(", "),
    style: IMAGE_PROMPT_STYLE,
    aspectRatio: IMAGE_PROMPT_ASPECT_RATIO,
    mood,
    subject,
    composition,
    quality: IMAGE_PROMPT_QUALITY,
    rank: typeof draft.rank === "number" ? draft.rank : index + 1,
  };
}

/**
 * @param {object} contentContract
 * @returns {object[]}
 */
export function generateImagePrompts(contentContract) {
  const contract = extractContentGenerationPublicContract(contentContract);
  const drafts = Array.isArray(contract.drafts) ? contract.drafts : [];

  return drafts
    .map((draft, index) => buildImagePromptFromDraft(draft, index))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.id.localeCompare(right.id);
    });
}

/**
 * @param {object} inputs
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildImageGeneration(inputs, options = {}) {
  const parsed = parseImageGenerationInputs(inputs);
  const contract = parsed.contentContract;
  const imagePrompts = generateImagePrompts(contract);

  return {
    schema: IMAGE_GENERATION_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      schema: contract.metadata.schema,
      generatedAt: contract.metadata.generatedAt,
      draftCount: contract.summary.draftCount,
    },
    imagePrompts,
    summary: {
      promptCount: imagePrompts.length,
      style: IMAGE_PROMPT_STYLE,
      aspectRatio: IMAGE_PROMPT_ASPECT_RATIO,
      quality: IMAGE_PROMPT_QUALITY,
    },
  };
}

/**
 * @param {unknown} prompt
 * @param {number} index
 * @returns {object}
 */
export function normalizeImagePromptItem(prompt, index = 0) {
  if (!prompt || typeof prompt !== "object") {
    return {
      id: `img-prompt-${String(index + 1).padStart(3, "0")}`,
      sourceDraftId: "",
      title: "",
      prompt: "",
      style: IMAGE_PROMPT_STYLE,
      aspectRatio: IMAGE_PROMPT_ASPECT_RATIO,
      mood: IMAGE_MOODS[0],
      subject: "",
      composition: IMAGE_COMPOSITIONS[0],
      quality: IMAGE_PROMPT_QUALITY,
      rank: index + 1,
    };
  }

  return {
    id:
      typeof prompt.id === "string" && prompt.id.length > 0
        ? prompt.id
        : `img-prompt-${String(index + 1).padStart(3, "0")}`,
    sourceDraftId:
      typeof prompt.sourceDraftId === "string" ? prompt.sourceDraftId : "",
    title: typeof prompt.title === "string" ? prompt.title : "",
    prompt: typeof prompt.prompt === "string" ? prompt.prompt : "",
    style: IMAGE_PROMPT_STYLE,
    aspectRatio: IMAGE_PROMPT_ASPECT_RATIO,
    mood:
      typeof prompt.mood === "string" && prompt.mood.length > 0
        ? prompt.mood
        : IMAGE_MOODS[0],
    subject: typeof prompt.subject === "string" ? prompt.subject : "",
    composition:
      typeof prompt.composition === "string" && prompt.composition.length > 0
        ? prompt.composition
        : IMAGE_COMPOSITIONS[0],
    quality: IMAGE_PROMPT_QUALITY,
    rank: typeof prompt.rank === "number" ? prompt.rank : index + 1,
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {object}
 */
export function normalizeImageGeneration(output) {
  if (!output || typeof output !== "object") {
    return buildImageGeneration({ contentContract: null });
  }

  const imagePrompts = Array.isArray(output.imagePrompts)
    ? output.imagePrompts
        .map((prompt, index) => normalizeImagePromptItem(prompt, index))
        .sort((left, right) => {
          if (left.rank !== right.rank) {
            return left.rank - right.rank;
          }

          return left.id.localeCompare(right.id);
        })
    : [];

  return {
    schema: output.schema ?? IMAGE_GENERATION_SCHEMA,
    generatedAt: output.generatedAt ?? new Date().toISOString(),
    source: {
      schema: output.source?.schema ?? null,
      generatedAt: output.source?.generatedAt ?? null,
      draftCount: output.source?.draftCount ?? 0,
    },
    imagePrompts,
    summary: {
      promptCount: imagePrompts.length,
      style: IMAGE_PROMPT_STYLE,
      aspectRatio: IMAGE_PROMPT_ASPECT_RATIO,
      quality: IMAGE_PROMPT_QUALITY,
    },
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateImageGeneration(output) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!output || typeof output !== "object") {
    return {
      valid: false,
      errors: ["image generation output must be an object"],
      warnings: [],
    };
  }

  if (output.schema !== IMAGE_GENERATION_SCHEMA) {
    warnings.push(
      `image generation schema ${output.schema ?? "missing"} treated as legacy`,
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

  if (!Array.isArray(output.imagePrompts)) {
    errors.push("imagePrompts must be an array");
    return { valid: errors.length === 0, errors, warnings };
  }

  output.imagePrompts.forEach((prompt, index) => {
    if (!prompt || typeof prompt !== "object") {
      errors.push(`imagePrompts[${index}] must be an object`);
      return;
    }

    for (const field of [
      "id",
      "sourceDraftId",
      "title",
      "prompt",
      "style",
      "aspectRatio",
      "mood",
      "subject",
      "composition",
      "quality",
    ]) {
      if (typeof prompt[field] !== "string") {
        errors.push(`imagePrompts[${index}].${field} must be a string`);
      }
    }

    if (typeof prompt.rank !== "number") {
      errors.push(`imagePrompts[${index}].rank must be a number`);
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
export function extractImageGenerationPublicContract(output) {
  const normalized = normalizeImageGeneration(output);

  return {
    metadata: {
      schema: normalized.schema,
      generatedAt: normalized.generatedAt,
    },
    summary: {
      promptCount: normalized.summary.promptCount,
      style: normalized.summary.style,
      aspectRatio: normalized.summary.aspectRatio,
    },
    imagePrompts: normalized.imagePrompts.map((prompt) => ({
      id: prompt.id,
      sourceDraftId: prompt.sourceDraftId,
      title: prompt.title,
      prompt: prompt.prompt,
      style: prompt.style,
      aspectRatio: prompt.aspectRatio,
      rank: prompt.rank,
    })),
  };
}

/**
 * @param {object} output
 * @returns {string}
 */
export function renderImageGenerationMarkdown(output) {
  const normalized = normalizeImageGeneration(output);
  const contract = extractImageGenerationPublicContract(normalized);

  const lines = [
    "# Image Generation Report",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Source Schema | ${normalized.source.schema ?? "none"} |`,
    `| Source Draft Count | ${normalized.source.draftCount} |`,
    `| Prompt Count | ${contract.summary.promptCount} |`,
    `| Style | ${contract.summary.style} |`,
    `| Aspect Ratio | ${contract.summary.aspectRatio} |`,
    "",
    "## Image Prompts",
    "",
  ];

  for (const prompt of normalized.imagePrompts) {
    lines.push(`### ${prompt.rank}. ${prompt.title || prompt.id}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| ID | ${prompt.id} |`);
    lines.push(`| Source Draft ID | ${prompt.sourceDraftId} |`);
    lines.push(`| Prompt | ${prompt.prompt} |`);
    lines.push(`| Style | ${prompt.style} |`);
    lines.push(`| Aspect Ratio | ${prompt.aspectRatio} |`);
    lines.push(`| Mood | ${prompt.mood} |`);
    lines.push(`| Subject | ${prompt.subject} |`);
    lines.push(`| Composition | ${prompt.composition} |`);
    lines.push(`| Quality | ${prompt.quality} |`);
    lines.push(`| Rank | ${prompt.rank} |`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {object} output
 * @returns {string}
 */
export function buildImageGenerationSummary(output) {
  const contract = extractImageGenerationPublicContract(output);

  return [
    "Image Generation Summary",
    `Prompts: ${contract.summary.promptCount}`,
    `Style: ${contract.summary.style}`,
    `Aspect Ratio: ${contract.summary.aspectRatio}`,
  ].join("\n");
}

/**
 * @param {object} output
 * @param {string} [rootDir]
 * @returns {string}
 */
export function writeImageGenerationJson(output, rootDir = process.cwd()) {
  const normalized = normalizeImageGeneration(output);
  const validation = validateImageGeneration(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, IMAGE_GENERATION_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, IMAGE_GENERATION_JSON_FILENAME);
  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    source: normalized.source,
    imagePrompts: normalized.imagePrompts,
    summary: normalized.summary,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);

  return `${IMAGE_GENERATION_OUTPUT_DIR}/${IMAGE_GENERATION_JSON_FILENAME}`;
}

/**
 * @param {object} output
 * @param {string} [rootDir]
 * @returns {string}
 */
export function writeImageGenerationMarkdown(output, rootDir = process.cwd()) {
  const normalized = normalizeImageGeneration(output);
  const validation = validateImageGeneration(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, IMAGE_GENERATION_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const markdownPath = path.join(outputDir, IMAGE_GENERATION_MD_FILENAME);
  fs.writeFileSync(
    markdownPath,
    `${renderImageGenerationMarkdown(normalized)}\n`,
  );

  return `${IMAGE_GENERATION_OUTPUT_DIR}/${IMAGE_GENERATION_MD_FILENAME}`;
}

/**
 * @param {object | null} [rawInputs]
 * @param {object} [options]
 * @param {string | null} [options.contentGenerationPath]
 * @param {string} [options.generatedAt]
 * @param {string} [options.rootDir]
 * @returns {{ output: object, paths: { json: string, markdown: string } }}
 */
export function buildImageGenerationPipeline(rawInputs = null, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const contentContract = loadContentGenerationPublicContract(
    options.contentGenerationPath,
    rootDir,
  );
  const inputs = parseImageGenerationInputs(rawInputs, contentContract);
  const output = normalizeImageGeneration(
    buildImageGeneration(inputs, { generatedAt: options.generatedAt }),
  );
  const validation = validateImageGeneration(output);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const json = writeImageGenerationJson(output, rootDir);
  const markdown = writeImageGenerationMarkdown(output, rootDir);

  return { output, paths: { json, markdown } };
}
