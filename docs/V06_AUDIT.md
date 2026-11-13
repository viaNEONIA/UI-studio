# v0.6 コード監査と検証

対象原本: main の初期コミット 0500fac。tests/fixtures/v0.6.html に原本保存し、docs/v0.6.sha256 と照合する。

## 実装済み

23種類の部品、画面追加・複製・削除・名前変更、レイヤー、複数選択、グループ、整列、移動・リサイズ、スナップ、グリッド、Undo/Redo、JSON保存・読込、HTML出力・画面遷移、端末サイズ・制約はコード上に実装されている。
Stack等の親子レイアウトは未実装。制約は全画面共通のキャンバスサイズ変更に対する座標・寸法の補正であり、自動整列エンジンではない。

## 修正

| 問題 | 原因と修正 |
| --- | --- |
| 不正JSON読込後に編集不能になる | screens内部を検証する前にprojectを置換していた。候補全体を検証してから置換する |
| グループを端まで動かすと間隔が崩れる | 各部品を個別にclampしていた。共通移動量をグループ境界で制限する |
| HTML出力に画面IDを通じたコード混入が可能 | inline onclickにIDを直接挿入していた。エスケープしたdata-linkとイベントリスナーに統一し、初期IDのscript終端もエスケープする |
| CI・Pagesが文書にしか存在しない | ワークフローを追加。Pagesへの配置はindex.htmlのみ |

## JSON互換性

version:1、プロジェクト・画面・要素の構造は変更しない。anchorX/anchorY未指定の旧データは従来の左・上固定で処理し、JSONに既定値を強制追加しない。未知の拡張フィールドは保持する。不正な型・重複ID等は読込拒否し、編集中データを保持する。ユーザーの実データは使わずダミーデータで検証する。

## テスト

- npm ci
- npm test
- npx playwright install --with-deps chromium
- npm run test:e2e
- BASELINE=1 npm run test:e2e で同じテストを原本に適用できる（回帰修正項目は失敗する想定）。
- ローカルの既存Chromiumを使う場合: CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e

E2Eは実際のUI入力とJSONダウンロード内容を照合する。追加、移動、リサイズ、複数選択、グループ、整列、Undo/Redo、JSON互換、不正JSON、画面複製、コピー、レイヤー、出力HTMLのリンク、HTML sandbox、制約、グリッド、倍率、画面外警告を対象とする。

ローカルのnpm testは3件合格。Chromiumはホストのsocket作成制限で起動できず、ブラウザ配布物の取得も失敗。ブラウザ結果はPRのCIで確認する。スクリーンショットはE2Eのtest-resultsに出力し、CI artifactとして14日保持する。

未検証: Edge/Firefox/WebKit、file://での手動操作、タッチ実機、外部画像のネットワーク挙動、全CSS宣言の描画、非常に大きなJSON、手動による詳細な視覚検査。HTML iframeのsandboxはスクリプトを禁止するが、外部リソースの通信を遮断する仕組みではない。

2026-11-14 JST時点で https://viaNEONIA.github.io/UI-studio/ はHTTP 404。Pagesワークフローの追加のみで公開を確認済みとは扱わない。Settings → PagesでGitHub Actionsを選択し、mainへのマージ後にデプロイ結果を確認する。

## 残課題

追加監査で見つかった寸法入力の不正値、操作なしの選択によるUndo履歴追加、画面削除時のリンク残存、最低50%による全体表示失敗も修正し、E2Eに回帰テストを追加した。新機能は開始しない。

ソース分割はブラウザ検証後にmodel・editor・export・stylesの単位で行うことを推奨する。今回のPRには含めない。
