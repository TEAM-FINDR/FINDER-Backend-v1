import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly webAppUrl: string;

  constructor(config: ConfigService) {
    const port = config.getOrThrow<number>('SMTP_PORT');
    const username = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      ...(username && password ? { auth: { user: username, pass: password } } : {}),
    });
    this.from = config.getOrThrow<string>('EMAIL_FROM');
    this.webAppUrl = config.getOrThrow<string>('WEB_APP_URL').replace(/\/$/, '');
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'FINDR 이메일 인증 코드',
      text: `이메일 인증 코드는 ${code}입니다. 10분 안에 입력해 주세요.`,
      html: `<p>이메일 인증 코드는 <strong>${code}</strong>입니다.</p><p>10분 안에 입력해 주세요.</p>`,
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const resetUrl = `${this.webAppUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'FINDR 비밀번호 재설정',
      text: `비밀번호를 재설정하려면 다음 링크를 이용해 주세요. 30분 후 만료됩니다: ${resetUrl}`,
      html: `<p><a href="${resetUrl}">비밀번호 재설정</a></p><p>링크는 30분 후 만료됩니다.</p>`,
    });
  }
}
