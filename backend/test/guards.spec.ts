import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { Public } from '../src/auth/decorators/public.decorator';
import { UserAuthority } from '../src/common/enums/user-authority.enum';

class NoRoleController {
  handler() {}
}
@Roles(UserAuthority.PMO)
class PmoController {
  handler() {}
}
class PublicController {
  @Public()
  handler() {}
}

function ctx(cls: any, user?: any): any {
  return {
    getClass: () => cls,
    getHandler: () => cls.prototype.handler,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

describe('RolesGuard — refus par défaut', () => {
  const guard = new RolesGuard(new Reflector());

  it('refuse une route sans @Roles, même pour un PMO', () => {
    expect(guard.canActivate(ctx(NoRoleController, { authority: 'pmo' }))).toBe(false);
  });
  it('refuse client, technicien et assistant sur une route PMO', () => {
    for (const authority of ['client', 'technician', 'assistant', 'commercial', 'helpdeskUser']) {
      expect(guard.canActivate(ctx(PmoController, { authority }))).toBe(false);
    }
  });
  it('autorise le PMO sur une route PMO', () => {
    expect(guard.canActivate(ctx(PmoController, { authority: 'pmo' }))).toBe(true);
  });
  it('refuse sans utilisateur', () => {
    expect(guard.canActivate(ctx(PmoController))).toBe(false);
  });
  it('laisse passer une route @Public()', () => {
    expect(guard.canActivate(ctx(PublicController))).toBe(true);
  });
});

describe('JwtAuthGuard', () => {
  it('laisse passer une route @Public() sans token', () => {
    const guard = new JwtAuthGuard(new Reflector());
    expect(guard.canActivate(ctx(PublicController))).toBe(true);
  });
});
