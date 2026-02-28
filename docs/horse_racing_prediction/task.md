- [x] フェーズ1: フロントエンド基盤の構築とモック設計
- [x] フェーズ2: 資金配分・投資ロジックの実装
- [x] フェーズ3: Pythonスクレイパーと計算ロジックの開発
- [x] Analyze the user's "EV Version 2.0" calculation formula and mapping logic.
- [x] Update `scraper.py` to calculate the new `score_si` and generate categories (絶対軸, 高EV伏兵, 危険な人気馬).
- [x] Update `app.js` and `index.html` to consume these new AI variables and render them properly in the dashboard.
- [x] Modify the UI to reflect a clean, modern SaaS dashboard design with a focus on data visualization.
- [x] **[NEW]** Dynamically scale the number of bet types in the portfolio simulator based on budget size.
- [x] **[NEW]** Filter the target races exclusively for Graded Stakes (重賞レース) to remove noise like Aquamarine S.
- [x] **[NEW]** Extract real Predicted Odds and Popularity (予想オッズ/人気) from Netkeiba to prevent linear mocking and ensure realistic values.
- [x] Run local testing and record an end-to-end browser walkthrough video of the portfolio capabilities.

### 追加実装フェーズ2: 週末重賞の網羅とサイドバーUI化
- [x] 1. `scraper.py` を修正し、当日および翌日の両方から重賞レースをもれなく抽出するように変更。
- [x] 2. フロントエンドのUIを改修し、レース選択プルダウンをSaaSテーマに沿ったサイドバーリスト (`<ul>`, `<li>`) に置き換える。

### 追加実装フェーズ3: GitHub & Netlify 本番環境デプロイ
- [/] 1. ワークスペース内の不要なテスト用ファイル（HTML, Python）を削除し、`.gitignore` を作成して整理。
- [ ] 2. プロジェクトをGitリポジトリとして初期化 (`git init` 〜 初回コミット)。
- [ ] 3. (オプション)週末の最新オッズ自動抽出用の GitHub Actions ワークフローを作成。
- [x] 1. Pythonバックエンドの改修 (`scraper.py`)
- [x] 2. フロントエンド UIの改修 (`index.html`, `style.css`)
- [x] 3. JavaScript ロジックの改修 (`app.js`)
- [x] 4. 結合テストとブラウザ検証

### UIリデザイン・全券種・実データ対応フェーズ
- [x] 1. フロントエンドのUI順序とデザイン改修
  - [x] `index.html`: セクション順序の変更 (出走馬一覧をプルダウンの直下へ配置)
  - [x] `style.css`: 落ち着いたトーン(netkeiba風)へのカラースキーム変更と、過度な装飾(グラデーション・影)の削除
  - [x] `style.css`: レスポンシブグリッドの調整
- [x] 2. 全券種対応と資金配分の再計算
  - [x] `scraper.py`: 馬連、馬単、3連単の期待値計算追加
  - [x] `app.js`: 追加された全券種のトップ3レンダリング対応
- [x] 3. 実際のレースデータ(netkeiba等)のスクレイピング実装
  - [x] `scraper.py`: 今週末の重賞・メインレースの対象URLリストの実装
  - [x] HTMLパース（出馬表、オッズ、馬体重等）の実装
  - [x] スクレイピング結果からの勝率・期待値計算ロジックへの連携
- [x] 4. 結合テストと動作検証

### 追加データソース拡充フェーズ (競馬ラボ等)
- [x] 1. 競馬ラボ(Keiba Lab) からのデータスクレイピング処理追加 (`scraper.py`)
  - [x] 競馬ラボのレースページから上がり3Fや予想指数等のデータを取得
  - [x] Netkeibaのデータ（オッズ等）と馬番をキーにしてマージするロジックの実装
- [x] 2. 予測ロジックへの組み込み
  - [x] 取得したデータを加味した勝率・期待値の微調整ロジックの追加
- [x] 3. 動作テスト
  - [x] フロントエンドのUIに項目が正しく表示されるかの確認

### 期待値(EV)モデル Ver 2.0 導入フェーズ
- [x] 1. 評価式スコア計算アルゴリズムの実装 (`scraper.py`)
  - [x] 直近3走着順、走破タイムなどを競馬ラボから追加抽出
  - [x] 競馬場ごと(直線、坂、コーナー)のハードコードプロファイル作成 ($C_i$ の計算)
  - [x] 数学モデル(Zスコア等)を用いた総合期待値スコア $S_i$ の算出
- [x] 2. 馬のカテゴリ分類と買い目(ポートフォリオ)の生成ロジック (`scraper.py`)
  - [x] 「絶対軸」「高EV伏兵」「危険な人気馬」の分類ラベルの付与
  - [x] ポートフォリオ生成 (戦略A: バランス型, 戦略B: ハイリスク型)
- [x] 3. 最新モダンUIへのデザイン刷新 (`app.js`, `style.css`, `index.html`)
  - [x] Google Fonts (Inter/Outfit等) の導入とベースデザインのGlassmorphism(グラスモーフィズム)化
  - [x] テーブルに馬のカテゴリ(分類バッジ)を表示する列を追加、ホバー時の滑らかなアニメーション導入
  - [x] 買い目表示エリアを戦略Aと戦略Bに分割・タブ化して表示する改修
