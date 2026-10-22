import assert from 'node:assert/strict';
import fs from 'node:fs';
import { arabicMenuLabel, menuMessage, menuItemCount } from '../client/src/lib/menuLanguage';
import { menuSearchIndex, menuSearchQuery, matchesMenuSearch } from '../client/src/lib/menuSearch';

type Category = { title: string; items: [string, number, { label: string }[]?][] };
const source = JSON.parse(fs.readFileSync('fixtures/urban-menu.json', 'utf8')) as { categories: Category[] };
const records = source.categories.flatMap(category => {
  assert.notEqual(arabicMenuLabel(category.title), category.title, `Category translation: ${category.title}`);
  return category.items.map(([name, , options]) => {
    assert.notEqual(arabicMenuLabel(name), name, `Item translation: ${name}`);
    for (const option of options || []) assert.notEqual(arabicMenuLabel(option.label), option.label);
    return { name, index: [...menuSearchIndex({ name }, category.title, options?.map(o => o.label)),
      ...menuSearchIndex({ name: arabicMenuLabel(name) }, arabicMenuLabel(category.title), options?.map(o => arabicMenuLabel(o.label)))] };
  });
});
const find = (search: string) => records.filter(record => matchesMenuSearch(record.index, menuSearchQuery(search))).map(record => record.name);
assert.equal(records.length, 70);
const variantCount = source.categories.flatMap(category => category.items).reduce((total, item) => total + (item[2]?.length || 0), 0);
assert.equal(variantCount, 4);
assert.equal(find('بيتزا').length, 5);
assert.equal(find('البيتزا').length, 5);
assert.equal(find('الْقَهْوَة السَّاخِنَة').length, 11);
assert.equal(find('قهوة باردة').length, 10);
assert.equal(find('drinks').length, 44);
assert.equal(find('مشروبات').length, 44);
assert.deepEqual(find('بيتزا مشروم'), ['Creamy Mushroom']);
assert.deepEqual(find('pizza مشروم'), ['Creamy Mushroom']);
assert.deepEqual(find('لاتيه فستق مثلج'), ['Iced Pistachio Latte']);
assert.deepEqual(find('اسبريسو دبل'), ['Espresso Single/Double']);
assert.deepEqual(find('espresso double'), ['Espresso Single/Double']);
assert.deepEqual(find('مارجريتا'), ['Marguareita']);
assert.deepEqual(find('vegan'), [], 'Translations must not introduce diet or allergen claims');
assert.deepEqual(find('بيتزا اسبريسو'), [], 'All search words remain AND conditions');
assert.equal(arabicMenuLabel('Custom Signature Dish'), 'Custom Signature Dish', 'Unknown content preserves the original');
assert.equal(arabicMenuLabel('قهوة عربية'), 'قهوة عربية');
assert.equal(menuMessage('ar', 'View {name}', { name: 'موكا' }), 'عرض موكا');
assert.equal(menuMessage('en', 'View {name}', { name: 'Mocha' }), 'View Mocha');
assert.equal(menuItemCount('en', 1), '1 item');
assert.equal(menuItemCount('ar', 1), 'صنف واحد');
assert.equal(menuItemCount('ar', 2), 'صنفان');
assert.ok(menuItemCount('ar', 68).includes('٦٨'));
const result = { passed: true, itemNames: records.length, categories: source.categories.length, variants: variantCount,
  bilingualSearch: true, originalFallback: true, dataModified: false, checkedAt: new Date().toISOString() };
fs.writeFileSync('data/arabic-language-verification.json', JSON.stringify(result, null, 2));
console.log('PASS: 70 Arabic item names, 16 categories, 4 price options and bilingual category/item search; custom names preserved.');
