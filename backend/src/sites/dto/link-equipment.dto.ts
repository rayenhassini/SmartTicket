import { IsInt } from 'class-validator';

export class LinkEquipmentDto {
  @IsInt()
  equipmentId: number;
}
