import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { EquipmentSoftsService } from './equipment-softs.service';
import { CreateEquipmentSoftDto } from './dto/create-equipment-soft.dto';
import { UpdateEquipmentSoftDto } from './dto/update-equipment-soft.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';

@Roles(UserAuthority.PMO)
@Controller('equipment-softs')
export class EquipmentSoftsController {
  constructor(private readonly service: EquipmentSoftsService) {}

  @Post()
  create(@Body() dto: CreateEquipmentSoftDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEquipmentSoftDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/type-supports')
  linkTypeSupport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkTypeSupportDto,
  ) {
    return this.service.linkTypeSupport(id, dto);
  }

  @Delete(':id/type-supports/:linkId')
  unlinkTypeSupport(
    @Param('id', ParseIntPipe) id: number,
    @Param('linkId', ParseIntPipe) linkId: number,
  ) {
    return this.service.unlinkTypeSupport(id, linkId);
  }
}
