# AI-SNS-Automation

SNS投稿の生成・管理・配信を自動化するプロジェクトです。

## ディレクトリ構成

| フォルダ | 役割 |
|----------|------|
| `prompts/` | 各SNS向けのAIプロンプトテンプレートを格納 |
| `prompts/instagram/` | Instagram用プロンプト |
| `prompts/note/` | note用プロンプト |
| `prompts/x/` | X（旧Twitter）用プロンプト |
| `prompts/threads/` | Threads用プロンプト |
| `scripts/` | 自動化スクリプト（投稿生成・配信・画像処理など） |
| `content/` | 生成されたコンテンツの管理 |
| `content/draft/` | 下書きコンテンツ |
| `content/published/` | 公開済みコンテンツ |
| `content/archive/` | アーカイブ済みコンテンツ（Git管理対象外） |
| `images/` | 投稿用画像・素材ファイル |
| `workflows/` | ワークフロー定義（n8n、GitHub Actions など） |
| `config/` | 設定ファイル（SNSアカウント設定、スケジュールなど） |
| `logs/` | 実行ログ（Git管理対象外） |
| `docs/` | ドキュメント・運用ガイド |
