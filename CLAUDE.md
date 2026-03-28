# YOUTRUST Filter - Development Guidelines

## Project Overview
YOUTRUST.jpの「知り合いかも？」ページで企業名ベースのフィルタリングを行うChrome拡張機能。

## Architecture
- `src/content.ts` - メインのフィルタリングロジック（DOM操作、MutationObserver）
- `src/popup.ts` - ポップアップUI管理
- `src/types.ts` - TypeScript型定義
- `public/` - 静的アセット（manifest.json, HTML, CSS, icons）

## CSS Selectors (CRITICAL)
YOUTRUSTのHTML構造が変わると動作しなくなる可能性あり。

現在のセレクター（2026年確認済み）:
- カード: `.MuiGrid2-root.MuiGrid2-grid-xs-4`
- 企業名: `.MuiTypography-root.MuiTypography-caption`（最初の要素）
- ボタン: `[data-click-component-name="friendCandidate"]`

## Key Technical Decisions
1. **セレクター戦略**: MUIの安定したクラスプレフィックス + data属性を使用
2. **パフォーマンス**: WeakSetで処理済み要素を追跡、50msスロットリング
3. **ストレージ**: Chrome Storage Sync APIでクロスデバイス同期

## Commands
- `npm run build` - プロダクションビルド
- `npm run dev` - 開発ビルド（watch mode）
- `npm run test` - Jestテスト実行
- `npm run lint` - ESLint実行
- `npm run type-check` - TypeScript型チェック
