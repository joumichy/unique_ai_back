import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import cuid from 'cuid';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidatedCreateEventDto } from '../dto/validated-create-event.dto';
import { DailyActiveUserMetricsRepository } from '../repositories/daily-active-user-metrics.repository';
import { DailyUserFeatureActivityRepository } from '../repositories/daily-user-feature-activity.repository';
import { FeatureUsageEventsRepository } from '../repositories/feature-usage-events.repository';
import { UsersRepository } from '../repositories/users.repository';
import { startOfUtcDay } from '../utils/utc-date.util';

export interface IngestEventResult {
  eventId: string;
  occurredDayUtc: Date;
}

@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly featureUsageEventsRepository: FeatureUsageEventsRepository,
    private readonly dailyUserFeatureActivityRepository: DailyUserFeatureActivityRepository,
    private readonly dailyActiveUserMetricsRepository: DailyActiveUserMetricsRepository,
  ) {}

  async ingest(input: ValidatedCreateEventDto): Promise<IngestEventResult> {
    const user = await this.usersRepository.findById(input.userId);

    if (!user) {
      throw new NotFoundException(`Unknown user_id: ${input.userId}`);
    }

    const occurredDayUtc = startOfUtcDay(input.occurredAt);
    await this.prisma.$transaction(async (tx) => {
      const inserted = await this.featureUsageEventsRepository.createIfAbsent(tx, {
        id: cuid(),
        eventId: input.eventId,
        userId: input.userId,
        companyId: user.companyId,
        feature: input.feature,
        occurredAt: input.occurredAt,
        occurredDayUtc,
      });

      if (!inserted) {
        throw new ConflictException(`event_id already exists: ${input.eventId}`);
      }

      await this.dailyUserFeatureActivityRepository.upsertActivity(tx, {
        id: cuid(),
        userId: input.userId,
        companyId: user.companyId,
        feature: input.feature,
        activityDayUtc: occurredDayUtc,
      });

      await this.dailyActiveUserMetricsRepository.incrementMetric(tx, {
        id: cuid(),
        companyId: user.companyId,
        feature: input.feature,
        metricDayUtc: occurredDayUtc,
        incrementBy: 1,
      });

    });

    this.logger.log(`Stored feature usage event ${input.eventId}`);

    return {
      eventId: input.eventId,
      occurredDayUtc,
    };
  }
}
