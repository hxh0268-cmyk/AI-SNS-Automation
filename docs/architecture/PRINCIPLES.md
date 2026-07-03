# Developer Automation Principles

AI-SNS-Automation Phase2 Developer Automation で守る原則です。

---

## Dry-run First

本番相当の操作の前に **dry-run で結果を確認** します。Workflow・Release・Apply 系はデフォルト dry-run とし、意図しない副作用を防ぎます。

---

## Human Approval Gate

commit / tag / push / Apply など **不可逆または本番影響のある操作** は人間の承認後に実行します。自動化は支援に留め、最終判断は人間が行います。

---

## Official Docs First

実装・レビュー・リリース判断は **公式ドキュメント（README / CHANGELOG / VERSION / architecture / ADR）** を優先します。口頭・チャット内の一時的合意だけで設計を固定しません。

---

## MVP First

必要最小限の機能で **動く縦切り** を先に完成させます。過剰な抽象化・将来前提の実装は後回しにします。

---

## Claude Code First

実装・テスト・ドキュメント更新・Release 補助は **Claude Code** が担います。設計レビューと Architecture 判断は ChatGPT が担います（[DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) 参照）。

---

## Machine Readable First

状態・レポート・集計結果は **JSON 等の機械可読形式** を正とします。人間向け表示はそこから派生させます。

---

## JSON = Source

各レイヤーの **JSON が Source of Truth** です。Builder が生成した JSON を基準に View を作ります。

---

## Markdown = View

Markdown は **JSON から生成する View** です。Markdown だけを Source にせず、分析・集計の再実装も Markdown 側で行いません。

---

## CLI = Summary

CLI は **要約表示（Summary）** です。詳細データの唯一の保存場所にはしません。

---

## Pure Functions

Builder / Validator / 集計ロジックは **Pure Function** を優先します。入力から出力が決まり、副作用を最小化します。

---

## Side Effect Minimum

ファイル I/O・CLI 出力・Git 操作は **Reader / Writer / CLI 層** に分離し、Core ロジックに副作用を持ち込みません。

---

## Public Contract First

下位レイヤーから上位レイヤーへ渡すデータは **公開 Contract** で固定します。Internal フィールドへの依存は禁止します（Analytics → Dashboard Public Contract 等）。

---

## Backward Compatibility

schema・公開 Contract・既存レポートは **後方互換** を維持します。Optional Field の追加のみ許可し、Breaking Change は ADR とバージョン方針に従って行います。
