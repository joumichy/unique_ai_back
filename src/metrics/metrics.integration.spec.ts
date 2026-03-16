import { FakeRedlockService, RedlockService } from '@anchan828/nest-redlock';
import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsModule } from './metrics.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { DauAggregationService } from './services/dau-aggregation.service';

@Global()
@Module({
  providers: [{ provide: RedlockService, useClass: FakeRedlockService }],
  exports: [RedlockService],
})
class TestRedlockModule {}

describe('Metrics integration', () => {
  const testCompanyId = 'company_test_metrics';
  const testUserOneId = 'user_test_metrics_1';
  const testUserTwoId = 'user_test_metrics_2';

  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let dauAggregationService: DauAggregationService;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/backend';
    process.env.DATABASE_CONNECTION_POOL_LIMIT ??= '5';
    process.env.REDIS_HOST ??= 'localhost';
    process.env.REDIS_PORT ??= '6379';
    process.env.REDIS_DB ??= '0';

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env'],
        }),
        TestRedlockModule,
        PrismaModule,
        MetricsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);

    prisma = app.get(PrismaService);
    dauAggregationService = app.get(DauAggregationService);

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }

    if (app) {
      await app.close();
    }

    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    await prisma.metricsAggregationCheckpoint.deleteMany({});
    await prisma.dailyActiveUserMetric.deleteMany({});
    await prisma.dailyUserFeatureActivity.deleteMany({});
    await prisma.featureUsageEvent.deleteMany({});
    await prisma.assistant.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.user.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.company.deleteMany({ where: { id: testCompanyId } });

    await prisma.company.create({
      data: {
        id: testCompanyId,
        name: 'Metrics Test Company',
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: testUserOneId,
          email: 'metrics-user-1@example.com',
          companyId: testCompanyId,
        },
        {
          id: testUserTwoId,
          email: 'metrics-user-2@example.com',
          companyId: testCompanyId,
        },
      ],
    });
  });

  it('persists raw events and daily activity through POST /events (expected: 201 and single persisted event/activity row)', async () => {
    const response = await postEvent({
      event_id: 'evt_integration_1',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T10:21:33Z',
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      event_id: 'evt_integration_1',
      feature: 'chat_send_message',
      metric_key: 'DAU-chat_send_message',
      occurred_day_utc: '2026-03-15',
    });
    expect(
      await prisma.featureUsageEvent.count({
        where: { eventId: 'evt_integration_1' },
      }),
    ).toBe(1);
    expect(
      await prisma.dailyUserFeatureActivity.count({
        where: {
          companyId: testCompanyId,
          userId: testUserOneId,
          feature: 'chat_send_message',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
      }),
    ).toBe(1);
  });

  it('rejects repeated event_id values as conflicts (expected: 409 and no extra persisted rows)', async () => {
    await postEvent({
      event_id: 'evt_integration_duplicate',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T10:21:33Z',
    });

    const response = await postEvent({
      event_id: 'evt_integration_duplicate',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T10:21:33Z',
    });

    expect(response.status).toBe(409);
    expect(
      await prisma.featureUsageEvent.count({
        where: { eventId: 'evt_integration_duplicate' },
      }),
    ).toBe(1);
    expect(await prisma.dailyUserFeatureActivity.count()).toBe(1);
  });

  it('handles concurrent duplicate submissions without double counting (expected: one 201, one 409, DAU incremented once)', async () => {
    const payload = {
      event_id: 'evt_integration_concurrent_duplicate',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T10:21:33Z',
    };

    const [first, second] = await Promise.all([postEvent(payload), postEvent(payload)]);

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);
    expect(
      await prisma.featureUsageEvent.count({
        where: { eventId: payload.event_id },
      }),
    ).toBe(1);
    expect(
      await prisma.dailyUserFeatureActivity.count({
        where: {
          companyId: testCompanyId,
          userId: testUserOneId,
          feature: 'chat_send_message',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
      }),
    ).toBe(1);
    await expect(
      prisma.dailyActiveUserMetric.findUnique({
        where: {
          companyId_feature_metricDayUtc: {
            companyId: testCompanyId,
            feature: 'chat_send_message',
            metricDayUtc: new Date('2026-03-15T00:00:00.000Z'),
          },
        },
      }),
    ).resolves.toMatchObject({ dau: 1 });
  });

  it('aggregates previous-day DAU from stored activity (expected: processedDays=1 and DAU=2)', async () => {
    await postEvent({
      event_id: 'evt_aggregate_1',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T08:00:00Z',
    });
    await postEvent({
      event_id: 'evt_aggregate_2',
      user_id: testUserTwoId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T09:00:00Z',
    });

    const result = await dauAggregationService.runOnce(
      new Date('2026-03-16T12:00:00.000Z'),
    );

    expect(result).toEqual({
      processedDays: 1,
      lastAggregatedDayUtc: '2026-03-15',
    });
    await expect(
      prisma.dailyActiveUserMetric.findUnique({
        where: {
          companyId_feature_metricDayUtc: {
            companyId: testCompanyId,
            feature: 'chat_send_message',
            metricDayUtc: new Date('2026-03-15T00:00:00.000Z'),
          },
        },
      }),
    ).resolves.toMatchObject({
      companyId: testCompanyId,
      feature: 'chat_send_message',
      dau: 2,
    });
  });

  it('returns aggregated DAU buckets through GET /metrics/dau (expected: only daily DAU buckets)', async () => {
    await postEvent({
      event_id: 'evt_query_1',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-14T08:00:00Z',
    });
    await postEvent({
      event_id: 'evt_query_2',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T09:00:00Z',
    });
    await postEvent({
      event_id: 'evt_query_3',
      user_id: testUserTwoId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T10:00:00Z',
    });

    await dauAggregationService.runOnce(new Date('2026-03-16T12:00:00.000Z'));

    const response = await fetch(
      `${baseUrl}/metrics/dau?from=2026-03-14&to=2026-03-15&company_id=${testCompanyId}&feature=chat_send_message`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        metric_key: 'DAU-chat_send_message',
        metric_value: 1,
        partition_timestamp: '2026-03-14',
      },
      {
        metric_key: 'DAU-chat_send_message',
        metric_value: 2,
        partition_timestamp: '2026-03-15',
      },
    ]);
  });

  it('returns aggregated WAU buckets through GET /metrics/wau (expected: only weekly WAU buckets)', async () => {
    await postEvent({
      event_id: 'evt_wau_query_1',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-14T08:00:00Z',
    });
    await postEvent({
      event_id: 'evt_wau_query_2',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T09:00:00Z',
    });
    await postEvent({
      event_id: 'evt_wau_query_3',
      user_id: testUserTwoId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T10:00:00Z',
    });

    const response = await fetch(
      `${baseUrl}/metrics/wau?from=2026-03-14&to=2026-03-15&company_id=${testCompanyId}&feature=chat_send_message`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        metric_key: 'WAU-chat_send_message',
        metric_value: 2,
        partition_timestamp: '2026_wk11',
      },
    ]);
  });

  it('returns aggregated DAU and WAU buckets through GET /metrics (expected: combined DAU+WAU response)', async () => {
    await postEvent({
      event_id: 'evt_mix_query_1',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-14T08:00:00Z',
    });
    await postEvent({
      event_id: 'evt_mix_query_2',
      user_id: testUserOneId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T09:00:00Z',
    });
    await postEvent({
      event_id: 'evt_mix_query_3',
      user_id: testUserTwoId,
      feature: 'chat_send_message',
      timestamp: '2026-03-15T10:00:00Z',
    });

    await dauAggregationService.runOnce(new Date('2026-03-16T12:00:00.000Z'));

    const response = await fetch(
      `${baseUrl}/metrics?from=2026-03-14&to=2026-03-15&company_id=${testCompanyId}&feature=chat_send_message`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        metric_key: 'DAU-chat_send_message',
        metric_value: 1,
        partition_timestamp: '2026-03-14',
      },
      {
        metric_key: 'DAU-chat_send_message',
        metric_value: 2,
        partition_timestamp: '2026-03-15',
      },
      {
        metric_key: 'WAU-chat_send_message',
        metric_value: 2,
        partition_timestamp: '2026_wk11',
      },
    ]);
  });

  async function postEvent(payload: {
    event_id: string;
    user_id: string;
    feature: string;
    timestamp: string;
  }): Promise<Response> {
    return fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
});
