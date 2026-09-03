import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

/** 管理员校验：需先经过 JwtAuthGuard，依据 JWT payload 中的 role 字段判断 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user?.role !== 'admin') throw new ForbiddenException('需要管理员权限');
    return true;
  }
}
