import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractTechnician } from './entities/contract-technician.entity';
import { ContractTypeSupport } from './entities/contract-type-support.entity';
import { User } from '../users/entities/user.entity';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractTechnician,
      ContractTypeSupport,
      User,
    ]),
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
