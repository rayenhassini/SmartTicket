import { SetMetadata } from '@nestjs/common';
import { UserAuthority } from '../../common/enums/user-authority.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserAuthority[]) => SetMetadata(ROLES_KEY, roles);
