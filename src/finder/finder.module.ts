import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({ imports: [AuthModule, ProfilesModule, OpportunitiesModule, EligibilityModule] })
export class FinderModule {}
