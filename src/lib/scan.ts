// Tiny bridge so the scanner screen can hand a code back to whoever opened it.
let handler: ((code: string) => void) | null = null;
export const onScan = (fn: (code: string) => void) => { handler = fn; };
export const deliverScan = (code: string) => { handler?.(code); handler = null; };
