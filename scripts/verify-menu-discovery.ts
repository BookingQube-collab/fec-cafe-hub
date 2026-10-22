import assert from 'node:assert/strict';
import fs from 'node:fs';
import { categoryGroup, wheelLanding, wheelShortlist } from '../client/src/lib/menuDiscovery';

const source = JSON.parse(fs.readFileSync('fixtures/urban-menu.json', 'utf8')) as { categories: { title: string; items: [string, number, unknown?][] }[] };
const totals: Record<string, number> = { food: 0, snacks: 0, drinks: 0, sweets: 0 };
for (const category of source.categories) totals[categoryGroup(category.title)] += category.items.length;
assert.deepEqual(totals, { food: 12, snacks: 12, drinks: 44, sweets: 2 });
assert.equal(categoryGroup('عصير'), 'drinks');
assert.equal(categoryGroup('Chef’s new plates'), 'food');

for (let count = 1; count <= 8; count++) {
  let angle = 0;
  for (let round = 0; round < 3; round++) for (let winner = 0; winner < count; winner++) {
    const next = wheelLanding(angle, winner, count);
    assert.ok(next - angle >= 1800, 'Wheel turns forward at least five times');
    const centreAtPointer = ((winner + .5) * 360 / count + next) % 360;
    assert.ok(Math.min(centreAtPointer, 360 - centreAtPointer) < 0.00001, 'Pointer lands on the winning sector');
    angle = next;
  }
}
assert.deepEqual(wheelShortlist([]), []);
assert.deepEqual(wheelShortlist(['only choice']), ['only choice']);

const eligible = source.categories.flatMap((category, categoryIndex) => category.items.map(([name], itemIndex) => ({ id: `${categoryIndex}:${itemIndex}`, name })));
assert.equal(eligible.length, 70);
for (let run = 0; run < 20; run++) {
  const slots = wheelShortlist(eligible, 6) as { id: string }[];
  assert.equal(slots.length, 6);
  assert.equal(new Set(slots.map(item => item.id)).size, 6);
  assert.ok(slots.every(slot => eligible.some((item: { id: string }) => item.id === slot.id)));
}
console.log('PASS: 70 menu fixtures grouped as Food 12 / Snacks 12 / Drinks 44 / Sweets 2; wheel geometry, unique shortlists, empty and single-item pools without a running server.');
