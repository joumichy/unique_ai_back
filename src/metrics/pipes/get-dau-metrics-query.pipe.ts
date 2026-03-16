import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { GetDauMetricsQueryDto } from '../dto/get-dau-metrics-query.dto';
import { ValidatedGetDauMetricsQueryDto } from '../dto/validated-get-dau-metrics-query.dto';
import { parseDateOnlyToUtcDay } from '../utils/utc-date.util';

const FEATURE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MAX_DAYS_RANGE = 93;

@Injectable()
export class GetDauMetricsQueryPipe
  implements PipeTransform<unknown, ValidatedGetDauMetricsQueryDto>
{
  transform(value: unknown): ValidatedGetDauMetricsQueryDto {
    const query = (value ?? {}) as GetDauMetricsQueryDto;
    const from = this.requireString(query.from, 'from');
    const to = this.requireString(query.to, 'to');
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
      Math.floor((toDay.getTime() - fromDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > MAX_DAYS_RANGE) {
      throw new BadRequestException(
        `date range must be ${MAX_DAYS_RANGE} days or less`,
      );
    }

    const companyId = this.optionalString(query.company_id, 'company_id');
    const feature = this.optionalString(query.feature, 'feature');

    if (feature && !FEATURE_PATTERN.test(feature)) {
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
    if (value === undefined) {
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
