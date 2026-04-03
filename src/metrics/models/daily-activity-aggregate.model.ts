export interface DailyActivityAggregate {
  companyId: string;
  feature: string;
  activityDayUtc: Date;
  activeUsers: number;
}
