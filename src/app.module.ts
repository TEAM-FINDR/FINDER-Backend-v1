import {
  BadRequestException,
  Module,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { validateEnvironment } from './config/env.validation';

function findFirstInvalidField(
  errors: ValidationError[],
  parent = '',
): string | undefined {
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints && Object.keys(error.constraints).length > 0) {
      return field;
    }

    const nestedField = findFirstInvalidField(error.children ?? [], field);
    if (nestedField) {
      return nestedField;
    }
  }
}

class GlobalValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const field = findFirstInvalidField(errors);
        return new BadRequestException({
          code: 'INVALID_REQUEST',
          message: '요청 값이 유효하지 않습니다.',
          ...(field ? { field } : {}),
        });
      },
    });
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
  ],
  controllers: [AppController],
  providers: [{ provide: APP_PIPE, useClass: GlobalValidationPipe }],
})
export class AppModule {}
