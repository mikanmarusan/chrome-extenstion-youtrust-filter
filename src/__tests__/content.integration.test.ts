/**
 * カード検出失敗の可視化（ステータスピル + トースト）の統合テスト。
 *
 * content.ts は何もexportしないIIFEなので、pathname・DOM・ストレージを整えてから
 * モジュールを読み込み直し、実際に描画されたDOMに対して検証する。
 */
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

const NO_CARDS_STATUS_TEXT = 'フィルター: カードを検出できません';
const NOTIFICATION_ID = 'youtrust-filter-notification';

function fixtureHtml(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
}

/** jsdomは色を正規化するため、比較対象も同じ経路で正規化する */
function normalizedColor(value: string): string {
  const probe = document.createElement('span');
  probe.style.background = value;
  return probe.style.background;
}

type StorageChangeListener = (
  changes: Record<string, { newValue?: unknown }>,
  namespace: string
) => void;

function latestStorageChangeListener(): StorageChangeListener {
  const calls = (chrome.storage.onChanged.addListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as StorageChangeListener;
}

function statusText(): string {
  return document.getElementById('filter-status-text')?.textContent || '';
}

function statusIcon(): HTMLSpanElement {
  const indicator = document.getElementById('youtrust-filter-status') as HTMLElement;
  return indicator.querySelector('span:first-child') as HTMLSpanElement;
}

/** MutationObserver -> throttle(50ms) -> requestAnimationFrame の一巡を待つ */
async function flushScan(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 120));
  await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
}

/** 検出専用スキャンは500ms間隔で間引かれるため、その分だけ余分に待つ */
async function flushDetectionScan(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 600));
  await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
}

/**
 * 直前のインスタンスが仕掛けたタイマー（遅延再スキャンなど）を落としてから読み直す。
 * 残っていると古いインスタンスが新しいピルを書き換えてテストが混線する。
 */
function clearPendingTimers(): void {
  const lastId = setTimeout(() => undefined, 0) as unknown as number;
  for (let id = 0; id <= lastId; id++) {
    clearTimeout(id);
    clearInterval(id);
  }
}

