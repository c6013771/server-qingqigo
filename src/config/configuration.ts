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
});
