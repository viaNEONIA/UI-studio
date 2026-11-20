# AI指示用JSON仕様 v1（初期実装）

HTMLスライド上の注釈と、AIが実行すべき修正指示を対応付ける独立した出力形式。既存の編集・復元用JSONとは互換性を混同しない。

- スキーマ: [ai-instructions-v1.schema.json](schemas/ai-instructions-v1.schema.json)
- サンプル: [ai-instructions-v1.example.json](examples/ai-instructions-v1.example.json)
- バージョン: `schemaVersion: "1.0.0"`。破壊的変更はメジャーバージョンを更新する。
- 座標: 各スライド左上を原点とするCSS px。HTMLの表示倍率や端末のdevicePixelRatioではなく、基準ビューポートの座標を保存する。
- `document.viewport`: HTMLをキャプチャ・表示した基準幅と高さ。`slides` は各ページの基準寸法を持つ。
- `target`: elementId、selector、textHint、boundsのうち最低1つを保持する。CSSセレクターはヒントであり、確実な一致を保証しない。
- `annotations`: 表示用の図形・引き出し線・テキストを保持する。`text` はAIに渡す明示的な修正指示とする。
- `action`: modify/move/resize/add/remove/replace/review。曖昧な場合はreviewを使用し、自動変更を前提にしない。
- `sourceHash`: SHA-256。初期実装では常に出力し、元HTMLの保存・AI指示の出力前に照合する。
- 対象要素のID・セレクターが無い場合も、座標とテキストのヒントで指示を表現できる。ただしAIによる自動修正は対象の再確認を必要とする。

## 検証条件

1. 元HTMLを変更せず読み込む。未知のHTMLのスクリプトは無条件に実行しない。
2. 拡大縮小後の注釈位置を基準座標へ逆変換できる。
3. 複数スライドの指示を混同しない。
4. JSON Schema検証を通るデータだけ出力する。
5. 対象が曖昧な場合はAIに確定的な変更として扱わせない。
6. 元HTML、注釈付きプレビュー、JSONの3つを対応付けて利用できる。

## 初期実装の出力

`feat/html-slide-annotations` に実装。mainへの統合前です。

- 1ファイルに1つの元HTMLを対応付け、その原本に由来する全ページを `slides` に出力します。同じ原本から複製したノートページは別の `id` を持ちます。
- `slides.sourceSelector` と `sourceIndex`（0始まり）は原本内のページを特定する追加情報です。ルート全体の場合は `body` です。
- `annotations.points` は線・矢印・手書き・図形の頂点・引き出し線の順序付き点列です。引き出し線では先頭が指示先です。曲線の点列は会議ノートの制御点を保持します。`textBounds` は引き出し線付きテキストの文字枠、`strokeWidth` は元HTML座標系での線幅です。これらはv1の任意フィールドとして追加し、従来サンプルも有効です。
- `text` はAI修正指示、PDFコメント、テキスト注釈本文の優先順。指示文のないオブジェクトは除外し、出力後に件数を表示します。結合オブジェクトに指示があれば、子要素を複数のannotationsとしてまとめます。
- 対象要素は取り込み時に記録した候補から手動で選びます。指定が無い・原本やスライドが違う場合は注釈のboundsを対象として保持し、`review`へ変更します。`add`は座標だけでも維持します。
- 原本はUTF-8テキストとしてノートの `htmlSources` に保持し、`background.html` が原本ID・スライド・対象候補を参照します。原本は読込復元時に実行しません。
- 背景の移動・拡縮・余白を逆変換して座標を出力します。画面ズームや画像の画素数に依存しません。
- このJSON単独でHTMLを書き換える機能や、AIへの自動送信はありません。元HTML・注釈付き資料と合わせてAIに渡すための出力です。

静的取り込みの制限・操作は[README](../README.md#htmlスライドへの修正指示)を参照してください。
