# Deprecation Policy

Deprecated / Warning / Removal Candidate / Removed の段階と移行ルールを定義する Architecture Governance 基準書です。

---

## Deprecated

**Deprecated** 段階:

- 機能または Public Contract field が非推奨とマークされる
- **後方互換は維持** — 既存 downstream は動作し続ける
- 代替 Contract / Foundation / field を文書化する
- Catalog `deprecationRules` と CHANGELOG に記載

必須アクション: 代替手段と移行タイムラインを [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) に記録。

---

## Warning

**Warning** 段階:

- Deprecated 状態が **少なくとも 1 Minor release** 継続
- Validator / CLI Summary / Governance docs で警告を明示
- Quality Pipeline に deprecation warning テストを追加（該当時）

必須アクション: backward compatibility を維持しつつ、新規利用を discouraged とする。

---

## Removal Candidate

**Removal Candidate** 段階:

- 次 Major release で削除予定
- Compatibility Matrix と Catalog から影響 edge を `removal-candidate` として注記
- [RISK_REGISTER.md](./RISK_REGISTER.md) に Compatibility Risk を登録
- downstream 利用箇所をゼロにする計画を立てる

必須アクション: Major bump 前に EXTENSION_CHECKLIST 相当の removal checklist を完了。

---

## Removed

**Removed** 段階:

- **Major version bump 後のみ** 削除可能
- Deprecated → Warning → Removal Candidate を経ていること
- CHANGELOG / VERSION.md / Catalog / Governance docs を同期更新
- Quality Pipeline から removed 対象テストを削除または置換

必須アクション: explicit changelog entry と ADR 更新。

---

## Stage Flow

```text
Active → Deprecated → Warning → Removal Candidate → Removed
         (announce)   (≥1 Minor)  (plan Major)        (Major only)
```

段階をスキップした削除は **Governance 違反** です。緊急削除が必要な場合も Major bump と ADR 記録を必須とします。

---

## Catalog Alignment

Catalog `deprecationRules[]` は本 Policy の Machine Readable 要約です。文書と Catalog の stage 定義は一致させます。
