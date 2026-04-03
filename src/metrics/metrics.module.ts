import { Module } from '@nestjs/common';
import { MetricsResolver } from './graphql/metrics.resolver';
import { DailyActiveUserMetricsRepository } from './repositories/daily-active-user-metrics.repository';
import { DailyUserFeatureActivityRepository } from './repositories/daily-user-feature-activity.repository';
import { FeatureUsageEventsRepository } from './repositories/feature-usage-events.repository';
import { MetricsAggregationCheckpointsRepository } from './repositories/metrics-aggregation-checkpoints.repository';
import { UsersRepository } from './repositories/users.repository';
import { DauAggregationScheduler } from './scheduler/dau-aggregation.scheduler';
import { DauAggregationService } from './services/dau-aggregation.service';
import { DauQueryService } from './services/dau-query.service';
import { EventIngestionService } from './services/event-ingestion.service';
import { MetricsInputValidatorService } from './services/metrics-input-validator.service';

@Module({
  providers: [
    UsersRepository,
    FeatureUsageEventsRepository,
    DailyUserFeatureActivityRepository,
    DailyActiveUserMetricsRepository,
    MetricsAggregationCheckpointsRepository,
    EventIngestionService,
    DauAggregationService,
    DauAggregationScheduler,
    DauQueryService,
    MetricsInputValidatorService,
    MetricsResolver,
  ],
  exports: [EventIngestionService, DauAggregationService, DauQueryService],
})
export class MetricsModule {}
