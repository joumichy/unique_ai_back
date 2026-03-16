import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { CreateEventDto } from '../dto/create-event.dto';
import { ValidatedCreateEventDto } from '../dto/validated-create-event.dto';
import { parseIsoTimestamp } from '../utils/utc-date.util';

const FEATURE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

@Injectable()
export class CreateEventDtoPipe
  implements PipeTransform<unknown, ValidatedCreateEventDto>
{
  transform(value: unknown): ValidatedCreateEventDto {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Request body must be an object');
    }

    const payload = value as CreateEventDto;
    const eventId = this.requireString(payload.event_id, 'event_id');
    const userId = this.requireString(payload.user_id, 'user_id');
    const feature = this.requireString(payload.feature, 'feature');
    const timestamp = this.requireString(payload.timestamp, 'timestamp');

    if (!FEATURE_PATTERN.test(feature)) {
      throw new BadRequestException(
        'feature must match ^[a-z0-9]+(?:_[a-z0-9]+)*$',
      );
    }

    const occurredAt = parseIsoTimestamp(timestamp);
    if (!occurredAt) {
      throw new BadRequestException(
        'timestamp must be a valid ISO-8601 string with timezone',
      );
    }

    return {
      eventId,
      userId,
      feature,
      occurredAt,
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
}
