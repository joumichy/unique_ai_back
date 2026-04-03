import { DailyActiveUserMetric } from './daily-active-user-metric';
import { WeeklyActiveUserMetric } from './weekly-active-user-metric';

export interface FeatureUsageMetricsResult {
  dailyActiveUsers: DailyActiveUserMetric[];
  weeklyActiveUsers: WeeklyActiveUserMetric[];
}
