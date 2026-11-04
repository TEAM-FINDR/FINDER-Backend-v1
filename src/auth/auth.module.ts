import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './auth.guard';
import { AuthChallengeEntity } from './entities/auth-challenge.entity';
import { AuthIdentityEntity } from './entities/auth-identity.entity';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { UserEntity } from './entities/user.entity';
import { EmailService } from './email.service';
import { OAuthVerifierService } from './oauth-verifier.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthRepository } from '../database/repositories/auth.repository';
import { TypeOrmAuthRepository } from '../database/repositories/typeorm-auth.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AuthIdentityEntity, AuthSessionEntity, AuthChallengeEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    EmailService,
    OAuthVerifierService,
    AccessTokenGuard,
    { provide: AuthRepository, useClass: TypeOrmAuthRepository },
  ],
  exports: [AccessTokenGuard],
})
export class AuthModule {}
