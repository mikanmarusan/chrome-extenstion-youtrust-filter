# YOUTRUST Filter

YOUTRUST.jpの「つながり」（`/friend_connections`）と「知り合いかも？」（`/friend_candidates`）の
両ページで特定企業の候補者をフィルターするChrome拡張機能。

## Features
- 指定した企業の候補者カードを薄く表示（フィルター）
- ポップアップUIで企業の追加/削除が可能
- フィルターのON/OFF切り替え
- 無限スクロール・カルーセルの遅延描画に対応
- フィルターしたカードは `inert` で操作・支援技術からも除外
- 設定はChromeアカウント間で同期

## Installation
前提: Node.js v24以上 / npm v11以上（`.nvmrc` 参照。nvm利用時は `nvm use`）

1. `npm install`
2. `npm run build`
3. Chrome → `chrome://extensions/` → Developer Mode ON
4. "Load unpacked" → `dist/` フォルダを選択

## Development
- `npm run dev` - 開発ビルド（watch mode）
- `npm run build` - プロダクションビルド
- `npm run test` - テスト実行
- `npm run lint` - ESLint実行
- `npm run type-check` - TypeScript型チェック

## Tech Stack
- TypeScript
- Webpack
- Chrome Extension Manifest V3
- Jest (testing)
