export type ParsedBill = {
  party: string | null;
  lines: { qty: number; item: string }[];
  amountPaise: number | null;
};

const WORDS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7,
  aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, pandrah: 15, bees: 20, pachees: 25,
  tees: 30, chalis: 40, pachas: 50, sau: 100, hazaar: 1000, hajar: 1000,
};

function toNumber(tok: string): number | null {
  const t = tok.toLowerCase().replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t in WORDS) return WORDS[t];
  return null;
}

const STOP = new Set(['ka', 'ki', 'ke', 'bill', 'banao', 'bana', 'do', 'kar', 'karo', 'create', 'invoice']);

// Handles phrases like:
//   "Gupta ji ko 20 LED bulb aur 10 switch ka bill"
//   "Sharma ji ko 5000 ka bill"
export function parseHinglishBill(input: string): ParsedBill {
  const text = input.trim().replace(/\s+/g, ' ');
  const idx = text.toLowerCase().split(' ').indexOf('ko');
  if (idx < 1) return { party: null, lines: [], amountPaise: null };
  const words = text.split(' ');
  const party = words.slice(0, idx).join(' ');
  const rest = words.slice(idx + 1);

  // "<amount> ka bill" with no items
  if (rest.length >= 2 && toNumber(rest[0]) !== null && (rest[1] || '').toLowerCase() === 'ka') {
    const n = toNumber(rest[0]) as number;
    return { party, lines: [], amountPaise: Math.round(n * 100) };
  }

  const segments: string[][] = [[]];
  for (const w of rest) {
    if (w.toLowerCase() === 'aur' || w.toLowerCase() === 'and') segments.push([]);
    else segments[segments.length - 1].push(w);
  }
  const lines: { qty: number; item: string }[] = [];
  for (const seg of segments) {
    if (seg.length === 0) continue;
    const q = toNumber(seg[0]);
    if (q === null) continue;
    const itemWords = seg.slice(1);
    while (itemWords.length && STOP.has(itemWords[itemWords.length - 1].toLowerCase())) itemWords.pop();
    if (itemWords.length === 0) continue;
    lines.push({ qty: q, item: itemWords.join(' ') });
  }
  return { party, lines, amountPaise: null };
}
