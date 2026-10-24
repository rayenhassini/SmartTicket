import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto, CreateInvitationDto, ListInvitationsQueryDto } from './dto/invitation.dto';

class ValidateQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;
}

// Écriture et lecture : PMO uniquement. Les deux seules routes publiques (validate, accept) sont
// limitées en débit par IP et n'exposent que le strict minimum.
@Roles(UserAuthority.PMO)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post()
  create(@Body() dto: CreateInvitationDto, @Request() req: { user: { userId: number } }) {
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  findAll(@Query() query: ListInvitationsQueryDto) {
    return this.service.findAll(query.status);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Get('validate')
  validate(@Query() query: ValidateQueryDto) {
    return this.service.validate(query.token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(201)
  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.service.accept(dto);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(id);
  }
}
