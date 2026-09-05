import { MailTemplate, MailTemplateId, MailTemplateParamsMap } from './mail-templates.types';
import { registerCodeTemplate } from './register-code.template';
import { resetCodeTemplate } from './reset-code.template';
import { generalTemplate } from './general.template';

/**
 * 邮件模板注册表。
 * 新增业务场景：新建一个 .template.ts → 在 MailTemplateParamsMap 登记参数类型 → 这里加一行。
 */
export const mailTemplates: { [K in MailTemplateId]: MailTemplate<MailTemplateParamsMap[K]> } = {
  'register-code': registerCodeTemplate,
  'reset-code': resetCodeTemplate,
  general: generalTemplate,
};
