import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, Coffee, Clock3, Heart, MapPin, Phone, Search, Sparkles, SlidersHorizontal, X, Leaf, Pause, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cafeDate, cafeThemeStyle } from '@/lib/cafeTheme';
import { categoryEmoji, liveCafeStyle, menuTone } from '@/lib/menuPalette';
import { useMenuAnimation, useMenuMotionPreference } from '@/lib/useMenuAnimation';
import MenuWheel from '@/components/menu/MenuWheel';
import MenuCategoryBar from '@/components/menu/MenuCategoryBar';
import MenuModifiers from '@/components/menu/MenuModifiers';
import { MENU_GROUPS, categoryGroup, type MenuGroup } from '@/lib/menuDiscovery';
import { matchesMenuSearch, menuSearchIndex, menuSearchQuery } from '@/lib/menuSearch';
import { arabicMenuLabel, MenuLanguageProvider, MenuLanguageSwitch, useMenuLanguage } from '@/lib/menuLanguage';
import type { PublicCafe, MenuItem, PriceVariant, PublicMenuData } from '@shared/schema';
import { customizationTotal, reconcileModifierSelections, selectedModifierOptions, missingModifierGroups, type MenuModifierSelections } from '@shared/menuCustomization';
import { buildArenaConfig, type ArenaHelpers } from '@/menu-arena/buildArenaConfig';
import './customer-menu.css';
import './customer-menu-live.css';
import './customer-menu-simple.css';
import './customer-menu-polish.css';
import './customer-menu-responsive.css';
import './customer-menu-arabic.css';
import './customer-menu-compact.css';
import { getMenuData, keepMenuDuringReconnect, MenuLoadError } from '@/lib/menuRefresh';

const ArenaMenu = lazy(() => import('@/menu-arena/ArenaMenu'));

const arenaHelpers: ArenaHelpers = {
  // Classic customer page shows only available items; specialDate is a badge/filter, not a hide rule.
  isItemVisible: (item) => item.isAvailable !== false,
  arabicForItem: (name) => {
    const ar = arabicMenuLabel(name);
    return ar === name ? '' : ar;
  },
  arabicForCategory: (title) => {
    const ar = arabicMenuLabel(title);
    return ar === title ? '' : ar;
  },
  groupForCategory: (category) => (categoryGroup(category.title) === 'drinks' ? 'drinks' : 'food'),
};

const EMPTY_MODIFIER_GROUPS: MenuItem['modifierGroups'] = [];

