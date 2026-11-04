import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth.types';
import { EmailDto, EmailPasswordDto, RefreshTokenDto, ResetPasswordDto, SocialLoginDto, VerifyEmailDto } from './dto/auth.dto';
import { TokenService } from './token.service';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly tokens: TokenService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: '이메일 회원가입 및 인증 코드 발송' })
  register(@Body() input: EmailPasswordDto) { return this.auth.register(input); }

  @Post('email/send-code')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  sendVerification(@Body() input: EmailDto) { return this.auth.sendVerification(input); }

  @Post('email/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyEmail(@Body() input: VerifyEmailDto) { return this.auth.verifyEmail(input); }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() input: EmailPasswordDto) { return this.auth.login(input); }

  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  googleLogin(@Body() input: SocialLoginDto) { return this.auth.socialLogin('google', input.idToken); }

  @Post('apple')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  appleLogin(@Body() input: SocialLoginDto) { return this.auth.socialLogin('apple', input.idToken); }

  @Post('kakao')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  kakaoLogin(@Body() input: SocialLoginDto) { return this.auth.socialLogin('kakao', input.idToken); }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() input: RefreshTokenDto) { return this.tokens.rotateRefreshToken(input.refreshToken); }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  logout(@CurrentUser() user: AuthUser) {
    return this.tokens.revokeSession(user.sessionId, user.userId).then(() => ({ message: '로그아웃했습니다.' }));
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  currentUser(@CurrentUser() user: AuthUser) { return this.auth.getCurrentUser(user.userId); }

  @Post('password/reset-request')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestPasswordReset(@Body() input: EmailDto) { return this.auth.requestPasswordReset(input); }

  @Post('password/reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() input: ResetPasswordDto) { return this.auth.resetPassword(input); }
}
