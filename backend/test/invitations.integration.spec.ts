/* Tests d'intégration Phase 3 — BASE RÉELLE (migrations 001 + 002 appliquées).
 * Ne tournent que si TEST_DB_NAME est défini (base de TEST dédiée) :
 *   sed 's/smartticket_v1/smartticket_test/g' database/migrations/002_phase3_invitations.sql | mysql -u root -p
 *   TEST_DB_NAME=smartticket_test DB_HOST=... DB_USERNAME=... DB_PASSWORD=... npm test
 * Données préfixées « t3-… », supprimées à la fin. */
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../src/users/entities/user.entity';
import { Team } from '../src/teams/entities/team.entity';
import { TeamMember } from '../src/teams/entities/team-member.entity';
import { LeaderEventReason, TeamLeaderEvent } from '../src/teams/entities/team-leader-event.entity';
import { TeamsService } from '../src/teams/teams.service';
import { TeamNotifierService } from '../src/teams/team-notifier.service';
import { UserInvitation } from '../src/invitations/entities/user-invitation.entity';
import { InvitationsService } from '../src/invitations/invitations.service';
import { MailService } from '../src/mail/mail.service';
import { UserAuthority } from '../src/common/enums/user-authority.enum';

const dbName = process.env.TEST_DB_NAME;
const maybe = dbName ? describe : describe.skip;
const run = Date.now().toString(36);

