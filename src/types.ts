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
  primary: {
    gridItem: string;
    companyName: string;
    friendButton: string;
  };
  fallback: {
    gridItem: string[];
    companyName: string[];
  };
}

export type NotificationType = 'error' | 'success' | 'info';

// Currently unused but may be used in future
/*
export interface StatusIndicatorElements {
  container: HTMLDivElement | null;
  icon: HTMLSpanElement | null;
  text: HTMLSpanElement | null;
  count: HTMLSpanElement | null;
}
*/
