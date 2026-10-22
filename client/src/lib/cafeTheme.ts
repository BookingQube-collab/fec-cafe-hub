import type { CSSProperties } from 'react';
export const cafeThemes = {
  e3: { label: 'E3 · Espresso & gold', primary: '38 65% 34%', background: '40 30% 96%', foreground: '24 25% 13%', card: '40 40% 99%' },
  forest: { label: 'Forest · Green & cream', primary: '155 45% 26%', background: '100 20% 96%', foreground: '150 25% 13%', card: '100 30% 99%' },
  terracotta: { label: 'Terracotta · Warm & earthy', primary: '16 58% 40%', background: '28 40% 96%', foreground: '15 30% 16%', card: '28 40% 99%' },
  ocean: { label: 'Ocean · Blue & white', primary: '205 70% 35%', background: '205 40% 97%', foreground: '210 35% 14%', card: '205 40% 99%' },
  plum: { label: 'Plum · Purple & blush', primary: '285 35% 35%', background: '300 25% 97%', foreground: '285 25% 15%', card: '300 25% 99%' },
};
export function cafeThemeStyle(theme = 'e3'): CSSProperties {
  const t = cafeThemes[theme as keyof typeof cafeThemes] || cafeThemes.e3;
  return { '--primary': t.primary, '--ring': t.primary, '--background': t.background, '--foreground': t.foreground, '--card': t.card, '--card-foreground': t.foreground, '--primary-foreground': '0 0% 100%', '--sidebar-primary': t.primary, '--sidebar-background': t.background } as CSSProperties;
}
export function cafeDate(timezone = 'Asia/Riyadh') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
