import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { ApiErrorCode, ApiException } from '../common/errors/api-error';
import { AuthChallengeEntity } from './entities/auth-challenge.entity';
import { AuthIdentityEntity } from './entities/auth-identity.entity';
import { UserEntity } from './entities/user.entity';
import { EMAIL_VERIFICATION_PURPOSE, PASSWORD_RESET_PURPOSE } from './auth.constants';
import { ExternalIdentity, OAuthProvider } from './auth.types';
import { EmailService } from './email.service';
import { OAuthVerifierService } from './oauth-verifier.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailPasswordDto, EmailDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthIdentityEntity) private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(AuthChallengeEntity) private readonly challenges: Repository<AuthChallengeEntity>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    private readonly oauth: OAuthVerifierService,
    private readonly config: ConfigService,
  ) {}

  async register(input: EmailPasswordDto) {
    const email = this.normalizeEmail(input.email);
    if (await this.users.findOneBy({ email })) throw this.conflict('이미 사용 중인 이메일입니다.');
    const user = await this.users.save(this.users.create({ email, passwordHash: await this.passwords.hash(input.password), emailVerifiedAt: null, profileCompleted: false }));
    await this.issueVerification(email, user.id);
    return { message: '인증 코드를 이메일로 보냈습니다.' };
  }

  async sendVerification(input: EmailDto) {
    const email = this.normalizeEmail(input.email);
    const user = await this.users.findOneBy({ email });
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
    const challenge = await this.findChallenge(email, EMAIL_VERIFICATION_PURPOSE, input.code);
    if (!challenge?.userId) throw this.invalidChallenge();
    const user = await this.users.findOneBy({ id: challenge.userId, email });
    if (!user) throw this.invalidChallenge();
    const consumed = await this.consumeChallenge(challenge);
    if (!consumed) throw this.invalidChallenge();
    user.emailVerifiedAt ??= new Date();
    await this.users.save(user);
    return this.tokens.createSession(user);
  }

  async login(input: EmailPasswordDto) {
    const user = await this.users.findOneBy({ email: this.normalizeEmail(input.email) });
    if (!user?.passwordHash || !(await this.passwords.verify(user.passwordHash, input.password))) {
      throw new ApiException(401, ApiErrorCode.AUTH_TOKEN_INVALID, '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    if (!user.emailVerifiedAt) throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, '이메일 인증을 완료해 주세요.');
    return this.tokens.createSession(user);
  }

  async getCurrentUser(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true, profileCompleted: true, createdAt: true },
    });
    if (!user) throw new ApiException(404, ApiErrorCode.RESOURCE_NOT_FOUND, '사용자를 찾을 수 없습니다.');
    return user;
  }

  async socialLogin(provider: OAuthProvider, idToken: string) {
    const external = await this.oauth.verify(provider, idToken);
    let identity = await this.identities.findOneBy({ provider, providerSubject: external.subject });
    let user = identity ? await this.users.findOneBy({ id: identity.userId }) : null;
    if (!user) {
      user = await this.createSocialUser(external);
      identity = this.identities.create({ userId: user.id, provider, providerSubject: external.subject });
      await this.identities.save(identity);
    }
    return this.tokens.createSession(user);
  }

  async requestPasswordReset(input: EmailDto) {
    const email = this.normalizeEmail(input.email);
    const user = await this.users.findOneBy({ email });
    if (user?.passwordHash && user.emailVerifiedAt) {
      const rawToken = randomBytes(32).toString('base64url');
      await this.storeChallenge(email, PASSWORD_RESET_PURPOSE, this.hashChallenge(rawToken), new Date(Date.now() + 30 * 60_000), user.id);
      await this.email.sendPasswordReset(email, rawToken);
    }
    return { message: '계정이 존재하는 경우 비밀번호 재설정 안내를 이메일로 보냈습니다.' };
  }

  async resetPassword(input: ResetPasswordDto) {
    const hash = this.hashChallenge(input.token);
    const challenge = await this.challenges.findOne({ where: { purpose: PASSWORD_RESET_PURPOSE, tokenHash: hash, consumedAt: IsNull(), expiresAt: MoreThan(new Date()) } });
    if (!challenge?.userId) throw this.invalidChallenge();
    const consumed = await this.consumeChallenge(challenge);
    if (!consumed) throw this.invalidChallenge();
    await this.users.update({ id: challenge.userId }, { passwordHash: await this.passwords.hash(input.newPassword) });
    await this.tokens.revokeAllSessions(challenge.userId);
    return { message: '비밀번호를 변경했습니다.' };
  }

  private async issueVerification(email: string, userId: string) {
    const recent = await this.challenges.findOne({ where: { email, purpose: EMAIL_VERIFICATION_PURPOSE, createdAt: MoreThan(new Date(Date.now() - 60_000)) } });
    if (recent) throw new ApiException(429, ApiErrorCode.RATE_LIMITED, '인증 코드는 1분 후 다시 요청할 수 있습니다.');
    const code = randomIntCode();
    await this.storeChallenge(email, EMAIL_VERIFICATION_PURPOSE, this.hashChallenge(code), new Date(Date.now() + 10 * 60_000), userId);
    await this.email.sendVerificationCode(email, code);
  }

  private async storeChallenge(email: string, purpose: string, tokenHash: string, expiresAt: Date, userId: string | null) {
    await this.challenges.update({ email, purpose, consumedAt: IsNull() }, { consumedAt: new Date() });
    await this.challenges.save(this.challenges.create({ email, purpose, tokenHash, expiresAt, userId, consumedAt: null }));
  }

  private async findChallenge(email: string, purpose: string, code: string) {
    return this.challenges.findOne({ where: { email, purpose, tokenHash: this.hashChallenge(code), consumedAt: IsNull(), expiresAt: MoreThan(new Date()) } });
  }

  private async consumeChallenge(challenge: AuthChallengeEntity) {
    const result = await this.challenges.update({ id: challenge.id, consumedAt: IsNull(), expiresAt: MoreThan(new Date()) }, { consumedAt: new Date() });
    return result.affected === 1;
  }

  private async createSocialUser(external: ExternalIdentity) {
    const email = external.emailVerified ? external.email : null;
    if (email) {
      const existing = await this.users.findOneBy({ email });
      if (existing) {
        if (!existing.emailVerifiedAt) throw new ApiException(409, ApiErrorCode.RESOURCE_CONFLICT, '해당 이메일의 기존 계정을 먼저 인증해 주세요.');
        return existing;
      }
    }
    return this.users.save(this.users.create({ email, passwordHash: null, emailVerifiedAt: email ? new Date() : null, profileCompleted: false }));
  }

  private hashChallenge(value: string) { return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET')).update(value).digest('hex'); }
  private normalizeEmail(value: string) { return value.trim().toLowerCase(); }
  private invalidChallenge() { return new ApiException(400, ApiErrorCode.INVALID_REQUEST, '인증 정보가 유효하지 않거나 만료되었습니다.'); }
  private conflict(message: string) { return new ApiException(409, ApiErrorCode.RESOURCE_CONFLICT, message); }
}

function randomIntCode() { return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0'); }
