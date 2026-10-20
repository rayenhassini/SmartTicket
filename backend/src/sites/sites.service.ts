import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { EquipmentSoft } from '../equipment-softs/entities/equipment-soft.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { LinkEquipmentDto } from './dto/link-equipment.dto';
import { LinkEquipmentSoftDto } from './dto/link-equipment-soft.dto';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly sitesRepository: Repository<Site>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(EquipmentSoft)
    private readonly equipmentSoftRepository: Repository<EquipmentSoft>,
  ) {}

  create(dto: CreateSiteDto): Promise<Site> {
    const entity = this.sitesRepository.create(dto);
    return this.sitesRepository.save(entity);
  }

  findAll(): Promise<Site[]> {
    return this.sitesRepository.find({ relations: ['equipment', 'equipmentSofts'] });
  }

  async findOne(id: number): Promise<Site> {
    const entity = await this.sitesRepository.findOne({
      where: { id },
      relations: ['equipment', 'equipmentSofts'],
    });
    if (!entity) {
      throw new NotFoundException(`Site ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateSiteDto): Promise<Site> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.sitesRepository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.sitesRepository.remove(entity);
  }

  async linkEquipment(siteId: number, dto: LinkEquipmentDto): Promise<Site> {
    const site = await this.findOne(siteId);
    const equipment = await this.equipmentRepository.findOne({
      where: { id: dto.equipmentId },
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${dto.equipmentId} introuvable.`);
    }
    site.equipment = [...(site.equipment ?? []), equipment];
    return this.sitesRepository.save(site);
  }

  async unlinkEquipment(siteId: number, equipmentId: number): Promise<Site> {
    const site = await this.findOne(siteId);
    site.equipment = (site.equipment ?? []).filter((e) => e.id !== equipmentId);
    return this.sitesRepository.save(site);
  }

  async linkEquipmentSoft(siteId: number, dto: LinkEquipmentSoftDto): Promise<Site> {
    const site = await this.findOne(siteId);
    const equipmentSoft = await this.equipmentSoftRepository.findOne({
      where: { id: dto.equipmentSoftId },
    });
    if (!equipmentSoft) {
      throw new NotFoundException(`EquipmentSoft ${dto.equipmentSoftId} introuvable.`);
    }
    site.equipmentSofts = [...(site.equipmentSofts ?? []), equipmentSoft];
    return this.sitesRepository.save(site);
  }

  async unlinkEquipmentSoft(siteId: number, equipmentSoftId: number): Promise<Site> {
    const site = await this.findOne(siteId);
    site.equipmentSofts = (site.equipmentSofts ?? []).filter(
      (e) => e.id !== equipmentSoftId,
    );
    return this.sitesRepository.save(site);
  }
}
