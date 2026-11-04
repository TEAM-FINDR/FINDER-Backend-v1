import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';
import { NotificationSettingsModule } from '../notification-settings/notification-settings.module';
import { EventsModule } from '../events/events.module';
import { DeadlineReminderPlanner } from './deadline-reminder.planner';
import { DeadlineReminderScheduler } from './deadline-reminder.scheduler';
import { NotificationEventHandler } from './notification-event.handler';

@Module({
  imports: [AuthModule, NotificationSettingsModule, DevicesModule, EventsModule],
  providers: [DeadlineReminderPlanner, DeadlineReminderScheduler, NotificationEventHandler],
})
export class NotificationsModule {}
