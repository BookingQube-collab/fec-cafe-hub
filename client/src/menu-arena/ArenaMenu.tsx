// Customer menu in the approved "Arena" design. Rendered by customer-menu.tsx when the café's design is enabled.
import { useEffect, useMemo, useRef } from 'react';
import markup from './arena-markup.html?raw';
import './arena.css';
import './arena-chrome.css';
import { mountArenaMenu } from './arena-engine';
import type { MenuConfig } from './config';

const safeJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function fontsHref(t: MenuConfig['theme']) {
  const fam = (f: string) => f.trim().replace(/ /g, '+');
  return 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900'
    + `&family=${fam(t.fontBody)}:wght@400;500;600;700&family=Manrope:wght@400;500;700;800`
    + `&family=${fam(t.fontHeading)}&family=${fam(t.fontArabic)}:wght@400;500;700&display=swap`;
}

export default function ArenaMenu({ config }: { config: MenuConfig }) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Compare by content: background refetches create new objects but must not remount the page.
  const json = safeJson(config);
  // Markup is static; the JSON script is non-executing data (CSP-safe) and lets tests read the config.
  const html = useMemo(() => markup.replace('__MENU_CONFIG__', () => json), [json]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const config = JSON.parse(json) as MenuConfig;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const prevTitle = document.title;
    const prevOverflowX = document.body.style.overflowX;
    document.title = config.seo.title;
    document.body.style.overflowX = 'hidden';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontsHref(config.theme);
    link.dataset.arenaFonts = '1';
    document.head.appendChild(link);

    // Draco decoder is self-hosted (can.glb uses KHR_draco_mesh_compression); CSP blocks gstatic.
    const globalMv = (self as typeof self & { ModelViewerElement?: { dracoDecoderLocation?: string } });
    globalMv.ModelViewerElement = globalMv.ModelViewerElement || {};
    globalMv.ModelViewerElement.dracoDecoderLocation = '/assets/arena/decoders/';
    import('@google/model-viewer').then(() => {
      const ModelViewerElement = customElements.get('model-viewer') as (CustomElementConstructor & { dracoDecoderLocation?: string }) | undefined;
      if (ModelViewerElement) ModelViewerElement.dracoDecoderLocation = '/assets/arena/decoders/';
      if (!cancelled) cleanup = mountArenaMenu(root, config);
    });

    return () => {
      cancelled = true;
      cleanup?.();
      link.remove();
      document.title = prevTitle;
      document.body.style.overflowX = prevOverflowX;
      window.scrollTo(0, 0);
    };
  }, [json]);

  return <div ref={rootRef} className="arena-root" dangerouslySetInnerHTML={{ __html: html }} />;
}
