# バージョン情報

## 現在のバージョン

**v1.41.0**（Idea Generation Foundation）

**Platform Status:** Developer Automation Platform **Completed**（保守のみ）

**Next Candidate:** v1.42.0 Content Generation Foundation

---

## バージョン履歴

| バージョン | 名称 | 状態 | 概要 |
|------------|------|------|------|
| **v1.41.0** | **機能追加** | **✅ 完了** | **Idea Generation Foundation / Content Idea Builder・Validator・Public Contract MVP（LLM 非依存）** |
| **v1.40.0** | **機能追加** | **✅ 完了** | **Visualization Foundation / Public Contract 整理 MVP — Developer Automation Platform Completed** |
| **v1.39.0** | **機能追加** | **✅ 完了** | **Historical Analytics Foundation / Dashboard + Trend Public Contract から履歴集計 MVP** |
| **v1.38.0** | **機能追加** | **✅ 完了** | **Trend Analytics Foundation / Dashboard Public Contract から Workflow Trend MVP** |
| **v1.37.1** | **ドキュメント** | **✅ 完了** | **Architecture Documentation MVP / docs/architecture 追加・コード変更なし** |
| **v1.37.0** | **機能追加** | **✅ 完了** | **Developer Analytics Foundation / Dashboard Public Contract から KPI・Health 生成 MVP** |
| **v1.36.0** | **機能追加** | **✅ 完了** | **Developer Dashboard Foundation / Timeline を唯一入力とする集計 MVP** |
| v1.0 | Instagramカルーセル自動生成 | ✅ 完了 | 投稿〜カルーセル〜画像〜出力まで `npm run daily` で一括実行 |
| v1.1 | Genspark連携 | ✅ 完了 | Genspark の調査結果を投稿生成に反映（半自動運用） |
| v1.1.1 | 運用品質向上 | ✅ 完了 | Health Check / Doctor / Smart Auto Fix で日常運用を支援 |
| v1.2.0 | Nano Banana 画像改善 | ✅ 完了 | Nano Banana による画像改善・Gemini 再レビュー・レポート生成 |
| v1.2.1 | スキーマ / 終了コード統一 | ✅ 完了 | manifest / report schema 固定、CLI 終了コード統一 |
| v1.3.0 | 完全自動品質パイプライン | ✅ 完了 | 品質ループ・export・report 統合、npm scripts 登録 |
| v1.3.1 | 運用品質パッチ | ✅ 完了 | latest 退避 / clean-latest / report 運用案内強化 |
| v1.4.0 | Smart Auto Fix 統合 | ✅ 完了 | TEXT チェーン接続、Regeneration Engine、ReReview / report / export / metrics |
| v1.4.1 | 運用品質パッチ | ✅ 完了 | report / README / CLI 運用案内強化 |
| v1.5.0 | OpenAI Regeneration Adapter | ✅ 完了 | Regeneration adapter 切替（nano_banana / openai）、report / metrics 反映 |
| v1.6.0 | Resume Execution | ✅ 完了 | `--resume` 途中再開、`state.json` checkpoint、latest archive スキップ |
| v1.7.0 | GitHub Actions / CI | ✅ 完了 | `--stop-before-phase`、dry-run CI workflow、Artifacts、npm test |
| v1.8.0 | Nightly Apply Workflow | ✅ 完了 | apply nightly workflow、Secrets チェック、failure summary、resume dispatch |
| v1.8.1 | 運用品質パッチ | ✅ 完了 | Nightly Apply に `NANO_BANANA_API_KEY` 対応 |
| v1.8.2 | 運用品質パッチ | ✅ 完了 | Secrets Check を GEMINI / NANO OR 条件に修正 |
| v1.9.0 | Health Check エラー可視化 | ✅ 完了 | HEALTH_CHECK 個別エラーをログ・metrics・failure summary で確認可能 |
| **v1.35.0** | **機能追加** | **✅ 完了** | **Developer Workflow Timeline Foundation / History から時系列表示 MVP** |
| **v1.34.0** | **機能追加** | **✅ 完了** | **Developer Workflow History Foundation / 実行履歴・時系列管理 MVP** |
| **v1.33.0** | **機能追加** | **✅ 完了** | **Workflow Checkpoint Foundation / state 位置・互換性・resume 安全性検証** |
| **v1.32.0** | **機能追加** | **✅ 完了** | **Developer Workflow Resume Foundation / STOPPED 状態の保存と Resume** |
| **v1.31.0** | **機能追加** | **✅ 完了** | **Developer Handoff Prompt Foundation / Claude Code 引き継ぎ MVP** |
| v1.30.0 | 機能追加 | ✅ 完了 | Developer Workflow Guard Foundation / Workflow 安全制御 MVP |
| v1.24.0 | 保守更新 | ✅ 完了 | GitHub Actions Node24 Production Readiness |
| v1.23.0 | 保守更新 | ✅ 完了 | Node24 Migration Readiness（experimental） |
| v1.22.0 | 保守更新 | ✅ 完了 | Performance Trend Experimental workflow |
| v1.21.0 | 保守更新 | ✅ 完了 | workflow_run opt-in design review |
| v1.20.0 | 保守更新 | ✅ 完了 | Scheduled Performance Trend Collection |
| v1.19.0 | 保守更新 | ✅ 完了 | GitHub Actions 自動 Performance Trend Collection |
| v1.18.0 | 保守更新 | ✅ 完了 | Artifact metadata / retention awareness |
| v1.17.0 | 保守更新 | ✅ 完了 | gh CLI ローカル Performance Trend Analysis |
| v1.16.0 | 保守更新 | ✅ 完了 | performance-observation.json artifact 基盤 |
| v1.15.0 | 保守更新 | ✅ 完了 | Performance / Cache Observation Summary |
| v1.14.0 | 保守更新 | ✅ 完了 | Step Summary + 主要ステップ実行時間計測 |
| v1.13.0 | 保守更新 | ✅ 完了 | setup-node npm cache 最適化（package-lock.json） |
| v1.12.1 | 運用品質パッチ | ✅ 完了 | Dependabot 運用ドキュメント強化 |
| v1.12.0 | 保守更新 | ✅ 完了 | Dependabot による GitHub Actions / npm 依存関係更新検知 |
| v1.11.0 | 保守更新 | ✅ 完了 | upload-artifact v7 — Node.js 20 Warning 解消 |
| v1.10.0 | 保守更新 | ✅ 完了 | GitHub Actions runtime maintenance（checkout v5 / setup-node v6） |
| v1.9.4 | 運用品質パッチ | ✅ 完了 | Workflow 成否と品質判定の分離 |
| v1.9.3 | 運用品質パッチ | ✅ 完了 | 成功条件と status / exit code の整合 |
| v1.9.2 | 運用品質パッチ | ✅ 完了 | GHA 環境で .env なし Health Check 通過（Secrets 注入時） |
| v1.9.1 | 運用品質パッチ | ✅ 完了 | Nightly Apply failure summary heredoc の YAML 修正 |

---

### v1.41.0 で追加（Idea Generation Foundation）

#### Content Idea MVP

- **`buildContentIdeas()`** … Idea Builder（Pure Function、LLM 非依存）
- **`validateContentIdeas()`** … schema / ideas 配列検証
- **`extractContentIdeaPublicContract()`** … 将来レイヤー向け Public Contract
- **出力** … `output/content-ideas/content-ideas.json` / `content-ideas.md`
- **CLI** … `npm run content:ideas`

#### Application Layer 開始

| レイヤー | 状態 |
|----------|------|
| Idea Generation | **✅ MVP** |
| Content → Image → Publishing → Analytics → Improvement | 未着手 |

#### Next Candidate

| 候補 | 方針 |
|------|------|
| **v1.42.0 Content Generation Foundation** | Idea Public Contract からコンテンツ生成 MVP |

### 品質状況（v1.41.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **324 PASS** |
| npm test | **PASS** |

### v1.41.0 完成判定

| 項目 | 状態 |
|------|------|
| content-ideas schema 1.0 | ✅ |
| Idea Builder / Validator / CLI | ✅ |
| extractContentIdeaPublicContract | ✅ |
| JSON = Source / Markdown = View / CLI = Summary | ✅ |
| LLM / Publishing / SNS API 非実装 | ✅ |
| content-generation/1.0 後方互換 | ✅ |
| Test 313–324 | ✅ |

---

### v1.40.0 で追加（Visualization Foundation / Platform Completed）

