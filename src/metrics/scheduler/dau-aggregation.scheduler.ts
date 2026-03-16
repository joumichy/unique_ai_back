import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DauAggregationService } from '../services/dau-aggregation.service';

@Injectable()
export class DauAggregationScheduler {
  private readonly logger = new Logger(DauAggregationScheduler.name);

  constructor(private readonly dauAggregationService: DauAggregationService) {}

  //Its configured to run every 2 minutes but you can change it to whatever you want.
  @Cron('*/2 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('DAU aggregation cron triggered');

    try {
      const result = await this.dauAggregationService.runOnce();

      if (result.processedDays > 0) {
        this.logger.log(
          `Processed ${result.processedDays} day(s); last day ${result.lastAggregatedDayUtc}`,
        );
      } else {
        this.logger.log('No pending day to aggregate');
      }
    } catch (error) {
      this.logger.error(
        'DAU aggregation failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
