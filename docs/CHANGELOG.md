# 変更履歴（CHANGELOG）

このファイルでは、AI-SNS-Automation のバージョンごとの変更内容を記録します。

---

## v1.28.0 — 機能追加（Release Plan Foundation）

Release 実行ではなく、**Release に必要な作業を機械的に計画・可視化する MVP** を追加しました。`release-readiness.json` を前提条件として読み取り、固定 step id と reason 付きの Release Plan を生成します。

### 変更内容

| 項目 | 内容 |
|------|------|
| Release Plan | `src/lib/release_plan.js` / `scripts/run_release_plan.js` |
| npm script | `npm run release:plan` |
| schema | `developer-automation/release-plan/1.0` |
| steps | git-commit / git-tag / git-push / github-release / publish |
| reason | Pending human approval / Out of MVP scope / Release readiness is not ready |
| JSON report | `release-plan.json` |
| Markdown report | `release-plan.md` |
| CLI | Summary 表示（Planned Steps + reason） |
| Release Readiness 連携 | `release-readiness.json` の status を Plan status に反映 |
| Test 125–135 | Release Plan 生成 / レポート / CLI / Readiness 連携 |

### 設計判断

- **MVP スコープ厳守** — git commit / tag / push / GitHub Release / Publish は未実装
- **Plan 生成と表示を分離** — `buildReleasePlan()` / `writeReleasePlanReport()` / `buildReleasePlanCliSummary()`
- **同一 Plan オブジェクト** — JSON / Markdown / CLI は `buildReleasePlan()` から生成
- **Release Readiness 前提** — readiness `not-ready` 時は required step の reason に反映

### 影響範囲

- Release Plan ライブラリ / CLI / テスト / ドキュメント

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **135 PASS**（Test 125–135 含む） |
| npm test | **PASS** |

---

## v1.27.0 — 機能追加（Release Readiness Foundation）

Release 自動実行ではなく、**Release 可能かどうかを自動判定する MVP** を追加しました。Working Tree / Version Consistency / 必須レポート / npm test の 4 チェックで `ready` / `not-ready` を返します。

### 変更内容

| 項目 | 内容 |
|------|------|
| Release Readiness | `src/lib/release_readiness.js` / `scripts/run_release_readiness.js` |
| npm script | `npm run release:readiness -- --skip-npm-test` |
| Working Tree | `checkWorkingTree()` — clean 判定 |
| Version Consistency | `checkVersionConsistency()` — v1.26.0 ロジック再利用 |
| Required Reports | `REQUIRED_REPORTS` 配列 — version-consistency.json / .md |
| npm test | `checkNpmTest()` — 成功判定（CLI は `--skip-npm-test` で再帰回避） |
| JSON report | `release-readiness.json` |
| Markdown report | `release-readiness.md` |
| CLI | Summary 表示（✔/✘ + `Status: READY` / `NOT READY`） |
| .gitignore | `output/content-ideas/` 追加 |
| Test 117–124 | Release Readiness 判定 / レポート / CLI |

### 設計判断

- **MVP スコープ厳守** — git commit / tag / push / GitHub Release は未実装
- **Version Consistency 重複なし** — `buildVersionConsistencyReport()` を再利用
- **同一判定オブジェクト** — JSON / Markdown / CLI は `evaluateReleaseReadiness()` から生成
- **npm test 再帰回避** — CLI に `--skip-npm-test` フラグ

### 影響範囲

- Release Readiness ライブラリ / CLI / テスト / ドキュメント / .gitignore

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **124 PASS**（Test 117–124 含む） |
| npm test | **PASS** |

---

## v1.26.0 — 機能追加（Developer Automation Foundation）

リリース前の状態確認基盤として **Developer Automation Foundation** を追加しました。Git Tag / VERSION.md / CHANGELOG.md の **3-way Version Consistency** を dry-run で検証できます。

### 変更内容

| 項目 | 内容 |
|------|------|
| Developer Automation | `src/lib/developer_automation.js` / `scripts/run_dev_next.js` |
| npm script | `npm run dev:next -- --dry-run` |
| Git Tag | `getLatestGitTag()` |
| VERSION.md | `getVersionFromVersionMd()` |
| CHANGELOG | `getChangelogLatestVersion()` |
| 3-way Consistency | 一致 → `ok` / 不一致 → `warning` |
| JSON report | `version-consistency.json` |
| Markdown report | `version-consistency.md` |
| CLI | `Version Check OK` / `Version Check WARNING` |
| Test 107–116 | dev:next + version consistency |

### 設計判断

- **Dry-run First** — git commit / tag / push は v1.27.0 以降
- **Human Approval Gate** — 自動 publish / release なし
- **API キー不要** — git / docs 読み取りのみ

### 影響範囲

- Developer Automation ライブラリ / CLI / テスト / ドキュメント

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **116 PASS**（Test 112–116 含む） |
| npm test | **PASS** |

---

## v1.24.0 — 保守更新（GitHub Actions Node24 Production Readiness）

本番 workflow を **Node24-ready**（`checkout@v5` / `setup-node@v5` / `upload-artifact@v6`）に更新し、GitHub Actions 基盤を安定版として一区切りしました。

### 変更内容

| 項目 | 内容 |
|------|------|
| 本番 workflow | `quality-pipeline-ci.yml` / `nightly-apply.yml` / `performance-trend.yml` |
| Actions | checkout@v5 / setup-node@v5 / upload-artifact@v6 |
| setup-node cache | `cache: npm` / `cache-dependency-path: package-lock.json` 維持 |
| upload-artifact@v7 | **見送り** |
| Experimental | **非変更** |
| schema / permissions / workflow_run | **既存維持** |
| Test 94–98 | Node24 production / docs / experimental unchanged / VERSION |

### 設計判断

- **安定性最優先** — v1.23.0 experimental 実績を踏まえ本番適用
- **upload-artifact@v6** — Node24 runtime、v7 は今回未採用
- **FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 未使用**

### 影響範囲

- 本番 workflow 3 ファイル + ドキュメント / テスト

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **98 PASS**（Test 94–98 含む） |
| npm test | **PASS** |

---

## v1.23.0 — 保守更新（Node24 Migration Readiness）

GitHub Actions **Node.js 24 Migration Readiness** として、experimental workflow のみ `upload-artifact@v6` を先行適用しました。本番 workflow は変更しません。

### 変更内容

| 項目 | 内容 |
|------|------|
| experimental | `upload-artifact@v5` → **`@v6`**（Node24 runtime） |
| 本番 workflow | **非変更**（`upload-artifact@v7` 維持） |
| FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 | **未使用** |
| runner 要件 | v2.327.1 以上（ドキュメント化） |
| schema | **1.2 維持** |
| Test 89–93 | v6 experimental / 本番非変更 / Node24 docs / VERSION |

### 設計判断

- **experimental のみ更新** — 最小リスクで Node24 Actions を検証
- **本番は安定性優先** — CI / Nightly / performance-trend.yml は現行維持
- **checkout / setup-node** — v1.24.0 以降で評価

### 影響範囲

- experimental workflow + ドキュメント / テスト

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **93 PASS**（Test 89–93 含む） |
| npm test | **PASS** |

---

## v1.22.0 — 保守更新（Performance Trend Experimental Workflow）

`workflow_run` を本番導入せず、**手動 opt-in の experimental workflow** で Performance Trend を安全に評価できる基盤を追加しました。

### 変更内容

| 項目 | 内容 |
|------|------|
| 新規 workflow | `.github/workflows/performance-trend-experimental.yml` |
| 本番 workflow | `performance-trend.yml` **非変更** |
| トリガー | `workflow_dispatch` のみ |
| workflow_run | **未使用** |
| inputs | `source_run_id` / `source_conclusion` |
| env | `SOURCE_WORKFLOW_*` / `PERFORMANCE_TREND_EXPERIMENTAL=true` |
| cache / secrets | **不使用** |
| artifact | `performance-trend-experimental-<run_id>`（7 日 retention） |
| schema | **1.2 維持**（`gha_analyze_performance_trend.js` 非変更） |
| Test 80–88 | experimental workflow contract |

### 設計判断

- **workflow_run 本番未導入** — privilege escalation / cache poisoning リスク継続
- **experimental は手動のみ** — disabled-by-default 相当（自動連鎖なし）
- **cache 無効** — experimental workflow では setup-node cache を使わない

### 影響範囲

- 新規 experimental workflow + ドキュメント / テスト
- 本番 trend workflow / 解析スクリプトは非変更

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **88 PASS**（Test 80–88 含む） |
| npm test | **PASS** |

---

