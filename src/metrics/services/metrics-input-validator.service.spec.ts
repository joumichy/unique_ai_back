import { BadRequestException } from '@nestjs/common';
import { MetricsInputValidatorService } from './metrics-input-validator.service';

describe('MetricsInputValidatorService', () => {
  const service = new MetricsInputValidatorService();

  it('accepts a valid ingestion payload and normalizes the timestamp (expected: validated event DTO)', () => {
    const result = service.validateIngestFeatureUsageEvent({
      eventId: 'evt_123',
      userId: 'user_123',
      feature: 'message_sent',
      occurredAt: '2026-03-15T10:21:33Z',
    });

    expect(result).toEqual({
      eventId: 'evt_123',
      userId: 'user_123',
      feature: 'message_sent',
      occurredAt: new Date('2026-03-15T10:21:33.000Z'),
    });
  });

  it('defaults company scope when metrics input omits companyId (expected: validated query DTO)', () => {
    const result = service.validateFeatureUsageMetrics(
      {
        from: '2026-03-01',
        to: '2026-03-31',
        feature: 'message_sent',
      },
      'company_mock_456',
    );

    expect(result).toEqual({
      fromDay: new Date('2026-03-01T00:00:00.000Z'),
      toDay: new Date('2026-03-31T00:00:00.000Z'),
      companyId: 'company_mock_456',
      feature: 'message_sent',
    });
  });

  it('rejects metrics ranges larger than the configured maximum (expected: BadRequestException)', () => {
    expect(() =>
      service.validateFeatureUsageMetrics({
        from: '2025-01-01',
        to: '2026-01-02',
      }),
    ).toThrow(BadRequestException);
  });
});
