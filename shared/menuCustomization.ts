import type { MenuModifierGroup, MenuModifierOption } from './schema';
export type MenuModifierSelections = Record<string, string[]>;

// Reconcile local choices with the latest menu so removed/sold-out extras never enter a total.
export function reconcileModifierSelections(groups: readonly MenuModifierGroup[], selected: MenuModifierSelections): MenuModifierSelections {
  return Object.fromEntries(groups.map(group => [group.id, Array.from(new Set(selected[group.id] || []))
    .filter(id => group.options.some(option => option.id === id && option.isAvailable)).slice(0, group.maxSelections)]));
}
export function selectedModifierOptions(groups: readonly MenuModifierGroup[], selected: MenuModifierSelections): MenuModifierOption[] {
  const valid = reconcileModifierSelections(groups, selected);
  return groups.flatMap(group => group.options.filter(option => valid[group.id].includes(option.id)));
}
export function missingModifierGroups(groups: readonly MenuModifierGroup[], selected: MenuModifierSelections): MenuModifierGroup[] {
  const valid = reconcileModifierSelections(groups, selected);
  return groups.filter(group => valid[group.id].length < group.minSelections);
}
export function customizationTotal(price: string, discount: string | null, options: readonly Pick<MenuModifierOption, 'price'>[]): string {
  const baseCents = Math.round(Math.round(Number(price) * 100) * (1 - Number(discount || 0) / 100));
  const extrasCents = options.reduce((sum, option) => sum + Math.round(Number(option.price) * 100), 0);
  return ((baseCents + extrasCents) / 100).toFixed(2);
}