#### Workflow Visualization MVP

- **`extractHistoricalPublicContract()`** … Historical Public Contract 公開（Historical Internal 非公開）
- **`buildWorkflowVisualization()`** … Dashboard + Trend + Historical Public Contract を整理（分析なし）
- **`validateWorkflowVisualization()`** … schema / summary sections 検証
- **出力** … `reports/workflow-visualization/latest/workflow-visualization.json` / `visualization-report.md`
- **CLI** … `npm run developer:visualization`

#### Developer Automation Platform Completed

| レイヤー | 状態 |
|----------|------|
| Workflow → State → Checkpoint → History → Timeline → Dashboard → Analytics → Visualization | **✅ Completed** |

#### Next Phase

| 方針 | 内容 |
|------|------|
| **v1.41.0+** | AI-SNS-Automation 本体開発（Idea → Content → Image → Publishing → Analytics → Improvement） |
| **Developer Automation** | 保守のみ — 新レイヤー追加なし |

### 品質状況（v1.40.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **312 PASS** |
| npm test | **PASS** |

### v1.40.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-visualization schema 1.0 | ✅ |
| extractHistoricalPublicContract | ✅ |
| Visualization Builder / Validator / CLI | ✅ |
| Public Contract Only（分析なし） | ✅ |
| Chart / Graph / Forecast / HTML / SVG / PNG 非実装 | ✅ |
| Developer Automation Platform Completed | ✅ |
| Test 301–312 | ✅ |

---

### v1.39.0 で追加（Historical Analytics Foundation）

#### Workflow Historical Analytics MVP

- **`extractTrendPublicContract()`** … Trend Public Contract 公開（Trend Internal 非公開）
- **`buildWorkflowHistoryAnalytics()`** … Dashboard + Trend Public Contract から Pure 集計
- **`validateWorkflowHistoryAnalytics()`** … schema / coverage / summary / workflowHealth 検証
- **出力** … `reports/workflow-history-analytics/workflow-history-analytics.json` / `historical-report.md`
- **CLI** … `npm run developer:history-analytics`

#### Next Candidate

| 候補 | 方針 |
|------|------|
| **v1.40.0 Visualization Foundation** | Developer Automation Platform 完成 — 集計結果の可視化 MVP |

### 品質状況（v1.39.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **300 PASS** |
| npm test | **PASS** |

### v1.39.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-history-analytics schema 1.0 | ✅ |
| extractTrendPublicContract | ✅ |
| Historical Builder / Validator / CLI | ✅ |
| Dashboard / Trend Public Contract のみ | ✅ |
| Forecast / Prediction / Visualization 非実装 | ✅ |
| Test 289–300 | ✅ |

---

### v1.38.0 で追加（Trend Analytics Foundation）

#### Workflow Trend MVP

- **`parseTrendInputs()` / `buildWorkflowTrend()`** … Dashboard Public Contract から時系列 Trend 生成
- **`validateWorkflowTrend()`** … schema / sampleCount / trends 検証
- **`renderWorkflowTrendMarkdown()`** … trend-report.md（View のみ）
- **`printWorkflowTrendSummary()`** … CLI Summary
- **schema** … `developer-automation/workflow-trend/1.0`
- **出力** … `reports/workflow-trend/workflow-trend.json` / `trend-report.md`
- **非スコープ** … Forecast / Prediction / Anomaly Detection / ML

#### v1.39.0 以降の候補

| 候補 | 方針 |
|------|------|
| Historical Analytics Foundation | Priority 1 残り — 履歴横断分析 |
| Visualization Foundation | 集計結果の可視化 |
| Release Automation Foundation | Human Approval Gate 維持 |

### 品質状況（v1.38.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **288 PASS** |
| npm test | **PASS** |

### v1.38.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-trend schema 1.0 | ✅ |
| Trend Builder / Validator / CLI | ✅ |
| workflow-trend JSON / trend-report.md | ✅ |
| Dashboard Public Contract のみ入力 | ✅ |
| Forecast / Prediction / Anomaly 非実装 | ✅ |
| Test 278–288 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.37.1 で追加（Architecture Documentation Release）

#### Documentation MVP

- **`docs/architecture/README.md`** … Architecture Documentation 入口
- **`docs/architecture/PRINCIPLES.md`** … Developer Automation Rules
- **`docs/architecture/LAYER_MODEL.md`** … レイヤー構造・Public Contract
- **`docs/architecture/DEVELOPMENT_WORKFLOW.md`** … ChatGPT / Claude Code フロー
- **`docs/architecture/ROADMAP.md`** … 優先順位・完了条件
- **Production Code** … 変更なし

#### Next Candidate

| 候補 | 方針 |
|------|------|
| **v1.38.0 Trend Analytics Foundation** | Priority 1 残り — 時系列トレンド集計 |

### 品質状況（v1.37.1 最新）

| 項目 | 結果 |
|------|------|
| Production Code Changes | **なし** |
| Quality Pipeline Tests | **277 PASS**（テストスクリプト未変更） |
| Architecture Documentation | **5 files** |

### v1.37.1 完成判定

| 項目 | 状態 |
|------|------|
| docs/architecture 追加 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |
| src / scripts 未変更 | ✅ |
| テスト未変更 | ✅ |

---

### v1.37.0 で追加（Developer Analytics Foundation）

#### Workflow Analytics MVP

- **`buildWorkflowAnalytics()`** … Dashboard Public Contract から Pure 集計（JSON のみ）
- **`readWorkflowAnalytics()`** … workflow-analytics.json Reader
- **`validateWorkflowAnalytics()`** … schema / metadata / summary / metrics / health 検証
- **`writeWorkflowAnalyticsReport()`** … workflow-analytics.json / .md 出力
- **`extractDashboardPublicContract()`** … Dashboard Public Contract（ADR-0008）
- **schema** … `developer-automation/workflow-analytics/1.0`
- **Dashboard のみ入力** … Timeline / History / Checkpoint / State 非参照

#### v1.38.0 以降の候補

| 候補 | 方針 |
|------|------|
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Web Dashboard Foundation | Analytics / Dashboard JSON を入力とする Web UI |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.37.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **277 PASS** |
| npm test | **PASS** |

### v1.37.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-analytics schema 1.0 | ✅ |
| Analytics Builder / Reader / Validator | ✅ |
| workflow-analytics JSON / Markdown | ✅ |
| Dashboard Public Contract のみ参照 | ✅ |
| Timeline / History / Checkpoint / State 非参照 | ✅ |
| ADR-0007 / ADR-0008 | ✅ |
| Test 263–277 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.36.0 で追加（Developer Dashboard Foundation）

#### Workflow Dashboard MVP

- **`buildWorkflowDashboard()`** … Timeline を唯一入力とする Pure 集計
- **`readWorkflowDashboard()`** … workflow-dashboard.json Reader
- **`validateWorkflowDashboard()`** … Dashboard schema / 必須項目検証
- **`writeWorkflowDashboardReport()`** … workflow-dashboard.json / .md 出力
- **`renderWorkflowDashboardMarkdown()`** … JSON Source から Markdown View 生成
- **schema** … `developer-automation/workflow-dashboard/1.0`
- **Timeline Single Source of Truth** … History / Checkpoint / State は非参照
- **Timeline Schema 1.0 不変** … Timeline イベント構造は補正しない

#### v1.37.0 以降の候補（Dashboard）

| 候補 | 方針 |
|------|------|
| Developer Analytics Foundation | ✅ v1.37.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Web Dashboard Foundation | Analytics / Dashboard JSON を入力とする Web UI |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.36.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **262 PASS** |
| npm test | **PASS** |

### v1.36.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-dashboard schema 1.0 | ✅ |
| Dashboard Builder / Reader / Validator | ✅ |
| workflow-dashboard JSON / Markdown | ✅ |
| Timeline のみ入力 / History 非参照 | ✅ |
| Timeline Schema 1.0 不変 | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 246–262 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.35.0 で追加（Developer Workflow Timeline Foundation）

#### Workflow Timeline MVP

- **`buildWorkflowTimeline()`** … History を Timeline Source へ Pure 変換
- **`readWorkflowTimelineSource()`** … workflow-history.json Reader
- **`validateWorkflowTimeline()`** … Timeline schema / 必須項目検証
- **`writeWorkflowTimelineReport()`** … workflow-timeline.json / .md 出力
- **schema** … `developer-automation/workflow-timeline/1.0`
- **JSON → Markdown** … Timeline View は JSON Source のみから生成
- **History / Checkpoint 責務分離** … Timeline は表示基盤のみ

