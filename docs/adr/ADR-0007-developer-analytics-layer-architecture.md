# ADR-0007: Developer Analytics Layer Architecture

## Status

Accepted

## Context

Developer Automation は Workflow → State → Checkpoint → History → Timeline → Dashboard のレイヤー構造を持つ。Dashboard Foundation（v1.36.0）により Timeline 集計が確立された。次段階として KPI・Health・Recommendation Code を提供する Analytics Layer が必要。

## Decision

Analytics Layer を Dashboard のみを入力とする Pure Function 集計レイヤーとして実装する。

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

- Analytics Builder は Dashboard Public Contract のみ参照する
- Timeline / History / Checkpoint / Workflow State を直接参照しない
- Builder は Analytics JSON のみ生成する（Markdown / CLI は別責務）
- JSON Source / Markdown View / CLI Summary 原則を維持する
- Schema Evolution Rule: 公開 Contract 削除禁止 / Optional Field 追加のみ / 型変更禁止

## Consequences

- Analytics は Dashboard の代替データソースにならない
- 将来 Web Dashboard / Charts は Analytics または Dashboard を入力とできる
- Dashboard Internal（runs / warnings / source 等）への依存を禁止し、Contract 境界を固定する
