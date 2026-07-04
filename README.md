# スロット小役カウンター＆設定判別サポート（Web MVP）

スマートフォンのブラウザで利用できる、React + TypeScript + Vite製の小役カウントツールです。登録した参考値との比較であり、実際の設定・勝利・将来の結果を保証するものではありません。

## 主な機能

- サンプル機種／手動登録機種での実戦カウント
- 総ゲーム数と各項目の明示的な `+` / `-` 操作
- 小役・ボーナス・合算確率の自動計算
- 設定1〜6の参考値との近似比較
- 機種データ、実戦履歴、進行中実戦のlocalStorage保存
- 登録済み機種検索と情報元URLの保存
- 情報元URLからのページ取得、参考値候補の抽出、確認・修正後の保存
- スマートフォン優先のダークUI

## 開発

```bash
pnpm install
pnpm dev
```

本番ビルドは `npm run build`（または `pnpm build`）、ローカル確認は `pnpm preview` で行えます。生成先は `dist/` です。

## Vercel

リポジトリをVercelへインポートし、Framework Presetを `Vite` に設定してください。

- Root Directory: `./`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

`vercel.json`にも同じ設定を明記しているため、通常はVercelが自動認識します。Vercelの画面で別のRoot DirectoryやOutput Directoryを指定している場合は、上記へ直して再デプロイしてください。

## 構成

- `src/App.tsx`: 画面、ナビゲーション、カウント操作
- `src/styles.css`: スマートフォン優先のUI
- `src/types.ts`: データ型
- `src/services/storage.ts`: localStorage永続化
- `src/services/machineSearch.ts`: 将来の検索・取得・解析インターフェース
- `src/services/machineInfoFetcher.ts`: Vercel Functionとの通信
- `src/utils/probability.ts`: 確率計算と参考設定比較
- `src/utils/parseSlotInfo.ts`: 設定1〜6と確率表記の抽出
- `src/data/sample.ts`: 初期サンプル機種
- `api/fetch-machine-info.ts`: 外部ページを安全制限付きで取得するVercel Function

URL取得はログインやアクセス制限を回避せず、HTMLまたはテキストの公開ページをユーザー操作時に1回だけ取得します。抽出結果は自動保存されず、確認・修正後にユーザーが保存します。

以前作成したSwiftUI版は `SlotCounter/` と `SlotCounter.xcodeproj/` に残しています。Web版はルートの `package.json` から起動します。
