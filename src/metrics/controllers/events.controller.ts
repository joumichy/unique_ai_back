import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IngestEventResponseDto } from '../dto/ingest-event-response.dto';
import { ValidatedCreateEventDto } from '../dto/validated-create-event.dto';
import { CreateEventDtoPipe } from '../pipes/create-event-dto.pipe';
import { EventIngestionService } from '../services/event-ingestion.service';
import { toUtcDateString } from '../utils/utc-date.util';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventIngestionService: EventIngestionService) {}

  @ApiOperation({
    summary: 'Ingest a feature usage event',
    description:
      'Stores a new feature usage event, enforces idempotency on event_id, and returns the mapped DAU metric key. Seeded mock users: user_mock_123, user_mock_2, user_mock_3, user_mock_789.',
  })
  @ApiBody({
    description: 'Feature usage event payload',
    schema: {
      type: 'object',
      required: ['event_id', 'user_id', 'feature', 'timestamp'],
      properties: {
        event_id: { type: 'string', example: 'evt_postman_001' },
        user_id: { type: 'string', example: 'user_mock_2' },
        feature: { type: 'string', example: 'message_sent' },
        timestamp: { type: 'string', example: '2025-11-01T10:00:00Z' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Event ingested successfully',
    schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', example: 'evt_postman_001' },
        feature: { type: 'string', example: 'message_sent' },
        metric_key: { type: 'string', example: 'DAU-message_sent' },
        occurred_day_utc: { type: 'string', example: '2025-11-01' },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Duplicate event_id (idempotency conflict)',
  })
  @Post()
  async createEvent(
    @Body(CreateEventDtoPipe) input: ValidatedCreateEventDto,
  ): Promise<IngestEventResponseDto> {
    const result = await this.eventIngestionService.ingest(input);

    return {
      event_id: result.eventId,
      feature: input.feature,
      metric_key: `DAU-${input.feature}`,
      occurred_day_utc: toUtcDateString(result.occurredDayUtc),
    };
  }
}
