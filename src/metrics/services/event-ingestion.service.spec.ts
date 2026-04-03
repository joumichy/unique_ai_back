import { ConflictException, NotFoundException } from '@nestjs/common';
import { IngestFeatureUsageEventCommand } from '../contracts/ingest-feature-usage-event.command';
import { DailyUserFeatureActivityRepository } from '../repositories/daily-user-feature-activity.repository';
import { FeatureUsageEventsRepository } from '../repositories/feature-usage-events.repository';
import { UsersRepository } from '../repositories/users.repository';
import { EventIngestionService } from './event-ingestion.service';

describe('EventIngestionService', () => {
  let transactionClient: object;

  let service: EventIngestionService;
  let prisma: { $transaction: jest.Mock };
  let usersRepository: jest.Mocked<UsersRepository>;
  let featureUsageEventsRepository: jest.Mocked<FeatureUsageEventsRepository>;
  let dailyUserFeatureActivityRepository: jest.Mocked<DailyUserFeatureActivityRepository>;

  beforeEach(() => {
    transactionClient = {};
    prisma = {
      $transaction: jest.fn(async (callback) => callback(transactionClient)),
    };
    usersRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    featureUsageEventsRepository = {
      createIfAbsent: jest.fn(),
    } as unknown as jest.Mocked<FeatureUsageEventsRepository>;
    dailyUserFeatureActivityRepository = {
      upsertActivity: jest.fn(),
    } as unknown as jest.Mocked<DailyUserFeatureActivityRepository>;

    service = new EventIngestionService(
      prisma as never,
      usersRepository,
      featureUsageEventsRepository,
      dailyUserFeatureActivityRepository,
    );
  });

  it('stores a new event and deduplicated daily activity (expected: event saved and activity upserted)', async () => {
    const input: IngestFeatureUsageEventCommand = {
      eventId: 'evt_1',
      userId: 'user_1',
      feature: 'chat_send_message',
      occurredAt: new Date('2026-03-15T10:21:33.000Z'),
    };

    usersRepository.findById.mockResolvedValue({
      id: 'user_1',
      companyId: 'company_1',
      email: 'user@example.com',
    });
    featureUsageEventsRepository.createIfAbsent.mockResolvedValue(true);
    dailyUserFeatureActivityRepository.upsertActivity.mockResolvedValue(true);

    const result = await service.ingest(input);

    expect(result).toEqual({
      eventId: 'evt_1',
      occurredDayUtc: new Date('2026-03-15T00:00:00.000Z'),
    });
    expect(featureUsageEventsRepository.createIfAbsent).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        eventId: 'evt_1',
        userId: 'user_1',
        companyId: 'company_1',
        feature: 'chat_send_message',
        occurredDayUtc: new Date('2026-03-15T00:00:00.000Z'),
      }),
    );
    expect(dailyUserFeatureActivityRepository.upsertActivity).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        userId: 'user_1',
        companyId: 'company_1',
        feature: 'chat_send_message',
        activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
      }),
    );
  });

  it('accepts multiple same-day events for the same user without failing the ingestion flow (expected: deduplicated activity write)', async () => {
    const input: IngestFeatureUsageEventCommand = {
      eventId: 'evt_repeat_day',
      userId: 'user_1',
      feature: 'chat_send_message',
      occurredAt: new Date('2026-03-15T10:21:33.000Z'),
    };

    usersRepository.findById.mockResolvedValue({
      id: 'user_1',
      companyId: 'company_1',
      email: 'user@example.com',
    });
    featureUsageEventsRepository.createIfAbsent.mockResolvedValue(true);
    dailyUserFeatureActivityRepository.upsertActivity.mockResolvedValue(false);

    await service.ingest(input);

    expect(dailyUserFeatureActivityRepository.upsertActivity).toHaveBeenCalled();
  });

  it('rejects duplicate event ids and does not write daily activity (expected: ConflictException and no downstream writes)', async () => {
    const input: IngestFeatureUsageEventCommand = {
      eventId: 'evt_2',
      userId: 'user_1',
      feature: 'chat_send_message',
      occurredAt: new Date('2026-03-15T10:21:33.000Z'),
    };

    usersRepository.findById.mockResolvedValue({
      id: 'user_1',
      companyId: 'company_1',
      email: 'user@example.com',
    });
    featureUsageEventsRepository.createIfAbsent.mockResolvedValue(false);

    await expect(service.ingest(input)).rejects.toBeInstanceOf(ConflictException);
    expect(dailyUserFeatureActivityRepository.upsertActivity).not.toHaveBeenCalled();
  });

  it('rejects unknown users (expected: NotFoundException)', async () => {
    usersRepository.findById.mockResolvedValue(null);

    await expect(
      service.ingest({
        eventId: 'evt_3',
        userId: 'missing-user',
        feature: 'chat_send_message',
        occurredAt: new Date('2026-03-15T10:21:33.000Z'),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
