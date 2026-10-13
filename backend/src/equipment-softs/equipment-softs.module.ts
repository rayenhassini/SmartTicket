import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentSoft } from './entities/equipment-soft.entity';
import { EquipmentSoftTypeSupport } from './entities/equipmentsoft-type-support.entity';
import { EquipmentSoftsService } from './equipment-softs.service';
import { EquipmentSoftsController } from './equipment-softs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentSoft, EquipmentSoftTypeSupport])],
  controllers: [EquipmentSoftsController],
  providers: [EquipmentSoftsService],
  exports: [EquipmentSoftsService],
})
export class EquipmentSoftsModule {}
