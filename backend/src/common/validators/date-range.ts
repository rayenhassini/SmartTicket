import { BadRequestException } from '@nestjs/common';

const day = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

// R12 : la date de fin ne peut pas précéder la date de début (comparaison de chaînes YYYY-MM-DD).
export function assertDateRange(start?: string | null, end?: string | null, label = 'La période'): void {
  const s = day(start);
  const e = day(end);
  if (s && e && e < s) {
    throw new BadRequestException(
      `${label} est incohérente : la date de fin (${e}) précède la date de début (${s}).`,
    );
  }
}

export function assertNonNegativeAmount(montant?: string | null): void {
  if (montant !== undefined && montant !== null && Number(montant) < 0) {
    throw new BadRequestException('Le montant ne peut pas être négatif.');
  }
}
