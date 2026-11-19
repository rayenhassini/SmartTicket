import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';

@Roles(UserAuthority.PMO)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    // Les comptes se créent par invitation (technicien, client) ou par succession (PMO). Cette route reste
    // disponible uniquement pour les jeux de données de test (ALLOW_DIRECT_USER_CREATION=true, interdit en production).
    if (!this.config.get<boolean>('users.allowDirectCreation')) {
      throw new ForbiddenException({
        statusCode: 403, error: 'Forbidden', code: 'DIRECT_USER_CREATION_DISABLED',
        message: 'Création directe désactivée : les techniciens et clients sont créés par invitation, le PMO par succession.',
      });
    }
    return this.usersService.create(dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() me: { userId: number },
  ) {
    return this.usersService.update(id, dto, me?.userId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() me: { userId: number },
  ) {
    return this.usersService.remove(id, me?.userId);
  }
}
