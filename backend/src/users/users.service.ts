import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { TeamsService } from '../teams/teams.service';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly teamsService: TeamsService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { password, ...rest } = dto;

    const user = this.usersRepository.create({
      ...rest,
      passwordHash,
    });
    return this.usersRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  // Utilisé par AuthService.bootstrap() pour vérifier que la table `users`
  // est vide avant d'autoriser la création du tout premier compte.
  count(): Promise<number> {
    return this.usersRepository.count();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    }
    return user;
  }

  // Utilisé par JwtStrategy à chaque requête authentifiée : renvoie null si le
  // compte n'existe plus ou est désactivé (valid = false).
  findActiveById(id: number | string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id: Number(id), valid: true } });
  }

  // Utilisé uniquement par AuthService : inclut le password_hash normalement exclu par défaut.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Phase 2 : un membre d'équipe est forcément un technicien actif.
    if (dto.authority !== undefined && dto.authority !== UserAuthority.TECHNICIAN) {
      await this.teamsService.assertNotMember(user.id, 'changer le rôle');
    }
    // valid = false sur un membre : retrait de l'équipe + succession éventuelle + sauvegarde
    // du compte dans la MÊME transaction (refusé en 409 s'il est le dernier membre).
    if (dto.valid === false) {
      const result = await this.teamsService.deactivateMember(user.id, (manager) => {
        Object.assign(user, dto);
        return manager.save(User, user);
      });
      if (result.handled && result.user) return result.user;
    }

    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    // Phase 2 : supprimer un membre contournerait les règles d'effectif (FK RESTRICT en base).
    await this.teamsService.assertNotMember(user.id, 'supprimer ce compte');
    await this.usersRepository.remove(user);
  }
}
