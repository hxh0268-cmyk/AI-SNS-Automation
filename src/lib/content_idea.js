export const CONTENT_IDEA_SCHEMA = "content-ideas/1.0";

export const CONTENT_IDEA_STATUS = {
  CANDIDATE: "candidate",
  ARCHIVED: "archived",
};

export const CONTENT_IDEA_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

/**
 * @returns {object[]}
 */
export function buildDefaultContentIdeas() {
  return [
    {
      id: "idea-001",
      title: "飲食店店長が今日から使えるChatGPT活用5選",
      category: "operations",
      status: CONTENT_IDEA_STATUS.CANDIDATE,
      priority: CONTENT_IDEA_PRIORITY.HIGH,
      tags: ["chatgpt", "restaurant"],
    },
    {
      id: "idea-002",
      title: "投稿ネタ切れを防ぐAIネタ出しテンプレート",
      category: "sns",
      status: CONTENT_IDEA_STATUS.CANDIDATE,
      priority: CONTENT_IDEA_PRIORITY.MEDIUM,
      tags: ["sns", "template"],
    },
    {
      id: "idea-003",
      title: "怪しく見えないAI副業発信の作り方",
      category: "side-business",
      status: CONTENT_IDEA_STATUS.ARCHIVED,
      priority: CONTENT_IDEA_PRIORITY.LOW,
      tags: ["side-business", "trust"],
    },
  ];
}

/**
 * @param {unknown} idea
 * @param {number} index
 * @returns {object}
 */
export function normalizeContentIdeaItem(idea, index = 0) {
  if (!idea || typeof idea !== "object") {
    return {
      id: `idea-${String(index + 1).padStart(3, "0")}`,
      title: "",
      category: "general",
      status: CONTENT_IDEA_STATUS.CANDIDATE,
      priority: CONTENT_IDEA_PRIORITY.MEDIUM,
      tags: [],
    };
  }

  const status =
    idea.status === CONTENT_IDEA_STATUS.ARCHIVED
      ? CONTENT_IDEA_STATUS.ARCHIVED
      : CONTENT_IDEA_STATUS.CANDIDATE;

  const priorityValues = Object.values(CONTENT_IDEA_PRIORITY);
  const priority = priorityValues.includes(idea.priority)
    ? idea.priority
    : CONTENT_IDEA_PRIORITY.MEDIUM;

  return {
    id:
      typeof idea.id === "string" && idea.id.length > 0
        ? idea.id
        : `idea-${String(index + 1).padStart(3, "0")}`,
    title: typeof idea.title === "string" ? idea.title : "",
    category:
      typeof idea.category === "string" && idea.category.length > 0
        ? idea.category
        : "general",
    status,
    priority,
    tags: Array.isArray(idea.tags)
      ? idea.tags.filter((tag) => typeof tag === "string")
      : [],
  };
}

/**
 * @param {unknown} ideas
 * @returns {object[]}
 */
