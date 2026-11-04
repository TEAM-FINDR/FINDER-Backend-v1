import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OAuthProvider } from '../auth.types';

export class EmailPasswordDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class EmailDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class VerifyEmailDto extends EmailDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(40)
  @MaxLength(200)
  refreshToken!: string;
}

export class SocialLoginDto {
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  idToken!: string;
}

export class OAuthProviderParamDto {
  @IsIn(['google', 'apple', 'kakao'])
  provider!: OAuthProvider;
}
