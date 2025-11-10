/**
 * Simple pluralization helper
 */
export function plural(n: number | null | undefined, word: string): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return `— ${word}`;
  }

  const count = Math.round(n);
  if (count === 1) {
    return `1 ${word}`;
  }
  return `${count} ${word}s`;
}






