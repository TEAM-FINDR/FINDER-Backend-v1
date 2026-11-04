import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const openApiConfig = new DocumentBuilder()
    .setTitle('FINDR API')
    .setDescription('FINDR 앱과 웹에서 사용하는 API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('docs', app, openApiDocument, {
    useGlobalPrefix: false,
  });

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