#### v1.36.0 以降の候補（Timeline）

| 候補 | 方針 |
|------|------|
| Developer Dashboard Foundation | ✅ v1.36.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Analytics Foundation | Dashboard / Timeline 上の分析層 |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.35.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **245 PASS** |
| npm test | **PASS** |

### v1.35.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-timeline schema 1.0 | ✅ |
| Timeline Builder / Reader / Validator | ✅ |
| workflow-timeline JSON / Markdown | ✅ |
| History 空でも生成可能 | ✅ |
| Checkpoint / History 責務分離維持 | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 219–245 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.34.0 で追加（Developer Workflow History Foundation）

#### Workflow History MVP

- **`readWorkflowHistory()` / `appendWorkflowHistoryRun()`** … History Reader / Writer
- **`normalizeWorkflowHistory()` / `validateWorkflowHistory()`** … legacy 正規化と検証
- **`buildWorkflowHistoryRun()`** … workflow 実行結果から run 生成
- **`recordWorkflowHistoryRun()`** … append + report 書き込み
- **schema** … `developer-automation/workflow-history/1.0`
- **JSON → Markdown** … workflow-history.json / workflow-history.md
- **Checkpoint 責務分離** … History は過去実行記録のみ

#### v1.35.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Developer Workflow Timeline Foundation | ✅ v1.35.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Dashboard Foundation | Timeline Foundation 上の集計・表示層 |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.34.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **218 PASS** |
| npm test | **PASS** |

### v1.34.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-history schema 1.0 | ✅ |
| History Writer / Reader / Validator | ✅ |
| workflow-history JSON / Markdown | ✅ |
| Checkpoint 責務分離 | ✅ |
| Resume Foundation 維持 | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 209–218 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.33.0 で追加（Workflow Checkpoint Foundation）

#### Workflow Checkpoint MVP

- **`validateWorkflowCheckpoint()`** … state 位置・互換性・resume 安全性の Pure Validator
- **`normalizeWorkflowState()`** … legacy state の欠落フィールド補完
- **`computeStepRegistryHash()`** … Step Registry 整合性ハッシュ
- **workflow-state schema 1.2** … currentStepId / resumeSupported / stepRegistryHash 等
- **workflow-checkpoint.json / .md** … Checkpoint JSON Source / Markdown View
- **legacy 1.0 互換** … warning 付きで resume 可能

#### v1.34.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Developer Workflow History Foundation | ✅ v1.34.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Timeline / Dashboard | History Foundation 上の表示層 |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.33.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **208 PASS** |
| npm test | **PASS** |

### v1.33.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-state schema 1.2 | ✅ |
| checkpoint validator | ✅ |
| legacy state compatibility | ✅ |
| workflow-checkpoint JSON / Markdown | ✅ |
| Resume Foundation 維持 | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 199–208 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.32.0 で追加（Developer Workflow Resume Foundation）

#### Workflow Resume MVP

- **`buildWorkflowState()`** … STOPPED 時の workflow-state.json 生成
- **`validateResumeState()`** … Resume 前バリデーション
- **`resolveResumeCursor()`** … stoppedBeforeStepId から再開位置を解決
- **`runDeveloperWorkflowResume()`** … 完了済み Step をスキップして再開
- **schema** … `developer-automation/workflow-state/1.0` / `developer-automation/workflow-resume/1.0`
- **`npm run developer:workflow -- --resume`** … Resume CLI
- **`--resume-state`** … workflow-state.json パス指定
- **JSON → Markdown** … workflow-resume.json / workflow-resume.md

#### v1.33.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Workflow Checkpoint Foundation | ✅ v1.33.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.32.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **198 PASS** |
| npm test | **PASS** |

### v1.32.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow-state.json 生成 | ✅ |
| Resume Validator | ✅ |
| Resume CLI | ✅ |
| workflow-resume JSON / Markdown | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 189–198 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.31.0 で追加（Developer Handoff Prompt Foundation）

#### Handoff Prompt MVP

- **`buildDeveloperHandoff()`** … 引き継ぎ JSON Source 生成
- **`buildDeveloperHandoffMarkdown()`** … Claude Code 用 Markdown View
- **`writeDeveloperHandoffReport()`** … 固定出力パスへ書き込み
- **schema** … `developer-automation/handoff/1.0`
- **`computeNextMinorVersion()`** … currentVersion から nextVersion を minor +1 で自動算出
- **`--next-version`** … CLI で nextVersion を明示指定（`vX.Y.Z` のみ）
- **`npm run developer:handoff`** … 引き継ぎプロンプト生成 CLI
- **JSON → Markdown** … Single Source of Truth 維持

#### v1.32.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Developer Workflow Resume Foundation | ✅ v1.32.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.31.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **188 PASS** |
| npm test | **PASS** |

### v1.31.0 完成判定

| 項目 | 状態 |
|------|------|
| developer:handoff npm script | ✅ |
| developer-handoff JSON / Markdown | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 171–188 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.30.0 で追加（Developer Workflow Guard Foundation）

#### Workflow Guard MVP

- **`DEFAULT_WORKFLOW_OPTIONS`** … dryRun / failFast / stopBeforeStep / skipSteps / guardHooks
- **`shouldSkipStep()` / `shouldStopBeforeStep()` / `shouldExecuteStep()`** … 純粋 Guard 関数
- **`GUARD_REASON`** … NONE / SKIP_STEP / STOP_BEFORE_STEP（Step guard reason 定数）
- **`STEP_STATUS`** … PASS / FAIL / SKIPPED / STOPPED
- **`WORKFLOW_STATUS`** … SUCCESS / FAILURE / STOPPED
- **Guard Decision** … 各 Step Result に guard（shouldExecute / reason）を保持
- **`WORKFLOW_STOP_REASON`** … NONE / FAIL_FAST / STOP_BEFORE_STEP（Workflow stopReason 定数）
- **`buildGuardSummary()`** … Executed / Skipped / Stopped 集計
- **schema** … `developer-automation/workflow/1.1`（Guard 対応版）
- **Fail Fast / Stop Before / Skip Step** … Workflow 安全制御
- **JSON → Markdown → CLI** … Single Source of Truth 維持

#### v1.31.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Developer Handoff Prompt Foundation | ✅ v1.31.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.30.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **170 PASS** |
| npm test | **PASS** |

### v1.30.0 完成判定

| 項目 | 状態 |
|------|------|
| Workflow Options / Guard | ✅ |
| Guard Decision in JSON | ✅ |
| developer-automation-report 更新 | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 136–170 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.29.0 で追加（Developer Automation Workflow Foundation）

#### Workflow MVP

- **`createWorkflowContext()`** … Context を唯一の状態管理として初期化
- **`WORKFLOW_STEP_REGISTRY`** … version-consistency / release-readiness / release-plan を順次実行
- **`buildStepResult()`** … 標準化された Step Result（id / name / status / detail）
- **`STEP_STATUS`** … pass / fail / skip 定数
- **`WORKFLOW_STATUS`** … success / failure 定数
- **`context.results[]`** … 各 Step Result を蓄積
- **`developer-automation-report.json`** … machine-readable 集約 report
- **`developer-automation-report.md`** … human-readable 集約 report
- **CLI** … Step Results Summary
- **`npm run developer:workflow -- --skip-npm-test`** … Developer Automation Workflow MVP

#### v1.30.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Developer Workflow Guard Foundation | ✅ v1.30.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.29.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **148 PASS** |
| npm test | **PASS** |

### v1.29.0 完成判定

| 項目 | 状態 |
|------|------|
| developer:workflow npm script | ✅ |
| Context ベース Workflow MVP | ✅ |
| developer-automation-report | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 136–148 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.28.0 で追加（Release Plan Foundation）

#### Release Plan MVP

- **`buildReleasePlan()`** … Release 作業計画を生成（データ生成のみ）
- **`readReleaseReadinessReport()`** … `release-readiness.json` を読み取り前提条件とする
- **`getStepReason()`** … step ごとの reason を決定
- **`RELEASE_PLAN_STEPS`** … 固定 step id（git-commit / git-tag / git-push / github-release / publish）
- **`release-plan.json`** … machine-readable report（schema 定数化）
- **`release-plan.md`** … human-readable report
- **CLI** … Summary 表示（Planned Steps + reason）
- **`npm run release:plan`** … Release Plan 生成 MVP

