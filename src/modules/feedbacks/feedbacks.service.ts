import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

/** 返回给前端的字段（与前端 FeedbackItem 契约一致） */
const FEEDBACK_SELECT = {
  id: true,
  type: true,
  content: true,
  status: true,
  reply: true,
  createdAt: true,
} as const;

/** 反馈类型的中文标签（通知邮件用） */
const TYPE_LABELS: Record<string, string> = {
  feature: '功能建议',
  bug: '问题反馈',
  site: '站点收录',
};

/** 用户输入会拼进 HTML 邮件，转义防注入/防样式错乱 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class FeedbacksService {
  private readonly logger = new Logger(FeedbacksService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  /** 提交反馈（需登录）。落库后异步邮件通知运营方，通知失败不影响提交结果 */
  async create(dto: CreateFeedbackDto, userId: string) {
    const feedback = await this.prisma.feedback.create({
      data: {
        userId,
        type: dto.type,
        content: dto.content.trim(),
        contactEmail: dto.contact_email || null,
      },
      select: FEEDBACK_SELECT,
    });
    void this.notifyOperator(dto, feedback.createdAt).catch((e) =>
      this.logger.error(`反馈通知邮件发送失败: ${(e as Error).message}`),
    );
    return feedback;
  }

  /** 我的反馈列表（按创建时间倒序） */
  findMine(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: FEEDBACK_SELECT,
    });
  }

  /** 给运营邮箱发通知；未配置 MAIL_NOTIFY_EMAIL 或 SMTP 时静默跳过（反馈已落库，可后台补查） */
  private async notifyOperator(dto: CreateFeedbackDto, createdAt: Date) {
    const to = this.config.get<string>('mail.notifyEmail');
    if (!to || !this.mail.enabled) return;

    const typeLabel = TYPE_LABELS[dto.type] ?? dto.type;
    await this.mail.send(to, 'general', {
      title: `新的用户反馈（${typeLabel}）`,
      paragraphs: [
        `类型：${typeLabel}`,
        `联系邮箱：${dto.contact_email ? escapeHtml(dto.contact_email) : '（未留）'}`,
        `时间：${createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        `内容：${escapeHtml(dto.content.trim())}`,
      ],
    });
  }
}
