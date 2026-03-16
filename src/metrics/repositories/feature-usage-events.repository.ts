import { Injectable } from '@nestjs/common';
import { Prisma } from '../../@generated/prisma-client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeatureUsageEventRecord } from '../models/feature-usage-event.model';

@Injectable()
export class FeatureUsageEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createIfAbsent(
    tx: Prisma.TransactionClient,
    data: CreateFeatureUsageEventRecord,
  ): Promise<boolean> {
    const result = await tx.featureUsageEvent.createMany({
      data,
      skipDuplicates: true,
    });

    return result.count > 0;
  }

  async countAll(): Promise<number> {
    return this.prisma.featureUsageEvent.count();
  }

  async countByEventId(eventId: string): Promise<number> {
    return this.prisma.featureUsageEvent.count({
      where: { eventId },
    });
  }
}
