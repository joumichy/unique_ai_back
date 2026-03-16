import { Module } from '@nestjs/common';
import { EventsController } from './controllers/events.controller';
import { MetricsController } from './controllers/metrics.controller';
import { CreateEventDtoPipe } from './pipes/create-event-dto.pipe';
import { GetDauMetricsQueryPipe } from './pipes/get-dau-metrics-query.pipe';
import { DailyActiveUserMetricsRepository } from './repositories/daily-active-user-metrics.repository';
import { DailyUserFeatureActivityRepository } from './repositories/daily-user-feature-activity.repository';
import { FeatureUsageEventsRepository } from './repositories/feature-usage-events.repository';
import { MetricsAggregationCheckpointsRepository } from './repositories/metrics-aggregation-checkpoints.repository';
import { UsersRepository } from './repositories/users.repository';
import { DauAggregationScheduler } from './scheduler/dau-aggregation.scheduler';
import { DauAggregationService } from './services/dau-aggregation.service';
import { DauQueryService } from './services/dau-query.service';
import { EventIngestionService } from './services/event-ingestion.service';

@Module({
  controllers: [EventsController, MetricsController],
  providers: [
    CreateEventDtoPipe,
    GetDauMetricsQueryPipe,
    UsersRepository,
    FeatureUsageEventsRepository,
    DailyUserFeatureActivityRepository,
    DailyActiveUserMetricsRepository,
    MetricsAggregationCheckpointsRepository,
    EventIngestionService,
    DauAggregationService,
    DauAggregationScheduler,
    DauQueryService,
  ],
  exports: [EventIngestionService, DauAggregationService, DauQueryService],
})
export class MetricsModule {}
