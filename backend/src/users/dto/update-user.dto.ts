import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// `password` est volontairement omis : la mise à jour du mot de passe
// doit passer par un endpoint dédié (hors scope V1), pas par PATCH /users/:id.
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}
