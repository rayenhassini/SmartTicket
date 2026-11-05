import { TicketsService } from '../src/tickets/tickets.service';

// Régression : mysql2 renvoie les ids BIGINT en string, alors que l'id du
// technicien vient d'un ParseIntPipe (number). L'ancien `t.id !== technicianId`
// ne retirait jamais rien.
describe('TicketsService.removeTechnician', () => {
  function build(technicians: Array<{ id: any }>) {
    const ticket: any = { id: '7', technicians };
    const ticketsRepository: any = {
      findOne: jest.fn().mockResolvedValue(ticket),
      save: jest.fn().mockImplementation(async (t) => t),
    };
    const service = new TicketsService(ticketsRepository, {} as any);
    return { service, ticketsRepository };
  }

  it('retire le technicien quand les ids de la base sont des strings', async () => {
    const { service, ticketsRepository } = build([{ id: '3' }, { id: '5' }]);
    const result = await service.removeTechnician(7, 3);
    expect(result.technicians.map((t) => String(t.id))).toEqual(['5']);
    expect(ticketsRepository.save).toHaveBeenCalledTimes(1);
  });

  it('ne retire personne si le technicien n’est pas assigné', async () => {
    const { service } = build([{ id: '5' }]);
    const result = await service.removeTechnician(7, 99);
    expect(result.technicians).toHaveLength(1);
  });
});

// Phase 4 : règle interne / externe + validation du client (sans base de données).
describe('TicketsService : client obligatoire pour un ticket externe', () => {
  function build(opts: { client?: { id: any } | null; ticket?: any } = {}) {
    const ticketsRepository: any = {
      create: jest.fn().mockImplementation((e) => e),
      save: jest.fn().mockImplementation(async (t) => t),
      findOne: jest.fn().mockResolvedValue(opts.ticket),
      manager: { findOne: jest.fn().mockResolvedValue({ id: '9' }) },
    };
    const usersRepository: any = { findOne: jest.fn().mockResolvedValue(opts.client ?? null) };
    return { service: new TicketsService(ticketsRepository, usersRepository), ticketsRepository, usersRepository };
  }
  const base = { number: 'T-1', title: 't', description: 'd' };
  const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e: any) { return e.response?.code ?? e.message; } };

  it('création : externe sans client → CLIENT_REQUIRED', async () => {
    expect(await code(build().service.create({ ...base } as any))).toBe('CLIENT_REQUIRED');
    expect(await code(build().service.create({ ...base, isHelpdesk: true } as any))).toBe('CLIENT_REQUIRED');
  });
  it('création : interne sans client → accepté ; externe avec client actif → accepté', async () => {
    expect(await code(build().service.create({ ...base, internalTask: true } as any))).toBe('ok');
    expect(await code(build({ client: { id: '5' } }).service.create({ ...base, clientId: 5 } as any))).toBe('ok');
  });
  it('création : clientId qui n\'est pas un client actif → INVALID_CLIENT (même pour un ticket interne)', async () => {
    expect(await code(build({ client: null }).service.create({ ...base, internalTask: true, clientId: 5 } as any))).toBe('INVALID_CLIENT');
  });
  it('assignTeam : externe sans client → CLIENT_REQUIRED ; interne sans client → accepté', async () => {
    const ext = { id: '1', internalTask: false, client: null, teamId: null, status: 'Not Assigned' };
    expect(await code(build({ ticket: ext }).service.assignTeam(1, 9))).toBe('CLIENT_REQUIRED');
    const int = { id: '2', internalTask: true, client: null, teamId: null, status: 'Not Assigned' };
    expect(await code(build({ ticket: int }).service.assignTeam(2, 9))).toBe('ok');
  });
  it('assignTeam : externe avec client → accepté', async () => {
    const ext = { id: '3', internalTask: false, client: { id: '5' }, teamId: null, status: 'Not Assigned' };
    expect(await code(build({ ticket: ext }).service.assignTeam(3, 9))).toBe('ok');
  });
});
