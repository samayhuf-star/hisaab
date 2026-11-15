// Indian digit grouping: 1,82,400
export function formatRupees(paise: number, withDecimals = false): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const frac = abs % 100;
  const s = String(rupees);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  const decimals = withDecimals || frac !== 0 ? '.' + String(frac).padStart(2, '0') : '';
  return (neg ? '-' : '') + '₹' + grouped + decimals;
}

// UPI deep link per NPCI spec. Amount in rupees with 2 decimals.
export function buildUpiLink(vpa: string, payeeName: string, amountPaise: number, note: string): string {
  const am = (amountPaise / 100).toFixed(2);
  const q = (v: string) => encodeURIComponent(v);
  return `upi://pay?pa=${q(vpa)}&pn=${q(payeeName)}&am=${am}&cu=INR&tn=${q(note)}`;
}
