import { loadFilterConfig, saveFilterConfig, saveErrorLog } from '../storage';
import { DEFAULT_COMPANIES } from '../utils';

describe('Storage', () => {
  beforeEach(() => {
    // Reset chrome storage mock
    (chrome.storage.sync.get as jest.Mock).mockClear();
    (chrome.storage.sync.set as jest.Mock).mockClear();
    (chrome.storage.local.set as jest.Mock).mockClear();
  });

  describe('loadFilterConfig', () => {
    it('should load config from chrome storage', async () => {
      const mockConfig = {
        filterEnabled: false,
        filteredCompanies: ['Test Company']
      };

      (chrome.storage.sync.get as jest.Mock).mockResolvedValue(mockConfig);

      const result = await loadFilterConfig();
      expect(result).toEqual(mockConfig);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['filterEnabled', 'filteredCompanies']);
    });

    it('should use default values when storage is empty', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({});

      const result = await loadFilterConfig();
      expect(result.filterEnabled).toBe(true);
      expect(result.filteredCompanies).toEqual(DEFAULT_COMPANIES);
    });

    it('should handle storage errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (chrome.storage.sync.get as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await loadFilterConfig();
      expect(result.filterEnabled).toBe(true);
      expect(result.filteredCompanies).toEqual(DEFAULT_COMPANIES);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveFilterConfig', () => {
    it('should save config to chrome storage', async () => {
      const config = { filterEnabled: false };
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);

      await saveFilterConfig(config);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(config);
    });

    it('should handle save errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Save error');
      (chrome.storage.sync.set as jest.Mock).mockRejectedValue(error);

      await expect(saveFilterConfig({ filterEnabled: true })).rejects.toThrow('Save error');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveErrorLog', () => {
    it('should save truncated error log', async () => {
      const errorLog = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          message: 'A'.repeat(150), // Long message
          context: 'Test context'
        }
      ];

      (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

      await saveErrorLog(errorLog);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        errorLog: [{
          timestamp: '2024-01-01T00:00:00.000Z',
          message: 'A'.repeat(100), // Truncated to 100 chars
          context: 'Test context'
        }]
      });
    });

    it('should handle save errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (chrome.storage.local.set as jest.Mock).mockRejectedValue(new Error('Save error'));

      await saveErrorLog([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
