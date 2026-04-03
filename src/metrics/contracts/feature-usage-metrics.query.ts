export interface FeatureUsageMetricsQuery {
  fromDay: Date;
  toDay: Date;
  companyId?: string;
  feature?: string;
}
