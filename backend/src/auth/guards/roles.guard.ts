import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserAuthority } from '../../common/enums/user-authority.enum';

// Guard GLOBAL, REFUS PAR DÉFAUT : une route non publique doit déclarer
// explicitement les rôles autorisés (@Roles(...)), sinon l'accès est refusé (403).
// Un rôle sans droit défini (ex. assistant, reporté) n'a donc accès à rien.
// S'exécute après JwtAuthGuard : req.user est déjà relu en base (compte actif,
// rôle courant) par JwtStrategy.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserAuthority[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return false;
    }

    const { user } = context.switchToHttp().getRequest();
    return !!user && requiredRoles.includes(user.authority);
  }
}
