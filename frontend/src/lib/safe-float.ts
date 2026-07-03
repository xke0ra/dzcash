export function safeFloat(val: string | number | null | undefined, fallback = 0): number {
  const n = typeof val === 'number' ? val : parseFloat(val || '');
  return isNaN(n) ? fallback : n;
}
