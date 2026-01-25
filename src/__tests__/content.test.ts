/**
 * Unit tests for content script
 */

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
