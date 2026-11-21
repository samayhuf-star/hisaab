import { parseCommand } from '../lib/hinglish';

test('Devanagari bill command is understood', () => {
  const c: any = parseCommand('रोहित को २०००० का बिल भेजो');
  expect(c.kind).not.toBe('unknown');
});
test('Devanagari number words and gst', () => {
  const c: any = parseCommand('रोहित को बीस हजार का बिल अठारह प्रतिशत जीएसटी');
  expect(c.kind).not.toBe('unknown');
});
