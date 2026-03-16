import { RedlockService } from '@anchan828/nest-redlock';
import { Injectable, Logger } from '@nestjs/common';
import cuid from 'cuid';
import { Prisma } from '../../@generated/prisma-client';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyActivityAggregate } from '../models/daily-activity-aggregate.model';
import { DailyActiveUserMetricsRepository } from '../repositories/daily-active-user-metrics.repository';
import { DailyUserFeatureActivityRepository } from '../repositories/daily-user-feature-activity.repository';
import { MetricsAggregationCheckpointsRepository } from '../repositories/metrics-aggregation-checkpoints.repository';
import { addUtcDays, startOfUtcDay, toUtcDateString } from '../utils/utc-date.util';

const DAU_AGGREGATION_JOB_KEY = 'dau:v1';
const DAU_AGGREGATION_LOCK_KEY = 'metrics:dau:v1';
const DAU_AGGREGATION_LOCK_DURATION_MS = 60_000;

export interface DauAggregationRunResult {
  processedDays: number;
  lastAggregatedDayUtc?: string;
}

@Injectable()
export class DauAggregationService {
  private readonly logger = new Logger(DauAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redlock: RedlockService,
    private readonly dailyUserFeatureActivityRepository: DailyUserFeatureActivityRepository,
    private readonly dailyActiveUserMetricsRepository: DailyActiveUserMetricsRepository,
    private readonly metricsAggregationCheckpointsRepository: MetricsAggregationCheckpointsRepository,
  ) {}

  async runOnce(now = new Date()): Promise<DauAggregationRunResult> {
    return this.redlock.using(
      [DAU_AGGREGATION_LOCK_KEY],
      DAU_AGGREGATION_LOCK_DURATION_MS,
      async (signal) => {
        const lastCompletedDayUtc = addUtcDays(startOfUtcDay(now), -1);
        const checkpoint =
          await this.metricsAggregationCheckpointsRepository.findByJobKey(
            DAU_AGGREGATION_JOB_KEY,
          );
        const firstPendingDayUtc = checkpoint
          ? addUtcDays(checkpoint.lastAggregatedDayUtc, 1)
          : await this.dailyUserFeatureActivityRepository.findEarliestActivityDay();

        if (
          !firstPendingDayUtc ||
          firstPendingDayUtc.getTime() > lastCompletedDayUtc.getTime()
        ) {
          return { processedDays: 0 };
        }

        let currentDayUtc = startOfUtcDay(firstPendingDayUtc);
        let processedDays = 0;
        let lastAggregatedDayUtc: Date | undefined;

        while (currentDayUtc.getTime() <= lastCompletedDayUtc.getTime()) {
          if (signal.aborted) {
            throw signal.error ?? new Error('DAU aggregation lock was aborted');
          }

          await this.aggregateDay(currentDayUtc);
          processedDays += 1;
          lastAggregatedDayUtc = currentDayUtc;
          currentDayUtc = addUtcDays(currentDayUtc, 1);
        }

        return {
          processedDays,
          lastAggregatedDayUtc: lastAggregatedDayUtc
            ? toUtcDateString(lastAggregatedDayUtc)
            : undefined,
        };
      },
    );
  }

  private async aggregateDay(activityDayUtc: Date): Promise<void> {
    const aggregates =
      await this.dailyUserFeatureActivityRepository.groupByDay(activityDayUtc);

    await this.prisma.$transaction(async (tx) => {
      for (const aggregate of aggregates) {
        await this.writeAggregate(tx, aggregate);
      }

      await this.metricsAggregationCheckpointsRepository.upsertLastAggregatedDay(
        tx,
        DAU_AGGREGATION_JOB_KEY,
        activityDayUtc,
      );
    });

    this.logger.log(
      `Aggregated ${aggregates.length} DAU buckets for ${toUtcDateString(activityDayUtc)}`,
    );
  }

  private async writeAggregate(
    tx: Prisma.TransactionClient,
    aggregate: DailyActivityAggregate,
  ): Promise<void> {
    await this.dailyActiveUserMetricsRepository.upsertMetric(tx, {
      id: cuid(),
      companyId: aggregate.companyId,
      feature: aggregate.feature,
      metricDayUtc: aggregate.activityDayUtc,
      dau: aggregate.dau,
    });
  }
}
