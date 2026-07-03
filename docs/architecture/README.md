# Architecture Documentation

AI-SNS-Automation の **Developer Automation** および Phase2 拡張に関するアーキテクチャドキュメントの入口です。

Architecture は目的ではなく、**AI-SNS-Automation を完成させるための手段** です。本ディレクトリは **Documentation MVP（v1.37.1）** として、最小限の公式ドキュメントを提供します。

---

## このディレクトリの目的

- レイヤー構造と依存方向を共有する
- Developer Automation Rules を明文化する
- ChatGPT / Claude Code の役割分担と開発フローを固定する
- ロードマップと完了条件を参照可能にする
- 実装判断の根拠を ADR とあわせて辿れるようにする

---

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [PRINCIPLES.md](./PRINCIPLES.md) | Developer Automation Rules |
| [LAYER_MODEL.md](./LAYER_MODEL.md) | レイヤー構造・責務・依存方向 |
| [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) | 設計〜実装〜リリースのフロー |
| [ROADMAP.md](./ROADMAP.md) | 優先順位と今後の拡張方針 |

---

## 推奨される読む順番

1. **PRINCIPLES.md** — 判断基準を把握する
2. **LAYER_MODEL.md** — レイヤーと Public Contract を理解する
3. **DEVELOPMENT_WORKFLOW.md** — 日常の設計・実装フローを確認する
4. **ROADMAP.md** — 次に何を作るかを確認する

---

## ADR との関係

Architecture Documentation は **方針と構造** を説明します。**個別の設計決定** は ADR（Architecture Decision Record）に記録します。

| 種別 | 場所 | 役割 |
|------|------|------|
| Architecture Docs | `docs/architecture/` | 原則・レイヤー・フロー・ロードマップ |
| ADR | `docs/adr/` | 特定バージョン・特定機能の設計判断 |

例: Analytics Layer と Dashboard Public Contract は [ADR-0007](../adr/ADR-0007-developer-analytics-layer-architecture.md) / [ADR-0008](../adr/ADR-0008-dashboard-public-contract.md) を参照してください。

---

## Documentation MVP について

v1.37.1 時点では以下は **意図的に含めていません**。

- MANIFESTO / DECISION_TREE / CONTRACT_POLICY / SCHEMA_POLICY
- TESTING_STRATEGY / VERSIONING / GLOSSARY

必要になったタイミングで段階的に拡張します。Architecture Handbook の過剰拡張は行いません。