#### v1.29.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Developer Automation Workflow Foundation | ✅ v1.29.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.28.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **135 PASS** |
| npm test | **PASS** |

### v1.28.0 完成判定

| 項目 | 状態 |
|------|------|
| release:plan npm script | ✅ |
| Release Plan MVP | ✅ |
| release-plan reports | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 125–135 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.27.0 で追加（Release Readiness Foundation）

#### Release Readiness MVP

- **`checkWorkingTree()`** … Git working tree が clean か判定
- **`checkVersionConsistency()`** … v1.26.0 の 3-way consistency を再利用（重複実装なし）
- **`checkRequiredReports()`** … 必須レポート配列 `REQUIRED_REPORTS` の存在確認
- **`checkNpmTest()`** … `npm test` 成功判定（CLI は `--skip-npm-test` で再帰回避）
- **`evaluateReleaseReadiness()`** … 上記 4 チェックを統合、`ready` / `not-ready` を返す
- **`release-readiness.json`** … machine-readable report（schema 定数化）
- **`release-readiness.md`** … human-readable report
- **CLI** … Summary 表示（✔/✘ + `Status: READY` / `NOT READY`）
- **`npm run release:readiness -- --skip-npm-test`** … Release 可能判定 MVP

#### v1.28.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Release Plan Foundation | ✅ v1.28.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.27.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **124 PASS** |
| npm test | **PASS** |

### v1.27.0 完成判定

| 項目 | 状態 |
|------|------|
| release:readiness npm script | ✅ |
| 4-check Release Readiness MVP | ✅ |
| release-readiness reports | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 117–124 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.26.0 で追加（Developer Automation Foundation）

#### 3-way Version Consistency

- **`getLatestGitTag()`** … 最新 Git Tag 取得
- **`getVersionFromVersionMd()`** … VERSION.md current version 読み取り
- **`getChangelogLatestVersion()`** … CHANGELOG 先頭 version セクション確認
- **3-way 判定** … Git Tag / VERSION.md / CHANGELOG.md 一致で `ok`、不一致で `warning`
- **`version-consistency.json`** … machine-readable report
- **`version-consistency.md`** … human-readable report
- **CLI** … `Version Check OK` / `Version Check WARNING`
- **`npm run dev:next -- --dry-run`** … dev-next + version consistency 実行

#### v1.27.0 以降の候補（履歴）

| 候補 | 方針 |
|------|------|
| Release Readiness Foundation | ✅ v1.27.0 で実装済み |
| Release Automation Foundation | git commit / tag / push の段階導入（Human Approval Gate 維持） |
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |

### 品質状況（v1.26.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **116 PASS** |
| npm test | **PASS** |

### v1.26.0 完成判定

| 項目 | 状態 |
|------|------|
| dev:next npm script | ✅ |
| 3-way Version Consistency | ✅ |
| version-consistency reports | ✅ |
| git commit/tag/push 非実装 | ✅ |
| Test 107–116 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.24.0 で追加（GitHub Actions Node24 Production Readiness）

#### 本番 workflow Node24-ready

- **checkout@v5** / **setup-node@v5** / **upload-artifact@v6**
- **setup-node cache** … npm + package-lock.json 維持
- **upload-artifact@v7** … 今回見送り
- **runner v2.327.1+** … 実行要件
- **experimental workflow** … 非変更

#### v1.25.0 以降の候補（Phase2）

| 候補 | 方針 |
|------|------|
| Phase2 AIコンテンツ生成フェーズ | カルーセル / 品質パイプライン本機能の次期拡張 |
| workflow_run 本番可否 | experimental + schedule 実績を踏まえて再評価 |
| upload-artifact@v7 再評価 | Node24 安定後に v7 移行可否を判断 |

### 品質状況（v1.24.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **98 PASS** |
| npm test | **PASS** |

### v1.24.0 完成判定

| 項目 | 状態 |
|------|------|
| 本番 Node24-ready Actions | ✅ |
| experimental 非変更 | ✅ |
| setup-node cache 維持 | ✅ |
| schema / permissions 維持 | ✅ |
| Test 94–98 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.23.0 で追加（Node24 Migration Readiness）

#### experimental upload-artifact v6

- **upload-artifact@v6** … Node24 runtime（experimental workflow のみ）
- **runner v2.327.1+** … 実行要件
- **本番 workflow 非変更** … upload-artifact@v7 維持
- **FORCE_JAVASCRIPT_ACTIONS_TO_NODE24** … 未使用

#### v1.24.0 以降の候補

| 候補 | 方針 |
|------|------|
| GitHub Actions Node24 production readiness | 本番 workflow への upload-artifact / runtime 移行評価 |
| checkout / setup-node evaluation | checkout v5 / setup-node v5 の Node24 互換検証 |
| workflow_run 本番可否 | experimental + schedule 実績を踏まえて再評価 |

### 品質状況（v1.23.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **93 PASS** |
| npm test | **PASS** |

### v1.23.0 完成判定

| 項目 | 状態 |
|------|------|
| experimental upload-artifact v6 | ✅ |
| 本番 workflow 非変更 | ✅ |
| FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 未使用 | ✅ |
| Test 89–93 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.22.0 で追加（Performance Trend Experimental Workflow）

#### performance-trend-experimental.yml

- **workflow_dispatch のみ** … workflow_run 未使用
- **inputs** … `source_run_id` / `source_conclusion`
- **env** … `SOURCE_WORKFLOW_RUN_ID` / `SOURCE_WORKFLOW_CONCLUSION` / `PERFORMANCE_TREND_EXPERIMENTAL=true`
- **permissions** … `contents: read` / `actions: read`
- **cache / secrets 不使用**
- **artifact** … `performance-trend-experimental-<run_id>`（7 日 retention）
- **本番 performance-trend.yml** … 非変更

#### v1.23.0 以降の候補

| 候補 | 方針 |
|------|------|
| workflow_run 本番可否の再評価 | experimental 実績 + schedule 実績を踏まえて判断 |
| schema 1.3 検討 | `sourceWorkflowRunId` / `sourceWorkflowConclusion` を trend-data に反映 |
| experimental → production promotion | 条件付き本番統合 |

### 品質状況（v1.22.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **88 PASS** |
| npm test | **PASS** |

### v1.22.0 完成判定

| 項目 | 状態 |
|------|------|
| experimental workflow | ✅ |
| performance-trend.yml 非変更 | ✅ |
| workflow_run 未使用 | ✅ |
| schema 1.2 維持 | ✅ |
| Test 80–88 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.21.0 で追加（workflow_run Opt-in Design Review）

#### 方針

- **workflow_run 本番未導入** … `performance-trend.yml` 非変更
- **schedule / workflow_dispatch 継続** … v1.20.0 構成維持
- **schema 1.2 維持** … 既存 trend 出力互換
- **security / opt-in policy 明文化** … README 設計レビュー

#### 本番導入時の必須条件（将来）

- `types: [completed]` + conclusion success filter
- artifact は `$RUNNER_TEMP` 等で隔離
- cache 非信頼 / secrets・write 不使用 / read-only API

#### v1.22.0 以降の候補

| 候補 | 方針 |
|------|------|
| Experimental workflow_run prototype | **workflow_dispatch 限定** または **disabled-by-default** |
| schema 拡張検討 | `sourceWorkflowRunId` / `sourceWorkflowConclusion` |
| advanced scheduled trend policy | 複数 schedule / 条件付き実行 |

### 品質状況（v1.21.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **79 PASS** |
| npm test | **PASS** |

### v1.21.0 完成判定

| 項目 | 状態 |
|------|------|
| workflow_run design review | ✅ |
| workflow_run 本番非導入 | ✅ |
| schedule / dispatch 維持 | ✅ |
| schema 1.2 維持 | ✅ |
| Test 75–79 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.20.0 で追加（Scheduled Performance Trend Collection）

#### schedule

- **cron** … `23 20 * * 1`（月曜 20:23 UTC = 火曜 05:23 JST）
- **workflow_dispatch** … 手動実行維持
- **毎時 `:00` 回避** … 混雑・遅延・drop 対策

#### concurrency / security

- **concurrency group** … `performance-trend-${{ github.workflow }}`
- **workflow_run 未導入** … privilege escalation / cache poisoning リスク
- **permissions** … `contents: read` / `actions: read` 維持

#### v1.21.0 以降の候補

