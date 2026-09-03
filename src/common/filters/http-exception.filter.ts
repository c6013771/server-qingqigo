import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

/**
 * 全局异常过滤器：统一错误响应格式 { code, message, data: null }
 * - HttpException：code 取 HTTP 状态码，message 取异常信息（校验失败时为多条，拼接返回）
 * - 未知异常：code 500，不暴露内部错误细节
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const msg = typeof body === 'string' ? body : (body as any)?.message;
      message = Array.isArray(msg) ? msg.join('；') : (msg ?? exception.message);
    } else {
      console.error('未捕获异常:', exception);
    }

    res.status(status).json({ code: status, message, data: null });
  }
}
