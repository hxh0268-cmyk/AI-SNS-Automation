# Roadmap

AI-SNS-Automation の優先順位と拡張方針です。Architecture Handbook は **必要になった時のみ** 拡張し、過剰な先行ドキュメント化は行いません。

---

## Priority 1 — Developer Automation Platform

Developer Workflow から Analytics までの縦切りを完成させ、運用可能な自動化基盤とします。

| レイヤー | 状態（v1.37.0 時点） |
|----------|----------------------|
| Workflow | ✅ |
| Workflow State | ✅ |
| Checkpoint | ✅ |
| History | ✅ |
| Timeline | ✅ |
| Dashboard | ✅ |
| Analytics | ✅ |
| Trend Analytics | 未実装 |
| Historical Analytics | 未実装 |
| Visualization | 未実装 |

### 残り（Priority 1 内）

- **Trend Analytics** — 時系列トレンド・傾向の集計
- **Historical Analytics** — 履歴横断の分析
- **Visualization** — 集計結果の可視化（Web UI / Charts は別 Foundation）

**Next Candidate:** v1.38.0 Trend Analytics Foundation

---

## Priority 2 — AI-SNS Automation

Instagram カルーセル自動生成から公開・改善までの本機能フェーズです。

- Idea Generation
- Content Generation
- Image Generation
- Publishing
- Analytics
- Continuous Improvement

Developer Automation Platform の安定後、Phase2 本機能の拡張と統合を進めます。

---

## Priority 3 — Architecture Assets

以下は **必要になった時のみ** 追加します。

- MANIFESTO
- DECISION_TREE
- CONTRACT_POLICY
- SCHEMA_POLICY
- TESTING_STRATEGY
- VERSIONING
- GLOSSARY

v1.37.1 Documentation MVP では [README.md](./README.md) / PRINCIPLES / LAYER_MODEL / DEVELOPMENT_WORKFLOW / ROADMAP のみを提供します。

---

## Developer Automation Platform Complete

**Completed when:**

- Workflow
- Workflow State
- Checkpoint
- History
- Timeline
- Dashboard
- Analytics
- Trend Analytics
- Historical Analytics
- Visualization

are all implemented.
