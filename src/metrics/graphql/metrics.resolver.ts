import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FeatureUsageMetricsQuery } from '../contracts/feature-usage-metrics.query';
import { toUtcDateString } from '../utils/utc-date.util';
import { FeatureUsageMetricsInput } from './inputs/feature-usage-metrics.input';
import { IngestFeatureUsageEventInput } from './inputs/ingest-feature-usage-event.input';
import { DailyActiveUserBucketModel } from './models/daily-active-user-bucket.model';
import { FeatureUsageMetricsModel } from './models/feature-usage-metrics.model';
import { IngestFeatureUsageEventPayload } from './models/ingest-feature-usage-event.payload';
import { WeeklyActiveUserBucketModel } from './models/weekly-active-user-bucket.model';
import { DauQueryService } from '../services/dau-query.service';
import { EventIngestionService } from '../services/event-ingestion.service';
import { MetricsInputValidatorService } from '../services/metrics-input-validator.service';

interface AuthenticatedUser {
  id: string;
  companyId: string;
  email: string;
}

@Resolver()
export class MetricsResolver {
  constructor(
    private readonly metricsInputValidatorService: MetricsInputValidatorService,
    private readonly eventIngestionService: EventIngestionService,
    private readonly dauQueryService: DauQueryService,
  ) {}

  @Mutation(() => IngestFeatureUsageEventPayload)
  async ingestFeatureUsageEvent(
    @Args('input') input: IngestFeatureUsageEventInput,
  ): Promise<IngestFeatureUsageEventPayload> {
    const validated =
      this.metricsInputValidatorService.validateIngestFeatureUsageEvent(input);
    const result = await this.eventIngestionService.ingest(validated);

    return {
      eventId: result.eventId,
      userId: validated.userId,
      feature: validated.feature,
      occurredAt: validated.occurredAt,
      occurredDayUtc: toUtcDateString(result.occurredDayUtc),
    };
  }

  @Query(() => [DailyActiveUserBucketModel])
  async dailyActiveUserMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: FeatureUsageMetricsInput,
  ): Promise<DailyActiveUserBucketModel[]> {
    return this.dauQueryService.getDailyActiveUsers(
      this.validateMetricsQueryInput(input, user),
    );
  }

  @Query(() => [WeeklyActiveUserBucketModel])
  async weeklyActiveUserMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: FeatureUsageMetricsInput,
  ): Promise<WeeklyActiveUserBucketModel[]> {
    return this.dauQueryService.getWeeklyActiveUsers(
      this.validateMetricsQueryInput(input, user),
    );
  }

  @Query(() => FeatureUsageMetricsModel)
  async featureUsageMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: FeatureUsageMetricsInput,
  ): Promise<FeatureUsageMetricsModel> {
    return this.dauQueryService.getFeatureUsageMetrics(
      this.validateMetricsQueryInput(input, user),
    );
  }

  private validateMetricsQueryInput(
    input: FeatureUsageMetricsInput,
    user: AuthenticatedUser,
  ): FeatureUsageMetricsQuery {
    return this.metricsInputValidatorService.validateFeatureUsageMetrics(
      input,
      user.companyId,
    );
  }
}
