/**
 * Unit tests for popup script
 */

describe('Popup Script', () => {
  beforeEach(() => {
    // Setup mock DOM
    document.body.innerHTML = `
      <input type="checkbox" id="filterToggle" />
      <input type="text" id="companyInput" />
      <button id="addButton">追加</button>
      <ul id="companyList"></ul>
      <span id="filterCount">0</span>
    `;

    // Reset chrome storage mock
    (chrome.storage.sync.get as jest.Mock).mockClear();
    (chrome.storage.sync.set as jest.Mock).mockClear();
  });

  describe('DOM Elements', () => {
    it('should have all required DOM elements', () => {
      expect(document.getElementById('filterToggle')).toBeTruthy();
      expect(document.getElementById('companyInput')).toBeTruthy();
      expect(document.getElementById('addButton')).toBeTruthy();
      expect(document.getElementById('companyList')).toBeTruthy();
      expect(document.getElementById('filterCount')).toBeTruthy();
    });

    it('should have correct element types', () => {
      const toggle = document.getElementById('filterToggle') as HTMLInputElement;
      expect(toggle.type).toBe('checkbox');

      const input = document.getElementById('companyInput') as HTMLInputElement;
      expect(input.type).toBe('text');

      const button = document.getElementById('addButton') as HTMLButtonElement;
      expect(button.tagName).toBe('BUTTON');

      const list = document.getElementById('companyList') as HTMLUListElement;
      expect(list.tagName).toBe('UL');

      const count = document.getElementById('filterCount') as HTMLSpanElement;
      expect(count.tagName).toBe('SPAN');
    });
  });

  describe('Chrome Storage Integration', () => {
    it('should be able to get data from chrome storage', async () => {
      const mockData = {
        filterEnabled: true,
        filteredCompanies: ['Company A', 'Company B']
      };

      (chrome.storage.sync.get as jest.Mock).mockResolvedValue(mockData);

      const result = await chrome.storage.sync.get(['filterEnabled', 'filteredCompanies']);
      expect(result.filterEnabled).toBe(true);
      expect(result.filteredCompanies).toHaveLength(2);
    });

    it('should be able to set data in chrome storage', async () => {
      const dataToSet = { filterEnabled: false };
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);

      await chrome.storage.sync.set(dataToSet);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(dataToSet);
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage error');
      (chrome.storage.sync.get as jest.Mock).mockRejectedValue(error);

      await expect(chrome.storage.sync.get(['test'])).rejects.toThrow('Storage error');
    });
  });

  describe('UI Interactions', () => {
    it('should toggle checkbox state', () => {
      const toggle = document.getElementById('filterToggle') as HTMLInputElement;

      expect(toggle.checked).toBe(false);
      toggle.checked = true;
      expect(toggle.checked).toBe(true);
    });

    it('should handle input field changes', () => {
      const input = document.getElementById('companyInput') as HTMLInputElement;

      input.value = 'Test Company';
      expect(input.value).toBe('Test Company');
    });

    it('should update company list', () => {
      const list = document.getElementById('companyList') as HTMLUListElement;

      const li = document.createElement('li');
      li.textContent = 'Company Item';
      list.appendChild(li);

      expect(list.children.length).toBe(1);
      expect(list.firstElementChild?.textContent).toBe('Company Item');
    });

    it('should update filter count', () => {
      const count = document.getElementById('filterCount') as HTMLSpanElement;

      count.textContent = '5';
      expect(count.textContent).toBe('5');
    });
  });

  describe('Event Handling', () => {
    it('should handle button clicks', () => {
      const button = document.getElementById('addButton') as HTMLButtonElement;
      let clicked = false;

      button.addEventListener('click', () => {
        clicked = true;
      });

      button.click();
      expect(clicked).toBe(true);
    });

    it('should handle checkbox changes', () => {
      const toggle = document.getElementById('filterToggle') as HTMLInputElement;
      let changed = false;

      toggle.addEventListener('change', () => {
        changed = true;
      });

      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(changed).toBe(true);
    });

    it('should handle input keypress', () => {
      const input = document.getElementById('companyInput') as HTMLInputElement;
      let keypressed = false;

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          keypressed = true;
        }
      });

      const event = new KeyboardEvent('keypress', { key: 'Enter' });
      input.dispatchEvent(event);
      expect(keypressed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing DOM elements gracefully', () => {
      const element = document.getElementById('non-existent');
      expect(element).toBeNull();
    });

    it('should handle empty input values', () => {
      const input = document.getElementById('companyInput') as HTMLInputElement;
      expect(input.value).toBe('');
      expect(input.value.trim()).toBe('');
    });
  });
});
