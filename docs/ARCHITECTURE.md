# AI-SNS-Automation Architecture

## Purpose

AI-SNS-Automation automates SNS content operations from planning to review, while keeping final publishing under human control.

## Core Principle

Automate everything up to the final publishing step.

Actual SNS publishing must require explicit human approval.

## Human Approval Gate

AI-SNS-Automation must not publish SNS content automatically without human confirmation.

### Allowed

- Generate content ideas
- Generate carousel structures
- Generate slide copy
- Generate hashtags
- Generate image prompts
- Generate images
- Review generated assets
- Improve generated assets
- Prepare publishing candidates
- Prepare publishing previews
- Prepare scheduling candidates

### Forbidden

- Unconfirmed SNS publishing
- Automatic publish by schedule
- Background publish without review
- Publishing from dry-run mode
- Publishing from apply mode
- Treating generated content as approved by default

## Execution Modes

### dry-run

Simulation and preview only.

Must not modify production publishing state.

### apply

Generate files and reports.

May prepare publish-ready assets.

Must not publish.

### publish

Prepare or display publishing candidates.

Must not publish by itself.

### publish --confirm

The only mode allowed to perform actual SNS publishing.

This mode requires explicit human approval.

## Layer Structure

1. Developer Automation
2. Content Generation
3. Content Review
4. Publishing Preparation
5. Human Approval Gate
6. Publishing Execution
7. Analytics
8. Feedback Loop

## CLI Design Rules

Each major workflow should expose a clear CLI entry point under scripts/.

Examples:

- scripts/run_content_generation.js
- scripts/run_release.js
- scripts/run_dev_next.js

Reusable logic should live under src/lib/.

CLI files should stay thin.

Library files should be testable without executing the full CLI.

## Output Rules

Generated content should be written under output/.

Reports should be written under reports/.

The latest run should be written to latest/.

Historical or archived runs should be written to archive/ when needed.

## Report Rules

Every workflow should produce machine-readable JSON and human-readable Markdown when practical.

Required report properties should include:

- schema
- mode
- generatedAt
- outputs
- summary

## Dry-run and Mock Policy

New automation features should support dry-run first.

External APIs should not be required for initial verification.

Mock output is acceptable for MVP releases.

## Test Rules

Every release should add regression tests for new CLI behavior, output files, schemas, and safety rules.

Publishing-related tests must verify that no unconfirmed publishing can occur.

## Release Automation Direction

Developer automation should reduce manual copy-paste operations.

Future release commands should include:

- npm run dev:next
- npm run release
- npm run release -- --push

## Roadmap Priority

v1.26.0 focuses on Developer Automation Foundation.

After that, content generation will continue with:

- Carousel Structure Generation
- Slide Body Generation
- Hashtag Generation
- Image Prompt Generation
- Image Generation
- Publishing Preparation
- Analytics and Feedback Loop
