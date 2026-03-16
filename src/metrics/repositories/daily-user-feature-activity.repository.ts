import { Injectable } from '@nestjs/common';
import { Prisma } from '../../@generated/prisma-client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDailyUserFeatureActivityRecord } from '../models/create-daily-user-feature-activity-record.model';
import { DailyActivityAggregate } from '../models/daily-activity-aggregate.model';
import { FindActivitiesFilters } from '../models/find-activities-filters.model';

@Injectable()
export class DailyUserFeatureActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertActivity(
    tx: Prisma.TransactionClient,
    data: CreateDailyUserFeatureActivityRecord,
  ) {
    return tx.dailyUserFeatureActivity.upsert({
      where: {
        companyId_feature_userId_activityDayUtc: {
          companyId: data.companyId,
          feature: data.feature,
          userId: data.userId,
          activityDayUtc: data.activityDayUtc,
        },
      },
      create: data,
      update: {},
    });
  }

  async findEarliestActivityDay(): Promise<Date | null> {
    const result = await this.prisma.dailyUserFeatureActivity.aggregate({
      _min: {
        activityDayUtc: true,
      },
    });

    return result._min.activityDayUtc ?? null;
  }

  async groupByDay(activityDayUtc: Date): Promise<DailyActivityAggregate[]> {
    const rows = await this.prisma.dailyUserFeatureActivity.groupBy({
      by: ['companyId', 'feature', 'activityDayUtc'],
      where: {
        activityDayUtc,
      },
      _count: {
        _all: true,
      },
    });

    return rows.map((row) => ({
      companyId: row.companyId,
      feature: row.feature,
      activityDayUtc: row.activityDayUtc,
      dau: row._count._all,
    }));
  }

  async findActivitiesInRange(filters: FindActivitiesFilters) {
    return this.prisma.dailyUserFeatureActivity.findMany({
      where: {
        activityDayUtc: {
          gte: filters.fromDay,
          lte: filters.toDay,
        },
        companyId: filters.companyId,
        feature: filters.feature,
      },
      select: {
        companyId: true,
        feature: true,
        userId: true,
        activityDayUtc: true,
      },
    });
  }

  async countAll(): Promise<number> {
    return this.prisma.dailyUserFeatureActivity.count();
  }

  async countForDay(
    companyId: string,
    feature: string,
    activityDayUtc: Date,
  ): Promise<number> {
    return this.prisma.dailyUserFeatureActivity.count({
      where: {
        companyId,
        feature,
        activityDayUtc,
      },
    });
  }
}
