import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Libellés lisibles des tables (messages 409). Table inconnue -> libellé générique.
const TABLE_LABELS: Record<string, string> = {
  tickets: 'ticket(s)',
  contracts: 'contrat(s)',
  equipment: 'équipement(s)',
  equipmentsofts: 'logiciel(s)',
  equipmentsoft_type_supports: 'logiciel(s)',
  site_equipmentsoft: 'site(s)',
  type_supports: 'type(s) de support',
  ticket_technicians: 'ticket(s)',
  sites: 'site(s)',
  site_equipment: 'site(s)',
  contract_clients: 'contrat(s)',
  contract_technicians: 'contrat(s)',
  contract_type_supports: 'contrat(s)',
  equipment_type_supports: 'équipement(s)',
  client_invitations: 'invitation(s) client',
  user_invitations: 'invitation(s)',
  users: 'utilisateur(s)',
  solutions: 'solution(s)',
  teams: 'équipe(s)',
};

const FIELD_LABELS: Record<string, string> = {
  sn: 'numéro de série',
  business_id: 'identifiant de contrat',
  email: 'email',
};

interface DriverError {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

export interface ConflictInfo {
  status: number;
  code: string;
  message: string;
}

// Fonction pure (testable) : traduit une erreur MySQL/MariaDB en réponse HTTP lisible, ou null.
export function mapDbError(driver: DriverError | undefined): ConflictInfo | null {
  if (!driver?.code) return null;
  const sql = driver.sqlMessage ?? '';

  if (driver.code === 'ER_DUP_ENTRY') {
    // « Duplicate entry 'X' for key 'equipment.IDX_x' » (MySQL 8) ou « ... for key 'IDX_x' » (MariaDB)
    const value = /Duplicate entry '([^']*)'/.exec(sql)?.[1];
    const key = /for key '([^']*)'/.exec(sql)?.[1] ?? '';
    const field = Object.entries(FIELD_LABELS).find(([k]) => key.toLowerCase().includes(k))?.[1];
    const what = field ? `Ce ${field}` : 'Cette valeur';
    const val = value ? ` (« ${value} »)` : '';
    return {
      status: HttpStatus.CONFLICT,
      code: 'DUPLICATE_ENTRY',
      message: `${what}${val} existe déjà. Choisissez une valeur différente.`,
    };
  }

  if (driver.code === 'ER_ROW_IS_REFERENCED_2' || driver.code === 'ER_ROW_IS_REFERENCED') {
    // « ... a foreign key constraint fails (`db`.`child`, CONSTRAINT ... ) »
    const child = /fails \(`[^`]*`\.`([^`]*)`/.exec(sql)?.[1];
    const label = (child && TABLE_LABELS[child]) || 'élément(s)';
    return {
      status: HttpStatus.CONFLICT,
      code: 'REFERENCED_BY_OTHER_RECORDS',
      message: `Suppression ou modification impossible : cet élément est encore utilisé par ${label}. Détachez-le ou supprimez d'abord les éléments liés.`,
    };
  }

  if (driver.code === 'ER_NO_REFERENCED_ROW_2' || driver.code === 'ER_NO_REFERENCED_ROW') {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'REFERENCE_NOT_FOUND',
      message: "Un élément référencé n'existe pas (identifiant invalide).",
    };
  }

  return null;
}

// Ne traite QUE les erreurs de contraintes SQL. Tout le reste retombe sur le comportement Nest par défaut (500).
@Catch(QueryFailedError)
export class DbConflictFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbConflictFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const mapped = mapDbError((exception as unknown as { driverError?: DriverError }).driverError);
    if (mapped) {
      return res.status(mapped.status).json({
        statusCode: mapped.status,
        error: mapped.status === 409 ? 'Conflict' : 'Bad Request',
        code: mapped.code,
        message: mapped.message,
      });
    }
    this.logger.error(exception.message, exception.stack);
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
