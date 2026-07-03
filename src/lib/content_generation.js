import fs from "node:fs";
import path from "node:path";
import {
  CONTENT_AI_IDEA_JSON_FILENAME,
  CONTENT_AI_IDEA_OUTPUT_DIR,
  extractAIIdeaPublicContract,
} from "./content_ai_idea.js";

export const CONTENT_GENERATION_SCHEMA = "content-generation/2.0";
export const CONTENT_GENERATION_OUTPUT_DIR = "output/content-generation";
export const CONTENT_GENERATION_JSON_FILENAME = "content-generation.json";
export const CONTENT_GENERATION_MD_FILENAME = "content-generation.md";

export const CONTENT_GENERATION_PROVIDER = {
  MOCK: "mock",
};

export const CONTENT_GENERATION_TONE = {
  FRIENDLY: "friendly",
  PROFESSIONAL: "professional",
};

export const CONTENT_GENERATION_FORMAT = {
  SINGLE_POST: "single-post",
};

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
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

/**
 * @param {string | null | undefined} aiIdeaPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function loadAIIdeaPublicContract(aiIdeaPath, rootDir = process.cwd()) {
  const relativePath =
    aiIdeaPath ??
    `${CONTENT_AI_IDEA_OUTPUT_DIR}/${CONTENT_AI_IDEA_JSON_FILENAME}`;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return extractAIIdeaPublicContract(null);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return extractAIIdeaPublicContract(raw);
}

/**
 * @param {unknown} rawInputs
 * @param {object | null | undefined} [aiIdeaContract]
 * @returns {{ aiIdeaContract: object, tone: string, format: string }}
 */
export function parseContentGenerationInputs(rawInputs, aiIdeaContract = null) {
  const defaults = {
    tone: CONTENT_GENERATION_TONE.FRIENDLY,
    format: CONTENT_GENERATION_FORMAT.SINGLE_POST,
  };

  const parsed =
    rawInputs && typeof rawInputs === "object" ? rawInputs : {};

  const contract =
    aiIdeaContract ??
    (parsed.aiIdeaContract && typeof parsed.aiIdeaContract === "object"
      ? extractAIIdeaPublicContract(parsed.aiIdeaContract)
      : extractAIIdeaPublicContract(null));

  return {
    aiIdeaContract: extractAIIdeaPublicContract(contract),
    tone:
      parsed.tone === CONTENT_GENERATION_TONE.PROFESSIONAL
        ? CONTENT_GENERATION_TONE.PROFESSIONAL
        : defaults.tone,
    format:
      parsed.format === CONTENT_GENERATION_FORMAT.SINGLE_POST
        ? CONTENT_GENERATION_FORMAT.SINGLE_POST
        : defaults.format,
  };
}

/**
 * @param {object} idea
 * @param {object} inputs
 * @param {number} index
 * @returns {object}
 */
function buildMockContentDraft(idea, inputs, index) {
  const seed = `${idea.id}|${idea.title}|${inputs.tone}|${index}`;
  const hash = hashString(seed);
  const hook = `【${idea.title}】今日から試せるポイントをまとめました。`;
  const body = [
    `${idea.title} について、${inputs.tone} なトーンで投稿本文候補を作成しました。`,
    "現場ですぐ使える具体例を1つ入れ、保存しやすい構成にしています。",
    "次の投稿づくりのたたき台として活用してください。",
  ].join(" ");
  const callToAction = "保存して、次のシフト前に1つ試してみてください。";
  const qualityScore =
    Math.round((0.6 + (idea.finalScore ?? 0) * 0.3 + (hash % 10) / 100) * 1000) /
    1000;

  return {
    id: `draft-${String(index + 1).padStart(3, "0")}`,
    sourceIdeaId: idea.id,
    sourceIdeaTitle: idea.title,
    title: idea.title,
    hook,
    body,
    callToAction,
    tone: inputs.tone,
    format: inputs.format,
    wordCount: countWords(`${hook} ${body} ${callToAction}`),
    qualityScore,
    rank: index + 1,
  };
}

/**
 * @param {object} contract
 * @param {object} inputs
 * @returns {object[]}
 */
export function generateMockContentDrafts(contract, inputs) {
  const ideas = Array.isArray(contract?.ideas) ? contract.ideas : [];

  return ideas.map((idea, index) => buildMockContentDraft(idea, inputs, index));
}

/** @type {Record<string, (contract: object, inputs: object) => object[]>} */
export const CONTENT_DRAFT_GENERATORS = {
  [CONTENT_GENERATION_PROVIDER.MOCK]: generateMockContentDrafts,
};

/**
 * @param {object} contract
 * @param {object} inputs
 * @param {object} [options]
 * @param {string} [options.provider]
 * @returns {object[]}
 */
export function generateContentDrafts(contract, inputs, options = {}) {
  const provider = options.provider ?? CONTENT_GENERATION_PROVIDER.MOCK;
  const generator = CONTENT_DRAFT_GENERATORS[provider];

  if (!generator) {
    throw new Error(`unsupported content generation provider: ${provider}`);
  }

  return generator(extractAIIdeaPublicContract(contract), inputs);
}

