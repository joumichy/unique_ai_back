import { Injectable } from '@nestjs/common';
import { Prisma } from '../../@generated/prisma-client';
import { PrismaService } from '../../prisma/prisma.service';
import { FindDailyActiveUserMetricsFilters } from '../models/find-daily-active-user-metrics-filters.model';
import { IncrementDailyActiveUserMetricRecord } from '../models/increment-daily-active-user-metric-record.model';
import { UpsertDailyActiveUserMetricRecord } from '../models/upsert-daily-active-user-metric-record.model';

@Injectable()
export class DailyActiveUserMetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMetric(
    tx: Prisma.TransactionClient,
    data: UpsertDailyActiveUserMetricRecord,
  ) {
    return tx.dailyActiveUserMetric.upsert({
      where: {
        companyId_feature_metricDayUtc: {
          companyId: data.companyId,
          feature: data.feature,
          metricDayUtc: data.metricDayUtc,
        },
      },
      create: data,
      update: {
        dau: data.dau,
      },
    });
  }

  async incrementMetric(
    tx: Prisma.TransactionClient,
    data: IncrementDailyActiveUserMetricRecord,
  ) {
    return tx.dailyActiveUserMetric.upsert({
      where: {
        companyId_feature_metricDayUtc: {
          companyId: data.companyId,
          feature: data.feature,
          metricDayUtc: data.metricDayUtc,
        },
      },
      create: {
        id: data.id,
        companyId: data.companyId,
        feature: data.feature,
        metricDayUtc: data.metricDayUtc,
        dau: data.incrementBy,
      },
      update: {
        dau: { increment: data.incrementBy },
      },
    });
  }

  async findMany(filters: FindDailyActiveUserMetricsFilters) {
    return this.prisma.dailyActiveUserMetric.findMany({
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

  async findUnique(companyId: string, feature: string, metricDayUtc: Date) {
    return this.prisma.dailyActiveUserMetric.findUnique({
      where: {
        companyId_feature_metricDayUtc: {
          companyId,
          feature,
          metricDayUtc,
        },
      },
    });
  }
}
