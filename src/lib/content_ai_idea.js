import fs from "node:fs";
import path from "node:path";

export const CONTENT_AI_IDEA_SCHEMA = "content-ai-ideas/1.0";
export const CONTENT_AI_IDEA_OUTPUT_DIR = "output/content-ideas";
export const CONTENT_AI_IDEA_JSON_FILENAME = "content-ai-ideas.json";
export const CONTENT_AI_IDEA_MD_FILENAME = "content-ai-ideas.md";

export const AI_IDEA_PROVIDER = {
  MOCK: "mock",
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
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitleKey(title) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {object} scores
 * @returns {number}
 */
export function computeFinalScore(scores) {
  const novelty = typeof scores?.novelty === "number" ? scores.novelty : 0;
  const relevance = typeof scores?.relevance === "number" ? scores.relevance : 0;
  const usefulness = typeof scores?.usefulness === "number" ? scores.usefulness : 0;
  const feasibility =
    typeof scores?.feasibility === "number" ? scores.feasibility : 0;

  return (
    Math.round(((novelty + relevance + usefulness + feasibility) / 4) * 1000) /
    1000
  );
}

/**
 * @param {string} seed
 * @param {number} index
 * @returns {{ novelty: number, relevance: number, usefulness: number, feasibility: number }}
 */
export function buildDeterministicScores(seed, index) {
  const hash = hashString(`${seed}:${index}`);

  return {
    novelty: 0.5 + (hash % 50) / 100,
    relevance: 0.5 + ((hash >> 8) % 50) / 100,
    usefulness: 0.5 + ((hash >> 16) % 50) / 100,
    feasibility: 0.5 + ((hash >> 24) % 50) / 100,
  };
}

/**
 * @param {unknown} rawInputs
 * @returns {{ topic: string, audience: string, count: number, seedIdeas: object[] }}
 */
export function parseAIIdeaInputs(rawInputs) {
  const defaults = {
    topic: "restaurant sns automation",
    audience: "restaurant owners",
    count: 5,
    seedIdeas: [],
  };

  if (!rawInputs || typeof rawInputs !== "object") {
    return defaults;
  }

  return {
    topic:
      typeof rawInputs.topic === "string" && rawInputs.topic.length > 0
        ? rawInputs.topic
        : defaults.topic,
    audience:
      typeof rawInputs.audience === "string" && rawInputs.audience.length > 0
        ? rawInputs.audience
        : defaults.audience,
    count:
      typeof rawInputs.count === "number" && rawInputs.count > 0
        ? Math.min(Math.floor(rawInputs.count), 20)
        : defaults.count,
    seedIdeas: Array.isArray(rawInputs.seedIdeas)
      ? rawInputs.seedIdeas.filter((item) => item && typeof item === "object")
      : defaults.seedIdeas,
  };
}

/**
 * @param {object} inputs
 * @param {number} index
 * @returns {object}
 */
function buildMockAIIdeaCandidate(inputs, index) {
  const seed = `${inputs.topic}|${inputs.audience}|${index}`;
  const templates = [
    `${inputs.topic} tips for ${inputs.audience}`,
    `Behind-the-scenes ${inputs.topic} story`,
    `Customer FAQ about ${inputs.topic}`,
    `Weekly ${inputs.topic} checklist`,
    `Seasonal ${inputs.topic} campaign`,
    `Staff spotlight for ${inputs.audience}`,
  ];
  const title = templates[index % templates.length];
  const scores = buildDeterministicScores(seed, index);

  return {
    id: `ai-idea-${String(index + 1).padStart(3, "0")}`,
    title,
    category: index % 2 === 0 ? "operations" : "marketing",
    rationale: `Mock AI candidate ${index + 1} for ${inputs.audience}.`,
    scores,
    finalScore: computeFinalScore(scores),
    tags: [inputs.topic.split(" ")[0] || "sns", "mock"],
  };
}

/**
 * @param {object} inputs
 * @returns {object[]}
 */
export function generateMockAIIdeas(inputs) {
  const parsed = parseAIIdeaInputs(inputs);
  /** @type {object[]} */
  const ideas = [];

  for (let index = 0; index < parsed.count; index += 1) {
    ideas.push(buildMockAIIdeaCandidate(parsed, index));
  }

  if (ideas.length > 0) {
    const duplicate = {
      ...ideas[0],
      id: `ai-idea-dup-${String(ideas.length + 1).padStart(3, "0")}`,
      title: `  ${ideas[0].title.toUpperCase()}  `,
      scores: {
        novelty: 0.4,
        relevance: 0.4,
        usefulness: 0.4,
        feasibility: 0.4,
      },
    };
    duplicate.finalScore = computeFinalScore(duplicate.scores);
    ideas.push(duplicate);
  }

  for (const seedIdea of parsed.seedIdeas) {
    if (typeof seedIdea.title !== "string" || seedIdea.title.length === 0) {
      continue;
    }

    const scores = buildDeterministicScores(`seed:${seedIdea.title}`, ideas.length);
    ideas.push({
      id: `ai-idea-seed-${String(ideas.length + 1).padStart(3, "0")}`,
      title: seedIdea.title,
      category:
        typeof seedIdea.category === "string" ? seedIdea.category : "general",
      rationale: `Derived from seed idea ${seedIdea.id ?? "unknown"}.`,
      scores,
      finalScore: computeFinalScore(scores),
      tags: Array.isArray(seedIdea.tags) ? [...seedIdea.tags] : [],
    });
  }

  return ideas;
}

/** @type {Record<string, (inputs: object) => object[]>} */
export const AI_IDEA_GENERATORS = {
  [AI_IDEA_PROVIDER.MOCK]: generateMockAIIdeas,
};

/**
 * @param {object} inputs
 * @param {object} [options]
 * @param {string} [options.provider]
 * @returns {object[]}
 */
export function generateAIIdeas(inputs, options = {}) {
  const provider = options.provider ?? AI_IDEA_PROVIDER.MOCK;
  const generator = AI_IDEA_GENERATORS[provider];

  if (!generator) {
    throw new Error(`unsupported AI idea provider: ${provider}`);
  }

  return generator(parseAIIdeaInputs(inputs));
}

/**
 * @param {object[]} ideas
 * @returns {object[]}
 */
export function deduplicateAIIdeas(ideas) {
  const items = Array.isArray(ideas) ? ideas : [];
  /** @type {Map<string, object>} */
  const byTitle = new Map();

  for (const idea of items) {
    const key = normalizeTitleKey(idea?.title ?? "");
    if (!key) {
      continue;
    }

    const existing = byTitle.get(key);
    if (!existing || (idea.finalScore ?? 0) > (existing.finalScore ?? 0)) {
      byTitle.set(key, {
        ...idea,
        title: idea.title.trim().replace(/\s+/g, " "),
      });
    }
  }

  return [...byTitle.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

/**
 * @param {object[]} ideas
 * @returns {object[]}
 */
export function rankAIIdeas(ideas) {
  const items = Array.isArray(ideas) ? ideas : [];

  return [...items]
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) {
        return right.finalScore - left.finalScore;
      }

      return left.id.localeCompare(right.id);
    })
    .map((idea, index) => ({
      ...idea,
      rank: index + 1,
    }));
}

