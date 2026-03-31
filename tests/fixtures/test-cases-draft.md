# テストケースドラフト（42件）

21セクション×2件。各セクションから「素直なケース」と「境界ケース」を1件ずつ。
HSコードの正解は customs.go.jp/searchtc/ で要検証。

## 方針
- 既存10件（test-cases.json）+ 本ドラフト40件 = 合計50件
- Section XIX（Arms）は除外 → 20セクション×2件 = 40件
- JSON形式: `{ description, expected4, expected6, difficulty: "easy"|"hard", section: "I"〜"XXI" }`
- 件12 (hand sanitizer), 件18 (bamboo cutting board): 正解コードは検証時に特に注意

## 検証ステータス
- [ ] 全件のHSコードをcustoms.go.jp/searchtc/で検証

---

## Section I: Live animals; animal products (Ch.01-05)
1. **素直** "frozen chicken thighs" → 期待: 0207 / 020714
2. **境界** "dried shark fins" → 期待: 0305 / 030571 (魚加工品 vs 動物由来品)

## Section II: Vegetable products (Ch.06-14)
3. **素直** "green tea leaves" → 期待: 0902 / 090220
4. **境界** "unroasted coffee beans" → 期待: 0901 / 090111 (素直ケースに変更、焙煎はHS版依存リスク)

## Section III: Animal or vegetable fats and oils (Ch.15)
5. **素直** "olive oil virgin" → 期待: 1509 / 150910
6. **境界** "palm oil refined" → 期待: 1511 / 151190 (精製度でsubheading変動)

## Section IV: Prepared foodstuffs; beverages (Ch.16-24)
7. **素直** "chocolate bar" → 期待: 1806 / 180631
8. **境界** "energy drink" → 期待: 2202 / 220210 (飲料 vs 栄養剤で分岐)

## Section V: Mineral products (Ch.25-27)
9. **素直** "crude petroleum" → 期待: 2709 / 270900
10. **境界** "natural gas liquefied" → 期待: 2711 / 271111 (石油ガス vs 化学品)

## Section VI: Chemical products (Ch.28-38)
11. **素直** "aspirin tablets" → 期待: 3004 / 300490
12. **境界** "hand sanitizer" → 期待: 3808 / 380894 (消毒剤 vs 化粧品で分岐)

## Section VII: Plastics and rubber (Ch.39-40)
13. **素直** "rubber gloves" → 期待: 4015 / 401519
14. **境界** "plastic shopping bag" → 期待: 3923 / 392329 (包装用プラ vs 製品)

## Section VIII: Leather (Ch.41-43)
15. **素直** "leather belt" → 期待: 4203 / 420330
16. **境界** "faux leather wallet" → 期待: 4202 / 420232 (合成皮革 → プラスチック?)

## Section IX: Wood (Ch.44-46)
17. **素直** "plywood sheets" → 期待: 4412 / 441231
18. **境界** "bamboo cutting board" → 期待: 4419 / 441900 (竹 vs 木 vs 台所用品)

## Section X: Paper (Ch.47-49)
19. **素直** "cardboard boxes" → 期待: 4819 / 481910
20. **境界** "printed greeting cards" → 期待: 4909 / 490900 (印刷物 vs 紙製品)

## Section XI: Textiles (Ch.50-63)
21. **素直** "cotton t-shirt" → 期待: 6109 / 610910
22. **境界** "polyester backpack" → 期待: 4202 / 420292 (繊維素材 → VIII章バッグ)

## Section XII: Footwear, headgear (Ch.64-67)
23. **素直** "leather shoes" → 期待: 6403 / 640359
24. **境界** "rubber rain boots" → 期待: 6401 / 640110 (ゴム素材 → VII章?)

## Section XIII: Stone, ceramic, glass (Ch.68-70)
25. **素直** "glass wine bottle" → 期待: 7010 / 701090
26. **境界** "ceramic coffee mug" → 期待: 6912 / 691200 (陶器 vs 台所用品)

## Section XIV: Precious metals, jewelry (Ch.71)
27. **素直** "gold necklace" → 期待: 7113 / 711319
28. **境界** "silver plated cutlery" → 期待: 7114 / 711420 (銀めっき → XV章卑金属?)

## Section XV: Base metals (Ch.72-83)
29. **素直** "stainless steel kitchen knife" → 期待: 8211 / 821191
30. **境界** "aluminum foil roll" → 期待: 7607 / 760711 (アルミ箔 → 包装材?)

## Section XVI: Machinery, electrical (Ch.84-85)
31. **素直** "microwave oven" → 期待: 8516 / 851650
32. **境界** "electric toothbrush" → 期待: 8509 / 850940 (電気器具 vs XX章ブラシ)

## Section XVII: Vehicles (Ch.86-89)
33. **素直** "bicycle" → 期待: 8712 / 871200
34. **境界** "electric scooter" → 期待: 8711 / 871160 (電動 → XVI章電気?)

## Section XVIII: Instruments (Ch.90-92)
35. **素直** "digital thermometer" → 期待: 9025 / 902519
36. **境界** "fitness tracker watch" → 期待: 9102 / 910290 (時計 vs 電子機器)

## Section XIX: Arms (Ch.93)
~~37. "hunting rifle" — 除外（特殊カテゴリ、50件調整のため）~~
~~38. "paintball gun" — 除外（同上）~~

## Section XX: Miscellaneous manufactured (Ch.94-96)
39. **素直** "office desk lamp" → 期待: 9405 / 940540
40. **境界** "inflatable mattress" → 期待: 9404 / 940429 (マットレス vs VII章ゴム?)

## Section XXI: Works of art (Ch.97)
41. **素直** "oil painting original" → 期待: 9701 / 970110
42. **境界** "antique porcelain vase" → 期待: 9706 / 970600 (骨董品 vs XIII章陶器)