function MenuImage({ item, category, priority = false }: { item: MenuItem; category: string; priority?: boolean }) {
  return item.imageUrl ? <img src={item.imageUrl} alt="" loading={priority ? 'eager' : 'lazy'} />
    : <div className="guest-food-art" aria-hidden="true"><span className="guest-art-orbit" /><span className="guest-art-plate"><span className="guest-art-food">{categoryEmoji(category)}</span></span><span className="guest-art-dot" /><span className="guest-art-spark">✦</span></div>;
}
function Price({ price, discount, currency, unit }: { price: string; discount: string | null; currency: string; unit: string }) {
  const { language, label } = useMenuLanguage();
  const off = Number(discount || 0);
  const currencyLabel = language === 'ar' ? ({ QAR: 'ر.ق', SAR: 'ر.س', AED: 'د.إ' }[currency] || currency) : currency;
  return <div className="guest-price"><strong><bdi dir="ltr">{(Number(price) * (1 - off / 100)).toFixed(2)}</bdi> <small>{currencyLabel}</small></strong>{off > 0 && <del><bdi dir="ltr">{Number(price).toFixed(2)}</bdi></del>}<span>/ {label(unit)}</span></div>;
}
function MenuCover({ cafe, motion }: { cafe: PublicCafe; motion: boolean }) {
  const { t, label } = useMenuLanguage();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!video.current) return;
    if (motion) void video.current.play().catch(() => {});
    else video.current.pause();
  }, [motion, cafe.coverMediaUrl]);
  if (!cafe.coverMediaUrl) return null;
  return <div className="guest-menu-cover">{cafe.coverMediaType === 'video' ? <video ref={video} src={cafe.coverMediaUrl} muted playsInline loop controls preload="metadata" aria-label={t('{name} welcome video', { name: label(cafe.name) })}/> : <img src={cafe.coverMediaUrl} alt={t('{name} atmosphere', { name: label(cafe.name) })}/>}</div>;
}
export default function CustomerMenu() {
  return <MenuLanguageProvider><CustomerMenuContent/></MenuLanguageProvider>;
}
function CustomerMenuContent() {
  const { language, dir, t, label, count } = useMenuLanguage();
  const [, params] = useRoute('/menu/:id');
  const id = params?.id;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [group, setGroup] = useState<MenuGroup>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'specials' | 'saved'>('all');
  const [saved, setSaved] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<MenuModifierSelections>({});
  const [now, setNow] = useState(Date.now());
  const menuRef = useRef<HTMLDivElement>(null);
  const detailTitleRef = useRef<HTMLHeadingElement>(null);
  const filterTitleRef = useRef<HTMLHeadingElement>(null);
  const [detailElement, setDetailElement] = useState<HTMLDivElement | null>(null);
  const motion = useMenuMotionPreference();
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('cafe-favorites-' + id) || '[]');
      setSaved(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []);
    } catch { setSaved([]); }
    setSearch(''); setCategory(null); setGroup('all'); setFiltersOpen(false); setWheelOpen(false); setFilter('all'); setSelectedId(null); setDetailOpen(false); setSelectedVariantId(null);
  }, [id]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const menuQuery = useQuery<PublicMenuData>({ enabled: !!id, queryKey: ['/api/menu/public', id],
    queryFn: ({ signal }) => getMenuData('/api/menu/public/' + id, signal),
    staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true,
    retry: (attempt, error) => attempt < 1 && (!(error instanceof MenuLoadError) || error.status === 0 || error.status === 429 || error.status >= 500) });
  const arenaConfig = useMemo(() => {
    const data = menuQuery.data;
    if (!data) return null;
    // Arena is the default for every café. Classic only when enabled is explicitly false.
    if (data.design?.enabled === false) return null;
    try {
      return buildArenaConfig(data, data.design?.settings ?? {}, arenaHelpers);
    } catch (error) {
      console.error('Arena menu config failed; falling back to classic page', error);
      return null;
    }
  }, [menuQuery.data]);
  const restaurant = menuQuery.data?.restaurant;
  const today = useMemo(() => cafeDate(restaurant?.timezone), [restaurant?.timezone, now]);
  const available = useMemo(() => (menuQuery.data?.items || []).filter(item => item.isAvailable), [menuQuery.data?.items]);
  const byItem = useMemo(() => {
    const map = new Map<string, PriceVariant[]>();
    for (const variant of menuQuery.data?.variants || []) {
      const options = map.get(variant.menuItemId) || [];
      options.push(variant); map.set(variant.menuItemId, options);
    }
    return map;
  }, [menuQuery.data?.variants]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of available) counts.set(item.categoryId, (counts.get(item.categoryId) || 0) + 1);
    return counts;
  }, [available]);
  const categoryGroups = useMemo(() => new Map((menuQuery.data?.categories || []).map(c => [c.id, categoryGroup(c.title)])), [menuQuery.data?.categories]);
  const searchIndexes = useMemo(() => {
    const titles = new Map((menuQuery.data?.categories || []).map(c => [c.id, c.title]));
    return new Map(available.map(item => {
      const title = titles.get(item.categoryId) || '';
      const options = [...(item.hasMultiplePricing ? (byItem.get(item.id) || []).map(option => option.label) : []), ...(item.modifierGroups || []).flatMap(group => [group.title, group.titleAr || '', ...group.options.filter(option => option.isAvailable).flatMap(option => [option.label, option.labelAr || ''])])];
      // Both languages stay searchable regardless of the currently selected interface.
      return [item.id, [...menuSearchIndex(item, title, options), ...menuSearchIndex({ ...item, name: arabicMenuLabel(item.name), tags: item.tags?.map(arabicMenuLabel) }, arabicMenuLabel(title), options.map(arabicMenuLabel))]];
    }));
  }, [available, menuQuery.data?.categories, byItem]);
  const searchWords = useMemo(() => menuSearchQuery(search), [search]);
  const groupedItems = available.filter(item => group === 'all' || categoryGroups.get(item.categoryId) === group);
  const groupCategories = (menuQuery.data?.categories || []).filter(c => (group === 'all' || categoryGroups.get(c.id) === group) && categoryCounts.has(c.id));
  const filtered = groupedItems.filter(item => (!category || item.categoryId === category)
    && (filter !== 'specials' || item.specialDate === today)
    && (filter !== 'saved' || saved.includes(item.id))
    && matchesMenuSearch(searchIndexes.get(item.id) || [], searchWords));
  const activeItem = available.find(item => item.id === selectedId);
  const activeOptions = activeItem ? byItem.get(activeItem.id) || [] : [];
  const activeVariant = activeOptions.find(option => option.id === selectedVariantId) || activeOptions[0];
  const activeGroups = activeItem?.modifierGroups || EMPTY_MODIFIER_GROUPS;
  const selectedExtras = selectedModifierOptions(activeGroups, selectedModifiers);
  const missingChoices = missingModifierGroups(activeGroups, selectedModifiers);
  const unavailableRequired = missingChoices.some(g => g.options.filter(o => o.isAvailable).length < g.minSelections);
  useEffect(() => {
    // Prune removed or sold-out choices after a menu refresh; never resurrect them later.
    setSelectedModifiers(old => {
      const next = reconcileModifierSelections(activeGroups, old);
      return JSON.stringify(old) === JSON.stringify(next) ? old : next;
    });
  }, [activeGroups]);
  const appliedFilters = Number(group !== 'all') + Number(!!category) + Number(filter !== 'all');
  const hasDiscoverySelection = searchWords.length > 0 || !!category || group !== 'all';
  const selectionLabel = [filter==='saved' ? t('Saved') : filter==='specials' ? t("Today's specials") : '', category ? label((menuQuery.data?.categories || []).find(c=>c.id===category)?.title || '') : group==='all' ? '' : t(MENU_GROUPS.find(g=>g.id===group)!.label)].filter(Boolean).join(' · ') || t('Menu');
  const hasMenuError = menuQuery.isError;
  const activeCategory = (menuQuery.data?.categories || []).find(c => c.id === activeItem?.categoryId)?.title || 'Café selection';
  useMenuAnimation(menuRef, detailElement, motion.enabled, restaurant?.id, filtered.map(item => item.id).join(','), detailOpen ? activeItem?.id || null : null);
  function openItem(item: MenuItem) { setSelectedId(item.id); setSelectedVariantId(null); setSelectedModifiers({}); setDetailOpen(true); }
  function toggleSaved(itemId: string) {
    const next = saved.includes(itemId) ? saved.filter(i => i !== itemId) : [...saved, itemId];
    setSaved(next);
    try { localStorage.setItem('cafe-favorites-' + id, JSON.stringify(next)); } catch { /* Browsing works without storage. */ }
  }
  function reset() { setSearch(''); setCategory(null); setGroup('all'); setFilter('all'); }
  function chooseCategory(next: string | null) {
    setCategory(next);
    window.scrollTo({ top: 0, behavior: motion.enabled ? 'smooth' : 'auto' });
  }
  function clearFilters() { setCategory(null); setGroup('all'); setFilter('all'); }
  function itemPricing(item: MenuItem) {
    const options = byItem.get(item.id) || [];
    if (item.hasMultiplePricing) return <div className="guest-variants">{menuQuery.isLoading ? <span>{t('Loading prices…')}</span> : options.length ? options.map(v => <div key={v.id}><span className="guest-option-label">{label(v.label)}</span><Price price={v.price} discount={v.discount} currency={restaurant!.currency} unit={v.unit} /></div>) : <span>{t('Ask our team for pricing')}</span>}</div>;
    return <Price price={item.price} discount={item.discount} currency={restaurant!.currency} unit={item.unit} />;
  }
  function cardPricing(item: MenuItem) {
    const options = byItem.get(item.id) || [];
    if (!item.hasMultiplePricing || !options.length) return itemPricing(item);
    const lowest = options.reduce((best, option) => Number(option.price) * (1-Number(option.discount || 0)/100) < Number(best.price) * (1-Number(best.discount || 0)/100) ? option : best);
    return <div className="guest-starting-price"><small>{t('From')}</small><Price price={lowest.price} discount={lowest.discount} currency={restaurant!.currency} unit={lowest.unit}/></div>;
  }
  if (arenaConfig) {
    return <Suspense fallback={<div className="guest-menu guest-loading" lang={language} dir={dir} style={cafeThemeStyle()} aria-busy="true"><Coffee size={40}/><p>{t('Preparing your menu…')}</p></div>}>
      <ArenaMenu config={arenaConfig} />
    </Suspense>;
  }
  if (menuQuery.isLoading) return <div className="guest-menu guest-loading" lang={language} dir={dir} style={cafeThemeStyle()}><MenuLanguageSwitch/><Coffee size={40}/><p>{t('Preparing your menu…')}</p></div>;
  if (!restaurant || menuQuery.isError && !keepMenuDuringReconnect(menuQuery.error, menuQuery.dataUpdatedAt, now)) return <div className="guest-menu guest-loading" lang={language} dir={dir} style={cafeThemeStyle()}><MenuLanguageSwitch/><Coffee size={40}/><h1>{t("We'll be back shortly.")}</h1><p>{t('This café menu is currently unavailable.')}</p><button className="guest-button" onClick={() => menuQuery.refetch()}>{t('Try again')}</button></div>;
  return <div ref={menuRef} className="guest-menu guest-live guest-simple" lang={language} dir={dir} style={liveCafeStyle(restaurant.theme)} data-motion={motion.enabled ? 'on' : 'off'} data-page-visible={motion.pageVisible}>
    <div className="guest-atmosphere" aria-hidden="true"><span/><span/><span/></div>
    <div className="guest-shell">
      <div className="guest-navigation">
      <header className="guest-top">
        <div className="guest-brand">{restaurant.logoUrl ? <img className="guest-brand-logo" src={restaurant.logoUrl} alt={t('{name} logo', { name: label(restaurant.name) })}/> : <span className="guest-brand-icon"><Coffee size={19}/></span>}<span><bdi>{label(restaurant.name)}</bdi><small>{t('THE CAFÉ MENU')}</small></span></div>
        <div className="guest-header-actions"><MenuLanguageSwitch/><button className="guest-filter-trigger" onClick={()=>setFiltersOpen(true)} aria-label={t('Open filters')}><SlidersHorizontal size={18}/><span>{t('Filters')}</span>{appliedFilters>0 && <small>{appliedFilters}</small>}</button></div>
      </header>
      <MenuCategoryBar categories={groupCategories} selected={category} allLabel={group === 'all' ? t('All') : t('All {group}', { group: t(MENU_GROUPS.find(g=>g.id===group)!.label) })} motionEnabled={motion.enabled} onSelect={chooseCategory}/>
      </div>
      <h1 className="sr-only">{t('{name} menu', { name: label(restaurant.name) })}</h1>
      {hasMenuError && <div className="guest-reconnecting" role="status"><p>{t('Reconnecting. Prices and availability may have changed.')}</p><button disabled={menuQuery.isFetching} onClick={()=>menuQuery.refetch()}>{t('Try again')}</button></div>}
      <MenuCover cafe={restaurant} motion={motion.enabled && motion.pageVisible}/>
      <div className="guest-search"><Search size={18}/><input aria-label={t('Search menu')} placeholder={t('Search items or categories')} value={search} onChange={e=>setSearch(e.target.value)}/>{search && <button onClick={()=>setSearch('')} aria-label={t('Clear search')}><X size={17}/></button>}</div>
      <div className="guest-simple-tools"><div><span>{selectionLabel}</span>{appliedFilters>0 && <button aria-label={t('Clear filters')} onClick={clearFilters}><X size={14}/></button>}</div><button className="guest-wheel-link" onClick={()=>setWheelOpen(true)} disabled={!filtered.length || hasMenuError}><Sparkles size={16}/>{t("Can't decide?")}</button></div>
      <main id="guest-menu-list" className="guest-main">
        {menuQuery.isLoading ? <div className="guest-grid" aria-label={t('Loading menu')}>{[0,1,2,3].map(i=><div className="guest-card-skeleton" key={i}/>)}</div>
          : filtered.length ? <div className="guest-sections">{(menuQuery.data?.categories || []).map(c => {
            const items = filtered.filter(i=>i.categoryId===c.id);
            return items.length ? <section key={c.id} aria-labelledby={'category-'+c.id} data-tone={menuTone(c.title)}><div className="guest-category-heading"><h2 id={'category-'+c.id}>{label(c.title)}</h2><span className="guest-section-count">{count(items.length)}</span></div><div className="guest-grid">{items.map(item=><article className="guest-item" key={item.id} data-testid={'menu-item-'+item.id}>
              <div className="guest-image-open"><MenuImage item={item} category={c.title} priority={filtered.indexOf(item)<4}/></div>
              <div className="guest-item-body"><div className="guest-item-badges">{item.specialDate===today && <span><Sparkles size={11}/>{t('Today only')}</span>}{!item.hasMultiplePricing && Number(item.discount)>0 && <span className="offer">{t('{discount}% off', { discount: Number(item.discount) })}</span>}</div><h3 className="guest-card-name"><bdi>{label(item.name)}</bdi></h3><div className="guest-card-bottom"><div className="guest-item-pricing">{cardPricing(item)}</div><span className="guest-card-arrow" aria-hidden="true"><ArrowUpRight size={17}/></span></div></div>
              <button className="guest-item-open" aria-label={t('View {name}', { name: label(item.name) })} onClick={()=>openItem(item)}/><button className={'guest-heart '+(saved.includes(item.id)?'is-saved':'')} aria-label={t(saved.includes(item.id)?'Unsave {name}':'Save {name}', { name: label(item.name) })} aria-pressed={saved.includes(item.id)} onClick={()=>toggleSaved(item.id)}><Heart size={15} fill={saved.includes(item.id)?'currentColor':'none'}/></button>
            </article>)}</div></section> : null;
          })}</div>
          : <div className="guest-empty"><span className="guest-empty-icon"><Coffee size={38} strokeWidth={1.5}/></span><p className="guest-kicker">{t('A LITTLE PAUSE')}</p><h2>{t(available.length ? hasDiscoverySelection ? 'A different craving?' : filter==='saved' ? 'Keep your favorites close.' : filter==='specials' ? 'More good things soon.' : 'A different craving?' : 'Something good is brewing.')}</h2><p>{t(available.length ? hasDiscoverySelection ? 'No items match your search and filters. Try another word or explore the full menu.' : filter==='saved' ? 'Tap a heart to save something you love.' : filter==='specials' ? 'No specials are listed for today. There’s plenty to explore on the menu.' : 'No selections match your filters. Try the full menu.' : 'Our café team is preparing the menu. Ask us about today’s available selections.')}</p>{available.length>0 && <button className="guest-button" onClick={reset}>{t('Explore the menu')} <ArrowUpRight size={16}/></button>}</div>}
        <div className="guest-note"><Leaf size={17}/><p>{t('Questions about ingredients or allergens?')}<br/><strong>{t('Our café team is happy to help.')}</strong></p></div>
      </main>
      {(restaurant.openingHours || restaurant.address || restaurant.phone) && <div className="guest-info">{restaurant.openingHours && <span><Clock3 size={14}/><bdi>{restaurant.openingHours}</bdi></span>}{restaurant.address && <a href={'https://maps.google.com/?q='+encodeURIComponent(restaurant.address)} target="_blank" rel="noopener noreferrer"><MapPin size={14}/><bdi>{restaurant.address}</bdi></a>}{restaurant.phone && <a href={'tel:'+restaurant.phone}><Phone size={14}/>{t('Call café')}</a>}</div>}
      <footer className="guest-footer"><span><bdi>{label(restaurant.name)}</bdi><small>{t('A little pause, a good moment.')}</small></span></footer>
    </div>
    <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}><DialogContent className="guest-filter-panel guest-compact-filters" onOpenAutoFocus={event=>{event.preventDefault();filterTitleRef.current?.focus({preventScroll:true});}} lang={language} dir={dir} closeLabel={t('Close')} overlayClassName={'guest-glass-overlay '+(!motion.enabled ? 'is-still' : '')} style={liveCafeStyle(restaurant.theme)} data-motion={motion.enabled ? 'on' : 'off'}>
      <div className="guest-filter-heading"><DialogTitle ref={filterTitleRef} tabIndex={-1}>{t('Filters')}</DialogTitle><DialogDescription className="sr-only">{t('Choose a menu type, category or saved items.')}</DialogDescription></div>
      <div className="guest-filter-scroll" role="region" aria-label={t('Filter options')} tabIndex={0}>
      <label>{t('Menu type')}<select aria-label={t('Menu type')} value={group} onChange={e=>{setGroup(e.target.value as MenuGroup);setCategory(null);}}>{MENU_GROUPS.filter(g=>g.id==='all' || available.some(item=>categoryGroups.get(item.categoryId)===g.id)).map(g=><option key={g.id} value={g.id}>{t(g.id==='all' ? 'Everything' : g.label)}</option>)}</select></label>
      <label>{t('Category')}<select aria-label={t('Category')} value={category || ''} onChange={e=>setCategory(e.target.value || null)}><option value="">{t('All categories')}</option>{groupCategories.map(c=><option key={c.id} value={c.id}>{label(c.title)}</option>)}</select></label>
      <label>{t('Show')}<select aria-label={t('Show items')} value={filter} onChange={e=>setFilter(e.target.value as 'all'|'specials'|'saved')}><option value="all">{t('All menu items')}</option><option value="specials">{t("Today's specials")}</option><option value="saved">{t('Saved items')}</option></select></label>
      <button className="guest-panel-motion" onClick={motion.toggle} disabled={motion.reduced} aria-label={t(motion.reduced ? 'Motion reduced by your device settings' : motion.paused ? 'Resume animations' : 'Pause animations')}>{motion.enabled ? <Pause size={15}/> : <Play size={15}/>} {t(motion.enabled ? 'Animations on' : 'Animations off')}</button>
      </div>
      <div className="guest-panel-actions"><button onClick={reset}>{t('Reset')}</button><button onClick={()=>setFiltersOpen(false)}>{t(filtered.length === 1 ? 'Show {count} item' : 'Show {count} items', { count: filtered.length })}</button></div>
    </DialogContent></Dialog>
    {wheelOpen && <MenuWheel items={filtered} theme={restaurant.theme} motionEnabled={motion.enabled} scope={category ? (menuQuery.data?.categories || []).find(c=>c.id===category)?.title || 'Your filters' : group==='all' ? 'Your current menu filters' : MENU_GROUPS.find(g=>g.id===group)!.label} onClose={()=>setWheelOpen(false)} onSelect={item=>{setWheelOpen(false);openItem(item);}} pricing={cardPricing}/>}
    <Dialog open={detailOpen && !!activeItem} onOpenChange={setDetailOpen}><DialogContent ref={setDetailElement} onOpenAutoFocus={event=>{event.preventDefault();detailTitleRef.current?.focus({preventScroll:true});}} lang={language} dir={dir} closeLabel={t('Close')} overlayClassName={'guest-glass-overlay '+(!motion.enabled ? 'is-still' : '')} className="guest-detail guest-glass-detail guest-compact-detail" style={liveCafeStyle(restaurant.theme)} data-motion={motion.enabled ? 'on' : 'off'} data-page-visible={motion.pageVisible} data-tone={menuTone(activeCategory)}>{activeItem && <>
      <div className="guest-detail-heading">
        <div className="guest-detail-image"><span className="guest-detail-aura" aria-hidden="true"/><MenuImage item={activeItem} category={activeCategory} priority/></div>
        <div className="guest-detail-heading-copy"><p className="guest-kicker">{activeCategory === 'Café selection' ? t(activeCategory) : label(activeCategory)}</p><DialogTitle ref={detailTitleRef} tabIndex={-1} className="guest-detail-title"><bdi>{label(activeItem.name)}</bdi></DialogTitle><div className="guest-detail-price">{activeItem.hasMultiplePricing ? activeVariant ? <Price price={activeVariant.price} discount={activeVariant.discount} currency={restaurant.currency} unit={activeVariant.unit}/> : <span>{t('Ask our team for pricing')}</span> : itemPricing(activeItem)}</div></div>
      </div>
      <div className="guest-detail-body" tabIndex={0} role="region" aria-label={t('Item options and details')}>
        {hasMenuError && <p className="guest-reconnecting" role="status">{t('Reconnecting. Prices and availability may have changed.')}</p>}
        <DialogDescription className={activeItem.description ? 'guest-detail-description' : 'sr-only'}><bdi>{activeItem.description ? label(activeItem.description) : t('Menu item details and pricing.')}</bdi></DialogDescription>
        {activeItem.specialDate===today && <span className="guest-detail-special"><Sparkles size={14}/>{t("Today's special")}</span>}
        {activeItem.hasMultiplePricing && activeOptions.length>0 && <fieldset className="guest-option-picker"><legend>{t('CHOOSE YOUR OPTION')}</legend>{activeOptions.map(option=><label key={option.id} className={activeVariant?.id===option.id ? 'selected' : ''}><input type="radio" name="menu-price-option" value={option.id} checked={activeVariant?.id===option.id} onChange={()=>setSelectedVariantId(option.id)}/><span>{label(option.label)}</span><Price price={option.price} discount={option.discount} currency={restaurant.currency} unit={option.unit}/></label>)}</fieldset>}
        {!!activeGroups.length && (!activeItem.hasMultiplePricing || activeVariant) && <MenuModifiers item={activeItem} currency={restaurant.currency} selected={selectedModifiers} setSelected={setSelectedModifiers}/>}
        {!!activeItem.tags?.length && <div className="guest-detail-tags">{activeItem.tags.map(tag=><span key={tag}>{['Vegetarian','Vegan'].includes(tag) && <Leaf size={13}/>} {label(tag)}</span>)}</div>}
        {unavailableRequired && <p className="guest-modifier-required" role="status">{t('Some required choices are unavailable. Please ask our team for alternatives.')}</p>}
        <div className="guest-detail-note"><Leaf size={15}/><span>{t('For ingredients and allergens, please ask our team.')}</span></div>
        {!!activeGroups.length && <p className="guest-customization-note">{t('Selections are for reference. Tell our team your choices when ordering.')}</p>}
      </div>
      <footer className="guest-selection-footer">
        <div className="guest-selection-heading"><span>{t('Your selection')}</span><button type="button" className={'guest-detail-save '+(saved.includes(activeItem.id)?'is-saved':'')} aria-label={t(saved.includes(activeItem.id)?'Saved to favorites':'Save to favorites')} aria-pressed={saved.includes(activeItem.id)} onClick={()=>toggleSaved(activeItem.id)}><Heart size={19}/></button></div>
        <div className="guest-selected-choices" role="region" aria-label={t('Selected variant and toppings')} tabIndex={0}>
          {activeItem.hasMultiplePricing && activeVariant && <span className="guest-selected-variant"><Check size={12}/><bdi>{label(activeVariant.label)}</bdi></span>}
          {selectedExtras.map(option=><span className="guest-selected-extra" key={option.id}><bdi>{language === 'ar' && option.labelAr?.trim() ? option.labelAr : label(option.label)}</bdi>{Number(option.price)>0 && <small><bdi dir="ltr">+{Number(option.price).toFixed(2)}</bdi></small>}</span>)}
          {!selectedExtras.length && !!activeGroups.length && <span className="guest-no-extras">{t('No extras selected')}</span>}
          {!activeItem.hasMultiplePricing && !activeGroups.length && <span className="guest-no-extras">{label(activeItem.unit)}</span>}
        </div>
        {missingChoices.length>0 && <p className="guest-selection-required" role="status">{t('Choose required options.')}</p>}
        <div className="guest-selection-total" role="status" aria-live="polite" aria-atomic="true"><span>{t('Estimated total')}</span>{!activeItem.hasMultiplePricing || activeVariant ? <strong><bdi dir="ltr">{customizationTotal(activeItem.hasMultiplePricing ? activeVariant!.price : activeItem.price, activeItem.hasMultiplePricing ? activeVariant!.discount : activeItem.discount, selectedExtras)}</bdi> <small>{language === 'ar' ? ({QAR:'ر.ق',SAR:'ر.س',AED:'د.إ'}[restaurant.currency] || restaurant.currency) : restaurant.currency}</small></strong> : <strong className="guest-selection-no-price">{t('Ask our team for pricing')}</strong>}</div>
      </footer>
    </>}</DialogContent></Dialog>
  </div>;
}
