import { RedlockService } from '@anchan828/nest-redlock';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DAU_AGGREGATION_JOB_KEY,
  DAU_AGGREGATION_LOCK_DURATION_MS,
  DAU_AGGREGATION_LOCK_KEY,
} from '../constants/dau-aggregation.constants';
import { DailyActiveUserMetricsRepository } from '../repositories/daily-active-user-metrics.repository';
import { DailyUserFeatureActivityRepository } from '../repositories/daily-user-feature-activity.repository';
import { MetricsAggregationCheckpointsRepository } from '../repositories/metrics-aggregation-checkpoints.repository';
import { addUtcDays, startOfUtcDay, toUtcDateString } from '../utils/utc-date.util';

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
    await this.prisma.$transaction(async (tx) => {
      await this.dailyActiveUserMetricsRepository.upsertMetricsForDay(
        tx,
        activityDayUtc,
      );

      await this.metricsAggregationCheckpointsRepository.upsertLastAggregatedDay(
        tx,
        DAU_AGGREGATION_JOB_KEY,
        activityDayUtc,
      );
    });

    this.logger.log(
      `Aggregated DAU buckets for ${toUtcDateString(activityDayUtc)}`,
    );
  }
}
