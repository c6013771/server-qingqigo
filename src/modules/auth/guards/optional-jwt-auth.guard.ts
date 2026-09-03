import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 可选登录：带了有效 token 则解析出用户，否则按匿名放行 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user ?? null;
  }
}
