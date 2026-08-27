# ADR-0027: Scheduled Publish Recovery and Duplicate-Containment Policy

## Status

**Accepted** — R1 Remediation Implementation (Human Approval: 2026-08-27)

---

## 1. Context

X Daily Post システムは GitHub Actions cron (`"8 23 * * *"`, 23:08 UTC = 08:08 JST) によって
daily publishing を実現している（ADR-0026 承認済み）。

2026-08-27（Production Observation Day 7）に、cron schedule event が非生成となり、
当日の X 投稿が欠落した。Independent Review により以下が確認された。

- Root Cause: Probable — GitHub schedule event missed/dropped
- GitHub Actions はベストエフォート cron（SLA なし）
- 単一 cron への依存は F1（event 非生成）に耐性がない
- GH Actions の ephemeral runner は cross-run で publish ledger を共有しない
- Recovery 実行とプライマリ実行の間に cross-runner persistent idempotency がなかった

この ADR は、missed-run recovery と二重投稿防止を両立する
Production-grade scheduler reliability policy を定義する。

---

## 2. Day 7 Incident

| 項目 | 値 |
|------|-----|
| Date | 2026-08-27 JST |
| Expected cron | 2026-08-26T23:08 UTC = 2026-08-27T08:08 JST |
| GH Actions run record | **absent** |
| X post | **absent** |
| Root Cause | Probable: GitHub schedule event missed/dropped |
| Production Observation Day 7 verdict | **C. FAIL** |
| Historical treatment | FAIL を書き換えない。Recovery は別記録 |

---

## 3. Decision Drivers

- GitHub Actions cron は SLA なしのベストエフォート配信
- 単一 cron への依存は F1（event 非生成）に耐性がない
- X API（POST /2/tweets）は native idempotency を提供しない
- Application-level idempotency は必須
- GH Actions ephemeral runner は cross-run で ledger を共有しない（既知設計上の制約）
- 「二重投稿防止」は「投稿欠落回避」より高優先度
- 「Exactly-Once」は技術的に達成できない（明示的に撤回）

---

## 4. Reliability Target

```
Target Guarantee:
  "at-most-once with bounded duplicate-containment,
   and at-least-once via dual-cron redundancy."

Formal properties:
  (1) at-most-once（通常動作）: ACHIEVED
      persistent cache ledger + concurrency group が重複を防ぐ

  (2) at-most-once（クラッシュシナリオ）: BEST-EFFORT
      dual-stage cache upload (if:always()) がクラッシュ窓を最小化
      残留リスク: job 開始〜in_progress upload 前の runner kill（irreducible）

  (3) at-least-once（scheduler レベル）: BEST-EFFORT
      dual-cron が冗長性を提供
      P(dual-miss/day) ∈ [2%, 14%]（独立〜完全相関の範囲）

  (4) Exactly-once: NOT CLAIMED
      X API は POST /2/tweets の native idempotency を提供しない
      トランザクショナル保証は達成できない
```

---

## 5. Primary Scheduler

```
cron:    "8 23 * * *"  (23:08 UTC = 08:08 JST)
grace:   08:08–08:38 JST (30 min; GRACE_WINDOW_MINUTES=30)
entry:   run_x_daily.sh (全 activation guards 適用)
branch:  main
```

---

## 6. Recovery Scheduler

```
cron:       "8 1 * * *"  (01:08 UTC = 10:08 JST, 同 JST calendar date)
delay:      +2h from canonical 08:08 JST
grace:      SKIP time check (ledger state で判定; --skip-time-check 使用)
entry:      run_x_daily.sh --skip-time-check
eligibility: §14 Recovery Eligibility Algorithm に従う
workflow:   x_daily_post.yml (primary と同一; shared concurrency group)
detection:  github.event.schedule == '8 1 * * *' または force_recovery=true
```

---

## 7. Same-Failure-Domain Limitation