/**
 * @param {unknown} draft
 * @param {number} index
 * @returns {object}
 */
export function normalizeContentDraftItem(draft, index = 0) {
  if (!draft || typeof draft !== "object") {
    return {
      id: `draft-${String(index + 1).padStart(3, "0")}`,
      sourceIdeaId: "",
      sourceIdeaTitle: "",
      title: "",
      hook: "",
      body: "",
      callToAction: "",
      tone: CONTENT_GENERATION_TONE.FRIENDLY,
      format: CONTENT_GENERATION_FORMAT.SINGLE_POST,
      wordCount: 0,
      qualityScore: 0,
      rank: index + 1,
    };
  }

  const hook = typeof draft.hook === "string" ? draft.hook : "";
  const body = typeof draft.body === "string" ? draft.body : "";
  const callToAction =
    typeof draft.callToAction === "string" ? draft.callToAction : "";
  const wordCount =
    typeof draft.wordCount === "number"
      ? draft.wordCount
      : countWords(`${hook} ${body} ${callToAction}`);

  return {
    id:
      typeof draft.id === "string" && draft.id.length > 0
        ? draft.id
        : `draft-${String(index + 1).padStart(3, "0")}`,
    sourceIdeaId:
      typeof draft.sourceIdeaId === "string" ? draft.sourceIdeaId : "",
    sourceIdeaTitle:
      typeof draft.sourceIdeaTitle === "string" ? draft.sourceIdeaTitle : "",
    title: typeof draft.title === "string" ? draft.title : "",
    hook,
    body,
    callToAction,
    tone:
      draft.tone === CONTENT_GENERATION_TONE.PROFESSIONAL
        ? CONTENT_GENERATION_TONE.PROFESSIONAL
        : CONTENT_GENERATION_TONE.FRIENDLY,
    format: CONTENT_GENERATION_FORMAT.SINGLE_POST,
    wordCount,
    qualityScore:
      typeof draft.qualityScore === "number" ? draft.qualityScore : 0,
    rank: typeof draft.rank === "number" ? draft.rank : index + 1,
  };
}

/**
 * @param {object[]} drafts
 * @returns {object[]}
 */
export function normalizeContentDrafts(drafts) {
  const items = Array.isArray(drafts) ? drafts : [];

  return [...items]
    .map((draft, index) => normalizeContentDraftItem(draft, index))
    .sort((left, right) => {
      if (right.qualityScore !== left.qualityScore) {
        return right.qualityScore - left.qualityScore;
      }

      return left.id.localeCompare(right.id);
    })
    .map((draft, index) => ({
      ...draft,
      rank: index + 1,
    }));
}

/**
 * @param {object | null | undefined} output
 * @returns {object}
 */
