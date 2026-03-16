export interface CreateFeatureUsageEventRecord {
  id: string;
  eventId: string;
  userId: string;
  companyId: string;
  feature: string;
  occurredAt: Date;
  occurredDayUtc: Date;
}
