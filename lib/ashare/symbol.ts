export function normalizeSymbol(input: string): string;
export function normalizeSymbol(input: unknown): string;
export function normalizeSymbol(input: unknown): string {
  if (typeof input !== 'string') return 'GLOBAL';
  const raw = input.trim().toUpperCase();
  if (!raw) return 'GLOBAL';
  if (raw.includes(':')) return raw;
  if (/^\d{6}$/.test(raw)) {
    return raw.startsWith('6') ? `SSE:${raw}` : `SZSE:${raw}`;
  }
  if (/^(SH|SZ)\d{6}$/.test(raw)) {
    const code = raw.slice(2);
    return raw.startsWith('SH') ? `SSE:${code}` : `SZSE:${code}`;
  }
  return raw;
}
