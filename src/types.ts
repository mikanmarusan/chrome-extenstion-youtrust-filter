export interface FilterConfig {
  filterEnabled: boolean;
  filteredCompanies: string[];
}

export interface PerformanceMetrics {
  totalProcessed: number;
  totalFiltered: number;
  processingTime: number[];
  lastReportTime: number;
}

export interface ErrorLogEntry {
  timestamp: string;
  message: string;
  context: string;
  stack?: string;
  url?: string;
}

export interface Selectors {
  /** ページごとに解決されるカードコンテナのセレクター */
  card: string;
  /** カード内の企業名要素のセレクター */
  companyName: string;
}

export type NotificationType = 'error' | 'success' | 'info';
