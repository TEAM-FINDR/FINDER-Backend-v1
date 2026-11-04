import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { OAuthProvider } from '../../auth/auth.types';
import { AuthChallengeEntity } from '../../auth/entities/auth-challenge.entity';
import { AuthIdentityEntity } from '../../auth/entities/auth-identity.entity';
import { AuthSessionEntity } from '../../auth/entities/auth-session.entity';
import { UserEntity } from '../../auth/entities/user.entity';
import { AuthRepository, NewChallengeRecord, NewUserRecord } from './auth.repository';

@Injectable()
export class TypeOrmAuthRepository extends AuthRepository {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthIdentityEntity) private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(AuthSessionEntity) private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(AuthChallengeEntity) private readonly challenges: Repository<AuthChallengeEntity>,
  ) { super(); }

  findUserByEmail(email: string) { return this.users.findOneBy({ email }); }
  findUserById(userId: string) { return this.users.findOneBy({ id: userId }); }
  findUserByIdAndEmail(userId: string, email: string) { return this.users.findOneBy({ id: userId, email }); }
  async markEmailVerified(userId: string, at: Date) { await this.users.update({ id: userId, emailVerifiedAt: IsNull() }, { emailVerifiedAt: at }); }

  getCurrentUser(userId: string) {
    return this.users.findOne({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true, profileCompleted: true, createdAt: true },
    });
  }

  createUser(record: NewUserRecord) { return this.users.save(this.users.create(record)); }
  findIdentity(provider: OAuthProvider, subject: string) { return this.identities.findOneBy({ provider, providerSubject: subject }); }

  async createIdentity(userId: string, provider: OAuthProvider, subject: string) {
    await this.identities.save(this.identities.create({ userId, provider, providerSubject: subject }));
  }

  findChallenge(email: string, purpose: string, tokenHash: string, now: Date) {
    return this.challenges.findOne({ where: { email, purpose, tokenHash, consumedAt: IsNull(), expiresAt: MoreThan(now) } });
  }

  findChallengeByPurposeAndHash(purpose: string, tokenHash: string, now: Date) {
    return this.challenges.findOne({ where: { purpose, tokenHash, consumedAt: IsNull(), expiresAt: MoreThan(now) } });
  }

  findRecentChallenge(email: string, purpose: string, since: Date) {
    return this.challenges.findOne({ where: { email, purpose, createdAt: MoreThan(since) } });
  }

  async replaceChallenge(record: NewChallengeRecord) {
    await this.challenges.update({ email: record.email, purpose: record.purpose, consumedAt: IsNull() }, { consumedAt: new Date() });
    await this.challenges.save(this.challenges.create({ ...record, consumedAt: null }));
  }

  async consumeChallenge(challengeId: string, now: Date) {
    const result = await this.challenges.update({ id: challengeId, consumedAt: IsNull(), expiresAt: MoreThan(now) }, { consumedAt: now });
    return result.affected === 1;
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.users.update({ id: userId }, { passwordHash });
  }

  async createSession(session: Pick<AuthSessionEntity, 'id' | 'userId' | 'refreshTokenHash' | 'expiresAt'>) {
    await this.sessions.save(this.sessions.create({ ...session, revokedAt: null }));
  }

  findActiveSession(sessionId: string, now: Date) {
    return this.sessions.findOne({ where: { id: sessionId, revokedAt: IsNull(), expiresAt: MoreThan(now) } });
  }

  async rotateSession(sessionId: string, oldHash: string, newHash: string, expiresAt: Date, now: Date) {
    const result = await this.sessions.createQueryBuilder().update(AuthSessionEntity)
      .set({ refreshTokenHash: newHash, expiresAt, updatedAt: now })
      .where('id = :sessionId AND refresh_token_hash = :oldHash AND revoked_at IS NULL AND expires_at > :now', { sessionId, oldHash, now })
      .execute();
    return result.affected === 1;
  }

  async revokeSession(sessionId: string, userId: string, at: Date) {
    await this.sessions.update({ id: sessionId, userId, revokedAt: IsNull() }, { revokedAt: at });
  }

  async revokeAllSessions(userId: string, at: Date) {
    await this.sessions.update({ userId, revokedAt: IsNull() }, { revokedAt: at });
  }
}
