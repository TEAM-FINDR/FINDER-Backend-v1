import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';

@Module({ imports: [AuthModule, OpportunitiesModule] })
export class SavedModule {}
