export interface IncrementDailyActiveUserMetricRecord {
  id: string;
  companyId: string;
  feature: string;
  metricDayUtc: Date;
  incrementBy: number;
}
