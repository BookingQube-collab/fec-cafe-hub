import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Shuffle, Sparkles, ArrowUpRight, RotateCw, Coffee } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { liveCafeStyle } from '@/lib/menuPalette';
import { randomIndex, wheelLanding, wheelShortlist } from '@/lib/menuDiscovery';
import type { MenuItem } from '@shared/schema';
import { useMenuLanguage } from '@/lib/menuLanguage';
import './menu-wheel.css';

const COLORS = ['#ffc4a3', '#bdebd6', '#ddd0ff', '#ffe49b', '#ffcade', '#bfe5ff', '#f7d4a7', '#cbd6ff'];
function sectorPath(index: number, count: number) {
  const step = 2 * Math.PI / count;
  const start = -Math.PI / 2 + index * step;
  const end = start + step;
  return `M160,160 L${160 + 151 * Math.cos(start)},${160 + 151 * Math.sin(start)} A151,151 0 ${step > Math.PI ? 1 : 0},1 ${160 + 151 * Math.cos(end)},${160 + 151 * Math.sin(end)} Z`;
}
const SLOT_COUNT = 6;

export default function MenuWheel({ items, theme, motionEnabled, scope, onClose, onSelect, pricing }: {
  items: MenuItem[]; theme: string; motionEnabled: boolean; scope: string;
  onClose: () => void; onSelect: (item: MenuItem) => void; pricing: (item: MenuItem) => ReactNode;
}) {
  const { language, dir, t, label } = useMenuLanguage();
  const eligible = items.filter(item => item.isAvailable);
  const [slots, setSlots] = useState(() => wheelShortlist(eligible, SLOT_COUNT));
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const currentItems = new Map(eligible.map(item => [item.id, item]));
  const result = resultId ? currentItems.get(resultId) : undefined;
  const allSlotsAvailable = slots.every(slot => currentItems.has(slot.id));
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function finish() {
    if (!locked.current) return;
    if (timer.current) clearTimeout(timer.current);
    locked.current = false;
    setResultId(pending.current);
    setSpinning(false);
  }
  function spin() {
    if (locked.current || !slots.length || !allSlotsAvailable) return;
    locked.current = true;
    setResultId(null);
    const winner = randomIndex(slots.length);
    pending.current = slots[winner].id;
    setRotation(angle => wheelLanding(angle, winner, slots.length));
    if (!motionEnabled) { finish(); return; }
    setSpinning(true);
    timer.current = setTimeout(finish, 4400);
  }
  function shuffle() {
    if (locked.current) return;
    setSlots(wheelShortlist(eligible, SLOT_COUNT));
    setResultId(null);
    setRotation(0);
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent
    className="menu-wheel-dialog guest-compact-wheel" overlayClassName={'guest-glass-overlay '+(!motionEnabled ? 'is-still' : '')} style={liveCafeStyle(theme)}
    onOpenAutoFocus={event=>{event.preventDefault();titleRef.current?.focus({preventScroll:true});}}
    lang={language} dir={dir} closeLabel={t('Close')} data-motion={motionEnabled ? 'on' : 'off'}>
    <div className="menu-wheel-heading"><span className="menu-wheel-eyebrow"><Sparkles size={14}/> {t('A LITTLE MENU MAGIC')}</span>
      <DialogTitle ref={titleRef} tabIndex={-1}>{t('Find your next favorite.')}</DialogTitle>
      <DialogDescription>{scope === 'Your current menu filters' ? t('Real dishes. Real cravings. One lucky pick.') : t('A lucky pick from {scope}.', { scope: label(t(scope)) })}</DialogDescription>
    </div>
    {slots.length ? <>
      <div className="menu-wheel-scroll" role="region" aria-label={t('Wheel and menu choices')} tabIndex={0}>
      <div className="menu-wheel-stage">
        <span className="menu-wheel-pointer" aria-hidden="true"/>
        <div className="menu-wheel-disc" data-spinning={spinning} style={{ transform: `rotate(${rotation}deg)` }}
          onTransitionEnd={e => { if (e.target === e.currentTarget && e.propertyName === 'transform') finish(); }} aria-hidden="true">
          <svg viewBox="0 0 320 320">{slots.map((snapshot, i) => {
            const slot = currentItems.get(snapshot.id) || snapshot;
            const angle = (i + .5) * 360 / slots.length;
            const radians = (angle - 90) * Math.PI / 180;
            const x = 160 + 103 * Math.cos(radians);
            const y = 160 + 103 * Math.sin(radians);
            return <g key={slot.id} data-menu-id={slot.id} data-menu-name={slot.name} data-slot={i} className={resultId === slot.id ? 'is-winner' : ''}>
              {slots.length === 1 ? <circle className="menu-wheel-sector" cx="160" cy="160" r="151" fill={COLORS[i]}/> : <path className="menu-wheel-sector" d={sectorPath(i, slots.length)} fill={COLORS[i]}/>}
              <foreignObject x={x - 42} y={y - 40} width="84" height="80" className="menu-wheel-label" style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${x}px ${y}px` }}>
                <div className="menu-wheel-food" dir={dir}>{slot.imageUrl ? <img src={slot.imageUrl} alt=""/> : <span><Coffee size={24}/></span>}<strong>{label(slot.name)}</strong></div>
              </foreignObject>
            </g>;
          })}</svg>
        </div>
        <button className="menu-wheel-hub" aria-label={t('Spin from wheel center')} data-spinning={spinning} onClick={spin} disabled={spinning || !allSlotsAvailable}><Sparkles size={25}/><small>{t(spinning ? 'PICKING' : 'SPIN')}</small></button>
      </div>
      <div className="menu-wheel-status" role="status" aria-live="polite" aria-atomic="true">{spinning ? t('Finding your next favorite…') : result ? t('Your pick: {name}', { name: label(result.name) }) : !allSlotsAvailable || resultId ? t('The menu just changed. Shuffle for fresh choices.') : t('Ready when you are. Give it a spin!')}</div>
      <p className="menu-wheel-caption">{language === 'ar' ? slots.length === 1 ? t('One choice from one available item') : t('{slots} choices from {total} available items', { slots: slots.length, total: eligible.length }) : `${slots.length} ${slots.length === 1 ? 'choice' : 'choices'} from ${eligible.length} available ${eligible.length === 1 ? 'item' : 'items'}`}{eligible.length > slots.length ? ' · '+t('Shuffle to discover more') : ''}</p>
      <details className="menu-wheel-choices"><summary>{slots.length === 1 ? t('Explore this choice') : t('Explore these {count} choices', { count: slots.length })}</summary><ol className="menu-wheel-shortlist" aria-label={t('Wheel choices')}>{slots.map((snapshot, i) => {
        const slot = currentItems.get(snapshot.id) || snapshot;
        return <li key={slot.id}><button disabled={spinning || !currentItems.has(slot.id)} onClick={() => onSelect(slot)}>{slot.imageUrl ? <img src={slot.imageUrl} alt=""/> : <span style={{ background: COLORS[i] }}><Coffee size={16}/></span>}<strong>{label(slot.name)}</strong><ArrowUpRight size={13}/></button></li>;
      })}</ol></details>
      </div>
      <footer className="menu-wheel-footer">
        {result && <div className="menu-wheel-result" key={result.id}>{result.imageUrl && <img src={result.imageUrl} alt=""/>}<div tabIndex={0} role="region" aria-label={t('Chosen menu item')}><small>{t('YOUR NEXT FAVORITE')}</small><h3>{label(result.name)}</h3>{pricing(result)}</div><button className="menu-wheel-result-open" aria-label={t('View chosen {name}', { name: label(result.name) })} onClick={() => onSelect(result)}><span className="menu-wheel-result-arrow"><ArrowUpRight size={20}/></span></button></div>}
        <div className="menu-wheel-actions"><button className="menu-wheel-spin" onClick={spin} disabled={spinning || !allSlotsAvailable}><RotateCw size={18}/>{t(spinning ? 'Spinning…' : result ? 'Spin again' : 'Spin the wheel')}</button><button className="menu-wheel-shuffle" onClick={shuffle} disabled={spinning} aria-label={t('Shuffle wheel choices')}><Shuffle size={19}/></button></div>
      </footer>
    </> : <p className="menu-wheel-status">{t('No available items match these filters. Explore the full menu to spin.')}</p>}
  </DialogContent></Dialog>;
}