maybe('Phase 3 — invitations technicien (base réelle)', () => {
  let ds: DataSource;
  let service: InvitationsService;
  let teams: TeamsService;
  let sendMock: jest.SpyInstance;
  let pmoId: number;
  const teamIds: number[] = [];
  let seq = 0;
  const email = (tag = 'u') => `t3-${run}-${tag}${++seq}@example.com`;

  beforeAll(async () => {
    const values: Record<string, unknown> = { 'invitation.ttlHours': 72, 'frontend.baseUrl': 'http://front.test' };
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DB_HOST ?? '127.0.0.1',
          port: parseInt(process.env.DB_PORT ?? '3306', 10),
          username: process.env.DB_USERNAME ?? 'root',
          password: process.env.DB_PASSWORD ?? '',
          database: dbName,
          entities: [User, Team, TeamMember, TeamLeaderEvent, UserInvitation],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([User, Team, TeamMember, TeamLeaderEvent, UserInvitation]),
      ],
      providers: [
        InvitationsService,
        TeamsService,
        TeamNotifierService,
        { provide: MailService, useValue: { sendInvitation: jest.fn() } },
        { provide: ConfigService, useValue: { get: (k: string) => values[k] } },
      ],
    }).compile();
    ds = moduleRef.get(DataSource);
    service = moduleRef.get(InvitationsService);
    teams = moduleRef.get(TeamsService);
    jest.spyOn(moduleRef.get(TeamNotifierService), 'notify').mockResolvedValue(null);
    sendMock = moduleRef.get(MailService).sendInvitation as unknown as jest.SpyInstance;
    const res = await ds.getRepository(User).insert({ firstName: 'Pmo', lastName: 'T3', email: email('pmo'), passwordHash: 'x', authority: UserAuthority.PMO, valid: true });
    pmoId = Number(res.identifiers[0].id);
  });

  afterAll(async () => {
    if (!ds) return;
    if (teamIds.length) {
      await ds.query(`DELETE FROM team_members WHERE team_id IN (${teamIds.join(',')})`);
      await ds.query(`DELETE FROM teams WHERE id IN (${teamIds.join(',')})`); // invitations + événements en cascade
    }
    await ds.query(`DELETE FROM user_invitations WHERE email LIKE 't3-${run}-%'`);
    await ds.query(`DELETE FROM users WHERE email LIKE 't3-${run}-%'`);
    await ds.destroy();
  });

  // Chaque envoi (simulé) capture le lien : on en extrait le jeton comme le ferait l'invité.
  beforeEach(() => sendMock.mockReset().mockResolvedValue({ mode: 'log' }));
  const tokenOf = () => new URL(sendMock.mock.calls.at(-1)![0].link).searchParams.get('token') as string;

  async function team() {
    const t = await teams.create(`t3-${run}-${++seq}`);
    teamIds.push(t.id);
    return t;
  }
  const errOf = async (p: Promise<unknown>) => {
    try { await p; } catch (e: any) { return { status: e.getStatus?.(), code: e.getResponse?.().code }; }
    return { status: 200, code: undefined };
  };
  const form = (token: string, over = {}) => ({ token, firstName: 'Nouveau', lastName: 'Tech', password: 'Passw0rd-ok', ...over });

  it('création : pending, lien avec jeton, aucun jeton en clair en base', async () => {
    const t = await team();
    const e = email();
    const inv = await service.create({ email: e, teamId: t.id }, pmoId);
    expect(inv).toMatchObject({ email: e, status: 'pending', teamId: t.id, authority: 'technician', mailMode: 'log' });
    const token = tokenOf();
    expect(inv.devLink).toBe(`http://front.test/invite/accept?token=${token}`);
    const [row] = await ds.query('SELECT token FROM user_invitations WHERE id = ?', [inv.id]);
    expect(row.token).not.toBe(token);
    expect(row.token).toHaveLength(64);
  });

  it('refuse : équipe inexistante (404), email déjà inscrit (409), doublon pending (409)', async () => {
    const t = await team();
    expect(await errOf(service.create({ email: email(), teamId: 999999999 }, pmoId))).toEqual({ status: 404, code: undefined });
    expect(await errOf(service.create({ email: `t3-${run}-pmo1@example.com`, teamId: t.id }, pmoId))).toEqual({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' });
    const e = email();
    await service.create({ email: e, teamId: t.id }, pmoId);
    expect(await errOf(service.create({ email: e, teamId: t.id }, pmoId))).toEqual({ status: 409, code: 'INVITATION_ALREADY_PENDING' });
  });

  it('la base elle-même interdit deux invitations pending pour un email', async () => {
    const t = await team();
    const e = email();
    const ins = (h: string) => ds.query(`INSERT INTO user_invitations (email, token, team_id, status, expires_at) VALUES (?, ?, ?, 'pending', NOW(3) + INTERVAL 1 DAY)`, [e, h, t.id]);
    await ins('a'.repeat(64));
    await expect(ins('b'.repeat(64))).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('acceptation dans une équipe VIDE : technicien valid, membre, responsable first_member, invitation acceptée', async () => {
    const t = await team();
    const e = email();
    await service.create({ email: e, teamId: t.id }, pmoId);
    const token = tokenOf();
    expect(await service.validate(token)).toMatchObject({ email: e, teamName: t.name });
    await service.accept(form(token, { phoneNumber: '0600000000' }));

    const user = await ds.getRepository(User).findOneOrFail({ where: { email: e }, select: ['id', 'authority', 'valid', 'passwordHash', 'firstName'] });
    expect(user).toMatchObject({ authority: UserAuthority.TECHNICIAN, valid: true, firstName: 'Nouveau' });
    expect(await bcrypt.compare('Passw0rd-ok', user.passwordHash)).toBe(true);

    const view = await teams.findOne(t.id);
    expect(view.memberCount).toBe(1);
    expect(view.leaderId).toBe(Number(user.id));
    expect(view.leaderEvents[0]).toMatchObject({ reason: LeaderEventReason.FIRST_MEMBER });
    const [row] = await ds.query('SELECT status, accepted_at, accepted_user_id FROM user_invitations WHERE email = ?', [e]);
    expect(row.status).toBe('accepted');
    expect(row.accepted_at).not.toBeNull();
    expect(String(row.accepted_user_id)).toBe(String(user.id));
    // Réutilisation du lien : refusée.
    expect(await errOf(service.accept(form(token)))).toEqual({ status: 410, code: 'INVITATION_USED' });
    expect(await errOf(service.validate(token))).toEqual({ status: 410, code: 'INVITATION_USED' });
  });

  it('acceptation dans une équipe non vide : simple membre, responsable inchangé', async () => {
    const t = await team();
    const e1 = email(), e2 = email();
    await service.create({ email: e1, teamId: t.id }, pmoId);
    await service.accept(form(tokenOf()));
    await service.create({ email: e2, teamId: t.id }, pmoId);
    await service.accept(form(tokenOf()));
    const view = await teams.findOne(t.id);
    const first = await ds.getRepository(User).findOneOrFail({ where: { email: e1 } });
    expect(view.memberCount).toBe(2);
    expect(view.staffing).toBe('warning');
    expect(view.leaderId).toBe(Number(first.id));
  });

  it('jeton invalide → 404 ; annulé → 410 ; double annulation → 409', async () => {
    const t = await team();
    expect(await errOf(service.validate('nimporte-quoi'))).toEqual({ status: 404, code: 'INVITATION_INVALID' });
    expect(await errOf(service.accept(form('nimporte-quoi')))).toEqual({ status: 404, code: 'INVITATION_INVALID' });
    const inv = await service.create({ email: email(), teamId: t.id }, pmoId);
    const token = tokenOf();
    expect((await service.cancel(inv.id)).status).toBe('cancelled');
    expect(await errOf(service.validate(token))).toEqual({ status: 410, code: 'INVITATION_CANCELLED' });
    expect(await errOf(service.accept(form(token)))).toEqual({ status: 410, code: 'INVITATION_CANCELLED' });
    expect(await errOf(service.cancel(inv.id))).toEqual({ status: 409, code: 'INVITATION_NOT_PENDING' });
    expect(await errOf(service.cancel(999999999))).toEqual({ status: 404, code: undefined });
    // Après annulation, une nouvelle invitation pour le même email est possible.
    await expect(service.create({ email: inv.email, teamId: t.id }, pmoId)).resolves.toMatchObject({ status: 'pending' });
  });

  it('jeton expiré → 410 ; la liste l’affiche « expired » ; une nouvelle invitation reste possible', async () => {
    const t = await team();
    const e = email();
    const inv = await service.create({ email: e, teamId: t.id }, pmoId);
    const token = tokenOf();
    await ds.query('UPDATE user_invitations SET expires_at = NOW(3) - INTERVAL 1 HOUR WHERE id = ?', [inv.id]);
    expect(await errOf(service.validate(token))).toEqual({ status: 410, code: 'INVITATION_EXPIRED' });
    expect(await errOf(service.accept(form(token)))).toEqual({ status: 410, code: 'INVITATION_EXPIRED' });
    expect((await service.findAll()).find((v) => v.id === inv.id)?.status).toBe('expired');
    expect(await errOf(service.cancel(inv.id))).toEqual({ status: 409, code: 'INVITATION_NOT_PENDING' });
    expect(await service.findAll('pending')).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: inv.id })]));
    await expect(service.create({ email: e, teamId: t.id }, pmoId)).resolves.toMatchObject({ status: 'pending' });
  });

  it('email devenu inscrit entre-temps → 409, aucun compte créé, invitation inchangée', async () => {
    const t = await team();
    const e = email();
    await service.create({ email: e, teamId: t.id }, pmoId);
    const token = tokenOf();
    await ds.getRepository(User).insert({ firstName: 'X', lastName: 'Y', email: e, passwordHash: 'x', authority: UserAuthority.CLIENT, valid: true });
    expect(await errOf(service.accept(form(token)))).toEqual({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' });
    expect((await teams.findOne(t.id)).memberCount).toBe(0);
    const [row] = await ds.query('SELECT status FROM user_invitations WHERE email = ?', [e]);
    expect(row.status).toBe('pending');
  });

  it('deux acceptations simultanées du même lien : une seule réussit', async () => {
    const t = await team();
    await service.create({ email: email(), teamId: t.id }, pmoId);
    const token = tokenOf();
    const results = await Promise.all([errOf(service.accept(form(token))), errOf(service.accept(form(token)))]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await teams.findOne(t.id)).memberCount).toBe(1);
  });

  it('échec d’envoi du mail : 502, aucune invitation laissée en attente', async () => {
    const t = await team();
    const e = email();
    sendMock.mockRejectedValueOnce(new Error('SMTP down'));
    expect(await errOf(service.create({ email: e, teamId: t.id }, pmoId))).toEqual({ status: 502, code: 'MAIL_SEND_FAILED' });
    const rows = await ds.query('SELECT id FROM user_invitations WHERE email = ?', [e]);
    expect(rows).toHaveLength(0);
    await expect(service.create({ email: e, teamId: t.id }, pmoId)).resolves.toMatchObject({ status: 'pending' });
  });

  it('suppression d’une équipe vide : ses invitations partent avec elle (le lien devient invalide)', async () => {
    const t = await team();
    await service.create({ email: email(), teamId: t.id }, pmoId);
    const token = tokenOf();
    await teams.remove(t.id);
    expect(await errOf(service.validate(token))).toEqual({ status: 404, code: 'INVITATION_INVALID' });
  });
});
