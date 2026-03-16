import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MetricItemDto } from '../dto/metric-item.dto';
import { ValidatedGetDauMetricsQueryDto } from '../dto/validated-get-dau-metrics-query.dto';
import { GetDauMetricsQueryPipe } from '../pipes/get-dau-metrics-query.pipe';
import { DauQueryService } from '../services/dau-query.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly dauQueryService: DauQueryService) {}

  @ApiOperation({
    summary: 'Retrieve DAU and WAU metrics',
    description:
      'Returns DAU daily buckets and WAU weekly buckets for the selected range, optionally filtered by company and feature. Seeded company filters: company_mock_456, company_mock_789.',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Start day in YYYY-MM-DD format',
    example: '2025-11-01',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'End day in YYYY-MM-DD format',
    example: '2025-11-07',
  })
  @ApiQuery({
    name: 'company_id',
    required: false,
    description: 'Optional company filter',
    example: 'company_mock_456',
  })
  @ApiQuery({
    name: 'feature',
    required: false,
    description: 'Optional feature filter',
    example: 'message_sent',
  })
  @ApiOkResponse({
    description: 'Aggregated metrics list (DAU and WAU)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric_key: { type: 'string', example: 'DAU-message_sent' },
          metric_value: { type: 'number', example: 2 },
          partition_timestamp: { type: 'string', example: '2025-11-01' },
        },
      },
    },
  })
  @Get()
  async getDailyAndWeeklyActiveUsers(
    @Query(GetDauMetricsQueryPipe) query: ValidatedGetDauMetricsQueryDto,
  ): Promise<MetricItemDto[]> {
    return this.dauQueryService.getDailyAndWeeklyActiveUsers(query);
  }

  @ApiOperation({
    summary: 'Retrieve DAU metrics',
    description:
      'Returns DAU daily buckets for the selected range, optionally filtered by company and feature. Seeded company filters: company_mock_456, company_mock_789.',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Start day in YYYY-MM-DD format',
    example: '2025-11-01',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'End day in YYYY-MM-DD format',
    example: '2025-11-07',
  })
  @ApiQuery({
    name: 'company_id',
    required: false,
    description: 'Optional company filter',
    example: 'company_mock_456',
  })
  @ApiQuery({
    name: 'feature',
    required: false,
    description: 'Optional feature filter',
    example: 'message_sent',
  })
  @ApiOkResponse({
    description: 'Aggregated metrics list',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric_key: { type: 'string', example: 'DAU-message_sent' },
          metric_value: { type: 'number', example: 2 },
          partition_timestamp: { type: 'string', example: '2025-11-01' },
        },
      },
    },
  })
  @Get('dau')
  async getDailyActiveUsers(
    @Query(GetDauMetricsQueryPipe) query: ValidatedGetDauMetricsQueryDto,
  ): Promise<MetricItemDto[]> {
    return this.dauQueryService.getDailyActiveUsers(query);
  }

  @ApiOperation({
    summary: 'Retrieve WAU metrics',
    description:
      'Returns WAU weekly buckets for the selected range, optionally filtered by company and feature. Seeded company filters: company_mock_456, company_mock_789.',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Start day in YYYY-MM-DD format',
    example: '2025-11-01',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'End day in YYYY-MM-DD format',
    example: '2025-11-07',
  })
  @ApiQuery({
    name: 'company_id',
    required: false,
    description: 'Optional company filter',
    example: 'company_mock_456',
  })
  @ApiQuery({
    name: 'feature',
    required: false,
    description: 'Optional feature filter',
    example: 'message_sent',
  })
  @ApiOkResponse({
    description: 'Aggregated weekly metrics list',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric_key: { type: 'string', example: 'WAU-message_sent' },
          metric_value: { type: 'number', example: 2 },
          partition_timestamp: { type: 'string', example: '2025_wk44' },
        },
      },
    },
  })
  @Get('wau')
  async getWeeklyActiveUsers(
    @Query(GetDauMetricsQueryPipe) query: ValidatedGetDauMetricsQueryDto,
  ): Promise<MetricItemDto[]> {
    return this.dauQueryService.getWeeklyActiveUsers(query);
  }
}
