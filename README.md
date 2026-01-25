# YOUTRUST Filter

YOUTRUST.jpの「知り合いかも？」ページで特定企業の候補者をフィルターするChrome拡張機能。

## Features
- 指定した企業の候補者カードを薄く表示（フィルター）
- ポップアップUIで企業の追加/削除が可能
- フィルターのON/OFF切り替え
- 無限スクロール対応
- 設定はChromeアカウント間で同期

## Installation
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
