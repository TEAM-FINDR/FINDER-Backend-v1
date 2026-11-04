export interface AuthUser {
  userId: string;
  sessionId: string;
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  typ: 'access';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  profileCompleted: boolean;
}

export type OAuthProvider = 'google' | 'apple' | 'kakao';

export interface ExternalIdentity {
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
}
