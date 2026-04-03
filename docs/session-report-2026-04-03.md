# セッションレポート 2026-04-03 — AIコンパイラ横展開 + 精度改善

## 概要

tariff-engine v0.2.0（Chapter 87のみ、AIコンパイラPoC）から v0.3.0（20章カバー、精度改善済み）への拡張を1セッションで実施。23コミット、約4,600行のルールJSON + 60件のテストケースを追加。

---

## 成果

### 定量

| 指標 | v0.2.0 | v0.3.0 |
|------|--------|--------|
| AI-compiledルール対応章数 | 1 (Ch.87) | 20 |
| カバーSection数 | 1 (XVII) | 13 / 21 |
| テストケース数 | 10 | 144 |
| テスト総数 | 173 | 461 (460通過) |
| 4桁精度 | 90% (Ch.87のみ) | 53% (20章平均) |
| Chapter正解率 | — | 74% |
| パッケージサイズ | 201KB | 247KB |

### 定性

- **AIコンパイラパイプラインの汎用化を実証**: Chapter 87向けに作ったパイプラインが、generic few-shot 1つで20章に適用可能であることを確認
- **越境ECの主要カテゴリをカバー**: 衣類、電子機器、プラスチック・ゴム、家具・雑貨、靴、バッグ、化粧品、ジュエリーなど
- **精度改善の構造的アプローチを確立**: 語彙テーブル拡張 → 文脈修飾語抑制 → ドメインヒューリスティック → TF-IDF PoC（見送り判断含む）

---

## 設計判断とその理由

### 1. 横展開の順序（越境EC流通量ベース）

**判断**: Section XVI (機械/電気) → VII (プラスチック/ゴム) → XX (雑貨) → XI (繊維) の順で展開

**理由**: 越境ECで実際に流通量が多い商品カテゴリから着手。Section XI（繊維）を最後に回したのは、WCO Section Notesが巨大（30+条項）で手動構造化コストが高いため。

**結果**: 正しい判断だった。Section XI は部分対応（Note 1, 7, 14, 15のみ）でも47クローズのルールが生成でき、衣類分類の基本はカバーできた。糸の太さ・織り方・混合比率の条項は、キーワードベースの分類では活用しにくいため、スキップして正解。

### 2. Few-shot戦略（汎用1ファイル + インクリメンタル更新）

**判断**: Chapter 87のfew-shotから汎用 `generic.json` を初期作成し、各Sectionの処理後に更新する計画

**理由**: 章ごとにfew-shotを作るのは横展開のボトルネック。5ルールタイプ × 2件 = 10件の汎用例でLLMは構造パターンを汎化できるはず。

**結果**: **Chapter 87のfew-shotのままで20章すべてコンパイルが成功**。想定以上に汎化性が高く、インクリメンタル更新は実施不要だった。LLMのfew-shot汎化能力が高い場合、ドメイン多様化よりも「出力フォーマットの明示」の方が重要。

### 3. 精度改善のアプローチ選択

#### 試みたこと

**(a) 語彙テーブル拡張（成功 — 主効果）**

PRODUCT_CHAPTER_ROUTES, FUNCTION_SECTION_ROUTES, STRONG_SYNONYMS, FUNCTION_WORDS, section-map.ts のキーワードを拡充。

- 効果: 35% → 61% (+26pp)
- 所要時間: サブエージェント1回 + 手動調整
- 学び: 最もコスパが高い。新章追加時は必ず語彙も追加すべき（チェックリスト化が望ましい）

**(b) 文脈修飾語抑制（成功 — 副効果）**

`electric`, `industrial`, `household` 等の用途文脈語を、製品語が共存する場合にルーティングから除外。

- 効果: `electric toy train` → Ch.85 を Ch.95 に修正（ただし完全解決せず）
- 学び: 車両語（car, sedan）は文脈修飾語ではなく主語になりうる。コンテキストに応じた判断が必要で、静的なリストでは限界がある

**(c) 衣類語ヒューリスティック（部分成功）**

衣類キーワードが存在する場合、Section XI内の織物チャプター（Ch.50-60）を罰則する。woven/knittedでCh.61 vs Ch.62を判別。