```
Primary cron  (8 23 * * *) と Recovery cron (8 1 * * *) は
ともに GitHub Actions scheduler ドメインに依存する。

P(primary miss)  ≈ 14%/day（観測値: Day 7、7日間で1回）
P(dual-miss/day) ∈ [2%, 14%]（独立〜完全相関の範囲）

Residual risk:
  T3: dual-miss → 当日投稿なし（alert + operator recovery が必要）
  T10: GH Actions 全体障害 → 同上

これらは現 Phase で許容する。Phase 2 で External Scheduler の導入により低減できる。
```

---

## 8. Persistent State Model

```
Three-Layer Persistence:

Layer A — Run-Local / Ephemeral:
  tmp/publish-records/{jobId}.json
  単一 runner instance 内の権威ソース。runner 終了で消滅。gitignored。

Layer B — Cross-Run Best-Effort Persistent:
  GitHub Actions Cache
    restore key: publish-ledger-{jstDate}-{runId}
    restore-keys: publish-ledger-{jstDate}-
    save key:    publish-ledger-{jstDate}-{runId}
  7-day TTL。ACID 非準拠（§9 を参照）。
  Dual-stage upload で if:always() を適用:
    Stage 1: run_x_daily.sh 完了後（正常 / 失敗問わず）
  Cache miss → NOT_STARTED として扱う（safe fallback）。

Layer C — Observable Evidence:
  xPostId（POST /2/tweets レスポンスから取得）
  Layer A/B の PUBLISHED record に保存。
  Human Verification により X timeline で確認。
  プログラム的 read-back 不可（GET /2/tweets 非認可）。
```

---

## 9. Cache Limitations

```
GitHub Actions Cache は以下を保証しない:
  ✗ Atomic read-modify-write（ACID 非準拠）
  ✗ Durability（7-day TTL, LRU eviction）
  ✗ Availability（cache API error 発生しうる）
  ✗ Write ordering（concurrent write は concurrency group が制御）

同日内（2h 程度）の eviction は実質的に発生しないが、
理論上の残留リスクとして T7 を文書化する。

Cache miss semantics（設計上の決定）:
  Cache miss → Layer A も空 → "not_found" = NOT_STARTED として扱う
  → Recovery eligible（重複防止は concurrency group が担保）

Cache upload failure（if:always() でも runner host kill で発生しうる）:
  Layer A の in_progress または published state が次の runner に引き継がれない
  → Recovery が empty ledger → duplicate リスク（very low probability）
  → if:always() により job failure での miss は排除される
  → Irreducible residual: runner host-level kill のみ

Production-grade 判定: CONDITIONAL YES（dual-stage + if:always() が前提）
```

---

## 10. Concurrency Model

```
concurrency:
  group: x-daily-post
  cancel-in-progress: false  ← 実行中 run のキャンセルを禁止

Scope: x_daily_post.yml の全トリガー（schedule primary / recovery / workflow_dispatch）

Protection:
  T4: Primary + Recovery 同時 fire → 後着が queue → cache HIT → SKIP
  T8: retry → queue → cache HIT → SKIP
  T9: manual dispatch vs active → queue → cache HIT → SKIP

Not protected by concurrency:
  T3: dual-miss（どちらも fire しない）
  T7: same-day cache eviction（cache レベル）

Date boundary:
  JST date は run_x_daily.sh が TZ=Asia/Tokyo で決定
  UTC midnight 境界は影響しない（JST authority）
  前日の遅延 run: jobId = daily-{前日の JST 日付} → 今日の run と干渉なし
```

---

## 11. Idempotency Key

```
jobId = "daily-{jstDate}"
  where jstDate = TZ=Asia/Tokyo date '+%Y-%m-%d' (run_x_daily.sh が計算)

Properties:
  - 1 key per JST calendar date per account
  - Stage 1: fixed content; content-agnostic key
  - Single-account prototype; multi-account は key の改定が必要（future）
  - Timezone-safe: JST authority 固定
  - SHA-256 collision: 天文学的確率（実用上無視可）

Cache key = "publish-ledger-{jstDate}-{github.run_id}"
restore-keys prefix = "publish-ledger-{jstDate}-"
```

