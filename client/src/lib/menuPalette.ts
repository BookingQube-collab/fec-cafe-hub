import type { CSSProperties } from 'react';
import { cafeThemeStyle } from './cafeTheme';

const accents: Record<string, [string, string, string]> = {
  e3: ['255 191 113', '255 135 119', '247 220 159'],
  forest: ['145 223 184', '249 190 156', '228 225 130'],
  terracotta: ['255 157 132', '250 207 125', '182 217 169'],
  ocean: ['133 208 243', '194 169 247', '255 198 151'],
  plum: ['197 164 246', '255 172 188', '255 211 144'],
};
export function liveCafeStyle(theme = 'e3'): CSSProperties {
  const [first, second, third] = accents[theme] || accents.e3;
  return { ...cafeThemeStyle(theme), '--scene-first': first, '--scene-second': second, '--scene-third': third } as CSSProperties;
}
export function menuTone(title: string) {
  const name = title.toLowerCase();
  if (/pizza|hot dog|burger|wrap/.test(name)) return 'coral';
  if (/corn|juice|fruit|popcorn/.test(name)) return 'gold';
  if (/matcha|salad|bowl/.test(name)) return 'mint';
  if (/cold|iced|mocktail|slush/.test(name)) return 'sky';
  if (/soft serve|ice cream|dessert/.test(name)) return 'berry';
  if (/coffee|tea|karak/.test(name)) return 'caramel';
  return 'violet';
}
export function categoryEmoji(title: string) {
  const name = title.toLowerCase();
  return /pizza/.test(name) ? '🍕' : /hot dog/.test(name) ? '🌭' : /combo|burger/.test(name) ? '🍔'
    : /popcorn/.test(name) ? '🍿' : /corn/.test(name) ? '🌽' : /potato|fries|nugget/.test(name) ? '🍟'
    : /soft serve|ice cream/.test(name) ? '🍦' : /matcha|tea|karak/.test(name) ? '🍵'
    : /juice|fruit/.test(name) ? '🍊' : /mocktail/.test(name) ? '🍹' : /slush/.test(name) ? '🧊'
    : /cold|iced/.test(name) ? '🧋' : /coffee/.test(name) ? '☕' : /bowl|salad/.test(name) ? '🥗' : '🍽️';
}
