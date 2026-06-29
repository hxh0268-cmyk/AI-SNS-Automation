# バージョン情報

## 現在のバージョン

**v1.9.2**（GitHub Actions Health Check パッチ）

---

## バージョン履歴

| バージョン | 名称 | 状態 | 概要 |
|------------|------|------|------|
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
| v1.9.1 | 運用品質パッチ | ✅ 完了 | Nightly Apply failure summary heredoc の YAML 修正 |
| **v1.9.2** | **運用品質パッチ** | **✅ 完了** | **GHA 環境で .env なし Health Check 通過（Secrets 注入時）** |

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
