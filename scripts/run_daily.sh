#!/usr/bin/env bash

# エラー発生時にスクリプトを終了する
set -euo pipefail

# プロジェクトルートを取得（このスクリプトは scripts/ 配下にある前提）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/daily.log"
EXPORT_DIR="$PROJECT_ROOT/output/instagram"

# プロジェクトルートへ移動
cd "$PROJECT_ROOT"

# logs/ が存在しなければ作成
mkdir -p "$LOG_DIR"

report_gemini_quota_failure() {
  local label="$1"

  echo ""
  echo "========================================"
  echo "Daily AI SNS pipeline 失敗"
  echo "========================================"
  echo ""
  echo "Gemini APIクォータ上限に到達しました"
  echo ""
  echo "停止したステップ: ${label}"
  echo ""
  echo "【原因】"
  echo "Google Gemini API の無料プランでは、1日に使える回数に上限があります。"
  echo "今日の上限に達したため、これ以上 AI 処理を続けられません。"
  echo ""
  echo "【対処方法】"
  echo "- 時間をおいて明日あらためて npm run daily を実行してください"
  echo "- Google AI Studio（https://aistudio.google.com/）で利用状況を確認してください"
  echo "- 必要に応じて有料プランへのアップグレードを検討してください"
  echo ""
  echo "詳細ログ: logs/daily.log"
}

report_general_failure() {
  local label="$1"

  echo ""
  echo "========================================"
  echo "Daily AI SNS pipeline 失敗"
  echo "========================================"
  echo ""
  echo "停止したステップ: ${label}"
  echo ""
  echo "【原因】"
  echo "上記ステップの処理中にエラーが発生しました。"
  echo "ターミナル出力または logs/daily.log の直近のログを確認してください。"
}

is_gemini_quota_error() {
  local log_file="$1"
  grep -qE 'GEMINI_QUOTA_EXCEEDED|Gemini APIクォータ上限に到達しました|"code":429|quota exceeded|RESOURCE_EXHAUSTED|GenerateRequestsPerDay' "$log_file"
}

run_step() {
  local label="$1"
  local npm_script="$2"
  local step_log
  step_log="$(mktemp)"

  echo ""
  echo "========================================"
  echo "開始: ${label}"
  echo "========================================"

  set +e
  npm run "${npm_script}" 2>&1 | tee "$step_log"
  local exit_code="${PIPESTATUS[0]}"
  set -e

  if [[ "$exit_code" -eq 0 ]]; then
    echo "成功: ${label}"
    rm -f "$step_log"
    return 0
  fi

  echo "失敗: ${label}"

  if is_gemini_quota_error "$step_log"; then
    report_gemini_quota_failure "$label"
  else
    report_general_failure "$label"
  fi

  rm -f "$step_log"
  exit 1
}

run_research_check() {
  local step_log
  step_log="$(mktemp)"

  echo ""
  echo "========================================"
  echo "開始: リサーチ確認"
  echo "========================================"

  set +e
  npm run research-check 2>&1 | tee "$step_log"
  local exit_code="${PIPESTATUS[0]}"
  set -e

  if [[ "$exit_code" -eq 0 ]]; then
    echo "成功: リサーチ確認"
  else
    echo "警告: リサーチ確認に失敗しました（パイプラインは続行します）"
  fi

  rm -f "$step_log"
}

check_final_image_review() {
  local review_file="$PROJECT_ROOT/images/carousel/review/image_review.json"

  if [[ ! -f "$review_file" ]]; then
    echo "失敗: image_review.json が見つかりません"
    exit 1
  fi

  node -e "
    const fs = require('node:fs');
    const review = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    if (review.passed !== true) {
      console.error('最終画像レビュー不合格');
      console.error('score:', review.score);
      console.error('failedItems:', JSON.stringify(review.failedItems ?? []));
      console.error('images/carousel/review/image_review.md を確認してください');
      process.exit(1);
    }
  " "$review_file"
}

# パイプライン全体のエラーを検知する
{
  echo "========================================"
  echo "Daily AI SNS pipeline 開始: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"

  run_research_check
  run_step "投稿生成" "generate"
  run_step "Geminiレビュー" "gemini-review"
  run_step "カルーセル生成" "carousel"
  run_step "カルーセルレビュー" "carousel-review"
  run_step "カルーセル改善" "carousel-improve"
  run_step "カルーセル再レビュー" "carousel-review"
  run_step "画像プロンプト作成" "image-prompt"
  run_step "画像プロンプト整形" "generate-image"
  run_step "画像生成" "openai-image"
  run_step "画像レビュー" "image-review"
  run_step "画像改善" "image-improve"
  run_step "画像再レビュー" "image-review"

  echo ""
  echo "========================================"
  echo "開始: 最終画像レビュー確認"
  echo "========================================"
  if check_final_image_review; then
    echo "成功: 最終画像レビュー確認"
  else
    echo "失敗: 最終画像レビュー確認"
    exit 1
  fi

  run_step "Instagramパッケージ出力" "export-instagram"

  echo ""
  echo "========================================"
  echo "Daily AI SNS pipeline 完了: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"
  echo ""
  echo "Instagram投稿パッケージ:"
  echo "${EXPORT_DIR}/"
} 2>&1 | tee -a "$LOG_FILE"

# tee より先のコマンドが失敗した場合は終了コードを反映
exit "${PIPESTATUS[0]}"
