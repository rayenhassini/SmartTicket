import { IsInt } from 'class-validator';

export class LinkClientDto {
  @IsInt()
  clientId: number;
}
