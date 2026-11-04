import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinderModule } from '../finder/finder.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SavedModule } from '../saved/saved.module';

@Module({ imports: [AuthModule, ProfilesModule, OpportunitiesModule, SavedModule, FinderModule, NotificationsModule] })
export class HomeModule {}
