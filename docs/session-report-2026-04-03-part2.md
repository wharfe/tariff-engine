# セッションレポート Part 2 — 設計レビュー対応

前回レポート（Part 1）に対するアーキテクチャレビューを受け、2つの施策を検討・実施。

---

## レビューで指摘された構造的問題

### 1. ヒューリスティックの積み重ねが限界に来ている

現在のスコアリングに重なっている層：

```
PRODUCT_CHAPTER_ROUTES → FUNCTION_SECTION_ROUTES → STRONG_SYNONYMS →
FUNCTION_WORDS → garment heuristic (0.05) → context modifier suppression →
cross-ref penalty → weakening adjacent → coverage blend →
deep child/grandchild matching → multi-section routing
```

個別には合理的だが、相互作用が複雑。TF-IDFを入れたら全体が壊れたのはこの構造が原因。新章追加ごとにヒューリスティック追加が必要な設計は97章にスケールしない。

### 2. 21ppギャップ（Chapter 74% → 4桁 53%）

正しいChapterに入った後のHeading選択で21pp失っている。原因：HS descriptionは専門用語（"Automatic data-processing machines"）、ユーザー入力は日常語（"laptop"）。キーワードが一致しない。

### 3. 素材 vs 用途の問題

"cotton shirt"でCh.52（綿）がCh.62（衣類）に勝つ。GIR 3(b)の「本質的特性」問題。garment heuristicは正しい方向だが衣類ドメインにハードコードされており、一般化されていない。

---

## 対応施策と結果

### 施策A: Head-word重み付け（見送り）

**提案**: 英語複合名詞の最後の語がhead（主語）。`car tire` → tire重視。10行のコード変更。

**実装**: `tokens` 配列の最後のPRODUCT_CHAPTER_ROUTES / FUNCTION_WORDS 登録語を複製して重みを擬似的に2倍にするアプローチ。

**結果**: 53% → 50% (-3pp)。**リグレッション。**

**失敗の分析**:

1. **全スコアリング段階に影響が波及**: section/chapter選択にも重み変更が伝播し、意図しない候補変動が発生
2. **heading/subheadingのみに限定しても51%**: section/chapter選択を隔離しても、heading内で「最後のプロダクト語」の判定自体が不正確
3. **head-word判定がドメイン知識を要する**: `sedan car 1500cc gasoline engine` → `engine`が最後のプロダクト語として選ばれるが、この入力のheadは実際には `car`。`engine`は属性修飾語。商品名の構造解析は「最後の語」ルールでは解決しない
4. **ヒューリスティックの上にヒューリスティックを重ねる構造問題の再現**: レビューで指摘された問題をそのまま再生産

**学び**: 「シンプルな10行の変更」が「シンプルな効果」を持つとは限らない。入力トークンの重みを変えることは、スコアリングパイプライン全体への横断的変更であり、影響範囲が大きい。局所的な改善に見えても、下流の全ヒューリスティックとの相互作用を変える。

### 施策B: Heading-level synonym table（実施・成功）

**提案**: LLMに「Heading 8471のdescriptionを読んで、消費者が使うであろう日常語を列挙せよ」と指示し、heading→keyword mappingをビルド時生成。

**実装**:

```
compiler/build-heading-synonyms.ts  — LLM生成スクリプト
data/heading-synonyms.json          — 390 headings × avg 9.5語 = 3,703語
src/classifier.ts                   — scoreNodes() にsynonym boost追加
```

**アルゴリズム**:
```typescript
// scoreNodes() 内、各headingに対して
const synonyms = headingSynonyms.get(node.code);  // Set<string>
let synonymHits = 0;
for (const t of inputTokens) {
  if (synonyms.has(t)) synonymHits++;
}
if (synonymHits > 0) {
  const synonymScore = synonymHits / inputTokens.length;
  if (score === 0) {
    score = synonymScore * 0.8;   // synonym matchだけでも候補に浮上
  } else {
    score = Math.max(score, score * 0.5 + synonymScore * 0.5);  // 既存スコアとblend
  }
}
```

**結果**: 53% → 56% (+3pp)、Chapter 74% → 76%。リグレッションなし。

