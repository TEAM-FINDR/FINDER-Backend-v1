import { Module, ValidationError, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ApiException } from './common/errors/api-error';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { RequestTraceInterceptor } from './common/interceptors/request-trace.interceptor';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { TermsModule } from './terms/terms.module';
import { ProfilesModule } from './profiles/profiles.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SavedModule } from './saved/saved.module';
import { EligibilityModule } from './eligibility/eligibility.module';
import { FinderModule } from './finder/finder.module';
import { HomeModule } from './home/home.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';
import { DevicesModule } from './devices/devices.module';

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
        return new ApiException(
          400,
          'INVALID_REQUEST',
          '요청 값이 유효하지 않습니다.',
          field,
        );
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
    DatabaseModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    AuthModule,
    UsersModule,
    TermsModule,
    ProfilesModule,
    OpportunitiesModule,
    OrganizationsModule,
    SavedModule,
    EligibilityModule,
    FinderModule,
    HomeModule,
    NotificationsModule,
    NotificationSettingsModule,
    DevicesModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_PIPE, useClass: GlobalValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestTraceInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