---

## 12. Publish State Machine

```
States:
  NOT_STARTED     初期。ledger record なし / cache miss。
  PUBLISHING      in_progress 書き込み済み。API call 中。
  PUBLISHED       成功。xPostId 記録済み。Terminal。
  FAILED_SAFE     失敗。retry 可。Non-terminal。
  UNKNOWN_RESULT  結果不明。Quarantine。Non-terminal（operator 解消必要）。

Transitions:
  NOT_STARTED ──(proceed)──→ PUBLISHING ──(success)──→ PUBLISHED  ← terminal
                                         ──(timeout-after-send)──→ UNKNOWN_RESULT ← quarantine
                                         ──(rejected/ceiling)────→ FAILED_SAFE
  FAILED_SAFE ──(retry/recovery)──→ PUBLISHING
  UNKNOWN_RESULT: operator のみ解消可能

State → Recovery eligibility:
  NOT_STARTED:    YES
  FAILED_SAFE:    YES
  PUBLISHED:      NO (SKIP)
  UNKNOWN_RESULT: NO (QUARANTINE)
  PUBLISHING:     NO (BLOCKED — crash guard)
```

---

## 13. UNKNOWN_RESULT State

```
設定条件: POST /2/tweets request 送信後に response 受信前 timeout

取り扱い:
  ledger.set("unknown_result") → cache upload (if:always())
  後続の全 run（primary / recovery / manual）: QUARANTINE → exit 2

NO automatic retry（二重投稿リスク最大のため）

Operator 手順:
  1. X timeline で当日投稿を確認
  2a. 投稿あり → ledger に "published" + xPostId を手動設定 → cache 更新
  2b. 投稿なし → ledger ファイル削除 → cache エントリ削除 → 次回 run が retry

Fail-safe 原則:
  ambiguity → no automatic duplicate-risk publish → safe stop → operator
```

---

## 14. Recovery Eligibility Algorithm

```
Recovery run が publish してよいのは全条件（R1〜R8）を満たす場合のみ:

  R1: jstDate == today_jst()                    (今日の日付のみ)
  R2: SCHEDULED_PUBLISH_ENABLED == "true"       (activation gate)
  R3: REAL_PUBLISH_ENABLED == "true"            (kill switch)
  R4: all 4 X credential vars present           (credential check)
  R5: cache_state ∈ {"not_found", "failed"}     (未投稿 or safe failure)
  R6: concurrency acquired (GH Actions enforce)  (concurrent run なし)
  R7: content file exists and valid              (fail-closed)
  R8: content digest matches expected            (Stage 1 integrity)

Recovery は時刻チェックを行わない（--skip-time-check で bypass）。
Grace window は Primary 専用の保護機構であり、Recovery には不要。

Ambiguous state での動作:
  R5 に "in_progress" が存在 → BLOCKED（crash guard）
  R5 に "unknown_result" が存在 → QUARANTINE
  いずれも自動 publish しない。
```

---

## 15. Duplicate-Containment Policy

```
重複防止レイヤー:
  Layer 1: PUBLISHED ledger → SKIP       (強い保護; 通常動作)
  Layer 2: IN_PROGRESS ledger → BLOCKED  (crash 保護)
  Layer 3: Concurrency group → queue     (concurrent execution 保護)

残留 duplicate シナリオ（全ミティゲーション適用後）:
  T5: job 開始〜in_progress upload 前の runner kill → recovery が empty ledger → duplicate
  T7: same-day cache eviction → 同上
  いずれも very low probability

duplicate 検出時の対応:
  1. X post を即座に削除しない（どちらが「意図した」投稿かを確認）
  2. 最初に投稿された xPostId が正規
  3. 重複投稿を X 上で手動削除
  4. incident を production log に記録
  5. ledger を手動で "published" に更新
  6. operator review なしに自動操作しない
```