async function loadContentScript(pathname: string, fixture: string): Promise<void> {
  clearPendingTimers();
  window.history.replaceState({}, '', pathname);
  document.head.innerHTML = '';
  document.body.innerHTML = fixtureHtml(fixture);
  (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
    filterEnabled: true,
    filteredCompanies: ['Example株式会社']
  });

  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../content');
  // init() は非同期のため、microtaskとタイマーをflushしてから検証する
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('カードを検出できないときのステータス表示', () => {
  let appendSpy: jest.SpyInstance;

  beforeEach(() => {
    (chrome.storage.sync.get as jest.Mock).mockReset();
    (chrome.storage.local.set as jest.Mock).mockReset();
    (chrome.storage.onChanged.addListener as jest.Mock).mockClear();
    appendSpy = jest.spyOn(document.body, 'appendChild');
  });

  afterEach(() => {
    appendSpy.mockRestore();
  });

  function toastCreationCount(): number {
    return appendSpy.mock.calls.filter(
      ([node]) => (node as Element)?.id === NOTIFICATION_ID
    ).length;
  }

  /** カードが1枚も認識できないDOMのまま2回目のスキャンを走らせる */
  async function driveTwoZeroScans(): Promise<void> {
    // 1回目: init() のページ全体スキャン
    await loadContentScript('/friend_connections', 'friendConnectionsNoCards.html');
    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);

    // 2回目: カードセレクターに一致しないDOM更新（遅延描画の再現）
    const carousel = document.querySelector('.carousel') as Element;
    const added = document.createElement('div');
    added.className = 'MuiCardBody-root';
    added.innerHTML =
      '<a href="/users/fixture-user-9"><span>Fixture Person 9</span></a>' +
      '<span class="MuiTypography-root MuiTypography-caption">ExampleNine株式会社</span>';
    carousel.appendChild(added);
    await flushScan();
  }

  it('2回連続でカード0件なら検出失敗をピルに出す', async () => {
    await driveTwoZeroScans();

    expect(statusText()).toBe(NO_CARDS_STATUS_TEXT);
  });

  it('アイコンを赤にし、トーストは失敗状態に入った1回だけ出す', async () => {
    await driveTwoZeroScans();

    expect(statusIcon().style.background).toBe(normalizedColor('#f44336'));
    expect(toastCreationCount()).toBe(1);
  });

  it('件数バッジは検出失敗中は隠す', async () => {
    await driveTwoZeroScans();

    const badge = document.getElementById('filter-count-badge') as HTMLElement;
    expect(badge.style.display).toBe('none');
  });

  it('カードを認識できるDOMに差し替えて再スキャンすると通常状態へ戻る', async () => {
    await driveTwoZeroScans();
    expect(statusText()).toBe(NO_CARDS_STATUS_TEXT);

    // カードを認識できるフィクスチャに差し替える
    // （MutationObserverの監視対象は #scrollableMainContentName なので中身を入れ替える）
    const observedRoot = document.getElementById('scrollableMainContentName') as HTMLElement;
    const parsed = document.createElement('div');
    parsed.innerHTML = fixtureHtml('friendConnections.html');
    const restored = parsed.querySelector('#scrollableMainContentName') as HTMLElement;
    restored.removeAttribute('id');
    observedRoot.innerHTML = '';
    observedRoot.appendChild(restored);
    await flushScan();

    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);
    expect(statusText()).toContain('フィルター: 有効');
  });

  it('差分スキャンの0件は連続0件に数えない', async () => {
    // 1回目のページ全体スキャンだけが0件として数えられている状態から始める
    await loadContentScript('/friend_connections', 'friendConnectionsNoCards.html');

    // カードコンテナには一致するが /users/ リンクを持たない要素を2回追加する。
    // これは差分スキャンで0件になるが、セレクター破損の証拠ではない。
    const carousel = document.querySelector('.carousel') as Element;
    for (const label of ['一覧で見る', 'もっと見る']) {
      const link = document.createElement('div');
      link.className = 'MuiCardContent-root';
      link.innerHTML = `<a href="/friend_connections?page=2"><span>${label}</span></a>`;
      carousel.appendChild(link);
      await flushScan();
    }

    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);
    expect(toastCreationCount()).toBe(0);
  });

  it('復帰後は連続0件のカウントもリセットされ、次は2回目のスキャンで再び警告する', async () => {
    await driveTwoZeroScans();
    expect(toastCreationCount()).toBe(1);

    // いったんカードを認識できる状態に戻す
    const observedRoot = document.getElementById('scrollableMainContentName') as HTMLElement;
    const recovered = document.createElement('div');
    recovered.innerHTML = fixtureHtml('friendConnections.html');
    observedRoot.innerHTML = '';
    observedRoot.appendChild(recovered);
    await flushScan();
    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);

    // 再びカードを認識できないDOMにする（1回目のスキャンでは警告しない）
    const broken = document.createElement('div');
    broken.innerHTML = fixtureHtml('friendConnectionsNoCards.html');
    observedRoot.innerHTML = '';
    observedRoot.appendChild(broken);
    await flushDetectionScan();
    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);

    // 2回目で再び警告し、トーストも再入場の1回だけ増える
    broken.appendChild(document.createElement('div'));
    await flushDetectionScan();
    expect(statusText()).toBe(NO_CARDS_STATUS_TEXT);
    expect(toastCreationCount()).toBe(2);
  });

  it('フィルターを切って入れ直したら古い検出状態を引きずらない', async () => {
    await driveTwoZeroScans();
    expect(statusText()).toBe(NO_CARDS_STATUS_TEXT);

    const listener = latestStorageChangeListener();
    listener({ filterEnabled: { newValue: false } }, 'sync');
    expect(statusText()).toBe('フィルター: 無効');

    listener({ filterEnabled: { newValue: true } }, 'sync');
    // 再有効化直後はスキャン1回分しか根拠が無いので、警告は出さずに通常表示へ戻す
    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);
    expect(statusText()).toContain('フィルター: 有効');

    // DOMが静止したままでも遅延再スキャンで2回目の根拠が揃い、改めて警告する
    await new Promise(resolve => setTimeout(resolve, 3300));
    expect(statusText()).toBe(NO_CARDS_STATUS_TEXT);
  }, 10000);

  it('DOM更新が止まったままのページでも遅延再スキャンで警告する', async () => {
    await loadContentScript('/friend_connections', 'friendConnectionsNoCards.html');
    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);

    // ここから一切DOMを触らない（MutationObserverは何も拾わない）
    await new Promise(resolve => setTimeout(resolve, 3300));

    expect(statusText()).toBe(NO_CARDS_STATUS_TEXT);
    expect(toastCreationCount()).toBe(1);
  }, 10000);

  it('空のコンテナが後から埋まるカードも取りこぼさずフィルターする', async () => {
    await loadContentScript('/friend_connections', 'friendConnections.html');

    // 1段目: 中身のない空コンテナだけが描画される
    const carousel = document.querySelector('.carousel') as Element;
    const card = document.createElement('div');
    card.className = 'MuiCardContent-root';
    carousel.appendChild(card);
    await flushScan();
    expect(card.hasAttribute('data-youtrust-filtered')).toBe(false);

    // 2段目: 同じコンテナに中身が入る（コンテナ自身は addedNodes に現れない）
    const link = document.createElement('a');
    link.setAttribute('href', '/users/fixture-user-77');
    link.textContent = 'Fixture Person 77';
    const company = document.createElement('span');
    company.className = 'MuiTypography-root MuiTypography-caption';
    company.textContent = 'Example株式会社';
    card.appendChild(link);
    card.appendChild(company);
    await flushScan();

    expect(card.getAttribute('data-youtrust-filtered')).toBe('true');
    expect(card.classList.contains('youtrust-filter-dimmed')).toBe(true);
  });

  it('件数バッジに部分集計であることの説明を付ける', async () => {
    await loadContentScript('/friend_connections', 'friendConnections.html');

    const badge = document.getElementById('filter-count-badge') as HTMLElement;
    expect(badge.title).toBe(
      '現在表示されているカードのうち、フィルター対象企業と一致した件数です（画面外や未読み込みのカードは含みません）'
    );
  });

  it('カード外のリンクしか無いページでは警告を出さない', async () => {
    await loadContentScript('/friend_candidates', 'friendCandidates.html');
    // カードを全部取り除き、ヘッダーのアバターリンクだけを残す
    document.querySelectorAll('.MuiGrid2-root.MuiGrid2-grid-xs-4').forEach(el => el.remove());

    const header = document.querySelector('header') as Element;
    header.appendChild(document.createElement('div'));
    await flushScan();
    header.appendChild(document.createElement('div'));
    await flushScan();

    expect(statusText()).not.toBe(NO_CARDS_STATUS_TEXT);
    expect(toastCreationCount()).toBe(0);
  });
});
