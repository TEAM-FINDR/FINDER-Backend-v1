import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import { ApiErrorCode, ApiException } from '../common/errors/api-error';
import { EMAIL_VERIFICATION_PURPOSE, PASSWORD_RESET_PURPOSE } from './auth.constants';
import { ExternalIdentity, OAuthProvider } from './auth.types';
import { EmailService } from './email.service';
import { OAuthVerifierService } from './oauth-verifier.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailPasswordDto, EmailDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import { AuthRepository } from './ports/auth.repository';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    private readonly oauth: OAuthVerifierService,
    private readonly config: ConfigService,
  ) {}

  async register(input: EmailPasswordDto) {
    const email = this.normalizeEmail(input.email);
    if (await this.repository.findUserByEmail(email)) throw this.conflict('이미 사용 중인 이메일입니다.');
    const user = await this.repository.createUser({ email, passwordHash: await this.passwords.hash(input.password), emailVerifiedAt: null, profileCompleted: false });
    await this.issueVerification(email, user.id);
    return { message: '인증 코드를 이메일로 보냈습니다.' };
  }

  async sendVerification(input: EmailDto) {
    const email = this.normalizeEmail(input.email);
    const user = await this.repository.findUserByEmail(email);
    if (user && !user.emailVerifiedAt) {
      try {
        await this.issueVerification(email, user.id);
      } catch (error) {
        if (!(error instanceof ApiException) || error.code !== ApiErrorCode.RATE_LIMITED) throw error;
      }
    }
    return { message: '인증 코드를 받을 수 있는 경우 이메일로 보냈습니다.' };
  }

  async verifyEmail(input: VerifyEmailDto) {
    const email = this.normalizeEmail(input.email);
    const user = await this.repository.verifyEmail(email, this.hashChallenge(input.code), new Date());
    if (!user) throw this.invalidChallenge();
    return this.tokens.createSession(user);
  }

  async login(input: EmailPasswordDto) {
    const user = await this.repository.findUserByEmail(this.normalizeEmail(input.email));
    if (!user?.passwordHash || !(await this.passwords.verify(user.passwordHash, input.password))) {
      throw new ApiException(401, ApiErrorCode.AUTH_TOKEN_INVALID, '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    if (!user.emailVerifiedAt) throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, '이메일 인증을 완료해 주세요.');
    return this.tokens.createSession(user);
  }

  async getCurrentUser(userId: string) {
    const user = await this.repository.getCurrentUser(userId);
    if (!user) throw new ApiException(404, ApiErrorCode.RESOURCE_NOT_FOUND, '사용자를 찾을 수 없습니다.');
    return user;
  }

  async socialLogin(provider: OAuthProvider, idToken: string) {
    const external = await this.oauth.verify(provider, idToken);
    const identity = await this.repository.findIdentity(provider, external.subject);
    let user = identity ? await this.repository.findUserById(identity.userId) : null;
    if (!user) user = await this.createSocialUser(external, provider);
    return this.tokens.createSession(user);
  }

  async requestPasswordReset(input: EmailDto) {
    const email = this.normalizeEmail(input.email);
    const user = await this.repository.findUserByEmail(email);
    if (user?.passwordHash && user.emailVerifiedAt) {
      const rawToken = randomBytes(32).toString('base64url');
      await this.storeChallenge(email, PASSWORD_RESET_PURPOSE, this.hashChallenge(rawToken), new Date(Date.now() + 30 * 60_000), user.id);
      await this.email.sendPasswordReset(email, rawToken);
    }
    return { message: '계정이 존재하는 경우 비밀번호 재설정 안내를 이메일로 보냈습니다.' };
  }

  async resetPassword(input: ResetPasswordDto) {
    const hash = this.hashChallenge(input.token);
    const updated = await this.repository.resetPassword(hash, await this.passwords.hash(input.newPassword), new Date());
    if (!updated) throw this.invalidChallenge();
    // The password update and session revocation are committed atomically by the repository.
    return { message: '비밀번호를 변경했습니다.' };
  }

  private async issueVerification(email: string, userId: string) {
    const code = randomIntCode();
    const stored = await this.storeChallenge(email, EMAIL_VERIFICATION_PURPOSE, this.hashChallenge(code), new Date(Date.now() + 10 * 60_000), userId, 60_000);
    if (!stored) throw new ApiException(429, ApiErrorCode.RATE_LIMITED, '인증 코드는 1분 후 다시 요청할 수 있습니다.');
    await this.email.sendVerificationCode(email, code);
  }

  private storeChallenge(email: string, purpose: string, tokenHash: string, expiresAt: Date, userId: string | null, minimumIntervalMs?: number) {
    return this.repository.replaceChallenge({ email, purpose, tokenHash, expiresAt, userId }, new Date(), minimumIntervalMs);
  }

  private async createSocialUser(external: ExternalIdentity, provider: OAuthProvider) {
    const email = external.emailVerified ? external.email : null;
    if (email) {
      const existing = await this.repository.findUserByEmail(email);
      if (existing) {
        if (!existing.emailVerifiedAt) throw new ApiException(409, ApiErrorCode.RESOURCE_CONFLICT, '해당 이메일의 기존 계정을 먼저 인증해 주세요.');
        await this.repository.createIdentity(existing.id, provider, external.subject);
        return existing;
      }
    }
    return this.repository.createSocialUserWithIdentity(
      { email, passwordHash: null, emailVerifiedAt: email ? new Date() : null, profileCompleted: false },
      provider,
      external.subject,
    );
  }

  private hashChallenge(value: string) { return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET')).update(value).digest('hex'); }
  private normalizeEmail(value: string) { return value.trim().toLowerCase(); }
  private invalidChallenge() { return new ApiException(400, ApiErrorCode.INVALID_REQUEST, '인증 정보가 유효하지 않거나 만료되었습니다.'); }
  private conflict(message: string) { return new ApiException(409, ApiErrorCode.RESOURCE_CONFLICT, message); }
}

function randomIntCode() { return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0'); }
