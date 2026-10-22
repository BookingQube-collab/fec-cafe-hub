import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MenuModifierGroup, MenuModifierOption } from '@shared/schema';

const newOption = (): MenuModifierOption => ({ id: crypto.randomUUID(), label: '', labelAr: '', price: '0', isAvailable: true });
export default function ModifierEditor({ groups, currency, onChange }: {
  groups: MenuModifierGroup[]; currency: string; onChange: (groups: MenuModifierGroup[]) => void;
}) {
  function changeGroup(id: string, values: Partial<MenuModifierGroup>) {
    onChange(groups.map(group => group.id === id ? { ...group, ...values } : group));
  }
  function changeOption(group: MenuModifierGroup, id: string, values: Partial<MenuModifierOption>) {
    changeGroup(group.id, { options: group.options.map(option => option.id === id ? { ...option, ...values } : option) });
  }
  function removeOption(group: MenuModifierGroup, id: string) {
    const options = group.options.filter(option => option.id !== id);
    changeGroup(group.id, { options, maxSelections: Math.min(group.maxSelections, options.length), minSelections: Math.min(group.minSelections, options.length) });
  }
  return <div className="manager-editor-box modifier-editor">
    <h3 className="font-semibold">Toppings &amp; custom choices</h3>
    <p className="text-xs text-muted-foreground mt-1">Offer sauces, fillings, toppings or extras. Extra prices are added to the selected item/size price; use 0 for included choices.</p>
    <div className="space-y-4 mt-4">{groups.map((group, index) => <section className="modifier-editor-group" key={group.id} aria-label={`Option group ${index + 1}`}>
      <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Group {index + 1}</h4><Button type="button" variant="ghost" size="icon" aria-label={`Remove option group ${index + 1}`} onClick={() => onChange(groups.filter(g => g.id !== group.id))}><Trash2 size={16}/></Button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label htmlFor={`group-title-${group.id}`}>Group name *</Label><Input id={`group-title-${group.id}`} required maxLength={80} placeholder="Add toppings / Choose a sauce" value={group.title} onChange={e => changeGroup(group.id, { title: e.target.value })}/></div>
        <div><Label htmlFor={`group-ar-${group.id}`}>Arabic group name</Label><Input id={`group-ar-${group.id}`} lang="ar" dir="rtl" maxLength={80} placeholder="إضافة مكونات" value={group.titleAr || ''} onChange={e => changeGroup(group.id, { titleAr: e.target.value })}/></div>
        <div><Label htmlFor={`group-selection-${group.id}`}>Selection type</Label><select className="manager-select w-full" id={`group-selection-${group.id}`} value={group.selection} onChange={e => changeGroup(group.id, { selection: e.target.value as 'single' | 'multiple', maxSelections: e.target.value === 'single' ? 1 : group.options.length, minSelections: Math.min(group.minSelections, 1) })}><option value="single">Choose one</option><option value="multiple">Choose several</option></select></div>
        {group.selection === 'single' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={group.minSelections > 0} onChange={e => changeGroup(group.id, { minSelections: e.target.checked ? 1 : 0 })}/>Required choice</label> : <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor={`group-min-${group.id}`}>Minimum choices</Label><Input id={`group-min-${group.id}`} type="number" min="0" max={group.maxSelections} required value={group.minSelections} onChange={e => changeGroup(group.id, { minSelections: Number(e.target.value) })}/><small className="text-muted-foreground">0 = optional</small></div>
          <div><Label htmlFor={`group-max-${group.id}`}>Maximum choices</Label><Input id={`group-max-${group.id}`} type="number" min={Math.max(1, group.minSelections)} max={group.options.length} required value={group.maxSelections} onChange={e => changeGroup(group.id, { maxSelections: Number(e.target.value) })}/></div>
        </div>}
      </div>
      <div className="space-y-3 mt-4">{group.options.map((option, optionIndex) => <div className="modifier-editor-option" key={option.id}>
        <div><Label htmlFor={`extra-label-${option.id}`}>Choice {optionIndex + 1} *</Label><Input id={`extra-label-${option.id}`} required maxLength={80} placeholder="Cheese / Lettuce / Garlic sauce" value={option.label} onChange={e => changeOption(group, option.id, { label: e.target.value })}/></div>
        <div><Label htmlFor={`extra-ar-${option.id}`}>Arabic choice</Label><Input id={`extra-ar-${option.id}`} lang="ar" dir="rtl" maxLength={80} value={option.labelAr || ''} onChange={e => changeOption(group, option.id, { labelAr: e.target.value })}/></div>
        <div><Label htmlFor={`extra-price-${option.id}`}>Extra price · {currency}</Label><Input id={`extra-price-${option.id}`} type="number" min="0" max="99999999.99" step="0.01" required value={option.price} onChange={e => changeOption(group, option.id, { price: e.target.value })}/></div>
        <label className="modifier-editor-availability"><input type="checkbox" checked={option.isAvailable} onChange={e => changeOption(group, option.id, { isAvailable: e.target.checked })}/><span>Available</span></label>
        <Button type="button" variant="ghost" size="icon" disabled={group.options.length === 1} aria-label={`Remove choice ${optionIndex + 1} from group ${index + 1}`} onClick={() => removeOption(group, option.id)}><Trash2 size={16}/></Button>
      </div>)}</div>
      <Button type="button" variant="outline" className="mt-3" disabled={group.options.length >= 20} onClick={() => changeGroup(group.id, { options: [...group.options, newOption()] })}><Plus size={15} className="mr-2"/>Add choice ({group.options.length}/20)</Button>
    </section>)}</div>
    <Button type="button" variant="outline" className="mt-4" disabled={groups.length >= 8} onClick={() => onChange([...groups, { id: crypto.randomUUID(), title: '', titleAr: '', selection: 'multiple', minSelections: 0, maxSelections: 1, options: [newOption()] }])}><Plus size={16} className="mr-2"/>Add option group ({groups.length}/8)</Button>
  </div>;
}
