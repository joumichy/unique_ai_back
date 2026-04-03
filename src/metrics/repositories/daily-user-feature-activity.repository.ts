import { Injectable } from '@nestjs/common';
import { Prisma } from '../../@generated/prisma-client';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureUsageMetricsQuery } from '../contracts/feature-usage-metrics.query';
import { CreateDailyUserFeatureActivityRecord } from '../models/create-daily-user-feature-activity-record.model';
import { DailyActivityAggregate } from '../models/daily-activity-aggregate.model';
import { WeeklyActiveUserAggregate } from '../models/weekly-active-user-aggregate.model';

@Injectable()
export class DailyUserFeatureActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records that the user was active for (company, feature, day).
   * Returns true when this is the first such activity for that tuple (new daily active user).
   * Returns false when the row already existed (same user reusing the feature the same UTC day).
   */
  async upsertActivity(
    tx: Prisma.TransactionClient,
    data: CreateDailyUserFeatureActivityRecord,
  ): Promise<boolean> {
    const result = await tx.dailyUserFeatureActivity.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count > 0;
  }

  async findEarliestActivityDay(): Promise<Date | null> {
    const firstActivity = await this.prisma.dailyUserFeatureActivity.findFirst({
      select: {
        activityDayUtc: true,
      },
      orderBy: {
        activityDayUtc: 'asc',
      },
    });

    return firstActivity?.activityDayUtc ?? null;
  }

  async findDailyActiveUsersInRange(
    query: FeatureUsageMetricsQuery,
  ): Promise<DailyActivityAggregate[]> {
    return this.prisma.$queryRaw<DailyActivityAggregate[]>(Prisma.sql`
      SELECT
        "companyId",
        feature,
        "activityDayUtc",
        COUNT(*)::int AS "activeUsers"
      FROM "DailyUserFeatureActivity"
      WHERE "activityDayUtc" >= ${query.fromDay}
        AND "activityDayUtc" <= ${query.toDay}
        ${this.buildScopeFilters(query)}
      GROUP BY "companyId", feature, "activityDayUtc"
      ORDER BY "activityDayUtc" ASC, "companyId" ASC, feature ASC
    `);
  }

  async findWeeklyActiveUsersInRange(
    query: FeatureUsageMetricsQuery,
  ): Promise<WeeklyActiveUserAggregate[]> {
    return this.prisma.$queryRaw<WeeklyActiveUserAggregate[]>(Prisma.sql`
      SELECT
        "companyId",
        feature,
        TO_CHAR("activityDayUtc", 'IYYY_"wk"IW') AS "isoWeek",
        COUNT(DISTINCT "userId")::int AS "activeUsers"
      FROM "DailyUserFeatureActivity"
      WHERE "activityDayUtc" >= ${query.fromDay}
        AND "activityDayUtc" <= ${query.toDay}
        ${this.buildScopeFilters(query)}
      GROUP BY "companyId", feature, TO_CHAR("activityDayUtc", 'IYYY_"wk"IW')
      ORDER BY "isoWeek" ASC, feature ASC, "companyId" ASC
    `);
  }

  private buildScopeFilters(query: FeatureUsageMetricsQuery) {
    const companyFilter = query.companyId
      ? Prisma.sql`AND "companyId" = ${query.companyId}`
      : Prisma.empty;
    const featureFilter = query.feature
      ? Prisma.sql`AND feature = ${query.feature}`
      : Prisma.empty;

    return Prisma.sql`${companyFilter} ${featureFilter}`;
  }
}