## v1.21.0 — 保守更新（workflow_run Opt-in Design Review）

Performance Trend Analysis に **`workflow_run` opt-in 設計レビュー** を追加しました。本番 workflow への `workflow_run` 導入は行わず、セキュリティ方針と将来 experimental 導入条件を明文化します。

### 変更内容

| 項目 | 内容 |
|------|------|
| workflow_run design review | README に opt-in / security policy を追加 |
| workflow_run 本番導入 | **保留**（`performance-trend.yml` 非変更） |
| schedule / workflow_dispatch | **継続** |
| schema | **1.2 維持** |
| security policy | artifact 隔離 / cache 非信頼 / 最小 permissions / read-only API |
| Test 75–79 | workflow_run 非存在 / schedule / dispatch / README 設計レビュー |

### 設計判断

- **workflow_run 本番未導入** — privilege escalation / cache poisoning リスク
- **schedule 実績確認後に再検討** — v1.22.0 experimental prototype 候補
- **既存挙動変更なし** — workflow YAML / trend 解析ロジック非変更

### 影響範囲

- ドキュメント / テストのみ

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **79 PASS**（Test 75–79 含む） |
| npm test | **PASS** |

---

## v1.20.0 — 保守更新（Scheduled Performance Trend Collection）

Performance Trend Analysis workflow に **週1回の低頻度 schedule** と **concurrency 保護** を追加しました。`workflow_dispatch` 手動実行は維持し、`workflow_run` はセキュリティ上の理由で保留します。

### 変更内容

| 項目 | 内容 |
|------|------|
| schedule | `23 20 * * 1`（月曜 20:23 UTC = 火曜 05:23 JST） |
| workflow_dispatch | **維持** |
| concurrency | `performance-trend-${{ github.workflow }}` |
| workflow_run | **未導入**（設計候補として保留） |
| permissions | `contents: read` / `actions: read` 維持 |
| Test 70–74 | schedule / dispatch / cron / concurrency / no workflow_run |

### 設計判断

- **毎時 `:00` を避ける** — schedule 混雑による遅延・drop 対策
- **workflow_run 保留** — privilege escalation / cache poisoning リスク
- **schema 1.2 維持** — `collection.trigger` に `schedule` が入る

### 影響範囲

- `.github/workflows/performance-trend.yml` のみ（既存 CI/Nightly workflow 非変更）
- ドキュメント / テスト

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **74 PASS**（Test 70–74 含む） |
| npm test | **PASS** |

---

## v1.19.0 — 保守更新（GitHub Actions Automated Performance Trend Collection）

GitHub Actions 上で Performance Trend Analysis を **workflow_dispatch** 実行できる最小基盤を追加しました。既存のローカル gh CLI / fixture 解析は維持します。

### 変更内容

| 項目 | 内容 |
|------|------|
| 新規 workflow | `.github/workflows/performance-trend.yml` |
| 既存 workflow | **変更なし** |
| 認証 | `GH_TOKEN: ${{ github.token }}` |
| permissions | `contents: read` / `actions: read` |
| schema 1.2 | `collection.mode` / `trigger` / `workflowRunId` / `sourceWorkflow` / `collectedAt` |
| Step Summary | Performance Trend Analysis 概要 |
| Test 65–69 | GHA env / GH_TOKEN / fixture / schema / Step Summary |

### 設計判断

- **schedule / workflow_run 未実装** — v1.20.0 以降候補
- **schema 1.1 互換維持** — ローカル解析は 1.1、GHA 実行は 1.2
- **最小権限** — actions read のみ追加

### 影響範囲

- 新規 workflow + `gha_analyze_performance_trend.js` 最小拡張
- ドキュメント / テスト

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **69 PASS**（Test 65–69 含む） |
| npm test | **PASS** |

---

## v1.18.0 — 保守更新（Artifact Metadata / Retention Awareness）

Performance Trend Analysis に **GitHub Actions artifact metadata / retention awareness** を追加しました。`gh api --paginate` で `expires_at` / `expired` / `digest` 等を取得し、trend レポートに反映します。

### 変更内容

| 項目 | 内容 |
|------|------|
| artifact metadata | `gh api repos/{owner}/{repo}/actions/runs/{run_id}/artifacts --paginate` |
| retention | `expired: true` → skip / `expires_at` 欠落 → metadata warning |
| trend 出力 | Artifact Metadata セクション / `metadataWarnings` / `recentRuns[].artifact` |
| 既存互換 | `gh run download` / fixture モード維持 |
| Test 61–64 | metadata 正常 / expired skip / expires_at 欠落 / pagination |

### 設計判断

- **Workflow YAML 変更なし**
- **metadata 取得失敗** — warning、可能な限り trend 継続
- **GitHub Actions 上完全自動 Trend** — v1.19.0 以降候補
- **REST API 直接実装** — gh api 経由（private repo は Actions read 必要）

### 影響範囲

- `scripts/gha_analyze_performance_trend.js` 拡張
- ドキュメント / テスト

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **64 PASS**（Test 61–64 含む） |
| npm test | **PASS** |

---

## v1.17.0 — 保守更新（gh CLI Performance Trend Analysis）

v1.16.0 の `performance-observation.json` を **gh CLI** でローカル収集・集計する `scripts/gha_analyze_performance_trend.js` を追加しました。REST API 自動集計は v1.18.0 以降に回します。

### 変更内容

| 項目 | 内容 |
|------|------|
| 分析スクリプト | `scripts/gha_analyze_performance_trend.js` |
| 出力 | `trend-report.md` / `trend-data.json` |
| gh CLI | `gh auth status` / `gh run list` / `gh run download` |
| fixture モード | `--fixture-dir`（テスト用、gh 実通信なし） |
| Test 57–60 | trend 生成 / skip / report / contract |

### 設計判断

- **Workflow YAML 変更なし**
- **REST API 未使用** — v1.18.0 以降候補
- **欠落 observation** — warning + skip
- **0 件 valid** — エラー終了

### 影響範囲

- 新規スクリプト + ドキュメント + テスト
- `reports/performance-trend/latest/`（Git 管理外 — `reports/` で ignore 済み）

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **60 PASS**（Test 57–60 含む） |
| npm test | **PASS** |

---

## v1.16.0 — 保守更新（Workflow Performance Trend Analysis Foundation）

v1.15.0 の Performance / Cache Observation 情報を **machine-readable JSON artifact** として保存する基盤を追加しました。Summary Markdown 表示は維持し、大規模な gh CLI / REST API 集計は v1.17.0 以降に回します。

### 変更内容

| 項目 | 内容 |
|------|------|
| Artifact JSON | `reports/quality-pipeline/latest/performance-observation.json` |
| 生成 | `Write workflow summary`（`if: always()`）内で `scripts/gha_write_performance_observation.js` |
| CI artifact | upload を **`if: always()`** に変更 — 失敗 run でも JSON 確認可能 |
| Nightly artifact | `path:` に `performance-observation.json` を追加 |
| Test 56 | JSON contract テスト追加 |

### 設計判断

- **Summary 維持** — v1.15.0 Markdown 表示は変更なし
- **pipelineExitCode** — JSON では `number \| null`（`"n/a"` 文字列は使わない）
- **packageLockHash** — 生 SHA-256（`sha256:` プレフィックスなし、Summary と一致）
- **手動比較** — v1.16.0 では artifact DL + JSON 比較のみ
- **gh CLI / REST API 自動集計** — v1.17.0 以降候補

### 影響範囲

- `.github/workflows/quality-pipeline-ci.yml`
- `.github/workflows/nightly-apply.yml`
- `scripts/gha_write_performance_observation.js`（新規）
- ドキュメント / テスト

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **56 PASS**（Test 56 含む） |
| npm test | **PASS** |

---

## v1.15.0 — 保守更新（GitHub Actions CI Performance Observation Summary）

v1.14.0 の Step Summary を拡張し、**Performance / Cache Observation** セクションを両 workflow に追加しました。cache 制御そのものは変更せず、Summary 上での可観測性向上に集中しています。

### 変更内容

| 項目 | 内容 |
|------|------|
| Performance / Cache Observation | Node / npm version、npm cache enabled、cache-dependency-path、package-lock hash |
| npm ci duration | Step timings と連携して Summary にハイライト表示 |
| Nightly Apply | apply duration、job result、pipeline exit code、quality status を Performance セクションに整理 |
| README | Summary 確認項目、cache 効果の読み方、Dependabot 後の npm ci 遅延を追記 |
| Test 55 | Performance / Cache Observation 契約テスト追加 |

### 設計判断

