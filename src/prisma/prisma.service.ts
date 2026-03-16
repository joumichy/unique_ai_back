import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Prisma, PrismaClient } from '../@generated/prisma-client';
import { AppSettings } from '../app.settings';

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query'> implements OnModuleInit, OnModuleDestroy {
  public constructor(private readonly configService: ConfigService) {
    const dbUrl = configService.get<string>(AppSettings.DATABASE_URL);
    const connectionPoolLimit = configService.get<string>(
      AppSettings.DATABASE_CONNECTION_POOL_LIMIT,
    );
    // Create PostgreSQL adapter for Prisma 7
    const pool = new pg.Pool({
      connectionString: dbUrl,
      max: connectionPoolLimit ? parseInt(connectionPoolLimit, 10) : 10,
    });
    const adapter = new PrismaPg(pool);
    super({
      adapter,
    });
  }
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
