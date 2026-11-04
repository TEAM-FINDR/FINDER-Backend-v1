import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { GlobalValidationPipe } from './common/pipes/global-validation.pipe';
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
