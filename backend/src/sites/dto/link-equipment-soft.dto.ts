import { IsInt } from 'class-validator';

export class LinkEquipmentSoftDto {
  @IsInt()
  equipmentSoftId: number;
}
