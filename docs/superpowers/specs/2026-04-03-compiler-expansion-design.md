# AIコンパイラ横展開設計 — 主要20章

## 概要

Chapter 87で検証済みのAIコンパイラパイプライン（Notes Parser → Clause Classifier → Rule Generator）を、越境ECで流通量の多い20章に横展開する。

## 対象章とフェーズ

### フェーズ1: 低リスク・高リターン

| 順序 | Section | Chapters | ドメイン |
|------|---------|----------|----------|
| 1 | XVI (機械) | 84, 85 | 電子機器、ガジェット |
| 2 | VII (プラスチック) | 39, 40 | 日用品 |
| 3 | XX (雑貨) | 94, 95, 96 | 家具・インテリア・雑貨 |

### フェーズ2: 高複雑度

| 順序 | Section | Chapters | 戦略 |
|------|---------|----------|------|
| 4 | XI (繊維) | 61, 62 | Chapter Notesを先行。Section XI Notesは段階的対応、最悪部分対応で割り切る |

## ファイル構造

```
data/notes/
  section-07.md          # Section VII (Ch.39-40)
  section-11.md          # Section XI (Ch.61-62) — 段階的
  section-16.md          # Section XVI (Ch.84-85)
  section-17.md          # 既存 (Ch.86-89)
  section-20.md          # Section XX (Ch.94-96)
  chapter-39.md
  chapter-40.md
  chapter-61.md
  chapter-62.md
  chapter-84.md
  chapter-85.md
  chapter-94.md
  chapter-95.md
  chapter-96.md
data/rules/
  chapter-39.json ... chapter-96.json
compiler/few-shot/
  generic.json           # 汎用few-shot（5タイプ×2件）
  chapter-87.json        # 既存（レガシー、参照用に残す）
```

## Few-shot戦略

### 汎用few-shot（generic.json）

- 5ルールタイプ × 2件 = 10件
- 各タイプの2件は異なるSectionから取る（ドメイン過学習防止）
- インクリメンタル更新サイクル:
  1. Section XVI着手時: Chapter 87のfew-shotで処理
  2. 結果を目視確認、良い例があれば汎用few-shotに追加/差し替え
  3. Section VII以降: 更新されたfew-shotで処理
  4. 繰り返し

### compile-rules.tsの変更

- `--few-shot` 引数をオプション化し、未指定時は `compiler/few-shot/generic.json` をデフォルトに
- 章固有のfew-shotが存在すればそちらを優先（後方互換）

## 作業パターン（1セクション分）

1. WCO公開テキストからSection Notes取得 → `data/notes/section-{N}.md`
2. 各Chapter Notes取得 → `data/notes/chapter-{NN}.md`
3. `compile-rules.ts` 実行（section-notes + chapter-notes）
4. 出力JSONを目視確認
5. テストケース追加（章あたり5-10件）
6. `npm test` でリグレッションチェック
7. few-shotに良い例があれば `generic.json` を更新

## テスト戦略

- 章あたり5-10件のテストケース（4桁HSコード精度）
- 既存173テストのリグレッション防止
- テストファイル: `tests/chapter-{NN}.test.ts` または既存の `accuracy.test.ts` に追加

## スコープ外

- PDF自動抽出（残り60+章の横展開時に検討）
- Section XI Notes の完全対応（部分対応で割り切り可）
- ルールタイプの追加（既存5タイプで対応）
- 精度チューニング（Issue #1-4は別途）