| 候補 | 導入条件 |
|------|----------|
| workflow_run opt-in design | CI/Nightly 完了後の自動 trend 収集（セキュリティ設計完了後） |
| advanced scheduled trend policy | 複数 schedule / 条件付き実行が必要になった場合 |
| REST API 直接集計（gh 非依存） | CI / サービスアカウントからの自動実行 |

### 品質状況（v1.20.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **74 PASS** |
| npm test | **PASS** |

### v1.20.0 完成判定

| 項目 | 状態 |
|------|------|
| weekly schedule | ✅ |
| workflow_dispatch 維持 | ✅ |
| concurrency | ✅ |
| workflow_run 非導入 | ✅ |
| Test 70–74 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.19.0 で追加（GitHub Actions Automated Performance Trend Collection）

#### performance-trend.yml

- **workflow_dispatch** … 手動実行のみ（schedule / workflow_run は未実装）
- **permissions** … `contents: read` / `actions: read`
- **GH_TOKEN** … `${{ github.token }}` を trend 解析に渡す
- **artifact upload** … `performance-trend-<run_id>`（30 日 retention）
- **Step Summary** … runs analyzed / warnings 概要

#### trend-data.json schema 1.2

- **collection.mode** … `github-actions`
- **collection.trigger** … `workflow_dispatch` 等
- **collection.workflowRunId** / **sourceWorkflow** / **collectedAt**
- **schema 1.1 互換** … ローカル gh-cli / fixture は 1.1 のまま

#### v1.20.0 で導入済み / 以降候補

| 候補 | 状態 |
|------|------|
| scheduled trend collection | ✅ v1.20.0 で週1回 schedule 導入 |
| workflow_run automation | v1.21.0 以降（opt-in 設計後） |
| REST API 直接集計（gh 非依存） | 未着手 |

### 品質状況（v1.19.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **69 PASS** |
| npm test | **PASS** |

### v1.19.0 完成判定

| 項目 | 状態 |
|------|------|
| performance-trend.yml | ✅ |
| GH_TOKEN / permissions | ✅ |
| schema 1.2 + 1.1 互換 | ✅ |
| 既存 workflow 非変更 | ✅ |
| Test 65–69 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.18.0 で追加（Artifact Metadata / Retention Awareness）

#### gh api artifact metadata

- **`gh api .../artifacts --paginate`** … expires_at / expired / digest / size_in_bytes
- **expired artifact** … warning + skip
- **expires_at 欠落** … metadata warning、trend 継続
- **metadata 取得失敗** … warning、`gh run download` で継続
- **trend-data.json** … schemaVersion 1.1、`metadataWarnings`、`recentRuns[].artifact`

#### v1.20.0 以降の候補（automation / schedule）

| 候補 | 導入条件 |
|------|----------|
| GitHub Actions 上完全自動 Trend Analysis | workflow 内で trend 生成・公開が必要になった場合 |
| REST API 直接集計（gh 非依存） | CI / サービスアカウントからの自動実行 |

### 品質状況（v1.18.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **64 PASS** |
| npm test | **PASS** |

### v1.18.0 完成判定

| 項目 | 状態 |
|------|------|
| gh api artifact metadata | ✅ |
| expired / expires_at 処理 | ✅ |
| gh run download 互換維持 | ✅ |
| Test 61–64 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.17.0 で追加（gh CLI Performance Trend Analysis）

#### gha_analyze_performance_trend.js

- **gh auth status** … 認証確認
- **gh run list --json** … 直近 Run 取得
- **gh run download** … artifact から `performance-observation.json` 取得
- **出力** … `trend-report.md` / `trend-data.json`
- **fixture モード** … テスト用（gh 実通信なし）

#### v1.18.0 以降の候補（REST API / automation）

| 候補 | 導入条件 |
|------|----------|
| GitHub REST API trend analysis | gh CLI 以外での横断集計が必要になった場合（v1.19.0 で GHA workflow 導入済み — workflow_run / schedule は v1.20.0 以降） |
| cache hit/miss 厳密可視化 | setup-node cache ログの構造化 |
| グラフ / ダッシュボード | trend-data.json の可視化 |

### 品質状況（v1.17.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **60 PASS** |
| npm test | **PASS** |

### v1.17.0 完成判定

| 項目 | 状態 |
|------|------|
| gha_analyze_performance_trend.js | ✅ |
| fixture テスト（gh 非通信） | ✅ |
| Workflow YAML 変更なし | ✅ |
| Test 57–60 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.16.0 で追加（Workflow Performance Trend Analysis Foundation）

#### performance-observation.json

- **Artifact パス** … `reports/quality-pipeline/latest/performance-observation.json`
- **schemaVersion** … `"1.0"`
- **CI durations** … npmCiSeconds / npmTestSeconds / dry-run 2 種
- **Nightly durations** … npmCiSeconds / applySeconds + pipelineExitCode（number \| null）
- **CI artifact upload** … `if: always()` — 失敗 run でも JSON 確認可能
- **手動比較** … artifact DL して packageLockHash + durations を run 間比較

#### v1.17.0 以降の候補（REST API）

| 候補 | 導入条件 |
|------|----------|
| gh CLI / REST API trend analysis | 複数 run の JSON を自動収集・集計したい場合（v1.17.0 で gh CLI ローカル分析導入済み — REST API は v1.18.0 以降） |
| cache hit/miss 厳密可視化 | setup-node cache ログの構造化が必要になった場合 |
| グラフ / ダッシュボード | trend 基盤の上に可視化を載せる場合 |

### 品質状況（v1.16.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **56 PASS** |
| npm test | **PASS** |

### v1.16.0 完成判定

| 項目 | 状態 |
|------|------|
| performance-observation.json（両 workflow） | ✅ |
| CI artifact if: always() | ✅ |
| Summary v1.15.0 維持 | ✅ |
| Test 56 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.15.0 で追加（GitHub Actions CI Performance Observation Summary）

#### Performance / Cache Observation

- **Summary セクション拡張** … Node / npm version、npm cache enabled、cache-dependency-path、package-lock hash
- **npm ci duration** … Step timings と連携してハイライト
- **Nightly** … apply duration、job result、pipeline exit code、quality status を Performance セクションに整理
- **cache-hit 厳密取得** … 未実装（run 間比較で間接確認）

#### v1.16.0 以降の候補

| 候補 | 導入条件 |
|------|----------|
| cache hit/miss 厳密可視化 | setup-node cache ログの構造化が必要になった場合 |
| 実行時間トレンド | gh CLI / REST API で複数 run を集計したい場合 |

### 品質状況（v1.15.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **55 PASS** |
| npm test | **PASS** |

### v1.15.0 完成判定

| 項目 | 状態 |
|------|------|
| Performance / Cache Observation（両 workflow） | ✅ |
| npm ci duration ハイライト | ✅ |
| Workflow 成否 / exit code 維持 | ✅ |
| Test 55 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.14.0 で追加（GitHub Actions CI 可観測性向上）

#### Step Summary

- **`GITHUB_STEP_SUMMARY`** … Run Summary + Step timings（Markdown テーブル）
- **`if: always()`** … 失敗時も Summary 残存
- **実行時間計測** … npm ci / npm test / quality pipeline dry-run・apply
- **cache-hit 厳密取得** … v1.14.0 では未実装（`npm ci` Duration の run 間比較で間接確認）

#### v1.15.0 以降の候補

| 候補 | 導入条件 |
|------|----------|
| cache hit/miss 厳密可視化 | setup-node cache ログの構造化が必要になった場合（v1.15.0 で Performance / Cache Observation 導入済み — 厳密取得は v1.16.0 以降） |
| 実行時間トレンド | 複数 run の Duration を集計・可視化したい場合（v1.15.0 で npm ci / apply duration ハイライト導入済み） |
| Grouped Updates（Dependabot） | PR 数増加でレビュー負荷が高い場合 |

### 品質状況（v1.14.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **54 PASS** |
| npm test | **PASS** |
| YAML Validation | **PASS** |

### v1.14.0 完成判定

| 項目 | 状態 |
|------|------|
| Step Summary（両 workflow） | ✅ |
| if: always() | ✅ |
| 実行時間計測 | ✅ |
| Workflow 成否 / exit code 維持 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.13.0 で追加（GitHub Actions npm cache 最適化）

#### setup-node npm cache

- **`cache: npm`** … GitHub 公式の npm キャッシュ（`actions/setup-node@v6` 組み込み）
- **`cache-dependency-path: package-lock.json`** … lockfile 変更で cache key が切り替わる
- **`node_modules` 非キャッシュ** … インストールは `npm ci` 維持
- **`actions/cache` 直接利用なし**

