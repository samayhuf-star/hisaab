// Understands short Hindi / Hinglish / English sentences spoken or typed by a shop owner.
// Two jobs: read a bill ("Rakesh ko 10,000 ka bill, 18 percent GST") and read a party
// ("add party Rakesh phone 98xxxxxxxx email a@b.com GST yes 18 percent").

export type ParsedLine = { qty: number; item: string; ratePaise?: number; gstPercent?: number };
export type ParsedBill = {
  party: string | null;
  lines: ParsedLine[];
  amountPaise: number | null; // a lump sum ("5000 ka bill") before GST
  gstPercent: number | null; // spoken GST rate, if any
  noGst: boolean; // "no GST" / "bina GST"
};

const ONES: Record<string, number> = {
  ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, paanch: 5, panch: 5, five: 5,
  chhe: 6, che: 6, chah: 6, six: 6, saat: 7, sat: 7, seven: 7, aath: 8, ath: 8, eight: 8, nau: 9, nine: 9,
  das: 10, ten: 10, gyarah: 11, gyara: 11, barah: 12, bara: 12, terah: 13, chaudah: 14, pandrah: 15, pandra: 15,
  solah: 16, satrah: 17, athara: 18, atharah: 18, aathara: 18, gthara: 18, thara: 18, unnis: 19, bees: 20,
  pachees: 25, tees: 30, chalis: 40, pachas: 50, saath: 60, sattar: 70, assi: 80, nabbe: 90,
};
const MULT: Record<string, number> = { sau: 100, hundred: 100, hazaar: 1000, hazar: 1000, hajar: 1000, thousand: 1000, lakh: 100000, lac: 100000, crore: 10000000 };
const PERCENT = new Set(['percent', 'pc', 'pct', '%', 'pratishat', 'prtishat', 'persent', 'prasent']);
const RATE = new Set(['rate', 'bhav', 'bhaav', 'daam', 'price']);
const STOP = new Set(['ka', 'ki', 'ke', 'kab', 'kaa', 'bill', 'banao', 'bana', 'do', 'kar', 'karo', 'create', 'invoice', 'dikhao', 'dikha', 'show', 'total', 'bhejo', 'bhej', 'send', 'gst', 'plus', 'with', 'ke', 'saath']);
const LEAD = new Set(['create', 'make', 'send', 'new', 'bill', 'invoice', 'banao', 'bhejo', 'add', 'naya', 'a', 'the']);
const PARTY_WORDS = /\b(party|customer|client|supplier|vendor|contact|grahak|dukaan)\b/i;
const ADD_WORDS = /\b(add|create|new|naya|nayi|jodo|jod|banao|bana|save|register)\b/i;

const clean = (t: string) => t.toLowerCase().replace(/[,]/g, '').replace(/[^\p{L}\p{N}.%@+\-]/gu, '');

// Reads a number starting at tokens[i]. Handles "10,000", "das hazar", "paanch sau", "2 lakh".
function numberAt(tokens: string[], i: number): { value: number; used: number } | null {
  let total = 0;
  let current = 0;
  let used = 0;
  let lastWasOnes = false;
  for (let k = i; k < tokens.length; k++) {
    const w = clean(tokens[k]);
    if (/^\d+(\.\d+)?$/.test(w)) {
      if (lastWasOnes) break;
      current += Number(w);
      lastWasOnes = true;
    } else if (w in ONES && !(w === 'do' && k === i && tokens.length > k + 1 && !(clean(tokens[k + 1]) in MULT) && false)) {
      if (lastWasOnes) break;
      current += ONES[w];
      lastWasOnes = true;
    } else if (w in MULT) {
      total += (current || 1) * MULT[w];
      current = 0;
      lastWasOnes = false;
    } else break;
    used++;
  }
  if (used === 0) return null;
  return { value: total + current, used };
}

