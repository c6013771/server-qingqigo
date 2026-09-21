import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { isAbsolute, resolve } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // 站点图标静态目录：useStaticAssets 作用在 express 层，不受全局 /api 前缀影响
  const iconDirCfg = config.get<string>('icons.dir', './storage/icons');
  // 图标防盗链：配置了白名单后，仅白名单域名的页面可引用图标；无 Referer 的直接访问放行
  // 配置项容忍写成完整 URL（如 https://www.qingqier.com），统一归一化为纯域名再比对
  const allowedReferers = (config.get<string>('icons.allowedReferers', '') as string)
    .split(',')
    .map((s) => {
      const v = s.trim().toLowerCase().replace(/\/+$/, '');
      if (!v) return '';
      try {
        return new URL(v.includes('://') ? v : `https://${v}`).hostname;
      } catch {
        return v;
      }
    })
    .filter(Boolean);
  if (allowedReferers.length) {
    app.use('/site-icons', (req: Request, res: Response, next: NextFunction) => {
      const referer = req.headers.referer;
      if (!referer) return next(); // 直接访问/隐私模式无 Referer，放行
      let host = '';
      try {
        host = new URL(referer).hostname.toLowerCase();
      } catch {
        return next(); // Referer 无法解析时不误伤
      }
      if (allowedReferers.some((d) => host === d || host.endsWith('.' + d))) return next();
      res.status(403).json({ code: 403, message: '禁止外部站点引用', data: null });
    });
  }
  app.useStaticAssets(isAbsolute(iconDirCfg) ? iconDirCfg : resolve(process.cwd(), iconDirCfg), {
    prefix: '/site-icons/',
    maxAge: '30d',
    immutable: true,
  });
  // CORS：只允许自己的前端域名跨域调用（本地开发保留 Astro 默认端口）
  app.enableCors({
    origin: [
      'https://qingqier.com',
      'https://www.qingqier.com',
      'http://localhost:4321',
      'http://127.0.0.1:4321',
    ],
  });
  // 全局参数校验：自动剔除未声明字段、按 DTO 类型转换
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // 统一错误响应：{ code, message, data: null }
  app.useGlobalFilters(new HttpExceptionFilter());
  // 统一成功响应：{ code: 0, message: 'ok', data }
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger 接口文档：http://localhost:3000/api-docs
  // 注意挂载路径不带全局前缀 /api，避免与业务路由冲突
  const swaggerConfig = new DocumentBuilder()
    .setTitle('轻启er API 文档')
    .setDescription('「轻启er（QingQiEr）」清爽导航主页后端接口文档。统一响应格式：{ code, message, data }。')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    // 刷新页面后保留已填写的 Token，便于调试需登录的接口
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('port', 3000);
  await app.listen(port);
  console.log(`服务已启动: http://localhost:${port}/api`);
  console.log(`接口文档: http://localhost:${port}/api-docs`);
}

bootstrap();
