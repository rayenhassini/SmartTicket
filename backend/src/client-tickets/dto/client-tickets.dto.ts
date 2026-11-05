import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// « Deleted » n'est volontairement pas filtrable : un client ne voit jamais un ticket supprimé.
export const CLIENT_FILTER_STATUSES = ['Not Assigned', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed'] as const;
export const CLIENT_SEARCH_MAX = 100;

export class ClientTicketsQueryDto {
  @IsOptional()
  @IsIn(CLIENT_FILTER_STATUSES as unknown as string[])
  status?: (typeof CLIENT_FILTER_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(CLIENT_SEARCH_MAX)
  q?: string;
}
