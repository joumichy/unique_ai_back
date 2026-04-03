import { RedlockModule } from "@anchan828/nest-redlock";
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { ScheduleModule } from "@nestjs/schedule";
import Redis from "ioredis";
import { LoggerModule } from "nestjs-pino";
import { join } from "node:path";
import { AppSettings } from "./app.settings";
import { MetricsModule } from "./metrics/metrics.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env"],
		}),
		LoggerModule.forRoot({
			pinoHttp: {
				level: "info",
				transport: {
					target: "pino-pretty",
					options: {
						translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
						ignore: "trace_flags,hostname,pid,req",
					},
				},
			},
		}),
		ScheduleModule.forRoot(),
		GraphQLModule.forRootAsync<ApolloDriverConfig>({
			driver: ApolloDriver,
			inject: [ConfigService],
			useFactory: async (config: ConfigService) => {
				const isProduction =
					config.get<string>(AppSettings.NODE_ENV) === "production";

				return {
					autoSchemaFile: join(process.cwd(), "src/@generated/schema.graphql"),
					introspection: !isProduction,
					playground: !isProduction,
					sortSchema: true,
					cache: "bounded",
					path: "/graphql",
					context: ({ req }) => ({ req }),
				};
			},
		}),
		RedlockModule.registerAsync({
			isGlobal: true,
			useFactory: async (config: ConfigService) => {
				const redisConfig = {
					host: config.get<string>(AppSettings.REDIS_HOST),
					port: parseInt(config.get<string>(AppSettings.REDIS_PORT) ?? "6379", 10),
					password: config.get<string>(AppSettings.REDIS_PASSWORD),
					db: parseInt(config.get<string>(AppSettings.REDIS_DB) ?? "0", 10),
				};
				const redis = new Redis(redisConfig);
				try {
					await redis.ping();
				} catch {
					throw new Error(
						`Cannot connect to redis ${redisConfig.host}:${redisConfig.port}`,
					);
				}

				return {
					clients: [redis],
					settings: {
						driftFactor: 0.01,
						retryCount: 30,
						retryDelay: 500,
						retryJitter: 200,
						automaticExtensionThreshold: 500,
					},
				};
			},
			inject: [ConfigService],
		}),
		PrismaModule,
		MetricsModule,
	],
})
export class AppModule {}