- 効果: Ch.62 が 0% → 38%、Ch.61 が 25% → 50%
- 残課題: `denim jeans woven cotton` → Ch.52（綿織物）がまだ勝つケースあり。罰則係数（0.05）をさらに下げるとリグレッションリスク
- 学び: ドメイン固有のヒューリスティックは効果的だが、スケールしない。20章ごとに個別ルールを書くのは現実的でない

**(d) TF-IDF PoC（見送り）**

HS treeの全description（6,939件）からIDF辞書を生成し、scoreDescriptionをTF-IDF重み付きに変更。

- 結果:
  - 全面適用: 61% → 56% (-5pp) — section/chapterレベルでリグレッション
  - subheadingのみ: 61% → 58% (-3pp) — 一部改善するが全体では悪化
  - パフォーマンス問題: `Object.keys(idfDict).length` がホットパスで毎回7,052キーの配列生成 → 72ms → 12秒。`idfLoaded` フラグで解決
- 見送り理由: リグレッションが改善を上回る。IDF重み付けがスコアバランス全体を変え、既存のヒューリスティック（cross-ref penalty, weakening adjacent, coverage blend等）との相互作用が複雑
- 学び: **TF-IDFは「スコアリング関数の差し替え」ではなく「スコアリングアーキテクチャの再設計」が必要**。現在のスコアリングは均一重みを前提に多数のペナルティ/ブースト係数をチューニングしており、重みの基盤を変えると全係数の再チューニングが必要

**(e) 複数セクションルーティング（成功）**

`functionRouteSection` を単一値からSet<string>に変更し、複数の関数ルートを同時にboost。

- 効果: `car tire` で Section VII と XVII の両方が 0.80 になる（従来はVIIが0.02に罰則）
- 学び: 小さな設計改善だが、正しい候補が候補リストから消える問題を解消。「入り口で間違えると復帰不能」の原則を裏付け

#### 試みなかったこと

- **BM25**: TF-IDFのリグレッションを見て、文書長正規化を追加しても根本問題は解決しないと判断
- **semantic embedding**: ランタイムAI不使用の設計原則に反する。ビルド時にembeddingを事前計算する案はあるが、スコープ外
- **HS tree description の正規化**: `tyres` → `tires` のような表記揺れをtree側で統一する案。影響範囲が大きく見送り

### 4. サブエージェント実行パターン

**判断**: Subagent-Driven Development（タスクごとにフレッシュなサブエージェント + レビュー）

**結果**:
- Notes構造化: 3並列サブエージェント → 全成功（WCO PDFからの抽出能力が高い）
- テスト+語彙: 1サブエージェント → 成功だがDTS重複エラー（`sneaker`の重複プロパティ）を生成
- ルールコンパイル: API呼び出しが必要なためメインセッションで順次実行
- コードレビュー: フルレビューはスキップ（精度測定が実質的な検証として機能）

**学び**:
- Notes構造化は並列化に最適（独立した作業、ファイル競合なし）
- 語彙テーブルの編集は衝突しやすい（既存エントリとの重複チェックが必要）
- spec complianceレビューは精度テストが代替する場面もある

---

## 残課題

### 精度の壁

現在のキーワードベーススコアリングの限界：

1. **素材語の支配**: `cotton shirt` → Ch.52（綿）がCh.62（衣類）に勝つ。素材語のIDF（出現頻度から計算した稀少性）は低いが、HS treeの素材チャプターに直接的なキーワードマッチがある
2. **曖昧語**: `bag`（Ch.42 旅行用品 vs Ch.39 プラスチック袋）、`pipe`（Ch.73 鉄パイプ vs Ch.39 プラスチックパイプ）
3. **複合名詞の分解**: `car tire` が `car`(Ch.87) + `tire`(Ch.40) に分解され、`car`が支配。英語の複合名詞では後の語が主語（tire）、前の語が修飾（car）だが、tokenizerはこの構造を理解しない
4. **heading内の細分化**: 正しいChapterに入った後、heading/subheadingの選択精度が低い（Chapter正解率74% vs 4桁精度53%の差 = 21ppがheading内の問題）

### 次の精度ジャンプに必要な技術

- **ビルド時semantic embedding**: 各heading descriptionのembeddingを事前計算し、入力との類似度で ranking。ランタイムAI不使用の原則を維持しつつ、キーワードマッチを超える
- **複合名詞の構造解析**: head-modifier関係の推定。`car tire` → head=tire, modifier=car
- **HS tree descriptionの正規化**: 英米表記揺れ、abbreviation展開
- **コンテキスト対応ルーティング**: 単語単独ではなくN-gramでルーティング（`car tire` → Ch.40, `car engine` → Ch.84）

