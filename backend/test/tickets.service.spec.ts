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