- **setup-node cache 維持** — `actions/cache` への全面移行はしない
- **cache-hit 厳密取得は未実装** — `npm ci duration` + `package-lock hash` の run 間比較で間接確認
- **gh CLI / REST API 履歴分析は未実装** — 将来 v1.16.0 以降候補
- **Workflow 成否 / exit code ロジックは変更なし**

### 影響範囲

- `.github/workflows/quality-pipeline-ci.yml` — Summary 拡張のみ
- `.github/workflows/nightly-apply.yml` — Summary 拡張のみ
- ドキュメント / テスト

### テスト内容

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **55 PASS**（Test 55 含む） |
| npm test | **PASS** |
| YAML Validation | **PASS** |

---

## v1.14.0 — 保守更新（GitHub Actions CI 可観測性向上）

両 workflow に **GitHub Actions Step Summary** を追加し、主要ステップの実行時間を Markdown テーブルで可視化しました。Workflow 成否判定・exit code 方針は変更していません。

### 修正内容

| 項目 | 内容 |
|------|------|
| Step Summary | `GITHUB_STEP_SUMMARY` に Run Summary / Step timings テーブルを出力 |
| 失敗時 | Summary ステップ `if: always()` — 失敗後も Summary 残存 |
| 実行時間 | `npm ci` / `npm test` / quality pipeline dry-run・apply を簡易計測 |
| README | Summary 確認方法、実行時間の見方、cache 効果の位置づけを追記 |

### 変更なし（意図的）

- Workflow 成否判定 / exit code 0・3・1・4 方針
- `setup-node@v6` + `cache: npm` + `cache-dependency-path: package-lock.json`
- `npm ci` / テスト・apply の処理内容
- cache-hit 厳密取得（将来 v1.15.0 以降候補）
- `actions/cache` / `node_modules` キャッシュ

---

## v1.13.0 — 保守更新（GitHub Actions npm cache 最適化）

GitHub 公式仕様に基づき、`actions/setup-node@v6` の **npm cache** を両 workflow で明示的に最適化しました。`npm ci` およびテスト / apply の挙動は変更していません。

### 修正内容

| 項目 | 内容 |
|------|------|
| setup-node | `cache: npm` + `cache-dependency-path: package-lock.json` |
| 対象 workflow | `.github/workflows/quality-pipeline-ci.yml` / `.github/workflows/nightly-apply.yml` |
| README | npm cache 運用（cache key、Dependabot 初回 miss、破損時の削除手順）を追記 |

### 変更なし（意図的）

- `node-version: "20"` / `npm ci` / テスト・apply ステップ
- `actions/cache` 直接利用なし
- `node_modules` キャッシュなし
- `.github/dependabot.yml`

---

## v1.12.1 — 運用品質パッチ（Dependabot 運用ドキュメント強化）

v1.12.0 で導入した Dependabot 設定（`.github/dependabot.yml`）は変更せず、GitHub 公式仕様に基づく **運用ドキュメント** を README / VERSION に強化しました。

### 修正内容

| 項目 | 内容 |
|------|------|
| README | Dependabot PR と CI の関係、secrets / GITHUB_TOKEN 制約、CI 失敗時の確認順を追記 |
| 設定変更 | **なし**（`.github/dependabot.yml` は v1.12.0 のまま） |
| 将来導入候補 | Grouped Updates / ignore / reviewers / assignees / Auto Merge / Dependabot secrets を整理 |

### 変更なし（意図的）

- `.github/dependabot.yml`
- Auto Merge / Grouped Updates / reviewers / assignees / ignore / Dependabot secrets
- Quality Pipeline の実行ロジック・CI workflow

---

## v1.11.0 — 保守更新（upload-artifact Node.js 24 対応）

GitHub Actions の **Node.js 20 runtime warning** を完全解消するため、`actions/upload-artifact` を Node.js 24 対応版に更新しました。Quality Pipeline の挙動・終了コード・Nightly Apply・Step Summary の仕様は変更していません。

### 修正内容

| 項目 | 内容 |
|------|------|
| actions/upload-artifact | `v4` → `v7`（Node.js 24 対応） |
| 対象 workflow | `.github/workflows/quality-pipeline-ci.yml` / `.github/workflows/nightly-apply.yml` |
| with オプション | 既存のまま維持 |
| README | Node.js 20 Warning 解消方針を追記 |

### 変更なし（意図的）

