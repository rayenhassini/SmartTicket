import { IsInt, IsString } from 'class-validator';

export class LinkTypeSupportDto {
  @IsInt()
  typeSupportId: number;

  @IsString()
  supportId: string;
}
