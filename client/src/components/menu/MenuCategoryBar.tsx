import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { categoryEmoji, menuTone } from '@/lib/menuPalette';
import type { Category } from '@shared/schema';
import { useMenuLanguage } from '@/lib/menuLanguage';

export default function MenuCategoryBar({ categories, selected, allLabel, motionEnabled, onSelect }: {
  categories: Category[];
  selected: string | null;
  allLabel: string;
  motionEnabled: boolean;
  onSelect: (id: string | null) => void;
}) {
  const { dir, label, t } = useMenuLanguage();
  const rtl = dir === 'rtl';
  const rail = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ before: false, after: false });
  const categoryKey = categories.map(category => category.id + ':' + category.title).join('|');

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    function update() {
      const offset = Math.abs(element!.scrollLeft);
      const before = offset > 2;
      const after = offset + element!.clientWidth < element!.scrollWidth - 2;
      setEdges(old => old.before === before && old.after === after ? old : { before, after });
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    // Category data can arrive after the navigation container has been measured.
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, [categoryKey, allLabel, dir]);

  useEffect(() => {
    const element = rail.current;
    const button = element?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!element || !button) return;
    const buttonBounds = button.getBoundingClientRect();
    const railBounds = element.getBoundingClientRect();
    element.scrollTo({ left: element.scrollLeft + (rtl ? buttonBounds.right - railBounds.right : buttonBounds.left - railBounds.left), behavior: motionEnabled ? 'smooth' : 'auto' });
  }, [selected, categoryKey, allLabel, motionEnabled, rtl]);

  function move(direction: number) {
    const element = rail.current;
    if (!element) return;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * (rtl ? -1 : 1) * (element.clientWidth + gap), behavior: motionEnabled ? 'smooth' : 'auto' });
  }
  function choose(id: string | null, button: HTMLButtonElement) {
    onSelect(id);
    const element = rail.current;
    if (!element) return;
    const buttonBounds = button.getBoundingClientRect();
    const railBounds = element.getBoundingClientRect();
    element.scrollTo({ left: element.scrollLeft + (rtl ? buttonBounds.right - railBounds.right : buttonBounds.left - railBounds.left), behavior: motionEnabled ? 'smooth' : 'auto' });
  }

  return <div className="guest-category-rail" data-before={edges.before} data-after={edges.after}>
    {(edges.before || edges.after) && <button className="guest-category-prev" aria-label={t('Previous categories')} disabled={!edges.before} onClick={() => move(-1)}>{rtl ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}</button>}
    <nav ref={rail} className="guest-category-bar" aria-label={t('Menu categories')}>
      <button aria-pressed={!selected} onClick={event => choose(null, event.currentTarget)}><span aria-hidden="true">✦</span><span className="guest-category-label">{allLabel}</span></button>
      {categories.map(category => <button key={category.id} data-tone={menuTone(category.title)} aria-pressed={selected === category.id} onClick={event => choose(category.id, event.currentTarget)}><span aria-hidden="true">{categoryEmoji(category.title)}</span><span className="guest-category-label">{label(category.title)}</span></button>)}
    </nav>
    {(edges.before || edges.after) && <button className="guest-category-next" aria-label={t('More categories')} disabled={!edges.after} onClick={() => move(1)}>{rtl ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}</button>}
  </div>;
}
