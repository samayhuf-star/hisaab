import * as SQLite from 'expo-sqlite';
import { computeTotals, isInterState, Line } from './lib/gst';

let dbp: Promise<SQLite.SQLiteDatabase> | null = null;
const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const notify = () => listeners.forEach((f) => f());

// ---- businesses (firms): one database file each, plus a small shared meta database ----
export type Firm = { id: number; name: string; file: string };
let metap: Promise<SQLite.SQLiteDatabase> | null = null;
export function getMeta() {
  if (!metap) metap = (async () => {
    const m = await SQLite.openDatabaseAsync('hisaab-meta.db');
    await m.execAsync(`
      CREATE TABLE IF NOT EXISTS firms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, file TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bill_counts (ym TEXT PRIMARY KEY, n INTEGER NOT NULL);
    `);
    const c = await m.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM firms');
    if (!c || c.n === 0) {
      // the first business keeps the original file, so existing data is untouched
      await m.runAsync("INSERT INTO firms(name,file) VALUES('My business','hisaab.db')");
      await m.runAsync("INSERT OR REPLACE INTO kv(key,value) VALUES('active_firm','1')");
    }
    return m;
  })();
  return metap;
}
export async function listFirms(): Promise<Firm[]> {
  const m = await getMeta();
  return m.getAllAsync<Firm>('SELECT * FROM firms ORDER BY id');
}
export async function activeFirm(): Promise<Firm> {
  const m = await getMeta();
  const k = await m.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key='active_firm'");
  const f = await m.getFirstAsync<Firm>('SELECT * FROM firms WHERE id = ?', Number(k?.value || 1));
  return f || (await m.getFirstAsync<Firm>('SELECT * FROM firms ORDER BY id LIMIT 1'))!;
}
export async function addFirm(name: string): Promise<number> {
  const m = await getMeta();
  const r = await m.runAsync("INSERT INTO firms(name,file) VALUES(?, 'pending')", name.trim() || 'New business');
  await m.runAsync('UPDATE firms SET file = ? WHERE id = ?', `hisaab-${r.lastInsertRowId}.db`, r.lastInsertRowId);
  return r.lastInsertRowId;
}
export async function switchFirm(id: number) {
  const m = await getMeta();
  await m.runAsync("INSERT OR REPLACE INTO kv(key,value) VALUES('active_firm', ?)", String(id));
  dbp = null; // next getDb() opens the other file
  notify();
}
export async function renameFirm(id: number, name: string) {
  const m = await getMeta();
  await m.runAsync('UPDATE firms SET name = ? WHERE id = ?', name.trim(), id);
  notify();
}

export function getDb() {
  if (!dbp) dbp = init();
  return dbp;
}

async function init() {
  const firm = await activeFirm();
  return openFirmDb(firm.file);
}

