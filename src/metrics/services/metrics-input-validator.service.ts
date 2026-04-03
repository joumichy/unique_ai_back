import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FEATURE_KEY_PATTERN,
  MAX_METRICS_QUERY_RANGE_DAYS,
  MILLISECONDS_PER_DAY,
} from '../constants/metrics-query.constants';
import { FeatureUsageMetricsQuery } from '../contracts/feature-usage-metrics.query';
import { IngestFeatureUsageEventCommand } from '../contracts/ingest-feature-usage-event.command';
import { parseDateOnlyToUtcDay, parseIsoTimestamp } from '../utils/utc-date.util';

interface IngestFeatureUsageEventInputLike {
  eventId?: unknown;
  userId?: unknown;
  feature?: unknown;
  occurredAt?: unknown;
}

interface FeatureUsageMetricsInputLike {
  from?: unknown;
  to?: unknown;
  companyId?: unknown;
  feature?: unknown;
}

@Injectable()
export class MetricsInputValidatorService {
  validateIngestFeatureUsageEvent(
    input: IngestFeatureUsageEventInputLike,
  ): IngestFeatureUsageEventCommand {
    const eventId = this.requireString(input.eventId, 'eventId');
    const userId = this.requireString(input.userId, 'userId');
    const feature = this.requireString(input.feature, 'feature');
    const occurredAtValue = this.requireString(input.occurredAt, 'occurredAt');

    if (!FEATURE_KEY_PATTERN.test(feature)) {
      throw new BadRequestException(
        'feature must match ^[a-z0-9]+(?:_[a-z0-9]+)*$',
      );
    }

    const occurredAt = parseIsoTimestamp(occurredAtValue);
    if (!occurredAt) {
      throw new BadRequestException(
        'occurredAt must be a valid ISO-8601 string with timezone',
      );
    }

    return {
      eventId,
      userId,
      feature,
      occurredAt,
    };
  }

  validateFeatureUsageMetrics(
    input: FeatureUsageMetricsInputLike,
    defaultCompanyId?: string,
  ): FeatureUsageMetricsQuery {
    const from = this.requireString(input.from, 'from');
    const to = this.requireString(input.to, 'to');
    const fromDay = parseDateOnlyToUtcDay(from);
    const toDay = parseDateOnlyToUtcDay(to);

    if (!fromDay) {
      throw new BadRequestException('from must use YYYY-MM-DD format');
    }

    if (!toDay) {
      throw new BadRequestException('to must use YYYY-MM-DD format');
    }

    if (fromDay.getTime() > toDay.getTime()) {
      throw new BadRequestException('from must be before or equal to to');
    }

    const rangeDays =
      Math.floor((toDay.getTime() - fromDay.getTime()) / MILLISECONDS_PER_DAY) + 1;
    if (rangeDays > MAX_METRICS_QUERY_RANGE_DAYS) {
      throw new BadRequestException(
        `date range must be ${MAX_METRICS_QUERY_RANGE_DAYS} days or less`,
      );
    }

    const companyId =
      this.optionalString(input.companyId, 'companyId') ?? defaultCompanyId;
    const feature = this.optionalString(input.feature, 'feature');

    if (feature && !FEATURE_KEY_PATTERN.test(feature)) {
      throw new BadRequestException(
        'feature must match ^[a-z0-9]+(?:_[a-z0-9]+)*$',
      );
    }

    return {
      fromDay,
      toDay,
      companyId,
      feature,
    };
  }

  private requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} must not be empty`);
    }

    return trimmed;
  }

  private optionalString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} must not be empty`);
    }

    return trimmed;
  }
}
