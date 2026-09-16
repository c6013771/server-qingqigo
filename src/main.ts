import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
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

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3000);
  await app.listen(port);
  console.log(`服务已启动: http://localhost:${port}/api`);
  console.log(`接口文档: http://localhost:${port}/api-docs`);
}

bootstrap();
