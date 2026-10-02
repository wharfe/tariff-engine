# 作業計画: Jev で作る対応表（Gate2 1 周目の指摘 13 件を反映済み）

設計書: `docs/superpowers/specs/2026-10-02-jev-lookup-table.md`
ブランチ: `feat/lookup-table`（`exp/decision-model-bench` の上に積む）

## 実測の前提（Gate2 で検算）
- 20 章の号は 2,104 個 → 10 件ずつで約 2.1 万件。
- Jev は 1 件あたり約 5.2 千トークン（3 段の合計、実測平均）→ 約 1.1 億トークン ≒ 約 4.7 ドル。
- 50 問（`test-cases.json`）のうち 20 章に入るのは 24 問、入らないのが 26 問。

## 段取り
1. **比較用コードを確定**（済み: `exp/decision-model-bench` の cfcf11d 系）。その上に `feat/lookup-table` を切る。
2. **Jev の呼び出しを製品側に置く**: `compiler/jev-client.ts`。鍵は `TYPESAFE_API_KEY` か `~/.config/typesafe/api-key`
   （表示しない）。429/5xx は 3 回まで再試行。`experiments/` からは import しない。
3. **言い方を書かせる**: `compiler/generate-phrases.ts --chapters ...`
   - `claude -p --setting-sources "" --tools "" --model sonnet` を**一時ディレクトリで**実行（repo の文脈を入れない）。
   - 1 回に号を 20 個、号ごとに 10 件。通関書類の品名欄のような短い言い方中心、長さ・語彙をばらけさせる。
   - 渡すのは号・項・章の説明だけ。試験問題のファイルは読まない。
   - 出力は `data/lookup-raw/phrases.jsonl` への**追記**（1 行 =〈号, 言い方〉）。既にある号は飛ばす。
   - JSON が壊れた回は 1 回だけやり直し、だめならその束を記録して飛ばす。
4. **漏れ止め**: `compiler/lookup-leak-check.ts`
   - 照合先: `tests/fixtures/*.json` の全説明＋`tests/hard-20-verified.md`＋`tests/fixtures/test-cases-draft.md`。
   - 語幹の集合の Jaccard が 0.6 以上なら落とす。落とした件数・例と、0.5〜0.6 の件数を出す。
   - 3 の直後と 6 の直前に走らせる。
5. **Jev に解き直させる**: `compiler/verify-phrases.ts`
   - 比較試験と同じ 3 段。選択肢 1 つの段は呼ばない。同時 8 本。
   - 結果は `data/lookup-raw/verified.jsonl` に追記。照合キーは〈号, 言い方〉。
   - 費用の見張り: 累計は**既存の jsonl の inputTokens の合計から**始める。1.5 億トークン（約 6.3 ドル）で止まる。
6. **表を作る**: `compiler/build-lookup.ts` → `data/lookup.json`
   - 残す条件: Jev の号＝書かせた号、かつ項の確信度 ≥ 0.8。行は `{ p, c, k }`。
   - 号ごとの採用数・捨てた数を `data/lookup-raw/summary.md` に。`.gitignore` に `!data/lookup.json`。
7. **引く仕組み**: `src/lookup.ts`
   - 表を引く時だけの分かち書き: 今の `tokenize` に加え、`not` / `non` / `other than` を語として残す。
     **入力に否定語があれば表を引かない**（61 章と 62 章の取り違えを防ぐ）。
   - 転置索引（語幹 → 行）。語幹の重み＝ idf。**表に無い語は表の中の最大の重み**を持つとみなす。
   - 点数＝共通語幹の重みの和 ÷ max（入力の重みの和, 行の重みの和）。0〜1、決定論。同点は 6 桁コードの小さい順。
   - **共通語幹が 1 つだけの当たりは採用しない**（"parts" 1 語の満点を防ぐ）。
   - 読み込み: `import.meta.url` 基準で `data/lookup.json` を探す。`loadLookup(path?)` / `setLookup(table)` /
     `lookupStatus()`（読めたか・行数）。読めない時は 1 回だけ `console.warn`。
8. **分類に組み込む**: `src/classifier.ts` の `classify()`
   - 最初に `lookup()`。点数 ≥ 閾値なら、その号を先頭の候補にする。
     - confidence ＝ `0.6 + 0.4 × 点数`（≥ `NEEDS_REVIEW_THRESHOLD` になる）。
     - 理由欄は木の経路（Section / Chapter / Heading / Subheading）＋ `Lookup: "<言い方>" (score 0.xx)`。
     - 2 位以降はルールの候補（同じ号は除く）。各 confidence は `min(元の値, 先頭 − 0.01)` にして並びを保つ。
     - `needs_review` は今の式のまま（先頭の confidence で決まる）。
   - 閾値未満・表なしの時は今と同じ結果。
   - Web 版: `web/src/main.tsx` で `setLookup(lookupJson)` も呼ぶ。
9. **閾値の決め方**（測る問題に合わせ込まない）
   - 下限: 50 問のうち**表の外の 26 問で、閾値以上の当たりが 0 件**になる最小値。
   - 表の中の 24 問では、閾値を上げ下げした時に正解数が単調かだけ見る。144 問は判定にだけ使う。
   - 確信度 0.8 の線も 144 問の比較から選んだ偏りがあることを報告に書く。
10. **試験**
    - `tests/lookup.test.ts`: 点数の式、同点、表に無い語、共通 1 語、否定語、表なしで落ちないこと、閾値の境目。
    - `tests/lookup-accuracy.test.ts`:
      - 144 問で項の 1 位 ≥ 75%・章 ≥ 85%。
      - **表の外の 26 問で閾値以上の当たり 0 件**（独立した合格の線）。
      - 50 問は既存の試験（`classifier.test.ts`）を正本とし、今より下がらないこと。
      - 初回呼び出し（表の読み込み＋索引作り＋1 問）が 300ms 未満。
    - 既存の速度試験（100ms 未満）、並び順・理由欄の試験がそのまま通ること。
11. **公開の準備**: `files` に `data/lookup.json`。`npm pack --dry-run` で表が **1.5MB 以下**。
    README の精度表と仕組み、CHANGELOG。版上げと公開はしない（人が決める）。

## 確認のしかた
- 各段の後に `npm test` の出力を貼る。
- 8 の後に `run.ts baseline single --out results/2026-10-02-lookup` で再計測（同日の古い結果を拾わないよう別の場所）。
- 最後に `/code-gate`。

## 止まる条件
- 費用の見張りに当たったら止めて報告。
- 144 問で 75% に届かない、または表の外で誤当たりが出たら、式をいじる前に報告する。

## 既知の別件（今回は直さない・PR に 1 行）
- 比較の「ルールの上位 10 件」は `classify` が 3 件しか返さないため実際は上位 3 件。
- 章ごとの試験の 6 桁一致の行が `expected4` と比べている（chapter-61.test.ts ほか）。