- `actions/checkout@v5` / `actions/setup-node@v6`
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`（導入しない）
- Quality Pipeline の実行ロジック
- exit code 0 / 1 / 3 / 4 の意味
- Nightly Apply の Workflow Success / Failure 判定
- Node.js 実行バージョン（`node-version: "20"`）

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **53 PASS**（実装後 `bash scripts/test_quality_pipeline.sh` で確認） |
| YAML Validation | **PASS** |

---

## v1.10.0 — 保守更新（GitHub Actions runtime maintenance）

GitHub Actions の保守性向上のため、workflow 内で使用している Actions を更新しました。Node.js 20 runtime warning への対応を目的とした保守リリースで、Quality Pipeline の挙動・終了コード・Nightly Apply・Step Summary の仕様は変更していません。

### 修正内容

| 項目 | 内容 |
|------|------|
| actions/checkout | `v4` → `v5` |
| actions/setup-node | `v4` → `v6` |
| actions/upload-artifact | `v4` 維持 |
| 対象 workflow | `.github/workflows/quality-pipeline-ci.yml` / `.github/workflows/nightly-apply.yml` |
| README | 利用 Actions バージョンと保守更新内容を追記 |

### 変更なし（意図的）

- Quality Pipeline の実行ロジック
- exit code 0 / 1 / 3 / 4 の意味
- Nightly Apply の Workflow Success / Failure 判定
- GitHub Step Summary の表示仕様
- Node.js 実行バージョン（`node-version: "20"`）

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **53 PASS**（実装後 `bash scripts/test_quality_pipeline.sh` で確認） |


## v1.9.4 — 運用品質パッチ（Workflow 成否と品質判定の分離）

GitHub Actions の **Workflow 成否** と Quality Pipeline の **品質判定** を分離しました。終了コード **3**（品質改善推奨 / `publishRecommended=false`）はシステムエラーではないため、Nightly Apply では **Workflow Success** 扱いに変更しています。

### 修正内容

| 項目 | 内容 |
|------|------|
| Nightly Apply | 終了コード 0 / 3 → Workflow Success、1 / 4 / その他 → Failure |
| Summary | 終了コード 3 時に Improvement Recommended / `publishRecommended=false` を明示 |
| exit code 3 | 意味は変更なし（品質改善推奨）— GHA 側の解釈のみ変更 |
| テスト | Test 51–53 追加 |

### 変更なし（意図的）

- v1.8.2 Secrets OR 条件
- Health Check Error（exit 1）/ 内部エラー（exit 4）は Failure 維持
- pipeline 本体の exit code 3 判定ロジック

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **53 PASS**（実装後 `npm test` で確認） |

---

## v1.9.3 — 運用品質パッチ（Pipeline 成功判定整合）

Quality Pipeline が **全スライド公開推奨（ALL_SLIDES_PUBLISH_RECOMMENDED）** など成功条件を満たしているにもかかわらず、`status: failed` / `failed steps: 1` / **exit code 4** で終了する不整合を修正しました。

### 修正内容

| 項目 | 内容 |
|------|------|
| 成功判定 | `isPipelineSuccessfulOutcome()` を追加（score / stopReason / lastRound / failedCalls） |
| state 確定 | 成功時 `finalizeSuccessfulPipelineState()` で `completed` / `COMPLETE` / `failedSteps` クリア |
| exit code | 成功条件優先で **0**、`failedSteps` 残存時 **4** |
| Summary | 成功時 `outcome: success` を表示 |
| テスト | Test 48–50 追加 |

### 変更なし（意図的）

- v1.8.2 Secrets OR 条件
- v1.9.x Health Check 仕様
- Nightly Apply workflow 構造

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **50 PASS**（実装後 `npm test` で確認） |

---

## v1.9.2 — 運用品質パッチ（GitHub Actions Health Check）

GitHub Actions 環境では `.env` ファイルを必須にせず、Repository Secrets から `process.env` に注入された API キーで Health Check を通過できるようにしました。

### 修正内容

| 項目 | 内容 |
|------|------|
| `.env` | ローカル: 従来どおり未作成時 Error / GHA: `GITHUB_ACTIONS=true` 時は Error にしない |
| API キー | `OPENAI_API_KEY` 必須、`GEMINI_API_KEY` または `NANO_BANANA_API_KEY` いずれか必須（v1.8.2 OR 条件） |
| `NANO_BANANA_API_KEY` | Health Check 項目として追加 |
| テスト | Test 45–47 追加 |

### 変更なし（意図的）

- Nightly Apply Secrets OR 条件（workflow 側）
- Health Check JSON / failure summary 仕様

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **47 PASS**（実装後 `npm test` で確認） |

---

## v1.9.1 — 運用品質パッチ（Nightly Apply YAML 修正）

v1.9.0 で追加した Nightly Apply failure summary 内の `node <<'NODE'` heredoc が **YAML ブロック外に漏れ**、GitHub Actions が workflow file invalid で 0 秒終了する問題を修正しました。

### 修正内容

| 項目 | 内容 |
|------|------|
| heredoc インデント | `Create failure summary` ステップ内の Node.js heredoc 全行を `run: \|` ブロック内に正しくインデント |
| YAML 検証 | workflow が valid YAML として読み込まれることを確認 |
| テスト | Test 44 拡張（heredoc インデント検出 + Ruby YAML parse） |

### 変更なし（意図的）

- v1.8.2 Secrets OR 条件
- v1.9.0 Health Check Errors 出力仕様
- workflow_dispatch / schedule / main guard / artifacts

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **44 PASS**（実装後 `npm test` で確認） |

---

## v1.9.0 — Health Check エラー可視化

Nightly Apply で Quality Pipeline が **HEALTH_CHECK** で失敗した際、これまで「Health Check failed: Error N 件」のみだった表示を、**個別エラー項目**まで確認できるようにしました。

### 追加・変更内容

| 項目 | 内容 |
|------|------|
| `health_check.js` | `items[]` 構造化蓄積、`--json` / `HEALTH_CHECK_JSON=1` で JSON 出力（human-readable 出力は維持） |
| `pipeline_phase_handlers.js` | JSON パース + regex fallback、`healthCheck.errors` を metrics に保存、失敗時ログ出力 |
| `run_quality_pipeline.js` | Summary に `health check errors:` 一覧を表示 |
| `nightly-apply.yml` | failure summary が `metrics.json` から **Health Check Errors** を列挙 |
| テスト | Test 40–44 追加（JSON 契約・metrics 契約・Secret 非露出・workflow 契約） |

### セキュリティ

- API キー・Secret **値**は JSON / ログ / artifact に出力しない（label / detail のみ）

### 変更なし（意図的）

- v1.8.2 Secrets OR 条件 / main branch guard / schedule / artifacts
- `.env` 不在を Warning に降格（別 issue）
- `--skip-health-check` / `doctor.js` 共通化

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **44 PASS**（実装後 `npm test` で確認） |

---

## v1.8.2 — 運用品質パッチ（Nightly Apply Secrets OR 条件）

Nightly Apply Workflow の Secrets Check を **アプリケーション本体の仕様** に合わせました。nano_banana adapter は `NANO_BANANA_API_KEY` **または** `GEMINI_API_KEY` のどちらかで動作するため、両キーを単独必須にしません。

### 修正内容

| 項目 | 内容 |
|------|------|
| 必須 Secrets | `OPENAI_API_KEY` のみ単独必須 |
| OR 条件 | `GEMINI_API_KEY` / `NANO_BANANA_API_KEY` は **どちらか一方** があれば OK |
| apply env | 3 キーすべて注入（v1.8.1 維持） |
| failure summary | OPENAI 未設定と GEMINI/NANO 両方未設定を分けて表示 |
| テスト | Test 39 を OR 条件仕様に更新 |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `.github/workflows/nightly-apply.yml` | Secrets Check / failure summary の OR 条件化 |
| `scripts/test_quality_pipeline.sh` | Test 39 更新 |
| `README.md` | Secrets 説明修正 |
| `docs/CHANGELOG.md` | 本エントリ |
| `docs/VERSION.md` | v1.8.2 |

### 変更なし（意図的）

- main branch guard / schedule / resume input / artifacts upload
- `.github/workflows/quality-pipeline-ci.yml`

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **39 PASS** |

---

## v1.8.1 — 運用品質パッチ（Nightly Apply Secrets）

Nightly Apply Workflow が **nano_banana adapter**（デフォルト）の apply 実行に必要な `NANO_BANANA_API_KEY` を正しく扱えるようにしました。

### 修正内容

| 項目 | 内容 |
|------|------|
| 必須 Secrets | `NANO_BANANA_API_KEY` を追加（`OPENAI_API_KEY` / `GEMINI_API_KEY` と併せて apply 前に検証） |
| apply env | `NANO_BANANA_API_KEY: ${{ secrets.NANO_BANANA_API_KEY }}` を注入 |
| failure summary | `NANO_BANANA_API_KEY` 不足を Possible causes に反映 |
| テスト | Test 39 を更新（検証・env 注入・summary 反映を確認） |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `.github/workflows/nightly-apply.yml` | NANO_BANANA_API_KEY 対応 |
| `scripts/test_quality_pipeline.sh` | Test 39 更新 |
| `README.md` | Nightly Apply 必須 Secrets 追記 |
| `docs/CHANGELOG.md` | 本エントリ |
| `docs/VERSION.md` | v1.8.1 |

### 変更なし（意図的）

- v1.8.0 の workflow 設計（main guard / schedule / resume input / artifacts）
- `.github/workflows/quality-pipeline-ci.yml`
- `scripts/run_daily.sh`

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **39 PASS** |

---

## v1.8.0 — Nightly Apply Workflow

dry-run CI（v1.7）とは別に、**apply 専用**の Nightly Apply Workflow を GitHub Actions 上に追加しました。Secrets 検証・main ブランチガード・失敗 summary・Artifacts 保存により、安全に nightly apply と手動 resume を運用できます。

### 追加機能

| 項目 | 内容 |
|------|------|
| Nightly Apply Workflow | `.github/workflows/nightly-apply.yml` |
| トリガー | `workflow_dispatch` / `schedule`（JST 03:00 = UTC 18:00） |
| 必須 Secrets | `OPENAI_API_KEY` / `GEMINI_API_KEY`（apply 前に検証） |
| 通常 apply | `npm run quality-pipeline -- --apply --clean-latest` |
| Resume apply | `workflow_dispatch` input `resume=true` → `--apply --resume`（`--clean-latest` なし） |
| main branch guard | job 条件 + `Verify main branch` ステップ |
| failure summary | 失敗時 `failure-summary.md` 生成（`if: failure()`） |
| Artifacts | `if: always()`、`if-no-files-found: warn`、保持 14 日 |
| テスト | Test 39 追加（**39 PASS**）— nightly-apply workflow contract |

### 設計判断

- **dry-run CI と apply workflow を分離** — `quality-pipeline-ci.yml` は Secrets 不要のまま維持
- **`--resume` と `--clean-latest` は併用しない** — resume 時は `state.json` を保持
- **Secret 値はログに出さない** — 不足時は Secret 名のみ表示
- **失敗時も Artifacts 保存** — `failure-summary.md` 含む調査用成果物を `if: always()` で upload

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `.github/workflows/nightly-apply.yml` | Nightly Apply Workflow |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `scripts/test_quality_pipeline.sh` | Test 39（nightly-apply workflow contract） |
| `README.md` | v1.8 Nightly Apply / CI 役割分離 |
| `docs/CHANGELOG.md` | 本エントリ |
| `docs/VERSION.md` | v1.8.0 |

### 変更なし（意図的）

- `.github/workflows/quality-pipeline-ci.yml`
- `scripts/run_daily.sh`
- Smart Auto Fix / Regeneration Engine 中核

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **39 PASS** |
| `npm run quality-pipeline:dry-run` | **exit 0** |

---

## v1.7.0 — GitHub Actions / CI

Quality Pipeline を GitHub Actions 上で **Secrets なし** に自動検証できるようにしました。`--stop-before-phase` による意図的中断と `--resume` による自然再開を CI で確認し、成果物を Artifacts として保存します。

### 追加機能

| 項目 | 内容 |
|------|------|
| `--stop-before-phase` | 指定 Phase 直前で意図的中断（`state.json` に checkpoint 保存） |
| `stopReason` | 意図的中断時 `before-phase` を `state.json` に記録 |
| `stopBeforePhase` | 停止対象 Phase（例: `REPORT`）を `state.json` に記録 |
| GitHub Actions | `.github/workflows/quality-pipeline-ci.yml` |
| CI 検証 | `npm test` → stop → resume → Artifacts upload |
| `npm test` | `test:quality-pipeline` のエイリアス |
| テスト | Test 34 置換 + Test 35–38 追加（**38 PASS**） |

### 設計判断

- **`ci_prepare_resume_checkpoint.js` は作らない** — 本体の `--stop-before-phase` で自然中断
- **手動 `pipeline_state.json` 改変は不要** — Test 34 は stop → resume フローに置換
- **CI は dry-run 標準** — API キーなしで Green
- **Resume 完了後** — `stopReason` / `stopBeforePhase` / `nextPhase` は `null`

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `.github/workflows/quality-pipeline-ci.yml` | Quality Pipeline CI workflow |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/pipeline_config.js` | `--stop-before-phase`、`validateStopBeforePhaseConfig`、CLI help（v1.7） |
| `src/lib/pipeline_resume.js` | `stopReason` / `stopBeforePhase` を checkpoint に追加 |
| `src/lib/quality_pipeline.js` | 停止判定・意図的中断 checkpoint 保存 |
| `src/lib/phases.js` | `isPhaseBefore` |
| `scripts/run_quality_pipeline.js` | stop-before-phase 表示・Summary |
| `scripts/test_quality_pipeline.sh` | Test 34–38 |
| `package.json` | `npm test` エイリアス |
| `README.md` | v1.7 CI / stop-before-phase ドキュメント |

