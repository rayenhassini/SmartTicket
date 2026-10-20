import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { ContractType } from '../../common/enums/contract-type.enum';
import { ContractNature } from '../../common/enums/contract-nature.enum';

export class CreateContractDto {
  @IsString()
  businessId: string;

  @IsEnum(ContractType)
  type: ContractType;

  @IsEnum(ContractNature)
  nature: ContractNature;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  sla: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  jourInfogerance?: string;

  @IsOptional()
  @IsBoolean()
  valid?: boolean;

  // Envoyé en string pour matcher DECIMAL(12,3) côté MySQL (ex: "1500.000")
  @IsOptional()
  @IsNumberString()
  montant?: string;

  @IsOptional()
  @IsInt()
  commercialId?: number;
}
