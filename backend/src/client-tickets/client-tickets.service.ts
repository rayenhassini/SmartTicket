import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { Ticket } from '../tickets/entities/ticket.entity';

// Vue RESTREINTE d'un ticket pour son client : liste blanche explicite de champs (jamais l'entité).
// Ne contient ni superviseur, ni techniciens, ni caseId, ni contrat, ni équipement, ni indicateurs internes.
export interface ClientTicketView {
  id: number;
  number: string;
  title: string;
  description: string;
  status: TicketStatus;
  creationDate: Date;
  resolvedDate: Date | null;
  closedDate: Date | null;
  siteName: string | null;
  solutionText: string | null;
  // Email du leader de l'équipe assignée ; null = « Non assigné » (pas d'équipe, ou équipe sans leader).
  responsibleEmail: string | null;
}

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

// Périmètre d'un client : SES tickets (client_id), externes (pas de tâche interne), non supprimés.
// Appliqué à la liste ET au détail : hors périmètre => 404 (pas d'information sur l'existence).
@Injectable()
export class ClientTicketsService {
  constructor(@InjectRepository(Ticket) private readonly tickets: Repository<Ticket>) {}

  private scoped(clientId: number): SelectQueryBuilder<Ticket> {
    return this.tickets
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.site', 'site')
      .leftJoinAndSelect('t.solution', 'solution')
      .leftJoinAndSelect('t.team', 'team')
      .leftJoinAndSelect('team.leader', 'leader')
      .where('t.client = :clientId', { clientId })
      .andWhere('t.internalTask = :internal', { internal: false })
      .andWhere('t.status != :deleted', { deleted: TicketStatus.DELETED });
  }

  async list(clientId: number, filters: { status?: string; q?: string }): Promise<ClientTicketView[]> {
    const qb = this.scoped(clientId);
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.q) {
      qb.andWhere('(t.number LIKE :q OR t.title LIKE :q)', { q: `%${escapeLike(filters.q)}%` });
    }
    const rows = await qb.orderBy('t.creationDate', 'DESC').addOrderBy('t.id', 'DESC').getMany();
    return rows.map((r) => this.toView(r));
  }

  async detail(clientId: number, id: number): Promise<ClientTicketView> {
    const row = await this.scoped(clientId).andWhere('t.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException(`Ticket ${id} introuvable.`);
    return this.toView(row);
  }

  private toView(t: Ticket): ClientTicketView {
    return {
      id: Number(t.id),
      number: t.number,
      title: t.title,
      description: t.description,
      status: t.status,
      creationDate: t.creationDate,
      resolvedDate: t.resolvedDate ?? null,
      closedDate: t.closedDate ?? null,
      siteName: t.site?.nomSite ?? null,
      solutionText: t.solution?.solutionText ?? null,
      responsibleEmail: t.team?.leader?.email ?? null,
    };
  }
}
