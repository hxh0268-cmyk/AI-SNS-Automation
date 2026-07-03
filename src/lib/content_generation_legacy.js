import fs from "fs";
import path from "path";

export const CONTENT_GENERATION_SCHEMA = "content-generation/1.0";
export const CONTENT_GENERATION_REPORT_SCHEMA = "content-generation-report/1.0";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readContentIdeasPrompt(rootDir = process.cwd()) {
  const promptPath = path.join(rootDir, "prompts", "content_ideas.md");

  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }

  return {
    path: "prompts/content_ideas.md",
    content: fs.readFileSync(promptPath, "utf8"),
  };
}

export function buildMockContentIdeas() {
  return [
    {
      id: "idea-001",
      audience: "AI活用を始めたい飲食店店長",
      painPoint: "ChatGPTを使いたいが、現場業務にどう使えばよいか分からない",
      format: "carousel",
      title: "飲食店店長が今日から使えるChatGPT活用5選",
      cta: "保存して、次のシフト前に1つ試してみてください。",
    },
    {
      id: "idea-002",
      audience: "SNS運用を効率化したい個人事業者",
      painPoint: "投稿ネタが続かず、毎回ゼロから考えてしまう",
      format: "carousel",
      title: "投稿ネタ切れを防ぐAIネタ出しテンプレート",
      cta: "この型をコピーして、次の投稿作りに使ってください。",
    },
    {
      id: "idea-003",
      audience: "副業でAIを使いたい初心者",
      painPoint: "AI副業に興味はあるが、怪しく見えない発信方法が分からない",
      format: "carousel",
      title: "怪しく見えないAI副業発信の作り方",
      cta: "まずはプロフィール文から整えてみましょう。",
    },
  ];
}

export function buildContentIdeasData({
  prompt,
  generatedAt = new Date().toISOString(),
}) {
  return {
    schema: CONTENT_GENERATION_SCHEMA,
    mode: "dry-run",
    generator: "mock",
    promptPath: prompt.path,
    promptCharacters: prompt.content.length,
    generatedAt,
    ideas: buildMockContentIdeas(),
  };
}

export function buildContentIdeasMarkdown(data) {
  const lines = [
    "# Content Ideas",
    "",
    `- Schema: ${data.schema}`,
    `- Mode: ${data.mode}`,
    `- Generator: ${data.generator}`,
    `- Generated at: ${data.generatedAt}`,
    "",
  ];

  data.ideas.forEach((idea, index) => {
    lines.push(`## ${index + 1}. ${idea.title}`);
    lines.push("");
    lines.push(`- ID: ${idea.id}`);
    lines.push(`- Audience: ${idea.audience}`);
    lines.push(`- Pain Point: ${idea.painPoint}`);
    lines.push(`- Format: ${idea.format}`);
    lines.push(`- CTA: ${idea.cta}`);
    lines.push("");
  });

  return lines.join("\n");
}

export function buildContentGenerationReport(data) {
  return {
    schema: CONTENT_GENERATION_REPORT_SCHEMA,
    contentSchema: data.schema,
    mode: data.mode,
    generator: data.generator,
    ideasGenerated: data.ideas.length,
    generatedAt: data.generatedAt,
    outputs: {
      markdown: "output/content-ideas/latest/content-ideas.md",
      json: "output/content-ideas/latest/content-ideas.json",
    },
  };
}

export function buildContentGenerationReportMarkdown(data) {
  return [
    "# Content Generation Report",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${data.schema} |`,
    `| Mode | ${data.mode} |`,
    `| Generator | ${data.generator} |`,
    `| Ideas generated | ${data.ideas.length} |`,
    `| Generated at | ${data.generatedAt} |`,
    "",
    "## Notes",
    "",
    "- This is a mock/dry-run content generation foundation.",
    "- No external API key is required.",
    "- Output is intended for the next Phase2 steps: carousel structure, slide body, and hashtag generation.",
    "",
  ].join("\n");
}

export function writeContentGenerationOutputs(data, rootDir = process.cwd()) {
  const outputDir = path.join(rootDir, "output", "content-ideas", "latest");
  const reportDir = path.join(rootDir, "reports", "content-generation", "latest");

  ensureDir(outputDir);
  ensureDir(reportDir);

  const report = buildContentGenerationReport(data);

  fs.writeFileSync(
    path.join(outputDir, "content-ideas.json"),
    `${JSON.stringify(data, null, 2)}\n`,
  );

  fs.writeFileSync(
    path.join(outputDir, "content-ideas.md"),
    `${buildContentIdeasMarkdown(data)}\n`,
  );

  fs.writeFileSync(
    path.join(reportDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  fs.writeFileSync(
    path.join(reportDir, "report.md"),
    buildContentGenerationReportMarkdown(data),
  );

  return {
    outputMarkdown: "output/content-ideas/latest/content-ideas.md",
    outputJson: "output/content-ideas/latest/content-ideas.json",
    reportMarkdown: "reports/content-generation/latest/report.md",
    reportJson: "reports/content-generation/latest/report.json",
  };
}
