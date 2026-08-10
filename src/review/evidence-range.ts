/**
 * Resolves scanner evidence to one exact location.  New scans emit both a
 * one-based line and column; legacy line-only evidence is intentionally
 * review-only because it cannot bind a repair to a unique byte range.
 */
export function exactEvidenceStart(
  content: string,
  locator: string,
  excerpt: string
): number | null {
  const match = /^line:(\d+):column:(\d+)$/.exec(locator);
  if (!match || !excerpt) return null;
  const line = Number(match[1]);
  const column = Number(match[2]);
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line < 1 || column < 1)
    return null;

  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const newline = content.indexOf("\n", offset);
    if (newline < 0) return null;
    offset = newline + 1;
  }
  const start = offset + column - 1;
  return content.slice(start, start + excerpt.length) === excerpt ? start : null;
}
