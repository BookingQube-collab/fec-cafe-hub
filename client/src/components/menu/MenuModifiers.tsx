import type { Dispatch, SetStateAction } from 'react';
import { Layers3 } from 'lucide-react';
import { useMenuLanguage } from '@/lib/menuLanguage';
import { reconcileModifierSelections, type MenuModifierSelections } from '@shared/menuCustomization';
import type { MenuItem } from '@shared/schema';
import './menu-modifiers.css';

export default function MenuModifiers({ item, currency, selected, setSelected }: {
  item: MenuItem; currency: string; selected: MenuModifierSelections; setSelected: Dispatch<SetStateAction<MenuModifierSelections>>;
}) {
  const { language, t, label } = useMenuLanguage();
  const groups = item.modifierGroups;
  const valid = reconcileModifierSelections(groups, selected);
  const text = (english: string, arabic?: string) => language === 'ar' && arabic?.trim() ? arabic : label(english);
  const currencyLabel = language === 'ar' ? ({ QAR: 'ر.ق', SAR: 'ر.س', AED: 'د.إ' }[currency] || currency) : currency;
  const amount = (value: string, extra = false) => <span className="guest-modifier-price"><bdi dir="ltr">{extra ? '+ ' : ''}{Number(value).toFixed(2)}</bdi> <small>{currencyLabel}</small></span>;
  function choose(groupId: string, optionId: string, checked: boolean) {
    const group = groups.find(group => group.id === groupId);
    if (!group || !group.options.some(option => option.id === optionId && option.isAvailable)) return;
    setSelected(previous => {
      const current = reconcileModifierSelections(groups, previous)[groupId];
      const next = group.selection === 'single' ? [optionId] : checked ? current.includes(optionId) ? current : [...current, optionId] : current.filter(id => id !== optionId);
      return next.length > group.maxSelections ? previous : { ...previous, [groupId]: next };
    });
  }
  return <div className="guest-modifiers">
    <h3 className="guest-modifiers-title"><Layers3 size={17}/>{t('Make it yours')}</h3>
    {groups.map(group => <fieldset className="guest-modifier-group" key={group.id} aria-describedby={`modifier-help-${group.id}`}>
      <legend><span>{text(group.title, group.titleAr)}</span><small>{t(group.minSelections ? 'Required' : 'Optional')}</small></legend>
      <div className="guest-modifier-help" id={`modifier-help-${group.id}`}><span>{group.selection === 'single' ? t('Choose one') : group.minSelections ? t('Choose {min} to {max}', { min: group.minSelections, max: group.maxSelections }) : t('Choose up to {count}', { count: group.maxSelections })}</span>{valid[group.id].length > 0 && <button type="button" onClick={() => setSelected(old => ({ ...old, [group.id]: [] }))} aria-label={t('Clear {group}', { group: text(group.title, group.titleAr) })}>{t('Clear')}</button>}</div>
      <div className="guest-modifier-options">{group.options.map(option => {
        const checked = valid[group.id].includes(option.id);
        const atLimit = group.selection === 'multiple' && valid[group.id].length >= group.maxSelections;
        return <label className={'guest-modifier-option '+(checked ? 'is-selected' : '')} key={option.id} data-unavailable={!option.isAvailable}>
          <input type={group.selection === 'single' ? 'radio' : 'checkbox'} name={`modifier-${item.id}-${group.id}`} checked={checked}
            disabled={!option.isAvailable || !checked && atLimit} onChange={e => choose(group.id, option.id, e.target.checked)}/>
          <span className="guest-modifier-name"><bdi>{text(option.label, option.labelAr)}</bdi>{!option.isAvailable && <small>{t('Unavailable')}</small>}</span>
          {Number(option.price) > 0 ? amount(option.price, true) : <span className="guest-modifier-included">{t('Included')}</span>}
        </label>;
      })}</div>
    </fieldset>)}
  </div>;
}
