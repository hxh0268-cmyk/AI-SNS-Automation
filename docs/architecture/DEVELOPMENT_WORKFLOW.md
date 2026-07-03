# Development Workflow

AI-SNS-Automation Phase2 Developer Automation の設計〜実装〜リリースフローです。

---

## 役割分担

### ChatGPT

| 領域 | 内容 |
|------|------|
| 設計 | 機能要件・レイヤー配置・Contract 境界 |
| Architecture Review | 原則・依存方向・Public Contract の整合 |
| ADR Review | ADR 草案の妥当性確認 |
| MVP Review | スコープ過多・非スコープの切り分け |
| Quality Review | テスト観点・後方互換・リスク確認 |
| Release Review | CHANGELOG / VERSION / 完了条件の確認 |
| Roadmap 策定 | 優先順位と次バージョン候補の整理 |

### Claude Code

| 領域 | 内容 |
|------|------|
| 実装 | `src/` / `scripts/` のコード変更 |
| テスト | Quality Pipeline / npm test |
| ドキュメント更新 | README / CHANGELOG / VERSION / architecture / ADR |
| Release 補助 | commit 文案・tag 名・push 手順（Human Approval 後） |

---

## 基本フロー

```text
Design
↓
Architecture Review
↓
Claude Code Implementation
↓
Quality Pipeline
↓
Release Review
```

1. **Design** — 仕様・Contract・非スコープを固定（Design Freeze 後は設計変更しない）
2. **Architecture Review** — [PRINCIPLES.md](./PRINCIPLES.md) / [LAYER_MODEL.md](./LAYER_MODEL.md) / ADR との整合
3. **Claude Code Implementation** — MVP 実装・テスト・ドキュメント
4. **Quality Pipeline** — `npm test` / `bash scripts/test_quality_pipeline.sh`
5. **Release Review** — バージョン・CHANGELOG・完了報告

---

## 実行フロー

本番相当の操作は **Dry-run → Human Approval → Apply** です。

```text
Dry-run
↓
Human Approval
↓
Apply
```

| 段階 | 内容 |
|------|------|
| **Dry-run** | Workflow / Pipeline を副作用最小で実行し、出力を確認 |
| **Human Approval** | 差分・テスト結果・リリース内容を人間が承認 |
| **Apply** | commit / tag / push / 本番 Apply 等を実行 |

Developer Workflow はデフォルト dry-run です。`--no-dry-run` は明示的な Apply 意図がある場合のみ使用します。

---

## ドキュメントのみリリース（例: v1.37.1）

Architecture Documentation Release のように **コード変更禁止** のフェーズでは次を守ります。

- `docs/architecture/` と README / CHANGELOG / VERSION のみ更新
- `src/` / `scripts/` / `package.json` / テストは変更しない
- Quality Pipeline のバージョン整合が必要な場合は、次のコードリリースでテストを更新

---

## 参照

- 原則: [PRINCIPLES.md](./PRINCIPLES.md)
- レイヤー: [LAYER_MODEL.md](./LAYER_MODEL.md)
- ロードマップ: [ROADMAP.md](./ROADMAP.md)
- ADR: `docs/adr/`
