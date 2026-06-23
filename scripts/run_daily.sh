#!/usr/bin/env bash

# エラー発生時にスクリプトを終了する
set -euo pipefail

# プロジェクトルートを取得（このスクリプトは scripts/ 配下にある前提）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/daily.log"

# プロジェクトルートへ移動
cd "$PROJECT_ROOT"

# logs/ が存在しなければ作成
mkdir -p "$LOG_DIR"

# パイプライン全体のエラーを検知する
{
  echo "========================================"
  echo "開始: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"

  # Instagram投稿を生成
  npm run generate

  # Geminiでレビュー
  npm run gemini-review

  echo ""
  echo "--- image-prompt 実行 ---"
  # Instagram画像生成用プロンプトを作成
  npm run image-prompt

  echo ""
  echo "--- generate-image 実行 ---"
  # 画像生成用の最終プロンプトを作成
  npm run generate-image

  echo ""
  echo "--- openai-image 実行 ---"
  # OpenAI Images APIで画像を生成
  npm run openai-image

  echo ""
  echo "Daily AI SNS pipeline completed"
} 2>&1 | tee -a "$LOG_FILE"

# tee より先のコマンドが失敗した場合は終了コードを反映
exit "${PIPESTATUS[0]}"
