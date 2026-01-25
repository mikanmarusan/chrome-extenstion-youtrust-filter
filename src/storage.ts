import { FilterConfig } from './types';
import { DEFAULT_COMPANIES } from './utils';

// Chrome Storage API のラッパー関数
export async function loadFilterConfig(): Promise<FilterConfig> {
  try {
    const result = await chrome.storage.sync.get(['filterEnabled', 'filteredCompanies']);

    return {
      filterEnabled: result.filterEnabled !== undefined ? result.filterEnabled : true,
      filteredCompanies: result.filteredCompanies || DEFAULT_COMPANIES
    };
  } catch (error) {
    console.error('Failed to load filter config:', error);
    return {
      filterEnabled: true,
      filteredCompanies: DEFAULT_COMPANIES
    };
  }
}

export async function saveFilterConfig(config: Partial<FilterConfig>): Promise<void> {
  try {
    await chrome.storage.sync.set(config);
  } catch (error) {
    console.error('Failed to save filter config:', error);
    throw error;
  }
}

export async function saveErrorLog(errorLog: any[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      errorLog: errorLog.map(e => ({
        timestamp: e.timestamp,
        message: e.message.substring(0, 100),
        context: e.context
      }))
    });
  } catch (error) {
    console.error('Failed to save error log:', error);
  }
}
