# ADR-0008: Dashboard Public Contract

## Status

Accepted

## Context

Analytics Layer は Dashboard JSON 全体ではなく、公開 Contract 定義済みフィールドのみを参照する必要がある。Dashboard Internal（runs / warnings / source / metrics.runs 詳細等）への直接参照は Analytics と Dashboard の結合度を高め、Breaking Change リスクを増大させる。

## Decision

Dashboard Public Contract を `extractDashboardPublicContract()` として公開する。

### 公開項目

**metadata**

- `schema`
- `generatedAt`

**summary**

- `runCount`
- `stepCount`
- `totalDurationMs`

**metrics**

- `successfulRuns`
- `failedRuns`
- `resumedRuns`

**status**

- `workflowHealth`（enum: `healthy` / `warning` / `critical`）

### 非公開（Internal）

- `source`
- `runs`
- `warnings`
- `metrics.runs` / `metrics.steps` / `metrics.duration` 詳細
- step-level `successCount` / `failedCount`

Analytics は `extractDashboardPublicContract()` 経由でのみ Dashboard を読む。

## Consequences

- Dashboard Internal の変更が Analytics に波及しにくくなる
- KPI 定義（Success Rate / Failure Rate / Resume Rate / Average Duration）は Contract 上の run-level 値に基づく
- Optional Field 追加のみ許可し、公開 Contract 削除・型変更は禁止
