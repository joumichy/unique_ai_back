import { Injectable } from '@nestjs/common';
import { Prisma } from '../../@generated/prisma-client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MetricsAggregationCheckpointsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByJobKey(jobKey: string) {
    return this.prisma.metricsAggregationCheckpoint.findUnique({
      where: { jobKey },
    });
  }

  async upsertLastAggregatedDay(
    tx: Prisma.TransactionClient,
    jobKey: string,
    lastAggregatedDayUtc: Date,
  ) {
    return tx.metricsAggregationCheckpoint.upsert({
      where: { jobKey },
      create: {
        jobKey,
        lastAggregatedDayUtc,
      },
      update: {
        lastAggregatedDayUtc,
      },
    });
  }
}
