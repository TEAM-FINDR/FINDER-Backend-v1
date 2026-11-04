import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { EventsModule } from '../events/events.module';
import { EligibilityRecalculationHandler, EligibilityNotificationEventHandler } from './eligibility-event.handlers';

@Module({
  imports: [AuthModule, ProfilesModule, OpportunitiesModule, EventsModule],
  providers: [EligibilityRecalculationHandler, EligibilityNotificationEventHandler],
})
export class EligibilityModule {}
