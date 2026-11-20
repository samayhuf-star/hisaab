jest.mock('expo-sqlite', () => ({}));
import { parseBackup } from '../db';

describe('parseBackup', () => {
  it('accepts the all-businesses file', () => {
    const b = parseBackup(JSON.stringify({ app: 'hisaab', version: 2, firms: [{ name: 'A', data: { parties: [], invoices: [] } }] }));
    expect(b.firms).toHaveLength(1);
  });
  it('accepts the older single-business export', () => {
    const b = parseBackup(JSON.stringify({ settings: [], parties: [{ id: 1 }], items: [], invoices: [], invoice_lines: [], payments: [] }));
    expect(b.firms[0].data.parties).toHaveLength(1);
  });
  it('rejects other files', () => {
    expect(() => parseBackup('not json')).toThrow();
    expect(() => parseBackup('{"a":1}')).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'hisaab', firms: [] }))).toThrow();
  });
});
