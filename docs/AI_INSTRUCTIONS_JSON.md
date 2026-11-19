# AI指示用JSON仕様 v1（設計案・未実装）

HTMLスライド上の注釈と、AIが実行すべき修正指示を対応付ける独立した出力形式。既存の編集・復元用JSONとは互換性を混同しない。

- スキーマ: [ai-instructions-v1.schema.json](schemas/ai-instructions-v1.schema.json)
- サンプル: [ai-instructions-v1.example.json](examples/ai-instructions-v1.example.json)
- バージョン: `schemaVersion: "1.0.0"`。破壊的変更はメジャーバージョンを更新する。
- 座標: 各スライド左上を原点とするCSS px。HTMLの表示倍率や端末のdevicePixelRatioではなく、基準ビューポートの座標を保存する。
- `document.viewport`: HTMLをキャプチャ・表示した基準幅と高さ。`slides` は各ページの基準寸法を持つ。
- `target`: elementId、selector、textHint、boundsのうち最低1つを保持する。CSSセレクターはヒントであり、確実な一致を保証しない。
- `annotations`: 表示用の図形・引き出し線・テキストを保持する。`text` はAIに渡す明示的な修正指示とする。
- `action`: modify/move/resize/add/remove/replace/review。曖昧な場合はreviewを使用し、自動変更を前提にしない。
- `sourceHash`: 任意のSHA-256。対象HTMLが差し替わった場合の誤適用を防ぐため、実装時にはハッシュ照合を推奨する。
- 対象要素のID・セレクターが無い場合も、座標とテキストのヒントで指示を表現できる。ただしAIによる自動修正は対象の再確認を必要とする。

## 実装時の検証条件

1. 元HTMLを変更せず読み込む。未知のHTMLのスクリプトは無条件に実行しない。
2. 拡大縮小後の注釈位置を基準座標へ逆変換できる。
3. 複数スライドの指示を混同しない。
4. JSON Schema検証を通るデータだけ出力する。
5. 対象が曖昧な場合はAIに確定的な変更として扱わせない。
6. 元HTML、注釈付きプレビュー、JSONの3つを対応付けて利用できる。

この文書とJSON Schemaは将来実装のための仕様案であり、現行アプリに読込・出力機能が実装されたことを意味しない。
