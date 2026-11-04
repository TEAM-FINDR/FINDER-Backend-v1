import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';
import { NotificationSettingsModule } from '../notification-settings/notification-settings.module';

@Module({ imports: [AuthModule, NotificationSettingsModule, DevicesModule] })
export class NotificationsModule {}
