# cdk-likec4

CDK の cloud assembly（`cdk.out`）から LikeC4 DSL を生成し、インフラ変更と図を同じ PR で同期させる CLI を目指すリポジトリです。
仕様とロードマップは [docs/spec.md](docs/spec.md)。**現状は準備フェーズ（P0 PoC の前）で、CLI はまだありません。**

今あるのは、ゴールデンテスト用サンプル 1 号（private/versioned/encrypted な S3 bucket と、その名前を参照する
SSM parameter の CDK stack）とその期待図、PBT・mutation・形式検査の検証ゲートです。
資格情報なしで synth・図の検証・テストが可能で、AWS への deploy は行いません。
サンプルは P0 で `fixtures/` に移します。CI は [docs/ci.md](docs/ci.md)。

## 必要環境・開始

Node.js **24.22.1**（`.nvmrc`、最低24.11）、npm 11.19.1（Node 同梱版）、git。
Vite+ の global install、AWS CLI/アカウント、Java、Graphviz の native binary は不要です。

```sh
git clone https://github.com/watany-dev/cdk-likec4.git
cd cdk-likec4
npm ci
npm run formal:install
npm run check
```

## 構成

```text
bin/app.ts                    環境に依存しない CDK app
src/artifact-store.ts          小さな construct (S3 + SSM)
src/sample-stack.ts            1 stack
src/naming.ts                  pure な命名・入力検証
architecture/model.c4         サンプルの期待 LikeC4 モデルと view
tests/                        unit + fast-check PBT
scripts/                      INV trace、SVG export
formal/                       別 npm/lock/tsconfig の tla-ts 仕様
web/                          Vite+ の最小説明ページ
docs/spec.md                  CLI の仕様とロードマップ
docs/invariants.md            INV-1 ～ INV-5 の契約
.claude/skills/                construct 変更用 skill
.claude/settings.json         Claude Code 用 pstack plugin の有効化
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

[CI の設計](docs/ci.md)。用意した定義は ci（PR/main/手動）、mutation（手動/週次）、
diagram（PR/main/手動、図の artifact）。デプロイ資格情報が要る処理は入れていません。
3つの workflow は `.github/workflows/` にあります。実行結果は GitHub Actions を確認してください。
Dependabot の設定は公開し、npm ルート・formal・Actions を週次更新します。

Vite+ は npm の安定版1.8.0を採用し、Vite/Vitest の alias/pin を公式手順に合わせています。
更新時は `npm exec -- vp toolchain` と overrides の整合性を確認してください。

## License

MIT — [LICENSE](LICENSE)。
