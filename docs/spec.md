# cdk-likec4 仕様書とロードマップ

初版: 2026-11-27。準備フェーズで Node 24 固定・単一パッケージ開始の決定を反映。

## 1. 概要

cdk-likec4(仮称)は、CDKアプリのcloud assemblyからLikeC4 DSLを生成し、インフラの変更と図を同じPRで同期させるCLIです。

対象は、CDKでAWSインフラを管理しながら、アーキテクチャ図を手作業で保守しているチームです。

**ゴール**

- CDKを唯一の正とし、図のモデル部分をすべて生成する
- 同じ入力から常に同じ出力を得る(バイト一致)。生成物はGitでレビューできる
- 人が書くのはビュー、説明文、外部システムと利用者だけにする
- CDKの記述言語(TypeScript、Pythonなど)に依存しない

**非ゴール**

- 図からCDKへの逆変換
- 独自のレンダラやレイアウトエンジン(LikeC4に任せる)
- デプロイ済みリソースとの差分(drift)検出
- Terraformなど他のIaCへの対応(v1.0まで)

## 2. 全体構成

処理は一方向の6段で、状態を持ちません。各段は純粋関数として実装し、I/OはLoaderとEmitterに限ります。

1. **Loader**: cloud assemblyを読む。既存の `cdk.out` を読むか、`--app` 指定時はsynthを実行する
2. **Extractor**: construct木とテンプレートを突き合わせ、中間モデル(IR)を作る
3. **Inference**: リソース間の関係を推論し、IRにエッジを足す
4. **Mapper**: 設定ルールでIRを畳み、LikeC4の要素・関係・デプロイノードに写像する
5. **Emitter**: `.c4` ファイルを決定的な順序で出力する
6. **LikeC4**: 生成物と手書きファイルを読み、描画・エクスポートする(本ツールの範囲外)

当面は単一の npm パッケージ `cdk-likec4` で始め、下表の境界は `src/core/` と `src/cli/` のディレクトリで守ります。`hints` を足す P3 で、パッケージ分割を再検討します。

| 将来のパッケージ(当面はディレクトリ) | 役割                               | 主な依存               |
| ------------------------------------ | ---------------------------------- | ---------------------- |
| `@cdk-likec4/core`                   | IR、推論、Mapper、Emitter。I/Oなし | なし                   |
| `cdk-likec4`                         | CLIとLoader                        | `@aws-cdk/toolkit-lib` |
| `@cdk-likec4/hints`                  | CDK側のヒントAPI(任意導入)         | `constructs`           |

synthの実行には [CDK Toolkit Library](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/toolkit-library-configure-ca.html) を使います。`fromAssemblyDirectory` で既存の `cdk.out` を、`fromCdkApp` で任意言語のCDKアプリを扱えます。

## 3. 入力仕様

入力はcloud assembly(`cdk.out`)だけです。AWS認証もネットワークアクセスも不要で、CDKアプリのソースコードは読みません。

| ファイル          | 読む項目                                                                                  | 用途                             |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| `manifest.json`   | スタックのartifact、`environment`(account/region)、ネストしたassembly、pathごとのmetadata | StageとStackの列挙、ヒントの取得 |
| `tree.json`       | `id`、`path`、`children`、`attributes`、`constructInfo.fqn`                               | construct木と、L1/L2/L3の判別    |
| `*.template.json` | `Resources` の `Type`・`Properties`・`DependsOn`・`Metadata`、`Outputs` の `Export`       | リソースの実体と参照関係         |

