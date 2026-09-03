import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.secret', 'dev-secret-do-not-use-in-prod'),
    });
  }

  /** 校验通过后的返回值会挂载到 request.user */
  validate(payload: { sub: string; email?: string; role: string }): AuthUser {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
