# Overview

AI-SNS-Automation の全体構造、完成済み Foundation、現在フェーズ、将来拡張の位置づけを定義する Architecture Governance 基準書です。

---

## 全体構造

```text
┌─────────────────────────────────────────────────────────────┐
│ Future Layer（Design Only — 未実装）                          │
│ Provider / Adapter / Runtime / Automation / Cloud            │
└───────────────────────────┬─────────────────────────────────┘
                            │ Public Contract Only
┌───────────────────────────▼─────────────────────────────────┐
│ Governance Layer（v1.48.0–v1.49.0）                          │
│ Public Contract Catalog / Architecture Documentation         │
└───────────────────────────┬─────────────────────────────────┘
                            │ documents & validates
┌───────────────────────────▼─────────────────────────────────┐
│ Application Layer（v1.41.0–v1.47.0 — Completed）             │
│ Idea → AI Idea → Content → Image → Publishing → Analytics → CI│
└───────────────────────────┬─────────────────────────────────┘
                            │ no dependency
┌───────────────────────────▼─────────────────────────────────┐
│ Platform Layer（v1.31.0–v1.40.0 — Completed, Maintenance）    │
│ Developer Automation Workflow / Dashboard / Analytics / Trend│
└─────────────────────────────────────────────────────────────┘
```

---

## Platform Layer

Developer Automation Platform は v1.40.0 Visualization Foundation で **Completed** となり、新 Foundation 追加は行いません。保守（bug fix / docs / non-breaking refactor）のみ許可されます。

| 代表 Foundation | Version | Public Contract |
|-----------------|---------|-----------------|
| Developer Dashboard | v1.36.0 | `extractDashboardPublicContract` |
| Trend Analytics | v1.38.0 | `extractTrendPublicContract` |
| Historical Analytics | v1.39.0 | `extractHistoricalPublicContract` |
| Visualization | v1.40.0 | Public Contract 整理 MVP |

Platform Layer は Application Layer に依存しません。Application Layer は Platform Layer の内部構造に依存しません。

---

## Application Layer

Application Layer は SNS コンテンツ生成パイプラインの Foundation 群です。v1.47.0 Continuous Improvement Foundation で **Completed** となりました。

| Foundation | Version | Upstream Public Contract |
|------------|---------|--------------------------|
| Idea Generation | v1.41.0 | none（root） |
| AI Idea Generation | v1.42.0 | none（root） |
| Content Generation | v1.43.0 | `extractAIIdeaPublicContract` |
| Image Generation | v1.44.0 | `extractContentGenerationPublicContract` |
| Publishing | v1.45.0 | `extractImageGenerationPublicContract` |
| Analytics | v1.46.0 | `extractPublishingPublicContract` |
| Continuous Improvement | v1.47.0 | `extractAnalyticsPublicContract` |

各 Foundation は **JSON = Source / Markdown = View / CLI = Summary** を遵守します。

---

## Future Layer

Future Layer は Provider / Adapter / Runtime / Automation / Cloud を含む将来拡張領域です。**v1.49.0 時点では設計のみ** であり、実装は禁止されます。詳細は [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) を参照してください。

Future Layer は Public Contract extract 関数のみを参照し、Foundation 内部実装には依存しません。

---

## Current Phase

| 項目 | 状態 |
|------|------|
| Latest Release | v1.48.0 Public Contract Catalog |
| Current Work | v1.49.0 Architecture Documentation Foundation |
| Platform Layer | Completed（保守のみ） |
| Application Layer | Completed |
| Governance Layer | Catalog（v1.48.0）+ Documentation（v1.49.0） |
| Future Layer | Design Only |

---

## Completed Foundations

### Platform Layer（Completed v1.40.0）

Workflow Guard → Handoff → Resume → Checkpoint → History → Timeline → Dashboard → Developer Analytics → Trend → Historical → Visualization

### Application Layer（Completed v1.47.0）

Idea Generation → AI Idea Generation → Content Generation → Image Generation → Publishing → Analytics → Continuous Improvement

### Governance Layer

- v1.48.0 Public Contract Catalog & Compatibility Foundation
- v1.49.0 Architecture Documentation Foundation（本 Governance 文書群）