### 変更なし（意図的）

- `scripts/run_daily.sh`
- Smart Auto Fix / Regeneration Engine 中核

### テスト結果

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **38 PASS** |
| GitHub Actions CI | main 上で Green 完走（Secrets 不要） |

---

## v1.6.0 — Resume Execution

Quality Pipeline が途中で停止した場合でも、`--resume` によって **最後に成功したフェーズ以降** から安全に再開できるようにしました。checkpoint は `reports/quality-pipeline/latest/state.json` に集約し、`pipeline_state.json` / `metrics.json` と連携して実行状態を復元します。

### 追加機能

| 項目 | 内容 |
|------|------|
| Resume Execution | CLI `--resume` による途中再開 |
| `state.json` | resume 専用 checkpoint ファイル（`reports/quality-pipeline/latest/state.json`） |
| Resume Engine | `src/lib/pipeline_resume.js` — checkpoint 読み書き・nextPhase 解決 |
| checkpoint 保存 | 各 Phase 成功時・失敗時・完了時に `state.json` を更新 |
| `checkpointRound` 復元 | 改善ループを `roundsExecuted` 基準で継続 |
| 状態復元 | `pipeline_state.json` / `metrics.json` を読み込んで再開 |
| latest archive スキップ | `--resume` 時は `preparePipelineWorkspace` が archive しない |
| CLI | `--resume`（`--help` 表示、`--clean-latest` 併用不可） |
| テスト | Test 29–34 追加（**34 PASS**） |

### 設計判断

- **Resume は `state.json` を唯一の checkpoint とする** — 再開可否・nextPhase の判断は `state.json` を正とする
- **Resume は `latest` ワークスペースのみ対象** — `reports/quality-pipeline/latest/` 配下の checkpoint / state / metrics を使用
- **archive は Resume 時には実施しない** — `--resume` 実行時は既存 `latest` を退避せずそのまま復元
- **completed phase は再実行しない** — `state.json` の `nextPhase` 以降のみ実行計画に含める
- **改善ループは `checkpointRound` から継続** — `improvement.roundsExecuted` を起点に IMPROVEMENT / RE_REVIEW ラウンドを再開

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/pipeline_resume.js` | Resume checkpoint（`state.json`）の build / read / write / 検証 |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/pipeline_config.js` | `--resume`、`validateResumeConfig`、CLI help（v1.6） |
| `src/lib/quality_pipeline.js` | Resume 復元・checkpoint 永続化・改善ループ `startRound` |
| `src/lib/pipeline_workspace.js` | resume 時 archive スキップ（`action: resumed`） |
| `src/lib/pipeline_state.js` | `snapshotConfig.resume` |
| `scripts/run_quality_pipeline.js` | resume モード表示・Summary |
| `scripts/test_quality_pipeline.sh` | Test 29–34 |
| `README.md` | v1.6 Resume Execution 使い方 |

### 変更なし（意図的）

- `scripts/run_daily.sh`
- Smart Auto Fix / Regeneration Engine 中核
- `openai_regenerate` placeholder
- GitHub Actions 連携

### テスト結果

| 項目 | 結果 |
|------|------|
| `npm run test:quality-pipeline` | **PASS**（34 tests） |
| `npm run quality-pipeline:dry-run` | **exit 0** |
| `npm run quality-pipeline:dry-run -- --resume` | **exit 0** |
| `git diff -- scripts/run_daily.sh` | **差分なし** |

---

## v1.5.0 — OpenAI Regeneration Adapter

Regeneration Engine に **OpenAI Adapter** を追加し、TEXT チェーンの画像再生成を **Nano Banana と CLI から切り替え可能** にしました。Smart Auto Fix 中核・quality loop 構造は変更しません。

### 概要

| 項目 | 内容 |
|------|------|
| OpenAI Adapter | `src/lib/regeneration/openai_regeneration_adapter.js`（`gpt-image-1`） |
| CLI | `--regeneration-adapter <nano_banana\|openai>`（**デフォルト: `nano_banana`**） |
| dry-run | API 未呼び出し、placeholder 結果 + adapter 情報を report に記録 |
| API キー未設定 | 失敗扱いにせず `OPENAI_API_KEY` 案内（dry-run / report） |
| report / metrics | `regenerationAdapter`、`regenerationByAdapter`、model / dryRun 表示 |
| テスト | **28 PASS**（Test 24–28 追加） |

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/regeneration/openai_regeneration_adapter.js` | OpenAI Regeneration Adapter |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/regeneration_engine.js` | OpenAI adapter 登録、`REGENERATION_ADAPTER_IDS` |
| `src/lib/pipeline_config.js` | `--regeneration-adapter`、CLI help（v1.5） |
| `src/lib/pipeline_state.js` | `snapshotConfig.regenerationAdapter` |
| `src/lib/pipeline_improvement.js` | config から adapter 選択、metrics 記録 |
| `src/lib/pipeline_metrics.js` | `regenerationByAdapter` 集計 |
| `src/lib/pipeline_report.js` | v1.5.0 レポート、OpenAI API キー案内 |
| `scripts/run_quality_pipeline.js` | Summary に adapter 表示 |
| `scripts/test_quality_pipeline.sh` | Test 24–28 |
| `README.md` | v1.5 使い方 |
| `docs/VERSION.md` / `docs/CHANGELOG.md` | バージョン追記 |

### 変更なし（意図的）

- `scripts/run_daily.sh`
- Smart Auto Fix lib 中核
- LAYOUT / STYLE / BOOST の Nano Banana 直呼びルート
- `openai_regenerate` placeholder（改善 plan 上の別ルート）

### テスト結果

| 項目 | 結果 |
|------|------|
| `npm run test:quality-pipeline` | **PASS**（28 tests） |
| `npm run quality-pipeline:dry-run` | **exit 0** |
| `npm run quality-pipeline:dry-run -- --regeneration-adapter openai` | **exit 0** |
| `git diff -- scripts/run_daily.sh` | **差分なし** |

---

## v1.4.1 — 運用品質パッチ

v1.4.0 リリース直後の **運用案内・安全性** を改善。Smart Auto Fix / Regeneration 中核・quality loop は変更しません。

### 改善内容

