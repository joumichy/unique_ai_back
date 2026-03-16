import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppSettings } from './app.settings';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Unique Backend Metrics API')
    .setDescription(
      'REST API for event ingestion and DAU/WAU metrics querying. Use /events to ingest feature usage events and /metrics/dau to retrieve aggregated metrics.',
    )
    .setVersion('1.0.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  const configService = app.get<ConfigService>(ConfigService);
  const port = configService.get<string>(AppSettings.PORT) ?? 3000;

  logger.log(`Start to listen on ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api-docs`);
  await app.listen(port);
}

bootstrap();
