import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppSettings } from './app.settings';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get<ConfigService>(ConfigService);
  const port = configService.get<string>(AppSettings.PORT) ?? 3000;

  logger.log(`Start to listen on ${port}`);
  logger.log(`GraphQL endpoint available at http://localhost:${port}/graphql`);
  await app.listen(port);
}

bootstrap();
