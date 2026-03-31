# Hard 20件 — 検証済みHSコード

検証方法: Web検索（US CROSS rulings, WCO guidance, tariffnumber.com, Flexport HS lookup等）

## 修正が必要だった件: 3件

| # | 変更内容 | 理由 |
|---|---------|------|
| 12 | rubber rain boots: 640110 → **640192** | 640110は金属先芯付き。普通の長靴はcovering ankle but not knee = 640192 |
| 14 | silver plated cutlery: 7114/711420 → **8215/821510** | 機能的カトラリーは8215。7114は宝飾品。8215.10 = 貴金属めっき品を含むセット |
| 9  | bamboo cutting board: 441900 → **441920** | HS 2022で4419にbamboo細分（4419.20）が新設 |

## 確定リスト（JSON形式）

```json
[
  { "description": "dried shark fins", "expected4": "0305", "expected6": "030571", "difficulty": "hard", "section": "I", "note": "Fish processed (dried) → Ch.03 not Ch.05" },
  { "description": "unroasted coffee beans", "expected4": "0901", "expected6": "090111", "difficulty": "hard", "section": "II", "note": "Not roasted, not decaffeinated" },
  { "description": "palm oil refined", "expected4": "1511", "expected6": "151190", "difficulty": "hard", "section": "III", "note": "Refined = 'other' subheading under 1511" },
  { "description": "energy drink", "expected4": "2202", "expected6": "220210", "difficulty": "hard", "section": "IV", "note": "Non-alcoholic beverage with sugar/flavoring" },
  { "description": "natural gas liquefied", "expected4": "2711", "expected6": "271111", "difficulty": "hard", "section": "V", "note": "LNG = petroleum gas, liquefied" },
  { "description": "hand sanitizer", "expected4": "3808", "expected6": "380894", "difficulty": "hard", "section": "VI", "note": "WCO COVID guidance: disinfectant in retail packaging → 3808.94. Not 3004 (medicine) or 3307 (cosmetics)" },
  { "description": "plastic shopping bag", "expected4": "3923", "expected6": "392329", "difficulty": "hard", "section": "VII", "note": "Conveyance/packing of goods → 3923, not 3926 (other articles)" },
  { "description": "faux leather wallet", "expected4": "4202", "expected6": "420232", "difficulty": "hard", "section": "VIII", "note": "Outer surface of plastics (faux leather = PU/PVC) → 420232" },
  { "description": "bamboo cutting board", "expected4": "4419", "expected6": "441920", "difficulty": "hard", "section": "IX", "note": "HS 2022: 4419.20 = tableware/kitchenware of bamboo" },
  { "description": "printed greeting cards", "expected4": "4909", "expected6": "490900", "difficulty": "hard", "section": "X", "note": "Printed cards with personal greetings → 4909, not 4817 (paper stationery)" },
  { "description": "polyester backpack", "expected4": "4202", "expected6": "420292", "difficulty": "hard", "section": "XI", "note": "Textile outer surface bag → VIII章4202, not XI章 textile articles. US CROSS confirms 4202.92.30" },
  { "description": "rubber rain boots", "expected4": "6401", "expected6": "640192", "difficulty": "hard", "section": "XII", "note": "Waterproof rubber footwear covering ankle but not knee. NOT 640110 (metal toe-cap)" },
  { "description": "ceramic coffee mug", "expected4": "6912", "expected6": "691200", "difficulty": "hard", "section": "XIII", "note": "Ceramic tableware/kitchenware other than porcelain/china" },
  { "description": "silver plated cutlery", "expected4": "8215", "expected6": "821510", "difficulty": "hard", "section": "XIV→XV", "note": "Functional cutlery (spoons/forks) = 8215, NOT 7114 (goldsmiths wares). 8215.10 = sets with ≥1 plated piece. Great boundary case: XIV (precious metals) vs XV (base metals)" },
  { "description": "aluminum foil roll", "expected4": "7607", "expected6": "760711", "difficulty": "hard", "section": "XV", "note": "Al foil not backed, rolled but not further worked" },
  { "description": "electric toothbrush", "expected4": "8509", "expected6": "850980", "difficulty": "hard", "section": "XVI", "note": "Electro-mechanical domestic appliance with self-contained motor. NOT 9603 (brushes). US CROSS confirms 8509.80" },
  { "description": "electric scooter", "expected4": "8711", "expected6": "871160", "difficulty": "hard", "section": "XVII", "note": "HS 2022: 8711.60 = with electric motor for propulsion. NOT XVI章 electrical equipment. US CROSS confirms." },
  { "description": "fitness tracker watch", "expected4": "9102", "expected6": "910290", "difficulty": "hard", "section": "XVIII", "note": "If timekeeping is primary function → 9102. If primarily computing device → 8517/8543. Assume watch-form-factor with time display as primary." },
  { "description": "inflatable mattress", "expected4": "9404", "expected6": "940429", "difficulty": "hard", "section": "XX", "note": "Mattress of other materials. Could argue 6306.40 (pneumatic mattresses for camping) but general-purpose inflatable mattress → 9404.29" },
  { "description": "antique porcelain vase", "expected4": "9706", "expected6": "970600", "difficulty": "hard", "section": "XXI", "note": "Antiques >100 years old → 9706 regardless of material. If <100 years → 6913 (ceramic ornamental). Assumes genuine antique." }
]
```

## 検証で特に注意が必要だった件

### hand sanitizer（件6）
WCOがCOVID-19対応で公式ガイダンスを出しており、アルコールベースの手指消毒剤は3808.94（消毒剤、小売用包装）と確定。ただしインドでは3004（医薬品）との論争が継続した経緯あり。テストケースとしては3808/380894が国際標準。

### silver plated cutlery（件14）
ドラフトの7114/711420は誤り。7114は宝飾品（goldsmiths'/silversmiths' wares）。機能的なカトラリーは材質に関わらず8215。銀めっきの場合は8215.10。これはSection XIV vs XV の非常に良い境界ケース。

### fitness tracker watch（件18）
最も曖昧なケース。WCOのHS 2022ではスマートウォッチの分類について議論が継続中。テストケースとしては9102/910290を採用するが、分類器がこれを正解できなくてもペナルティにすべきではない（needs_review: true が正しい挙動）。