| 項目 | 内容 |
|------|------|
| report.md 強化 | 通常 commit 不要の副産物 / dry-run・latest・archive / apply 実行判断 |
| API キー案内 | `smart_auto_fix` target 時の Nano Banana / Gemini ヒント精度向上 |
| CLI | `--apply` 注意バナー、Summary に Next Actions 上位表示 |
| 陳腐化文案修正 | MANUAL_REVIEW_ONLY、OpenAI ヒント、CLI help |
| README | dry-run latest 更新、archive、output 整理コマンド、apply 前チェックリスト |
| テスト | report セクション / 文案 / API ヒント / CLI help |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/pipeline_report.js` | v1.4.1 レポートセクション、API ヒント |
| `scripts/run_quality_pipeline.js` | apply バナー、Next Actions Summary |
| `src/lib/pipeline_config.js` | CLI help 更新 |
| `README.md` | 運用フロー・副産物整理 |
| `docs/V1.4.1_OPERATIONAL_PATCH_DESIGN.md` | 設計書 |
| `docs/VERSION.md` / `docs/CHANGELOG.md` | バージョン追記 |
| `scripts/test_quality_pipeline.sh` | テスト追加 |

### 変更なし（意図的）

- `scripts/run_daily.sh`
- Smart Auto Fix / Regeneration Engine 中核
- `openai_regenerate` / `--resume` / GitHub Actions
- `output/` の git 追跡解除（`git rm --cached`）

---

## v1.4.0 — Smart Auto Fix 統合（完了）

品質パイプラインにおいて **TEXT rootCause** を Smart Auto Fix チェーンで実改善し、Gemini ReReview → scoreSummary → export / report / metrics まで quality loop に接続しました。

### 概要

- **Smart Auto Fix lib 化** … `src/lib/smart_auto_fix.js` へ抽出、CLI は薄型ラッパー
- **Regeneration Engine 追加** … SAF と画像再生成の間に共通 IF を配置
- **Nano Banana adapter 追加** … v1.4 暫定 adapter として `regeneration/nano_banana_adapter.js`
- **TEXT rootCause pipeline 接続** … `processSmartAutoFixTarget` で SAF → Regeneration → PNG 生成
- **Gemini ReReview / scoreSummary source 一般化** … `smart_auto_fix_re_review` / `nano_banana_re_review`
- **report / export / metrics 対応** … SAF / Regeneration カウント、TEXT チェーン表示
- **dry-run 標準維持** … デフォルト API 未呼び出し
- **LAYOUT / STYLE / BOOST** … 既存 Nano Banana 直呼びルートは退行なし

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/smart_auto_fix.js` | Smart Auto Fix lib（classify / plan / apply / run） |
| `src/lib/regeneration_engine.js` | Regeneration Engine（plan / regenerate / adapter 登録） |
| `src/lib/regeneration/nano_banana_adapter.js` | Nano Banana adapter |
| `docs/V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md` | v1.4 設計書 |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `src/smart_auto_fix.js` | CLI 薄型化（lib 委譲） |
| `src/lib/pipeline_improvement.js` | `processSmartAutoFixTarget`、ReReview メタデータ、metrics 集計 |
| `src/lib/pipeline_score.js` | `resolveReviewSource*`、source 一般化 |
| `src/lib/pipeline_metrics.js` | SAF / Regeneration カウント |
| `src/lib/pipeline_report.js` | v1.4.0 レポート、TEXT チェーンセクション |
| `src/lib/pipeline_export.js` | TEXT chain improved 採用、`smart_auto_fix_re_review` 許容 |
| `scripts/test_quality_pipeline.sh` | Test 11–21 追加 |
| `README.md` | v1.4 使い方 |
| `docs/VERSION.md` | v1.4.0 |
| `docs/REPORT_SCHEMA.md` | quality_pipeline_report v1.4 フィールド追記 |

### 変更なし（意図的）

| 項目 | 内容 |
|------|------|
| `scripts/run_daily.sh` | 非変更 |
| `openai_regenerate` | placeholder のまま |
| `--resume` | 未実装 |
| GitHub Actions | 未実装 |

### 品質基準（維持）

| 点数 | 判定 |
|------|------|
| **90 点以上** | 公開推奨 |
| **80 点以上** | 合格 |
| **79 点以下** | 要改善 |

### テスト結果（Phase 4-E）

| 項目 | 結果 |
|------|------|
| `npm run test:quality-pipeline` | **PASS**（21 tests） |
| `npm run quality-pipeline:dry-run` | **exit 0** |
| TEXT chain stub apply（Test 13） | **PASS** |
| `git diff -- scripts/run_daily.sh` | **差分なし** |
| 実 API apply E2E | 任意（stub / dry-run を正式確認とする） |

---

## v1.3.1 — 運用品質パッチ

v1.3.0 の完全自動品質パイプラインに対する **運用安全性** の改善です。新機能追加は行わず、事故防止・後片付け・エラー案内・テスト強化に限定しています。

### 改善内容

| 項目 | 内容 |
|------|------|
| latest 退避 | 上書き前に `reports/quality-pipeline/archive/YYYY-MM-DD-HHmmss/` へコピー |
| `--clean-latest` | 実行前に `latest` を削除 |
| report.md 強化 | Next Actions / API キー設定案内 / output 副産物の git 注意 |
| テスト | `--clean-latest`、report.md セクション、archive の確認を追加 |

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/pipeline_workspace.js` | archive / clean-latest 処理 |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `src/lib/pipeline_config.js` | `--clean-latest` オプション |
| `src/lib/pipeline_state.js` | config スナップショットに `cleanLatest` |
| `src/lib/quality_pipeline.js` | 実行前 workspace 準備 |
| `src/lib/pipeline_report.js` | v1.3.1 レポート拡張 |
| `scripts/run_quality_pipeline.js` | workspace サマリー表示 |
| `scripts/test_quality_pipeline.sh` | テスト追加 |
| `README.md` | 運用案内 |
| `docs/VERSION.md` | v1.3.1 |
| `docs/V1.3_QUALITY_PIPELINE_DESIGN.md` | 運用パッチ追記 |

### 変更なし（意図的）

- `scripts/run_daily.sh` … 非変更
- smart_auto_fix / openai_regenerate の pipeline 実接続 … v1.4 以降

---

## v1.3 — 完全自動品質パイプライン（MVP 完了）

投稿・画像レビュー・改善・再レビュー・export・レポートを統合する **上位品質パイプライン** を追加しました。`npm run daily` は変更せず、並立して利用します。

### 概要

- **dry-run 標準** … デフォルトは API 未呼び出し。`--apply` で本番実行
- **90 点公開推奨まで改善ループ** … IMPROVEMENT ⇄ RE_REVIEW を `maxRounds` まで繰り返す
- **rootCause ルーティング** … TEXT→smart_auto_fix、LAYOUT/STYLE→nano_banana、PROMPT→openai_regenerate（後者2つは接続準備のみ）
- **state / metrics / report 出力** … `reports/quality-pipeline/latest/` に集約
- **npm scripts 登録** … `quality-pipeline` 系 + `test:quality-pipeline`

### 新機能

#### 品質パイプライン CLI

| 項目 | 内容 |
|------|------|
| 入口 | `scripts/run_quality_pipeline.js` |
| オーケストレータ | `src/lib/quality_pipeline.js` |
| 接続済み Phase | HEALTH_CHECK、IMAGE_REVIEW、IMPROVEMENT、RE_REVIEW、EXPORT、REPORT |
| 未接続 Phase | POST_* / CAROUSEL_* / IMAGE_GENERATION（placeholder） |

#### 改善ループ

| 項目 | 内容 |
|------|------|
| Nano Banana | apply 時に実改善（v1.2 lib 直呼び） |
| stopReason | `NO_SUCCESSFUL_ACTIONS_API_FAILED`（exit 2）、`NO_SCORE_IMPROVEMENT`（exit 3）等 |
| lastRound | executedActions / scoreBefore / scoreAfter / scoreDelta を記録 |

#### export 拡張

| 項目 | 内容 |
|------|------|
| ファイル | `src/lib/pipeline_export.js` |
| improved 採用 | manifest + re-review + ファイル存在の 3 条件 |
| ゲート | 全スライド 90 点以上（デフォルト）、`--allow-partial-export` で 80 点以上 |

#### レポート

| 項目 | 内容 |
|------|------|
| ファイル | `src/lib/pipeline_report.js` |
| tool | `quality_pipeline_report`（REPORT_SCHEMA 準拠） |
| 出力 | `report.json` / `report.md`（dry-run / apply 共通） |

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `scripts/run_quality_pipeline.js` | CLI 入口 |
| `scripts/test_quality_pipeline.sh` | 最小テスト |
| `src/lib/quality_pipeline.js` | オーケストレータ |
| `src/lib/phases.js` | Phase 定数・遷移 |
| `src/lib/pipeline_config.js` | CLI 設定 |
| `src/lib/pipeline_state.js` | pipeline_state 読み書き |
| `src/lib/pipeline_metrics.js` | metrics 集計 |
| `src/lib/pipeline_hooks.js` | Hook 機構（no-op） |
| `src/lib/pipeline_phase_handlers.js` | Phase dispatcher |
| `src/lib/pipeline_improvement.js` | 改善ループ |
| `src/lib/pipeline_score.js` | scoreSummary |
| `src/lib/pipeline_export.js` | Instagram Package export |
| `src/lib/pipeline_report.js` | レポート生成 |
| `src/lib/retry.js` | 共通 retry |
| `docs/V1.3_QUALITY_PIPELINE_DESIGN.md` | 設計書 |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `package.json` | quality-pipeline 系 npm scripts |
| `src/lib/exit_codes.js` | `getPipelineExitCode()` |
| `README.md` | v1.3 使い方 |
| `docs/VERSION.md` | v1.3 追記 |
| `docs/CLI_EXIT_CODES.md` | 品質パイプライン終了コード |

### 運用方法（v1.3 追加コマンド）

```
【画像レビュー済み・品質ループを回したい場合】

