import { Injectable } from '@nestjs/common';
import { Prisma } from '../../@generated/prisma-client';
import { CreateFeatureUsageEventRecord } from '../models/feature-usage-event.model';

@Injectable()
export class FeatureUsageEventsRepository {
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
}