/**
 * @param {unknown} idea
 * @param {number} index
 * @returns {object}
 */
export function normalizeAIIdeaItem(idea, index = 0) {
  if (!idea || typeof idea !== "object") {
    const scores = buildDeterministicScores("empty", index);

    return {
      id: `ai-idea-${String(index + 1).padStart(3, "0")}`,
      title: "",
      category: "general",
      rationale: "",
      scores,
      finalScore: computeFinalScore(scores),
      rank: index + 1,
      tags: [],
    };
  }

  const scores = {
    novelty: typeof idea.scores?.novelty === "number" ? idea.scores.novelty : 0,
    relevance:
      typeof idea.scores?.relevance === "number" ? idea.scores.relevance : 0,
    usefulness:
      typeof idea.scores?.usefulness === "number" ? idea.scores.usefulness : 0,
    feasibility:
      typeof idea.scores?.feasibility === "number" ? idea.scores.feasibility : 0,
  };

  return {
    id:
      typeof idea.id === "string" && idea.id.length > 0
        ? idea.id
        : `ai-idea-${String(index + 1).padStart(3, "0")}`,
    title: typeof idea.title === "string" ? idea.title.trim().replace(/\s+/g, " ") : "",
    category:
      typeof idea.category === "string" && idea.category.length > 0
        ? idea.category
        : "general",
    rationale: typeof idea.rationale === "string" ? idea.rationale : "",
    scores,
    finalScore:
      typeof idea.finalScore === "number"
        ? idea.finalScore
        : computeFinalScore(scores),
    rank: typeof idea.rank === "number" ? idea.rank : index + 1,
    tags: Array.isArray(idea.tags)
      ? idea.tags.filter((tag) => typeof tag === "string")
      : [],
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {object}
 */
export function normalizeAIIdeaOutput(output) {
  if (!output || typeof output !== "object") {
    return {
      schema: CONTENT_AI_IDEA_SCHEMA,
      generatedAt: new Date().toISOString(),
      generator: {
        provider: AI_IDEA_PROVIDER.MOCK,
        mode: "deterministic",
      },
      inputs: parseAIIdeaInputs(null),
      ideas: [],
    };
  }

  const ranked = rankAIIdeas(
    deduplicateAIIdeas(
      (Array.isArray(output.ideas) ? output.ideas : []).map((idea, index) =>
        normalizeAIIdeaItem(idea, index),
      ),
    ),
  );

  return {
    schema: output.schema ?? CONTENT_AI_IDEA_SCHEMA,
    generatedAt: output.generatedAt ?? new Date().toISOString(),
    generator: {
      provider: output.generator?.provider ?? AI_IDEA_PROVIDER.MOCK,
      mode: output.generator?.mode ?? "deterministic",
    },
    inputs: parseAIIdeaInputs(output.inputs),
    ideas: ranked.map((idea, index) => normalizeAIIdeaItem(idea, index)),
  };
}

/**
 * @param {object | null | undefined} output
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateAIIdeaOutput(output) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!output || typeof output !== "object") {
    return {
      valid: false,
      errors: ["AI idea output must be an object"],
      warnings: [],
    };
  }

  if (output.schema !== CONTENT_AI_IDEA_SCHEMA) {
    warnings.push(
      `AI idea schema ${output.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!output.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!output.generator || typeof output.generator !== "object") {
    errors.push("generator is required");
  } else if (typeof output.generator.provider !== "string") {
    errors.push("generator.provider must be a string");
  }

  if (!output.inputs || typeof output.inputs !== "object") {
    errors.push("inputs is required");
  }

  if (!Array.isArray(output.ideas)) {
    errors.push("ideas must be an array");
    return { valid: errors.length === 0, errors, warnings };
  }

  output.ideas.forEach((idea, index) => {
    if (!idea || typeof idea !== "object") {
      errors.push(`ideas[${index}] must be an object`);
      return;
    }

    for (const field of ["id", "title", "category"]) {
      if (typeof idea[field] !== "string") {
        errors.push(`ideas[${index}].${field} must be a string`);
      }
    }

    if (typeof idea.finalScore !== "number") {
      errors.push(`ideas[${index}].finalScore must be a number`);
    }

    if (typeof idea.rank !== "number") {
      errors.push(`ideas[${index}].rank must be a number`);
    }

    if (!idea.scores || typeof idea.scores !== "object") {
      errors.push(`ideas[${index}].scores is required`);
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
export function extractAIIdeaPublicContract(output) {
  const normalized = normalizeAIIdeaOutput(output);
  let totalScore = 0;
  let topFinalScore = 0;

  for (const idea of normalized.ideas) {
    totalScore += idea.finalScore;
    if (idea.finalScore > topFinalScore) {
      topFinalScore = idea.finalScore;
    }
  }

  const averageFinalScore =
    normalized.ideas.length > 0
      ? Math.round((totalScore / normalized.ideas.length) * 1000) / 1000
      : 0;

  return {
    metadata: {
      schema: normalized.schema,
      generatedAt: normalized.generatedAt,
    },
    summary: {
      ideaCount: normalized.ideas.length,
      averageFinalScore,
      topFinalScore,
    },
    ideas: normalized.ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      category: idea.category,
      finalScore: idea.finalScore,
      rank: idea.rank,
      tags: [...idea.tags],
    })),
  };
}

/**
 * @param {object} output
 * @returns {string}
 */
export function buildAIIdeaMarkdown(output) {
  const normalized = normalizeAIIdeaOutput(output);
  const contract = extractAIIdeaPublicContract(normalized);

  const lines = [
    "# AI Content Ideas",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Provider | ${normalized.generator.provider} |`,
    `| Topic | ${normalized.inputs.topic} |`,
    `| Audience | ${normalized.inputs.audience} |`,
    `| Ideas | ${contract.summary.ideaCount} |`,
    `| Top Score | ${contract.summary.topFinalScore} |`,
    `| Average Score | ${contract.summary.averageFinalScore} |`,
    "",
  ];

  contract.ideas.forEach((idea) => {
    const source = normalized.ideas.find((item) => item.id === idea.id);
    lines.push(`## ${idea.rank}. ${idea.title || idea.id}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| ID | ${idea.id} |`);
    lines.push(`| Category | ${idea.category} |`);
    lines.push(`| Final Score | ${idea.finalScore} |`);
    lines.push(`| Rank | ${idea.rank} |`);
    lines.push(`| Tags | ${idea.tags.length > 0 ? idea.tags.join(", ") : "none"} |`);
    if (source?.rationale) {
      lines.push(`| Rationale | ${source.rationale} |`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * @param {object} output
 * @returns {string}
 */
export function buildAIIdeaSummary(output) {
  const contract = extractAIIdeaPublicContract(output);
  const normalized = normalizeAIIdeaOutput(output);

  return [
    "AI Idea Summary",
    `Ideas: ${contract.summary.ideaCount}`,
    `Top Score: ${contract.summary.topFinalScore}`,
    `Average Score: ${contract.summary.averageFinalScore}`,
    `Provider: ${normalized.generator.provider}`,
  ].join("\n");
}

/**
 * @param {object} rawInputs
 * @param {object} [options]
 * @param {string} [options.provider]
 * @param {string} [options.generatedAt]
 * @param {string} [options.rootDir]
 * @returns {{ output: object, paths: { json: string, markdown: string } }}
 */
export function buildAIIdeaPipeline(rawInputs, options = {}) {
  const inputs = parseAIIdeaInputs(rawInputs);
  const provider = options.provider ?? AI_IDEA_PROVIDER.MOCK;
  const generated = generateAIIdeas(inputs, { provider });
  const deduped = deduplicateAIIdeas(generated);
  const ranked = rankAIIdeas(deduped);
  const output = normalizeAIIdeaOutput({
    schema: CONTENT_AI_IDEA_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    generator: {
      provider,
      mode: "deterministic",
    },
    inputs,
    ideas: ranked,
  });
  const validation = validateAIIdeaOutput(output);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const paths = writeAIIdeaArtifacts(output, options.rootDir ?? process.cwd());

  return { output, paths };
}

/**
 * @param {object} output
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeAIIdeaArtifacts(output, rootDir = process.cwd()) {
  const normalized = normalizeAIIdeaOutput(output);
  const validation = validateAIIdeaOutput(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, CONTENT_AI_IDEA_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, CONTENT_AI_IDEA_JSON_FILENAME);
  const markdownPath = path.join(outputDir, CONTENT_AI_IDEA_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    generator: normalized.generator,
    inputs: normalized.inputs,
    ideas: normalized.ideas,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${buildAIIdeaMarkdown(normalized)}\n`);

  return {
    json: `${CONTENT_AI_IDEA_OUTPUT_DIR}/${CONTENT_AI_IDEA_JSON_FILENAME}`,
    markdown: `${CONTENT_AI_IDEA_OUTPUT_DIR}/${CONTENT_AI_IDEA_MD_FILENAME}`,
  };
}
