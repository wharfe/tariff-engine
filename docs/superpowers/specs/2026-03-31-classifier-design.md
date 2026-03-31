# Classifier設計仕様 — Phase 1 MVP

## 概要

hs-tree.jsonを読み込み、商品説明文からHS 6桁コードの候補を返すキーワードベース分類器。
ランタイムAI不使用、Node.js stdlib以外の依存なし。

## アーキテクチャ

```
loadTree(path?) → HsNode[] をモジュールキャッシュ
classify(input) →
  1. tokenize(description)
  2. セクションスコアリング（静的マッピング）
  3. チャプタースコアリング（セクションフィルタ済み）
  4. ヘディングスコアリング（GIR 1）
  5. サブヘディング評価（descriptionパターン解析）
  6. GIR 3(a)/3(c)で競合解決
  7. 上位3候補 + confidence + reasoning path 返却
```

## コンポーネント設計

### 1. `loadTree(path?)` — ツリー読み込み

- `fs.readFileSync`でhs-tree.jsonを読み込み、モジュールスコープにキャッシュ
- pathのデフォルトは`data/hs-tree.json`（プロジェクトルートからの相対パス）
- テスト時に小さいツリーを渡せるようpathを引数化
- 2回目以降の呼び出しはキャッシュを返す。`force`オプションでリロード可能

```typescript
let cachedTree: HsNode[] | null = null;

export function loadTree(path?: string, options?: { force?: boolean }): HsNode[];
```

### 2. `section-map.ts` — セクション静的マッピング（新規）

21セクション分のタイトルとキーワードを定義。

```typescript
export interface SectionEntry {
  section: string;       // "I", "II", ... "XXI"
  title: string;         // "Live animals; animal products"
  keywords: string[];    // ["animal", "live", "meat", "fish", ...]
  chapters: string[];    // ["01", "02", "03", "04", "05"]
}

export const SECTION_MAP: SectionEntry[];
```

キーワードはセクションタイトル + 配下チャプターの代表的なキーワードから手動で作成。

### 3. スコアリング — トークン重複率

**基本式**: `matchedTokens / inputTokens`

- `matchedTokens`: 入力トークンのうち、対象ノードのdescriptionトークンに含まれるものの数
- `inputTokens`: 入力トークンの総数

この式は「ユーザーが言ったことのうち、どれだけが分類先の記述に含まれているか」を測る。
descriptionが長いノードほど多くのトークンにマッチしやすく、これは正しい挙動
（カバレッジが広い = 適合する可能性が高い）。

**階層スコアの統合**:
- sectionScore × chapterScore × headingScore × subheadingScore = finalConfidence
- 各階層スコアは0.0〜1.0の範囲

**既知の制限**: 短い入力（1〜2語）で高スコアが出すぎる問題あり。→ issue化済み

### 4. セクションフィルタリング

**フィルタ条件**: スコアが最高スコアの50%以上のセクション全て（最低3セクション保証）

根拠:
- 21セクション→97章のフルスキャンは計算量として微小
- セクションフィルタは「精度向上」より「reasoning pathの品質向上」が主目的
- タイトすぎるフィルタ（上位3固定）は境界ケースで正解を落とし、以降の階層で挽回不可能
- 緩めにして安全弁とする

### 5. サブヘディングdescriptionパターン解析

hs-tree.jsonのdescription文字列から以下のパターンを直接検出:

| パターン | 検出方法 | 処理 |
|----------|----------|------|
| `"other than X"` | 正規表現 `/other than (.+)/i` | 入力にXのトークンが含まれていたらスコア0 |
| `"n.e.s.i."` / `"n.e.c."` / 先頭が`"Other"` | 文字列マッチ | confidence × 0.3（フォールバック扱い） |
| 上記以外 | — | 通常のトークンマッチ |

**既知の制限**: "other than X"は自分のスコアを下げるのみ。Xを含むsibling subheadingへの正シグナルとしての活用はPhase 2。→ issue化済み

### 6. GIR適用順序（明示）

Phase 1で実装するGIRとその適用順序:

1. **GIR 1**: heading descriptionでのテキストマッチ（メインスコアリングフロー）
2. **GIR 6**: subheading評価はGIR 1と同じ原則を適用
3. **GIR 3(a)**: 同スコアの候補中、マッチしたトークン数が多い方を優先
4. **GIR 3(c)**: それでも解決しない場合、数値的に後の見出しを採用

Phase 1で未実装（将来issue化）:
- GIR 2(a): 未完成/未組立品
- GIR 2(b): 混合物・組合せ
- GIR 5: ケース・容器

### 7. confidence & needs_review

- 最終confidence < 0.7 → `needs_review: true`
- 最終confidence = sectionScore × chapterScore × headingScore × subheadingScore
- 各階層で最高スコアの候補のスコアを使用

### 8. reasoning path生成

各階層でreasoning文字列を蓄積:

```
[
  "Section XX: Miscellaneous manufactured articles",
  "Chapter 94: Furniture; bedding, mattresses...",
  "Heading 9403: Other furniture and parts thereof",
  "Subheading 940360: Other wooden furniture"
]
```

### 9. equals型正規化（既存コード修正）

`rule-engine.ts`の`equals`比較を大文字小文字非区別に修正:

```typescript
case "equals":
  return String(value).toLowerCase() === String(condition.value).toLowerCase();
```

## ファイル構成

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/section-map.ts` | 新規 | 21セクションの静的マッピングテーブル |
| `src/classifier.ts` | 大幅書き換え | loadTree, classify, 各階層スコアリング |
| `src/gir.ts` | 拡充 | GIR 3(a)の条件数ベース比較 |
| `src/rule-engine.ts` | 修正 | equals型の正規化 |
| `src/index.ts` | 修正 | 新規exportの追加 |
| `cli/index.ts` | 修正 | loadTree()呼び出し追加 |
| `tests/classifier.test.ts` | 新規 | 50テストケース |

## 成功基準

- 50テストケースで4桁HS ≧70%正解
- 50テストケースで6桁HS ≧50%正解
- 全結果にreasoning path含む
- 分類1件あたり<100ms
- needs_review判定が正しく動作
