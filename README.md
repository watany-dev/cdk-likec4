# cdk-likec4

AWS CDK + LikeC4 を、プロパティテストと小さな形式仕様で検証する TypeScript ベースライン。
プロダクト完成版ではなく、構成・検証・エージェント用手順をまとめた最小の土台です。

**例:** private/versioned/encrypted な S3 bucket と、その名前を参照する SSM parameter。
資格情報なしで synth・図の検証・テストが可能です。AWS への deploy は行いません。
**公開制約:** Actions の3定義は初回公開 token の scope 不足によりローカル clone のみに保存。
公開リポの CI が稼働しているわけではありません。詳しくは [CI](docs/ci.md)。

## 必要環境・開始

Node.js **24.22.1**（`.nvmrc`、最低24.11）、npm 10.9.4、git。
Vite+ の global install、AWS CLI/アカウント、Java、Graphviz の native binary は不要です。

```sh
git clone https://github.com/watany-dev/cdk-likec4.git
cd cdk-likec4
npm ci
npm run formal:install
npm run check
```

小さい `/tmp` 環境では install/clone の前に、十分なディスクのある場所を設定してください。
この作業環境では次を使用しています。

```sh
mkdir -p ~/workspace/cdk-likec4-build/{tmp,npm-cache}
export TMPDIR=~/workspace/cdk-likec4-build/tmp
export npm_config_cache=~/workspace/cdk-likec4-build/npm-cache
```

## 構成

```text
bin/app.ts                    環境に依存しない CDK app
src/artifact-store.ts          小さな construct (S3 + SSM)
src/sample-stack.ts            1 stack
src/naming.ts                  pure な命名・入力検証
architecture/model.c4         手書き LikeC4 モデルと view
tests/                        unit + fast-check PBT
scripts/                      INV trace、SVG export
formal/                       別 npm/lock/tsconfig の tla-ts 仕様
web/                          Vite+ の最小説明ページ
docs/invariants.md            INV-1 ～ INV-5 の契約
.claude/skills/                construct 変更用 skill
CLAUDE.md                     steering
.github/dependabot.yml        npm (root/formal) + Actions
```

## 全コマンド

| コマンド                                  | 内容                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                             | `vp dev`、説明ページの dev server                                            |
| `npm run build` / `npm run preview`       | `vp build` / `vp preview`、説明ページを dist に生成/表示                     |
| `npm run typecheck`                       | strict tsc、CDK/test/web/config                                              |
| `npm run lint`                            | `vp lint`、Oxlint + type-aware/typecheck                                     |
| `npm run format` / `npm run format:check` | Oxfmt の書き込み / チェック                                                  |
| `npm run trace`                           | docs の INV と PBT テスト名の対応                                            |
| `npm test`                                | unit + PBT + coverage (src 全体95%以上)                                      |
| `npm run test:watch` / `npm run test:pbt` | watch / PBT のみ                                                             |
| `npm run synth`                           | `cdk synth --no-lookups --quiet`、cdk.out に生成                             |
| `npm run diagram:validate`                | `likec4 validate architecture`                                               |
| `npm run diagram:export`                  | LikeC4 DOT + SVG を diagrams に生成（WASM Graphviz 表現）                    |
| `npm run formal:install`                  | 独立 formal の `npm ci`                                                      |
| `npm run formal:check`                    | formal の型検査 + 全状態モデル検査 + negative control                        |
| `npm run mutation`                        | src 全体の Stryker、90%以上、reports/mutation に HTML/JSON                   |
| `npm run check`                           | typecheck → lint → format → trace → test → synth → validate → formal → build |

```sh
FC_RUNS=1000 FC_SEED=42 npm run test:pbt
npm run mutation
npm run diagram:export
# formal だけ独立で:
cd formal && npm ci && npm test
```

PBT は生成した project/stage ごとに synth し、実際にパースした `.c4` とリソース型・
construct path を比較します。タグ、S3 の保護設定、SSM 名、CloudFormation Ref と図の向きも検査。
INV 番号は再利用しません。[不変条件](docs/invariants.md)を参照してください。

形式検査は「参照元 catalog があるなら参照先 bucket が存在する」という有限モデルの安全性。
作成 guard を外した仕様で反例が出ることも確認します。
実 AWS の障害・IAM・データ保全・任意サイズのグラフを証明するものではありません。
S3 の Retain とモデルの削除の意味の違いも [formal/README](formal/README.md) に記載しています。

## CI/CD・依存更新

[CI の設計と公開制約](docs/ci.md)。用意した定義は ci（PR/main/手動）、mutation（手動/週次）、
diagram（PR/main/手動、図の artifact）。デプロイ資格情報が要る処理は入れていません。
初回 token に workflow scope がないため3つの workflow は公開 main に未反映です。
Dependabot の設定は公開し、npm ルート・formal・Actions を週次更新します。

Vite+ は npm の安定版1.8.0を採用し、Vite/Vitest の alias/pin を公式手順に合わせています。
更新時は `npm exec -- vp toolchain` と overrides の整合性を確認してください。

## ベースラインの出典

- [wisp-and-lantern](https://github.com/watany-dev/wisp-and-lantern): Vite+、PBT/INV、Stryker、CI の検証ゲート。
- ローカル `chokkin-tla-ts`（[chokkin](https://github.com/watany-dev/chokkin) 由来）: 独立形式検査、tla-ts、negative control。
- [lazycodecommit](https://github.com/watany-dev/lazycodecommit): strict TS、再現できる検証スクリプト、Claude skill、明確な README。
- [irasutoya-search](https://github.com/watany-dev/irasutoya-search): README の目的・要件・制約の示し方（Go製であり TS 構成は非採用）。
- [cf2router](https://github.com/watany-dev/cf2router): 調査時点は placeholder README のみ、技術要素の採用なし。

確認コミット、読んだファイル、採否、Vite+ の公式根拠は [出典一覧](docs/baseline-sources.md)。

## License

MIT — [LICENSE](LICENSE)。
