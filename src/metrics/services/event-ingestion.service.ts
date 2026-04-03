import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import cuid from 'cuid';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestFeatureUsageEventCommand } from '../contracts/ingest-feature-usage-event.command';
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
  ) {}

  async ingest(input: IngestFeatureUsageEventCommand): Promise<IngestEventResult> {
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
    });

    this.logger.log(`Stored feature usage event ${input.eventId}`);

    return {
      eventId: input.eventId,
      occurredDayUtc,
    };
  }
}
