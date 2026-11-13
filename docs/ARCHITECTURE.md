# 現状の構成

- `index.html`: HTML、CSS、JavaScriptを含む単一ファイル。v0.6のオリジナルをそのまま配置。
- `tests/smoke.test.mjs`: Node.js標準テストランナーによる簡易検査。
- `.github/workflows/ci.yml`: Push / PR時の簡易検査。
- `.github/workflows/pages.yml`: mainブランチから静的サイトをデプロイ。

## 設計上の判断

ビルド工程は追加しない。初回のGitHub移行で挙動が変わらないことを優先する。

将来の分割候補: `src/model`, `src/editor`, `src/components`, `src/export`, `src/styles`。分割は動作試験とJSON互換性試験を用意してから実施する。
