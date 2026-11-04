import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { ApiErrorCode, ApiException } from '../common/errors/api-error';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { UserEntity } from './entities/user.entity';
import { AccessTokenClaims, AuthTokens } from './auth.types';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createSession(user: UserEntity): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const refreshToken = this.createRefreshToken(sessionId);
    const expiresAt = this.getRefreshExpiry();

    await this.sessions.save(
      this.sessions.create({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt,
        revokedAt: null,
      }),
    );

    return this.createTokenResponse(user, sessionId, refreshToken);
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
    const [sessionId, secret, extra] = refreshToken.split('.');
    if (!sessionId || !secret || extra || !this.isUuid(sessionId)) {
      throw this.invalidToken();
    }

    const now = new Date();
    const session = await this.sessions.findOne({
      where: {
        id: sessionId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
    if (!session || !this.safeEqual(session.refreshTokenHash, this.hashToken(refreshToken))) {
      throw this.invalidToken();
    }

    const user = await this.users.findOneBy({ id: session.userId });
    if (!user) {
      throw this.invalidToken();
    }

    const nextRefreshToken = this.createRefreshToken(session.id);
    const nextExpiry = this.getRefreshExpiry();
    const update = await this.sessions
      .createQueryBuilder()
      .update(AuthSessionEntity)
      .set({
        refreshTokenHash: this.hashToken(nextRefreshToken),
        expiresAt: nextExpiry,
        updatedAt: now,
      })
      .where(
        'id = :id AND refresh_token_hash = :oldHash AND revoked_at IS NULL AND expires_at > :now',
        { id: session.id, oldHash: session.refreshTokenHash, now },
      )
      .execute();

    if (update.affected !== 1) {
      throw this.invalidToken();
    }

    return this.createTokenResponse(user, session.id, nextRefreshToken);
  }

  async validateAccessSession(
    claims: AccessTokenClaims,
  ): Promise<boolean> {
    if (!claims.sub || !claims.sid || claims.typ !== 'access') {
      return false;
    }
    const session = await this.sessions.findOne({
      where: {
        id: claims.sid,
        userId: claims.sub,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      select: { id: true },
    });
    return Boolean(session);
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.sessions.update(
      { id: sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async createTokenResponse(
    user: UserEntity,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const expiresIn = this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    const accessToken = await this.jwt.signAsync(
      { sid: sessionId, typ: 'access' },
      { subject: user.id },
    );
    return {
      accessToken,
      refreshToken,
      expiresIn,
      profileCompleted: user.profileCompleted,
    };
  }

  private createRefreshToken(sessionId: string): string {
    return `${sessionId}.${randomBytes(32).toString('base64url')}`;
  }

  private hashToken(token: string): string {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    )
      .update(token)
      .digest('hex');
  }

  private getRefreshExpiry(): Date {
    const days = this.config.getOrThrow<number>('SESSION_REFRESH_TTL_DAYS');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private invalidToken(): ApiException {
    return new ApiException(
      401,
      ApiErrorCode.AUTH_TOKEN_INVALID,
      '인증 정보가 유효하지 않거나 만료되었습니다.',
    );
  }
}
