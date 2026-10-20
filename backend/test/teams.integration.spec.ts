/* Tests d'intégration Phase 2 — BASE RÉELLE (MySQL/MariaDB).
 *
 * Ces tests ÉCRIVENT en base : ils ne tournent que si TEST_DB_NAME est défini, sur une base
 * de TEST dédiée (jamais votre base de travail). Préparation :
 *   mysql -u root -p -e "CREATE DATABASE smartticket_test CHARACTER SET utf8mb4"
 *   sed 's/smartticket_v1/smartticket_test/g' database/smartticket_schema_v1.sql | mysql -u root -p
 *   sed 's/smartticket_v1/smartticket_test/g' database/migrations/001_phase2_teams.sql | mysql -u root -p
 *   TEST_DB_NAME=smartticket_test DB_HOST=... DB_USERNAME=... DB_PASSWORD=... npm test
 * Chaque test crée ses propres données (préfixe « t2-… ») et les supprime à la fin. */
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Team } from '../src/teams/entities/team.entity';
import { TeamMember } from '../src/teams/entities/team-member.entity';
import { LeaderEventReason, TeamLeaderEvent } from '../src/teams/entities/team-leader-event.entity';
import { TeamsService } from '../src/teams/teams.service';
import { TeamNotifierService } from '../src/teams/team-notifier.service';
import { UserAuthority } from '../src/common/enums/user-authority.enum';

const dbName = process.env.TEST_DB_NAME;
const maybe = dbName ? describe : describe.skip;
const run = Date.now().toString(36);

