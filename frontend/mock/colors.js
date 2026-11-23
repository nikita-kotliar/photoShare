function toHsl(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

export function colorFamily(hex) {
  const { h, s, l } = toHsl(hex);
  if (l >= 0.92) return 'white';
  if (l <= 0.12) return 'black';
  if (s <= 0.15) return 'gray';
  if (h < 15 || h >= 345) return l < 0.35 ? 'brown' : 'red';
  if (h < 40) return l < 0.45 ? 'brown' : 'orange';
  if (h < 65) return l < 0.3 ? 'brown' : 'yellow';
  if (h < 160) return 'green';
  if (h < 195) return 'teal';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}