#### v1.14.0 以降の候補（npm cache 関連）

| 候補 | 導入条件 |
|------|----------|
| cache hit/miss 可視化 | workflow ログや Summary でキャッシュ効率を確認したい場合（v1.14.0 で簡易版導入済み — 厳密取得は v1.15.0 以降） |
| 実行時間計測 | CI / Nightly Apply の step 時間を継続監視したい場合（v1.14.0 で Step timings 導入済み） |
| Grouped Updates（Dependabot） | PR 数増加でレビュー負荷が高い場合 |
| ignore（Dependabot） | 特定依存で継続失敗・非互換が出た場合 |
| Auto Merge | CI 安定・レビュー基準・権限設計が固まった後 |

### 品質状況（v1.13.0）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **53 PASS** |
| npm test | **PASS** |

### v1.13.0 完成判定

| 項目 | 状態 |
|------|------|
| setup-node npm cache | ✅ |
| cache-dependency-path 明示 | ✅ |
| npm ci / workflow 挙動維持 | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.12.1 で追加（Dependabot 運用品質向上）

#### ドキュメント強化（設定変更なし）

- Dependabot PR は GitHub Actions CI の対象であることを明記
- Dependabot 起点 workflow の `GITHUB_TOKEN` read-only 前提
- GitHub Actions secrets は Dependabot PR 非利用 — 必要時は Dependabot secrets
- 現 CI は secrets 不使用のため Dependabot PR 運用上の問題は小さい
- CI 失敗時の確認順（更新種別 → 差分 → 原因切り分け → merge / ignore 検討）
- 将来導入候補の整理（Grouped Updates / ignore / reviewers / Auto Merge 等）

#### v1.13.0 以降の候補（Dependabot 関連）

| 候補 | 導入条件 |
|------|----------|
| Grouped Updates | PR 数増加でレビュー負荷が高い場合 |
| ignore | 特定依存で継続失敗・非互換が出た場合 |
| Auto Merge | CI 安定・レビュー基準・権限設計が固まった後 |
| reviewers / assignees | 複数人運用時 |
| Dependabot secrets | Dependabot PR で secrets 必須 CI が必要になった場合 |

### 品質状況（v1.12.1）

- `.github/dependabot.yml` 変更なし
- README / CHANGELOG / VERSION 更新済み

### v1.12.1 完成判定

| 項目 | 状態 |
|------|------|
| Dependabot 運用ドキュメント | ✅ |
| dependabot.yml 変更なし | ✅ |
| 将来導入候補整理 | ✅ |

---

### v1.12.0 で追加（Dependabot 依存関係自動更新設定）

- `.github/dependabot.yml` を追加
- GitHub Actions の依存関係更新を weekly で検知
- npm パッケージの依存関係更新を weekly で検知
- 実行タイムゾーンは `Asia/Tokyo`
- open pull requests limit は ecosystem ごとに 5
- 初期リリースでは Auto Merge / Grouped Updates / ignore は未導入

### 品質状況（v1.12.0）

- Dependabot 設定追加
- GitHub Actions / npm を分離管理
- 手動レビュー前提の安全運用

### v1.12.0 完成判定

Dependabot による依存関係自動更新設定を追加済み。

---

### v1.11.0 で追加（upload-artifact Node.js 24 対応）

#### Actions 更新

- **`actions/upload-artifact`** … `v4` → `v7`（Node.js 24 対応 — Node.js 20 runtime warning 解消）
- **`actions/checkout@v5`** / **`actions/setup-node@v6`** … 変更なし
- **`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`** … 導入しない

#### 変更なし

- Quality Pipeline の実行ロジック
- exit code 0 / 1 / 3 / 4 の意味
- Nightly Apply の Workflow Success / Failure 判定
- GitHub Step Summary の表示仕様
- Node.js 実行バージョン（`node-version: "20"`）
- upload-artifact の `with` オプション

### 品質状況（v1.11.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **53 PASS** |
| YAML Validation | **PASS** |

### v1.11.0 完成判定

| 項目 | 状態 |
|------|------|
| upload-artifact v7 更新 | ✅ |
| checkout v5 / setup-node v6 維持 | ✅ |
| Workflow ロジック変更なし | ✅ |
| 53 Tests PASS | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |

---

### v1.10.0 で追加（GitHub Actions runtime maintenance）

#### Actions 更新

- **`actions/checkout`** … `v4` → `v5`
- **`actions/setup-node`** … `v4` → `v6`
- **`actions/upload-artifact`** … `v4` 維持

#### 変更なし

- Quality Pipeline の実行ロジック
- exit code 0 / 1 / 3 / 4 の意味
- Nightly Apply の Workflow Success / Failure 判定
- GitHub Step Summary の表示仕様
- Node.js 実行バージョン（`node-version: "20"`）

### 品質状況（v1.10.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **53 PASS** |

### v1.10.0 完成判定

| 項目 | 状態 |
|------|------|
| checkout v5 / setup-node v6 更新 | ✅ |
| upload-artifact v4 維持 | ✅ |
| Workflow ロジック変更なし | ✅ |
| 53 Tests PASS | ✅ |
| README / CHANGELOG / VERSION 更新 | ✅ |


### v1.9.4 で追加（Workflow 成否と品質判定の分離）

#### Nightly Apply 成否仕様

- **exit code 0 / 3** … Workflow Success（3 は品質改善推奨 — システムエラーではない）
- **exit code 1 / 4** … Workflow Failure（Health Check / 内部エラー）
- **Summary** … 終了コード 3 時 `Improvement Recommended` / `publishRecommended=false` を明示
- **Test 51–53** … 改善推奨 Success / Health Check Failure / 内部エラー Failure

### 品質状況（v1.9.4 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **53 PASS** |

### v1.9.4 完成判定

| 項目 | 状態 |
|------|------|
| Nightly Apply exit 3 → Success | ✅ |
| Summary 改善推奨表示 | ✅ |
| Health Check / 内部エラー Failure 維持 | ✅ |
| Test 51–53 | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.9.3 で追加（Pipeline 成功判定整合）

#### 成功判定と exit code

- **`isPipelineSuccessfulOutcome()`** … `ALL_SLIDES_PUBLISH_RECOMMENDED` 等で成功判定
- **`finalizeSuccessfulPipelineState()`** … stale `failedSteps` をクリアし `completed` / `COMPLETE` に確定
- **exit code** … 成功 **0** / `failedSteps` 残存 **4**
- **Test 48–50** … 成功・失敗・Nightly Apply exit 伝播

### 品質状況（v1.9.3 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **50 PASS** |

### v1.9.3 完成判定

| 項目 | 状態 |
|------|------|
| 成功判定関数 | ✅ |
| state 確定 | ✅ |
| exit code 整合 | ✅ |
| Test 48–50 | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.9.2 で追加（運用品質パッチ）

#### GitHub Actions Health Check

- **`GITHUB_ACTIONS=true`** … `.env` 未作成でも Error にしない
- **API キー** … `OPENAI_API_KEY` 必須 + `GEMINI_API_KEY` / `NANO_BANANA_API_KEY` OR 条件
- **ローカル** … `.env` 未作成時は従来どおり Error
- **Test 45–47** … GHA / ローカル / Secrets 不足の 3 パターン

### 品質状況（v1.9.2 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **47 PASS** |

**確認済み**

- `npm test` … **PASS**（47 tests）
- Test 45–47 GitHub Actions Health Check … **PASS**

### v1.9.2 完成判定

| 項目 | 状態 |
|------|------|
| GHA .env 非必須 | ✅ |
| OPENAI 必須 | ✅ |
| GEMINI / NANO OR 条件 | ✅ |
| ローカル .env 必須維持 | ✅ |
| Test 45–47 | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.9.1 で追加（運用品質パッチ）

#### Nightly Apply YAML 修正

- **heredoc インデント修正** … `Create failure summary` 内 `node <<'NODE'` ブロックを `run: |` 内に正しくインデント
- **workflow valid** … GitHub Actions が workflow file invalid で 0 秒終了しない
- **Test 44 拡張** … heredoc インデント検出 + Ruby YAML parse

### 品質状況（v1.9.1 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **44 PASS** |

**確認済み**

- `npm test` … **PASS**（44 tests）
- `nightly-apply.yml` Ruby YAML parse … **PASS**

### v1.9.1 完成判定

