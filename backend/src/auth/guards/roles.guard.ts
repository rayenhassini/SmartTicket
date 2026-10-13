import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserAuthority } from '../../common/enums/user-authority.enum';

// Guard optionnel : à combiner avec JwtAuthGuard sur les endpoints qui
// doivent être restreints à certains rôles (@Roles(UserAuthority.PMO) par ex).
// Non appliqué globalement en V1 — à activer endpoint par endpoint si besoin.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserAuthority[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.authority);
  }
}