// Finds "<number> percent" or "gst <number>" anywhere. Returns the rate and the token range to remove.
function findGst(tokens: string[]): { rate: number; from: number; to: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    const w = clean(tokens[i]);
    if (/^\d+(\.\d+)?%$/.test(w)) return { rate: parseFloat(w), from: i, to: i + 1 };
    if (PERCENT.has(w)) {
      for (let s = Math.max(0, i - 3); s < i; s++) {
        const n = numberAt(tokens, s);
        if (n && s + n.used === i) {
          // include a leading "gst" word as part of the phrase
          const from = s > 0 && clean(tokens[s - 1]) === 'gst' ? s - 1 : s;
          return { rate: n.value, from, to: i + 1 };
        }
      }
    }
    if (w === 'gst' && i + 1 < tokens.length) {
      const n = numberAt(tokens, i + 1);
      if (n && n.value <= 40) return { rate: n.value, from: i, to: i + 1 + n.used };
    }
  }
  return null;
}


// Hindi speech recognition (hi-IN) returns Devanagari. Map the command words and numbers to the
// Latin forms the parser understands. Names (e.g. "रोहित") are left as spoken.
const DEVA: Record<string, string> = {
  'को': 'ko', 'का': 'ka', 'की': 'ki', 'के': 'ke', 'बिल': 'bill', 'भेजो': 'bhejo', 'भेज': 'bhej', 'बनाओ': 'banao', 'बना': 'bana', 'दो': 'do',
  'हजार': 'hazaar', 'हज़ार': 'hazaar', 'लाख': 'lakh', 'करोड़': 'crore', 'सौ': 'sau', 'रुपये': 'rupaye', 'रुपए': 'rupaye', 'रूपये': 'rupaye',
  'पार्टी': 'party', 'कस्टमर': 'customer', 'ग्राहक': 'grahak', 'सप्लायर': 'supplier', 'जोड़ो': 'jodo', 'जोड़': 'jod', 'नया': 'naya', 'नई': 'nayi', 'नयी': 'nayi',
  'नंबर': 'number', 'मोबाइल': 'mobile', 'फोन': 'phone', 'ईमेल': 'email', 'जीएसटी': 'gst', 'प्रतिशत': 'percent', 'परसेंट': 'percent', 'पर्सेंट': 'percent', 'प्रसेंट': 'percent',
  'और': 'aur', 'जी': 'ji', 'हाँ': 'yes', 'हां': 'yes', 'नहीं': 'nahi', 'बिना': 'bina', 'रेट': 'rate', 'भाव': 'bhav', 'दाम': 'daam',
  'एक': 'ek', 'तीन': 'teen', 'चार': 'char', 'पांच': 'paanch', 'पाँच': 'paanch', 'छह': 'chhe', 'छः': 'chhe', 'छ': 'chhe', 'सात': 'saat', 'आठ': 'aath', 'नौ': 'nau', 'दस': 'das',
  'ग्यारह': 'gyarah', 'बारह': 'barah', 'तेरह': 'terah', 'चौदह': 'chaudah', 'पंद्रह': 'pandrah', 'पन्द्रह': 'pandrah', 'सोलह': 'solah', 'सत्रह': 'satrah', 'अठारह': 'atharah',
  'उन्नीस': 'unnis', 'बीस': 'bees', 'पच्चीस': 'pachees', 'तीस': 'tees', 'चालीस': 'chalis', 'पचास': 'pachas', 'साठ': 'saath', 'सत्तर': 'sattar', 'अस्सी': 'assi', 'नब्बे': 'nabbe',
};
const DEVA_DIGITS = '०१२३४५६७८९';
const fromDevanagari = (input: string) =>
  input
    .replace(/[०-९]/g, (d) => String(DEVA_DIGITS.indexOf(d)))
    .split(/\s+/)
    .map((w) => DEVA[w.replace(/[,।.]+$/g, '')] ?? w)
    .join(' ');

const normalize = (input: string) =>
  fromDevanagari(input)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bg\s+thara\b/gi, 'athara')
    .replace(/\bjee\b/gi, 'ji');

