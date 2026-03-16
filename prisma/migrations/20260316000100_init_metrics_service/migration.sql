-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assistant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureUsageEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "occurredDayUtc" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUserFeatureActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "activityDayUtc" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyUserFeatureActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActiveUserMetric" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "metricDayUtc" TIMESTAMP(3) NOT NULL,
    "dau" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActiveUserMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricsAggregationCheckpoint" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "lastAggregatedDayUtc" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricsAggregationCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Assistant_companyId_idx" ON "Assistant"("companyId");

-- CreateIndex
CREATE INDEX "Assistant_createdBy_idx" ON "Assistant"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsageEvent_eventId_key" ON "FeatureUsageEvent"("eventId");

-- CreateIndex
CREATE INDEX "FeatureUsageEvent_occurredDayUtc_companyId_feature_idx" ON "FeatureUsageEvent"("occurredDayUtc", "companyId", "feature");

-- CreateIndex
CREATE INDEX "FeatureUsageEvent_companyId_feature_occurredAt_idx" ON "FeatureUsageEvent"("companyId", "feature", "occurredAt");

-- CreateIndex
CREATE INDEX "DailyUserFeatureActivity_activityDayUtc_companyId_feature_idx" ON "DailyUserFeatureActivity"("activityDayUtc", "companyId", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUserFeatureActivity_companyId_feature_userId_activityD_key" ON "DailyUserFeatureActivity"("companyId", "feature", "userId", "activityDayUtc");

-- CreateIndex
CREATE INDEX "DailyActiveUserMetric_metricDayUtc_companyId_feature_idx" ON "DailyActiveUserMetric"("metricDayUtc", "companyId", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActiveUserMetric_companyId_feature_metricDayUtc_key" ON "DailyActiveUserMetric"("companyId", "feature", "metricDayUtc");

-- CreateIndex
CREATE UNIQUE INDEX "MetricsAggregationCheckpoint_jobKey_key" ON "MetricsAggregationCheckpoint"("jobKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureUsageEvent" ADD CONSTRAINT "FeatureUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureUsageEvent" ADD CONSTRAINT "FeatureUsageEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUserFeatureActivity" ADD CONSTRAINT "DailyUserFeatureActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUserFeatureActivity" ADD CONSTRAINT "DailyUserFeatureActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActiveUserMetric" ADD CONSTRAINT "DailyActiveUserMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

