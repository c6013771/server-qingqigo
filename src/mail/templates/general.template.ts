import { MailTemplate, MailTemplateParamsMap } from './mail-templates.types';
import { wrapLayout } from './layout';

type Params = MailTemplateParamsMap['general'];

/** 通用通知：标题 + 若干正文段落，适合系统通知、运营邮件等非验证码场景 */
export const generalTemplate: MailTemplate<Params> = {
  subject: (p) => `【轻启er】${p.title}`,
  html: (p) =>
    wrapLayout(`
    <h2 style="margin:0 0 16px">${p.title}</h2>
    ${p.paragraphs.map((text) => `<p style="margin:0 0 8px">${text}</p>`).join('')}`),
};
