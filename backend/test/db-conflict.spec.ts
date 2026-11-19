import { mapDbError } from '../src/common/filters/db-conflict.filter';

describe('mapDbError (R10/R11)', () => {
  it('doublon de numéro de série -> 409 lisible (MySQL 8)', () => {
    const r = mapDbError({ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'SN-1' for key 'equipment.sn'" });
    expect(r?.status).toBe(409);
    expect(r?.code).toBe('DUPLICATE_ENTRY');
    expect(r?.message).toContain('numéro de série');
    expect(r?.message).toContain('SN-1');
  });
  it('doublon identifiant de contrat -> 409 (MariaDB, clé sans table)', () => {
    const r = mapDbError({ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'C-1' for key 'business_id'" });
    expect(r?.message).toContain('identifiant de contrat');
  });
  it('clé étrangère de suppression -> 409 avec table liée', () => {
    const r = mapDbError({
      code: 'ER_ROW_IS_REFERENCED_2',
      sqlMessage: 'Cannot delete or update a parent row: a foreign key constraint fails (`smartticket_test`.`contract_type_supports`, CONSTRAINT `fk` FOREIGN KEY (`type_support_id`) REFERENCES `type_supports` (`id`))',
    });
    expect(r?.status).toBe(409);
    expect(r?.message).toContain('contrat(s)');
  });
  it('référence inexistante -> 400', () => {
    expect(mapDbError({ code: 'ER_NO_REFERENCED_ROW_2' })?.status).toBe(400);
  });
  it('autre erreur SQL -> null (reste 500)', () => {
    expect(mapDbError({ code: 'ER_PARSE_ERROR' })).toBeNull();
    expect(mapDbError(undefined)).toBeNull();
  });
});
