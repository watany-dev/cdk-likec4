# Steering — cdk-likec4

## 目的・構成

プロダクトではなく検証ベースライン。Node 24 / npm / strict TypeScript / Vite+。
`src/` CDK construct と stack、`bin/` 資格情報なしの app、`architecture/` 手書き LikeC4、
`tests/` unit/PBT、`formal/` 独立 npm プロジェクト（tla-ts）、`web/` 最小説明ページ。
図の正本は `.c4`。CDK から自動生成して一致を自明にしない。

## ハードルール

- `docs/invariants.md` の INV 番号は再採番・再利用しない。変更は実装・図・テストと一緒に行う。
- synth 全リソース ↔ `.c4` resource metadata を対応させる。型だけでなく constructPath も更新する。
- 資格情報、env 固定 account、AWS lookup、deploy ステップを追加しない。
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

個別コマンドは README を参照。変更手順は `.claude/skills/change-construct/SKILL.md`。
feature branch で作業し、修正は失敗テストから始め、push 前に上記検証を回す。
CI の公開状況は `docs/ci.md` を参照。ローカル成功と GitHub Actions 実行を混同しない。
