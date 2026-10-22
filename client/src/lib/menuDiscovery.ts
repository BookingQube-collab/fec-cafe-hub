export const MENU_GROUPS = [
  { id: 'all', label: 'All', tone: 'violet' },
  { id: 'food', label: 'Food', tone: 'coral' },
  { id: 'snacks', label: 'Snacks', tone: 'gold' },
  { id: 'drinks', label: 'Drinks', tone: 'sky' },
  { id: 'sweets', label: 'Sweets', tone: 'berry' },
] as const;
export type MenuGroup = typeof MENU_GROUPS[number]['id'];

export function categoryGroup(title: string): Exclude<MenuGroup, 'all'> {
  if (/coffee|tea\b|matcha|karak|juice|mocktail|cocktail|slush|drink|beverage|smoothie|shake|lemonade|قهوة|شاي|مشروب|عصير/i.test(title)) return 'drinks';
  if (/dessert|sweet|ice.?cream|soft serve|cake|pastr|waffle|pancake|حلو|آيس/i.test(title)) return 'sweets';
  if (/snack|fries|nugget|popcorn|spiral|potato|corn|side|مقبل|بطاط|ذرة/i.test(title)) return 'snacks';
  return 'food';
}

export function randomIndex(length: number): number {
  return Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000 * length);
}

export function wheelShortlist<T>(items: readonly T[], limit = 8): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, limit);
}

// Sector zero starts at the top. Land its chosen sector's centre at the top pointer.
export function wheelLanding(current: number, index: number, count: number): number {
  const target = (360 - (index + .5) * (360 / count)) % 360;
  return current + 5 * 360 + (target - current % 360 + 360) % 360;
}