async function openFirmDb(file: string) {
  const db = await SQLite.openDatabaseAsync(file);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'customer',
      gstin TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', state_code TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, hsn TEXT NOT NULL DEFAULT '',
      rate_paise INTEGER NOT NULL DEFAULT 0, gst_percent REAL NOT NULL DEFAULT 18,
      unit TEXT NOT NULL DEFAULT 'pcs', stock REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'sale',
      party_id INTEGER NOT NULL, date TEXT NOT NULL,
      subtotal_paise INTEGER NOT NULL, cgst_paise INTEGER NOT NULL, sgst_paise INTEGER NOT NULL,
      igst_paise INTEGER NOT NULL, round_off_paise INTEGER NOT NULL, total_paise INTEGER NOT NULL,
      paid_paise INTEGER NOT NULL DEFAULT 0, due_date TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, item_id INTEGER,
      name TEXT NOT NULL, hsn TEXT NOT NULL DEFAULT '', qty REAL NOT NULL, rate_paise INTEGER NOT NULL,
      gst_percent REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, party_id INTEGER NOT NULL, invoice_id INTEGER,
      amount_paise INTEGER NOT NULL, date TEXT NOT NULL, direction TEXT NOT NULL DEFAULT 'in'
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, label TEXT NOT NULL, json TEXT NOT NULL
    );
  `);
  try { await db.execAsync("ALTER TABLE items ADD COLUMN barcode TEXT NOT NULL DEFAULT ''"); } catch { /* already added */ }
  try { await db.execAsync("ALTER TABLE parties ADD COLUMN email TEXT NOT NULL DEFAULT ''"); } catch { /* already added */ }
  try { await db.execAsync('ALTER TABLE parties ADD COLUMN gst_registered INTEGER NOT NULL DEFAULT 0'); } catch { /* already added */ }
  try { await db.execAsync('ALTER TABLE parties ADD COLUMN gst_percent INTEGER NOT NULL DEFAULT 18'); } catch { /* already added */ }
  // Parties saved before these columns existed: treat a saved GSTIN as "has GST".
  try { await db.execAsync("UPDATE parties SET gst_registered = 1 WHERE gstin <> '' AND gst_registered = 0"); } catch { /* ignore */ }
  return db;
}

export type Party = {
  id: number; name: string; kind: string; gstin: string; phone: string; state_code: string;
  email?: string; gst_registered?: number; gst_percent?: number;
};
export type Item = { id: number; name: string; hsn: string; rate_paise: number; gst_percent: number; unit: string; stock: number; barcode?: string };
export type Invoice = {
  id: number; no: string; kind: string; party_id: number; date: string; due_date: string;
  subtotal_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number;
  round_off_paise: number; total_paise: number; paid_paise: number; party_name?: string;
};
export type InvLine = { id: number; invoice_id: number; item_id: number | null; name: string; hsn: string; qty: number; rate_paise: number; gst_percent: number };

// Local calendar date (India users bill after midnight; UTC dates would put those bills on the wrong day).
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => isoDate(new Date());

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r ? r.value : fallback;
}
export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
  notify();
}

export async function listParties(kind?: string): Promise<Party[]> {
  const db = await getDb();
  return kind
    ? db.getAllAsync<Party>('SELECT * FROM parties WHERE kind = ? ORDER BY name', kind)
    : db.getAllAsync<Party>('SELECT * FROM parties ORDER BY name');
}
export async function saveParty(p: Omit<Party, 'id'> & { id?: number }): Promise<number> {
  const db = await getDb();
  if (p.id) {
    await db.runAsync('UPDATE parties SET name=?, kind=?, gstin=?, phone=?, state_code=?, email=?, gst_registered=?, gst_percent=? WHERE id=?', p.name, p.kind, p.gstin, p.phone, p.state_code, p.email ?? '', p.gst_registered ?? 0, p.gst_percent ?? 18, p.id);
    notify();
    return p.id;
  }
  const r = await db.runAsync('INSERT INTO parties(name,kind,gstin,phone,state_code,email,gst_registered,gst_percent) VALUES(?,?,?,?,?,?,?,?)', p.name, p.kind, p.gstin, p.phone, p.state_code, p.email ?? '', p.gst_registered ?? 0, p.gst_percent ?? 18);
  notify();
  return r.lastInsertRowId;
}
export async function findPartyExact(name: string): Promise<Party | null> {
  const db = await getDb();
  const all = await db.getAllAsync<Party>('SELECT * FROM parties');
  const n = name.trim().toLowerCase();
  return all.find((p) => p.name.trim().toLowerCase() === n) || null;
}
export async function findPartyByName(name: string): Promise<Party | null> {
  const db = await getDb();
  const base = name.toLowerCase().replace(/\bji\b/g, '').trim();
  if (!base) return null;
  const all = await db.getAllAsync<Party>('SELECT * FROM parties');
  return all.find((p) => p.name.toLowerCase().includes(base)) || null;
}

export async function listItems(): Promise<Item[]> {
  const db = await getDb();
  return db.getAllAsync<Item>('SELECT * FROM items ORDER BY name');
}
export async function saveItem(i: Omit<Item, 'id'> & { id?: number }): Promise<number> {
  const db = await getDb();
  if (i.id) {
    await db.runAsync('UPDATE items SET name=?, hsn=?, rate_paise=?, gst_percent=?, unit=?, stock=?, barcode=? WHERE id=?', i.name, i.hsn, i.rate_paise, i.gst_percent, i.unit, i.stock, i.barcode || '', i.id);
    notify();
    return i.id;
  }
  const r = await db.runAsync('INSERT INTO items(name,hsn,rate_paise,gst_percent,unit,stock,barcode) VALUES(?,?,?,?,?,?,?)', i.name, i.hsn, i.rate_paise, i.gst_percent, i.unit, i.stock, i.barcode || '');
  notify();
  return r.lastInsertRowId;
}
export async function findItemByBarcode(code: string): Promise<Item | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Item>("SELECT * FROM items WHERE barcode = ? AND barcode <> ''", code)) || null;
}
export async function findItemByName(name: string): Promise<Item | null> {
  const db = await getDb();
  const n = name.toLowerCase();
  const all = await db.getAllAsync<Item>('SELECT * FROM items');
  return all.find((i) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase())) || null;
}

// Invoice numbers must never repeat, even after a snapshot restore or import removes later invoices.
// So the highest number ever issued is kept in the shared meta database (snapshots never touch it).
export async function nextInvoiceNo(kind: string): Promise<string> {
  const db = await getDb();
  const m = await getMeta();
  const firm = await activeFirm();
  const prefix = kind === 'sale' ? 'INV' : 'PUR';
  const key = `inv_hw_${firm.id}_${kind}`;
  const r = await db.getFirstAsync<{ n: number | null }>('SELECT MAX(CAST(SUBSTR(no, 5) AS INTEGER)) AS n FROM invoices WHERE kind = ?', kind);
  const k = await m.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  const highest = Math.max(1000, r?.n || 0, Number(k?.value) || 0);
  const next = highest + 1;
  await m.runAsync('INSERT OR REPLACE INTO kv(key,value) VALUES(?,?)', key, String(next));
  return `${prefix}-${next}`;
}

async function bestEffort(fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { console.warn('Follow-up step failed after save', e); }
}

export type NewLine = { itemId: number | null; name: string; hsn: string; qty: number; ratePaise: number; gstPercent: number };

export async function createInvoice(args: { partyId: number; kind?: string; lines: NewLine[]; dueDays?: number }): Promise<number> {
  const db = await getDb();
  const kind = args.kind || 'sale';
  const party = await db.getFirstAsync<Party>('SELECT * FROM parties WHERE id = ?', args.partyId);
  if (!party) throw new Error('Party not found');
  if (args.lines.length === 0) throw new Error('Add at least one item');
  const sellerState = await getSetting('state_code');
  const lines: Line[] = args.lines.map((l) => ({ qty: l.qty, ratePaise: l.ratePaise, gstPercent: l.gstPercent }));
  const t = computeTotals(lines, isInterState(sellerState, party.state_code));
  const no = await nextInvoiceNo(kind);
  const d = new Date();
  const due = isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (args.dueDays ?? 15)));
  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      'INSERT INTO invoices(no,kind,party_id,date,subtotal_paise,cgst_paise,sgst_paise,igst_paise,round_off_paise,total_paise,due_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      no, kind, args.partyId, today(), t.subtotalPaise, t.cgstPaise, t.sgstPaise, t.igstPaise, t.roundOffPaise, t.totalPaise, due,
    );
    id = r.lastInsertRowId;
    for (const l of args.lines) {
      await db.runAsync('INSERT INTO invoice_lines(invoice_id,item_id,name,hsn,qty,rate_paise,gst_percent) VALUES(?,?,?,?,?,?,?)', id, l.itemId, l.name, l.hsn, l.qty, l.ratePaise, l.gstPercent);
      if (l.itemId && kind === 'sale') await db.runAsync('UPDATE items SET stock = stock - ? WHERE id = ?', l.qty, l.itemId);
      if (l.itemId && kind === 'purchase') await db.runAsync('UPDATE items SET stock = stock + ? WHERE id = ?', l.qty, l.itemId);
    }
  });
  // The bill is already saved. These follow-ups must never make the save look failed (a retry would duplicate it).
  await bestEffort(() => countBill());
  await bestEffort(() => takeSnapshot(`Bill ${no} added`));
  notify();
  return id;
}

export async function getInvoice(id: number): Promise<{ inv: Invoice; lines: InvLine[]; party: Party } | null> {
  const db = await getDb();
  const inv = await db.getFirstAsync<Invoice>('SELECT * FROM invoices WHERE id = ?', id);
  if (!inv) return null;
  const lines = await db.getAllAsync<InvLine>('SELECT * FROM invoice_lines WHERE invoice_id = ?', id);
  const party = await db.getFirstAsync<Party>('SELECT * FROM parties WHERE id = ?', inv.party_id);
  return party ? { inv, lines, party } : null;
}

export async function recordPayment(args: { partyId: number; amountPaise: number; invoiceId?: number; direction?: 'in' | 'out' }) {
  if (!(args.amountPaise > 0)) throw new Error('Amount must be more than zero');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO payments(party_id,invoice_id,amount_paise,date,direction) VALUES(?,?,?,?,?)', args.partyId, args.invoiceId ?? null, args.amountPaise, today(), args.direction || 'in');
    // allocate to oldest open invoices of that party (or the named invoice first)
    let left = args.amountPaise;
    const kind = (args.direction || 'in') === 'in' ? 'sale' : 'purchase';
    const open = await db.getAllAsync<Invoice>(
      'SELECT * FROM invoices WHERE party_id = ? AND kind = ? AND paid_paise < total_paise ORDER BY (id = ?) DESC, date, id',
      args.partyId, kind, args.invoiceId ?? -1,
    );
    for (const inv of open) {
      if (left <= 0) break;
      const need = inv.total_paise - inv.paid_paise;
      const pay = Math.min(need, left);
      await db.runAsync('UPDATE invoices SET paid_paise = paid_paise + ? WHERE id = ?', pay, inv.id);
      left -= pay;
    }
  });
  await bestEffort(() => takeSnapshot(`Payment ${(args.direction || 'in') === 'in' ? 'received' : 'made'}`));
  notify();
}

export type PartyDue = { party: Party; duePaise: number; oldestDueDate: string };
export async function listDues(kind: 'sale' | 'purchase'): Promise<PartyDue[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ party_id: number; due: number; oldest: string }>(
    'SELECT party_id, SUM(total_paise - paid_paise) AS due, MIN(due_date) AS oldest FROM invoices WHERE kind = ? AND paid_paise < total_paise GROUP BY party_id ORDER BY due DESC',
    kind,
  );
  const out: PartyDue[] = [];
  for (const r of rows) {
    const p = await db.getFirstAsync<Party>('SELECT * FROM parties WHERE id = ?', r.party_id);
    if (p) out.push({ party: p, duePaise: r.due, oldestDueDate: r.oldest });
  }
  return out;
}

export async function recentInvoices(limit = 5): Promise<Invoice[]> {
  const db = await getDb();
  return db.getAllAsync<Invoice>(
    'SELECT invoices.*, parties.name AS party_name FROM invoices JOIN parties ON parties.id = invoices.party_id ORDER BY invoices.id DESC LIMIT ?', limit,
  );
}

export async function dashboard() {
  const db = await getDb();
  const t = today();
  const s = await db.getFirstAsync<{ total: number | null; n: number; paid: number }>(
    "SELECT SUM(total_paise) AS total, COUNT(*) AS n, SUM(CASE WHEN paid_paise >= total_paise THEN 1 ELSE 0 END) AS paid FROM invoices WHERE kind='sale' AND date = ?", t);
  const rec = await listDues('sale');
  const pay = await listDues('purchase');
  return {
    todayPaise: s?.total || 0, todayCount: s?.n || 0, todayPaid: s?.paid || 0,
    receivePaise: rec.reduce((a, b) => a + b.duePaise, 0), receiveParties: rec.length,
    payPaise: pay.reduce((a, b) => a + b.duePaise, 0), payParties: pay.length,
  };
}

export async function weeklySales(): Promise<{ label: string; paise: number }[]> {
  const db = await getDb();
  const out: { label: string; paise: number }[] = [];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - i);
    const iso = isoDate(d);
    const r = await db.getFirstAsync<{ t: number | null }>("SELECT SUM(total_paise) AS t FROM invoices WHERE kind='sale' AND date = ?", iso);
    out.push({ label: names[d.getDay()], paise: r?.t || 0 });
  }
  return out;
}

export async function monthTotals() {
  const db = await getDb();
  const ym = today().slice(0, 7) + '%';
  const r = await db.getFirstAsync<{ g: number | null; e: number | null; s: number | null }>(
    "SELECT SUM(CASE WHEN kind='sale' THEN cgst_paise+sgst_paise+igst_paise ELSE 0 END) AS g, SUM(CASE WHEN kind='purchase' THEN total_paise ELSE 0 END) AS e, SUM(CASE WHEN kind='sale' THEN total_paise ELSE 0 END) AS s FROM invoices WHERE date LIKE ?", ym);
  return { gstPaise: r?.g || 0, purchasesPaise: r?.e || 0, salesPaise: r?.s || 0 };
}

// ---- local history (snapshots) ----
const TABLES = ['settings', 'parties', 'items', 'invoices', 'invoice_lines', 'payments'];
export async function exportAll(): Promise<Record<string, unknown[]>> {
  const db = await getDb();
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  return out;
}
// Full backup: every business, in one file. Format version 2.
export type Backup = { app: 'hisaab'; version: 2; exportedAt: string; firms: { name: string; data: Record<string, Record<string, unknown>[]> }[] };
export async function exportEverything(): Promise<Backup> {
  const active = await activeFirm();
  const firms: Backup['firms'] = [];
  for (const f of await listFirms()) {
    const data: Record<string, Record<string, unknown>[]> = {};
    if (f.id === active.id) {
      Object.assign(data, await exportAll());
    } else {
      const fdb = await openFirmDb(f.file);
      try { for (const t of TABLES) data[t] = await fdb.getAllAsync(`SELECT * FROM ${t}`); } finally { await fdb.closeAsync(); }
    }
    firms.push({ name: f.name, data: data as Record<string, Record<string, unknown>[]> });
  }
  return { app: 'hisaab', version: 2, exportedAt: new Date().toISOString(), firms };
}

async function tableCols(db: SQLite.SQLiteDatabase, t: string) {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
  return new Set(info.map((c) => c.name));
}

// Turns an exported file back into data. Accepts the new all-businesses file and the older single-business file.
export function parseBackup(json: string): Backup {
  let raw: any;
  try { raw = JSON.parse(json); } catch { throw new Error('This file is not a Hisaab backup.'); }
  if (raw && raw.app === 'hisaab' && Array.isArray(raw.firms)) {
    if (raw.firms.length === 0) throw new Error('This backup has no businesses.');
    return raw as Backup;
  }
  if (raw && typeof raw === 'object' && Array.isArray(raw.invoices) && Array.isArray(raw.parties)) {
    return { app: 'hisaab', version: 2, exportedAt: '', firms: [{ name: 'Imported business', data: raw }] };
  }
  throw new Error('This file is not a Hisaab backup.');
}

// Imports as NEW businesses, so nothing existing is overwritten or lost.
export async function importBackup(b: Backup): Promise<number> {
  const m = await getMeta();
  let added = 0;
  for (const f of b.firms) {
    const name = `${String(f.name || 'Imported business')} (restored)`;
    const id = await addFirm(name);
    const firm = (await m.getFirstAsync<Firm>('SELECT * FROM firms WHERE id = ?', id))!;
    const fdb = await openFirmDb(firm.file);
    try {
      await fdb.withTransactionAsync(async () => {
        for (const t of TABLES) {
          const cols = await tableCols(fdb, t);
          for (const r of (f.data?.[t] || []) as Record<string, unknown>[]) {
            const keys = Object.keys(r).filter((k) => cols.has(k));
            if (keys.length === 0) continue;
            await fdb.runAsync(`INSERT INTO ${t}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...(keys.map((k) => r[k]) as SQLite.SQLiteBindValue[]));
          }
        }
      });
      // never reuse an invoice number that the backup already contains
      for (const kind of ['sale', 'purchase']) {
        const r = await fdb.getFirstAsync<{ n: number | null }>('SELECT MAX(CAST(SUBSTR(no, 5) AS INTEGER)) AS n FROM invoices WHERE kind = ?', kind);
        if (r?.n) await m.runAsync('INSERT OR REPLACE INTO kv(key,value) VALUES(?,?)', `inv_hw_${id}_${kind}`, String(r.n));
      }
    } finally { await fdb.closeAsync(); }
    added++;
  }
  notify();
  return added;
}

