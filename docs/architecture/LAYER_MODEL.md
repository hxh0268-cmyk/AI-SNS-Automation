# Layer Model

Developer Automation Platform の正式なレイヤー構造です。

---

## レイヤー構造

```text
Workflow
↓
Workflow State
↓
Checkpoint
↓
History
↓
Timeline
↓
Dashboard
↓
Analytics
```

各レイヤーは **一方向の依存** のみを持ちます。上位レイヤーは下位レイヤーの出力を入力としますが、下位レイヤーは上位を参照しません。

---

## 各レイヤーの責務

| レイヤー | 責務 | 主な出力例 |
|----------|------|------------|
| **Workflow** | 開発自動化ステップの実行 | workflow context / 実行結果 |
| **Workflow State** | STOPPED 等の再開可能状態の保存 | `workflow-state.json` |
| **Checkpoint** | state 位置・互換性・resume 安全性の検証 | `workflow-checkpoint.json` |
| **History** | 実行履歴の append-only 記録 | `workflow-history.json` |
| **Timeline** | History の時系列表示 Source | `workflow-timeline.json` |
| **Dashboard** | Timeline の集計・表示用データ | `workflow-dashboard.json` |
| **Analytics** | Dashboard Public Contract から KPI・Health | `workflow-analytics.json` |

---

## 依存方向

- **Workflow** は Git 操作や Release Automation を内包しない（Human Approval Gate 維持）
- **Timeline** は History のみを入力とする
- **Dashboard** は Timeline のみを入力とする
- **Analytics** は **Dashboard Public Contract のみ** を入力とする

### 禁止される直接依存（Analytics 以降を含む）

Analytics および将来の Analytics 派生レイヤーは、以下を **直接参照してはいけません**。

- Timeline
- History
- Checkpoint
- Workflow State
- Dashboard Internal（`runs` / `warnings` / `source` / 詳細 metrics 等）

---

## Public Contract First

レイヤー間のデータ受け渡しは **公開 Contract** で行います。

### Dashboard Public Contract（Analytics が利用可能）

| 区分 | 公開項目 |
|------|----------|
| metadata | `schema`, `generatedAt` |
| summary | `runCount`, `stepCount`, `totalDurationMs` |
| metrics | `successfulRuns`, `failedRuns`, `resumedRuns` |
| status | `workflowHealth` |

詳細は [ADR-0008](../adr/ADR-0008-dashboard-public-contract.md) を参照してください。

---

## Analytics の入力制約

Analytics Builder は次のみを行います。

1. Dashboard JSON から **Public Contract を抽出**
2. KPI（Success Rate / Failure Rate / Resume Rate / Average Duration）を算出
3. Health（healthy / warning / critical）と code を生成
4. Analytics JSON を出力

Analytics は Dashboard の代替データソースにならず、Timeline イベントの補正・再構築も行いません。

---

## 将来レイヤー

Trend Analytics / Historical Analytics / Visualization は、原則として **Timeline または Dashboard / Analytics** を入力とし、History / Checkpoint / Workflow State を直接参照しません（[ROADMAP.md](./ROADMAP.md) 参照）。