export function normalizeAndSortContentIdeas(ideas) {
  const items = Array.isArray(ideas) ? ideas : [];

  return items
    .map((idea, index) => normalizeContentIdeaItem(idea, index))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * @param {unknown} rawInputs
 * @returns {{ ideas: object[] }}
 */
export function parseContentIdeaInputs(rawInputs) {
  if (rawInputs == null) {
    return { ideas: buildDefaultContentIdeas() };
  }

  if (Array.isArray(rawInputs)) {
    return { ideas: normalizeAndSortContentIdeas(rawInputs) };
  }

  if (typeof rawInputs === "object" && Array.isArray(rawInputs.ideas)) {
    return { ideas: normalizeAndSortContentIdeas(rawInputs.ideas) };
  }

  return { ideas: buildDefaultContentIdeas() };
}

/**
 * @param {object} inputs
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildContentIdeas(inputs, options = {}) {
  const parsed = parseContentIdeaInputs(inputs);

  return {
    schema: CONTENT_IDEA_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    ideas: parsed.ideas,
  };
}

/**
 * @param {object | null | undefined} contentIdeas
 * @returns {object}
 */
export function normalizeContentIdeas(contentIdeas) {
  if (!contentIdeas || typeof contentIdeas !== "object") {
    return buildContentIdeas({ ideas: [] }, {
      generatedAt: new Date().toISOString(),
    });
  }

  return {
    schema: contentIdeas.schema ?? CONTENT_IDEA_SCHEMA,
    generatedAt: contentIdeas.generatedAt ?? new Date().toISOString(),
    ideas: normalizeAndSortContentIdeas(contentIdeas.ideas),
  };
}

/**
 * @param {object | null | undefined} contentIdeas
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateContentIdeas(contentIdeas) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!contentIdeas || typeof contentIdeas !== "object") {
    return {
      valid: false,
      errors: ["content ideas must be an object"],
      warnings: [],
    };
  }

  if (contentIdeas.schema !== CONTENT_IDEA_SCHEMA) {
    warnings.push(
      `content ideas schema ${contentIdeas.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!contentIdeas.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!Array.isArray(contentIdeas.ideas)) {
    errors.push("ideas must be an array");
    return { valid: false, errors, warnings };
  }

  contentIdeas.ideas.forEach((idea, index) => {
    if (!idea || typeof idea !== "object") {
      errors.push(`ideas[${index}] must be an object`);
      return;
    }

    for (const field of ["id", "title", "category", "status", "priority"]) {
      if (typeof idea[field] !== "string" || idea[field].length === 0) {
        if (field === "title" && idea[field] === "") {
          warnings.push(`ideas[${index}].title is empty`);
          continue;
        }
        if (field !== "title") {
          errors.push(`ideas[${index}].${field} must be a non-empty string`);
        }
      }
    }

    if (
      idea.status !== CONTENT_IDEA_STATUS.CANDIDATE &&
      idea.status !== CONTENT_IDEA_STATUS.ARCHIVED
    ) {
      errors.push(`ideas[${index}].status must be candidate or archived`);
    }

    if (!Object.values(CONTENT_IDEA_PRIORITY).includes(idea.priority)) {
      errors.push(`ideas[${index}].priority must be low, medium, or high`);
    }

    if (!Array.isArray(idea.tags)) {
      errors.push(`ideas[${index}].tags must be an array`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object | null | undefined} contentIdeas
 * @returns {object}
 */
export function extractContentIdeaPublicContract(contentIdeas) {
  const normalized = normalizeContentIdeas(contentIdeas);
  /** @type {Set<string>} */
  const categories = new Set();

  for (const idea of normalized.ideas) {
    categories.add(idea.category);
  }

  let candidateCount = 0;
  let archivedCount = 0;

  for (const idea of normalized.ideas) {
    if (idea.status === CONTENT_IDEA_STATUS.ARCHIVED) {
      archivedCount += 1;
    } else {
      candidateCount += 1;
    }
  }

  return {
    metadata: {
      schema: normalized.schema,
      generatedAt: normalized.generatedAt,
    },
    summary: {
      ideaCount: normalized.ideas.length,
      categoryCount: categories.size,
      candidateCount,
      archivedCount,
    },
    ideas: normalized.ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      category: idea.category,
      status: idea.status,
      priority: idea.priority,
      tags: [...idea.tags],
    })),
  };
}

/**
 * @param {object} contentIdeas
 * @returns {string}
 */
export function renderContentIdeasMarkdown(contentIdeas) {
  const normalized = normalizeContentIdeas(contentIdeas);
  const contract = extractContentIdeaPublicContract(normalized);

  const lines = [
    "# Content Ideas",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Ideas | ${contract.summary.ideaCount} |`,
    `| Categories | ${contract.summary.categoryCount} |`,
    `| Candidates | ${contract.summary.candidateCount} |`,
    `| Archived | ${contract.summary.archivedCount} |`,
    "",
  ];

  contract.ideas.forEach((idea, index) => {
    lines.push(`## ${index + 1}. ${idea.title || idea.id}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| ID | ${idea.id} |`);
    lines.push(`| Category | ${idea.category} |`);
    lines.push(`| Status | ${idea.status} |`);
    lines.push(`| Priority | ${idea.priority} |`);
    lines.push(`| Tags | ${idea.tags.length > 0 ? idea.tags.join(", ") : "none"} |`);
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * @param {object} contentIdeas
 * @returns {string}
 */
export function buildContentIdeasSummary(contentIdeas) {
  const contract = extractContentIdeaPublicContract(contentIdeas);

  return [
    "Content Idea Summary",
    `Ideas: ${contract.summary.ideaCount}`,
    `Categories: ${contract.summary.categoryCount}`,
    `Candidates: ${contract.summary.candidateCount}`,
    `Archived: ${contract.summary.archivedCount}`,
  ].join("\n");
}
