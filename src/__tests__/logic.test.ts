import { computeTotals, isValidGstin, isInterState } from '../lib/gst';
import { formatRupees, buildUpiLink } from '../lib/format';
import { parseHinglishBill } from '../lib/hinglish';

describe('computeTotals', () => {
  it('matches the approved design sample: 20x150 + 10x140 at 18% = 5192', () => {
    const t = computeTotals(
      [
        { qty: 20, ratePaise: 15000, gstPercent: 18 },
        { qty: 10, ratePaise: 14000, gstPercent: 18 },
      ],
      false,
    );
    expect(t.subtotalPaise).toBe(440000);
    expect(t.cgstPaise).toBe(39600);
    expect(t.sgstPaise).toBe(39600);
    expect(t.igstPaise).toBe(0);
    expect(t.totalPaise).toBe(519200);
  });
  it('uses IGST for inter-state', () => {
    const t = computeTotals([{ qty: 1, ratePaise: 100000, gstPercent: 18 }], true);
    expect(t.igstPaise).toBe(18000);
    expect(t.cgstPaise + t.sgstPaise).toBe(0);
  });
  it('splits odd tax paise without losing any', () => {
    const t = computeTotals([{ qty: 1, ratePaise: 101, gstPercent: 5 }], false);
    expect(t.cgstPaise + t.sgstPaise).toBe(5);
  });
  it('rounds total to whole rupee and records round-off', () => {
    const t = computeTotals([{ qty: 1, ratePaise: 10050, gstPercent: 0 }], false);
    expect(t.totalPaise % 100).toBe(0);
    expect(t.subtotalPaise + t.roundOffPaise).toBe(t.totalPaise);
  });
  it('rejects bad input', () => {
    expect(() => computeTotals([{ qty: 0, ratePaise: 100, gstPercent: 18 }], false)).toThrow();
    expect(() => computeTotals([{ qty: 1, ratePaise: -1, gstPercent: 18 }], false)).toThrow();
  });
  it('handles empty bill', () => {
    expect(computeTotals([], false).totalPaise).toBe(0);
  });
});

describe('gstin and state', () => {
  it('accepts a valid GSTIN and rejects a bad checksum', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(isValidGstin('27AAPFU0939F1ZX')).toBe(false);
    expect(isValidGstin('bad')).toBe(false);
  });
  it('detects inter-state', () => {
    expect(isInterState('09', '07')).toBe(true);
    expect(isInterState('09', '09')).toBe(false);
    expect(isInterState('', '09')).toBe(false);
  });
});

describe('formatRupees', () => {
  it('uses Indian grouping', () => {
    expect(formatRupees(18240000)).toBe('₹1,82,400');
    expect(formatRupees(519200)).toBe('₹5,192');
    expect(formatRupees(99900)).toBe('₹999');
    expect(formatRupees(12345)).toBe('₹123.45');
    expect(formatRupees(-500000)).toBe('-₹5,000');
    expect(formatRupees(0)).toBe('₹0');
  });
});

describe('buildUpiLink', () => {
  it('builds an NPCI style link', () => {
    const l = buildUpiLink('shop@upi', 'Sharma Traders', 519200, 'INV-1043');
    expect(l).toBe('upi://pay?pa=shop%40upi&pn=Sharma%20Traders&am=5192.00&cu=INR&tn=INV-1043');
  });
});

describe('parseHinglishBill', () => {
  it('parses items', () => {
    const r = parseHinglishBill('Gupta ji ko 20 LED bulb aur 10 switch ka bill');
    expect(r.party).toBe('Gupta ji');
    expect(r.lines).toEqual([
      { qty: 20, item: 'LED bulb' },
      { qty: 10, item: 'switch' },
    ]);
  });
  it('parses a lump amount', () => {
    const r = parseHinglishBill('Sharma ji ko 5000 ka bill');
    expect(r.party).toBe('Sharma ji');
    expect(r.amountPaise).toBe(500000);
    expect(r.lines).toEqual([]);
  });
  it('understands Hindi number words', () => {
    const r = parseHinglishBill('Raj ko paanch switch aur das bulb ka bill');
    expect(r.lines).toEqual([
      { qty: 5, item: 'switch' },
      { qty: 10, item: 'bulb' },
    ]);
  });
  it('returns nothing for unrelated text', () => {
    const r = parseHinglishBill('hello there');
    expect(r.party).toBeNull();
    expect(r.lines).toEqual([]);
  });
});
