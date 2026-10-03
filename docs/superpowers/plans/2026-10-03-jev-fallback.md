# 作業計画: 迷った時に Jev に聞く

設計書: `docs/superpowers/specs/2026-10-03-jev-fallback.md`
ブランチ: `feat/jev-fallback`（`exp/decision-model-bench` から。対応表は含めない）

## 段取り
1. **型**: `src/decider.ts`
   - `Decider = (state: string, instructions: string, options: Record<string, string>, signal: AbortSignal) => Promise<DeciderAnswer>`
   - `DeciderAnswer = { choice: string; probabilities: Record<string, number>; confidence: number }`
   - `ClassifyWithDeciderResult = ClassifyResult & { decider: { used: boolean; confidence?: { chapter, heading, subheading }; error?: string } }`
2. **本体**: `src/classify-with-decider.ts` の `classifyWithDecider(input, { decider, minConfidence = 0.7, timeoutMs = 5000 })`
   - 木は `classifier.ts` に足す `getLoadedTree()` で受け取る（未読み込みならルールの例外と同じ扱い）。
   - ルールの結果が要確認でなければそのまま返す（`decider.used = false`）。
   - 3 段で聞く。選択肢のキーは `c<code>`。
   - 締め切りは全体で 1 つ: `AbortController` を 1 つ作り、タイマーで `abort()`。3 段すべてに同じ `signal` を渡す。
     `finally` でタイマーを消す。呼び出しは `Promise.resolve().then(() => decider(...))` で包み、同期の例外も失敗扱いにする。
   - 返り値の検査: 選んだキーが選択肢にある、`Number.isFinite(confidence) && 0 <= confidence <= 1`。外れたら失敗扱い。
   - 項の確信度 ≥ minConfidence: 先頭＝判断モデルの号（confidence ＝ 項の確信度）。理由欄＝木の経路＋
     `Decider: chapter 0.xx / heading 0.xx / subheading 0.xx`。2 位以降はルール（同じ号を除き、confidence は先頭 − 0.01 以下に丸める）。
     `needs_review` ＝ 章・項・号のどれかの確信度が 0.8 未満。
   - 未満・失敗・時間切れ: ルールの結果＋ `needs_review = true`、`decider.error` に理由（未満は `"low confidence 0.xx"`）。
   - `src/index.ts` から `classifyWithDecider` と型を公開。
3. **Jev の入口**: `src/jev.ts` の `jevDecider({ apiKey, model = "jev-latest", endpoint })`。
   - `fetch` で `POST /v1/systemone`、`signal` を渡す。鍵は引数だけ（環境変数を読まない）。
   - 失敗の文は状態コードだけ（応答本文は載せない。ゲートウェイが要求ヘッダーを返すことがあるため）。
   - 429/5xx は 1 回だけ再試行。待ちも `signal` で止まる。
   - `tsup.config.ts` の entry と dts に `src/jev.ts`。`package.json` の `exports` に
     `"./jev": { "types": "./dist/jev.d.ts", "import": "./dist/jev.js" }`。
4. **試験**（通信なし）: `tests/classify-with-decider.test.ts`
   - 偽の判断モデルで: 高い確信度 → 先頭が判断モデル・理由欄・並び順。低い確信度 → ルールのまま要確認。
     例外（同期・非同期）・時間切れ・選択肢に無いキー・確信度が文字列/NaN/1 超 → ルールのまま要確認・`decider.error`。
     時間切れの時に `signal.aborted` が真になること。**信号を無視して永久に返らない偽モデルでも締め切りで返ること。**要確認でない入力 → 呼ばれない（呼び出し回数 0）。選択肢 1 つの段 → 呼ばれない。
   - `tests/jev.test.ts`: `fetch` を差し替えて、送る形（state・questions・Authorization）と 429 の再試行、
     **応答本文が鍵をそのまま含む場合でも**エラー文と結果に鍵が出ないこと、`signal` で止まること。
5. **判定用の問題を集める**: `experiments/decision-models/fetch-cross.ts`
   - 設計書の条件どおり `term=classification&sortBy=DATE_DESC&pageSize=100` を送り、7/1 より古くなったら止める。
     件名の取り出しは「RE: 」の前置き・末尾の「.」・巻き引用符を整える。
   - `tests/fixtures/cross-2026h2.json` に `{ description, expected4, expected6, ruling, date, ambiguous }` で固定。
6. **実物での判定（1 回）**: `experiments/decision-models/judge-fallback.ts`
   - 判定用の問題をルールだけと `classifyWithDecider(jevDecider)` で解き、項の 1 位・章・6 桁・Jev を呼んだ件数・
     要確認なしで返した件数とその 6 桁正解率・Wilson 下限・時間切れや失敗の件数・McNemar（両側）の p 値を表に
     （全体と「印なし」の 2 本。印は製品名を拾いきれない＝注記）。
   - 参考として 50 問・144 問も同じ表に（注記つき）。結果は `experiments/decision-models/results/2026-10-03-fallback/`。
7. **書き物**: README に「選んで使う: 判断モデルに聞く」の節と精度（判定の値、Claude 作の問題である注記つき）。
   製品の約束を書いた箇所を grep（`runtime AI|AI at runtime|deterministic at runtime|offline|no network|Zero runtime|manually curated|inference|Explainable`）で
   全部洗い出して直す: README 3・7・11〜14（他社比較）・18・20・21・22・114 行目付近、package.json の description、
   repo の CLAUDE.md 47〜50 行目。選んで使う機能では商品の説明が外部（api.typesafe.ai）へ送られることを README に書く。
   精度の注記は判定用の問題（CROSS）に合わせる。144 問は作り方の実態に合わせて書き直す。CHANGELOG。版上げ・公開はしない。
8. `npm test`・`npx tsc --noEmit`・`npm run build`（dist に jev が出る）・`npm pack` した物を一時ディレクトリに入れ、
   `import { jevDecider } from "tariff-engine/jev"` を tsc で型検査できること。最後に `/code-gate`。

## 既知の赤
- `classifier.test.ts` の「6 桁 ≥ 50%」は着手前から赤（46%）。触らない（ルールを動かすと判定の基準がずれる）。

## Gate2 の記録
- 3 周で上限。1 周目 high 6、2 周目 high 3、3 周目 high 2。3 周目の 2 件（線 3 の件数の下限、6 桁で測る）は反映済み。
  4 周目は回していない。確認は Gate3（/code-gate）で行う。

## 止まる条件
- 合格の線（設計書の 1〜3）のどれかを満たさなければ、線をいじる前に報告（判定は 1 回だけ）。
