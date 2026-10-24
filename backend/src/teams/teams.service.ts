import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { LeaderEventReason, TeamLeaderEvent } from './entities/team-leader-event.entity';
import { isStaffingDescent, staffingLevel, StaffingLevel } from './staffing';
import { TeamNotification, TeamNotifierService } from './team-notifier.service';

// ids BIGINT : mysql2 les renvoie en string → toujours comparer via String().
const sameId = (a: unknown, b: unknown) => String(a) === String(b);

const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, error: 'Conflict', code, message });

const isDuplicateKey = (err: unknown) => (err as { code?: string })?.code === 'ER_DUP_ENTRY';

const personName = (u?: Pick<User, 'firstName' | 'lastName'> | null) =>
  u ? `${u.firstName} ${u.lastName}` : null;

// Résultat interne d'une opération transactionnelle : sert à notifier APRÈS le commit.
export interface OperationOutcome {
  team: Team;
  events: TeamLeaderEvent[];
  staffingBefore?: StaffingLevel;
  staffingAfter?: StaffingLevel;
  countAfter?: number;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Team) private readonly teamsRepository: Repository<Team>,
    @InjectRepository(TeamMember) private readonly membersRepository: Repository<TeamMember>,
    @InjectRepository(TeamLeaderEvent) private readonly eventsRepository: Repository<TeamLeaderEvent>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly notifier: TeamNotifierService,
  ) {}

  // ------------------------------------------------------------------ lecture

  async findAll() {
    const teams = await this.teamsRepository.find({ relations: ['leader'], order: { name: 'ASC' } });
    const counts = await this.membersRepository
      .createQueryBuilder('tm')
      .select('tm.teamId', 'teamId')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('tm.teamId')
      .getRawMany<{ teamId: string; cnt: string }>();
    const countByTeam = new Map(counts.map((c) => [String(c.teamId), Number(c.cnt)]));
    return teams.map((t) => this.toSummary(t, countByTeam.get(String(t.id)) ?? 0));
  }

  async findOne(id: number) {
    const team = await this.teamsRepository.findOne({ where: { id }, relations: ['leader'] });
    if (!team) throw new NotFoundException(`Équipe ${id} introuvable.`);
    const members = await this.loadMembers(this.dataSource.manager, id);
    const events = await this.eventsRepository.find({
      where: { teamId: id },
      relations: ['previousLeader', 'newLeader'],
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 10,
    });
    return {
      ...this.toSummary(team, members.length),
      members: members.map((m) => this.toMemberView(m, team.leaderId, true)),
      leaderEvents: events.map((e) => ({
        id: Number(e.id),
        reason: e.reason,
        previousLeader: personName(e.previousLeader),
        newLeader: personName(e.newLeader),
        createdAt: e.createdAt,
        acknowledgedAt: e.acknowledgedAt,
      })),
    };
  }

  // Lecture de SA propre équipe par un technicien : pas d'email/téléphone des collègues,
  // pas d'indicateur d'effectif (réservé au PMO).
  async findMine(userId: number) {
    const membership = await this.membersRepository.findOne({ where: { userId } });
    if (!membership) throw new NotFoundException("Vous n'appartenez à aucune équipe.");
    const team = await this.teamsRepository.findOne({ where: { id: membership.teamId }, relations: ['leader'] });
    if (!team) throw new NotFoundException("Vous n'appartenez à aucune équipe.");
    const members = await this.loadMembers(this.dataSource.manager, team.id);
    return {
      id: Number(team.id),
      name: team.name,
      leader: team.leader ? { id: Number(team.leader.id), firstName: team.leader.firstName, lastName: team.leader.lastName } : null,
      memberCount: members.length,
      members: members.map((m) => this.toMemberView(m, team.leaderId, false)),
    };
  }

  // Techniciens actifs avec leur équipe actuelle (NULL = disponible) : alimente l'écran PMO.
  async listTechnicians() {
    const technicians = await this.usersRepository.find({
      where: { authority: UserAuthority.TECHNICIAN, valid: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    const memberships = technicians.length
      ? await this.membersRepository.find({ where: { userId: In(technicians.map((t) => t.id)) }, relations: ['team'] })
      : [];
    const byUser = new Map(memberships.map((m) => [String(m.userId), m]));
    return technicians.map((u) => {
      const m = byUser.get(String(u.id));
      return {
        id: Number(u.id),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        teamId: m ? Number(m.teamId) : null,
        teamName: m?.team?.name ?? null,
      };
    });
  }

  // ------------------------------------------------------------------ équipes

  async create(name: string) {
    try {
      const team = await this.teamsRepository.save(this.teamsRepository.create({ name, leaderId: null }));
      return this.findOne(team.id);
    } catch (err) {
      if (isDuplicateKey(err)) throw conflict('TEAM_NAME_TAKEN', `Une équipe nommée « ${name} » existe déjà.`);
      throw err;
    }
  }

  async rename(id: number, name: string) {
    const team = await this.teamsRepository.findOne({ where: { id } });
    if (!team) throw new NotFoundException(`Équipe ${id} introuvable.`);
    try {
      await this.teamsRepository.update({ id }, { name });
    } catch (err) {
      if (isDuplicateKey(err)) throw conflict('TEAM_NAME_TAKEN', `Une équipe nommée « ${name} » existe déjà.`);
      throw err;
    }
    return this.findOne(id);
  }

  // Suppression : uniquement si 0 membre ET 0 ticket assigné (tickets.team_id, migration 003).
  // L'historique des événements part avec l'équipe.
  async remove(id: number): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const team = await this.lockTeam(m, id);
      const count = await m.count(TeamMember, { where: { teamId: team.id } });
      if (count > 0) {
        throw conflict('TEAM_NOT_EMPTY', `Impossible de supprimer l'équipe « ${team.name} » : elle compte encore ${count} membre(s).`);
      }
      // Migration 003 : une équipe qui porte des tickets ne se supprime pas (FK RESTRICT).
      const [{ c }] = await m.query('SELECT COUNT(*) AS c FROM tickets WHERE team_id = ?', [team.id]);
      if (Number(c) > 0) {
        throw conflict('TEAM_HAS_TICKETS', `Impossible de supprimer l'équipe « ${team.name} » : ${c} ticket(s) lui sont assignés.`);
      }
      await m.delete(Team, { id: team.id });
    });
  }

  // ------------------------------------------------------------------ membres

  async addMember(teamId: number, userId: number) {
    const outcome = await this.runWrite((m) => this.addMemberWithin(m, teamId, userId));
    return this.afterWrite(outcome, teamId);
  }

  // Cœur de l'ajout d'un membre, À L'INTÉRIEUR d'une transaction fournie par l'appelant
  // (même code pour POST /teams/:id/members et pour l'acceptation d'une invitation : les
  // règles de la Phase 2 — verrou d'équipe, UNIQUE(user_id), 1er membre = responsable —
  // ne sont jamais dupliquées).
  async addMemberWithin(m: EntityManager, teamId: number, userId: number): Promise<OperationOutcome> {
    const team = await this.lockTeam(m, teamId);
    const user = await m.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException(`Utilisateur ${userId} introuvable.`);
    if (user.authority !== UserAuthority.TECHNICIAN) {
      throw new BadRequestException('Seuls les techniciens peuvent être membres d’une équipe.');
    }
    if (!user.valid) throw new BadRequestException('Ce compte est désactivé : impossible de l’ajouter à une équipe.');

    const existing = await m.findOne(TeamMember, { where: { userId }, relations: ['team'] });
    if (existing) {
      throw sameId(existing.teamId, teamId)
        ? conflict('ALREADY_MEMBER', 'Cet utilisateur est déjà membre de cette équipe.')
        : conflict('ALREADY_IN_OTHER_TEAM', `Cet utilisateur est déjà membre de l'équipe « ${existing.team?.name} » : utilisez le transfert.`);
    }

    const before = await m.count(TeamMember, { where: { teamId: team.id } });
    await m.insert(TeamMember, { teamId: team.id, userId, joinedAt: new Date() });

    // 1er membre d'une équipe vide → responsable automatique.
    const events: TeamLeaderEvent[] = [];
    if (team.leaderId === null || team.leaderId === undefined) {
      events.push(await this.assignLeader(m, team, userId, before === 0 ? LeaderEventReason.FIRST_MEMBER : LeaderEventReason.AUTO_SUCCESSION, null));
    }
    return { team, events }; // croissance : jamais d'email d'effectif
  }

  async removeMember(teamId: number, userId: number) {
    const outcome = await this.runWrite(async (m) => {
      const team = await this.lockTeam(m, teamId);
      const member = await m.findOne(TeamMember, { where: { teamId: team.id, userId } });
      if (!member) throw new NotFoundException("Cet utilisateur n'est pas membre de cette équipe.");
      const count = await m.count(TeamMember, { where: { teamId: team.id } });
      this.assertCanShrink(team, count, 'retirer');
      await m.delete(TeamMember, { id: member.id });
      return this.outcomeAfterDeparture(m, team, userId, count);
    });
    return this.afterWrite(outcome, teamId);
  }

  // Transfert : contrôles de l'équipe SOURCE d'abord ; joined_at = maintenant dans la cible ;
  // succession dans la source si le partant en était responsable ; si la cible était vide,
  // le transféré en devient responsable. Verrouillage des deux équipes dans l'ordre des ids.
  async transferMember(sourceId: number, userId: number, targetId: number) {
    if (sameId(sourceId, targetId)) throw new BadRequestException('L’équipe source et l’équipe cible sont identiques.');
    const outcome = await this.runWrite(async (m) => {
      const [firstId, secondId] = Number(sourceId) < Number(targetId) ? [sourceId, targetId] : [targetId, sourceId];
      const first = await this.lockTeam(m, firstId);
      const second = await this.lockTeam(m, secondId);
      const source = sameId(first.id, sourceId) ? first : second;
      const target = sameId(first.id, targetId) ? first : second;

      const member = await m.findOne(TeamMember, { where: { teamId: source.id, userId } });
      if (!member) throw new NotFoundException("Cet utilisateur n'est pas membre de l'équipe source.");
      const sourceCount = await m.count(TeamMember, { where: { teamId: source.id } });
      this.assertCanShrink(source, sourceCount, 'transférer');
      const targetCount = await m.count(TeamMember, { where: { teamId: target.id } });

      await m.update(TeamMember, { id: member.id }, { teamId: target.id, joinedAt: new Date() });

      const out = await this.outcomeAfterDeparture(m, source, userId, sourceCount);
      if (target.leaderId === null || target.leaderId === undefined) {
        out.events.push(await this.assignLeader(m, target, userId, targetCount === 0 ? LeaderEventReason.FIRST_MEMBER : LeaderEventReason.AUTO_SUCCESSION, null));
      }
      return out;
    });
    await this.afterWrite(outcome, sourceId);
    return this.findOne(targetId);
  }

  // Désignation manuelle (PMO) : le nouveau responsable doit être membre de l'équipe.
  async setLeader(teamId: number, userId: number) {
    await this.dataSource.transaction(async (m) => {
      const team = await this.lockTeam(m, teamId);
      const member = await m.findOne(TeamMember, { where: { teamId: team.id, userId } });
      if (!member) throw conflict('LEADER_NOT_MEMBER', 'Le responsable doit être membre de l’équipe.');
      if (sameId(team.leaderId, userId)) return; // déjà responsable : rien à faire, pas d'événement
      await this.assignLeader(m, team, userId, LeaderEventReason.MANUAL, team.leaderId);
    });
    return this.findOne(teamId);
  }

  // ------------------------------------------- appelé par UsersService (valid=false, delete, rôle)

  // Refus (409) si l'utilisateur est membre d'une équipe — suppression du compte ou
  // changement de rôle hors « technician » : il faut d'abord le retirer de l'équipe.
  async assertNotMember(userId: number, action: string): Promise<void> {
    const membership = await this.membersRepository.findOne({ where: { userId }, relations: ['team'] });
    if (membership) {
      throw conflict('USER_IS_TEAM_MEMBER', `Impossible de ${action} : cet utilisateur est membre de l'équipe « ${membership.team?.name} ». Retirez-le d'abord de l'équipe.`);
    }
  }

  // valid = false sur un membre : retrait de team_members + succession éventuelle + sauvegarde
  // de l'utilisateur dans la MÊME transaction. handled=false si l'utilisateur n'est pas membre
  // (l'appelant applique alors sa mise à jour normale).
  async deactivateMember(
    userId: number,
    persistUser: (manager: EntityManager) => Promise<User>,
  ): Promise<{ handled: boolean; user?: User }> {
    const probe = await this.membersRepository.findOne({ where: { userId } });
    if (!probe) return { handled: false };

    let savedUser: User | undefined;
    const outcome = await this.runWrite(async (m) => {
      const team = await this.lockTeam(m, probe.teamId);
      const member = await m.findOne(TeamMember, { where: { userId } });
      if (!member || !sameId(member.teamId, team.id)) {
        throw conflict('MEMBERSHIP_CHANGED', 'L’appartenance à l’équipe a changé pendant l’opération : réessayez.');
      }
      const count = await m.count(TeamMember, { where: { teamId: team.id } });
      this.assertCanShrink(team, count, 'désactiver');
      await m.delete(TeamMember, { id: member.id });
      const out = await this.outcomeAfterDeparture(m, team, userId, count);
      savedUser = await persistUser(m);
      return out;
    });
    await this.afterWrite(outcome, outcome.team.id);
    return { handled: true, user: savedUser };
  }

  // ------------------------------------------------------------------ internes

  // Règles 3 et 4 : on ne peut jamais descendre à 0 ; le dernier membre est le responsable.
  private assertCanShrink(team: Team, count: number, action: string) {
    if (count <= 1) {
      throw conflict(
        'LAST_MEMBER',
        `Impossible de ${action} le dernier membre de l'équipe « ${team.name} » (il en est le responsable) : ajoutez d'abord un second membre.`,
      );
    }
  }

  private async lockTeam(m: EntityManager, id: number): Promise<Team> {
    const team = await m.findOne(Team, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!team) throw new NotFoundException(`Équipe ${id} introuvable.`);
    return team;
  }

  // Après le départ d'un membre (déjà supprimé/déplacé de l'équipe) : succession si c'était
  // le responsable (plus ancien joined_at, égalité → plus petit user id), puis calcul du palier.
  private async outcomeAfterDeparture(m: EntityManager, team: Team, leavingUserId: number, countBefore: number): Promise<OperationOutcome> {
    const events: TeamLeaderEvent[] = [];
    if (sameId(team.leaderId, leavingUserId)) {
      const successor = await m
        .createQueryBuilder(TeamMember, 'tm')
        .where('tm.teamId = :teamId', { teamId: team.id })
        .orderBy('tm.joinedAt', 'ASC')
        .addOrderBy('tm.userId', 'ASC')
        .getOne();
      if (!successor) throw conflict('LAST_MEMBER', 'Aucun successeur possible : équipe vide.'); // garde-fou
      events.push(await this.assignLeader(m, team, successor.userId, LeaderEventReason.AUTO_SUCCESSION, leavingUserId));
    }
    return {
      team,
      events,
      staffingBefore: staffingLevel(countBefore),
      staffingAfter: staffingLevel(countBefore - 1),
      countAfter: countBefore - 1,
    };
  }

  private async assignLeader(m: EntityManager, team: Team, newLeaderId: number, reason: LeaderEventReason, previousLeaderId: number | null | undefined): Promise<TeamLeaderEvent> {
    await m.update(Team, { id: team.id }, { leaderId: newLeaderId });
    team.leaderId = newLeaderId;
    return m.save(
      m.create(TeamLeaderEvent, {
        teamId: team.id,
        previousLeaderId: previousLeaderId ?? null,
        newLeaderId,
        reason,
        acknowledgedAt: null,
      }),
    );
  }

  private async loadMembers(m: EntityManager, teamId: number): Promise<TeamMember[]> {
    return m
      .createQueryBuilder(TeamMember, 'tm')
      .innerJoinAndSelect('tm.user', 'u')
      .where('tm.teamId = :teamId', { teamId })
      .orderBy('tm.joinedAt', 'ASC')
      .addOrderBy('tm.userId', 'ASC')
      .getMany();
  }

  // Exécute l'écriture dans une transaction ; les doublons d'index unique (course) deviennent des 409.
  private async runWrite(work: (m: EntityManager) => Promise<OperationOutcome>): Promise<OperationOutcome> {
    try {
      return await this.dataSource.transaction(work);
    } catch (err) {
      if (isDuplicateKey(err)) throw conflict('ALREADY_MEMBER', 'Cet utilisateur est déjà membre d’une équipe.');
      throw err;
    }
  }

  // Après COMMIT : un seul message PMO regroupé (succession + descente de palier). Stub en Phase 2.
  private async afterWrite(outcome: OperationOutcome, teamIdToReturn: number) {
    const descent =
      outcome.staffingBefore && outcome.staffingAfter && isStaffingDescent(outcome.staffingBefore, outcome.staffingAfter)
        ? { from: outcome.staffingBefore, to: outcome.staffingAfter, count: outcome.countAfter ?? 0 }
        : undefined;
    const successions = outcome.events.filter((e) => e.reason === LeaderEventReason.AUTO_SUCCESSION && e.previousLeaderId);
    if (descent || successions.length) {
      const ids = successions.flatMap((e) => [e.previousLeaderId, e.newLeaderId]).filter((v): v is number => v != null);
      const people = ids.length ? await this.usersRepository.find({ where: { id: In(ids) } }) : [];
      const nameOf = (id?: number | null) => personName(people.find((p) => sameId(p.id, id)));
      const notification: TeamNotification = {
        team: { id: Number(outcome.team.id), name: outcome.team.name },
        leaderChanges: successions.map((e) => ({ reason: e.reason, previousLeader: nameOf(e.previousLeaderId), newLeader: nameOf(e.newLeaderId) })),
        staffingDescent: descent,
      };
      await this.notifier.notify(notification);
    }
    return this.findOne(teamIdToReturn);
  }

  // ------------------------------------------------------------------ mapping

  private toSummary(team: Team, memberCount: number) {
    return {
      id: Number(team.id),
      name: team.name,
      leaderId: team.leaderId === null || team.leaderId === undefined ? null : Number(team.leaderId),
      leader: team.leader ? { id: Number(team.leader.id), firstName: team.leader.firstName, lastName: team.leader.lastName } : null,
      memberCount,
      staffing: staffingLevel(memberCount),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  private toMemberView(member: TeamMember, leaderId: number | null, withContact: boolean) {
    const u = member.user as User;
    return {
      userId: Number(member.userId),
      firstName: u.firstName,
      lastName: u.lastName,
      ...(withContact ? { email: u.email, phoneNumber: u.phoneNumber ?? null } : {}),
      joinedAt: member.joinedAt,
      isLeader: leaderId !== null && leaderId !== undefined && sameId(leaderId, member.userId),
    };
  }
}
