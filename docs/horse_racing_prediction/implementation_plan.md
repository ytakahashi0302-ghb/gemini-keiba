# 予想・結果比較UI 実装計画

AI予想がどれくらい的中・回収したかの答え合わせができるUI」を実装するための計画です。

## User Review Required
なし (承認済み)

## Proposed Changes

---

### Frontend (JavaScript / HTML)
#### [MODIFY] app.js

* 資金配分シミュレーション関数 (`calculateAllocation`) に、結果確認ロジックを追加。
  * もし `currentRaceData.race_info.status === 'finished'` であれば、配分済みの購入リスト(`portfolio_a`, `portfolio_b`) と、`race_info.results.payouts` の実際の払戻金データを比較評価する関数 `evaluatePortfolioHitRate()` を呼び出す。
* UI更新
  * 戦略A、戦略Bの各枠内に「🔔 予想結果」として、合計投資額、払戻総額、回収率（〇〇%）、的中した買い目のリストを動的にレンダリングするHTML文字列生成ロジックを追加。

#### [MODIFY] index.html
* 必要に応じて CSS変数の追加や、的中時のハイライトクラス（背景色など）を微調整し、結果比較UIが視覚的に際立つようにする。

## Verification Plan

### Automated Tests
* なし

### Manual Verification
* `python scraper.py` を再実行し、過去レース（例：オーシャンS）のEV計算がVer2.3に則り、人気下位の馬の期待値が極端に高くならず、実力馬が選出されているか `data.json` で確認する。
* ローカルでブラウザを立ち上げ、予算（例：10,000円）を入力。オーシャンSを選択し、AIの買い目に対して正しく「的中/不的中」の振る舞いと「回収率XXX%」が表示されるか、ブラウザのスクリーンショットを用いて確認する。
