/**
 * 集中读取环境变量并做类型化处理，业务代码通过 ConfigService.get('xxx') 使用。
 * 注意：DATABASE_URL 由 Prisma 直接读取，无需在此声明。
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  qweather: {
    key: process.env.QWEATHER_API_KEY ?? '',
    // 和风天气 API Host：新版控制台为每个账号分配独立 Host（如 abcxyz.qweatherapi.com），
    // 旧版免费 key 使用 devapi.qweather.com
    host: process.env.QWEATHER_API_HOST ?? 'devapi.qweather.com',
  },
  amap: {
    // 高德开放平台 Key（Web 服务类型），用于 IP 定位；国内运营商 IP 比国外库准得多
    key: process.env.AMAP_API_KEY ?? '',
  },
  sites: {
    // 站点图标抓取失败时的兜底图：默认用前端的静态资源（相对前端源），也可配成完整 URL
    defaultIcon: process.env.SITE_DEFAULT_ICON ?? '/icons/_default.svg',
  },
  icons: {
    // 站点图标落盘目录（容器内建议挂卷持久化）
    dir: process.env.ICON_STORAGE_DIR ?? './storage/icons',
    // 图标对外访问的绝对地址前缀（如 https://api.qingqier.com）；为空则返回相对路径
    publicBase: process.env.ICON_PUBLIC_BASE_URL ?? '',
    // 图标防盗链白名单（逗号分隔的域名，如 qingqier.com,www.qingqier.com）；
    // 为空不限制；无 Referer 的直接访问始终放行
    allowedReferers: process.env.ICON_ALLOWED_REFERERS ?? '',
  },
  mail: {
    // SMTP 发信配置（QQ/163 邮箱用「授权码」而非登录密码，Gmail 用应用专用密码）
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '',
  },
});
