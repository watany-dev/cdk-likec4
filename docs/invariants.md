# Invariants

`INV-<n>` は再利用・付け直しをしない。変更時は同じ PR で仕様・図・PBT を更新する。
`npm run trace` は各 ID が `tests/*.pbt.test.ts` のテスト名に存在することを検査する。
これは意味の証明ではない。PBT のアサーションとモデル検査は別途実行する。

| ID    | 守る条件                                                                                                                                                                           | 検証                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| INV-1 | synth の全リソースの型の多重集合と construct 相対パスが `.c4` の resource metadata と一致する。追加・削除・同型リソースの増加も検出する。                                          | stack.pbt.test.ts、LikeC4 parser API        |
| INV-2 | 全リソースに入力どおりの Project / Stage タグが付く。                                                                                                                              | stack.pbt.test.ts                           |
| INV-3 | S3 は public access 全遮断・AES256・versioning 有効・削除/置換時 Retain。                                                                                                          | stack.pbt.test.ts                           |
| INV-4 | project は英小文字で始まる1–20文字の英小文字/数字/ハイフン。stage は dev/test/prod。SSM 名は `/<project>-<stage>/bucket-name`。不正 project は拒否し、切り詰め・暗黙正規化しない。 | naming.pbt.test.ts、stack.pbt.test.ts       |
| INV-5 | SSM の値は S3 の Ref であり、図は catalog → bucket。形式モデルの全到達状態で catalogReady ⇒ bucketReady。                                                                          | stack.pbt.test.ts、formal/src/deployment.ts |

## 範囲と再現

PBT は有効な project/stage を生成して毎回 synth する（既定100回）。
`FC_RUNS=1000 FC_SEED=42 npm run test:pbt` で回数・seed を指定できる。
失敗時 fast-check が出す seed/path を保存し、`fc.assert` の path に指定して縮小例を再実行する。

形式モデルは CloudFormation の Ref 依存の順序抽象。S3 の Retain は物理削除を抑止するため、
モデルの deleteBucket は「管理対象グラフからの削除」であって実バケット削除ではない。
AWS API の成功、IAM、障害、ロールバック、データの安全性までは証明しない。