function partyFrom(words: string[]): { party: string; rest: string[] } | null {
  const lower = words.map((w) => w.toLowerCase());
  let idx = lower.indexOf('ko');
  let restFrom = idx + 1;
  let start = 0;
  if (idx < 1) {
    // English: "bill for Rakesh amount 10000"
    const f = lower.findIndex((w) => w === 'for' || w === 'to');
    if (f < 0 || f + 1 >= words.length) return null;
    let e = f + 1;
    while (e < words.length && !numberAt(words, e) && !['amount', 'of', 'rs', 'rupees', 'rupee', 'ka', 'gst', 'rate'].includes(lower[e])) e++;
    idx = e;
    restFrom = e;
    start = f + 1;
  } else {
    while (start < idx && LEAD.has(lower[start])) start++;
  }
  const party = words.slice(start, idx).join(' ').trim();
  if (!party) return null;
  return { party, rest: words.slice(restFrom) };
}

// Handles phrases like:
//   "Gupta ji ko 20 LED bulb aur 10 switch ka bill"
//   "Sharma ji ko 5000 ka bill"
//   "Rakesh ko 10,000 ka bill aur athara percent GST"
//   "Raj ko 20 bulb rate 150 aur 10 switch rate 140, 18 percent"
export function parseHinglishBill(input: string): ParsedBill {
  const empty: ParsedBill = { party: null, lines: [], amountPaise: null, gstPercent: null, noGst: false };
  const text = normalize(input);
  const words = text.split(' ');
  const p = partyFrom(words);
  if (!p) return empty;
  let rest = p.rest;
  const out: ParsedBill = { ...empty, party: p.party };

  const lowerAll = rest.join(' ').toLowerCase();
  if (/\b(no gst|without gst|bina gst|gst nahi|gst nahin|gst free)\b/.test(lowerAll)) {
    out.noGst = true;
    rest = rest.filter((w, i, a) => !['no', 'without', 'bina', 'nahi', 'nahin', 'free'].includes(w.toLowerCase()) || a[i + 1]?.toLowerCase() === 'gst' || a[i - 1]?.toLowerCase() === 'gst');
  }

  const g = findGst(rest);
  if (g) {
    out.gstPercent = g.rate;
    rest = [...rest.slice(0, g.from), ...rest.slice(g.to)];
  }

  // "<amount> ka bill" with no items
  const first = rest.length ? numberAt(rest, 0) : null;
  const afterFirst = first ? clean(rest[first.used] || '') : '';
  if (first && (afterFirst === '' || ['ka', 'ki', 'kab', 'kaa', 'ke', 'bill', 'rupaye', 'rupees', 'rs'].includes(afterFirst))) {
    const maybeLine = rest.slice(first.used).some((w) => !STOP.has(clean(w)) && !['rupaye', 'rupees', 'rs', 'aur', 'and'].includes(clean(w)));
    if (!maybeLine) {
      out.amountPaise = Math.round(first.value * 100);
      return out;
    }
  }

  const segments: string[][] = [[]];
  for (const w of rest) {
    const lw = w.toLowerCase();
    if (lw === 'aur' || lw === 'and') segments.push([]);
    else segments[segments.length - 1].push(w);
  }
  for (const segIn of segments) {
    let seg = segIn;
    if (seg.length === 0) continue;
    let ratePaise: number | undefined;
    for (let i = 0; i < seg.length; i++) {
      if (RATE.has(clean(seg[i]))) {
        let j = i + 1;
        while (j < seg.length && ['ka', 'ki', 'se', 'at', 'is'].includes(clean(seg[j]))) j++;
        const n = numberAt(seg, j);
        if (n) {
          ratePaise = Math.round(n.value * 100);
          seg = [...seg.slice(0, i), ...seg.slice(j + n.used)];
          break;
        }
      }
    }
    const q = numberAt(seg, 0);
    let qty = q ? q.value : 1;
    const itemWords = seg.slice(q ? q.used : 0);
    while (itemWords.length && STOP.has(clean(itemWords[itemWords.length - 1]))) itemWords.pop();
    while (itemWords.length && STOP.has(clean(itemWords[0]))) itemWords.shift();
    if (!q && ratePaise === undefined) continue;
    // A big number with no real rate is an amount ("10,000 ka bill"), not 10,000 pieces.
    const looksLikeAmount = qty >= 1000 && (ratePaise === undefined || ratePaise === qty * 100);
    if (looksLikeAmount) {
      out.lines.push({ qty: 1, item: 'Goods / services', ratePaise: Math.round(qty * 100) });
      continue;
    }
    if (itemWords.length === 0) continue;
    const line: ParsedLine = { qty, item: itemWords.join(' ') };
    if (ratePaise !== undefined) line.ratePaise = ratePaise;
    out.lines.push(line);
  }
  return out;
}

