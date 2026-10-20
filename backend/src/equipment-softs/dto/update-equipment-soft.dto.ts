import { PartialType } from '@nestjs/mapped-types';
import { CreateEquipmentSoftDto } from './create-equipment-soft.dto';

export class UpdateEquipmentSoftDto extends PartialType(CreateEquipmentSoftDto) {}