### プロダクト面

- **0.3.0のカバレッジメッセージ**: 「97章中20章をAI-compiledルールでカバー、越境ECの主要カテゴリ対応」
- **精度の伝え方**: 4桁53%は見栄えが悪いが、Chapter正解率74%は「大体合っている」の水準。UIで「top 3候補」を見せる設計が正しいアプローチ
- **HS 2027対応**: パイプラインが確立されたので、2027版のNotes差分を食わせるだけで対応可能。これが最大の差別化ポイント

---

## アーキテクチャ図

```
入力: "cotton t-shirt, men's, knitted"
  ↓
[Tokenizer] → ["cotton", "t-shirt", "men", "knitted"]
  ↓
[Section Scoring] ← SECTION_MAP keywords + FUNCTION_SECTION_ROUTES
  → Section XI (0.80)
  ↓
[Chapter Routing] ← PRODUCT_CHAPTER_ROUTES + context modifier suppression
  → Ch.61, Ch.62 candidates (garment heuristic suppresses Ch.50-60)
  ↓
[Chapter Scoring] ← scoreNodes() + deep child/grandchild matching
  → Ch.61 (knitted boost)
  ↓
[Heading Scoring] ← bestDescScore() + synonym expansion
  → Heading 6109 (T-shirts)
  ↓
[Subheading Scoring] ← scoreSubheading() + other-than/fallback/negation
  → 610910 (T-shirts of cotton, knitted)
  ↓
[Rule Applier] ← chapter-61.json (AI-compiled)
  → scoring adjustments (definition boost, scope match)
  ↓
[GIR Resolution] ← applyGir3a(), applyGir3c()
  → Final ranking: top 3 candidates with confidence + reasoning
```

## ファイル構成（v0.3.0時点）

```
data/
  hs-tree.json              # HS tree (UN Comtrade)
  rules/
    chapter-{30,33,39,...,96}.json  # AI-compiled rules (20 files)
  notes/
    section-{06,...,20}.md   # Section Notes (13 files)
    chapter-{30,...,96}.md   # Chapter Notes (20 files)
src/
  classifier.ts             # Orchestration (scoreSection → scoreNodes → subheading → GIR)
  scoring.ts                # scoreDescription, bestDescScore, scoreSubheading
  tokenizer.ts              # Tokenization + stop word removal
  stemmer.ts                # Simple English stemmer
  lexicon.ts                # Synonyms, function words, material tokens
  routes.ts                 # Section/chapter routing tables
  section-map.ts            # Section → chapter mapping + keywords
  rule-applier.ts           # Runtime rule application
  rule-engine.ts            # Condition evaluation
  gir.ts                    # GIR 3a/3c resolution
  types.ts                  # Core type definitions
  rule-types.ts             # Rule type definitions
compiler/
  compile-rules.ts          # CLI: Notes → Rules pipeline
  notes-parser.ts           # Layer 1: Markdown → NoteClause[]
  clause-classifier.ts      # Layer 2: NoteClause → ClassifiedClause (LLM)
  rule-generator.ts         # Layer 3: ClassifiedClause → ChapterRuleSet
  few-shot/
    generic.json            # Universal few-shot examples
    chapter-87.json         # Legacy chapter-specific examples
tests/
  fixtures/
    chapter-{30,...,96}-cases.json  # Test cases (20 files, 144 cases total)
  chapter-{30,...,96}.test.ts      # Accuracy tests (20 files)
  classifier.test.ts               # Core classifier tests (50 cases)
  ...                              # Unit tests for each module
```

## 数値サマリー

| 指標 | 値 |
|------|-----|
| npm パッケージ | tariff-engine@0.3.0 |
| カバー章数 | 20 / 97 |
| カバーSection数 | 13 / 21 |
| ルールJSON | 20ファイル、合計299KB |
| テストケース | 144件（20章分） |
| テスト総数 | 461 (460 passing) |
| 4桁精度 | 53% (76/144) |
| Chapter正解率 | 74% (107/144) |
| パッケージサイズ | 247KB (gzip) |
| ランタイム依存 | 0 (Node.js stdlibのみ) |
| 分類速度 | < 100ms / query |
| v0.3.0 コミット数 | 23 |
