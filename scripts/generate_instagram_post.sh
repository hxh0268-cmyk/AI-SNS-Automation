#!/usr/bin/env bash

# エラー発生時にスクリプトを終了する
set -e

# プロジェクトルートを取得（このスクリプトは scripts/ 配下にある前提）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# プロンプトファイルのパス
SYSTEM_PROMPT_FILE="$PROJECT_ROOT/prompts/instagram/system.md"
USER_PROMPT_FILE="$PROJECT_ROOT/prompts/instagram/user.md"

# プロンプトファイルを読み込む
SYSTEM_PROMPT="$(cat "$SYSTEM_PROMPT_FILE")"
USER_PROMPT="$(cat "$USER_PROMPT_FILE")"

# 出力先
DRAFT_DIR="$PROJECT_ROOT/content/draft"
OUTPUT_FILE="$DRAFT_DIR/post.md"

# content/draft/ が存在しなければ作成
mkdir -p "$DRAFT_DIR"

# claude --print で system.md と user.md をまとめて実行し、結果を保存
claude --print \
  --system-prompt "$SYSTEM_PROMPT" \
  "$USER_PROMPT" > "$OUTPUT_FILE"

# 生成完了メッセージを表示
echo "Instagram post generated:"
echo "content/draft/post.md"
