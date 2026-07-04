# Extension Checklist

Foundation 追加時（将来 Epic）の確認項目。Architecture Governance レビューで **全項目必須** です。

---

## Layer Rule

- [ ] Platform Layer 新 Foundation ではない（Completed v1.40.0）
- [ ] Application / Future Layer の正しい位置づけ
- [ ] Platform ↔ Application 依存なし
- [ ] Layer Invariants 全項目 PASS

---

## Dependency Rule

- [ ] upstream は 1 つの Public Contract のみ
- [ ] `build*` / `normalize*` upstream import なし
- [ ] 循環依存なし
- [ ] Compatibility Matrix edge 追加

---

## Public Contract

- [ ] `extract*PublicContract()` 実装
- [ ] 内部 score / flags を public surface に露出しない
- [ ] JSON Source shape 固定
- [ ] Catalog `publicContracts[]` 更新

---

## Compatibility

- [ ] Minor / Major 判定完了
- [ ] downstream 既存テスト PASS
- [ ] Public Contract only テスト追加
- [ ] backward compatibility 方針文書化

---

## Versioning

- [ ] docs/VERSION.md 更新
- [ ] docs/CHANGELOG.md 更新
- [ ] Test 98 current version 更新
- [ ] SemVer 整合

---

## Deprecation

- [ ] 既存 Contract 変更時: Deprecated 段階開始
- [ ] Removal 時: Major bump 計画
- [ ] CHANGELOG deprecation entry

---

## Tests

- [ ] Quality Pipeline テスト追加
- [ ] npm test 全 PASS
- [ ] Non-scope verification（外部 API / runtime 非追加）
- [ ] v(N-1) backward compatibility テスト

---

## Documentation

- [ ] README.md 更新
- [ ] 該当 Governance doc 更新
- [ ] ADR 追加（significant decision 時）
- [ ] EXTENSION_CHECKLIST 本 PR に添付

---

## v1.49.0 Note

Application Layer Foundation 追加は v1.47.0 完了により **現時点クローズ**。本 Checklist は Future Layer / v2 Epic 開始時に適用します。

Governance docs 追加（v1.49.0 型）は Foundation 追加ではなく **Minor documentation release** として扱います。