# 1. 計画確認（dry-run）
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 3

# 2. 本番実行
npm run quality-pipeline:apply -- --from-phase image-review --max-rounds 3

# 3. テスト
npm run test:quality-pipeline

【レポート確認】
reports/quality-pipeline/latest/report.md を開く
```

### 品質基準（v1.3 パイプライン）

| 点数 | 判定 | export（デフォルト） |
|------|------|---------------------|
| **90 点以上** | 公開推奨 | 可 |
| **80 点以上** | 合格 | `--allow-partial-export` 時のみ |
| **79 点以下** | 要改善 | 不可 |

### 設計思想

| 判断 | 理由 |
|------|------|
| **run_daily.sh は非変更** | 従来運用との共存 |
| **dry-run 標準** | API コスト確認後に `--apply` |
| **90 点までループ** | 公開推奨品質を自動で目指す |
| **reports/ は Git 管理外** | 実行ログはローカル保持 |

### テスト結果

| 項目 | 内容 |
|------|------|
| `npm run test:quality-pipeline` | dry-run / report schema / buildPipelineReport / from-phase report |
| dry-run E2E | image-review 起点で state / metrics / report 生成を確認 |
| apply E2E | Nano Banana API キー未設定時 `NO_SUCCESSFUL_ACTIONS_API_FAILED`（exit 2）を確認 |

### 注意点

- 現 MVP では **画像レビュー以降**（`--from-phase image-review`）が実用の起点です
- smart_auto_fix / openai_regenerate の **実改善は未接続** です
- `--resume` 途中再開は未実装です
- `run_daily.sh` / `npm run daily` は **変更していません**

---

## v1.2 — Nano Banana画像改善（完了）

OpenAI Images で生成したカルーセル画像を **Nano Banana（Gemini 画像 API）** で改善し、Gemini による再レビューと改善レポート生成までを自動化しました。

### 概要

- 改善対象は `image_review.json` で **score が 80 未満** のスライドのみ
- 元画像（`images/carousel/output/`）は **上書きしない**
- 改善画像は `output/carousel/improved/` に保存
- **dry-run 標準**、`--apply` で API 実行
- 実行ログ・レポートは `reports/nano-banana-improve/`（Git 管理外）

### 新機能

#### Nano Banana API ラッパー

| 項目 | 内容 |
|------|------|
| ファイル | `src/lib/nano_banana.js` |
| 機能 | timeout（デフォルト 60 秒）、retry（指数バックオフ）、elapsedMs / attempts 記録 |
| dry-run | API 未呼び出しで計画のみ返却 |
| 保存先 | `output/carousel/improved/` のみ（元画像非破壊） |

#### 改善対象抽出・実行

| 項目 | 内容 |
|------|------|
| ファイル | `scripts/improve_with_nano_banana.js` |
| 対象 | score < 80 のスライドのみ（80 以上は skip） |
| rootCause | LAYOUT / PROMPT / STYLE / OTHER に応じた改善プロンプト |
| TEXT | Nano Banana 対象外（自動 skip → Smart Auto Fix 推奨） |
| 出力 | `output/carousel/improved/manifest.json` |

#### 改善後再レビュー

| 項目 | 内容 |
|------|------|
| ファイル | `scripts/review_improved_images.js` |
| 対象 | manifest の `status: improved` のみ |
| 比較 | beforeScore / afterScore / deltaScore |
| 出力 | `reports/nano-banana-improve/review_result.json` |

#### レポート生成

| 項目 | 内容 |
|------|------|
| ファイル | `scripts/report_nano_banana_improvement.js` |
| 出力 | `reports/nano-banana-improve/report.md` / `report.json` |
| 機能 | manifest + review_result を統合、recommendation 自動判定 |

### 品質改善

| 項目 | 内容 |
|------|------|
| timeout | デフォルト 60 秒（`--timeout-ms` で変更可） |
| retry | 最大 3 回、指数バックオフ（429 / 5xx でリトライ） |
| 記録 | attempts / elapsedMs / reviewElapsedMs を manifest・review_result に保存 |
| 元画像非破壊 | `images/carousel/output/` は読み取り専用 |
| dry-run 標準 | improve / review ともにデフォルト dry-run |
| manifest 管理 | 改善結果を `manifest.json` に集約 |
| reports | `reports/` は `.gitignore` で除外（Git 管理しない） |

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `docs/V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md` | v1.2 設計書 |
| `src/lib/nano_banana.js` | Nano Banana API ラッパー |
| `scripts/improve_with_nano_banana.js` | 改善対象抽出・実行 |
| `scripts/review_improved_images.js` | 改善後 Gemini 再レビュー |
| `scripts/report_nano_banana_improvement.js` | レポート生成 |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `README.md` | v1.2 の使い方・コマンド・採点基準を追記 |

### 運用方法（v1.2 追加コマンド）

```
【画像レビュー不合格後・Nano Banana で視覚改善したい場合】

# 1. 改善計画確認（dry-run）
node scripts/improve_with_nano_banana.js --review images/carousel/review/image_review.json

# 2. 改善実行
node scripts/improve_with_nano_banana.js --apply --review images/carousel/review/image_review.json

# 3. 再レビュー（dry-run → apply）
node scripts/review_improved_images.js
node scripts/review_improved_images.js --apply

# 4. レポート生成
node scripts/report_nano_banana_improvement.js

【レポート確認】
reports/nano-banana-improve/report.md を開く
```

### 品質基準（画像レビュー・v1.1.1 維持）

| 点数 | 判定 | 意味 |
|------|------|------|
| **90〜100** | 公開推奨 | そのまま Instagram に投稿してよい品質 |
| **80〜89** | 合格 | 基準を満たしている。公開可能 |
| **79 以下** | 再改善候補 | Nano Banana 再実行または Smart Auto Fix を検討 |

### 設計思想

| 判断 | 理由 |
|------|------|
| **80 点以上＝合格、90 点以上＝公開推奨** | v1.1.1 の品質基準を維持 |
| **TEXT は Smart Auto Fix** | 誤字・文字崩れは Nano Banana ではなく文言・OpenAI 再生成が有効 |
| **LAYOUT / STYLE / PROMPT は Nano Banana** | 視認性・余白・配色は画像 API で直接改善 |
| **`reports/` は Git 管理しない** | 実行ログはローカルに残し、リポジトリを汚さない |
| **dry-run を標準** | API コストと結果を確認してから `--apply` |

### テスト結果

**確認済み**

| 項目 | 内容 |
|------|------|
| dry-run | improve / review ともに API 未呼び出しで manifest・review_result 生成 |
| apply | Nano Banana API 呼び出しフロー（クライアント初期化〜リトライ） |
| timeout / retry | 60 秒デフォルト、3 回リトライ、attempts 記録 |
| manifest | 対象判定・status・elapsedMs・attempts を記録 |
| report | `report.md` / `report.json` 生成、recommendation 判定 |
| review_result | improved 対象の planned / reviewed / failed_review 記録 |
| 元画像非破壊 | `images/carousel/output/` の mtime 不変を確認 |
| エラー継続処理 | 1 枚失敗しても全体処理継続、exit code 0 |

**未確認**

| 項目 | 内容 |
|------|------|
| 改善画像保存成功 | API クォータ超過（HTTP 429）のため、`output/carousel/improved/slideXX.png` の実保存成功は未確認。失敗時は manifest に `status: failed` として記録されることを確認済み |

### 注意点

- Nano Banana は `GEMINI_API_KEY` または `NANO_BANANA_API_KEY` を使用します
- TEXT rootCause のスライドは improve スクリプトが **自動 skip** します
- クォータ超過時は該当スライドのみ `failed`、他スライドは続行します
- v1.2 コマンドは現時点 **npm script 未登録** です。README 記載の `node scripts/...` で実行します

---

## v1.1.1 — 運用品質向上（2026-06-26 完了）

日常運用で「環境は整っているか」「今どこまで進んでいるか」「画像の問題をどう直すか」を、**1 コマンドで確認・計画** できるようになりました。

### 追加した機能

| 機能 | コマンド | 説明 |
|------|----------|------|
| **Health Check** | `npm run health-check` | `.env`、API キー、必要フォルダが揃っているかを 12 項目チェック |
| **Doctor** | `npm run doctor` | リサーチ・画像レビュー・出力素材の状態を診断し、次のコマンドを提案 |
| **rootCause 判定** | `npm run root-cause-check` | 不合格スライドの原因を TEXT / LAYOUT / PROMPT / STYLE / OTHER に分類 |
| **Smart Auto Fix** | `npm run smart-auto-fix` | 原因別の改善計画を表示（**dry-run 標準**） |
| **Smart Auto Fix apply** | `npm run smart-auto-fix -- --apply` | 対象ファイルをバックアップし、Smart Auto Fix 指示を Markdown 末尾に追記 |
| **Smart Auto Fix Report** | （smart-auto-fix 実行時に自動） | 実行結果を `reports/smart-auto-fix/` に Markdown レポートとして保存 |

### 変更・追加したファイル

**新規**

| ファイル | 内容 |
|----------|------|
| `src/health_check.js` | 環境チェック（Health Check） |
| `src/doctor.js` | 状態診断（Doctor） |
| `src/lib/root_cause.js` | rootCause 判定モジュール |
| `src/check_root_cause.js` | rootCause 判定結果の表示 |
| `src/smart_auto_fix.js` | Smart Auto Fix 本体（dry-run / apply / Report） |
| `docs/SmartAutoFix設計.md` | Smart Auto Fix の設計書 |

**更新**

| ファイル | 内容 |
|----------|------|
| `src/doctor.js` | 不合格時に rootCause 表示、`smart-auto-fix` を優先提案 |
| `package.json` | `health-check` / `doctor` / `root-cause-check` / `smart-auto-fix` を追加 |
| `README.md` | 各コマンドの使い方・Report 説明を追記 |
| `.gitignore` | `reports/` を除外 |

### 運用方法（v1.1.1 追加コマンド）

```
【初回セットアップ後】
npm run health-check     … 環境が整っているか確認

