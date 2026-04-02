# AIコンパイラ PoC 設計 — Chapter 87

## ゴールとスコープ

**ゴール:** Chapter 87のSection/Chapter Notesから rules.json を生成するパイプラインのPoCを構築し、分類精度の改善幅を実測する。

**スコープ:**
- **In:** Section XVII Notes + Chapter 87 Notes + Subheading Note → rules.json 変換パイプライン
- **In:** 5ルールタイプ: exclusion, definition, routing, parts_rule, scope
- **In:** 生成した rules.json をランタイム classify() で消費して精度を測定
- **In:** Chapter 87のテストケース10件追加、rules.jsonありなしのA/B比較
- **Out:** Chapter 87以外の章
- **Out:** PDF/HTML自動抽出（入力は手動構造化テキスト）
- **Out:** ランタイムエンジンの大規模改修（既存の evaluateCondition を活用）

**成功基準:**
- Chapter 87専用テストケース10件でA/B比較: rules.jsonなし vs ありの精度差を実測
- rules.jsonありで4桁精度 ≥ 80%（10件中8件以上）
- 既存50件テストにリグレッションなし
- パイプラインが再実行可能（Notes テキスト変更 → rules.json 再生成 → テスト）

## アーキテクチャ

3つのレイヤーに分離する。各レイヤーは独立してテスト可能。

```
[Layer 1: Notes Parser]        決定論的
  入力: data/notes/section-17.md, data/notes/chapter-87.md
  出力: NoteClause[] (条項の配列)
  処理: 正規表現でNote番号・サブ条項(a)(b)を分割

[Layer 2: Clause Classifier]   LLM (ビルド時のみ)
  入力: NoteClause + few-shot examples
  出力: ClassifiedClause[] (タイプ + パラメータ付き)
  処理: LLMに5タイプ分類 + パラメータ抽出を依頼

[Layer 3: Rule Generator]      決定論的
  入力: ClassifiedClause[]
  出力: data/rules/chapter-87.json (ChapterRuleSet型)
  処理: タイプ別にpreScoringRules/scoringRules/partsRulesに振り分け
```

**ランタイム統合:**
- `classify()` がルールJSONを読み込み、スコアリング前後にルールを適用
- 既存の `evaluateCondition()` をそのまま活用
- ルールファイルが存在しない章は現在と同じ動作（後方互換）

### ファイル構成

```
data/notes/                    # 手動構造化テキスト (入力)
  section-17.md
  chapter-87.md

data/rules/                    # 生成されたルール (出力)
  chapter-87.json

compiler/
  notes-parser.ts              # Layer 1: 正規表現パーサー
  clause-classifier.ts         # Layer 2: LLM分類
  rule-generator.ts            # Layer 3: JSON生成
  few-shot/
    chapter-87.json            # 10条項のground truth (few-shot examples)
  compile-rules.ts             # CLI: パイプライン実行

src/
  rule-applier.ts              # ランタイム: ルール適用ロジック (新規)
  classifier.ts                # 既存: classify()にルール適用を統合

tests/
  chapter-87.test.ts           # A/B比較テスト (10件)
  notes-parser.test.ts         # Layer 1 単体テスト
  rule-generator.test.ts       # Layer 3 単体テスト
  rule-applier.test.ts         # ランタイム適用テスト
```

### 入力フォーマット（手動構造化テキスト）

将来のPDF抽出やHTMLスクレイピングの出力ターゲットとなるフォーマット。パーサーのテスト期待値と同一。

```markdown
## Section XVII Notes

1. This Section does not cover articles of heading 9503 or 9508, or bobsleighs, toboggans or the like of heading 9506.

2. The expressions "parts" and "parts and accessories" do not apply to the following articles...
  (a) joints, washers or the like...
  (b) parts of general use...

## Chapter 87 Notes

1. This Chapter does not cover railway or tramway rolling-stock designed solely for running on rails.

2. For the purposes of this Chapter, "tractors" means...

## Subheading Notes

1. Subheading 8708.22 covers...
```

## 型定義

### コンパイラ内部型（compiler/内で使用）

