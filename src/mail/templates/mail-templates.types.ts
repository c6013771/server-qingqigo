/**
 * 邮件模板的类型定义。
 * 新增业务场景时，在 MailTemplateParamsMap 中登记模板 ID 与参数类型，
 * 调用方传错参数会在编译期直接报错。
 */
export interface MailTemplateParamsMap {
  /** 注册验证码 */
  'register-code': { code: string };
  /** 找回密码验证码 */
  'reset-code': { code: string };
  /** 通用通知（标题 + 正文段落） */
  general: { title: string; paragraphs: string[] };
}

export type MailTemplateId = keyof MailTemplateParamsMap;

/** 单个邮件模板：由参数渲染出主题与 HTML 正文 */
export interface MailTemplate<P> {
  subject: (params: P) => string;
  html: (params: P) => string;
}