---

## 16. Retry Policy

```
Automatic retry (provider level):
  5xx server error: max 3 retries, exp backoff 2s/4s/8s
  429 Rate limit: 1 retry after Retry-After header
  Timeout before send: 1 retry

NO automatic retry:
  UNKNOWN_RESULT（duplicate リスク最大）
  PUBLISHED（deduplication）
  Activation guard failure
  Credential failure

Recovery run = authorized re-attempt (Recovery Eligibility Algorithm 適用)
Recovery は自動 retry ではなく、scheduled trigger による独立した試行。
```

---

## 17. Manual Recovery Policy

```
Scenario A: primary missed (no ledger, no post):
  → Recovery cron (10:08 JST) を待つ
  → Recovery も miss した場合: workflow_dispatch (dry_run=false, force_recovery=true)
  → run log で xPostId を確認
  → Human Verification on X

Scenario B: UNKNOWN_RESULT:
  → §13 の operator 手順に従う

Scenario C: FAILED_SAFE (provider 障害):
  → Recovery cron が retry（ledger は "failed" → eligible）

Prohibited:
  → "published" 状態の ledger がある日に workflow_dispatch で再投稿
  → 承認された workflow 外での直接 API call
```

---

## 18. Alerting / Escalation

```
Phase 1（現在）:
  - Human Verification: オペレーターが X を毎日確認（継続）
  - GH Actions email: workflow failure 時に GitHub が自動送信

Phase 2（Extended Observation 完了後）:
  - Watchdog workflow: 11:00 JST に当日 ledger の "published" を確認
    → 未確認の場合: Slack / email / GH Issue でアラート
  - これにより T3（dual-miss）を当日内に検出可能

Escalation severity:
  duplicate detected: CRITICAL → 即時調査
  UNKNOWN_RESULT:     MAJOR → 当日中の operator 対応
  single-day miss (T3): MAJOR → 翌日の Recovery Verification
  schedule delay >27m: MONITOR → ログのみ
```

---

## 19. Security Implications

```
Permission expansion:
  Before: permissions: contents: read
  After:  permissions: contents: read
                       actions: write  (cache save 専用)

actions:write が許可する操作:
  ✅ actions/cache/save（意図した用途）
  ⚠️  workflow run cancel / rerun / delete（追加 capability）
  ✗  secrets 読み取り・変更
  ✗  code push / repository 変更

Acceptance: CONDITIONAL YES
  ephemeral runner で実行され、run 終了で権限消滅
  不正利用リスクは低い

Cache セキュリティ:
  key:     "publish-ledger-{jstDate}-{runId}"（日付 + ID のみ）
  content: result / xPostId / timestamps（Secrets なし）
  Secrets: GH Secrets 経由のみ（cache content に入らない）
```

---

## 20. Failure Modes Summary

| ID | Failure | Auto Recovery | Duplicate Risk | Manual Required |
|----|---------|--------------|---------------|----------------|
| T1 | Primary cron missing | ✅ Recovery cron | 0 | NO |
| T2 | Primary delayed (SKIP) | ✅ Recovery cron | 0 | NO |
| T3 | Dual-miss | ❌ None | 0 | YES (alert) |
| T4 | Primary + Recovery simultaneous | ✅ Concurrency | 0 | NO |
| T5 | Crash before in_progress upload | ❌ Duplicate risk | LOW | YES (X check) |
| T5b | Crash after in_progress upload | ✅ BLOCKED | 0 | YES (X check) |
| T6 | Cache API error | ✅ Proceeds as first run | Low (dual failure) | NO |
| T7 | Cache same-day eviction | ❌ Duplicate risk | VERY LOW | YES (X check) |
| T8 | Retry after success | ✅ ALREADY_PUBLISHED | 0 | NO |
| T9 | Manual dispatch collision | ✅ Concurrency + SKIP | 0 | NO |
| T10 | GH Actions outage | ❌ None | 0 | YES (alert) |
| T11 | X API 5xx (retriable) | ✅ Retry logic | 0 | NO |
| T12 | UNKNOWN_RESULT | ✅ QUARANTINE | 0 | YES (mandatory) |

