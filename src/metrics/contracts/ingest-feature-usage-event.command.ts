export interface IngestFeatureUsageEventCommand {
  eventId: string;
  userId: string;
  feature: string;
  occurredAt: Date;
}