| 項目 | 状態 |
|------|------|
| heredoc インデント修正 | ✅ |
| YAML valid | ✅ |
| Health Check Errors 仕様維持 | ✅ |
| Secrets OR 条件維持 | ✅ |
| Test 44 拡張 | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.9.0 で追加（Health Check エラー可視化）

#### Health Check エラー可視化

- **`health_check.js` JSON 出力** … `--json` / `HEALTH_CHECK_JSON=1`、`items[]` 構造化
- **pipeline HEALTH_CHECK** … JSON パース + regex fallback、`healthCheck.errors` を metrics 保存
- **GHA ログ** … `[QualityPipeline] [apply] HEALTH_CHECK: ❌ <label>: <detail>`
- **Summary** … `health check errors:` 一覧
- **failure summary** … `metrics.json` から **Health Check Errors** 節
- **Test 40–44** … JSON / metrics / Secret 非露出 / workflow 契約

### 品質状況（v1.9.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **44 PASS** |

**確認済み**

- `npm test` … **PASS**（44 tests）
- Test 40–44 Health Check 可視化契約 … **PASS**

### v1.9.0 完成判定

| 項目 | 状態 |
|------|------|
| health_check JSON 出力 | ✅ |
| pipeline errors 保存・ログ | ✅ |
| Summary 個別エラー表示 | ✅ |
| failure summary Health Check Errors | ✅ |
| Test 40–44 | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.8.2 で追加（運用品質パッチ）

#### Nightly Apply Secrets OR 条件

- **`OPENAI_API_KEY` 単独必須** … apply 前チェック
- **`GEMINI_API_KEY` or `NANO_BANANA_API_KEY`** … いずれか一方があれば OK（nano_banana adapter 仕様に準拠）
- **apply env** … 3 キーすべて注入（変更なし）
- **failure summary** … OPENAI 未設定 / GEMINI・NANO 両方未設定を分離表示
- **Test 39 更新** … OR 条件・env 注入・summary 反映を確認

### 品質状況（v1.8.2 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **39 PASS** |

**確認済み**

- `npm test` … **PASS**（39 tests）
- Test 39 nightly-apply workflow contract（OR 条件） … **PASS**

### v1.8.2 完成判定

| 項目 | 状態 |
|------|------|
| OPENAI_API_KEY 単独必須 | ✅ |
| GEMINI / NANO OR 条件 | ✅ |
| apply env 3 キー注入 | ✅ |
| failure summary 分離表示 | ✅ |
| Test 39 更新 | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.8.1 で追加（運用品質パッチ）

#### Nightly Apply Secrets 修正

- **必須 Secrets** … `NANO_BANANA_API_KEY` を Nightly Apply Workflow に追加
- **apply env 注入** … nano_banana adapter の apply 実行をサポート
- **failure summary** … Secret 不足検出に `NANO_BANANA_API_KEY` を含める
- **Test 39 更新** … workflow contract で検証・env 注入・summary 反映を確認

### 品質状況（v1.8.1 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **39 PASS** |

**確認済み**

- `npm test` … **PASS**（39 tests）
- Test 39 nightly-apply workflow contract（NANO_BANANA_API_KEY 含む） … **PASS**

### v1.8.1 完成判定

| 項目 | 状態 |
|------|------|
| NANO_BANANA_API_KEY Secrets チェック | ✅ |
| apply env 注入 | ✅ |
| failure summary 反映 | ✅ |
| Test 39 更新 | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.8.0 で追加（Nightly Apply Workflow）

#### Nightly Apply Workflow

**主な追加機能**

- **apply 専用 workflow** … `.github/workflows/nightly-apply.yml`
- **dry-run CI との分離** … `quality-pipeline-ci.yml` は変更なし（Secrets 不要）
- **必須 Secrets** … `OPENAI_API_KEY` / `GEMINI_API_KEY`
- **schedule** … JST 03:00（UTC 18:00）
- **workflow_dispatch** … input `resume`（boolean、デフォルト false）
- **通常 apply** … `--apply --clean-latest`
- **Resume apply** … `--apply --resume`（`--clean-latest` なし）
- **安全設計** … main guard / Secrets check / failure summary / `if: always()` artifacts
- **テスト** … Test 39（**39 PASS**）

**Artifacts 保存対象**

- `report.md` / `report.json` / `metrics.json` / `state.json` / `export/` / `failure-summary.md`

### 品質状況（v1.8.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **39 PASS** |
| GitHub Actions dry-run CI | **Green 完走**（Secrets 不要） |
| Nightly Apply Workflow | workflow 定義・contract test 済み |

**確認済み**

- `npm test` … **PASS**（39 tests）
- `npm run quality-pipeline:dry-run` … **PASS**
- Test 39 nightly-apply workflow contract … **PASS**

### v1.8.0 完成済み機能一覧

| 機能 | 状態 |
|------|------|
| Smart Auto Fix | ✅ |
| Regeneration Engine | ✅ |
| Nano Banana Adapter | ✅ |
| OpenAI Adapter | ✅ |
| Gemini ReReview | ✅ |
| scoreSummary | ✅ |
| Resume Execution | ✅ |
| `--stop-before-phase` | ✅ |
| GitHub Actions dry-run CI | ✅ |
| Nightly Apply Workflow | ✅ |
| report.json | ✅ |
| report.md | ✅ |
| metrics.json | ✅ |
| state.json | ✅ |
| export | ✅ |
| failure-summary.md（workflow） | ✅ |
| latest archive | ✅ |
| dry-run | ✅ |
| apply | ✅ |
| CLI help | ✅ |

### 未実装一覧（v1.8.0 時点）

| 項目 | 状態 |
|------|------|
| Pipeline Notification | 未実装 |
| 自動リリース | 未実装 |

### 次期バージョン

**Next Release: v1.9.0**

候補例:

- Pipeline Notification
- 自動リリース
- apply workflow の追加パラメータ（from-phase / max-rounds 等）

### v1.8.0 完成判定

| 項目 | 状態 |
|------|------|
| nightly-apply.yml 追加 | ✅ |
| Secrets チェック | ✅ |
| main branch guard | ✅ |
| failure summary | ✅ |
| resume workflow_dispatch input | ✅ |
| Artifacts（if: always） | ✅ |
| Test 39 workflow contract | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.7.0 で追加（GitHub Actions / CI）

#### `--stop-before-phase`

**主な追加機能**

- **意図的中断** … `--stop-before-phase <phase>` で指定 Phase 直前に停止
- **`stopReason: before-phase`** … `state.json` に中断理由を記録
- **`stopBeforePhase`** … 停止対象 Phase を記録
- **自然 Resume** … 手動 state 改変なしで `--resume` 可能
- **GitHub Actions** … `.github/workflows/quality-pipeline-ci.yml`
- **CI 完走** … Secrets なし Green（`npm test` → stop → resume → Artifacts）
- **`npm test`** … `test:quality-pipeline` エイリアス
- **テスト追加** … Test 34–38（**38 PASS**）

### 品質状況（v1.7.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **38 PASS** |
| GitHub Actions CI | **Green 完走**（Secrets 不要） |

**確認済み**

- `npm test` … **PASS**
- `npm run quality-pipeline:dry-run -- --stop-before-phase report` … **PASS**
- `npm run quality-pipeline:dry-run -- --resume` … **PASS**

### v1.7.0 完成済み機能一覧

| 機能 | 状態 |
|------|------|
| Smart Auto Fix | ✅ |
| Regeneration Engine | ✅ |
| Nano Banana Adapter | ✅ |
| OpenAI Adapter | ✅ |
| Gemini ReReview | ✅ |
| scoreSummary | ✅ |
| Resume Execution | ✅ |
| `--stop-before-phase` | ✅ |
| GitHub Actions CI | ✅ |
| report.json | ✅ |
| report.md | ✅ |
| metrics.json | ✅ |
| state.json | ✅ |
| export | ✅ |
| latest archive | ✅ |
| dry-run | ✅ |
| apply | ✅ |
| CLI help | ✅ |

### 未実装一覧（v1.7.0 時点・履歴）

| 項目 | 状態 |
|------|------|
| Nightly apply pipeline | v1.8.0 で実装済み |
| CI apply（API キー使用） | v1.8.0 Nightly Apply Workflow で実装（dry-run CI とは分離） |

### v1.7.0 完成判定（履歴）

