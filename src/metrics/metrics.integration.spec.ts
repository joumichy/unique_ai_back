import { FakeRedlockService, RedlockService } from '@anchan828/nest-redlock';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { join } from 'node:path';
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
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/@generated/test-schema.graphql'),
          introspection: true,
          playground: false,
          path: '/graphql',
          context: ({ req }) => ({ req }),
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

  it('persists raw events and daily activity through GraphQL (expected: event and activity row persisted)', async () => {
    const response = await ingestEvent({
      eventId: 'evt_integration_1',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T10:21:33Z',
    });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({
      ingestFeatureUsageEvent: {
        eventId: 'evt_integration_1',
        userId: testUserOneId,
        feature: 'chat_send_message',
        occurredDayUtc: '2026-03-15',
      },
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

  it('rejects repeated event ids as GraphQL errors (expected: duplicate persisted once)', async () => {
    await ingestEvent({
      eventId: 'evt_integration_duplicate',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T10:21:33Z',
    });

    const response = await ingestEvent({
      eventId: 'evt_integration_duplicate',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T10:21:33Z',
    });

    expect(response.status).toBe(200);
    expect(response.body.errors?.[0]?.message).toContain(
      'event_id already exists: evt_integration_duplicate',
    );
    expect(
      await prisma.featureUsageEvent.count({
        where: { eventId: 'evt_integration_duplicate' },
      }),
    ).toBe(1);
    expect(await prisma.dailyUserFeatureActivity.count()).toBe(1);
  });

  it('handles concurrent duplicate submissions without double counting (expected: one success, one error, one activity row)', async () => {
    const payload = {
      eventId: 'evt_integration_concurrent_duplicate',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T10:21:33Z',
    };

    const [first, second] = await Promise.all([ingestEvent(payload), ingestEvent(payload)]);
    const successCount = [first.body, second.body].filter((body) => !body.errors).length;
    const errorCount = [first.body, second.body].filter((body) => body.errors).length;

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);
    expect(
      await prisma.featureUsageEvent.count({
        where: { eventId: payload.eventId },
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
      prisma.dailyActiveUserMetric.findMany({
        where: {
          companyId: testCompanyId,
          feature: 'chat_send_message',
          metricDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
      }),
    ).resolves.toHaveLength(0);
  });

  it('does not double-count DAU when the same user sends multiple events the same day (expected: live DAU query returns 1)', async () => {
    await ingestEvent({
      eventId: 'evt_same_user_day_1',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T08:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_same_user_day_2',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T18:00:00Z',
    });

    expect(
      await prisma.featureUsageEvent.count({
        where: { eventId: { in: ['evt_same_user_day_1', 'evt_same_user_day_2'] } },
      }),
    ).toBe(2);
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

    const response = await graphqlRequest(
      `
        query DailyActiveUserMetrics($input: FeatureUsageMetricsInput!) {
          dailyActiveUserMetrics(input: $input) {
            companyId
            feature
            activeUsers
            dayUtc
          }
        }
      `,
      {
        input: {
          from: '2026-03-15',
          to: '2026-03-15',
          companyId: testCompanyId,
          feature: 'chat_send_message',
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({
      dailyActiveUserMetrics: [
        {
          companyId: testCompanyId,
          feature: 'chat_send_message',
          activeUsers: 1,
          dayUtc: '2026-03-15',
        },
      ],
    });
  });

  it('aggregates previous-day DAU from stored activity (expected: processedDays=1 and DAU=2)', async () => {
    await ingestEvent({
      eventId: 'evt_aggregate_1',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T08:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_aggregate_2',
      userId: testUserTwoId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T09:00:00Z',
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

  it('returns aggregated DAU buckets through GraphQL (expected: daily buckets only)', async () => {
    await ingestEvent({
      eventId: 'evt_query_1',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-14T08:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_query_2',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T09:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_query_3',
      userId: testUserTwoId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T10:00:00Z',
    });

    await dauAggregationService.runOnce(new Date('2026-03-16T12:00:00.000Z'));

    const response = await graphqlRequest(
      `
        query DailyActiveUserMetrics($input: FeatureUsageMetricsInput!) {
          dailyActiveUserMetrics(input: $input) {
            companyId
            feature
            activeUsers
            dayUtc
          }
        }
      `,
      {
        input: {
          from: '2026-03-14',
          to: '2026-03-15',
          companyId: testCompanyId,
          feature: 'chat_send_message',
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({
      dailyActiveUserMetrics: [
        {
          companyId: testCompanyId,
          feature: 'chat_send_message',
          activeUsers: 1,
          dayUtc: '2026-03-14',
        },
        {
          companyId: testCompanyId,
          feature: 'chat_send_message',
          activeUsers: 2,
          dayUtc: '2026-03-15',
        },
      ],
    });
  });

  it('returns aggregated WAU buckets through GraphQL (expected: weekly buckets only)', async () => {
    await ingestEvent({
      eventId: 'evt_wau_query_1',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-14T08:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_wau_query_2',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T09:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_wau_query_3',
      userId: testUserTwoId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T10:00:00Z',
    });

    const response = await graphqlRequest(
      `
        query WeeklyActiveUserMetrics($input: FeatureUsageMetricsInput!) {
          weeklyActiveUserMetrics(input: $input) {
            companyId
            feature
            activeUsers
            isoWeek
          }
        }
      `,
      {
        input: {
          from: '2026-03-14',
          to: '2026-03-15',
          companyId: testCompanyId,
          feature: 'chat_send_message',
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({
      weeklyActiveUserMetrics: [
        {
          companyId: testCompanyId,
          feature: 'chat_send_message',
          activeUsers: 2,
          isoWeek: '2026_wk11',
        },
      ],
    });
  });

  it('returns live DAU for a late-arriving historical event even when the checkpoint already passed that day (expected: backfilled day is visible immediately)', async () => {
    await prisma.metricsAggregationCheckpoint.create({
      data: {
        jobKey: 'dau:v1',
        lastAggregatedDayUtc: new Date('2026-03-16T00:00:00.000Z'),
      },
    });

    await ingestEvent({
      eventId: 'evt_late_backfill_1',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T08:00:00Z',
    });

    const response = await graphqlRequest(
      `
        query DailyActiveUserMetrics($input: FeatureUsageMetricsInput!) {
          dailyActiveUserMetrics(input: $input) {
            companyId
            feature
            activeUsers
            dayUtc
          }
        }
      `,
      {
        input: {
          from: '2026-03-15',
          to: '2026-03-15',
          companyId: testCompanyId,
          feature: 'chat_send_message',
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({
      dailyActiveUserMetrics: [
        {
          companyId: testCompanyId,
          feature: 'chat_send_message',
          activeUsers: 1,
          dayUtc: '2026-03-15',
        },
      ],
    });
  });

  it('returns aggregated DAU and WAU buckets through GraphQL (expected: structured combined response)', async () => {
    await ingestEvent({
      eventId: 'evt_mix_query_1',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-14T08:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_mix_query_2',
      userId: testUserOneId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T09:00:00Z',
    });
    await ingestEvent({
      eventId: 'evt_mix_query_3',
      userId: testUserTwoId,
      feature: 'chat_send_message',
      occurredAt: '2026-03-15T10:00:00Z',
    });

    await dauAggregationService.runOnce(new Date('2026-03-16T12:00:00.000Z'));

    const response = await graphqlRequest(
      `
        query FeatureUsageMetrics($input: FeatureUsageMetricsInput!) {
          featureUsageMetrics(input: $input) {
            dailyActiveUsers {
              companyId
              feature
              activeUsers
              dayUtc
            }
            weeklyActiveUsers {
              companyId
              feature
              activeUsers
              isoWeek
            }
          }
        }
      `,
      {
        input: {
          from: '2026-03-14',
          to: '2026-03-15',
          companyId: testCompanyId,
          feature: 'chat_send_message',
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({
      featureUsageMetrics: {
        dailyActiveUsers: [
          {
            companyId: testCompanyId,
            feature: 'chat_send_message',
            activeUsers: 1,
            dayUtc: '2026-03-14',
          },
          {
            companyId: testCompanyId,
            feature: 'chat_send_message',
            activeUsers: 2,
            dayUtc: '2026-03-15',
          },
        ],
        weeklyActiveUsers: [
          {
            companyId: testCompanyId,
            feature: 'chat_send_message',
            activeUsers: 2,
            isoWeek: '2026_wk11',
          },
        ],
      },
    });
  });

  async function ingestEvent(payload: {
    eventId: string;
    userId: string;
    feature: string;
    occurredAt: string;
  }): Promise<{ status: number; body: Record<string, any> }> {
    return graphqlRequest(
      `
        mutation IngestFeatureUsageEvent($input: IngestFeatureUsageEventInput!) {
          ingestFeatureUsageEvent(input: $input) {
            eventId
            userId
            feature
            occurredDayUtc
          }
        }
      `,
      { input: payload },
    );
  }

  async function graphqlRequest(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, any> }> {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }
});
