import { DauQueryService } from './dau-query.service';

describe('DauQueryService', () => {
  it('maps persisted daily rows into DAU metrics when the requested range is fully aggregated (expected: typed daily metric buckets)', async () => {
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
      findDailyActiveUsersInRange: jest.fn().mockResolvedValue([]),
      findWeeklyActiveUsersInRange: jest.fn(),
    };
    const checkpointsRepository = {
      findByJobKey: jest.fn().mockResolvedValue({
        lastAggregatedDayUtc: new Date('2026-03-15T00:00:00.000Z'),
      }),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
      checkpointsRepository as never,
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
    expect(checkpointsRepository.findByJobKey).toHaveBeenCalledWith('dau:v1');
    expect(activityRepository.findDailyActiveUsersInRange).toHaveBeenCalledWith({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });
    expect(activityRepository.findWeeklyActiveUsersInRange).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        companyId: 'company_1',
        feature: 'chat_send_message',
        activeUsers: 1,
        dayUtc: '2026-03-14',
      },
      {
        companyId: 'company_1',
        feature: 'chat_send_message',
        activeUsers: 2,
        dayUtc: '2026-03-15',
      },
    ]);
  });

  it('falls back to live daily activity for non-aggregated days (expected: live grouped DAU buckets)', async () => {
    const dailyRepository = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const activityRepository = {
      findDailyActiveUsersInRange: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          activityDayUtc: new Date('2026-03-16T00:00:00.000Z'),
          activeUsers: 2,
        },
      ]),
      findWeeklyActiveUsersInRange: jest.fn(),
    };
    const checkpointsRepository = {
      findByJobKey: jest.fn().mockResolvedValue({
        lastAggregatedDayUtc: new Date('2026-03-15T00:00:00.000Z'),
      }),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
      checkpointsRepository as never,
    );

    const result = await service.getDailyActiveUsers({
      fromDay: new Date('2026-03-15T00:00:00.000Z'),
      toDay: new Date('2026-03-16T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });

    expect(dailyRepository.findMany).toHaveBeenCalledWith({
      fromDay: new Date('2026-03-15T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });
    expect(activityRepository.findDailyActiveUsersInRange).toHaveBeenCalledWith({
      fromDay: new Date('2026-03-15T00:00:00.000Z'),
      toDay: new Date('2026-03-16T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });
    expect(result).toEqual([
      {
        companyId: 'company_1',
        feature: 'chat_send_message',
        activeUsers: 2,
        dayUtc: '2026-03-16',
      },
    ]);
  });

  it('prefers live daily activity over persisted DAU for the same day (expected: backfilled day reflects latest raw activity)', async () => {
    const dailyRepository = {
      findMany: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          metricDayUtc: new Date('2026-03-15T00:00:00.000Z'),
          dau: 1,
        },
      ]),
    };
    const activityRepository = {
      findDailyActiveUsersInRange: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          activityDayUtc: new Date('2026-03-15T00:00:00.000Z'),
          activeUsers: 2,
        },
      ]),
      findWeeklyActiveUsersInRange: jest.fn(),
    };
    const checkpointsRepository = {
      findByJobKey: jest.fn().mockResolvedValue({
        lastAggregatedDayUtc: new Date('2026-03-16T00:00:00.000Z'),
      }),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
      checkpointsRepository as never,
    );

    const result = await service.getDailyActiveUsers({
      fromDay: new Date('2026-03-15T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });

    expect(result).toEqual([
      {
        companyId: 'company_1',
        feature: 'chat_send_message',
        activeUsers: 2,
        dayUtc: '2026-03-15',
      },
    ]);
  });

  it('maps weekly aggregates into WAU metrics (expected: typed weekly metric buckets)', async () => {
    const dailyRepository = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const activityRepository = {
      findDailyActiveUsersInRange: jest.fn(),
      findWeeklyActiveUsersInRange: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          isoWeek: '2026_wk11',
          activeUsers: 2,
        },
      ]),
    };
    const checkpointsRepository = {
      findByJobKey: jest.fn(),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
      checkpointsRepository as never,
    );

    const result = await service.getWeeklyActiveUsers({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });

    expect(dailyRepository.findMany).not.toHaveBeenCalled();
    expect(activityRepository.findWeeklyActiveUsersInRange).toHaveBeenCalledWith({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });
    expect(result).toEqual([
      {
        companyId: 'company_1',
        feature: 'chat_send_message',
        activeUsers: 2,
        isoWeek: '2026_wk11',
      },
    ]);
  });

  it('combines DAU and WAU metrics in one response (expected: structured metrics payload)', async () => {
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
      findDailyActiveUsersInRange: jest.fn().mockResolvedValue([]),
      findWeeklyActiveUsersInRange: jest.fn().mockResolvedValue([
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          isoWeek: '2026_wk11',
          activeUsers: 2,
        },
      ]),
    };
    const checkpointsRepository = {
      findByJobKey: jest.fn().mockResolvedValue({
        lastAggregatedDayUtc: new Date('2026-03-15T00:00:00.000Z'),
      }),
    };
    const service = new DauQueryService(
      dailyRepository as never,
      activityRepository as never,
      checkpointsRepository as never,
    );

    const result = await service.getFeatureUsageMetrics({
      fromDay: new Date('2026-03-14T00:00:00.000Z'),
      toDay: new Date('2026-03-15T00:00:00.000Z'),
      companyId: 'company_1',
      feature: 'chat_send_message',
    });

    expect(result).toEqual({
      dailyActiveUsers: [
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          activeUsers: 2,
          dayUtc: '2026-03-15',
        },
      ],
      weeklyActiveUsers: [
        {
          companyId: 'company_1',
          feature: 'chat_send_message',
          activeUsers: 2,
          isoWeek: '2026_wk11',
        },
      ],
    });
  });
});
