/**
 * カード検出ロジック（DOM のみに依存、chrome.* は一切使わない純粋モジュール）
 *
 * YOUTRUST のカードは MUI のクラス名に依存せず「候補者カードのコンテナ配下に
 * /users/ へのリンクが存在するか」という構造条件で判定する。
 */

/** カード内に必ず存在するユーザープロフィールへのリンク */
export const USER_LINK_SELECTOR = 'a[href^="/users/"]';

/** 企業名が入る caption 要素（カード内の最初の1件のみを企業名とみなす） */
export const COMPANY_NAME_SELECTOR = '.MuiTypography-root.MuiTypography-caption';

/** ページごとのカードコンテナセレクター（キーは pathname の接頭辞） */
export const PAGE_CARD_CONTAINERS: Record<string, string> = {
  '/friend_candidates': '.MuiGrid2-root.MuiGrid2-grid-xs-4',
  '/friend_connections': '.MuiCardContent-root'
};

/** ヘッダーのアバターリンク1件はカード外に常時存在する */
export const NON_CARD_USER_LINK_COUNT = 1;

/**
 * 警告を出すために必要な /users/ リンクの本数。
 * カード外のリンクは NON_CARD_USER_LINK_COUNT（ヘッダーのアバター1本）だけなので、
 * そこに余裕を2本足した本数を「カードは描画されているのに認識できていない」の下限とする。
 */
export const USER_LINK_WARN_THRESHOLD = NON_CARD_USER_LINK_COUNT + 2;

/** 連続でカード0件だった場合に警告を出す回数のしきい値 */
export const ZERO_SCAN_WARN_THRESHOLD = 2;

/**
 * pathname からカードコンテナのセレクターを解決する。
 * manifest の match パターンが `friend_connections*` のため
 * `/friend_connections/` のような末尾スラッシュ付きでも注入される。
 * 完全一致ではなく末尾スラッシュを除去した上での前方一致で判定する。
 */
export function resolveCardContainerSelector(pathname: string): string | null {
  if (!pathname) return null;

  // 末尾スラッシュを除去（'/friend_connections/' -> '/friend_connections'）
  const normalized = pathname.replace(/\/+$/, '');
  if (normalized.length === 0) return null;

  for (const [prefix, selector] of Object.entries(PAGE_CARD_CONTAINERS)) {
    if (normalized.startsWith(prefix)) {
      return selector;
    }
  }

  return null;
}

/**
 * コンテナセレクターに一致する要素のうち、配下に /users/ リンクを持つものだけを返す。
 * 1枚のカードはアバターと氏名の2本の /users/ リンクを持つため、
 * アンカーではなくコンテナ要素で重複排除する。
 */
export function findCandidateCards(root: ParentNode, containerSelector: string): Element[] {
  if (!containerSelector) return [];

  const containers = new Set<Element>();
  root.querySelectorAll(containerSelector).forEach(container => {
    if (container.querySelector(USER_LINK_SELECTOR)) {
      containers.add(container);
    }
  });

  return Array.from(containers);
}

/**
 * カードから企業名を取り出す（最初の caption 要素のみ = 企業名）。
 * ページごとに caption のセレクターが分かれた場合に備えて上書き可能にしてある。
 */
export function extractCompanyName(
  card: Element,
  companySelector: string = COMPANY_NAME_SELECTOR
): string {
  const companyElement = card.querySelector(companySelector);
  return companyElement?.textContent?.trim() || '';
}

/**
 * 企業名がフィルター対象かどうか（部分一致・大文字小文字は区別する）。
 * 「A社/B社/C社」のように複数社がひとつのテキストノードに入るため部分一致で判定する。
 */
export function isCompanyFiltered(companyName: string, filteredCompanies: string[]): boolean {
  return filteredCompanies.some(
    filterCompany => filterCompany.length > 0 && companyName.includes(filterCompany)
  );
}

/**
 * 「/users/ リンクは存在するのにカードを1枚も認識できない」状態が
 * 連続して続いた場合に、セレクター破損の警告を出すべきかを返す。
 *
 * 連続0件スキャンの計数とステータス表示の切り替えは `content.ts` が行う。
 * 判定そのものをここに置くのは、IIFEクロージャの内側はテストから触れないため。
 */
export function shouldWarnNoCardsDetected(
  userLinkCount: number,
  recognizedCardCount: number,
  consecutiveZeroScans: number
): boolean {
  if (recognizedCardCount > 0) return false;
  if (userLinkCount < USER_LINK_WARN_THRESHOLD) return false;
  return consecutiveZeroScans >= ZERO_SCAN_WARN_THRESHOLD;
}
