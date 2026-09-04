import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * SMTP 邮件服务。未配置 SMTP_HOST/USER/PASS 时 enabled=false，
 * 调用方应据此返回「邮件服务未配置」而不是静默失败。
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = '';

  constructor(config: ConfigService) {
    const host = config.get<string>('mail.host') ?? '';
    const port = config.get<number>('mail.port', 465);
    const user = config.get<string>('mail.user') ?? '';
    const pass = config.get<string>('mail.pass') ?? '';
    this.from = config.get<string>('mail.from') || user;
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 走 SSL，587 走 STARTTLS
        auth: { user, pass },
      });
    } else {
      this.logger.warn('未配置 SMTP（SMTP_HOST/SMTP_USER/SMTP_PASS），邮件发送不可用');
    }
  }

  get enabled(): boolean {
    return !!this.transporter;
  }

  /** 发送注册验证码 */
  async sendVerifyCode(to: string, code: string): Promise<void> {
    if (!this.transporter) throw new ServiceUnavailableException('邮件服务未配置');
    await this.transporter.sendMail({
      from: `轻启go <${this.from}>`,
      to,
      subject: `轻启go 注册验证码：${code}`,
      html: `
        <div style="max-width:480px;margin:0 auto;padding:32px;font-family:system-ui,sans-serif;color:#1A1A2E">
          <h2 style="margin:0 0 16px">轻启go 邮箱验证</h2>
          <p style="margin:0 0 8px">你正在注册轻启go 账号，验证码为：</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
          <p style="margin:0 0 8px;color:#6C757D">验证码 10 分钟内有效，请勿泄露给他人。</p>
          <p style="margin:0;color:#ADB5BD;font-size:12px">如果这不是你的操作，请忽略本邮件。</p>
        </div>`,
    });
    this.logger.log(`验证码邮件已发送至 ${to}`);
  }
}
