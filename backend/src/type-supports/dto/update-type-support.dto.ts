import { PartialType } from '@nestjs/mapped-types';
import { CreateTypeSupportDto } from './create-type-support.dto';

export class UpdateTypeSupportDto extends PartialType(CreateTypeSupportDto) {}
