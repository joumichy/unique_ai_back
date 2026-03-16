export interface CreateDailyUserFeatureActivityRecord {
  id: string;
  userId: string;
  companyId: string;
  feature: string;
  activityDayUtc: Date;
}