construct木のノードが持つ項目は、[toolkit-libの型定義](https://cdn.jsdelivr.net/npm/@aws-cdk/toolkit-lib@1.26.2/lib/api/tree.d.ts) で確認したものです。

**突き合わせの規則**

- テンプレートの各リソースは、`Metadata` の `aws:cdk:path` でconstruct木のノードに紐づける
- `aws:cdk:path` が無効化されている場合はエラーで停止し、有効化の方法を案内する
- Stageはネストしたcloud assemblyとして現れる。Stageがないアプリは `default` という1つのStageとして扱う
- 未解決のTokenはテンプレート上で `Ref`、`Fn::GetAtt`、`Fn::ImportValue` などの組み込み関数になっている。これを参照として解析する
- `manifest.json` のスキーマバージョンを検査し、未対応のバージョンは警告する

`aws:cdk:path` や `attributes` 内のキー名はCDKの慣例に基づく記述です。PoCで実物の出力と照合して確定します。

## 4. 中間モデル(IR)

IRは、出力形式に依存しない型付きグラフです。`--emit-ir` でJSONとして書き出せ、デバッグと他形式のEmitterの入力になります。

```ts
interface Model {
  schemaVersion: 1;
  stages: string[]; // Stageなしのアプリは ['default']
  nodes: Node[];
  edges: Edge[];
}

interface Node {
  id: string; // construct path。例: 'Prod/ApiStack/Handler'
  parent?: string;
  level: "stage" | "stack" | "construct" | "resource";
  fqn?: string; // constructInfo.fqn
  cfnType?: string; // 例: 'AWS::Lambda::Function'
  logicalId?: string;
  env?: { account?: string; region?: string };
  hints?: Hints; // CDK側ヒント
  props?: Record<string, unknown>; // 許可リストにある項目だけ
}

interface Edge {
  from: string; // 呼び出す側
  to: string; // 呼び出される側
  kind:
    | "invoke"
    | "read"
    | "write"
    | "readwrite"
    | "publish"
    | "trigger"
    | "route"
    | "uses"
    | "depends";
  via: "iam" | "event-source" | "integration" | "env" | "ref" | "hint";
  confidence: "high" | "medium" | "low";
  evidence: string[]; // 根拠にしたlogicalIdやポリシー文
}
```

- `props` には環境変数の値やシークレットを入れない。許可リストはランタイム、メモリ、エンジン種別など図に出す価値のある項目に限る
- すべてのエッジは `evidence` を持つ。`explain` コマンドはこれを表示する
- `schemaVersion` はv1.0で凍結する。それまでは予告なく変わる

## 5. マッピング仕様

L2/L3 constructを論理モデルの要素に、StageとStackをデプロイモデルのノードに写像し、`instanceOf` で結びます。LikeC4の [デプロイモデル](https://likec4.dev/dsl/deployment/model/) は論理モデルの関係を引き継ぐため、関係は論理モデルに1回書けば足ります。

| CDK                       | LikeC4 DSL                                                                   | 規則                                        |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| Stage                     | デプロイノード(kind `environment`)                                           | Stageなしのアプリは `default` を1つ作る     |
| Stack                     | デプロイノード(kind `cfnStack`)と、論理モデルの最上位グループ(kind `module`) | accountとregionはデプロイノード側に記録する |
| L3・ユーザー定義construct | 論理モデルのコンテナ要素                                                     | 子の葉要素を含む                            |
| L2 construct              | 論理モデルの葉要素                                                           | kindは主リソースの種別から決める            |
| L1(Cfn)リソース           | 親要素のmetadata                                                             | 既定では要素にしない                        |
| 推論した関係              | relationship(`-[kind]->`)                                                    | 論理モデル側にだけ出力する                  |
| Stage内の配置             | `instanceOf`                                                                 | Stackのデプロイノードの下に置く             |
| Tags、ヒント              | tag、metadata、link                                                          | 優先順位は ヒント > 設定 > 既定             |

**論理要素の同一性**

- 論理要素のIDは、construct pathからStageの部分を除いたもの。`Dev/ApiStack/Handler` と `Prod/ApiStack/Handler` は同じ要素 `apiStack.handler` になる
- Stageによって存在しないconstructは、論理モデルには載せ、そのStageのデプロイモデルには置かない

**畳み込みの既定規則**

1. 主リソース(子IDが `Resource` または `Default` のL1)を持つconstructを葉要素にする。その配下のリソースはすべて葉要素に吸収する
2. 主リソースを持たず、葉要素を2つ以上含むconstructをコンテナ要素にする。1つしか含まない場合は葉要素と統合する
3. 補助リソース(`AWS::IAM::*`、`AWS::Logs::LogGroup`、`AWS::Lambda::Permission`、`AWS::CDK::Metadata`、`Custom::*`)は単独では要素にしない
4. 階層が `maxDepth`(既定3)を超えたら、超えた部分を親に畳む
5. 畳んだリソースに付く関係は、吸収先の要素に付け替える。自分自身への関係は捨てる

**kindの既定対応**(設定で上書き可)

| CloudFormationの種別                         | kind       |
| -------------------------------------------- | ---------- |
| `AWS::Lambda::Function`                      | `function` |
| `AWS::DynamoDB::Table`、`AWS::RDS::*`        | `database` |
| `AWS::S3::Bucket`                            | `bucket`   |
| `AWS::SQS::Queue`                            | `queue`    |
| `AWS::SNS::Topic`、`AWS::Events::EventBus`   | `topic`    |
| `AWS::ApiGateway::*`、`AWS::ApiGatewayV2::*` | `api`      |
| `AWS::ECS::Service`                          | `service`  |
| `AWS::StepFunctions::StateMachine`           | `workflow` |
| その他                                       | `resource` |

主リソースの判定に使う子IDの慣例と、各kindに割り当てるアイコン名は、PoCで確定します。

## 6. 関係推論

関係の向きは「呼び出す側 → 呼び出される側」に統一します。CloudFormationの参照(`Ref`)の向きは依存の向きであり、データの流れとは一致しないため、そのままは使いません。

| 根拠                     | 例                                                                       | 導く関係                       | 確度   |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------ | ------ |
| IAMポリシー              | Lambdaのロールに、テーブルARNへの `dynamodb:PutItem`                     | function -\[write\]-> database | high   |
| リソースポリシー         | `AWS::Lambda::Permission` のPrincipalがAPI Gateway                       | api -\[invoke\]-> function     | high   |
| イベントソース           | EventSourceMapping、S3通知、SNSサブスクリプション、EventsルールのTargets | queue -\[trigger\]-> function  | high   |
| 統合設定                 | API GatewayのIntegration、CloudFrontのOrigin、ALBのTargetGroup           | api -\[route\]-> function      | high   |
| 環境変数の参照           | Lambdaの環境変数がテーブル名を参照(IAMの裏付けなし)                      | function -\[uses\]-> database  | medium |
| その他の `Ref`・`GetAtt` | セキュリティグループの参照など                                           | depends                        | low    |
| ヒント                   | `Diagram.relate(a, b, 'calls')`                                          | 指定どおり                     | high   |

**IAMアクションの分類**

- read: `Get*`、`List*`、`Describe*`、`Query`、`Scan`、`Receive*`
- write: `Put*`、`Update*`、`Delete*`、`Send*`
- publish: `Publish`、`PutEvents`
- invoke: `InvokeFunction`、`StartExecution`
- readとwriteの両方があれば `readwrite` にまとめる

**解決と整理の規則**

- ポリシーのResourceが `*` の場合は関係を作らず、警告を出す
- スタック間の参照は、`Fn::ImportValue` と相手スタックの `Outputs.Export` を名前で照合して解決する
- 同じ両端の関係は1本にまとめ、確度の高い根拠を優先する
- 既定では確度medium以上だけを出力する。`depends` は出力しない
- SDK経由の実行時呼び出しのうちIAMにも環境変数にも現れないものは検出できない。ヒントで補う

## 7. 出力仕様

生成物は `generated/` に閉じ込め、再生成のたびに丸ごと上書きします。人が編集するファイルはその外に置き、生成物をIDで参照するだけにします。

```text
architecture/
  generated/          再生成で上書き。編集禁止
    spec.c4           kindとtagの定義
    model.c4          論理モデルと関係
    deployment.c4     Stageごとの配置
    views.c4          既定ビュー(--no-views で省略)
  views.c4            手書き: チームのビュー
  context.c4          手書き: 外部システム、利用者、extend
```

**出力イメージ**(構文の細部はPoCでLikeC4の検証を通して確定)

```text
// @generated by cdk-likec4. DO NOT EDIT.
specification {
  element module
  element function
  element database
  deploymentNode environment
  deploymentNode cfnStack
  relationship write
  tag generated
}

model {
  apiStack = module 'ApiStack' {
    #generated
    handler = function 'Handler' {
      #generated
      metadata {
        cdkPath 'ApiStack/Handler'
        cfnTypes 'AWS::Lambda::Function, AWS::IAM::Role'
      }
    }
    orders = database 'Orders' {
      #generated
    }
    handler -[write]-> orders
  }
}

deployment {
  environment prod {
    apiStack = cfnStack 'ApiStack' {
      technology 'ap-northeast-1'
      instanceOf apiStack.handler
      instanceOf apiStack.orders
    }
  }
}

views {
  deployment view prod {
    title 'Prod'
    include prod.**
  }
}
```

**IDと順序の規則**

- construct IDをlowerCamelCaseに正規化する。英数字と `_` 以外は除き、先頭が数字なら `_` を付ける
- 正規化後にIDが衝突したらエラーにする。連番は付けない(連番は追加順で変わり、IDが不安定になるため)。設定の `rename` で解決する
- 元のconstruct pathは metadata の `cdkPath` に残す
- 要素はIDの辞書順、関係は(from, to, kind)の順に並べる。時刻や絶対パスは出力しない
- 生成した要素にはすべて `#generated` を付け、手書きビューからtagで絞れるようにする

**手書きファイルとの境界**

- 手書き側は [extend](https://likec4.dev/dsl/extend/) で、生成要素にtag、metadata、link、子要素を足せる
- extendでタイトルや説明文を上書きできるかは、LikeC4のドキュメントで確認できていない。そのため説明文は設定の `describe` かヒントAPIで与え、生成側に出力する
- 外部システムと利用者は手書きで定義し、生成要素への関係も手書き側に書く
- 手書きビューが消えたIDを参照していたら、`check` が検出して失敗させる

デプロイビューの書き方は [LikeC4のデプロイビュー](https://likec4.dev/dsl/deployment/views/) に従います。

## 8. インターフェース

利用者が触れるのはCLI、設定ファイル、CDK側ヒントAPIの3つです。ヒントAPIは任意で、導入しなくても図は生成できます。

**CLI**

| コマンド                  | 動作                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `cdk-likec4 init`         | 設定ファイルと手書きファイルの雛形を作る                   |
| `cdk-likec4 gen`          | cloud assemblyを読み、`generated/` を書き出す              |
| `cdk-likec4 watch`        | `cdk.out` の変更を監視して再生成する                       |
| `cdk-likec4 check`        | 再生成し、コミット済みの生成物と差分があれば失敗する(CI用) |
| `cdk-likec4 explain <id>` | 要素や関係がそうなった根拠を表示する                       |

共通オプションは `--assembly <dir>`(既定 `cdk.out`)、`--app <command>`(指定時はsynthを実行)、`--out <dir>`、`--emit-ir`。終了コードは 0 = 成功、1 = 差分あり、2 = 入力または設定のエラー。

**設定ファイル** `cdk-likec4.config.ts`

```ts
import { defineConfig, type, fqn } from "cdk-likec4";

export default defineConfig({
  assembly: "cdk.out",
  out: "architecture/generated",
  stages: { include: ["Dev", "Prod"] },
  fold: {
    maxDepth: 3,
    hide: [type("AWS::IAM::*"), type("AWS::Logs::*"), type("Custom::*")],
    collapse: [fqn("aws-cdk-lib.aws_ecs_patterns.*")],
  },
  kinds: { "AWS::OpenSearchService::Domain": "database" },
  relations: { minConfidence: "medium" },
  rename: { "ApiStack/Handler": "apiStack.orderHandler" },
  describe: { "apiStack.orderHandler": "注文を受け付ける" },
  maskAccountId: true,
});
```

**CDK側ヒントAPI** `@cdk-likec4/hints`

```ts
import { Diagram } from "@cdk-likec4/hints";

Diagram.of(queue).kind("queue").title("注文キュー").tag("critical");
Diagram.of(auditBucket).hide();
Diagram.relate(handler, Diagram.external("stripe"), "calls");
```

- ヒントはconstructのmetadataとして記録する。テンプレートには影響せず、デプロイ結果は変わらない
- Loaderは `manifest.json` のmetadataからヒントを読む
- `Diagram.external('stripe')` は、手書き側で定義した外部システム `stripe` への参照を表す
- 優先順位は ヒント > 設定ファイル > 既定規則

## 9. 非機能要件

最優先は決定性です。生成物をGitでレビューする前提が、これに依存します。

| 項目         | 要件                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| 決定性       | 同じcloud assemblyと設定から、バイト単位で同じ出力を得る。時刻、乱数、絶対パス、OS依存の改行を含めない     |
| 性能         | 1,000リソースのassemblyを5秒以内に生成する(synthを除く。目標値)                                            |
| 実行環境     | Node.js 24(開発・利用とも。`engines` は `>=24.11.0 <25`)                                                   |
| CDK互換      | aws-cdk-lib v2。cloud assemblyのスキーマバージョンを検査する                                               |
| LikeC4互換   | 対応バージョンの範囲を明記する。最新版に対する互換テストを週次で回す                                       |
| セキュリティ | account IDは既定でマスクする。環境変数の値とシークレットは出力しない。生成時にネットワークへアクセスしない |
| エラー       | 入力の不備は原因と直し方を示して停止する。推論できない箇所は警告にとどめ、生成は続ける                     |

**テスト方針**

- ゴールデンテスト: サンプルCDKアプリの `cdk.out` から期待どおりの `.c4` が出ることを確かめる
- 生成物をLikeC4の検証にかけ、構文エラーと参照切れがないことを確かめる
- 推論規則は、1規則ずつ最小のテンプレートで単体テストする
- 同じ入力を2回生成して差分がないことを、CIで毎回確かめる

## 10. ロードマップ

v1.0まで準備 + 5フェーズ、合計約21週を見込みます。期間は1〜2人が兼業で進める前提の目安で、開始日が未定のため日付は置いていません。

各フェーズは完了条件を満たしてから次へ進みます。最初の公開はP1のv0.1です。

**準備(約1週)**

- 検証ベースライン(手書き `.c4` を正本とする S3 + SSM サンプル)から、本仕様の CLI 開発へ steering・README・不変条件の方針を切り替える
- Node 24 固定、単一パッケージで開始することを決定済み
- 完了条件: CLAUDE.md・README・`docs/invariants.md` が本仕様の目的と矛盾しない

**P0 PoC(約2週)**

- 単一Stage・単一スタックの `cdk.out` から `model.c4` を出力する
- 畳み込みは既定規則の1と3、関係推論はIAMポリシーだけに絞る
- 3章・5章・7章の「PoCで確定」とした項目を実物で確かめる
- 完了条件: サンプル3種(API + Lambda + DynamoDB、ECS Fargate、イベント駆動)がLikeC4で描画できる

**P1 v0.1 MVP(約4週)**

- `gen` と `check`、決定的な出力、ゴールデンテスト
- 畳み込みの既定規則すべて。IAM、イベントソース、統合設定からの推論
- npm公開とREADME
- 完了条件: 実案件1件で、生成物を手で直さずに使える図になる

**P2 v0.2(約4週)**

- 複数Stageとデプロイモデル(`instanceOf`)
- スタック間参照の解決、設定ファイル、`explain`
- 完了条件: DevとProdの2 Stageを持つアプリで、デプロイビューの配置が正しい

**P3 v0.3(約4週)**

- `watch`、ヒントAPI(TypeScript)、`rename`
- GitHub Action: PRに図の差分を表示する
- 完了条件: PRで図の差分が自動でコメントされる

**P4 v1.0(約6週)**

- IRスキーマと設定形式の凍結
- ヒントAPIの多言語対応(jsii)、ドキュメントサイト、LikeC4互換表
- 完了条件: 破壊的変更なしで2リリース続く

## 11. リスクと未決事項

最大のリスクは関係推論の誤りです。間違った矢印が1本あるだけで、図全体が信用されなくなります。

| リスク                                     | 対策                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 関係推論の誤り                             | 確度と根拠を全エッジに持たせる。既定は確度medium以上のみ出力。`explain` で根拠を確認できる       |
| construct pathの変更で手書きビューが壊れる | `check` で参照切れを検出する。`rename` で旧IDを維持できる                                        |
| cloud assemblyの形式変更                   | Loaderを薄い層に隔離する。スキーマバージョンを検査する。toolkit-libの読み込みAPIの利用を検討する |
| LikeC4 DSLの破壊的変更                     | 対応バージョンの範囲を固定する。週次の互換テストで早期に検知する                                 |
| synthがCIで遅い・失敗する                  | 既存の `cdk.out` を読むのを既定にする。synthの実行はオプションにする                             |
| 大規模アプリで図が読めない                 | 既定ビューはStack単位に分ける。`maxDepth` で深さを抑える                                         |

**未決事項**

- [ ] プロジェクト名とnpmスコープ(リポ名は `cdk-likec4`)
- [ ] ライセンス(MITかApache-2.0か。リポは現在 MIT)
- [ ] Stackを論理モデルのグループにも使うか、平坦化するか
- [ ] `extend` で説明文を上書きできるか(LikeC4のドキュメントでは未確認)
- [ ] DSLテキストを直接出力するか、LikeC4のBuilder APIを経由するか
- [ ] LikeC4同梱のAWSアイコンとkindの対応表
- [ ] Mermaidなど他形式のEmitterをどのフェーズで入れるか

## 参考

- [LikeC4: Deployment Model](https://likec4.dev/dsl/deployment/model/)
- [LikeC4: Deployment Views](https://likec4.dev/dsl/deployment/views/)
- [LikeC4: Extend](https://likec4.dev/dsl/extend/)
- [AWS CDK Toolkit Library: クラウドアセンブリソースの管理](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/toolkit-library-configure-ca.html)
- [@aws-cdk/toolkit-lib: tree.d.ts](https://cdn.jsdelivr.net/npm/@aws-cdk/toolkit-lib@1.26.2/lib/api/tree.d.ts)