export function normalizeContentGenerationOutput(output) {
  if (!output || typeof output !== "object") {
    return {
      schema: CONTENT_GENERATION_SCHEMA,
      generatedAt: new Date().toISOString(),
      generator: {
        provider: CONTENT_GENERATION_PROVIDER.MOCK,
        mode: "deterministic",
      },
      inputs: parseContentGenerationInputs(null),
      drafts: [],
    };
  }

  return {
    schema: output.schema ?? CONTENT_GENERATION_SCHEMA,
    generatedAt: output.generatedAt ?? new Date().toISOString(),
    generator: {
      provider: output.generator?.provider ?? CONTENT_GENERATION_PROVIDER.MOCK,
      mode: output.generator?.mode ?? "deterministic",
    },
    inputs: parseContentGenerationInputs(output.inputs),
    drafts: normalizeContentDrafts(output.drafts),
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateContentGenerationOutput(output) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!output || typeof output !== "object") {
    return {
      valid: false,
      errors: ["content generation output must be an object"],
      warnings: [],
    };
  }

  if (output.schema !== CONTENT_GENERATION_SCHEMA) {
    warnings.push(
      `content generation schema ${output.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!output.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!output.generator || typeof output.generator !== "object") {
    errors.push("generator is required");
  }

  if (!output.inputs || typeof output.inputs !== "object") {
    errors.push("inputs is required");
  }

  if (!Array.isArray(output.drafts)) {
    errors.push("drafts must be an array");
    return { valid: errors.length === 0, errors, warnings };
  }

  output.drafts.forEach((draft, index) => {
    if (!draft || typeof draft !== "object") {
      errors.push(`drafts[${index}] must be an object`);
      return;
    }

    for (const field of [
      "id",
      "sourceIdeaId",
      "sourceIdeaTitle",
      "title",
      "hook",
      "body",
      "callToAction",
      "tone",
      "format",
    ]) {
      if (typeof draft[field] !== "string") {
        errors.push(`drafts[${index}].${field} must be a string`);
      }
    }

    if (typeof draft.wordCount !== "number") {
      errors.push(`drafts[${index}].wordCount must be a number`);
    }

    if (typeof draft.qualityScore !== "number") {
      errors.push(`drafts[${index}].qualityScore must be a number`);
    }

    if (typeof draft.rank !== "number") {
      errors.push(`drafts[${index}].rank must be a number`);
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
export function extractContentGenerationPublicContract(output) {
  const normalized = normalizeContentGenerationOutput(output);
  let totalWordCount = 0;
  let topQualityScore = 0;

  for (const draft of normalized.drafts) {
    totalWordCount += draft.wordCount;
    if (draft.qualityScore > topQualityScore) {
      topQualityScore = draft.qualityScore;
    }
  }

  const averageWordCount =
    normalized.drafts.length > 0
      ? Math.round(totalWordCount / normalized.drafts.length)
      : 0;

  return {
    metadata: {
      schema: normalized.schema,
      generatedAt: normalized.generatedAt,
    },
    summary: {
      draftCount: normalized.drafts.length,
      averageWordCount,
      topQualityScore,
    },
    drafts: normalized.drafts.map((draft) => ({
      id: draft.id,
      sourceIdeaId: draft.sourceIdeaId,
      title: draft.title,
      hook: draft.hook,
      format: draft.format,
      wordCount: draft.wordCount,
      rank: draft.rank,
    })),
  };
}

/**
 * @param {object} output
 * @returns {string}
 */
export function buildContentGenerationMarkdown(output) {
  const normalized = normalizeContentGenerationOutput(output);
  const contract = extractContentGenerationPublicContract(normalized);

  const lines = [
    "# Content Generation",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Drafts | ${contract.summary.draftCount} |`,
    `| Average Word Count | ${contract.summary.averageWordCount} |`,
    `| Top Quality Score | ${contract.summary.topQualityScore} |`,
    "",
  ];

  for (const draft of contract.drafts) {
    const source = normalized.drafts.find((item) => item.id === draft.id);
    lines.push(`## ${draft.rank}. ${draft.title || draft.id}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| ID | ${draft.id} |`);
    lines.push(`| Source Idea ID | ${draft.sourceIdeaId} |`);
    lines.push(`| Format | ${draft.format} |`);
    lines.push(`| Word Count | ${draft.wordCount} |`);
    lines.push(`| Rank | ${draft.rank} |`);
    if (source?.hook) {
      lines.push(`| Hook | ${source.hook} |`);
    }
    if (source?.body) {
      lines.push("");
      lines.push("### Body");
      lines.push("");
      lines.push(source.body);
      lines.push("");
    }
    if (source?.callToAction) {
      lines.push(`_CTA: ${source.callToAction}_`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * @param {object} output
 * @returns {string}
 */
export function buildContentGenerationSummary(output) {
  const contract = extractContentGenerationPublicContract(output);

  return [
    "Content Generation Summary",
    `Drafts: ${contract.summary.draftCount}`,
    `Average Word Count: ${contract.summary.averageWordCount}`,
    `Top Quality Score: ${contract.summary.topQualityScore}`,
  ].join("\n");
}

/**
 * @param {object} output
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeContentGenerationArtifacts(output, rootDir = process.cwd()) {
  const normalized = normalizeContentGenerationOutput(output);
  const validation = validateContentGenerationOutput(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, CONTENT_GENERATION_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, CONTENT_GENERATION_JSON_FILENAME);
  const markdownPath = path.join(outputDir, CONTENT_GENERATION_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    generator: normalized.generator,
    inputs: normalized.inputs,
    drafts: normalized.drafts,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${buildContentGenerationMarkdown(normalized)}\n`,
  );

  return {
    json: `${CONTENT_GENERATION_OUTPUT_DIR}/${CONTENT_GENERATION_JSON_FILENAME}`,
    markdown: `${CONTENT_GENERATION_OUTPUT_DIR}/${CONTENT_GENERATION_MD_FILENAME}`,
  };
}

/**
 * @param {object | null} [rawInputs]
 * @param {object} [options]
 * @param {string | null} [options.aiIdeaPath]
 * @param {string} [options.provider]
 * @param {string} [options.generatedAt]
 * @param {string} [options.rootDir]
 * @returns {{ output: object, paths: { json: string, markdown: string } }}
 */
export function buildContentGenerationPipeline(rawInputs = null, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const aiIdeaContract = loadAIIdeaPublicContract(options.aiIdeaPath, rootDir);
  const inputs = parseContentGenerationInputs(rawInputs, aiIdeaContract);
  const provider = options.provider ?? CONTENT_GENERATION_PROVIDER.MOCK;
  const drafts = normalizeContentDrafts(
    generateContentDrafts(inputs.aiIdeaContract, inputs, { provider }),
  );
  const output = normalizeContentGenerationOutput({
    schema: CONTENT_GENERATION_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    generator: {
      provider,
      mode: "deterministic",
    },
    inputs,
    drafts,
  });
  const validation = validateContentGenerationOutput(output);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const paths = writeContentGenerationArtifacts(output, rootDir);

  return { output, paths };
}
