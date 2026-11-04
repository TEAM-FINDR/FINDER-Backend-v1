import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { OAuthProvider } from '../../auth/auth.types';
import { AuthChallengeEntity } from '../../auth/entities/auth-challenge.entity';
import { EMAIL_VERIFICATION_PURPOSE, PASSWORD_RESET_PURPOSE } from '../../auth/auth.constants';
import { AuthIdentityEntity } from '../../auth/entities/auth-identity.entity';
import { AuthSessionEntity } from '../../auth/entities/auth-session.entity';
import { UserEntity } from '../../auth/entities/user.entity';
import { AuthRepository, NewChallengeRecord, NewUserRecord } from '../../auth/ports/auth.repository';

@Injectable()
export class TypeOrmAuthRepository extends AuthRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthIdentityEntity) private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(AuthSessionEntity) private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(AuthChallengeEntity) private readonly challenges: Repository<AuthChallengeEntity>,
  ) { super(); }

  findUserByEmail(email: string) { return this.users.findOneBy({ email }); }
  findUserById(userId: string) { return this.users.findOneBy({ id: userId }); }

  getCurrentUser(userId: string) {
    return this.users.findOne({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true, profileCompleted: true, createdAt: true },
    });
  }

  createUser(record: NewUserRecord) { return this.users.save(this.users.create(record)); }

  findIdentity(provider: OAuthProvider, subject: string) {
    return this.identities.findOneBy({ provider, providerSubject: subject });
  }

  async createIdentity(userId: string, provider: OAuthProvider, subject: string) {
    await this.identities.save(this.identities.create({ userId, provider, providerSubject: subject }));
  }

  createSocialUserWithIdentity(record: NewUserRecord, provider: OAuthProvider, subject: string) {
    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(UserEntity);
      const user = await userRepository.save(userRepository.create(record));
      const identityRepository = manager.getRepository(AuthIdentityEntity);
      await identityRepository.save(identityRepository.create({
        userId: user.id,
        provider,
        providerSubject: subject,
      }));
      return user;
    });
  }

  async replaceChallenge(record: NewChallengeRecord, at: Date, minimumIntervalMs?: number) {
    return this.dataSource.transaction(async (manager) => {
      if (record.userId) {
        const user = await manager.getRepository(UserEntity).createQueryBuilder('user')
          .setLock('pessimistic_write')
          .where('user.id = :userId', { userId: record.userId })
          .getOne();
        if (!user) return false;
      }

      const challengeRepository = manager.getRepository(AuthChallengeEntity);
      if (minimumIntervalMs !== undefined) {
        const recentChallenge = await challengeRepository.findOne({
          where: {
            email: record.email,
            purpose: record.purpose,
            createdAt: MoreThan(new Date(at.getTime() - minimumIntervalMs)),
          },
        });
        if (recentChallenge) return false;
      }

      await challengeRepository.update(
        { email: record.email, purpose: record.purpose, consumedAt: IsNull() },
        { consumedAt: at },
      );
      await challengeRepository.save(challengeRepository.create({ ...record, consumedAt: null }));
      return true;
    });
  }

  verifyEmail(email: string, tokenHash: string, at: Date) {
    return this.dataSource.transaction(async (manager) => {
      const challengeRepository = manager.getRepository(AuthChallengeEntity);
      const challenge = await challengeRepository.findOne({
        where: {
          email,
          purpose: EMAIL_VERIFICATION_PURPOSE,
          tokenHash,
          consumedAt: IsNull(),
          expiresAt: MoreThan(at),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!challenge?.userId) return null;

      const userRepository = manager.getRepository(UserEntity);
      const user = await userRepository.findOneBy({ id: challenge.userId, email });
      if (!user) return null;

      challenge.consumedAt = at;
      user.emailVerifiedAt ??= at;
      await challengeRepository.save(challenge);
      await userRepository.save(user);
      return user;
    });
  }

  resetPassword(tokenHash: string, passwordHash: string, at: Date) {
    return this.dataSource.transaction(async (manager) => {
      const challengeRepository = manager.getRepository(AuthChallengeEntity);
      const challenge = await challengeRepository.findOne({
        where: {
          purpose: PASSWORD_RESET_PURPOSE,
          tokenHash,
          consumedAt: IsNull(),
          expiresAt: MoreThan(at),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!challenge?.userId) return false;

      const userRepository = manager.getRepository(UserEntity);
      const user = await userRepository.findOneBy({ id: challenge.userId });
      if (!user) return false;

      challenge.consumedAt = at;
      user.passwordHash = passwordHash;
      await challengeRepository.save(challenge);
      await userRepository.save(user);
      await manager.getRepository(AuthSessionEntity).update(
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: at },
      );
      return true;
    });
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

}
