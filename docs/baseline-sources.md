# ベースラインの出典と採否

調査日: 2026-11-27。既存コードの大量コピーではなく、次の構成・規約を小さく適用した。

| 出典・確認版                                                                                                     | 読んだ主なファイル                                                                                                                                                                                              | 採用 / 非採用                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [wisp-and-lantern](https://github.com/watany-dev/wisp-and-lantern/tree/6e90c4cd09a02b1f6b78a363b141e2fe8a8f96d7) | package.json、vite.config.ts、vitest.setup.ts、stryker.config.json、scripts/check-trace.mjs、.kiro/steering/domain-invariants.md、.kiro/skills/update-docs/SKILL.md、.github/workflows/{ci,nightly}.yml、README | Vite+、fast-check の FC_RUNS/FC_SEED、INV 固定番号と PBT trace、coverage gate、Stryker perTest、最小権限/SHA pin/timeout/artifact。ゲーム・Pages deploy・shard は不要なので持ち込まない。mutation は依頼に合わせ手動＋週次に簡素化。                                                                                                       |
| ローカル `~/workspace/chokkin-tla-ts`（Git 管理外、2026-11-16 時点の README/PORT-REPORT）                        | package.json、tsconfig.json、README.md、PORT-REPORT.md、src/mc-reachability.ts、research/typescript-current.md                                                                                                  | npm/lock/tsconfig を分離した形式検査、tla-ts 0.0.10、TS→TLA+/cfg 生成、全状態検査＋壊した仕様による negative control、有限モデルの限界の明記。元 Reachability 仕様自体は流用しない。公開出自は [watany-dev/chokkin](https://github.com/watany-dev/chokkin) の形式仕様、tla-ts は [aidenybai/tla-ts](https://github.com/aidenybai/tla-ts)。 |
| [lazycodecommit](https://github.com/watany-dev/lazycodecommit/tree/8ec306ad1fd5250b5395770ad1d23de01e36bafa)     | 最新 main に fast-forward 後、package.json、vitest.config.ts、tsconfig.json、AGENTS.md/CLAUDE.md、.claude/skills/update-docs/SKILL.md、.github/workflows/ci.yml、README                                         | strict＋noUncheckedIndexedAccess/exactOptionalPropertyTypes、CLI スクリプトで CI 再現、.claude/skills の frontmatter と docs 同期手順、README の状態/要件/操作/検証の区分。Bun・TUI・AWS 実 API は非採用。                                                                                                                                 |
| [irasutoya-search](https://github.com/watany-dev/irasutoya-search/tree/c5603881e2833cf5457a8623f664beb51e0f0e0c) | README.md、リモート main tree                                                                                                                                                                                   | 実体は Go 製。package.json / TS tests / Actions / steering / skills は存在しない。README の目的→要件→実行→制約の明確さだけ参考。TS ベースラインを採用したとは扱わない。                                                                                                                                                                    |
| [cf2router](https://github.com/watany-dev/cf2router/tree/bed3cbfd30787242d13a7972510dda37288e9e01)               | README.md、リモート main tree                                                                                                                                                                                   | README の placeholder だけ。package.json / tests / CI / steering / skills は存在せず、技術要素の採用なし。                                                                                                                                                                                                                                 |

ローカル clone が古いケースを避けるため GitHub API で main の tree/commit を照合した。
特に lazycodecommit はローカルの初期コミットから大きく進んでいたため更新して読んだ。

## Vite+ の判断: 採用

公式 [Getting Started](https://viteplus.dev/guide)、[Project-local CLI](https://viteplus.dev/guide/local-cli)、
[Test](https://viteplus.dev/guide/test)、[Lint](https://viteplus.dev/guide/lint)、
[Format](https://viteplus.dev/guide/fmt)、[Build](https://viteplus.dev/guide/build) と
`npm view vite-plus version description bin engines dist-tags --json` を照合した。

- npm の stable/latest は **1.8.0**。ローカル `vp` CLI を含む通常の devDependency として利用可能。
- Node 要件は `^22.18.0 || ^24.11.0 || >=26.0.0`。本ベースラインは実検証した Node 24.22.1 を固定。
- グローバル installer は不要。`npm ci` 後の npm scripts で local `vp` を解決する。
- 公式の manual install に従い `vite` を `@voidzero-dev/vite-plus-core@8.3.8001` に alias、
  `vitest` を bundled **5.1.1** に override。coverage も5.1.1。
- `vp toolchain` が Vite 8.3.8 / Vitest 5.1.1 / Oxlint 1.94.0 / Oxfmt 0.79.0 を報告。
- `dev/build/test/lint/format` を vp に寄せ、CDK/LikeC4/formal は専用 CLI のまま分離。
  `build` は最小説明用 web ページの Vite build であり、CDK synth を代替しない。
- TypeScript は Stryker/tla-ts との JS API 互換性を優先し **6.0.2** を明示固定。
  `vp lint` の型検査は同梱 tsrs、`npm run typecheck` は独立した tsc。

ローカルで build/test/lint が実際に通り Stryker の Vitest runner も動いたため、
通常の Vite+Vitest へのフォールバックはしていない。

## LikeC4 図出力の判断

LikeC4 1.61.1 の `export` は PNG/JPEG 等で SVG サブコマンドはない。
PNG 用 Chromium download がこの環境で timeout したため、公式 `gen dot` と
公開 API `likec4/layouts` の GraphvizWasmAdapter で SVG を生成する。
LikeC4 UI と同じ見た目は保証しないが、実際の `.c4` から生成された図であり、
ブラウザ/native Graphviz/クラウドへの接続なしで CI artifact 化できる。
