// ─────────────────────────────────────────────────────
//  CSV utility
//  Produces RFC-4180-compliant CSV with a UTF-8 BOM so
//  Excel on Windows renders non-ASCII characters (Rs.
//  symbol, accented names) correctly.
// ─────────────────────────────────────────────────────

const UTF8_BOM = '\uFEFF';

export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
): string {
  const head = columns.map((c) => escapeCsv(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escapeCsv(r[c.key])).join(','))
    .join('\n');
  return UTF8_BOM + head + '\n' + body;
}

export function csvHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type':        'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  };
}
