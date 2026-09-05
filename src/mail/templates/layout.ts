/**
 * 所有邮件共用的品牌布局：480px 卡片 + 统一配色 + 页脚提示。
 * 各模板只需提供正文内容，保证视觉统一。
 */
export function wrapLayout(content: string): string {
  return `
  <div style="max-width:480px;margin:0 auto;padding:32px;font-family:system-ui,sans-serif;color:#1A1A2E">
    ${content}
    <p style="margin:24px 0 0;color:#ADB5BD;font-size:12px">如果非您本人操作，请忽略该邮件。</p>
  </div>`;
}
