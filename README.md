# 釣り場ツール UI

このプロジェクトは、Vite + React + TypeScript を使用した釣り場ツールのUIです。Cloudflare Pages にデプロイ可能で、潮汐情報と天気予報を表示します。

## 機能

- 港選択: `/api/v1/stations` から取得した港リストから選択
- 日付選択: HTML date input で日付を指定
- 検索: `/api/v1/fishing-forecast` を使用してデータを取得
- 表示:
  - 潮汐データ表 (時刻 / 潮位(cm)、高潮・低潮強調)
  - 潮汐グラフ (Recharts 使用)
  - 天気・釣り予報情報 (天気、風向・風速、降水確率、気温)

## API

- ベースURL: `https://api.tsuriba-guide.com`
- 使用エンドポイント:
  - `GET /api/v1/stations`
  - `GET /api/v1/fishing-forecast?station_code=...&date=...`

## ローカル開発

1. 依存関係をインストール:
   ```bash
   npm install
   ```

2. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

   Vite proxy が `/api` を `https://api.tsuriba-guide.com` に転送します。

## Cloudflare Pages デプロイ

1. ビルド:
   ```bash
   npm run build
   ```

2. `dist/` フォルダを Cloudflare Pages にアップロード。

### 環境変数

Cloudflare Pages のダッシュボードで `VITE_API_BASE` を設定:
- 値: `https://api.tsuriba-guide.com` (またはカスタムドメイン)

設定しない場合、デフォルトで `https://api.tsuriba-guide.com` を使用。

## 技術スタック

- React 19
- TypeScript
- Vite
- Recharts (グラフ表示)
- Fetch API
