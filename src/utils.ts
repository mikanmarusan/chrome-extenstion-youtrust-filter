import { ErrorLogEntry } from './types';

// デフォルトのフィルター企業
export const DEFAULT_COMPANIES = ['ラクスル株式会社'];

// エラーログ管理
const ERROR_LOG_MAX_SIZE = 30;

// エラーハンドリング関数
export function logError(error: Error | unknown, context = '', errorLog: ErrorLogEntry[] = []): ErrorLogEntry[] {
  const errorEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    context: context
  };

  const newLog = [...errorLog, errorEntry];

  // ログサイズ制限
  if (newLog.length > ERROR_LOG_MAX_SIZE) {
    return newLog.slice(-ERROR_LOG_MAX_SIZE);
  }

  // コンソールにも出力
  console.error(`[YOUTrust Filter Error] ${context}:`, error);

  return newLog;
}

// 企業名の重複チェック
export function isDuplicateCompany(companyName: string, companies: string[]): boolean {
  return companies.includes(companyName);
}

// 企業名のバリデーション
export function validateCompanyName(companyName: string): boolean {
  return companyName.trim().length > 0;
}

// フィルター数に応じたクラス名を返す
export function getCountClassName(count: number): string {
  if (count === 0) {
    return 'count-zero';
  } else if (count <= 5) {
    return 'count-few';
  } else {
    return 'count-many';
  }
}

// パフォーマンスメトリクスの計算
export function calculateMetrics(processingTimes: number[]): {
  avgTime: number;
  maxTime: number;
  minTime: number;
} {
  if (processingTimes.length === 0) {
    return { avgTime: 0, maxTime: 0, minTime: 0 };
  }

  const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
  const maxTime = Math.max(...processingTimes);
  const minTime = Math.min(...processingTimes);

  return { avgTime, maxTime, minTime };
}

// スロットリング処理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(func: T, interval: number): T {
  let lastCall = 0;
  let timeoutId: number | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= interval) {
      lastCall = now;
      func(...args);
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, interval - timeSinceLastCall) as unknown as number;
    }
  }) as T;
}