---

## 21. Rollback

```
Trigger: R1 implementation 後に Blocking / Major finding 発生

Method:
  git revert <r1-commit-sha>  ← 新規 commit（force push 禁止）
  delivery gate publish

Effects:
  - 単一 primary cron に戻る（Day 7 リスク再露出）
  - ephemeral ledger のみに戻る（cross-run idempotency 失われる）
  - credential 変更不要
  - Data loss なし

Post-rollback:
  Investigation → 修正 Planning → 再 ADR → 再 Human Approval Gate → 再 Implementation
```

---

## 22. Observation Requirements

```
Extended Observation（R1 実装後）:
  Duration: 7 days (Option C — 新規観測 window)

  Exit criteria（全て満たすこと）:
    scheduled_or_recovery_publishes  ≥ 7
    duplicate_publishes              = 0
    unresolved_UNKNOWN_RESULT        = 0
    Blocking findings                = 0
    Major findings                   = 0
    credential_leakage               = 0
    unexpected_repo_mutation         = 0
    Human_Verification_PASS          = 7/7
    persistent_ledger_cross_runner_verified = YES (≥ 1 cache HIT observed)
    recovery_path_demonstrated       = YES (≥ 1 recovery run PASS or verified)
```

---

## 23. Consequences

```
Positive:
  F1 (primary event miss) → Recovery cron が補完
  F2 (grace window miss) → Recovery cron が補完
  Cross-runner idempotency → GH Actions Cache persistent ledger
  Crash scenarios → dual-stage if:always() upload で耐性向上
  Duplicate risk → bounded and documented

Negative / Residual:
  T3: dual-miss (~2–14%/day) → Phase 2 の External Scheduler で改善
  T5/T7: irreducible small duplicate window → documented residual risk
  actions:write permission → expanded from contents:read only
  Implementation complexity → cache steps + dual-cron
  Cache API failure → new failure mode (T6, low probability)

Same-failure-domain (P(dual-miss/day) ∈ [2%, 14%]):
  Phase 2 で External Scheduler を採用した場合:
    P(dual-miss) ≈ 0（GH Actions 障害と External Scheduler 障害は独立）
```

---

## 24. Deferred Improvements

```
Phase 2 (Extended Observation 完了後):
  - External scheduler (GCP Cloud Scheduler → workflow_dispatch)
    T3 / T10 の GH Actions 依存を排除
  - Watchdog alerting workflow (11:00 JST daily check)
    T3 を当日内に検出
  - GH Actions Artifact（90-day retention）
    T7 が production で発生した場合に Artifact へ昇格

Phase 3 (X API idempotency が利用可能になった場合):
  - POST /2/tweets の native idempotency key
    全 duplicate リスクを排除し、true exactly-once が達成可能

GRACE_WINDOW_MINUTES 拡大（30 → 60）:
  R1 allowlist 外（run_x_daily.sh 変更が必要）
  Planning で推奨済み。次フェーズで検討する。
```

---

## References

- [X0_PROTOTYPE_PLANNING.md](../architecture/X0_PROTOTYPE_PLANNING.md)
- [ADR-0025](./ADR-0025-x-real-provider-implementation-authorization.md)
- [ADR-0026](./ADR-0026-scheduled-publishing-activation-authorization.md)
- Production Observation Day 7 Incident Investigation (2026-08-27)
- Day 7 Scheduler Reliability Remediation Planning Final Report
- Day 7 Adversarial Planning Review (B. CONDITIONAL GO)
- Day 7 Planning Correction Final Report (A. GO)
