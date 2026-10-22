import type { MenuModifierGroup } from '../shared/schema';

// Deliberately synthetic options for isolated tests, never seeded into a café's live menu.
export const modifierFixture: MenuModifierGroup[] = [
  { id: '11000000-0000-4000-8000-000000000001', title: 'Choose a sauce', titleAr: 'اختر الصلصة', selection: 'single', minSelections: 1, maxSelections: 1, options: [
    { id: '11000000-0000-4000-8000-000000000002', label: 'Garlic sauce', labelAr: 'صلصة الثوم', price: '0', isAvailable: true },
    { id: '11000000-0000-4000-8000-000000000003', label: 'Spicy sauce', labelAr: 'صلصة حارة', price: '0', isAvailable: true },
  ] },
  { id: '11000000-0000-4000-8000-000000000004', title: 'Add toppings', titleAr: 'إضافة مكونات', selection: 'multiple', minSelections: 0, maxSelections: 2, options: [
    { id: '11000000-0000-4000-8000-000000000005', label: 'Cheese', labelAr: 'جبن', price: '3', isAvailable: true },
    { id: '11000000-0000-4000-8000-000000000006', label: 'Lettuce', labelAr: 'خس', price: '0', isAvailable: true },
    { id: '11000000-0000-4000-8000-000000000007', label: 'Pickles', labelAr: 'مخلل', price: '1.50', isAvailable: true },
    { id: '11000000-0000-4000-8000-000000000008', label: 'Extra chicken', labelAr: 'دجاج إضافي', price: '5', isAvailable: false },
  ] },
];
