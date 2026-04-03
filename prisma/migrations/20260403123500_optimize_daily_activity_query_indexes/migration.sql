CREATE INDEX "DailyUserFeatureActivity_companyId_feature_activityDayUtc_userId_idx"
ON "DailyUserFeatureActivity"("companyId", "feature", "activityDayUtc", "userId");
