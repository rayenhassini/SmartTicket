import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { BootstrapAuthority, BootstrapUserDto } from './dto/bootstrap-user.dto';

export interface JwtPayload {
  sub: number;
  email: string;
  authority: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    if (!user.valid) {
      throw new UnauthorizedException('Compte désactivé.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    return user;
  }

  // Amorce le tout premier compte de l'application. N'accepte aucune requête
  // si la table `users` contient déjà au moins une ligne (0 ligne = seul cas
  // autorisé). Volontairement non protégé par JwtAuthGuard : c'est le seul
  // moyen de créer un compte avant qu'un token n'existe.
  async bootstrap(dto: BootstrapUserDto) {
    const existingCount = await this.usersService.count();
    if (existingCount > 0) {
      throw new ConflictException(
        'Bootstrap refusé : un ou plusieurs comptes existent déjà. Utilisez POST /auth/login ou, une fois authentifié, POST /users.',
      );
    }

    const authority = dto.authority ?? BootstrapAuthority.PMO;

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      authority: authority as unknown as UserAuthority,
      valid: true,
    });

    return this.login(user);
  }

  login(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      authority: user.authority,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        authority: user.authority,
      },
    };
  }
}