| 項目 | 状態 |
|------|------|
| `--stop-before-phase` 実装 | ✅ |
| stopReason / stopBeforePhase 保存 | ✅ |
| Test 34 stop → resume 置換 | ✅ |
| GitHub Actions workflow | ✅ |
| GitHub Actions Green 完走 | ✅ |
| npm test エイリアス | ✅ |
| ドキュメント更新 | ✅ |

---

### v1.6.0 で追加（Resume Execution）

#### Resume Execution

**主な追加機能**

- **Resume Engine** … `src/lib/pipeline_resume.js`
- **`state.json`** … `reports/quality-pipeline/latest/state.json`（resume 専用 checkpoint）
- **checkpoint 保存** … Phase 成功 / 失敗 / 完了時に更新
- **`checkpointRound` 復元** … 改善ループを `roundsExecuted` 基準で継続
- **completed phase の自動 skip** … `nextPhase` 以降のみ実行
- **latest archive を Resume 時にスキップ** … `--resume` 時は `latest` を退避しない
- **CLI `--resume`** … `--clean-latest` 併用不可、`state.json` 必須
- **Resume テスト追加** … Test 29–34

**状態復元**

- `pipeline_state.json` … 実行状態・scoreSummary・改善履歴
- `metrics.json` … API 呼び出し数・ラウンド別 metrics

### 品質状況（v1.6.0 最新）

| 項目 | 結果 |
|------|------|
| Quality Pipeline Tests | **34 PASS** |

**確認済み**

- `npm run quality-pipeline:dry-run` … **PASS**
- `npm run quality-pipeline:dry-run -- --resume` … **PASS**

### v1.6.0 完成済み機能一覧

| 機能 | 状態 |
|------|------|
| Smart Auto Fix | ✅ |
| Regeneration Engine | ✅ |
| Nano Banana Adapter | ✅ |
| OpenAI Adapter | ✅ |
| Gemini ReReview | ✅ |
| scoreSummary | ✅ |
| Resume Execution | ✅ |
| report.json | ✅ |
| report.md | ✅ |
| metrics.json | ✅ |
| state.json | ✅ |
| export | ✅ |
| latest archive | ✅ |
| dry-run | ✅ |
| apply | ✅ |
| CLI help | ✅ |

### 未実装一覧（v1.6.0 時点・履歴）

| 項目 | 状態 |
|------|------|
| GitHub Actions | v1.7.0 で実装済み |

### v1.6.0 完成判定（履歴）

| 項目 | 状態 |
|------|------|
| 実装 | ✅ 完了 |
| テスト | ✅ 完了（34 tests PASS、dry-run / `--resume` dry-run exit 0） |
| README | ✅ 完了 |
| CHANGELOG | ✅ 完了 |
| VERSION | ✅ 完了 |
| Git Commit / Tag | 未実施（次フェーズ） |

---

### v1.5.0 で追加（OpenAI Regeneration Adapter）

- **OpenAI Regeneration Adapter** … `regeneration/openai_regeneration_adapter.js`（`gpt-image-1`）
- **CLI** … `--regeneration-adapter <nano_banana|openai>`（デフォルト `nano_banana`）
- **Regeneration Engine** … adapter 選択を config から解決（Smart Auto Fix 側は非変更）
- **dry-run** … OpenAI 選択時も API 未呼び出し、キー未設定時は案内のみ
- **report v1.5.0** … `regenerationAdapter`、`regenerationByAdapter`、model / dryRun
- **metrics** … `regenerationByAdapter: { nano_banana, openai }`
- **テスト** … `npm run test:quality-pipeline` **28 PASS**

### v1.4.1 で追加（運用品質パッチ）

- **report.md** … 通常 commit 不要の副産物 / dry-run・latest・archive / apply 実行判断
- **API キー案内** … TEXT チェーン（smart_auto_fix）時の Nano Banana / Gemini ヒント
- **CLI** … `--apply` バナー、Summary Next Actions
- **README** … 推奨フロー、output 整理コマンド、apply 前チェックリスト
- **陳腐化文案修正** … v1.4 以降予定 / Phase 1 表記の削除

### v1.4.0 で追加（Smart Auto Fix 統合）

- **Smart Auto Fix lib 化** … `src/lib/smart_auto_fix.js`、CLI 薄型化
- **Regeneration Engine** … `src/lib/regeneration_engine.js` + Nano Banana adapter
- **TEXT rootCause 接続** … SAF → Regeneration → adapter → Gemini ReReview → scoreSummary
- **scoreSummary source 一般化** … `smart_auto_fix_re_review` / `nano_banana_re_review`
- **report v1.4.0** … SAF / Regeneration / TEXT チェーン表示
- **export** … TEXT chain improved 採用（`improved_adopted_text_chain`）
- **metrics** … `executedSmartAutoFix` / `executedRegeneration` 等
- **テスト** … `npm run test:quality-pipeline` 21 件 PASS
- **dry-run 標準** … 維持

### 品質基準（v1.6 維持）

| 点数 / 条件 | 判定 | 対応 |
|-------------|------|------|
| **90 点以上** | 公開推奨 | export 可能（デフォルト） |
| **80 点以上** | 合格 | `--allow-partial-export` 時に export 可能 |
| **79 点以下** | 要改善 | 改善ループ対象 |
| **TEXT rootCause** | Smart Auto Fix チェーン | v1.4 接続、v1.5 で adapter 切替 |
| **Regeneration adapter** | `nano_banana`（デフォルト） / `openai` | v1.5 |
| **Resume** | `--resume` + `state.json` | v1.6 |
| **`--stop-before-phase`** | 意図的中断 + `stopReason: before-phase` | v1.7 |
| **LAYOUT / STYLE / BOOST** | Nano Banana 直呼び | v1.3 から維持 |
| **openai_regenerate** | placeholder | 未実装（改善 plan 上の別ルート） |

### v1.4 の運用イメージ

```
npm run daily                          … 従来どおり素材生成（変更なし）
  ↓
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 3
  ↓ 計画確認（TEXT は planned として表示）
npm run quality-pipeline:apply -- --from-phase image-review --max-rounds 3
  ↓ TEXT rootCause は Smart Auto Fix チェーンで改善
reports/quality-pipeline/latest/report.md を確認
  ↓ 途中停止時
npm run quality-pipeline:dry-run -- --resume   … v1.6 checkpoint から再開
output/instagram/                      … 90 点達成時（または --allow-partial-export 時）
```

### v1.3.1 で追加（運用品質パッチ）

- **latest 退避** … 上書き前に `reports/quality-pipeline/archive/YYYY-MM-DD-HHmmss/` へコピー
- **`--clean-latest`** … 実行前に `latest` を削除
- **report 運用案内** … Next Actions / API キー設定 / output 副産物の git 注意

### v1.3 でできること（MVP 完了）

- **品質パイプライン** … 画像レビュー・改善・再レビュー・export・report を 1 本化
- **改善ループ** … IMPROVEMENT ⇄ RE_REVIEW（maxRounds）、90 点公開推奨まで自動ループ
- **Nano Banana 実接続** … apply 時に rootCause 別改善（LAYOUT / STYLE 等）
- **improved 画像 export** … 条件を満たすスライドは `output/carousel/improved/` を Instagram Package に採用
- **REPORT_SCHEMA レポート** … `quality_pipeline_report`（report.json / report.md）
- **pipeline state / metrics** … `reports/quality-pipeline/latest/` に実行状態を記録
- **終了コード統合** … `getPipelineExitCode()`（exit 0〜4）
- **npm scripts** … `quality-pipeline` 系 + `test:quality-pipeline`
- **dry-run 標準** … デフォルト API 未呼び出し、`--apply` で本番

---

## 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [README.md](../README.md) | 使い方・コマンド一覧 |
| [CHANGELOG.md](./CHANGELOG.md) | バージョンごとの変更履歴 |
| [V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md](./V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md) | v1.4 Smart Auto Fix 統合設計 |
| [V1.3_QUALITY_PIPELINE_DESIGN.md](./V1.3_QUALITY_PIPELINE_DESIGN.md) | v1.3 品質パイプライン設計 |
| [REPORT_SCHEMA.md](./REPORT_SCHEMA.md) | quality_pipeline_report スキーマ |
| [V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md](./V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md) | v1.2 Nano Banana 画像改善の設計 |
| [Genspark連携設計.md](./Genspark連携設計.md) | v1.1 Genspark 連携の設計・運用 |
| [SmartAutoFix設計.md](./SmartAutoFix設計.md) | v1.1.1 Smart Auto Fix の設計 |

---

*最終更新：2026-06-25*
