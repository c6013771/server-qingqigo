import { MailTemplate, MailTemplateParamsMap } from './mail-templates.types';
import { wrapLayout } from './layout';

type Params = MailTemplateParamsMap['reset-code'];

/** 找回密码验证码 */
export const resetCodeTemplate: MailTemplate<Params> = {
  subject: (p) => `【轻启er】重置密码验证码：${p.code}`,
  html: (p) =>
    wrapLayout(`
    <h2 style="margin:0 0 16px">轻启er 重置密码</h2>
    <p style="margin:0 0 8px">你正在重置轻启er 账号的密码，验证码为：</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${p.code}</p>
    <p style="margin:0;color:#6C757D">验证码 10 分钟内有效，请勿泄露给他人。如果这不是你的操作，请尽快检查账号安全。</p>`),
};
