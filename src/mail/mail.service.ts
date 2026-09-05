import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { mailTemplates } from './templates';
import { MailTemplateId, MailTemplateParamsMap } from './templates/mail-templates.types';

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

  /**
   * 按模板发送邮件。模板在 src/mail/templates/ 注册，
   * params 类型由模板 ID 推导，传错参数编译期报错。
   */
  async send<K extends MailTemplateId>(to: string, template: K, params: MailTemplateParamsMap[K]): Promise<void> {
    if (!this.transporter) throw new ServiceUnavailableException('邮件服务未配置');
    const tpl = mailTemplates[template];
    try {
      await this.transporter.sendMail({
        from: `轻启er <${this.from}>`,
        to,
        subject: tpl.subject(params),
        html: tpl.html(params),
      });
    } catch (e) {
      this.logger.error(`邮件发送失败: ${(e as Error).message}`);
      throw new ServiceUnavailableException('邮件发送失败，请稍后重试');
    }
    this.logger.log(`邮件已发送至 ${to}（模板：${template}）`);
  }
}
