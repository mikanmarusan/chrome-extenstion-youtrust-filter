import {
  DEFAULT_COMPANIES,
  logError,
  isDuplicateCompany,
  validateCompanyName,
  getCountClassName,
  calculateMetrics,
  throttle
} from '../utils';

describe('Utils', () => {
  describe('DEFAULT_COMPANIES', () => {
    it('should have default companies', () => {
      expect(DEFAULT_COMPANIES).toEqual(['ラクスル株式会社']);
    });
  });

  describe('logError', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log Error objects correctly', () => {
      const error = new Error('Test error');
      const result = logError(error, 'Test context');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Test error');
      expect(result[0].context).toBe('Test context');
      expect(result[0].timestamp).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log non-Error objects correctly', () => {
      const error = 'String error';
      const result = logError(error, 'Test context');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('String error');
    });

    it('should limit error log size', () => {
      let errorLog: any[] = [];
      // Add 35 errors (more than limit of 30)
      for (let i = 0; i < 35; i++) {
        errorLog = logError(new Error(`Error ${i}`), 'Test', errorLog);
      }

      expect(errorLog.length).toBeLessThanOrEqual(30);
    });
  });

  describe('isDuplicateCompany', () => {
    it('should return true for duplicate companies', () => {
      const companies = ['Company A', 'Company B'];
      expect(isDuplicateCompany('Company A', companies)).toBe(true);
    });

    it('should return false for non-duplicate companies', () => {
      const companies = ['Company A', 'Company B'];
      expect(isDuplicateCompany('Company C', companies)).toBe(false);
    });
  });

  describe('validateCompanyName', () => {
    it('should return true for valid company names', () => {
      expect(validateCompanyName('Valid Company')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(validateCompanyName('')).toBe(false);
      expect(validateCompanyName('   ')).toBe(false);
    });
  });

  describe('getCountClassName', () => {
    it('should return count-zero for 0', () => {
      expect(getCountClassName(0)).toBe('count-zero');
    });

    it('should return count-few for 1-5', () => {
      expect(getCountClassName(1)).toBe('count-few');
      expect(getCountClassName(3)).toBe('count-few');
      expect(getCountClassName(5)).toBe('count-few');
    });

    it('should return count-many for more than 5', () => {
      expect(getCountClassName(6)).toBe('count-many');
      expect(getCountClassName(10)).toBe('count-many');
    });
  });

  describe('calculateMetrics', () => {
    it('should return zeros for empty array', () => {
      const result = calculateMetrics([]);
      expect(result).toEqual({ avgTime: 0, maxTime: 0, minTime: 0 });
    });

    it('should calculate metrics correctly', () => {
      const times = [10, 20, 30, 40, 50];
      const result = calculateMetrics(times);

      expect(result.avgTime).toBe(30);
      expect(result.maxTime).toBe(50);
      expect(result.minTime).toBe(10);
    });

    it('should handle single value', () => {
      const result = calculateMetrics([25]);
      expect(result).toEqual({ avgTime: 25, maxTime: 25, minTime: 25 });
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      // Call multiple times quickly
      throttledFn();
      throttledFn();
      throttledFn();

      // Only first call should execute immediately
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Fast-forward time
      jest.advanceTimersByTime(100);

      // Last call should now execute
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments correctly', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('arg1', 'arg2');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});
