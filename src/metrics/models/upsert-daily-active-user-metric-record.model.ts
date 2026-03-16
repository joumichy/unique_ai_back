export interface UpsertDailyActiveUserMetricRecord {
  id: string;
  companyId: string;
  feature: string;
  metricDayUtc: Date;
  dau: number;
}
