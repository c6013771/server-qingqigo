import { MailTemplate, MailTemplateParamsMap } from './mail-templates.types';
import { wrapLayout } from './layout';

type Params = MailTemplateParamsMap['register-code'];

/** 注册验证码 */
export const registerCodeTemplate: MailTemplate<Params> = {
  subject: (p) => `【轻启er】注册验证码：${p.code}`,
  html: (p) =>
    wrapLayout(`
    <h2 style="margin:0 0 16px">轻启er 邮箱验证</h2>
    <p style="margin:0 0 8px">你正在注册轻启er 账号，验证码为：</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${p.code}</p>
    <p style="margin:0;color:#6C757D">验证码 10 分钟内有效，请勿泄露给他人。</p>`),
};
