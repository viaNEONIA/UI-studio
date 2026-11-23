# ブランチ情報

確認日：2026年11月23日（日本時間）

これは確認時点の一覧です。最新の状態は[ブランチ一覧](https://github.com/viaNEONIA/UI-studio/branches)と[オープンPR](https://github.com/viaNEONIA/UI-studio/pulls)を参照してください。

## 開発・配布の基準

| 対象 | 確認時点の状態 |
| --- | --- |
| `main` | `8916cef5b007f8ff8747ae4be97bef01b497a865`。PR #45まで統合済み |
| `latest-dev` | 確認時点でmainと同じ `8916cef` を指す配布用タグ。ブランチではない |
| `feat/html-slide-annotations` | [PR #44](https://github.com/viaNEONIA/UI-studio/pull/44)でmainへ統合済み |
| `feat/compact-toolbar-callout-centers` | 右上メニュー集約・文字枠の四隅リサイズ・円の中心表示とスナップ。[PR #45](https://github.com/viaNEONIA/UI-studio/pull/45)でmainへ統合済み |

新しい開発はmainを起点にします。残存する過去のブランチ名から最新の機能や未完了作業を判断しないでください。

## リモートに残っている過去の作業ブランチ

`git rev-list --count origin/main..origin/<branch>`で各ブランチにのみ存在するコミットを確認しました。以下は2026年11月19日の調査です。当時すべて0件で、当時のmainに含まれていました。ブランチは削除していません。

| ブランチ | 先端コミット | 統合状況 |
| --- | --- | --- |
| [`ci/automatic-release-assets`](https://github.com/viaNEONIA/UI-studio/tree/ci/automatic-release-assets) | [`7e1087e`](https://github.com/viaNEONIA/UI-studio/commit/7e1087e193c0f75c0d006d8e47471e5d5d569c59) | mainへ統合済み（未統合コミット0件） |
| [`docs/current-readme-roadmap`](https://github.com/viaNEONIA/UI-studio/tree/docs/current-readme-roadmap) | [`cb22685`](https://github.com/viaNEONIA/UI-studio/commit/cb22685de21ef6185aa3f55e2f36ce86ede46c54) | mainへ統合済み（未統合コミット0件） |
| [`feat/a4-a3-canvas`](https://github.com/viaNEONIA/UI-studio/tree/feat/a4-a3-canvas) | [`f4dbbbd`](https://github.com/viaNEONIA/UI-studio/commit/f4dbbbd4d0a13d72f4e049733a5dc09622cac9e2) | mainへ統合済み（未統合コミット0件） |
| [`feat/angle-lock-layer-labels-node24`](https://github.com/viaNEONIA/UI-studio/tree/feat/angle-lock-layer-labels-node24) | [`77d6112`](https://github.com/viaNEONIA/UI-studio/commit/77d6112c13e18fbcb7256626343f3f3ad3ac08bf) | mainへ統合済み（未統合コミット0件） |
| [`feat/background-transparency`](https://github.com/viaNEONIA/UI-studio/tree/feat/background-transparency) | [`dc50bfc`](https://github.com/viaNEONIA/UI-studio/commit/dc50bfcee27410cc2fd4307921847da08e87aefb) | mainへ統合済み（未統合コミット0件） |
| [`feat/cursor-guides-crosshair`](https://github.com/viaNEONIA/UI-studio/tree/feat/cursor-guides-crosshair) | [`d614ea6`](https://github.com/viaNEONIA/UI-studio/commit/d614ea670de81a20f52f71354c585b66632f62aa) | mainへ統合済み（未統合コミット0件） |
| [`feat/drawing-lines`](https://github.com/viaNEONIA/UI-studio/tree/feat/drawing-lines) | [`1168b0c`](https://github.com/viaNEONIA/UI-studio/commit/1168b0c472617fcc904056cb3c6c5af2b180733f) | mainへ統合済み（未統合コミット0件） |
| [`feat/editor-workflow-layout`](https://github.com/viaNEONIA/UI-studio/tree/feat/editor-workflow-layout) | [`3536fe6`](https://github.com/viaNEONIA/UI-studio/commit/3536fe60d4d48aada9ad0fe06fb181082409ee88) | mainへ統合済み（未統合コミット0件） |
| [`feat/layer-first-editor-layout`](https://github.com/viaNEONIA/UI-studio/tree/feat/layer-first-editor-layout) | [`fe02bfe`](https://github.com/viaNEONIA/UI-studio/commit/fe02bfefdebdb65eeb288d3b4fbb6fdc7f5a8be9) | mainへ統合済み（未統合コミット0件） |
| [`feat/line-endpoints-shift`](https://github.com/viaNEONIA/UI-studio/tree/feat/line-endpoints-shift) | [`db7cceb`](https://github.com/viaNEONIA/UI-studio/commit/db7cceb4dcbe615de1d66adb144cddd262d88a0e) | mainへ統合済み（未統合コミット0件） |
| [`feat/pdf-adaptive-render`](https://github.com/viaNEONIA/UI-studio/tree/feat/pdf-adaptive-render) | [`d0e2b7c`](https://github.com/viaNEONIA/UI-studio/commit/d0e2b7ce680c9e6a482ecfd5a6905216cd6d3134) | mainへ統合済み（未統合コミット0件） |
| [`feat/pdf-size-midpoint`](https://github.com/viaNEONIA/UI-studio/tree/feat/pdf-size-midpoint) | [`785e523`](https://github.com/viaNEONIA/UI-studio/commit/785e523c0132c413173a2d54b51ca2e02bb96567) | mainへ統合済み（未統合コミット0件） |
| [`feat/precision-drawing`](https://github.com/viaNEONIA/UI-studio/tree/feat/precision-drawing) | [`9edaf81`](https://github.com/viaNEONIA/UI-studio/commit/9edaf81cfb6f35f7bfdf7d26186def64791c2898) | mainへ統合済み（未統合コミット0件） |
| [`feat/property-presets-display-fit`](https://github.com/viaNEONIA/UI-studio/tree/feat/property-presets-display-fit) | [`e08df85`](https://github.com/viaNEONIA/UI-studio/commit/e08df85360895efd4a6e7a536830bc7cacc0b2ad) | mainへ統合済み（未統合コミット0件） |
| [`feat/text-placement-snap-shortcuts`](https://github.com/viaNEONIA/UI-studio/tree/feat/text-placement-snap-shortcuts) | [`c1e22db`](https://github.com/viaNEONIA/UI-studio/commit/c1e22db2a49368a025838e432dec21c66dfe8ad0) | mainへ統合済み（未統合コミット0件） |
| [`feat/workflow-pdf-fixes`](https://github.com/viaNEONIA/UI-studio/tree/feat/workflow-pdf-fixes) | [`93f53b0`](https://github.com/viaNEONIA/UI-studio/commit/93f53b03a2de6e53538ec2132b2d8cf96498121b) | mainへ統合済み（未統合コミット0件） |
| [`fix/line-hit-testing-ui-controls`](https://github.com/viaNEONIA/UI-studio/tree/fix/line-hit-testing-ui-controls) | [`9693d13`](https://github.com/viaNEONIA/UI-studio/commit/9693d13538e2b0a2488f631fa0000637f9654616) | mainへ統合済み（未統合コミット0件） |
| [`fix/pdf-text-layout`](https://github.com/viaNEONIA/UI-studio/tree/fix/pdf-text-layout) | [`fd46cd8`](https://github.com/viaNEONIA/UI-studio/commit/fd46cd8dfc8cb8cf5375e8ba9b502f614b70dd14) | mainへ統合済み（未統合コミット0件） |
| [`fix/text-edit-stroke-slider`](https://github.com/viaNEONIA/UI-studio/tree/fix/text-edit-stroke-slider) | [`88cb797`](https://github.com/viaNEONIA/UI-studio/commit/88cb7978e91bd0d55d6e96db6ca306e0ac210599) | mainへ統合済み（未統合コミット0件） |
| [`fix/tool-feedback-pan`](https://github.com/viaNEONIA/UI-studio/tree/fix/tool-feedback-pan) | [`a13d354`](https://github.com/viaNEONIA/UI-studio/commit/a13d3540857016cf9dbae4b5d720b9b0fc8ff62b) | mainへ統合済み（未統合コミット0件） |
| [`fix/v06-audit-playwright`](https://github.com/viaNEONIA/UI-studio/tree/fix/v06-audit-playwright) | [`d0a14e2`](https://github.com/viaNEONIA/UI-studio/commit/d0a14e2853a64367af9810a2c3ebfe7481b21420) | mainへ統合済み（未統合コミット0件） |

## 最近統合したPR

- [#45](https://github.com/viaNEONIA/UI-studio/pull/45)：`feat/compact-toolbar-callout-centers` → main。先端`a8c4b9b`、マージ`8916cef`（2026年11月22日）。
- [#44](https://github.com/viaNEONIA/UI-studio/pull/44)：HTMLスライド取込・注釈編集・AI指示JSONをmainへ統合。マージ`3d10649`。

- [#39](https://github.com/viaNEONIA/UI-studio/pull/39)：`feat/named-saves-callout-metadata` → main。先端`17ad12e`、マージ`0acb08c`。元ブランチは確認時点のリモート一覧に存在しない。
- [#38](https://github.com/viaNEONIA/UI-studio/pull/38)：`feat/workflow-pdf-fixes` → main。先端`93f53b0`、マージ`a8a2231`。元ブランチは残存。

ブランチ一覧は新しいpush・削除で変わります。mainとlatest-devの上記SHAも、この確認時点の記録です。
