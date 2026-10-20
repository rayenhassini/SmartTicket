import { isStaffingDescent, staffingLevel } from '../src/teams/staffing';

describe('staffingLevel (D6)', () => {
  it.each([
    [0, 'empty'],
    [1, 'critical'],
    [2, 'warning'],
    [3, 'warning'],
    [4, 'normal'],
    [12, 'normal'],
  ])('%i membre(s) → %s', (count, level) => {
    expect(staffingLevel(count as number)).toBe(level);
  });
});

describe('isStaffingDescent — email uniquement à la descente de palier', () => {
  it('descend normal → warning, warning → critical, normal → critical', () => {
    expect(isStaffingDescent('normal', 'warning')).toBe(true);
    expect(isStaffingDescent('warning', 'critical')).toBe(true);
    expect(isStaffingDescent('normal', 'critical')).toBe(true);
  });
  it('pas d’email à la croissance, au même palier, ni vers « vide »', () => {
    expect(isStaffingDescent('critical', 'warning')).toBe(false);
    expect(isStaffingDescent('empty', 'critical')).toBe(false);
    expect(isStaffingDescent('warning', 'warning')).toBe(false);
    expect(isStaffingDescent('critical', 'empty')).toBe(false);
  });
});
