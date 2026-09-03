import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JWT 校验通过后挂载到 request.user 上的用户信息 */
export interface AuthUser {
  id: string;
  email?: string;
  role: string;
}

/** 取当前登录用户：@CurrentUser() user: AuthUser（匿名接口下为 null） */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as AuthUser | null;
});
