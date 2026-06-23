# launchd セットアップ手順

AI-SNS-Automation の日次パイプラインを macOS launchd で毎日 09:00 に自動実行する手順です。

## 前提

- `scripts/run_daily.sh` が実行可能であること
- `.env` に必要な API キーが設定済みであること
- `node` / `npm` / `claude` コマンドが PATH 上で利用できること

## 1. plist を LaunchAgents に配置

```bash
cp /Users/butatohitsujitohaiboru/AI-SNS-Automation/config/com.aisns.daily.plist \
  ~/Library/LaunchAgents/com.aisns.daily.plist
```

## 2. ジョブを読み込む（有効化）

```bash
launchctl load ~/Library/LaunchAgents/com.aisns.daily.plist
```

## 3. 登録状態を確認する

```bash
launchctl list | grep com.aisns.daily
```

正常に登録されていれば、次のような行が表示されます。

```
-	0	com.aisns.daily
```

左から順に「前回の終了コード」「PID」「Label」です。待機中は PID が `-` になります。

## 4. 手動で即時実行する（任意）

スケジュールを待たずに動作確認する場合:

```bash
launchctl start com.aisns.daily
```

## 5. ジョブを無効化する

```bash
launchctl unload ~/Library/LaunchAgents/com.aisns.daily.plist
```

## ログの確認

| ファイル | 内容 |
|----------|------|
| `logs/launchd.log` | launchd からの標準出力・標準エラー |
| `logs/daily.log` | `run_daily.sh` の実行ログ |

```bash
tail -f /Users/butatohitsujitohaiboru/AI-SNS-Automation/logs/launchd.log
tail -f /Users/butatohitsujitohaiboru/AI-SNS-Automation/logs/daily.log
```

## 設定内容

| 項目 | 値 |
|------|-----|
| Label | `com.aisns.daily` |
| 実行スクリプト | `scripts/run_daily.sh` |
| 実行時刻 | 毎日 09:00 |
| RunAtLoad | `false`（ログイン時の即時実行なし） |
| WorkingDirectory | プロジェクトルート |

## トラブルシューティング

### ジョブが表示されない

```bash
launchctl list | grep com.aisns.daily
```

何も表示されない場合は `load` が失敗している可能性があります。plist のパスと XML 構文を確認してください。

### 実行されない・npm が見つからない

`config/com.aisns.daily.plist` の `EnvironmentVariables.PATH` に、`node` / `npm` / `claude` のインストール先を追加してください。

```bash
which node
which npm
which claude
```

### 設定を更新した場合

plist を変更したら、一度 unload してから load し直します。

```bash
launchctl unload ~/Library/LaunchAgents/com.aisns.daily.plist
cp /Users/butatohitsujitohaiboru/AI-SNS-Automation/config/com.aisns.daily.plist \
  ~/Library/LaunchAgents/com.aisns.daily.plist
launchctl load ~/Library/LaunchAgents/com.aisns.daily.plist
```
