import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { ApiErrorCode, ApiException } from '../common/errors/api-error';
import { UserEntity } from './entities/user.entity';
import { AccessTokenClaims, AuthTokens } from './auth.types';
import { AuthRepository } from '../database/repositories/auth.repository';

@Injectable()
export class TokenService {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createSession(user: UserEntity): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const refreshToken = this.createRefreshToken(sessionId);
    const expiresAt = this.getRefreshExpiry();

    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt,
    });

    return this.createTokenResponse(user, sessionId, refreshToken);
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
    const [sessionId, secret, extra] = refreshToken.split('.');
    if (!sessionId || !secret || extra || !this.isUuid(sessionId)) {
      throw this.invalidToken();
    }

    const now = new Date();
    const session = await this.repository.findActiveSession(sessionId, now);
    if (!session || !this.safeEqual(session.refreshTokenHash, this.hashToken(refreshToken))) {
      throw this.invalidToken();
    }

    const user = await this.repository.findUserById(session.userId);
    if (!user) {
      throw this.invalidToken();
    }

    const nextRefreshToken = this.createRefreshToken(session.id);
    const nextExpiry = this.getRefreshExpiry();
    if (!(await this.repository.rotateSession(
      session.id,
      session.refreshTokenHash,
      this.hashToken(nextRefreshToken),
      nextExpiry,
      now,
    ))) {
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
    const session = await this.repository.findActiveSession(claims.sid, new Date());
    return Boolean(session && session.userId === claims.sub);
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.repository.revokeSession(sessionId, userId, new Date());
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.repository.revokeAllSessions(userId, new Date());
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
