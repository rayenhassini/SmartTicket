import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { LinkClientDto } from './dto/link-client.dto';
import { LinkTechnicianDto } from './dto/link-technician.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  create(@Body() dto: CreateContractDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContractDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/clients')
  linkClient(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkClientDto) {
    return this.service.linkClient(id, dto);
  }

  @Delete(':id/clients/:clientId')
  unlinkClient(
    @Param('id', ParseIntPipe) id: number,
    @Param('clientId', ParseIntPipe) clientId: number,
  ) {
    return this.service.unlinkClient(id, clientId);
  }

  @Post(':id/technicians')
  linkTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkTechnicianDto,
  ) {
    return this.service.linkTechnician(id, dto);
  }

  @Delete(':id/technicians/:technicianId')
  unlinkTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Param('technicianId', ParseIntPipe) technicianId: number,
  ) {
    return this.service.unlinkTechnician(id, technicianId);
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
