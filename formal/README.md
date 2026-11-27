# 独立した tla-ts サブプロジェクト

ルートとは別の `package.json` / `package-lock.json` / strict tsconfig を持つ。
Java や AWS アカウントは不要。Node 24.11+ が必要。

```sh
cd formal
npm ci
npm run typecheck
npm run check
npm test
```

`src/deployment.ts` を tla-ts 0.0.10 が TLA+/cfg に変換し、有限状態を全探索する。
公開された状態変更関数は action、boolean 関数は invariant。
`Deployment.tla` / `Deployment.cfg` は生成物（gitignore）。手編集しない。

## 仕様・検査範囲

S3 バケットと、その名前を参照する SSM catalog の作成/管理対象からの削除順序。
`bucketReady` / `catalogReady` の2つの boolean、4アクション。
初期状態は両方 false。SSM 作成は S3 が存在するときだけ許可し、
S3 の管理対象からの削除は SSM が存在しないときだけ許可する。

- `ReferenceTargetExists`（INV-5）: `catalogReady` なら `bucketReady`。
- 到達可能状態: `(false,false)`, `(true,false)`, `(true,true)` の3状態。
- `npm test` は型検査とモデル検査の後、作成 guard を壊した一時コピーを検査する。
  `ReferenceTargetExists is violated` で失敗したときだけ negative control を成功とする。
- 全状態に有効な action があるため deadlock 検査は無効化しない。
- liveness/fairness は主張しない。無限の作成/削除を許容する安全性モデル。

CDK の synth PBT が実際の CloudFormation Ref と図の向きを検査し、
この抽象モデルに接続する。ただしプログラムと仕様の refinement 証明ではない。
S3 の Retain により実物は残る。`deleteBucket` は物理削除のモデルではない。
AWS 障害・IAM・並行デプロイ・データ保存・任意サイズの依存グラフは対象外。

出典: ローカル `chokkin-tla-ts` の独立 npm プロジェクト構成、生成物の区別、
全状態検査と破壊テストの併用。詳細は [`../docs/baseline-sources.md`](../docs/baseline-sources.md)。
