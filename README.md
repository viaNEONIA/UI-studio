# UI Studio

PCブラウザでスマートフォンUIのラフを設計する、HTML/CSS/JavaScript製のプロトタイプエディターです。

> **現在の基準版: v0.6（試作）**。実ブラウザでの操作テストは未完了です。正式なMaterial Design 3コンポーネント実装ではありません。

## 起動

`index.html` をChromeまたはEdgeで開きます。ビルド、インストール、サーバーは不要です。

GitHub Pagesを有効にした場合は、リポジトリの公開URLでも利用できます。外部HTMLなどの埋め込み内容は信頼できるものに限定してください。

## 既存機能（実装を含むが動作保証前）

- 画面・コンポーネント・レイヤー編集
- ドラッグ移動、サイズ変更、複数選択、グループ化
- グリッド表示、スマートガイド、スナップ
- 端末サイズ切替、倍率、レイアウト検査
- 制約ベースの位置・サイズ調整（v0.6）
- JSON保存・読込、HTML出力

## 開発上の原則

1. `index.html` はv0.6の原本として初回コミットし、以後の変更はPull Requestでレビューします。
2. 画面データはJSONを正本とし、HTML出力は生成物とみなします。
3. 新機能の前にブラウザE2Eテストを整備します。
4. JSONの後方互換性を壊す場合はマイグレーションを用意します。
5. ユーザーの設計データを無断で外部送信しません。

## GitHub Pages

Settings → Pages → Build and deployment → Source: **GitHub Actions** を選択してください。`main` へのpushで `.github/workflows/pages.yml` が実行されます。公開URLは通常 `https://viaNEONIA.github.io/UI-studio/` です（公開設定に依存）。

## テスト

Node.js 22以上で `npm ci && npm test`。Chromium E2Eは `npx playwright install --with-deps chromium` 後に `npm run test:e2e`。実行範囲・制限・監査結果は [`docs/V06_AUDIT.md`](docs/V06_AUDIT.md) を参照してください。

## Workへの引継ぎ

[`docs/WORK_HANDOFF.md`](docs/WORK_HANDOFF.md) を参照してください。

## ライセンス

ライセンスは未指定です。公開リポジトリでも、ライセンスを明示するまでは第三者への利用・改変・再配布許諾が付与されるわけではありません。