```typescript
// Layer 1 出力: パース済み条項
interface NoteClause {
  source: "section" | "chapter" | "subheading";
  noteNumber: number;
  subItem?: string;          // "(a)", "(b)", etc.
  text: string;              // 原文テキスト
}

// Layer 2 出力: 分類済み条項
type ClauseType = "exclusion" | "definition" | "routing" | "parts_rule" | "scope";

interface ClassifiedClause extends NoteClause {
  clauseType: ClauseType;
  params: ExclusionParams | DefinitionParams | RoutingParams | PartsRuleParams | ScopeParams;
}

interface ExclusionParams {
  excludedCodes: string[];
  reason: string;
}

interface DefinitionParams {
  term: string;
  meaning: string;
  appliesTo: string[];
}

interface RoutingParams {
  target: string;
  conditions: RuleCondition[];   // 既存の evaluateCondition 互換
}

interface PartsRuleParams {
  rule: "principal_use" | "stay_in_own_heading" | "not_parts";
  affectedCodes?: string[];
}

interface ScopeParams {
  heading: string;
  covers: string;
  conditions: RuleCondition[];
}
```

### ランタイム型（rules.json + rule-applier.ts）

コンパイラの中間表現（ClassifiedClause）とは切り離し、ランタイムに必要な情報のみ格納。

```typescript
// 個別ルール（clauseType + params のみ、原文テキスト等のメタデータは含まない）
interface PreScoringRule {
  clauseType: "exclusion" | "routing";
  params: ExclusionParams | RoutingParams;
}

interface ScoringRule {
  clauseType: "scope" | "definition";
  params: ScopeParams | DefinitionParams;
}

interface PartsRule {
  clauseType: "parts_rule";
  params: PartsRuleParams;
}

// rules.json のルート型
interface ChapterRuleSet {
  chapter: string;
  preScoringRules: PreScoringRule[];
  scoringRules: ScoringRule[];
  partsRules: PartsRule[];
}

// スコア調整の戻り値（reasoning path に統合）
interface ScoringAdjustment {
  factor: number;       // 1.0 = 変更なし, 0.5 = 半減, 1.05 = 微ブースト
  reason: string;       // "Scope: 8702 requires persons >= 10, not found in input"
}
```

### rule-applier.ts のインターフェース

```typescript
// ルール読み込み（キャッシュ付き）
function loadRules(chapter: string): ChapterRuleSet | null;

// ブラウザ用: ルール注入
function setRules(chapter: string, rules: ChapterRuleSet): void;

// スコアリング前: 候補リストのフィルタリング/追加
function applyPreScoringRules(
  rules: ChapterRuleSet["preScoringRules"],
  input: ClassifyInput,
  candidates: HsNode[]
): HsNode[];

// スコアリング中: スコア調整（倍率 + 理由の配列）
function applyScoringAdjustments(
  rules: ChapterRuleSet["scoringRules"],
  input: ClassifyInput,
  candidate: Candidate
): ScoringAdjustment[];

// 部品判定: 入力が「部品」の場合のフロー分岐
function applyPartsRules(
  rules: ChapterRuleSet["partsRules"],
  input: ClassifyInput
): { isPart: boolean; principalUseHeading?: string } | null;
```

### ルール適用タイミング

| タイミング | ルールタイプ | 動作 |
|-----------|-------------|------|
| **スコアリング前** | exclusion | 候補chapterから除外 |
| **スコアリング前** | routing | 候補chapterを追加/固定 |
| **スコアリング中** | scope | 条件未充足のheading/subheadingのスコアを下げる |
| **スコアリング中** | definition | 同義語マッピングとしてスコアブースト |
| **独立フロー** | parts_rule | 入力が「部品」と判定された場合のみ発動 |

## LLM統合設計

### LLMの役割（Layer 2 のみ、ビルド時のみ）

各NoteClauseに対して、5タイプ分類 + パラメータ抽出を行う。LLMの仕事は「分類タスク」に限定。JSONの構造自体はコード側のテンプレート（Layer 3）で生成する。

### プロンプト構造

```
System: You are a trade classification expert. Classify each HS Note clause
into exactly one type and extract parameters.

Types: exclusion, definition, routing, parts_rule, scope

Few-shot examples (from compiler/few-shot/chapter-87.json):
[Chapter 87の10条項の入力→出力ペアをそのまま埋め込む]

Now classify this clause:
Input: {clause.text}
Output (JSON):
```

### API設定

- **SDK:** Anthropic SDK (`@anthropic-ai/sdk`)
- **モデル:** claude-haiku-4-5-20251001（分類タスクには十分、コスト最小）
- **呼び出し:** 1条項ずつ個別（デバッグしやすく、リトライ粒度が細かい）
- **エラーハンドリング:**
  - unknown タイプ → エラーログ + 手動レビューフラグ
  - JSON parse 失敗 → 最大2回リトライ
  - PoCでは全件目視確認（信頼度フォールバックなし）

