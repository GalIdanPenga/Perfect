export function darkenHexColor(hex: string, amount: number): string {
  // Accept #rrggbb and #rgb shorthand; fall back to 0 for any malformed channel
  // so a bad color never yields "rgb(NaN, ...)".
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const r = Math.max(0, (parseInt(h.slice(0, 2), 16) || 0) - amount);
  const g = Math.max(0, (parseInt(h.slice(2, 4), 16) || 0) - amount);
  const b = Math.max(0, (parseInt(h.slice(4, 6), 16) || 0) - amount);
  return `rgb(${r}, ${g}, ${b})`;
}
