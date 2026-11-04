import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiErrorCode, ApiException } from '../common/errors/api-error';
import { AccessTokenClaims, AuthUser } from './auth.types';
import { TokenService } from './token.service';

type AuthenticatedRequest = { headers: { authorization?: string }; authUser?: AuthUser };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw this.unauthorized();
    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(match[1]);
      if (!(await this.tokens.validateAccessSession(claims))) throw this.unauthorized();
      request.authUser = { userId: claims.sub, sessionId: claims.sid };
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private unauthorized() { return new ApiException(401, ApiErrorCode.AUTH_TOKEN_INVALID, '인증 토큰이 유효하지 않거나 만료되었습니다.'); }
}
