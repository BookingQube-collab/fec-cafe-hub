import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { gsap } from 'gsap';

export function useMenuMotionPreference() {
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem('cafe-menu-motion-paused') === '1'; } catch { return false; }
  });
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(preference.matches);
    const visibilityChanged = () => setPageVisible(!document.hidden);
    preference.addEventListener('change', changed);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => { preference.removeEventListener('change', changed); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, []);
  useEffect(() => {
    try { localStorage.setItem('cafe-menu-motion-paused', paused ? '1' : '0'); } catch { /* The toggle also works without storage. */ }
  }, [paused]);
  return { enabled: !paused && !reduced, pageVisible, paused, reduced, toggle: () => setPaused(value => !value) };
}

export function useMenuAnimation(scope: RefObject<HTMLDivElement>, detail: HTMLDivElement | null, enabled: boolean, cafeId: string | undefined, menuKey: string, detailKey: string | null) {
  useLayoutEffect(() => {
    if (!enabled || !scope.current || !cafeId) return;
    const context = gsap.context(() => {
      gsap.from('.guest-top, .guest-welcome, .guest-search, .guest-categories', { y: 18, opacity: 0, duration: .65, stagger: .09, ease: 'power3.out', clearProps: 'transform,opacity' });
    }, scope);
    return () => context.revert();
  }, [enabled, cafeId, scope]);

  useLayoutEffect(() => {
    if (!enabled || !scope.current) return;
    const cards = Array.from(scope.current.querySelectorAll<HTMLElement>('.guest-item'));
    if (!cards.length) return;
    const context = gsap.context(() => { gsap.set(cards, { opacity: 0 }); }, scope);
    const observer = new IntersectionObserver(entries => {
      entries.forEach((entry, index) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        context.add(() => {
          gsap.to(entry.target, { opacity: 1, duration: .45, delay: Math.min(index * .055, .2), ease: 'power2.out', clearProps: 'opacity' });
          gsap.from(entry.target.querySelectorAll('.guest-item-body, .guest-image-open'), { y: 19, duration: .7, delay: Math.min(index * .055, .2), stagger: .07, ease: 'power3.out', clearProps: 'transform' });
        });
      });
    }, { threshold: .08 });
    cards.forEach(card => observer.observe(card));
    return () => { observer.disconnect(); context.revert(); };
  }, [enabled, menuKey, cafeId, scope]);

  useLayoutEffect(() => {
    if (!enabled || !detailKey || !detail) return;
    const context = gsap.context(() => {
      // Animate decoration, never move choice controls beneath a finger.
      gsap.from('.guest-detail-image .guest-art-plate, .guest-detail-image > img, .guest-detail-description, .guest-detail-tags, .guest-detail-note, .guest-customization-note', { y: 12, opacity: 0, duration: .4, stagger: .035, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('.guest-detail-footer', { opacity: 0, duration: .55, delay: .25, clearProps: 'opacity' });
    }, detail);
    return () => context.revert();
  }, [enabled, detailKey, detail]);
}
