# Steering — cdk-likec4

## 目的・構成

CDK の cloud assembly（`cdk.out`）から LikeC4 DSL を生成し、インフラ変更と図を同じ PR で同期させる CLI。
仕様は `docs/spec.md`、フェーズと完了条件は同ファイルの「ロードマップ」。現在は **準備フェーズ（P0 前）**。
Node 24 / npm / strict TypeScript / Vite+。単一 npm パッケージで始め、分割は P3 で再検討する。

- 図のモデル部分の正本は CDK（cloud assembly）。人が書くのはビュー・説明文・外部システムと利用者だけ。
- 処理は Loader → Extractor → Inference → Mapper → Emitter の一方向。I/O は Loader と Emitter に限り、
  ほかは純粋関数にする。P0 から `src/core/`（I/O なし）と `src/cli/`（Loader・Emitter・CLI）に分ける。
- `src/` の S3 + SSM SampleStack と `architecture/model.c4` は、ゴールデンテスト用サンプル 1 号とその期待図。
  P0 で `fixtures/` 配下に移す。
- `tests/` unit/PBT、`formal/` 独立 npm プロジェクト（tla-ts）、`web/` 最小説明ページ。

## ハードルール

- 決定性: 同じ cloud assembly と設定から、バイト単位で同じ出力を得る。時刻・乱数・絶対パス・OS 依存の改行を出力しない。
- `generated/` 配下の生成物を手編集しない。手書きファイルは生成要素を ID で参照するだけにする。
- 生成時に AWS 認証・ネットワークアクセス・AWS lookup を使わない。資格情報、env 固定 account、deploy ステップを追加しない。
  例外は npm 公開の workflow のみで、追加する PR でトークンの扱いを明記する。
- 環境変数の値・シークレットを出力しない。account ID は既定でマスクする。
- 推論した関係はすべて根拠（evidence）と確度を持つ。根拠なしの矢印を出さない。
- `docs/invariants.md` の INV 番号は再採番・再利用しない。変更・追加は実装・テストと同じ PR で行う。
- formal は抽象モデル。証明の範囲を明記し、生成 `.tla/.cfg` を手編集しない。
- カバレッジ95%、mutation90%の閾値を、単に通す目的で下げない。
- Vite+ を更新するときは overrides の core alias / Vitest / coverage も公式 bundled version と揃える。

## コマンド

```sh
npm ci
npm run formal:install
npm run check        # typecheck/lint/format/trace/unit+PBT/synth/validate/formal/build
npm run mutation     # Stryker (src/ 全体)
npm run diagram:export
FC_RUNS=1000 FC_SEED=42 npm run test:pbt
```

個別コマンドは README を参照。サンプル construct の変更手順は `.claude/skills/change-construct/SKILL.md`
（P0 で生成器向けの手順に置き換える）。
feature branch で作業し、修正は失敗テストから始め、push 前に上記検証を回す。
CI は `docs/ci.md` を参照。ローカル成功と GitHub Actions 実行を混同しない。
