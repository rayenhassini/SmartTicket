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
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { LinkEquipmentDto } from './dto/link-equipment.dto';
import { LinkEquipmentSoftDto } from './dto/link-equipment-soft.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';

@Roles(UserAuthority.PMO)
@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Post()
  create(@Body() dto: CreateSiteDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSiteDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/equipment')
  linkEquipment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkEquipmentDto,
  ) {
    return this.service.linkEquipment(id, dto);
  }

  @Delete(':id/equipment/:equipmentId')
  unlinkEquipment(
    @Param('id', ParseIntPipe) id: number,
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
  ) {
    return this.service.unlinkEquipment(id, equipmentId);
  }

  @Post(':id/equipment-softs')
  linkEquipmentSoft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkEquipmentSoftDto,
  ) {
    return this.service.linkEquipmentSoft(id, dto);
  }

  @Delete(':id/equipment-softs/:equipmentSoftId')
  unlinkEquipmentSoft(
    @Param('id', ParseIntPipe) id: number,
    @Param('equipmentSoftId', ParseIntPipe) equipmentSoftId: number,
  ) {
    return this.service.unlinkEquipmentSoft(id, equipmentSoftId);
  }
}
