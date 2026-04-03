import { Injectable } from '@nestjs/common';
import { Prisma } from '../../@generated/prisma-client';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureUsageMetricsQuery } from '../contracts/feature-usage-metrics.query';

@Injectable()
export class DailyActiveUserMetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMetricsForDay(
    tx: Prisma.TransactionClient,
    metricDayUtc: Date,
  ): Promise<number> {
    return tx.$executeRaw(Prisma.sql`
      INSERT INTO "DailyActiveUserMetric" (
        "id",
        "companyId",
        "feature",
        "metricDayUtc",
        "dau",
        "createdAt",
        "updatedAt"
      )
      SELECT
        md5("companyId" || '|' || feature || '|' || TO_CHAR("activityDayUtc", 'YYYY-MM-DD')),
        "companyId",
        feature,
        "activityDayUtc",
        COUNT(*)::int,
        NOW(),
        NOW()
      FROM "DailyUserFeatureActivity"
      WHERE "activityDayUtc" = ${metricDayUtc}
      GROUP BY "companyId", feature, "activityDayUtc"
      ON CONFLICT ("companyId", "feature", "metricDayUtc")
      DO UPDATE SET
        "dau" = EXCLUDED."dau",
        "updatedAt" = NOW()
    `);
  }

  async findMany(filters: FeatureUsageMetricsQuery) {
    return this.prisma.dailyActiveUserMetric.findMany({
      select: {
        companyId: true,
        feature: true,
        metricDayUtc: true,
        dau: true,
      },
      where: {
        metricDayUtc: {
          gte: filters.fromDay,
          lte: filters.toDay,
        },
        companyId: filters.companyId,
        feature: filters.feature,
      },
      orderBy: [{ metricDayUtc: 'asc' }, { companyId: 'asc' }, { feature: 'asc' }],
    });
  }
}