maybe('Phase 2 — équipes (base réelle)', () => {
  let ds: DataSource;
  let service: TeamsService;
  let notify: jest.SpyInstance;
  const teamIds: number[] = [];
  const userIds: number[] = [];
  let seq = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DB_HOST ?? '127.0.0.1',
          port: parseInt(process.env.DB_PORT ?? '3306', 10),
          username: process.env.DB_USERNAME ?? 'root',
          password: process.env.DB_PASSWORD ?? '',
          database: dbName,
          entities: [User, Team, TeamMember, TeamLeaderEvent],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([User, Team, TeamMember, TeamLeaderEvent]),
      ],
      providers: [TeamsService, TeamNotifierService],
    }).compile();
    ds = moduleRef.get(DataSource);
    service = moduleRef.get(TeamsService);
    notify = jest.spyOn(moduleRef.get(TeamNotifierService), 'notify').mockResolvedValue(null);
  });

  afterAll(async () => {
    if (!ds) return;
    if (teamIds.length) {
      await ds.query(`DELETE FROM team_members WHERE team_id IN (${teamIds.join(',')})`);
      await ds.query(`DELETE FROM teams WHERE id IN (${teamIds.join(',')})`); // events en cascade
    }
    if (userIds.length) await ds.query(`DELETE FROM users WHERE id IN (${userIds.join(',')})`);
    await ds.destroy();
  });

  beforeEach(() => notify.mockClear());

  async function tech(authority: UserAuthority = UserAuthority.TECHNICIAN, valid = true): Promise<User> {
    const email = `t2-${run}-${++seq}@example.com`;
    const res = await ds.getRepository(User).insert({ firstName: 'T', lastName: `U${seq}`, email, passwordHash: 'x', authority, valid });
    const id = Number(res.identifiers[0].id);
    userIds.push(id);
    return ds.getRepository(User).findOneOrFail({ where: { id } });
  }
  async function team(name?: string) {
    const t = await service.create(name ?? `t2-${run}-${++seq}`);
    teamIds.push(t.id);
    return t;
  }
  // Fixe joined_at pour rendre l'ancienneté déterministe.
  const setJoined = (teamId: number, userId: number, iso: string) =>
    ds.query('UPDATE team_members SET joined_at = ? WHERE team_id = ? AND user_id = ?', [iso, teamId, userId]);
  const conflictCode = async (p: Promise<unknown>) => {
    try { await p; } catch (e: any) { return { status: e.getStatus?.(), code: e.getResponse?.().code }; }
    return { status: 200, code: undefined };
  };

  it('création d’une équipe vide : leader NULL, effectif « empty », aucun email', async () => {
    const t = await team();
    expect(t.leaderId).toBeNull();
    expect(t.memberCount).toBe(0);
    expect(t.staffing).toBe('empty');
    expect(notify).not.toHaveBeenCalled();
  });

  it('1er membre → devient responsable automatiquement (événement first_member)', async () => {
    const t = await team();
    const a = await tech();
    const v = await service.addMember(t.id, a.id);
    expect(v.leaderId).toBe(Number(a.id));
    expect(v.staffing).toBe('critical');
    expect(v.members).toHaveLength(1);
    expect(v.members[0].isLeader).toBe(true);
    expect(v.leaderEvents[0]).toMatchObject({ reason: LeaderEventReason.FIRST_MEMBER });
    expect(notify).not.toHaveBeenCalled(); // croissance : pas d'email d'effectif
  });

  it('le 2e membre ne change pas le responsable', async () => {
    const t = await team();
    const [a, b] = [await tech(), await tech()];
    await service.addMember(t.id, a.id);
    const v = await service.addMember(t.id, b.id);
    expect(v.leaderId).toBe(Number(a.id));
    expect(v.staffing).toBe('warning');
  });

  it('refuse le passage à 0 et le retrait du seul membre (409 LAST_MEMBER)', async () => {
    const t = await team();
    const [a, b] = [await tech(), await tech()];
    await service.addMember(t.id, a.id);
    expect(await conflictCode(service.removeMember(t.id, a.id))).toEqual({ status: 409, code: 'LAST_MEMBER' });
    await service.addMember(t.id, b.id);
    await service.removeMember(t.id, b.id); // 2 → 1 autorisé
    expect(await conflictCode(service.removeMember(t.id, a.id))).toEqual({ status: 409, code: 'LAST_MEMBER' });
    const v = await service.findOne(t.id);
    expect(v.memberCount).toBe(1);
    expect(v.leaderId).toBe(Number(a.id));
  });

  it('succession sur retrait du responsable : plus ancien joined_at', async () => {
    const t = await team();
    const [a, b, c] = [await tech(), await tech(), await tech()];
    for (const u of [a, b, c]) await service.addMember(t.id, u.id);
    await setJoined(t.id, a.id, '2020-01-01 00:00:00.000');
    await setJoined(t.id, b.id, '2021-01-01 00:00:00.000');
    await setJoined(t.id, c.id, '2019-06-01 00:00:00.000'); // c est le plus ancien des restants
    const v = await service.removeMember(t.id, a.id);
    expect(v.leaderId).toBe(Number(c.id));
    expect(v.leaderEvents[0]).toMatchObject({ reason: LeaderEventReason.AUTO_SUCCESSION });
    expect(v.leaderEvents[0].previousLeader).toContain(`U${a.lastName.slice(1)}`);
  });

  it('succession : égalité de joined_at → plus petit id', async () => {
    const t = await team();
    const [a, b, c] = [await tech(), await tech(), await tech()];
    for (const u of [a, b, c]) await service.addMember(t.id, u.id);
    for (const u of [b, c]) await setJoined(t.id, u.id, '2020-05-05 10:00:00.000');
    const v = await service.removeMember(t.id, a.id);
    expect(v.leaderId).toBe(Math.min(Number(b.id), Number(c.id)));
  });

  it('un seul message PMO regroupé : succession + descente vers « critical »', async () => {
    const t = await team();
    const [a, b] = [await tech(), await tech()];
    await service.addMember(t.id, a.id);
    await service.addMember(t.id, b.id);
    await service.removeMember(t.id, a.id); // 2 → 1 et a était responsable
    expect(notify).toHaveBeenCalledTimes(1);
    const arg = notify.mock.calls[0][0];
    expect(arg.staffingDescent).toMatchObject({ from: 'warning', to: 'critical', count: 1 });
    expect(arg.leaderChanges).toHaveLength(1);
  });

  it('email d’avertissement à la descente normal → warning seulement', async () => {
    const t = await team();
    const users = [await tech(), await tech(), await tech(), await tech(), await tech()];
    for (const u of users) await service.addMember(t.id, u.id);
    await service.removeMember(t.id, users[4].id); // 5 → 4 : reste normal
    expect(notify).not.toHaveBeenCalled();
    await service.removeMember(t.id, users[3].id); // 4 → 3 : normal → warning
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].staffingDescent).toMatchObject({ from: 'normal', to: 'warning', count: 3 });
    notify.mockClear();
    await service.removeMember(t.id, users[2].id); // 3 → 2 : même palier
    expect(notify).not.toHaveBeenCalled();
  });

  it('transfert : joined_at remis à maintenant dans la cible ; succession source ; cible vide → responsable', async () => {
    const src = await team();
    const dst = await team(); // vide
    const [a, b] = [await tech(), await tech()];
    await service.addMember(src.id, a.id); // a responsable de src
    await service.addMember(src.id, b.id);
    await setJoined(src.id, a.id, '2020-01-01 00:00:00.000');
    const before = Date.now();
    const v = await service.transferMember(src.id, a.id, dst.id);
    expect(v.id).toBe(dst.id);
    expect(v.leaderId).toBe(Number(a.id)); // cible vide → a devient responsable
    expect(v.leaderEvents[0]).toMatchObject({ reason: LeaderEventReason.FIRST_MEMBER });
    expect(new Date(v.members[0].joinedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    const s = await service.findOne(src.id);
    expect(s.memberCount).toBe(1);
    expect(s.leaderId).toBe(Number(b.id)); // succession dans la source
    expect(s.leaderEvents[0]).toMatchObject({ reason: LeaderEventReason.AUTO_SUCCESSION });
  });

  it('transfert du seul membre refusé (409) : la source est inchangée', async () => {
    const src = await team();
    const dst = await team();
    const a = await tech();
    await service.addMember(src.id, a.id);
    expect(await conflictCode(service.transferMember(src.id, a.id, dst.id))).toEqual({ status: 409, code: 'LAST_MEMBER' });
    expect((await service.findOne(src.id)).memberCount).toBe(1);
    expect((await service.findOne(dst.id)).memberCount).toBe(0);
  });

  it('un transféré vers une équipe non vide n’en devient pas responsable', async () => {
    const src = await team();
    const dst = await team();
    const [a, b, c] = [await tech(), await tech(), await tech()];
    await service.addMember(src.id, a.id);
    await service.addMember(src.id, b.id);
    await service.addMember(dst.id, c.id);
    const v = await service.transferMember(src.id, b.id, dst.id);
    expect(v.leaderId).toBe(Number(c.id));
    expect(v.memberCount).toBe(2);
  });

  it('valid=false sur le responsable : retrait + succession dans la même transaction', async () => {
    const t = await team();
    const [a, b] = [await tech(), await tech()];
    await service.addMember(t.id, a.id);
    await service.addMember(t.id, b.id);
    const res = await service.deactivateMember(a.id, (m) => m.save(User, Object.assign(a, { valid: false })));
    expect(res.handled).toBe(true);
    expect(res.user?.valid).toBe(false);
    const v = await service.findOne(t.id);
    expect(v.leaderId).toBe(Number(b.id));
    expect(v.memberCount).toBe(1);
    expect((await ds.getRepository(User).findOneOrFail({ where: { id: a.id } })).valid).toBe(false);
  });

  it('valid=false sur le dernier membre : 409, le compte reste actif', async () => {
    const t = await team();
    const a = await tech();
    await service.addMember(t.id, a.id);
    const out = await conflictCode(service.deactivateMember(a.id, (m) => m.save(User, Object.assign(a, { valid: false }))));
    expect(out).toEqual({ status: 409, code: 'LAST_MEMBER' });
    expect((await ds.getRepository(User).findOneOrFail({ where: { id: a.id } })).valid).toBe(true);
    expect((await service.findOne(t.id)).memberCount).toBe(1);
  });

  it('deactivateMember ignore un utilisateur sans équipe (handled=false)', async () => {
    const a = await tech();
    expect((await service.deactivateMember(a.id, async () => a)).handled).toBe(false);
  });

  it('refus : non-technicien (400), déjà membre (409), autre équipe (409)', async () => {
    const t1 = await team();
    const t2 = await team();
    const client = await tech(UserAuthority.CLIENT);
    const a = await tech();
    await expect(service.addMember(t1.id, client.id)).rejects.toMatchObject({ status: 400 });
    await service.addMember(t1.id, a.id);
    expect(await conflictCode(service.addMember(t1.id, a.id))).toEqual({ status: 409, code: 'ALREADY_MEMBER' });
    expect(await conflictCode(service.addMember(t2.id, a.id))).toEqual({ status: 409, code: 'ALREADY_IN_OTHER_TEAM' });
  });

  it('suppression d’équipe : refusée si membres, autorisée si vide', async () => {
    const t = await team();
    const a = await tech();
    await service.addMember(t.id, a.id);
    expect(await conflictCode(service.remove(t.id))).toEqual({ status: 409, code: 'TEAM_NOT_EMPTY' });
    const empty = await team();
    await service.remove(empty.id);
    await expect(service.findOne(empty.id)).rejects.toMatchObject({ status: 404 });
  });

  it('responsable manuel : doit être membre ; événement « manual »', async () => {
    const t = await team();
    const [a, b, outsider] = [await tech(), await tech(), await tech()];
    await service.addMember(t.id, a.id);
    await service.addMember(t.id, b.id);
    expect(await conflictCode(service.setLeader(t.id, outsider.id))).toEqual({ status: 409, code: 'LEADER_NOT_MEMBER' });
    const v = await service.setLeader(t.id, b.id);
    expect(v.leaderId).toBe(Number(b.id));
    expect(v.leaderEvents[0]).toMatchObject({ reason: LeaderEventReason.MANUAL });
  });

  it('assertNotMember : 409 pour un membre, rien pour un technicien libre', async () => {
    const t = await team();
    const [a, free] = [await tech(), await tech()];
    await service.addMember(t.id, a.id);
    expect(await conflictCode(service.assertNotMember(a.id, 'supprimer'))).toEqual({ status: 409, code: 'USER_IS_TEAM_MEMBER' });
    await expect(service.assertNotMember(free.id, 'supprimer')).resolves.toBeUndefined();
  });

  it('nom d’équipe unique (409) et lecture « mon équipe » sans coordonnées', async () => {
    const t = await team();
    expect(await conflictCode(service.create(t.name))).toEqual({ status: 409, code: 'TEAM_NAME_TAKEN' });
    const a = await tech();
    await service.addMember(t.id, a.id);
    const mine = await service.findMine(a.id);
    expect(mine.name).toBe(t.name);
    expect(mine.members[0]).not.toHaveProperty('email');
    expect(mine).not.toHaveProperty('staffing');
    await expect(service.findMine((await tech()).id)).rejects.toMatchObject({ status: 404 });
  });
});
