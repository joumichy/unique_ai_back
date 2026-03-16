import { Injectable } from '@nestjs/common';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { MetricItemDto } from '../dto/metric-item.dto';
import { ValidatedGetDauMetricsQueryDto } from '../dto/validated-get-dau-metrics-query.dto';
import { DailyActiveUserMetricsRepository } from '../repositories/daily-active-user-metrics.repository';
import { DailyUserFeatureActivityRepository } from '../repositories/daily-user-feature-activity.repository';
import { toUtcDateString } from '../utils/utc-date.util';

@Injectable()
export class DauQueryService {
  constructor(
    private readonly dailyActiveUserMetricsRepository: DailyActiveUserMetricsRepository,
    private readonly dailyUserFeatureActivityRepository: DailyUserFeatureActivityRepository,
  ) {}

  async getDailyActiveUsers(
    query: ValidatedGetDauMetricsQueryDto,
  ): Promise<MetricItemDto[]> {
    const dailyRows = await this.dailyActiveUserMetricsRepository.findMany({
      fromDay: query.fromDay,
      toDay: query.toDay,
      companyId: query.companyId,
      feature: query.feature,
    });

    return dailyRows.map((row) => ({
      metric_key: `DAU-${row.feature}`,
      metric_value: row.dau,
      partition_timestamp: toUtcDateString(row.metricDayUtc),
    }));
  }

  async getWeeklyActiveUsers(
    query: ValidatedGetDauMetricsQueryDto,
  ): Promise<MetricItemDto[]> {
    const activityRows =
      await this.dailyUserFeatureActivityRepository.findActivitiesInRange({
        fromDay: query.fromDay,
        toDay: query.toDay,
        companyId: query.companyId,
        feature: query.feature,
      });

    const weeklySets = new Map<string, Set<string>>();
    for (const row of activityRows) {
      const weekYear = getISOWeekYear(row.activityDayUtc);
      const weekNumber = getISOWeek(row.activityDayUtc).toString().padStart(2, '0');
      const partition = `${weekYear}_wk${weekNumber}`;
      const key = `${row.companyId}|${row.feature}|${partition}`;
      const users = weeklySets.get(key) ?? new Set<string>();
      users.add(row.userId);
      weeklySets.set(key, users);
    }

    const weeklyMetrics = Array.from(weeklySets.entries())
      .map(([key, users]) => {
        const [, feature, partition] = key.split('|');
        return {
          metric_key: `WAU-${feature}`,
          metric_value: users.size,
          partition_timestamp: partition,
        };
      })
      .sort((a, b) =>
        a.partition_timestamp.localeCompare(b.partition_timestamp) ||
        a.metric_key.localeCompare(b.metric_key),
      );
    return weeklyMetrics;
  }

  async getDailyAndWeeklyActiveUsers(
    query: ValidatedGetDauMetricsQueryDto,
  ): Promise<MetricItemDto[]> {
    const [dailyMetrics, weeklyMetrics] = await Promise.all([
      this.getDailyActiveUsers(query),
      this.getWeeklyActiveUsers(query),
    ]);

    return [...dailyMetrics, ...weeklyMetrics];
  }
}