### few-shot examples の管理

`compiler/few-shot/chapter-87.json` に10条項のground truthを格納。PoCの手動分析結果がそのまま本番のfew-shot examplesとして資産になる。

新しい章のNotesを処理する際は、Chapter 87の10件がそのままfew-shotとして機能する。

## ランタイム統合

### classify() への統合フロー

```
classify(input)
  ├── tokens = tokenize(input.description)
  ├── sections = scoreSection(tokens)
  ├── candidateChapters = getCandidateChapters(sections, tree)
  │
  ├── ★ NEW: for each candidateChapter:
  │     rules = loadRules(chapter.code)
  │     if (rules):
  │       candidateChapters = applyPreScoringRules(rules.preScoringRules, input, candidateChapters)
  │
  ├── chapterScores = scoreNodes(tokens, candidateChapters)
  ├── for each chapter → headingScores → subheadingScores
  │     ★ NEW: if (rules):
  │       adjustments = applyScoringAdjustments(rules.scoringRules, input, candidate)
  │       confidence *= adjustments.reduce((acc, a) => acc * a.factor, 1.0)
  │       reasoning.push(...adjustments.map(a => a.reason))
  │
  ├── ★ NEW: partsResult = applyPartsRules(rules.partsRules, input)
  │     → 部品判定時のフロー分岐（principal use によるheading再選択）
  │
  └── GIR resolution → top 3 candidates
```

### 後方互換性

- ルールファイルが存在しない章 → `loadRules()` が null を返す → 現在と同じ動作
- Web UIへの影響: `setRules()` で注入可能（setTree と同パターン）

## テスト戦略

### テスト一覧

| テスト | 件数 | 目的 |
|--------|------|------|
| **Chapter 87 A/B比較** (新規) | 10件 | rules.jsonありなしの精度差を実測 |
| **既存50件リグレッション** | 50件 | ルール適用がCh.87以外を壊さないこと |
| **notes-parser 単体テスト** | ~15件 | 正規表現パースの正確性 |
| **rule-generator 単体テスト** | ~10件 | ClassifiedClause → ChapterRuleSet変換 |
| **rule-applier 単体テスト** | ~10件 | 各ルールタイプの適用ロジック |

### Chapter 87 テストケース（10件）

| # | 商品説明 | 期待4桁 | 検証ポイント |
|---|---------|---------|-------------|
| 1 | sedan car, 1500cc gasoline engine | 8703 | 基本的な乗用車 |
| 2 | diesel truck for cargo, GVW 10 tons | 8704 | 貨物車両 |
| 3 | agricultural tractor, 90 HP | 8701 | definition: "tractor"の意味 |
| 4 | children's bicycle with training wheels | 8712 | Note 4: 子供用自転車→8712 |
| 5 | bus for 25 passengers | 8702 | scope: ≥10 persons |
| 6 | motorcycle, 250cc | 8711 | 基本的なバイク |
| 7 | bicycle parts, rear derailleur | 8714 | 部品分類 |
| 8 | electric scooter for personal transport | 8711 | 電動モビリティ |
| 9 | motor chassis fitted with cab, for passenger car | 8703 | Note 3: chassis+cab→8702-8704 (NOT 8706). Assertion: expected4 === "8703" AND hscode !== "8706" |
| 10 | baby stroller with wheels | 8715 | 乳母車（Chapter 87の端のケース） |

注: 6桁コードはルール適用後に検証・確定する。テストケースのHSコードはWCOのHS 2022 Nomenclatureで確認してから最終化。

### A/B比較の実装

```typescript
describe.each([
  { label: "without rules", useRules: false },
  { label: "with rules", useRules: true },
])("Chapter 87 accuracy ($label)", ({ useRules }) => {
  beforeAll(() => {
    loadTree();
    if (useRules) {
      loadRules("87");  // or setRules("87", ...)
    }
  });

  it.each(testCases)("$description → $expected4", ({ description, expected4 }) => {
    const result = classify({ description });
    expect(result.candidates[0]?.hscode.startsWith(expected4)).toBe(true);
  });
});
```

1回のvitest runで両方の結果が並んで出力され、改善幅が一目でわかる。

## オプショナル: 汎化検証

PoCの必須スコープ外。時間に余裕がある場合のみ実施。

- Chapter 01（動物）のNotesから2-3条項を手動で構造化
- Chapter 87のfew-shotで分類し、汎化性を確認
- 「このfew-shotは他の章にも汎化する」というエビデンスを得る
- Phase 2で全章展開する判断の根拠に
