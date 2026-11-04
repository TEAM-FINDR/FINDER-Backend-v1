import { AuthChallengeEntity } from '../../auth/entities/auth-challenge.entity';
import { AuthIdentityEntity } from '../../auth/entities/auth-identity.entity';
import { AuthSessionEntity } from '../../auth/entities/auth-session.entity';
import { UserEntity } from '../../auth/entities/user.entity';
import { OAuthProvider } from '../../auth/auth.types';

export interface NewUserRecord {
  email: string | null;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  profileCompleted: boolean;
}

export interface NewChallengeRecord {
  userId: string | null;
  email: string;
  purpose: string;
  tokenHash: string;
  expiresAt: Date;
}

export abstract class AuthRepository {
  abstract findUserByEmail(email: string): Promise<UserEntity | null>;
  abstract findUserById(userId: string): Promise<UserEntity | null>;
  abstract getCurrentUser(userId: string): Promise<Pick<UserEntity, 'id' | 'email' | 'emailVerifiedAt' | 'profileCompleted' | 'createdAt'> | null>;
  abstract createUser(record: NewUserRecord): Promise<UserEntity>;
  abstract createSocialUserWithIdentity(record: NewUserRecord, provider: OAuthProvider, subject: string): Promise<UserEntity>;
  abstract findIdentity(provider: OAuthProvider, subject: string): Promise<AuthIdentityEntity | null>;
  abstract createIdentity(userId: string, provider: OAuthProvider, subject: string): Promise<void>;
  abstract replaceChallenge(record: NewChallengeRecord, at: Date, minimumIntervalMs?: number): Promise<boolean>;
  abstract verifyEmail(email: string, tokenHash: string, at: Date): Promise<UserEntity | null>;
  abstract resetPassword(tokenHash: string, passwordHash: string, at: Date): Promise<boolean>;
  abstract createSession(session: Pick<AuthSessionEntity, 'id' | 'userId' | 'refreshTokenHash' | 'expiresAt'>): Promise<void>;
  abstract findActiveSession(sessionId: string, now: Date): Promise<AuthSessionEntity | null>;
  abstract rotateSession(sessionId: string, oldHash: string, newHash: string, expiresAt: Date, now: Date): Promise<boolean>;
  abstract revokeSession(sessionId: string, userId: string, at: Date): Promise<void>;
}
