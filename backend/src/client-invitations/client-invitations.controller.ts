import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { ClientInvitationsService } from './client-invitations.service';
import {
  AcceptClientInvitationDto,
  CreateClientInvitationDto,
  ListClientInvitationsQueryDto,
  ValidateClientInvitationQueryDto,
} from './dto/client-invitation.dto';

// Création / liste / annulation : PMO uniquement. Les deux routes publiques (validate, accept)
// sont limitées en débit par IP et n'exposent que le strict minimum.
@Roles(UserAuthority.PMO)
@Controller('client-invitations')
export class ClientInvitationsController {
  constructor(private readonly service: ClientInvitationsService) {}

  @Post()
  create(@Body() dto: CreateClientInvitationDto, @Request() req: { user: { userId: number } }) {
    return this.service.create(dto.email, req.user.userId);
  }

  @Get()
  findAll(@Query() query: ListClientInvitationsQueryDto) {
    return this.service.findAll(query.status);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Get('validate')
  validate(@Query() query: ValidateClientInvitationQueryDto) {
    return this.service.validate(query.token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(201)
  @Post('accept')
  accept(@Body() dto: AcceptClientInvitationDto) {
    return this.service.accept(dto);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancel(id);
  }
}
