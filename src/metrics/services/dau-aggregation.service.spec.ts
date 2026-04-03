import { DauAggregationService } from './dau-aggregation.service';

describe('DauAggregationService', () => {
  const transactionClient = {} as never;

  let service: DauAggregationService;
  let prisma: { $transaction: jest.Mock };
  let redlock: { using: jest.Mock };
  let dailyUserFeatureActivityRepository: {
    findEarliestActivityDay: jest.Mock;
  };
  let dailyActiveUserMetricsRepository: { upsertMetricsForDay: jest.Mock };
  let metricsAggregationCheckpointsRepository: {
    findByJobKey: jest.Mock;
    upsertLastAggregatedDay: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback(transactionClient)),
    };
    redlock = {
      using: jest.fn(async (_keys, _duration, callback) =>
        callback({ aborted: false }),
      ),
    };
    dailyUserFeatureActivityRepository = {
      findEarliestActivityDay: jest.fn(),
    };
    dailyActiveUserMetricsRepository = {
      upsertMetricsForDay: jest.fn(),
    };
    metricsAggregationCheckpointsRepository = {
      findByJobKey: jest.fn(),
      upsertLastAggregatedDay: jest.fn(),
    };

    service = new DauAggregationService(
      prisma as never,
      redlock as never,
      dailyUserFeatureActivityRepository as never,
      dailyActiveUserMetricsRepository as never,
      metricsAggregationCheckpointsRepository as never,
    );
  });

  it('aggregates completed days and advances the checkpoint (expected: lock used, bulk aggregation run and checkpoint moved)', async () => {
    const dayOne = new Date('2026-03-14T00:00:00.000Z');
    const dayTwo = new Date('2026-03-15T00:00:00.000Z');

    metricsAggregationCheckpointsRepository.findByJobKey.mockResolvedValue(null);
    dailyUserFeatureActivityRepository.findEarliestActivityDay.mockResolvedValue(dayOne);
    dailyActiveUserMetricsRepository.upsertMetricsForDay.mockResolvedValue(1);
    metricsAggregationCheckpointsRepository.upsertLastAggregatedDay.mockResolvedValue(
      {} as never,
    );

    const result = await service.runOnce(new Date('2026-03-16T12:00:00.000Z'));

    expect(redlock.using).toHaveBeenCalledWith(
      ['metrics:dau:v1'],
      60_000,
      expect.any(Function),
    );
    expect(result).toEqual({
      processedDays: 2,
      lastAggregatedDayUtc: '2026-03-15',
    });
    expect(dailyActiveUserMetricsRepository.upsertMetricsForDay).toHaveBeenNthCalledWith(
      1,
      transactionClient,
      dayOne,
    );
    expect(dailyActiveUserMetricsRepository.upsertMetricsForDay).toHaveBeenNthCalledWith(
      2,
      transactionClient,
      dayTwo,
    );
    expect(
      metricsAggregationCheckpointsRepository.upsertLastAggregatedDay,
    ).toHaveBeenLastCalledWith(transactionClient, 'dau:v1', dayTwo);
  });

  it('returns without work when there is no completed day to aggregate (expected: processedDays=0 and no grouping call)', async () => {
    metricsAggregationCheckpointsRepository.findByJobKey.mockResolvedValue(null);
    dailyUserFeatureActivityRepository.findEarliestActivityDay.mockResolvedValue(
      new Date('2026-03-16T00:00:00.000Z'),
    );

    const result = await service.runOnce(new Date('2026-03-16T12:00:00.000Z'));

    expect(result).toEqual({ processedDays: 0 });
    expect(dailyActiveUserMetricsRepository.upsertMetricsForDay).not.toHaveBeenCalled();
  });

  it('does not advance the checkpoint when aggregation fails (expected: error thrown and checkpoint unchanged)', async () => {
    const dayOne = new Date('2026-03-14T00:00:00.000Z');

    metricsAggregationCheckpointsRepository.findByJobKey.mockResolvedValue(null);
    dailyUserFeatureActivityRepository.findEarliestActivityDay.mockResolvedValue(dayOne);
    dailyActiveUserMetricsRepository.upsertMetricsForDay.mockRejectedValue(
      new Error('boom'),
    );

    await expect(
      service.runOnce(new Date('2026-03-16T12:00:00.000Z')),
    ).rejects.toThrow('boom');
    expect(
      metricsAggregationCheckpointsRepository.upsertLastAggregatedDay,
    ).not.toHaveBeenCalled();
  });
});
