import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import jwksRsa, { SigningKey } from 'jwks-rsa';
import { ApiErrorCode, ApiException } from '../common/errors/api-error';
import { ExternalIdentity, OAuthProvider } from './auth.types';

type ProviderClaims = JwtPayload & {
  email?: string;
  email_verified?: boolean | string;
};

@Injectable()
export class OAuthVerifierService {
  private readonly google = new OAuth2Client();
  private readonly appleKeys = jwksRsa({
    jwksUri: 'https://appleid.apple.com/auth/keys',
    cache: true,
    rateLimit: true,
  });
  private readonly kakaoKeys = jwksRsa({
    jwksUri: 'https://kauth.kakao.com/.well-known/jwks.json',
    cache: true,
    rateLimit: true,
  });

  constructor(private readonly config: ConfigService) {}

  async verify(provider: OAuthProvider, idToken: string): Promise<ExternalIdentity> {
    try {
      switch (provider) {
        case 'google':
          return await this.verifyGoogle(idToken);
        case 'apple':
          return await this.verifyApple(idToken);
        case 'kakao':
          return await this.verifyKakao(idToken);
      }
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        401,
        ApiErrorCode.AUTH_TOKEN_INVALID,
        '소셜 인증 정보가 유효하지 않습니다.',
      );
    }
  }

  private async verifyGoogle(idToken: string): Promise<ExternalIdentity> {
    const audiences = this.getAudiences('GOOGLE_CLIENT_ID');
    const ticket = await this.google.verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new Error('Google token has no subject.');
    }
    return this.toIdentity('google', payload.sub, payload.email, payload.email_verified);
  }

  private async verifyApple(idToken: string): Promise<ExternalIdentity> {
    const claims = await this.verifyWithJwks(
      idToken,
      this.appleKeys,
      this.getAudiences('APPLE_CLIENT_ID'),
      'https://appleid.apple.com',
    );
    if (!claims.sub) {
      throw new Error('Apple token has no subject.');
    }
    return this.toIdentity('apple', claims.sub, claims.email, claims.email_verified);
  }

  private async verifyKakao(idToken: string): Promise<ExternalIdentity> {
    const claims = await this.verifyWithJwks(
      idToken,
      this.kakaoKeys,
      this.getAudiences('KAKAO_CLIENT_ID'),
      'https://kauth.kakao.com',
    );
    if (!claims.sub) {
      throw new Error('Kakao token has no subject.');
    }
    return this.toIdentity('kakao', claims.sub, claims.email, claims.email_verified);
  }

  private verifyWithJwks(
    token: string,
    client: typeof this.appleKeys,
    audience: string[],
    issuer: string,
  ): Promise<ProviderClaims> {
    return new Promise((resolve, reject) => {
      const getKey = (
        header: JwtHeader,
        callback: (error: Error | null, key?: string) => void,
      ) => {
        if (!header.kid) {
          callback(new Error('Token signing key ID is missing.'));
          return;
        }
        client
          .getSigningKey(header.kid)
          .then((key: SigningKey) => callback(null, key.getPublicKey()))
          .catch((error: Error) => callback(error));
      };

      jwt.verify(
        token,
        getKey,
        { algorithms: ['RS256'], audience: audience as [string, ...string[]], issuer },
        (error, decoded) => {
          if (error || typeof decoded === 'string' || !decoded) {
            reject(error ?? new Error('Provider token claims are invalid.'));
            return;
          }
          resolve(decoded as ProviderClaims);
        },
      );
    });
  }

  private getAudiences(key: string): string[] {
    const rawValue = this.config.get<string>(key);
    const audiences = rawValue?.split(',').map((value) => value.trim()).filter(Boolean);
    if (!audiences?.length) {
      throw new ApiException(
        503,
        ApiErrorCode.INTERNAL_ERROR,
        '소셜 로그인 제공자 설정이 없습니다.',
      );
    }
    return audiences;
  }

  private toIdentity(
    provider: OAuthProvider,
    subject: string,
    email: string | undefined,
    verified: boolean | string | undefined,
  ): ExternalIdentity {
    return {
      provider,
      subject,
      email: email?.trim().toLowerCase() || null,
      emailVerified: verified === true || verified === 'true',
    };
  }
}
