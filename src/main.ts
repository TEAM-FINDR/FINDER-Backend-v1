import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  const corsOrigins = config.get<string[]>('CORS_ORIGINS') ?? [];

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
  });

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
