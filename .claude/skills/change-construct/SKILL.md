---
name: change-construct
description: CDK construct や stack を追加・変更するとき、LikeC4・不変条件・PBT・形式仕様を同期し、資格情報なしで検証する。
---

# Construct を安全に変更する

1. `CLAUDE.md` と `docs/invariants.md` を読み、影響する既存 ID を選ぶ。新しい条件だけ末尾に新番号を追加し、既存 ID を再利用しない。
2. `tests/stack.pbt.test.ts` または unit test に失敗ケースを先に足す。PBT は実際の `.c4` を LikeC4 API で読むこと。テスト側に同じ図を別途ハードコードして照合したふりをしない。
3. `src/` の construct/stack を変更する。入力検証は pure function に保ち、AWS lookup や account/region 固定を入れない。
4. `architecture/model.c4` の resource を更新する。各 resource に `awsType` と stack 相対 `constructPath` を付け、参照の向きも合わせる。L2 が暗黙生成する Policy 等も漏らさない。
5. INV の本文・PBT 名・アサーションを同期する。`npm run trace` を実行。削除 ID は履歴に残し再利用しない。
6. 依存関係や状態遷移が変わるなら `formal/src/deployment.ts` の有限状態モデル・negative control を更新する。抽象化の境界と有限インスタンスを `formal/README.md` に記録する。生成 `.tla/.cfg` は編集しない。
7. `npm run check && npm run mutation && npm run diagram:export` を実行。失敗時の fast-check seed/path とモデル検査の反例を保存し、閾値を下げず原因を直す。
8. README/steering の構成・コマンドを同期する。変更した INV、検証結果、証明していないこと、push/CI の実態を報告する。
