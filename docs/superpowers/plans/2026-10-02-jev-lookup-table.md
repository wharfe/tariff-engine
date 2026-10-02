# 作業計画: Jev で作る対応表（Gate2 3 周目まで反映・周回上限で打ち切り）

設計書: `docs/superpowers/specs/2026-10-02-jev-lookup-table.md`
ブランチ: `feat/lookup-table`（`exp/decision-model-bench` の上）

## 実測の前提
- 20 章の号は 2,104 個 → 10 件ずつで約 2.1 万件。Jev は 1 件あたり約 5.3 千トークン（実測）→ 約 4.7 ドル。
- 試しの 196 件で、号一致かつ項の確信度 0.8 以上は 58% → 表は約 1.2 万行の見込み。
- 50 問のうち 20 章に入るのは 24 問、入らないのが 26 問。

## 段取り
1. 比較用コードを確定（済み）。`feat/lookup-table` を切る（済み）。
2. **Jev の呼び出し**: `compiler/jev-client.ts`。1 回呼ぶごとに使ったトークンを `data/lookup-raw/usage.jsonl` に追記
   （失敗した段・再試行の分も含む）。費用の見張りはこのログの合計を起点にする。
3. **言い方を書かせる**: `compiler/generate-phrases.ts`
   - `claude -p` を一時ディレクトリで実行。号 20 個ずつ・各 10 件。出力は `phrases.jsonl` に追記。
   - 再開: 書き込む前に末尾の改行を補う。「済み」は号ごとの行が 8 本以上そろっているもの。
   - **閾値用は別の回**: `--purpose tune --per 1 --all-chapters` で、別の指示文（小売の商品名風）で号ごとに 1 件、
     97 章ぶんを `tune-phrases.jsonl` に。表には入れない。
4. **漏れ止め**: `compiler/lookup-leak-check.ts`
   - 照合先: `tests/fixtures/*.json`・`tests/hard-20-verified.md`・`tests/fixtures/test-cases-draft.md`。
   - 落とす条件: 語幹の Jaccard ≥ 0.6、**または重なり係数（共通語数 ÷ 短いほうの語数）≥ 0.8**。
   - 表用・閾値用の両方に、Jev の前と表を作る前の 2 回かける。
5. **Jev に解き直させる**: `compiler/verify-phrases.ts`（3 段・選択肢 1 つは呼ばない・同時 8 本・〈号, 言い方〉で再開・
   1.5 億トークンで停止）。表用だけ。閾値用は Jev に通さない（正解は書かせた号を使う）。
6. **表を作る**: `compiler/build-lookup.ts` → `data/lookup.json`（号一致かつ項の確信度 ≥ 0.8）。
   号ごとの採用数・捨てた数を `data/lookup-raw/summary.md`。`.gitignore` に `!data/lookup.json`。
7. **引く仕組み**: `src/lookup.ts` と `src/lookup-data.ts`
   - 表は `lookup-data.ts` が `data/lookup.json` を import して埋め込む（ファイルを探さない）。
     既定で有効。`setLookup(table | null)` で差し替え・無効化、`lookupStatus()` で行数と除いた行数を返す。
   - 否定判定は入力専用の `NEGATION_RE` を `lookup.ts` に新設（not / without / except / excluding / other than・単独の non）。
     ハイフン付きの non-xxx は否定とみなさない。**`src/scoring.ts` は差分に入れない。**
   - 転置索引・idf・表に無い語は最大の重み・共通語幹 1 つだけは不採用・同点は 6 桁の大きい順。
   - 索引は最初に `lookup()` が呼ばれた時に 1 回だけ作る。木に無い号の行はその時に除く。
   - `src/index.ts` から `setLookup` / `lookupStatus` を公開。
8. **分類に組み込む**: `classify()`
   - 先頭の候補: confidence ＝ 0.6 + 0.4 × 点数。理由欄は木の経路＋ `Lookup: "<言い方>" (score 0.xx)`。
   - 2 位以降はルールの候補（同じ号を除く）。confidence は `min(元の値, 先頭 − 0.01)`。
   - 要確認: 今の式に加え、表とルールの 1 位の章が違い、ルールの 1 位が `NEEDS_REVIEW_THRESHOLD` 以上なら true。
   - 既存の試験はそのまま（表ありで動く）。ルールだけの値を見る試験（章ごとの A/B）は `setLookup(null)` で固定。
   - Web 版は追加の作業なし（同じ import が Vite で束ねられる）。`vite build` を走らせて大きさを記録する
     （今の Web ビルドが通るかは未確認。通らなければ別件として報告）。
9. **閾値の決め方**: 閾値用 (a)（表の外 77 章）の誤当たり率が 0.5% 以下になる最小値。
   (b)（表の 20 章・別の回）は表の行に近いものを除き、その閾値で正解率 80% 以上を確認。144 問・50 問は使わない。
10. **試験**
    - 着手前に `tests/fixtures/baseline-50.json` に 50 問の件ごとの今の 1 位と正解数を記録（表を入れる前のコードで生成）。
    - `tests/lookup.test.ts`: 点数の式・同点・表に無い語・共通 1 語・否定語（ハイフン含む）・表なし・木に無い行・閾値の境目。
    - `tests/lookup-accuracy.test.ts`:
      - 144 問で項の 1 位 ≥ 75%・章 ≥ 85%。
      - 50 問のうち表の外の 26 問で閾値以上の当たり 0 件。
      - 50 問の正解数が記録以上、新たな外れ 0。
      - 初回呼び出し（読み込み＋索引作り＋1 問）300ms 未満。
    - 参考の報告: 144 問に雑音語を足した版（決まった語の一覧を足す。乱数なし）の当たる率・正解率。
11. **公開の準備**: `npm pack` → **空白と日本語を含む**一時ディレクトリに入れる → README の 3 行と CLI をそのまま動かし、
    `lookupStatus().rows > 0` と理由欄の `Lookup:` で表が効いていることを確認。dist の増分 1.5MB 以下。
    README・CHANGELOG。版上げと公開はしない。

## 確認のしかた
- 各段の後に `npm test` の出力を貼る。8 の後に比較の baseline を `--out` の別ディレクトリで再計測。最後に `/code-gate`。

## 止まる条件
- 費用の見張りに当たったら止めて報告。144 問で 75% に届かない、または表の外で誤当たりが出たら、式をいじる前に報告
  （144 問での合否判定は 1 回だけ）。

## Gate2 の記録
- 3 周で上限。1 周目 high 6、2 周目 high 3、3 周目 high 3。
- 「表が黙って効かない」と「誤当たりを独立に測れない」が 2 回ずつ出たため、設計に戻して手段を替えた
  （表の埋め込み、材料の 3 分割）。3 周目の high 3 件はこの手段の入れ替えと入力専用の否定判定で解消する見込みだが、
  **4 周目のレビューは回していない**。解消の確認は Gate3（/code-gate）で行う。

## 既知の別件（今回は直さない・PR に 1 行）
- 比較の「ルールの上位 10 件」は実際は上位 3 件。章ごとの試験の 6 桁一致の行が `expected4` と比べている。
- 木（`data/hs-tree.json`）は `process.cwd()` 基準で読む既存の作りのまま。表は 2 通り探すので先に見つかることがある。
