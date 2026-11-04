import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({ imports: [AuthModule, ProfilesModule, OpportunitiesModule] })
export class EligibilityModule {}
