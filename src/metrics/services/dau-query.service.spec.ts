import { DauQueryService } from './dau-query.service';

describe('DauQueryService', () => {
  it('maps daily rows into DAU metrics (expected: DAU items only, no WAU query call)', async () => {
    const dailyRepository = {
      findMany: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          metricDayUtc: new Date('2026-03-14T00:00:00.000Z'),
          dau: 1,
        },
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          metricDayUtc: new Date('2026-03-15T00:00:00.000Z'),
          dau: 2,
        },
      ]),
    };
    const activityRepository = {
      findActivitiesInRange: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_1',
          activityDayUtc: new Date('2026-03-14T00:00:00.000Z'),
        },
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_1',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_2',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
      ]),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
    );

    const result = await service.getDailyActiveUsers({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });

    expect(dailyRepository.findMany).toHaveBeenCalledWith({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });
    expect(activityRepository.findActivitiesInRange).not.toHaveBeenCalled();
    expect(result).toEqual([
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

  it('maps activity rows into WAU metrics (expected: WAU items with distinct users per ISO week)', async () => {
    const dailyRepository = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const activityRepository = {
      findActivitiesInRange: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_1',
          activityDayUtc: new Date('2026-03-14T00:00:00.000Z'),
        },
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_1',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_2',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
      ]),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
    );

    const result = await service.getWeeklyActiveUsers({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });

    expect(dailyRepository.findMany).not.toHaveBeenCalled();
    expect(activityRepository.findActivitiesInRange).toHaveBeenCalledWith({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });
    expect(result).toEqual([
      {
        metric_key: 'WAU-chat_send_message',
        metric_value: 2,
        partition_timestamp: '2026_wk11',
      },
    ]);
  });

  it('combines DAU and WAU metrics in one response (expected: DAU first, then WAU)', async () => {
    const dailyRepository = {
      findMany: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          metricDayUtc: new Date('2026-03-15T00:00:00.000Z'),
          dau: 2,
        },
      ]),
    };
    const activityRepository = {
      findActivitiesInRange: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_1',
          activityDayUtc: new Date('2026-03-14T00:00:00.000Z'),
        },
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          userId: 'user_2',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
        },
      ]),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
    );

    const result = await service.getDailyAndWeeklyActiveUsers({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });

    expect(result).toEqual([
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
});
