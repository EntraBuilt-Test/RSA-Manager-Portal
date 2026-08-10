/**
 * Custom items added beyond the standard Particulars list (e.g. "+ Add Custom
 * Item") get real sequential numbers continuing from the highest standard
 * number, instead of a placeholder "+". "16a" counts as 16 for this purpose.
 */
export function highestParticularNumber(particulars) {
  return particulars.reduce((max, p) => {
    const digits = String(p.no || '').match(/^\d+/);
    const n = digits ? parseInt(digits[0], 10) : 0;
    return Math.max(max, n);
  }, 0);
}

export function nextCustomNumbers(particulars, count) {
  const start = highestParticularNumber(particulars) + 1;
  return Array.from({ length: count }, (_, i) => start + i);
}
