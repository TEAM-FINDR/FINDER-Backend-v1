import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AuthChallengeEntity } from '../auth/entities/auth-challenge.entity';
import { AuthIdentityEntity } from '../auth/entities/auth-identity.entity';
import { AuthSessionEntity } from '../auth/entities/auth-session.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { CreateAuthTables1700000000000 } from './migrations/1700000000000-CreateAuthTables';
import { DomainEventEntity } from '../events/entities/domain-event.entity';
import { CreateDomainEventOutbox1793817418067 } from './migrations/1793817418067-CreateDomainEventOutbox';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running migrations.');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [UserEntity, AuthIdentityEntity, AuthSessionEntity, AuthChallengeEntity, DomainEventEntity],
  migrations: [CreateAuthTables1700000000000, CreateDomainEventOutbox1793817418067],
  synchronize: false,
});
