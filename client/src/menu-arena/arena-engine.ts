/* Arena menu engine — the approved design's script (arena-menu-kit/design/menu.html), ported for a SPA.
   Mechanical changes only: config passed in; queries scoped to `root`; CSS variables on `root`;
   every listener / timer / observer / GSAP tween is disposed by the returned cleanup.
   Logic, numbers, easing and timings are unchanged. Do not "improve" this file — edit the design source instead. */
import gsap from 'gsap';
import type { MenuConfig } from './config';

export function mountArenaMenu(root: HTMLElement, config: MenuConfig): () => void {
  const disposers: Array<() => void> = [];
  const on = (t: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions | boolean) => {
    t.addEventListener(type, fn, opts);
    disposers.push(() => t.removeEventListener(type, fn, opts));
  };
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); disposers.push(() => clearTimeout(id)); return id; };
  const every = (fn: () => void, ms: number) => { const id = window.setInterval(fn, ms); disposers.push(() => clearInterval(id)); return id; };
  let rafId = 0;
  let alive = true;

  const ctx = gsap.context(() => {
    const CONFIG = config as any;
    const GROUPS = CONFIG.groups;
    const FX = Object.assign({ tilt: true, countUp: true, reveal: true, cursorRepel: true }, CONFIG.effects || {});
    const LBL = CONFIG.labels;
    const CUR = CONFIG.brand.currency;

    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
    const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T | null;
    const $$ = <T extends Element = HTMLElement>(sel: string) => root.querySelectorAll(sel) as NodeListOf<T>;
    const bind = (key: string, fn: (el: HTMLElement) => void) => $$(`[data-bind="${key}"]`).forEach(fn as any);
    const setText = (key: string, v: unknown) => bind(key, (el) => (el.textContent = (v ?? '') as string));
    const show = (el: Element | null, isOn: unknown) => el && el.classList.toggle('is-hidden', !isOn);

    /* ---------- Derived numbers ---------- */
    const CATS = CONFIG.categories;
    const totals: Record<string, number> = { items: 0, categories: CATS.length, minPrice: Infinity };
    GROUPS.forEach((g: any) => (totals[g.key] = 0));
    CATS.forEach((c: any) => {
      totals.items += c.items.length;
      totals[c.group] = (totals[c.group] || 0) + c.items.length;
      c.items.forEach((it: any) => { if (typeof it.price === 'number' && !it.soldOut) totals.minPrice = Math.min(totals.minPrice, it.price); });
    });
    if (!isFinite(totals.minPrice)) totals.minPrice = 0;
    const fill = (tpl: string) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (totals[k] ?? '') as any);

    /* ---------- Theme (on root instead of :root) ---------- */
    {
      const r = root.style, t = CONFIG.theme, bg = GROUPS[0].bg;
      r.setProperty('--pink', t.accent);
      r.setProperty('--ink', t.accentInk);
      r.setProperty('--font-heading', `'${t.fontHeading}', cursive`);
      r.setProperty('--font-main', `'${t.fontBody}', sans-serif`);
      r.setProperty('--font-ar', `'${t.fontArabic}', sans-serif`);
      r.setProperty('--bg-inner', bg.inner); r.setProperty('--bg-mid', bg.mid); r.setProperty('--bg-outer', bg.outer);
    }

    /* ---------- Brand, hero text, intro, footer ---------- */
    {
      const B = CONFIG.brand, H = CONFIG.hero, I = CONFIG.menuIntro;
      bind('logo', (el: any) => { el.src = B.logoUrl; el.alt = B.logoAlt; el.parentElement.setAttribute('aria-label', B.logoAlt); });
      bind('social', (el: any) => { el.href = B.socialUrl; show(el, B.showSocial && B.socialUrl); });
      setText('social-label', B.socialLabel);
      setText('title1', H.titleLine1); setText('title2', H.titleLine2);
      bind('description', (el) => (el.innerHTML = esc(H.description).replace(/\n/g, '<br>')));
      setText('cta-label', H.ctaLabel); setText('cta-icon', H.ctaIcon);
      bind('badge', (el) => show(el, H.showBadge));
      setText('badge-icon', H.badgeIcon); setText('badge-title', H.badgeTitle); setText('badge-subtitle', fill(H.badgeSubtitle));
      setText('side1', H.sideLine1); setText('side2', H.sideLine2);
      bind('scroll-cue', (el) => show(el, H.showScrollCue));
      setText('scroll-cue-label', H.scrollCueLabel);
      setText('intro-title', I.title); setText('intro-title-ar', I.titleAr); setText('intro-subtitle', I.subtitle);
      setText('footer-text', B.footerText);
      bind('footer-social', (el: any) => { el.href = B.socialUrl; el.textContent = B.socialLabel; show(el, !!B.socialUrl); });
      setText('footer-note', B.footerNote ? ' · ' + B.footerNote : '');
    }

    /* ---------- Hero cards ---------- */
    q('#hero-cards')!.innerHTML = GROUPS.map((g: any, i: number) => `
      <div class="card${i === 0 ? ' active' : ''}" data-gi="${i}" data-group="${esc(g.key)}">
        <img src="${esc(g.card.imageUrl)}" alt="${esc(g.card.imageAlt || '')}">
        <div class="card-info">
          <span>${esc(g.card.label)}</span>
          <span><span>${totals[g.key] || 0}</span> ${esc(g.card.countSuffix)}</span>
        </div>
      </div>`).join('');

    /* ---------- Background floaters ---------- */
    const BACK = CONFIG.backFloaters || [];
    $$<HTMLImageElement>('.leaf').forEach((leaf, i) => {
      const f = BACK[i];
      if (f && f.enabled !== false && f.imageUrl) leaf.src = f.imageUrl; else leaf.classList.add('is-hidden');
    });

    /* ---------- Hero floaters ---------- */
    function setFloater(img: HTMLImageElement, gi: number) {
      const url = (GROUPS[gi].floaters || [])[+img.dataset.i!];
      if (url) { img.src = url; img.classList.remove('slot-empty'); } else { img.removeAttribute('src'); img.classList.add('slot-empty'); }
    }
    $$<HTMLImageElement>('.berry').forEach((b) => setFloater(b, 0));

    /* ---------- 3D product ---------- */
    const P3 = CONFIG.product3d;
    const modelViewer = q<any>('#product-model')!;
    if (P3.enabled && P3.modelUrl) {
      modelViewer.setAttribute('src', P3.modelUrl);
      modelViewer.setAttribute('exposure', P3.exposure);
      modelViewer.setAttribute('alt', P3.alt || '');
      modelViewer.style.transform = `translate(-50%, -50%) rotate(${P3.tiltDeg}deg)`;
    } else {
      q('.hero-center')!.classList.add('is-hidden');
    }

    /* ---------- Marquee ---------- */
    const MQ = CONFIG.marquee;
    const marqueeWords = MQ.mode === 'custom' ? (MQ.customItems || []) : CATS.map((c: any) => c.nameEn);
    if (MQ.enabled && marqueeWords.length) {
      const mq = marqueeWords.map((w: string) => `<span>${esc(w)}</span><span class="star">${esc(MQ.separator)}</span>`).join('');
      q('#marquee')!.innerHTML = mq + mq;
    } else {
      q('.marquee')!.classList.add('is-hidden');
    }

    /* ---------- Stats ---------- */
    q('#stats')!.innerHTML = (CONFIG.stats || []).filter((s: any) => s.enabled !== false)
      .map((s: any) => `<div class="stat"><b data-count="${esc(s.key)}">0</b><span>${esc(s.label)}</span></div>`).join('');
    if (!q('#stats .stat')) q('#stats')!.classList.add('is-hidden');

    /* ---------- Filter buttons ---------- */
    const seg = q('#segmented')!;
    seg.insertAdjacentHTML('beforeend', `<button class="seg-btn active" data-filter="all">${esc(CONFIG.filters.allLabel)}</button>` +
      GROUPS.map((g: any) => `<button class="seg-btn" data-filter="${esc(g.key)}">${esc(g.label)}</button>`).join(''));
    if (CONFIG.filters.showGroupFilter === false) seg.classList.add('is-hidden');

    /* ================= RENDER MENU ================= */
    const grid = q('#menu-grid')!;
    const chipsEl = q('#chips')!;
    let lastGroup: string | null = null;

    function scrollToPanel(panel: HTMLElement) {
      const y = panel.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 900 ? 150 : 190);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }

    CATS.forEach((cat: any) => {
      const panel = document.createElement('article');
      panel.className = 'panel';
      panel.id = 'cat-' + cat.slug;
      panel.dataset.group = cat.group;
      const priceHTML = (it: any) => {
        const v = typeof it.price === 'number' ? it.price : (it.priceText || '');
        return `<span class="price"><b data-v="${esc(v)}">${esc(v)}</b><small>${esc(CUR)}</small></span>`;
      };
      panel.innerHTML = `
        <div class="panel-inner" style="--hue:${esc(cat.hue)}">
          ${cat.bannerUrl ? `<div class="panel-media"><img src="${esc(cat.bannerUrl)}" alt="${esc(cat.nameEn)}" loading="lazy" style="animation-delay:${(Math.random() * -5).toFixed(2)}s"></div>` : ''}
          <div class="panel-head">
            <div><h3>${esc(cat.nameEn)}</h3><span class="ar">${esc(cat.nameAr)}</span></div>
            <span class="count"><i>●</i> ${String(cat.items.length).padStart(2, '0')} ${esc(LBL.itemsUpper)}</span>
          </div>
          <ul class="items">
            ${cat.items.map((it: any) => `
              <li class="item${it.soldOut ? ' sold-out' : ''}">
                <div class="names"><span class="en">${esc(it.nameEn)}${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}${it.soldOut ? `<span class="tag tag-soldout">${esc(LBL.soldOut)}</span>` : ''}</span><span class="ar">${esc(it.nameAr)}</span></div>
                <span class="dots"></span>
                ${priceHTML(it)}
              </li>`).join('')}
          </ul>
        </div>`;
      grid.appendChild(panel);

      if (cat.group !== lastGroup) {
        lastGroup = cat.group;
        const g = GROUPS.find((x: any) => x.key === cat.group);
        const lbl = document.createElement('span');
        lbl.className = 'rail-label'; lbl.dataset.group = cat.group;
        lbl.textContent = g ? g.railLabel : String(cat.group).toUpperCase();
        chipsEl.appendChild(lbl);
      }
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.dataset.target = panel.id;
      chip.dataset.group = cat.group;
      chip.style.setProperty('--hue', cat.hue);
      chip.innerHTML = `<span class="chip-img">${cat.iconUrl ? `<img src="${esc(cat.iconUrl)}" alt="">` : ''}</span><span class="chip-name">${esc(cat.nameEn)}</span><span class="chip-count">${cat.items.length} ${esc(LBL.itemsLower)}</span>`;
      on(chip, 'click', () => scrollToPanel(panel));
      chipsEl.appendChild(chip);
    });

    /* ================= REVEAL ANIMATIONS ================= */
    function countUp(el: HTMLElement, delay: number) {
      const v = el.dataset.v!;
      if (!FX.countUp || isNaN(Number(v)) || v === '') { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, delay }); return; }
      const o = { n: 0 };
      gsap.to(o, { n: Number(v), duration: 0.9, delay, ease: 'power2.out', onUpdate: () => { el.textContent = String(Math.round(o.n)); } });
    }

    function revealPanel(panel: HTMLElement) {
      if (panel.dataset.revealed) return;
      panel.dataset.revealed = '1';
      if (!FX.reveal) { gsap.set(panel, { opacity: 1 }); return; }
      const rows = panel.querySelectorAll('.item');
      gsap.fromTo(panel, { opacity: 0, y: 70, rotateX: -12, transformPerspective: 900 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.9, ease: 'power3.out' });
      const pimg = panel.querySelector('.panel-media img');
      if (pimg) gsap.fromTo(pimg, { scale: 0.6, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 1, delay: 0.15, ease: 'back.out(1.8)' });
      gsap.fromTo(rows, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.05, delay: 0.25, ease: 'power2.out' });
      panel.querySelectorAll<HTMLElement>('.price b').forEach((b, i) => countUp(b, 0.3 + i * 0.05));
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { revealPanel(e.target as HTMLElement); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    disposers.push(() => io.disconnect());
    $$('.panel').forEach((p) => io.observe(p));

    const statsIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        statsIO.unobserve(e.target);
        if (e.target.classList.contains('menu-intro')) {
          gsap.fromTo(e.target.children, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' });
        } else {
          e.target.querySelectorAll<HTMLElement>('[data-count]').forEach((b, i) => {
            const target = totals[b.dataset.count!] || 0;
            const o = { n: 0 };
            gsap.fromTo(b.parentElement, { opacity: 0, y: 30, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, delay: i * 0.1, ease: 'back.out(1.6)' });
            gsap.to(o, { n: target, duration: 1.4, delay: i * 0.1, ease: 'power2.out', onUpdate: () => { b.textContent = String(Math.round(o.n)); } });
          });
        }
      });
    }, { threshold: 0.3 });
    disposers.push(() => statsIO.disconnect());
    statsIO.observe(q('.menu-intro')!);
    statsIO.observe(q('.stats')!);

    if (FX.tilt) $$('.panel').forEach((panel) => {
      const inner = panel.querySelector<HTMLElement>('.panel-inner')!;
      on(panel, 'mousemove', ((e: MouseEvent) => {
        const r = inner.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        inner.style.setProperty('--ry', ((px - 0.5) * 8).toFixed(2) + 'deg');
        inner.style.setProperty('--rx', ((0.5 - py) * 6).toFixed(2) + 'deg');
        inner.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      }) as EventListener);
      on(panel, 'mouseleave', () => { inner.style.setProperty('--rx', '0deg'); inner.style.setProperty('--ry', '0deg'); });
    });

    /* ================= FILTER ================= */
    let currentFilter = 'all';
    const segBtns = $$<HTMLButtonElement>('.seg-btn');
    const segPill = q('#seg-pill')!;
    const railPrev = q<HTMLButtonElement>('.rail-arrow.prev')!;
    const railNext = q<HTMLButtonElement>('.rail-arrow.next')!;
    function updateRailArrows() {
      const max = chipsEl.scrollWidth - chipsEl.clientWidth;
      railPrev.disabled = chipsEl.scrollLeft <= 4;
      railNext.disabled = chipsEl.scrollLeft >= max - 4;
    }

    function moveSegPill(btn: Element | null | undefined, instant?: boolean) {
      if (!btn || !alive) return;
      const parent = btn.parentElement!.getBoundingClientRect(), r = btn.getBoundingClientRect();
      gsap.to(segPill, { x: r.left - parent.left, width: r.width, duration: instant ? 0 : 0.45, ease: 'power3.out' });
    }

    function setFilter(filter: string) {
      if (filter === currentFilter) return;
      currentFilter = filter;
      segBtns.forEach((b) => b.classList.toggle('active', b.dataset.filter === filter));
      moveSegPill([...segBtns].find((b) => b.dataset.filter === filter));

      $$('.chip, .rail-label').forEach((c) => {
        const isOn = c.classList.contains('rail-label') ? filter === 'all' : (filter === 'all' || c.dataset.group === filter);
        c.style.display = isOn ? '' : 'none';
      });
      chipsEl.scrollLeft = 0;
      gsap.fromTo([...$$('.chip')].filter((c) => c.style.display !== 'none'),
        { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: 'power2.out', clearProps: 'transform', onComplete: updateRailArrows });

      const panels = [...$$('.panel')];
      const match = (p: HTMLElement) => filter === 'all' || p.dataset.group === filter;
      const leaving = panels.filter((p) => !p.classList.contains('hidden') && !match(p));
      const enter = (list: HTMLElement[]) => {
        list.forEach((p) => { p.classList.remove('hidden'); p.dataset.revealed = '1'; });
        gsap.fromTo(list, { opacity: 0, scale: 0.92, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'back.out(1.4)' });
        list.forEach((p) => p.querySelectorAll<HTMLElement>('.price b').forEach((b, i) => countUp(b, 0.2 + i * 0.04)));
      };
      if (leaving.length) {
        gsap.to(leaving, {
          opacity: 0, scale: 0.92, y: 20, duration: 0.3, stagger: 0.03, ease: 'power2.in',
          onComplete: () => { leaving.forEach((p) => p.classList.add('hidden')); enter(panels.filter(match)); },
        });
      } else {
        const entering = panels.filter((p) => p.classList.contains('hidden') && match(p));
        if (entering.length) enter(entering);
      }
    }
    segBtns.forEach((b) => on(b, 'click', () => setFilter(b.dataset.filter!)));
    const pillNow = () => moveSegPill(q('.seg-btn.active'), true);
    pillNow();
    later(pillNow, 50);
    on(window, 'load', pillNow);
    (document as any).fonts?.ready.then(() => pillNow());
    on(window, 'resize', pillNow);

    /* ---------- Category rail arrows ---------- */
    on(railPrev, 'click', () => chipsEl.scrollBy({ left: -chipsEl.clientWidth * 0.7, behavior: 'smooth' }));
    on(railNext, 'click', () => chipsEl.scrollBy({ left: chipsEl.clientWidth * 0.7, behavior: 'smooth' }));
    on(chipsEl, 'scroll', updateRailArrows, { passive: true });
    on(window, 'resize', updateRailArrows);
    on(window, 'load', updateRailArrows);
    later(updateRailArrows, 300);

    /* ---------- Header shrink, sticky filter, active chip ---------- */
    const header = q('.header')!;
    const filterBar = q('#filter-bar')!;
    on(window, 'scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
      const wasStuck = filterBar.classList.contains('stuck');
      filterBar.classList.toggle('stuck', filterBar.getBoundingClientRect().top < 120);
      if (wasStuck !== filterBar.classList.contains('stuck')) later(updateRailArrows, 380);
      let current: string | null = null;
      $$('.panel:not(.hidden)').forEach((p) => { if (p.getBoundingClientRect().top < window.innerHeight * 0.45) current = p.id; });
      $$('.chip').forEach((c) => c.classList.toggle('current', c.dataset.target === current));
      const cur = q('.chip.current');
      if (cur && cur.dataset.last !== '1') {
        $$('.chip').forEach((c) => (c.dataset.last = ''));
        cur.dataset.last = '1';
        chipsEl.scrollTo({ left: cur.offsetLeft - chipsEl.clientWidth / 2 + cur.clientWidth / 2, behavior: 'smooth' });
      }
    }, { passive: true });

    /* ---------- Hero entrance ---------- */
    gsap.from(q('.main-title')!.querySelectorAll('.title-line'), { y: 90, opacity: 0, rotate: -6, duration: 1.1, stagger: 0.15, ease: 'power4.out', delay: 0.2 });
    gsap.from(q('.side-title')!.querySelectorAll('.title-line'), { y: 90, opacity: 0, rotate: 6, duration: 1.1, stagger: 0.15, ease: 'power4.out', delay: 0.45 });
    gsap.from([q('.description'), q('.award-badge')], { y: 30, opacity: 0, duration: 0.8, stagger: 0.2, delay: 0.6, ease: 'power3.out' });
    gsap.from(q('.primary-btn'), { opacity: 0, scale: 0.8, duration: 0.8, delay: 0.75, ease: 'back.out(1.8)', clearProps: 'transform' });
    gsap.from([q('.carousel-cards'), q('.carousel-nav')], { y: 60, opacity: 0, duration: 0.9, stagger: 0.12, delay: 0.7, ease: 'back.out(1.6)' });
    gsap.from(q('.header')!.children, { y: -30, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' });

    /* ================= HERO 3D + GROUP SWITCH ================= */
    const berriesFG = q('.berries-container')!;
    const berriesBG = q('.berries-container-bg')!;
    const leavesBG = q('.leaves-container')!;
    const allBerries = $$<HTMLImageElement>('.berry');
    const cards = $$('.card');
    let isSwitching = false;
    let switchSpin = 0;
    const textures: any[] = [];

    on(modelViewer, 'load', (async () => {
      try {
        for (let i = 0; i < GROUPS.length; i++) {
          textures[i] = GROUPS[i].canTextureUrl ? await modelViewer.createTexture(GROUPS[i].canTextureUrl) : null;
        }
        const material = modelViewer.model && modelViewer.model.materials[0];
        if (material && material.pbrMetallicRoughness.baseColorTexture) {
          for (let i = GROUPS.length - 1; i >= 0; i--) {
            if (textures[i]) material.pbrMetallicRoughness.baseColorTexture.setTexture(textures[i]);
            await new Promise((r) => requestAnimationFrame(r));
          }
        }
      } catch (e) { console.warn('Texture preload failed', e); }
    }) as EventListener);

    function activateCard(card: HTMLElement) {
      if (isSwitching || card.classList.contains('active')) return;
      cards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      switchGroup(+card.dataset.gi!);
      setFilter(card.dataset.group!);
    }
    cards.forEach((card) => on(card, 'click', () => activateCard(card)));
    $$('.nav-arrow').forEach((btn) => on(btn, 'click', () => {
      const idx = [...cards].findIndex((c) => c.classList.contains('active'));
      const next = (idx + Number(btn.dataset.dir) + cards.length) % cards.length;
      activateCard(cards[next]);
    }));

    function switchGroup(gi: number) {
      if (isSwitching) return;
      isSwitching = true;
      const bg = GROUPS[gi].bg;
      const heroCenter = q('.hero-center')!;

      gsap.to(root, { '--bg-inner': bg.inner, '--bg-mid': bg.mid, '--bg-outer': bg.outer, duration: 1.5, ease: 'power2.inOut' } as any);

      const spinObj = { val: 0, blur: 0 };
      gsap.to(spinObj, {
        val: 360, blur: 15, duration: 0.6, ease: 'power2.in',
        onUpdate: () => { switchSpin = spinObj.val; modelViewer.style.filter = `blur(${spinObj.blur}px)`; },
        onComplete: () => {
          const tex = textures[gi];
          if (modelViewer.model && tex) {
            modelViewer.model.materials.forEach((m: any) => { if (m.pbrMetallicRoughness.baseColorTexture) m.pbrMetallicRoughness.baseColorTexture.setTexture(tex); });
          }
          gsap.to(spinObj, {
            val: 720, blur: 0, duration: 1.5, ease: 'back.out(0.7)',
            onUpdate: () => { switchSpin = spinObj.val; modelViewer.style.filter = `blur(${spinObj.blur}px)`; },
            onComplete: () => { switchSpin = 0; modelViewer.style.filter = 'none'; },
          });
        },
      });

      let completed = 0;
      allBerries.forEach((berry) => {
        const parent = berry.parentElement as HTMLElement;
        const centerX = parent.offsetWidth / 2 - berry.offsetLeft - berry.offsetWidth / 2;
        const centerY = parent.offsetHeight / 2 - berry.offsetTop - berry.offsetHeight / 2;
        const startAngle = parseFloat(berry.dataset.angle!) || 0;
        const nextBaseX = (Math.random() - 0.5) * 200;
        const nextBaseY = (Math.random() - 0.5) * 200;
        const shownRot = Math.sin(startAngle * Math.PI / 180) * 18;
        gsap.set(berry, { rotation: shownRot, x: parseFloat(berry.dataset.baseX!) || 0, y: parseFloat(berry.dataset.baseY!) || 0 });
        gsap.timeline()
          .to(berry, {
            x: centerX, y: centerY, rotation: shownRot + 180, scale: 0.1, opacity: 0, duration: 0.5, ease: 'power2.in',
            onComplete: () => { setFloater(berry, gi); heroCenter.style.zIndex = '50'; },
          })
          .to(berry, { duration: 0.3 })
          .to(berry, {
            onStart: () => { heroCenter.style.zIndex = '1'; },
            x: nextBaseX, y: nextBaseY, rotation: shownRot + 360, scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.5)',
            onComplete: () => {
              Object.assign(berry.dataset, { angle: startAngle, baseX: nextBaseX, baseY: nextBaseY, rx: 0, ry: 0 });
              if (++completed === allBerries.length) isSwitching = false;
            },
          });
      });
    }

    allBerries.forEach((b) => Object.assign(b.dataset, { rx: 0, ry: 0, angle: Math.random() * 360, baseX: 0, baseY: 0 }));

    const mouse = { x: 0, y: 0, px: -9999, py: -9999 };
    const currentMouse = { x: 0, y: 0 };
    on(window, 'mousemove', ((e: MouseEvent) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
      mouse.px = e.clientX; mouse.py = e.clientY;
    }) as EventListener);

    function animate() {
      if (!alive) return;
      const time = Date.now() * 0.001;
      const heroVisible = window.scrollY < window.innerHeight * 1.1;
      currentMouse.x += (mouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (mouse.y - currentMouse.y) * 0.05;

      if (heroVisible) {
        if (P3.enabled) modelViewer.cameraOrbit = `${currentMouse.x * 40 + switchSpin}deg ${90 + currentMouse.y * 20}deg 380%`;
        berriesFG.style.transform = `translate(${currentMouse.x * 60}px, ${currentMouse.y * 60}px)`;
        berriesBG.style.transform = `translate(${currentMouse.x * -30}px, ${currentMouse.y * -30}px)`;
        leavesBG.style.transform = `translate(${currentMouse.x * -15}px, ${currentMouse.y * -15}px)`;

        if (!isSwitching) {
          allBerries.forEach((berry, i) => {
            let targetRx = 0, targetRy = 0, speedMult = 1;
            if (FX.cursorRepel) {
              const r = berry.getBoundingClientRect();
              const diffX = mouse.px - (r.left + r.width / 2);
              const diffY = mouse.py - (r.top + r.height / 2);
              const distance = Math.sqrt(diffX * diffX + diffY * diffY) || 1;
              if (distance < 400) {
                const force = (400 - distance) / 400;
                targetRx = (diffX / distance) * force * -80;
                targetRy = (diffY / distance) * force * -80;
                speedMult = 1 + force * 5;
              }
            }
            let rx = parseFloat(berry.dataset.rx!) || 0;
            let ry = parseFloat(berry.dataset.ry!) || 0;
            let angle = parseFloat(berry.dataset.angle!) || 0;
            const baseX = parseFloat(berry.dataset.baseX!) || 0;
            const baseY = parseFloat(berry.dataset.baseY!) || 0;
            rx += (targetRx - rx) * 0.1;
            ry += (targetRy - ry) * 0.1;
            angle += 0.2 * speedMult;
            berry.dataset.rx = String(rx); berry.dataset.ry = String(ry); berry.dataset.angle = String(angle);
            const dur = [5, 7, 6, 8, 5.5, 6.5, 9, 11, 10][i % 9];
            const phase = (time + i * 0.7) * (Math.PI * 2 / dur);
            berry.style.transform = `translate(${rx + baseX}px, ${ry + baseY + Math.sin(phase) * 15}px) rotate(${Math.sin(angle * Math.PI / 180) * 18 + Math.cos(phase) * 6}deg)`;
          });
        }

        $$('.leaf').forEach((leaf, i) => {
          const dur = 10 + i * 2;
          const phase = (time + i * 1.2) * (Math.PI * 2 / dur);
          leaf.style.transform = `translate(${Math.cos(phase * 0.5) * 15}px, ${Math.sin(phase) * 20}px) rotate(${Math.sin(phase * 0.3) * 15}deg)`;
        });
      }
      rafId = requestAnimationFrame(animate);
    }
    animate();
    disposers.push(() => cancelAnimationFrame(rafId));

    /* ================= BUBBLES ================= */
    const BUB = CONFIG.bubbles;
    const bubblesContainer = q('#bubbles-container')!;
    function createBubble() {
      if (document.hidden || !alive) return;
      const bubble = document.createElement('img');
      bubble.src = BUB.imageUrl;
      bubble.className = 'bubble-img';
      bubble.alt = '';
      bubble.style.width = Math.random() * 20 + 10 + 'px';
      bubble.style.height = 'auto';
      bubble.style.left = Math.random() * 100 + '%';
      bubble.style.bottom = '-50px';
      bubble.style.opacity = String(Math.random() * 0.4 + 0.2);
      const duration = Math.random() * 6 + 4;
      bubble.style.animation = `arena-floatUpImg ${duration}s linear forwards`;
      bubblesContainer.appendChild(bubble);
      later(() => bubble.remove(), duration * 1000);
    }
    if (BUB.enabled && BUB.imageUrl) every(createBubble, Math.max(150, BUB.intervalMs || 400));
    disposers.push(() => { bubblesContainer.innerHTML = ''; });
  }, root);

  root.dataset.arenaReady = '1';

  return () => {
    alive = false;
    disposers.splice(0).reverse().forEach((d) => { try { d(); } catch { /* ignore */ } });
    ctx.revert();
    delete root.dataset.arenaReady;
  };
}
