# YOUTRUST Filter - Development Guidelines

## Project Overview
YOUTRUST.jpの「つながり」（`/friend_connections`）と「知り合いかも？」（`/friend_candidates`）の
両ページで企業名ベースのフィルタリングを行うChrome拡張機能。

## Architecture
- `src/content.ts` - メインのフィルタリングロジック（DOM操作、MutationObserver）
- `src/cardDetector.ts` - カード検出の純粋ロジック（DOMのみ、`chrome.*` 非依存でユニットテスト可能）
- `src/popup.ts` - ポップアップUI管理
- `src/types.ts` - TypeScript型定義
- `public/` - 静的アセット（manifest.json, HTML, CSS, icons）

## CSS Selectors (CRITICAL)
YOUTRUSTのHTML構造が変わると動作しなくなる可能性あり。セレクターの知識は
`src/cardDetector.ts` に集約し、`src/content.ts` 側には持たせない。

### 検出ルール
カードは「ページごとのコンテナセレクターに一致し、かつ配下に `/users/` リンクを持つ要素」
という構造条件で判定する。`[data-click-component-name]` のようなサイト都合で消える属性には依存しない。

- コンテナ（`PAGE_CARD_CONTAINERS`）:
  - `/friend_candidates` → `.MuiGrid2-root.MuiGrid2-grid-xs-4`
  - `/friend_connections` → `.MuiCardContent-root`
- ユーザーリンク（`USER_LINK_SELECTOR`）: `a[href^="/users/"]`
- 企業名（`COMPANY_NAME_SELECTOR`）: `.MuiTypography-root.MuiTypography-caption`（カード内の最初の要素）

### 注意点
- `resolveCardContainerSelector()` は末尾スラッシュを除去した上で前方一致する。
  manifest の match が `friend_connections*` のため `/friend_connections/` でも注入されるので、
  完全一致にすると無言で何もしない状態になる。
- 1枚のカードはアバターと氏名の2本の `/users/` リンクを持つため、
  重複排除はアンカーではなくコンテナ要素で行う。
- `/friend_connections` に `.MuiGrid2-*` と `[data-click-component-name]` は存在しない。
- 「一覧で見る」カードは `/users/` リンクを持たないため構造条件で自然に除外される。
- ヘッダーのアバターだけはカード外の `/users/` リンクとして各ページに1本存在する。

## Key Technical Decisions
1. **セレクター戦略**: ページ別コンテナセレクター + `/users/` リンクの有無という構造条件で判定
2. **パフォーマンス**: WeakSetで処理済み要素を追跡、50msスロットリング
3. **ストレージ**: Chrome Storage Sync APIでクロスデバイス同期
4. **検出失敗の可視化**: `/users/` リンクが3本以上あるのにカード0件のページ全体スキャンが
   2回続いたら、ステータスピルを「フィルター: カードを検出できません」に切り替えてトーストを1回出す。
   しきい値と判定は `shouldWarnNoCardsDetected()`（`src/cardDetector.ts`）に置き、`content.ts` は計数と表示のみ。

## Requirements
- Node.js v24以上 / npm v11以上
- バージョンは `.nvmrc` でピン留めし、`package.json` の `engines` で宣言
- `.npmrc` の `engine-strict=true` により、要件を満たさない環境では `npm install` / `npm ci` が失敗する

## Commands
- `npm run build` - プロダクションビルド
- `npm run dev` - 開発ビルド（watch mode）
- `npm run test` - Jestテスト実行（カバレッジ閾値もここで検証する）
- `npm run lint` - ESLint実行
- `npm run type-check` - TypeScript型チェック

## Lessons
- When changing a file through a scripted text substitution, make a non-match abort the edit and read the new value back out of the file before treating the change as landed. A substitution that quietly matches nothing leaves the old value in place while every later step reads the change as done.
- When a function is added ahead of the change that will call it, say in the code that nothing calls it yet and where it will be wired in. Without that note its passing tests imply a runtime behavior the product does not actually have.
- When a coverage gate is a single project-wide average, read the per-file numbers for the code the change actually touched. A fully covered new helper can lift the average on its own while the integration path that carries the real regression risk stays at zero.
- When a secondary path is added to observe whether the primary path is working, have it invoke the primary path instead of re-implementing a read-only imitation of it. An observer that only counts what the primary path acts on will eventually report health for work that was never performed.
- When a condition must hold several times before it is trusted, give it a trigger that does not depend on incidental outside activity, and attach that trigger to every entry point that can start the count, not only to startup. A count advanced solely by external events stalls whenever the source of those events goes quiet.
- When limiting how often an expensive action may run, defer the surplus call to the end of the interval rather than discarding it. Dropping the last call in a burst silently loses the one event that had to be handled.
