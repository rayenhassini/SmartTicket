import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { AcceptSuccessionDto, CreateResignationDto, ValidateSuccessionQueryDto } from './dto/pmo-succession.dto';
import { PmoSuccessionService } from './pmo-succession.service';

// Démission / annulation / état : PMO uniquement. Les deux routes publiques (validate, accept) sont limitées
// en débit par IP et n'exposent que le strict minimum ; l'accès repose sur le jeton à usage unique.
@Roles(UserAuthority.PMO)
@Controller('pmo')
export class PmoSuccessionController {
  constructor(private readonly service: PmoSuccessionService) {}

  @Post('resignation')
  create(@Body() dto: CreateResignationDto, @CurrentUser() me: { userId: number }) {
    return this.service.create(dto.successorEmail, me.userId);
  }

  @Get('resignation')
  current() {
    return this.service.current();
  }

  @HttpCode(200)
  @Post('resignation/cancel')
  cancel() {
    return this.service.cancel();
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Get('succession/validate')
  validate(@Query() query: ValidateSuccessionQueryDto) {
    return this.service.validate(query.token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(201)
  @Post('succession/accept')
  accept(@Body() dto: AcceptSuccessionDto) {
    return this.service.accept(dto);
  }
}