【日常の確認】
npm run doctor           … 全体状態 + 次に何をすべきか

【画像レビュー不合格時】
npm run smart-auto-fix              … 改善計画を確認（dry-run）
npm run smart-auto-fix -- --apply   … 指示をファイルに追記
npm run root-cause-check            … 原因分類だけ確認

【レポート確認】
reports/smart-auto-fix/YYYY-MM-DD-HHmmss.md を開く
```

### 今回の設計判断

| 判断 | 理由 |
|------|------|
| **画像改善はプロンプトだけでなくコンテンツも** | 誤字・文字崩れは `slideXX.md` の文言短縮が必要なケースがある（slide01 事例） |
| **80 点以上＝合格、90 点以上＝公開推奨** | 合格ラインは維持しつつ、より高品質な投稿を区別できるようにする |
| **Smart Auto Fix は dry-run を標準** | いきなりファイルを変えず、まず計画を確認してから `--apply` で実行 |
| **`reports/` は Git 管理しない** | 実行ログはローカルに残し、リポジトリを汚さない |

### 品質基準（画像レビュー）

| 点数 | 判定 | 意味 |
|------|------|------|
| **90〜100** | 公開推奨 | そのまま Instagram に投稿してよい品質 |
| **80〜89** | 合格 | 基準を満たしている。公開可能 |
| **79 以下** | 要改善 | Smart Auto Fix で原因別改善を検討 |

### 注意点

- Smart Auto Fix の `--apply` は **指示の追記まで**。画像の自動再生成は v1.1.1 では行いません
- `reports/` は `.gitignore` で除外されています（別 PC には自動では引き継がれません）
- Doctor 不合格時の第一提案は **`image-improve` ではなく `smart-auto-fix`** です
- `health-check` / `doctor` は Error があっても最後まで実行し、exit code は 0 です

---

## v1.1 — Genspark連携（2026-06-26 完了）

投稿生成の前に **Genspark で調べたネタ** を使えるようになりました。  
v1.1 は **半自動運用** です（Genspark での調査は人間が行い、以降は `npm run daily` が自動実行します）。

### 追加した機能

| 機能 | 説明 |
|------|------|
| Genspark リサーチ連携 | 調査結果を `content/research/` に保存し、投稿生成に反映 |
| リサーチテンプレート | `prompts/genspark/research_template.md`（Genspark に貼り付けるプロンプト） |
| 3 ファイル構成 | `latest.md`（人間向け）/ `latest.json`（AI 向け）/ `metadata.json`（メタ情報） |
| JSON 最優先テーマ | `postValueScore` が最も高い topic を投稿生成の中心ネタに使用 |
| リサーチ状態確認 | `npm run research-check` でファイルの有無と使用テーマを表示 |
| daily 冒頭リサーチ確認 | `npm run daily` 実行時、最初に `research-check` を自動実行 |
| フォールバック | リサーチファイルがない／JSON が壊れている場合も daily は停止しない |

### 変更・追加したファイル

**新規**

| ファイル | 内容 |
|----------|------|
| `src/check_research.js` | リサーチファイルの状態確認スクリプト |
| `prompts/genspark/research_template.md` | Genspark 調査用テンプレート |
| `content/research/latest.md` | リサーチ結果サンプル（人間向け） |
| `content/research/latest.json` | リサーチ結果サンプル（AI 向け） |
| `content/research/metadata.json` | 調査メタ情報サンプル |
| `docs/Genspark連携設計.md` | Genspark 連携の設計・運用ドキュメント |

**更新**

| ファイル | 内容 |
|----------|------|
| `src/generate_post.js` | `latest.md` / `latest.json` の読み込みと Claude への反映 |
| `scripts/run_daily.sh` | 冒頭に「リサーチ確認」ステップを追加 |
| `package.json` | `"research-check"` スクリプトを追加 |
| `README.md` | Genspark 連携の使い方を追記 |

### 運用方法

```
【朝（5〜10分・人間）】
1. prompts/genspark/research_template.md を Genspark に貼り付けて調査
2. 結果を content/research/ に 3 ファイル保存
   - latest.md
   - latest.json
   - metadata.json

【確認（任意）】
npm run research-check

【自動実行】
npm run daily
  → リサーチ確認 → 投稿生成（リサーチ反映）→ カルーセル → 画像 → 出力
```

### 投稿生成の優先順位

| 状態 | 動作 |
|------|------|
| `latest.json` 正常 + `latest.md` あり | JSON 最優先テーマ + Markdown 参考 |
| `latest.md` のみ | Markdown の推奨テーマを参考 |
| 両方なし | 固定テーマ（`prompts/instagram/user.md`） |
| `latest.json` が壊れている | **停止しない**。`latest.md` があれば Markdown のみで続行 |

### 注意点

- **Genspark API の自動連携は v1.1 では行いません。** 調査とファイル保存は人間の作業です
- `latest.json` を保存するとき、JSON コードブロックの **中身だけ** を保存してください（```json 行は含めない）
- リサーチファイルがなくても `npm run daily` は動きます（固定テーマにフォールバック）
- `research-check` が失敗しても `npm run daily` は止まりません
- 生成内容は必ず人間が確認してから Instagram に投稿してください

---

## v1.0 — Instagramカルーセル自動生成（2026-06-25 完了）

飲食店向け Instagram カルーセル投稿を、`npm run daily` 1 本で生成できる最初のバージョンです。

### 主な機能

| 機能 | 説明 |
|------|------|
| 投稿生成 | Claude Code でキャプション（本文）を生成 |
| Gemini レビュー | 投稿文の品質改善 |
| カルーセル生成 | 5 枚構成のストーリー型テキスト |
| 画像生成 | OpenAI Images API で 5 枚の画像を生成 |
| 品質チェック | テキスト・画像の AI 採点と改善ループ |
| Instagram 出力 | `output/instagram/` に投稿素材をまとめて出力 |
| Gemini キャッシュ | API 使用回数削減（`.cache/gemini/`） |
| クォータ超過対応 | Gemini 429 エラー時の分かりやすいメッセージ |
| 画像レビューゲート | 最終画像レビュー不合格時は export 前に停止 |

### 主なコマンド

```bash
npm run daily              # 一括実行（13 ステップ）
npm run research-check     # （v1.1 で追加）
npm run image-improve      # 不合格スライドの画像再生成
npm run export-instagram   # 投稿素材の出力
```

---

*詳しい使い方は [README.md](../README.md) を参照してください。*

## v1.12.0 - Dependabot 依存関係自動更新設定

### 追加

- `.github/dependabot.yml` を追加
- GitHub Actions の依存関係更新検知を有効化
- npm パッケージの依存関係更新検知を有効化
- 毎週月曜日の午前中（Asia/Tokyo）に更新確認
- Dependabot PR 上限を ecosystem ごとに 5 件へ制限

### 設計判断

- 初期リリースでは Auto Merge は導入しない
- 初期リリースでは Grouped Updates は導入しない
- 初期リリースでは ignore 設定は追加しない
- GitHub Actions と npm は分離管理し、安全にレビューできる状態を優先する
