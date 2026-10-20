import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solution } from './entities/solution.entity';
import { User } from '../users/entities/user.entity';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { UpdateSolutionDto } from './dto/update-solution.dto';

@Injectable()
export class SolutionsService {
  constructor(
    @InjectRepository(Solution)
    private readonly repository: Repository<Solution>,
  ) {}

  create(dto: CreateSolutionDto): Promise<Solution> {
    const { proposedParId, ...rest } = dto;
    const entity = this.repository.create({
      ...rest,
      creationDate: new Date(),
      proposedPar: proposedParId ? ({ id: proposedParId } as User) : undefined,
    });
    return this.repository.save(entity);
  }

  findAll(): Promise<Solution[]> {
    return this.repository.find({ relations: ['proposedPar'] });
  }

  async findOne(id: number): Promise<Solution> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['proposedPar'],
    });
    if (!entity) {
      throw new NotFoundException(`Solution ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateSolutionDto): Promise<Solution> {
    const entity = await this.findOne(id);
    const { proposedParId, ...rest } = dto;
    Object.assign(entity, rest);
    if (proposedParId !== undefined) {
      entity.proposedPar = proposedParId ? ({ id: proposedParId } as User) : undefined;
    }
    return this.repository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }
}
