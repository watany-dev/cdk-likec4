# CI

**ローカルでの検証成功と GitHub Actions 上の成功は別物。** 実行結果は Actions タブで確認する。

| Workflow     | trigger               | 実行                                                                                                                                                      |
| ------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ci.yml       | main push / PR / 手動 | 両 npm lock の install、typecheck、lint、format、INV trace、unit+PBT+coverage、synth、LikeC4 validate、formal 型+モデル検査+negative control、Vite+ build |
| mutation.yml | 手動 / 日曜04:17 UTC  | Stryker、HTML/JSON report artifact                                                                                                                        |
| diagram.yml  | main push / PR / 手動 | validate、LikeC4 DOT → 同梱 Graphviz WASM SVG、artifact                                                                                                   |

いずれも timeout / concurrency を設定し、権限は job の contents:read のみ。
Actions は commit SHA 固定、checkout の資格情報永続化は無効。
AWS 認証・デプロイ・CloudFormation API 呼び出し・外部クラウドへの図 publish は不要。
Dependabot は npm ルート、npm formal、github-actions を週次更新する。
Vite+ 関連は group 化するが、core alias / Vitest pin の整合性は更新 PR で人間も確認する。

## ローカルで同じ検証

```sh
npm ci
npm run formal:install
FC_RUNS=100 FC_SEED=42 npm run check
FC_RUNS=100 FC_SEED=42 npm run mutation
npm run diagram:export
```

カバレッジは `src/` 全体95%以上、mutation は `src/` 全体90%以上を要求する。
formal は別プロジェクトで検査し、通常の Vitest や Stryker の対象に混ぜない。
図 SVG は Graphviz の表現であり LikeC4 UI の screenshot ではない。
Chromium の download を不要にするためこの経路を選んだ。
