import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { LeaderEventReason } from './entities/team-leader-event.entity';
import { StaffingLevel } from './staffing';

export interface TeamNotification {
  team: { id: number; name: string };
  leaderChanges: Array<{ reason: LeaderEventReason; previousLeader?: string | null; newLeader?: string | null }>;
  staffingDescent?: { from: StaffingLevel; to: StaffingLevel; count: number };
}

// STUB (Phase 2) : aucun email réel n'est envoyé. Le message destiné aux PMO actifs
// est écrit dans les logs ([MAIL-STUB]) et retourné. Un seul message regroupé par
// opération (succession + effectif). Phase 3 : remplacer l'écriture du log par l'envoi
// Gmail, sans changer l'appelant. Ne lève jamais d'exception (ne doit pas faire
// échouer une opération déjà validée en base).
@Injectable()
export class TeamNotifierService {
  private readonly logger = new Logger('TeamNotifier');

  constructor(@InjectRepository(User) private readonly usersRepository: Repository<User>) {}

  async notify(n: TeamNotification): Promise<{ to: string[]; subject: string; body: string } | null> {
    try {
      const lines: string[] = [];
      const subjects: string[] = [];

      if (n.staffingDescent?.to === 'critical') {
        subjects.push(`URGENT — équipe « ${n.team.name} » réduite à 1 membre`);
        lines.push(`ALERTE URGENTE : l'équipe « ${n.team.name} » n'a plus qu'un seul membre (responsable). Ajoutez un second membre.`);
      } else if (n.staffingDescent?.to === 'warning') {
        subjects.push(`Avertissement — équipe « ${n.team.name} » : ${n.staffingDescent.count} membres`);
        lines.push(`Avertissement : l'équipe « ${n.team.name} » ne compte plus que ${n.staffingDescent.count} membres.`);
      }
      for (const c of n.leaderChanges) {
        if (c.reason === LeaderEventReason.AUTO_SUCCESSION) {
          subjects.push(`Nouveau responsable automatique — équipe « ${n.team.name} »`);
          lines.push(`${c.newLeader ?? '(aucun)'} est devenu responsable de l'équipe « ${n.team.name} » (désignation automatique, en remplacement de ${c.previousLeader ?? 'inconnu'}).`);
        }
      }
      if (lines.length === 0) return null;

      const pmos = await this.usersRepository.find({ where: { authority: UserAuthority.PMO, valid: true } });
      const message = { to: pmos.map((u) => u.email), subject: subjects.join(' / '), body: lines.join('\n') };
      this.logger.log(`[MAIL-STUB] to=${message.to.join(',') || '(aucun PMO actif)'} | ${message.subject} | ${message.body.replace(/\n/g, ' // ')}`);
      return message;
    } catch (err) {
      this.logger.error(`[MAIL-STUB] échec de notification : ${(err as Error).message}`);
      return null;
    }
  }
}
