import { Injectable } from '@nestjs/common';
import { DAU_AGGREGATION_JOB_KEY } from '../constants/dau-aggregation.constants';
import { DailyActiveUserMetric } from '../contracts/daily-active-user-metric';
import { FeatureUsageMetricsResult } from '../contracts/feature-usage-metrics.result';
import { FeatureUsageMetricsQuery } from '../contracts/feature-usage-metrics.query';
import { WeeklyActiveUserMetric } from '../contracts/weekly-active-user-metric';
import { DailyActiveUserMetricsRepository } from '../repositories/daily-active-user-metrics.repository';
import { DailyUserFeatureActivityRepository } from '../repositories/daily-user-feature-activity.repository';
import { MetricsAggregationCheckpointsRepository } from '../repositories/metrics-aggregation-checkpoints.repository';
import { toUtcDateString } from '../utils/utc-date.util';

@Injectable()
export class DauQueryService {
  constructor(
    private readonly dailyActiveUserMetricsRepository: DailyActiveUserMetricsRepository,
    private readonly dailyUserFeatureActivityRepository: DailyUserFeatureActivityRepository,
    private readonly metricsAggregationCheckpointsRepository: MetricsAggregationCheckpointsRepository,
  ) {}

  async getDailyActiveUsers(
    query: FeatureUsageMetricsQuery,
  ): Promise<DailyActiveUserMetric[]> {
    const checkpoint =
      await this.metricsAggregationCheckpointsRepository.findByJobKey(
        DAU_AGGREGATION_JOB_KEY,
      );
    const [persistedRows, liveRows] = await Promise.all([
      checkpoint && checkpoint.lastAggregatedDayUtc.getTime() >= query.fromDay.getTime()
        ? this.dailyActiveUserMetricsRepository.findMany({
            fromDay: query.fromDay,
            toDay: this.minUtcDay(query.toDay, checkpoint.lastAggregatedDayUtc),
            companyId: query.companyId,
            feature: query.feature,
          })
        : Promise.resolve([]),
      this.dailyUserFeatureActivityRepository.findDailyActiveUsersInRange({
        fromDay: query.fromDay,
        toDay: query.toDay,
        companyId: query.companyId,
        feature: query.feature,
      }),
    ]);

    const metricsByBucketKey = new Map<string, DailyActiveUserMetric>();

    for (const row of persistedRows) {
      const metric = this.toDailyMetricFromPersistedRow(row);
      metricsByBucketKey.set(this.toDailyBucketKey(metric), metric);
    }

    // Live activity must override materialized DAU so late-arriving events are visible
    // immediately, even when the aggregation checkpoint has already passed that day.
    for (const row of liveRows) {
      const metric = this.toDailyMetricFromLiveAggregate(row);
      metricsByBucketKey.set(this.toDailyBucketKey(metric), metric);
    }

    return Array.from(metricsByBucketKey.values()).sort(
      (left, right) =>
        left.dayUtc.localeCompare(right.dayUtc) ||
        left.companyId.localeCompare(right.companyId) ||
        left.feature.localeCompare(right.feature),
    );
  }

  async getWeeklyActiveUsers(
    query: FeatureUsageMetricsQuery,
  ): Promise<WeeklyActiveUserMetric[]> {
    const weeklyRows =
      await this.dailyUserFeatureActivityRepository.findWeeklyActiveUsersInRange({
        fromDay: query.fromDay,
        toDay: query.toDay,
        companyId: query.companyId,
        feature: query.feature,
      });

    return weeklyRows.map((row) => ({
      companyId: row.companyId,
      feature: row.feature,
      activeUsers: row.activeUsers,
      isoWeek: row.isoWeek,
    }));
  }

  async getFeatureUsageMetrics(
    query: FeatureUsageMetricsQuery,
  ): Promise<FeatureUsageMetricsResult> {
    const [dailyActiveUsers, weeklyActiveUsers] = await Promise.all([
      this.getDailyActiveUsers(query),
      this.getWeeklyActiveUsers(query),
    ]);

    return {
      dailyActiveUsers,
      weeklyActiveUsers,
    };
  }

  private minUtcDay(left: Date, right: Date): Date {
    return left.getTime() <= right.getTime() ? left : right;
  }

  private toDailyMetricFromPersistedRow(row: {
    companyId: string;
    feature: string;
    metricDayUtc: Date;
    dau: number;
  }): DailyActiveUserMetric {
    return {
      companyId: row.companyId,
      feature: row.feature,
      activeUsers: row.dau,
      dayUtc: toUtcDateString(row.metricDayUtc),
    };
  }

  private toDailyMetricFromLiveAggregate(row: {
    companyId: string;
    feature: string;
    activityDayUtc: Date;
    activeUsers: number;
  }): DailyActiveUserMetric {
    return {
      companyId: row.companyId,
      feature: row.feature,
      activeUsers: row.activeUsers,
      dayUtc: toUtcDateString(row.activityDayUtc),
    };
  }

  private toDailyBucketKey(metric: DailyActiveUserMetric): string {
    return `${metric.companyId}|${metric.feature}|${metric.dayUtc}`;
  }
}
