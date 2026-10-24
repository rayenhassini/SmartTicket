import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { TICKET_RELATIONS, TicketsService } from '../tickets/tickets.service';
import { TeamMember } from '../teams/entities/team-member.entity';
import { Team } from '../teams/entities/team.entity';
import { Solution } from '../solutions/entities/solution.entity';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { LeaderSolutionDto, LeaderStatusDto } from './dto/my-tickets.dto';

const forbidden = (code: string, message: string) =>
  new ForbiddenException({ statusCode: 403, error: 'Forbidden', code, message });

interface Scope {
  teamId: number;
  isLeader: boolean;
}

// Espace technicien. RÈGLE DE PÉRIMÈTRE (appliquée ICI, côté serveur) :
//   un technicien voit les tickets dont tickets.team_id = SON équipe (team_members) et dont le statut n'est pas « Deleted » ;
//   tout ticket hors de ce périmètre répond 404 (son existence n'est pas révélée).
// RÈGLE D'ÉCRITURE : seul le RESPONSABLE de l'équipe (teams.leader_id) change le statut / saisit la solution ;
//   un technicien simple reçoit 403 (NOT_TEAM_LEADER). Le PMO n'est pas concerné (routes /tickets existantes).
@Injectable()
export class MyTicketsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tickets: TicketsService,
    @InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(TeamMember) private readonly members: Repository<TeamMember>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
  ) {}

  private async scopeOf(userId: number): Promise<Scope | null> {
    const membership = await this.members.findOne({ where: { userId } });
    if (!membership) return null;
    const team = await this.teams.findOne({ where: { id: membership.teamId } });
    if (!team) return null;
    return { teamId: team.id, isLeader: team.leaderId !== null && team.leaderId !== undefined && String(team.leaderId) === String(userId) };
  }

  // Liste : uniquement les tickets de l'équipe (hors « Deleted »). Sans équipe : liste vide.
  async list(userId: number) {
    const scope = await this.scopeOf(userId);
    if (!scope) return { isLeader: false, teamId: null, tickets: [] };
    const rows = await this.ticketsRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.team', 'team')
      .leftJoinAndSelect('t.solution', 'solution')
      .leftJoinAndSelect('t.client', 'client')
      .leftJoinAndSelect('t.site', 'site')
      .where('t.team_id = :teamId', { teamId: scope.teamId })
      .andWhere('t.status != :deleted', { deleted: TicketStatus.DELETED })
      .orderBy('t.creationDate', 'DESC')
      .getMany();
    return { isLeader: scope.isLeader, teamId: Number(scope.teamId), tickets: rows };
  }

  async detail(userId: number, ticketId: number) {
    const scope = await this.scopeOf(userId);
    const ticket = await this.inScope(scope, ticketId);
    return { isLeader: !!scope?.isLeader, ticket };
  }

  async changeStatus(userId: number, ticketId: number, dto: LeaderStatusDto) {
    const scope = await this.scopeOf(userId);
    await this.inScope(scope, ticketId); // 404 si hors périmètre (avant tout 403)
    this.assertLeader(scope);
    await this.tickets.updateStatus(ticketId, { status: dto.status });
    // Directement le ticket à jour : après « Deleted » il sort du périmètre de lecture (detail() répondrait 404).
    return { isLeader: true, ticket: await this.tickets.findOne(ticketId) };
  }

  // Saisit (ou met à jour) la solution du ticket et la lie, dans une transaction.
  async saveSolution(userId: number, ticketId: number, dto: LeaderSolutionDto) {
    const scope = await this.scopeOf(userId);
    await this.inScope(scope, ticketId);
    this.assertLeader(scope);
    await this.dataSource.transaction(async (m) => {
      // Verrou de la ligne ticket (pas de jointure avec FOR UPDATE), puis lecture de la solution liée.
      const ticket = await m.findOne(Ticket, { where: { id: ticketId }, lock: { mode: 'pessimistic_write' } });
      if (!ticket || ticket.status === TicketStatus.DELETED) throw new NotFoundException('Ticket introuvable.');
      const linked = await m.findOne(Ticket, { where: { id: ticketId }, relations: ['solution'] });
      if (linked?.solution) {
        await m.update(Solution, { id: linked.solution.id }, { solutionText: dto.solutionText });
      } else {
        const res = await m.insert(Solution, { creationDate: new Date(), solutionText: dto.solutionText, proposedPar: { id: userId } as never, valid: true });
        await m.update(Ticket, { id: ticketId }, { solution: { id: Number(res.identifiers[0].id) } as Solution });
      }
    });
    return this.detail(userId, ticketId);
  }

  // ------------------------------------------------------------------ internes

  private assertLeader(scope: Scope | null) {
    if (!scope?.isLeader) {
      throw forbidden('NOT_TEAM_LEADER', "Seul le responsable de l'équipe peut modifier le statut ou la solution d'un ticket.");
    }
  }

  private async inScope(scope: Scope | null, ticketId: number): Promise<Ticket> {
    if (!scope) throw new NotFoundException(`Ticket ${ticketId} introuvable.`);
    const ticket = await this.ticketsRepo.findOne({ where: { id: ticketId }, relations: TICKET_RELATIONS });
    if (!ticket || ticket.status === TicketStatus.DELETED || String(ticket.teamId ?? '') !== String(scope.teamId)) {
      throw new NotFoundException(`Ticket ${ticketId} introuvable.`);
    }
    return ticket;
  }
}
