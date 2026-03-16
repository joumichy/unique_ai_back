import { BadRequestException } from '@nestjs/common';
import { GetDauMetricsQueryPipe } from './get-dau-metrics-query.pipe';

describe('GetDauMetricsQueryPipe', () => {
  const pipe = new GetDauMetricsQueryPipe();

  it('accepts a bounded range and maps fields (expected: normalized DTO with UTC days)', () => {
    const result = pipe.transform({
      from: '2025-11-01',
      to: '2025-11-30',
      company_id: 'company_mock_456',
      feature: 'message_sent',
    });

    expect(result).toEqual({
      fromDay: new Date('2025-11-01T00:00:00.000Z'),
      toDay: new Date('2025-11-30T00:00:00.000Z'),
      companyId: 'company_mock_456',
      feature: 'message_sent',
    });
  });

  it('rejects ranges larger than the configured maximum (expected: BadRequestException)', () => {
    expect(() =>
      pipe.transform({
        from: '2025-01-01',
        to: '2025-05-01',
      }),
    ).toThrow(BadRequestException);
  });
});