export type ParsedParty = {
  name: string;
  phone: string;
  email: string;
  gstin: string;
  gstRegistered: boolean | null;
  gstPercent: number | null;
  kind: 'customer' | 'supplier';
};

function spokenEmail(text: string): string {
  const t = text
    .toLowerCase()
    .replace(/\s+at the rate( of)?\s+/g, '@')
    .replace(/\s+attherate\s+/g, '@')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s+dot\s+/g, '.')
    .replace(/\s+underscore\s+/g, '_')
    .replace(/\s+dash\s+/g, '-');
  let m = t.match(/([a-z0-9._+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/);
  if (m) return `${m[1]}@${m[2]}`;
  m = t.match(/([a-z0-9._+-]+)\s+at\s+([a-z0-9-]+(?:\.[a-z]{2,})+)/);
  return m ? `${m[1]}@${m[2]}` : '';
}

// "add party Rakesh phone 98765 43210 email rakesh at gmail dot com GST yes 29ABCDE1234F1Z5 18 percent"
export function parsePartyCommand(input: string): ParsedParty | null {
  const text = normalize(input);
  if (!PARTY_WORDS.test(text) || !ADD_WORDS.test(text)) return null;
  const lower = text.toLowerCase();
  const email = spokenEmail(text);
  const digits = lower.replace(/(\d)[\s-]+(?=\d)/g, '$1');
  const ph = digits.match(/(?:\+?91)?([6-9]\d{9})\b/);
  const phone = ph ? ph[1] : '';
  const squeezed = lower.replace(/\s+/g, '');
  const gm = squeezed.match(/\d{2}[a-z]{5}\d{4}[a-z][1-9a-z]z[0-9a-z]/);
  const gstin = gm ? gm[0].toUpperCase() : '';
  const tokens = text.split(' ');
  const g = findGst(tokens);
  let gstRegistered: boolean | null = gstin ? true : null;
  if (/\b(no gst|without gst|bina gst|gst nahi|gst nahin|unregistered)\b/.test(lower)) gstRegistered = false;
  else if (/\bgst (yes|hai|haan|registered|number)\b/.test(lower)) gstRegistered = true;
  // the name sits after the word party/customer/... and before the first detail keyword
  const m = text.match(/\b(?:party|customer|client|supplier|vendor|contact|grahak)\b\s+(?:named?\s+|ka naam\s+)?(.+)/i) || text.match(/(?:add|create|new|naya|nayi)\s+(.+?)\s+(?:party|customer|client|supplier)\b/i);
  let rawName = m ? m[1] : '';
  rawName = rawName.split(/\b(?:phone|mobile|number|contact|email|mail|gst|gstin|with|ke saath|id|at)\b/i)[0];
  rawName = rawName.replace(/[\d@.%]+/g, ' ').replace(/\s+/g, ' ').trim();
  const name = rawName.split(' ').filter((w) => !LEAD.has(w.toLowerCase()) && !ADD_WORDS.test(w)).join(' ').trim();
  if (!name) return null;
  return {
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    phone, email, gstin, gstRegistered, gstPercent: g ? g.rate : null,
    kind: /\b(supplier|vendor)\b/i.test(text) ? 'supplier' : 'customer',
  };
}

export type VoiceCommand =
  | { kind: 'party'; party: ParsedParty }
  | { kind: 'bill'; text: string }
  | { kind: 'unknown' };

// Decides what a spoken sentence is asking for.
export function parseCommand(input: string): VoiceCommand {
  const party = parsePartyCommand(input);
  if (party) return { kind: 'party', party };
  const bill = parseHinglishBill(input);
  if (bill.party && (bill.lines.length > 0 || bill.amountPaise !== null)) return { kind: 'bill', text: input.trim() };
  return { kind: 'unknown' };
}
