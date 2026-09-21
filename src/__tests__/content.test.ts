/**
 * Unit tests for content script
 */
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

type StorageChangeListener = (
  changes: Record<string, { newValue?: unknown }>,
  namespace: string
) => void;

/**
 * content.ts は何もexportしないIIFEなので、pathname・DOM・ストレージを整えてから
 * モジュールを読み込み直すことで初期化処理ごと検証する。
 */
async function loadContentScript(
  pathname: string,
  fixture: string | null,
  filteredCompanies: string[]
): Promise<void> {
  window.history.replaceState({}, '', pathname);
  document.head.innerHTML = '';
  document.body.innerHTML = fixture
    ? fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf-8')
    : '';
  (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
    filterEnabled: true,
    filteredCompanies
  });

  jest.resetModules();
  await import('../content');
  // init() は非同期のため、microtaskとタイマーをflushしてから検証する
  await new Promise(resolve => setTimeout(resolve, 0));
}

function latestStorageChangeListener(): StorageChangeListener {
  const calls = (chrome.storage.onChanged.addListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as StorageChangeListener;
}

function dimmedCompanies(): string[] {
  return Array.from(document.querySelectorAll('.youtrust-filter-dimmed')).map(
    el => el.getAttribute('data-filter-company') || ''
  );
}

describe('Content Script', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Reset chrome storage mock
    (chrome.storage.sync.get as jest.Mock).mockClear();
    (chrome.storage.sync.set as jest.Mock).mockClear();
    (chrome.storage.local.set as jest.Mock).mockClear();
  });

  describe('Chrome Storage API', () => {
    it('should have chrome.storage.sync.get available', () => {
      expect(chrome.storage.sync.get).toBeDefined();
      expect(typeof chrome.storage.sync.get).toBe('function');
    });

    it('should have chrome.storage.sync.set available', () => {
      expect(chrome.storage.sync.set).toBeDefined();
      expect(typeof chrome.storage.sync.set).toBe('function');
    });

    it('should have chrome.storage.onChanged available', () => {
      expect(chrome.storage.onChanged).toBeDefined();
      expect(chrome.storage.onChanged.addListener).toBeDefined();
    });
  });

  describe('DOM Manipulation', () => {
    it('should be able to create DOM elements', () => {
      const div = document.createElement('div');
      div.id = 'test-element';
      document.body.appendChild(div);

      const element = document.getElementById('test-element');
      expect(element).toBeTruthy();
      expect(element?.tagName).toBe('DIV');
    });

    it('should be able to query DOM elements', () => {
      document.body.innerHTML = `
        <div class="test-class">
          <span id="test-span">Test Content</span>
        </div>
      `;

      const element = document.querySelector('.test-class');
      expect(element).toBeTruthy();

      const span = document.getElementById('test-span');
      expect(span?.textContent).toBe('Test Content');
    });
  });

  describe('Filter Configuration', () => {
    it('should handle filter configuration', async () => {
      const mockConfig = {
        filterEnabled: true,
        filteredCompanies: ['Test Company']
      };

      (chrome.storage.sync.get as jest.Mock).mockResolvedValue(mockConfig);

      const result = await chrome.storage.sync.get(['filterEnabled', 'filteredCompanies']);
      expect(result.filterEnabled).toBe(true);
      expect(result.filteredCompanies).toEqual(['Test Company']);
    });

    it('should handle empty storage', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({});

      const result = await chrome.storage.sync.get(['filterEnabled', 'filteredCompanies']);
      expect(result.filterEnabled).toBeUndefined();
      expect(result.filteredCompanies).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors', async () => {
      const error = new Error('Storage error');
      (chrome.storage.sync.get as jest.Mock).mockRejectedValue(error);

      await expect(chrome.storage.sync.get(['test'])).rejects.toThrow('Storage error');
    });

    it('should handle invalid selectors gracefully', () => {
      const element = document.querySelector('invalid[selector');
      expect(element).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should measure performance', () => {
      const start = performance.now();
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        document.createElement('div');
      }
      const end = performance.now();

      expect(end - start).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Content Script integration (jsdom + fixtures)', () => {
  beforeEach(() => {
    (chrome.storage.sync.get as jest.Mock).mockReset();
    (chrome.storage.local.set as jest.Mock).mockReset();
    (chrome.storage.onChanged.addListener as jest.Mock).mockClear();
  });

  it('dims matching cards on /friend_connections', async () => {
    await loadContentScript('/friend_connections', 'friendConnections.html', [
      'ExampleTwo株式会社'
    ]);

    expect(dimmedCompanies()).toEqual([
      'Example株式会社/ExampleTwo株式会社/ExampleThree株式会社'
    ]);
  });

  it('marks dimmed cards inert so they leave the tab order', async () => {
    await loadContentScript('/friend_connections', 'friendConnections.html', [
      'Example株式会社'
    ]);

    const dimmed = document.querySelectorAll('.youtrust-filter-dimmed');
    expect(dimmed.length).toBe(2);
    dimmed.forEach(card => {
      expect(card.hasAttribute('inert')).toBe(true);
    });
  });

  it('removes both the dimming class and inert when the filter is turned off', async () => {
    await loadContentScript('/friend_connections', 'friendConnections.html', [
      'Example株式会社'
    ]);
    expect(document.querySelectorAll('[inert]').length).toBe(2);

    latestStorageChangeListener()({ filterEnabled: { newValue: false } }, 'sync');

    expect(document.querySelectorAll('.youtrust-filter-dimmed').length).toBe(0);
    expect(document.querySelectorAll('[inert]').length).toBe(0);
  });

  it('still works on /friend_connections/ with a trailing slash', async () => {
    await loadContentScript('/friend_connections/', 'friendConnections.html', [
      'フリーランス'
    ]);

    expect(dimmedCompanies()).toEqual(['フリーランス']);
  });

  it('keeps working on /friend_candidates (regression pin)', async () => {
    await loadContentScript('/friend_candidates', 'friendCandidates.html', [
      'ExampleThree株式会社'
    ]);

    expect(dimmedCompanies()).toEqual([
      'Example株式会社/ExampleTwo株式会社/ExampleThree株式会社'
    ]);
  });

  it('does nothing on a page with no card container mapping', async () => {
    await loadContentScript('/home', 'friendConnections.html', ['Example株式会社']);

    expect(document.querySelectorAll('.youtrust-filter-dimmed').length).toBe(0);
    expect(document.getElementById('youtrust-filter-status')).toBeNull();
  });

  it('picks up cards added after the initial scan', async () => {
    await loadContentScript('/friend_connections', 'friendConnections.html', [
      'ExampleLate株式会社'
    ]);
    expect(document.querySelectorAll('.youtrust-filter-dimmed').length).toBe(0);

    const carousel = document.querySelector('.carousel') as Element;
    const added = document.createElement('div');
    added.className = 'MuiCardContent-root';
    added.innerHTML =
      '<a href="/users/fixture-user-99"><span>Fixture Person 99</span></a>' +
      '<span class="MuiTypography-root MuiTypography-caption">ExampleLate株式会社</span>';
    carousel.appendChild(added);

    // MutationObserverのコールバック -> throttle -> requestAnimationFrame を待つ
    await new Promise(resolve => setTimeout(resolve, 120));
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

    expect(added.classList.contains('youtrust-filter-dimmed')).toBe(true);
    expect(added.hasAttribute('inert')).toBe(true);
  });
});
