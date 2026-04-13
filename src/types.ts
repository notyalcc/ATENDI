export interface DemandLog {
  id: string;
  service: string;
  timestamp: string; // ISO 8601
}

export interface ButtonConfig {
  id: string;
  label: string;
}

export type Period = 'day' | 'week' | 'month' | 'year';
