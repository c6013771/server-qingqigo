import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 必须登录：无 token 或 token 无效时返回 401 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