export async function takeSnapshot(label: string) {
  const db = await getDb();
  const json = JSON.stringify(await exportAll());
  await db.runAsync('INSERT INTO snapshots(at,label,json) VALUES(?,?,?)', new Date().toISOString(), label, json);
  await db.runAsync('DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 30)');
}
export async function listSnapshots(): Promise<{ id: number; at: string; label: string }[]> {
  const db = await getDb();
  return db.getAllAsync('SELECT id, at, label FROM snapshots ORDER BY id DESC');
}
export async function restoreSnapshot(id: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM snapshots WHERE id = ?', id);
  if (!row) throw new Error('Snapshot not found');
  await takeSnapshot('Before restore');
  const data = JSON.parse(row.json) as Record<string, Record<string, unknown>[]>;
  await db.withTransactionAsync(async () => {
    for (const t of TABLES) {
      await db.runAsync(`DELETE FROM ${t}`);
      for (const r of data[t] || []) {
        const cols = Object.keys(r);
        await db.runAsync(`INSERT INTO ${t}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`, ...(cols.map((c) => r[c]) as SQLite.SQLiteBindValue[]));
      }
    }
  });
  notify();
}

/** Permanently erases every record and saved version of the active business on this phone. */
export async function deleteActiveBusinessData() {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of TABLES) await db.runAsync(`DELETE FROM ${t}`);
    await db.runAsync('DELETE FROM snapshots');
  });
  notify();
}

// Free plan counts bills across ALL businesses together, kept in the shared meta database.
export async function billsThisMonth(): Promise<number> {
  const m = await getMeta();
  const r = await m.getFirstAsync<{ n: number }>('SELECT n FROM bill_counts WHERE ym = ?', today().slice(0, 7));
  return r?.n || 0;
}
export async function countBill() {
  const m = await getMeta();
  await m.runAsync('INSERT INTO bill_counts(ym,n) VALUES(?,1) ON CONFLICT(ym) DO UPDATE SET n = n + 1', today().slice(0, 7));
}

export async function isOnboarded(): Promise<boolean> {
  const m = await getMeta();
  const r = await m.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key='onboarded'");
  return r?.value === '1';
}
export async function finishOnboarding() {
  const m = await getMeta();
  await m.runAsync("INSERT OR REPLACE INTO kv(key,value) VALUES('onboarded','1')");
}
