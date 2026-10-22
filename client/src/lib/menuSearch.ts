import { categoryGroup } from './menuDiscovery';

// Equivalents for discovery only; never infer ingredients, allergens, or diet tags.
const equivalents = [
  ['drinks', 'drink', 'beverage', 'beverages', 'refreshment', 'refreshments', 'مشروب', 'مشروبات'],
  ['snacks', 'snack', 'bites', 'side', 'sides', 'مقبلات'],
  ['sweets', 'sweet', 'dessert', 'desserts', 'حلوى', 'حلويات'],
  ['food', 'foods', 'meal', 'meals', 'طعام', 'وجبات'],
  ['coffee', 'coffees', 'قهوة', 'قهوه', 'كوفي'],
  ['tea', 'teas', 'شاي'],
  ['juice', 'juices', 'عصير', 'عصائر'],
  ['cold', 'iced', 'chilled', 'بارد', 'باردة'],
  ['hot', 'warm', 'ساخن', 'ساخنة'],
  ['fries', 'fry', 'chips'],
  ['potato', 'potatoes', 'بطاطس', 'بطاطا'],
  ['softserve', 'icecream'],
  ['hotdog', 'hotdogs'],
  ['combo', 'combos', 'bundle', 'bundles'],
  ['mocktail', 'mocktails'],
  ['slush', 'slushes', 'slushie', 'slushies'],
  ['cheese', 'cheesy', 'chessy', 'جبن', 'جبنة', 'جبنه'],
  ['margherita', 'margarita', 'marguareita', 'مارغريتا', 'مارجريتا'],
  ['pizza', 'pizzas', 'بيتزا', 'بيزا'],
];

const marks = new RegExp('\\p{M}', 'gu');
const separators = new RegExp('[^\\p{L}\\p{N}]+', 'gu');
function normalize(text: string): string {
  return text.normalize('NFKD').replace(marks, '').toLowerCase()
    .replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(separators, ' ').trim();
}
const canonical = new Map(equivalents.flatMap(words => words.map(word => [normalize(word), words[0]] as const)));

function tokens(text: string): string[] {
  const phraseText = normalize(text)
    .replace(/\b(?:ice cream|soft serve)\b/g, 'softserve')
    .replace(/\bhot dogs?\b/g, 'hotdog')
    .replace(/\bfrench fries\b/g, 'fries');
  return Array.from(new Set(phraseText.split(' ').filter(Boolean).map(word => {
    // Ignore the Arabic definite article for discovery: البيتزا and بيتزا match.
    const plain = /^ال[\u0621-\u064a]{2,}$/.test(word) ? word.slice(2) : word;
    return canonical.get(plain) || plain;
  })));
}

export function menuSearchQuery(search: string): readonly string[] { return tokens(search); }

export function menuSearchIndex(
  item: { name: string; description?: string | null; tags?: readonly string[] | null },
  category: string,
  optionLabels: readonly string[] = [],
): readonly string[] {
  // Tokenize fields separately so phrases cannot accidentally bridge field boundaries.
  return Array.from(new Set([item.name, item.description || '', category, categoryGroup(category), ...(item.tags || []), ...optionLabels].flatMap(tokens)));
}

// Bounded spelling tolerance, including adjacent transpositions such as "frise".
function closeSpelling(query: string, candidate: string): boolean {
  if (!/^[a-z]{4,}$/.test(query) || !/^[a-z]{4,}$/.test(candidate)) return false;
  const limit = Math.min(query.length, candidate.length) >= 8 ? 2 : 1;
  if (Math.abs(query.length - candidate.length) > limit) return false;
  let beforePrevious: number[] = [];
  let previous = Array.from({ length: candidate.length + 1 }, (_, i) => i);
  for (let i = 1; i <= query.length; i++) {
    const row = [i];
    for (let j = 1; j <= candidate.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(query[i - 1] !== candidate[j - 1]));
      if (i > 1 && j > 1 && query[i - 1] === candidate[j - 2] && query[i - 2] === candidate[j - 1]) row[j] = Math.min(row[j], beforePrevious[j - 2] + 1);
    }
    beforePrevious = previous; previous = row;
  }
  return previous[candidate.length] <= limit;
}

export function matchesMenuSearch(index: readonly string[], query: readonly string[]): boolean {
  // Every query word must match somewhere, in any order. Structured filters remain AND conditions.
  return query.every(word => index.some(candidate => candidate === word || candidate.startsWith(word)
    || (word.length >= 4 && candidate.includes(word))) || index.some(candidate => closeSpelling(word, candidate)));
}
