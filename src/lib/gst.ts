// All money is integer paise to avoid floating point errors.
export type Line = { qty: number; ratePaise: number; gstPercent: number };
export type Totals = {
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
};

const roundHalfUp = (n: number) => Math.floor(n + 0.5);

export function computeTotals(lines: Line[], interState: boolean): Totals {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const l of lines) {
    if (!(l.qty > 0) || l.ratePaise < 0 || l.gstPercent < 0) {
      throw new Error('Invalid line: quantity must be positive, rate and GST non-negative');
    }
    const base = roundHalfUp(l.qty * l.ratePaise);
    const tax = roundHalfUp((base * l.gstPercent) / 100);
    subtotal += base;
    if (interState) {
      igst += tax;
    } else {
      const half = Math.floor(tax / 2);
      cgst += half;
      sgst += tax - half;
    }
  }
  const exact = subtotal + cgst + sgst + igst;
  const rounded = Math.round(exact / 100) * 100;
  return {
    subtotalPaise: subtotal,
    cgstPaise: cgst,
    sgstPaise: sgst,
    igstPaise: igst,
    roundOffPaise: rounded - exact,
    totalPaise: rounded,
  };
}

export function isInterState(sellerStateCode: string, buyerStateCode: string): boolean {
  return sellerStateCode.trim() !== '' && buyerStateCode.trim() !== '' && sellerStateCode !== buyerStateCode;
}

// GSTIN: 2 digit state, 10 char PAN, 1 entity digit, Z, 1 checksum char.
export function isValidGstin(g: string): boolean {
  const s = g.trim().toUpperCase();
  if (!/^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s)) return false;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = chars.indexOf(s[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  const check = chars[(36 - (sum % 36)) % 36];
  return s[14] === check;
}
