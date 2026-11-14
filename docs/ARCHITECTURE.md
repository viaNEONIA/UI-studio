# 構成

- `index.html`: 既存エディターのHTML/CSS/JavaScriptソース。会議用ライブラリと編集処理の挿入マーカーを含む。
- `src/meeting-editor.js`: 最背面背景の管理、取込・出力UI、会議表示、ページ移動、手のひら、自動復旧。ビルド時に既存エディターのスコープへ挿入。
- `src/meeting-tools.mjs`: PDF.jsによる画像化、html2canvasによるページ合成、jsPDFとPptxGenJSによる書き出し。配布版ではMeetingToolsとして利用。
- `scripts/build.mjs`: esbuildでライブラリとPDF標準フォント/CMap/画像デコーダをまとめ、単独ファイルの`dist/index.html`を生成。第三者ライセンス表示も生成。
- `tests/fixtures/v0.6.html`: SHA256で照合する旧原本。
- `tests/e2e`: Chromiumで既存編集操作と会議資料の入出力を検証。サーバーはdistを提供し、file://起動も検証する。
- `.github/workflows/ci.yml`: 基本テスト、Chromium E2E、旧原本の不具合再現。テスト結果と配布版をartifactとして保持。
- `.github/workflows/pages.yml`: mainからビルドしたdistを公開。

## ビルドと配布

`npm ci && npm run build`。dist/index.htmlをブラウザで開く。実行時にCDNへ接続しない。PDF workerは同梱したメインスレッド実装を利用する。PDFの解析・画像化は端末内で行い、大きな資料では処理に時間がかかる。

## 保存形式

JSON version:1、width/height、screens/elementsの構造は維持する。背景は画面ごとの任意フィールド`background`へ、PNGのdata URL、配置、透明度、表示/ロック、名前を保存する。背景をelementsへ混ぜないため、部品の前後操作で背景が上へ出ない。旧JSONに背景フィールドは不要。

PDFの元バイト列は保持しない。PDF/画像は最長辺2400px以内のPNG背景に変換する。背景を同梱したJSON/HTMLは元ファイルへのパスに依存しない。

## 出力

HTMLは背景と既存の要素を同梱したページ切替プレビュー。PDF/PPTXは全画面を描画して画像として合成する。A4/A3は規定mmサイズを使い、その他は96px/inで換算する。PPTXは1画面1スライドの画像であり、内部要素を個別編集する出力ではない。

HTML部品と外部URL画像を含むPDF/PPTX出力はエラーで中止する。追加CSSやフォント差など、ブラウザ上のすべての表現を完全に再現することは保証しない。

## 復旧と失敗処理

IndexedDBへ800msの遅延で自動復旧データを保存する。前回データの復旧/破棄を選択する前に上書きしない。容量不足などの保存エラーをUIに表示する。Undo/Redo履歴は32Mi文字を目安に制限し、少なくとも直前1件を残す。

資料取込は全ページの変換が成功した後に状態へ反映する。取込・出力中は編集操作を停止する。JSON保存ボタンによるダウンロードの開始と、利用者の保存先への書込み完了は別であり、後者はブラウザの権限外。