**改善された具体ケース**:
- Ch.44: 67% → 83% — `chopsticks` → heading 4419の synonym hitで「Tableware and kitchenware, of wood」が浮上
- Ch.48: 33% → 50% — `toilet paper` → heading 4818の synonym `toilet`
- Ch.64: 17% → 50% — `running shoes` → heading 6404の synonym `running`, `sneaker`

**改善が控えめな理由**:

1. **Chapter選択ミスが先に来ると、synonym boostは効かない**: synonymはheadingレベルでしか効かない。そもそもChapterが間違っていれば正しいheadingは候補にすらない
2. **blend比率の保守性**: 0.5/0.5のblendは、既存スコアが高い誤ったheadingに対してsynonymが逆転するには不十分なケースがある。比率を上げるとリグレッションリスク
3. **synonym品質のばらつき**: LLM生成の日常語リストに漏れやノイズがある。例えばheading 6204のsynonymに `jeans` が含まれていないケースがありうる

---

## 現在の精度推移

| 時点 | 4桁精度 | Chapter正解率 | 施策 |
|------|---------|-------------|------|
| v0.2.0 | 90% (Ch.87のみ) | — | ベースライン |
| 横展開直後（10章） | 35% | — | 語彙なし |
| 語彙拡張後 | 61% | 82% | routes/lexicon/section-map |
| +10章追加後 | 53% | 74% | 新章の語彙が薄い |
| +heading synonyms | 56% | 76% | LLM synonym table |

---

## 構造的問題への対応状況

| レビュー指摘 | 対応 | 状態 |
|-------------|------|------|
| ヒューリスティックの積み重ね限界 | heading synonymは「ヒューリスティックの追加」ではなく「データ駆動の判別力向上」。ただし既存のヒューリスティック層は減っていない | 部分的 |
| 21pp heading選択ギャップ | heading synonym tableで3pp改善（21pp → 20pp）。インフラは構築済み、synonym品質改善で追加効果が見込める | 進行中 |
| 素材 vs 用途（priorityルールタイプ） | 未着手。garment heuristicのハードコードが残っている | 未着手 |
| 複合名詞のhead-word | 試みたが見送り。静的ルールでは解決困難 | 見送り |
| head-word重み付け | -3ppリグレッション。影響範囲が広すぎる | 見送り |

---

## 次の改善候補（優先順）

### 1. Synonym品質改善（低コスト・中リターン）

現在のLLMプロンプトを改善し、テストケースのMISSから逆引きで不足synonymを特定。例：

```
MISS: "men's denim jeans, woven cotton" → Ch.52 (expected Ch.62)
→ heading 6203のsynonymに "jeans", "denim" があるか確認
→ なければ追加
```

これは精度チューニングではあるが、heading synonym tableの構造がスケーラブルなので、ヒューリスティック追加ではない。

### 2. Priorityルールタイプ（中コスト・高リターン）

AIコンパイラの6番目のルールタイプとして、「最終製品の章は素材の章より優先」をSection/Chapter Notesから自動抽出。garment heuristicを一般化し、衣類以外のドメイン（例：Ch.42のバッグ vs Ch.39のプラスチック）にもスケール。

### 3. N-gram routing（中コスト・中リターン）

`car tire` → Ch.40、`car engine` → Ch.84 のような2-gramルーティング。head-word重み付けの失敗を踏まえ、語の位置ではなく語の組み合わせで判定するアプローチ。PRODUCT_CHAPTER_ROUTESの拡張として実装可能。

---

## 設計上の気づき

### 「スコアリングパイプラインへの横断的変更」は危険

TF-IDF、head-word重み付けの両方が、スコアリングの基盤（トークンの重み/出現回数）を変更しようとした。これらはパイプライン全体に影響し、既存の多数のヒューリスティック係数との相互作用でリグレッションを起こす。

heading synonym tableが成功したのは、**スコアリング基盤を変えずに、特定のレイヤー（heading選択）にのみ追加情報を注入**したから。既存のscoreDescription, cross-ref penalty, coverage blend等には一切触れていない。

### 教訓: 新しい情報は「新しいチャネル」で入れる

既存のスコアリング関数を修正するのではなく、独立したスコアリングチャネルとして追加し、最後にblendする設計が安全。heading synonym boostは `scoreNodes` 内で独立したscoreとして計算され、既存の `bestDescScore` の結果とblendされる。これが成功の構造的理由。
