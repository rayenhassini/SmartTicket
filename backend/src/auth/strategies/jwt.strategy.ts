import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  // Le JWT ne sert qu'à identifier l'utilisateur : le compte est relu en base à
  // chaque requête. Un compte supprimé ou désactivé (valid = false) est refusé
  // immédiatement (401) ; le rôle utilisé est celui de la base, pas celui figé
  // dans le token. Le retour de validate() est injecté dans req.user.
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findActiveById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Session invalide ou compte désactivé.');
    }
    return { userId: Number(user.id), email: user.email, authority: user.authority };
  }
}
