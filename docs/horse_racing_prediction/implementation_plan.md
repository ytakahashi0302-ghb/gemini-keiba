# GitHubとNetlifyを使用した本番公開計画

本アプリのダッシュボードを実際のWeb上で動作させるため、ソースコードをGitHubにプッシュし、Netlifyを利用してホスティングを行うデプロイ計画です。不要なテスト用ファイル群はすべて削除し、リポジトリを整理しました。

## 🌐 デプロイ構成と今後のデータの流れ

1.  **フロントエンド (Netlifyホスティング):**
    *   ユーザーがアクセスする洗練されたSaaSダッシュボードUI（`frontend/`配下）は、Netlifyを通じて全世界に高速配信されます。
2.  **バックエンド・データ更新 (GitHub Actions自動化 - オプション提案):**
    *   Netlifyは静的ファイルの配信のみを行うため、Pythonスクリプト(`scraper.py`)を直接Netlify上で定期実行することはできません。
    *   **【推奨策】**: GitHubの無料機能「GitHub Actions」を使用し、「**毎週土曜・日曜の朝に自動で `scraper.py` を実行し、新しい重賞データを `data.json` に上書きして保存する**」ワークフローを組むことをお勧めします。これにより、完全に手放しで最新の予想ダッシュボードが週末に更新される最高のSaaS体験が完成します。

## Proposed Changes

### [NEW] .gitignoreの設定
*   [✓ 完了] Pythonのキャッシュファイル、仮想環境(`venv/`)、および環境固有のファイルを除外する `.gitignore` を設定しました。

### [NEW] GitHub Actionsを用いた自動スクレイピング（推奨）
#### [NEW] .github/workflows/scrape_weekend.yml
*   週末（例えば毎週土曜・日曜の朝8時）にPythonを起動し、重賞レースを自動取得して `frontend/data/data.json` にコミットする自動化スケジュールファイルを提案します。
*   ※ 今回はこちらも併せて実装しておきますか？（手動でコミットしてNetlifyに反映させる運用でも問題ありません）

### 🚀 Netlify公開に向けたユーザー様側での作業手順
AI側での実装（整理・GitHub連携準備）が完了後、ユーザー様には以下の手順を実施していただきます。

1.  **GitHubへのプッシュ**:
    *   GitHubアカウントで新しいリポジトリを作成し、このローカルフォルダの変更をコミット＆プッシュします。
2.  **Netlifyとの連携**:
    *   Netlifyのアカウントにログインし、「Add new site」>「Import an existing project」を選択します。
    *   連携したGitHubリポジトリを選択します。
    *   ビルド設定（**Publish directory**）を `frontend` と入力し、デプロイを実行します。

## User Review Required

> [!TIP]
> **GitHub Actionsによる週末自動更新機能**を実装してよろしいでしょうか？  
> 実装を希望される場合は、自動化スクリプトの設定ファイルを作成し、プロジェクトをGitリポジトリとして初期化 (`git init` 〜 コミット準備) いたします。
