import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, RotateCcw, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { refreshCafe, uploadMedia, useManagerMenu } from '@/lib/managerMenu';
import { deepMerge, mergeDesignSettings } from '@/menu-arena/buildArenaConfig';
import defaultsJson from '@/menu-arena/arena-default-design.json';
import type { MenuDesignSettings } from '@shared/menuDesignSettings';
import UnsavedChanges from '@/components/unsaved-changes';

type DesignResponse = {
  restaurantId: string;
  enabled: boolean;
  settings: MenuDesignSettings;
  updatedAt: string | null;
};

type GroupKey = 'food' | 'drinks';

const HEADING_FONTS = ['Galada', 'Playfair Display', 'Bebas Neue', 'Pacifico', 'Lobster', 'Outfit'];
const BODY_FONTS = ['Inter', 'Manrope', 'Outfit', 'DM Sans', 'Space Grotesk'];
const ARABIC_FONTS = ['Tajawal', 'Cairo', 'Noto Sans Arabic', 'Amiri', 'IBM Plex Sans Arabic'];

const FLOATER_POS = [
  { top: '25%', left: '30%' },
  { top: '60%', left: '42%' },
  { top: '30%', left: '62%' },
  { top: '15%', left: '48%' },
  { top: '75%', left: '20%' },
  { top: '45%', left: '75%' },
  { top: '15%', left: '40%' },
  { top: '50%', left: '55%' },
  { top: '80%', left: '35%' },
];

const TOKEN_CHIPS = ['{items}', '{categories}', '{minPrice}', '{food}', '{drinks}'];

const { categoryVisualsByTitle, categoryFallback, itemArabicByName: _itemArabicByName, ...designDefaults } = defaultsJson as any;
void _itemArabicByName;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Persist the floater URLs the editor shows (deep-merged defaults), so public matches admin. */
function withEffectiveFloaters(settings: MenuDesignSettings, effective: { groups?: Array<{ key: string; floaters?: Array<string | null> }> }): MenuDesignSettings {
  const next = clone(settings);
  const effGroups = Array.isArray(effective.groups) ? effective.groups : [];
  if (!effGroups.length) return next;
  const existingByKey = new Map((Array.isArray(next.groups) ? next.groups : []).map((g: any) => [g.key, g]));
  next.groups = effGroups.map((eg) => {
    const prev = existingByKey.get(eg.key) || { key: eg.key as 'food' | 'drinks' };
    const floaters = [...(eg.floaters || [])];
    while (floaters.length < 9) floaters.push(null);
    return { ...prev, key: eg.key as 'food' | 'drinks', floaters: floaters.slice(0, 9) };
  });
  return next;
}

function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  try {
    const L1 = lum(a);
    const L2 = lum(b);
    const hi = Math.max(L1, L2);
    const lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  } catch {
    return 1;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Section({
  title,
  hint,
  onReset,
  children,
}: {
  title: string;
  hint?: string;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="manager-panel p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
        </div>
        {onReset && (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset section
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function ImageSlot({
  label,
  url,
  onChange,
  accept = 'image/png,image/jpeg,image/gif,image/webp',
}: {
  label: string;
  url: string | null | undefined;
  onChange: (url: string | null) => void;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadMedia(file));
    } catch (e) {
      toast({ title: 'Upload failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }
  const isImage = url && !url.toLowerCase().endsWith('.glb');
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        {isImage ? <img src={url!} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted" /> : null}
        {url && !isImage ? <span className="text-xs text-muted-foreground truncate max-w-[12rem]">{url}</span> : null}
        <label className="manager-upload">
          <Upload className="w-4 h-4" />
          {busy ? 'Uploading…' : 'Upload'}
          <input className="sr-only" type="file" accept={accept} disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {url ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FloaterMap({
  urls,
  onSlot,
}: {
  urls: (string | null)[];
  onSlot: (index: number, url: string | null) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="relative aspect-[4/3] rounded-xl bg-zinc-900 overflow-hidden border border-border">
        {FLOATER_POS.map((pos, i) => (
          <button
            key={i}
            type="button"
            title={`Slot ${i + 1}`}
            className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-primary/80 text-[10px] font-bold text-primary-foreground"
            style={{ top: pos.top, left: pos.left }}
            onClick={() => document.getElementById(`floater-file-${i}`)?.click()}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="space-y-1">
            <div className="aspect-square rounded-lg bg-muted overflow-hidden flex items-center justify-center">
              {urls[i] ? <img src={urls[i]!} alt="" className="w-full h-full object-contain" /> : <span className="text-xs text-muted-foreground">{i + 1}</span>}
            </div>
            <input
              id={`floater-file-${i}`}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  onSlot(i, await uploadMedia(file));
                } catch {
                  /* toast handled by caller via catch in page if needed */
                }
                e.target.value = '';
              }}
            />
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => document.getElementById(`floater-file-${i}`)?.click()}>
                Replace
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onSlot(i, null)}>
                Clear
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMenuDesign() {
  const menu = useManagerMenu();
  const cafe = menu.data?.restaurant;
  const { toast } = useToast();
  const designQuery = useQuery<DesignResponse>({
    // Second key scopes React Query cache per location; fetch still hits /api/admin/menu-design
    // (default queryFn joins keys into a URL, so we override it).
    queryKey: ['/api/admin/menu-design', cafe?.id],
    enabled: !!cafe?.id,
    staleTime: 0,
    queryFn: async () => (await apiRequest('GET', '/api/admin/menu-design')).json() as Promise<DesignResponse>,
  });

  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState<MenuDesignSettings>({});
  const [baseline, setBaseline] = useState('');
  const [error, setError] = useState('');
  const [groupTab, setGroupTab] = useState<GroupKey>('food');

  useEffect(() => {
    if (!designQuery.data) return;
    // Ignore stale responses if the café context changed mid-flight.
    if (cafe?.id && designQuery.data.restaurantId !== cafe.id) return;
    setEnabled(designQuery.data.enabled);
    const next = clone(designQuery.data.settings || {});
    setSettings(next);
    setBaseline(JSON.stringify({ enabled: designQuery.data.enabled, settings: next }));
  }, [designQuery.data, cafe?.id]);

  // mergeDesignSettings (not deepMerge): partial groups[] from floater saves must not wipe bg/card.
  const effective = useMemo(() => mergeDesignSettings(clone(designDefaults), settings) as any, [settings]);
  const dirty = baseline !== '' && JSON.stringify({ enabled, settings }) !== baseline;

  function patchSettings(patch: MenuDesignSettings) {
    setSettings((prev) => deepMerge(clone(prev), patch) as MenuDesignSettings);
  }

  function setPath(section: keyof MenuDesignSettings, value: unknown) {
    setSettings((prev) => ({ ...prev, [section]: value } as MenuDesignSettings));
  }

  function resetSection(key: keyof MenuDesignSettings) {
    setSettings((prev) => {
      const next = clone(prev);
      delete (next as any)[key];
      return next;
    });
  }

  function resetAll() {
    setSettings({});
  }

  function updateGroup(key: GroupKey, patch: Record<string, unknown>) {
    const baseGroups = clone(effective.groups) as any[];
    const idx = baseGroups.findIndex((g) => g.key === key);
    if (idx < 0) return;
    baseGroups[idx] = deepMerge(baseGroups[idx], patch);
    setPath('groups', baseGroups);
  }

  function updateStat(index: number, patch: Record<string, unknown>) {
    const stats = clone(effective.stats) as any[];
    stats[index] = { ...stats[index], ...patch };
    setPath('stats', stats);
  }

  function updateBack(index: number, patch: Record<string, unknown>) {
    const backs = clone(effective.backFloaters) as any[];
    backs[index] = { ...backs[index], ...patch };
    setPath('backFloaters', backs);
  }

  function updateCategory(id: string, patch: Record<string, unknown>) {
    setSettings((prev) => {
      const categories = { ...(prev.categories || {}) };
      const next = { ...(categories[id] || {}), ...patch };
      for (const [k, v] of Object.entries(next)) if (v === undefined) delete (next as any)[k];
      if (Object.keys(next).length === 0) delete categories[id];
      else categories[id] = next as any;
      return { ...prev, categories };
    });
  }

  const save = useMutation({
    mutationKey: ['cafe-menu-write'],
    mutationFn: async () => {
      // Admin UI deep-merges defaults for display; without this, Save can omit floaters and
      // public blendFloaters still fills empty slots from live menu photos (pizza, etc.).
      const payload = withEffectiveFloaters(settings, effective);
      return (await apiRequest('PUT', '/api/admin/menu-design', { enabled, settings: payload })).json() as Promise<DesignResponse>;
    },
    onSuccess: (result) => {
      setEnabled(result.enabled);
      const next = clone(result.settings || {});
      setSettings(next);
      setBaseline(JSON.stringify({ enabled: result.enabled, settings: next }));
      setError('');
      queryClient.setQueryData(['/api/admin/menu-design', result.restaurantId], result);
      void refreshCafe('menu');
      void queryClient.invalidateQueries({ queryKey: ['/api/menu/public'] });
      toast({
        title: 'Menu design saved',
        description: `${cafe?.name || 'This location'}’s customer menu will pick this up on the next refresh.`,
      });
    },
    onError: (e: Error) => {
      setError(e.message);
      toast({ title: 'Could not save design', description: e.message, variant: 'destructive' });
    },
  });

  const accentContrast = contrastRatio(effective.theme?.accent || '#fbcfe8', effective.theme?.accentInk || '#011d17');
  const groups = Array.isArray(effective.groups) ? (effective.groups as any[]) : [];
  const group = groups.find((g) => g.key === groupTab) || groups[0];

  if (menu.isLoading || designQuery.isLoading) return <p role="status">Loading menu design…</p>;
  if (menu.isError || designQuery.isError) {
    return (
      <div className="manager-panel p-8">
        Could not load menu design.{' '}
        <Button onClick={() => { void menu.refetch(); void designQuery.refetch(); }}>Try again</Button>
      </div>
    );
  }
  if (!cafe) return <div className="manager-panel p-8">Set up your café profile first.</div>;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <UnsavedChanges dirty={dirty} />
      <div className="manager-section-heading">
        <div>
          <p className="manager-eyebrow">CUSTOMER MENU LOOK · THIS LOCATION ONLY</p>
          <h1 className="text-3xl font-bold">Menu design · {cafe.name}</h1>
          <p className="text-muted-foreground">
            Hero, theme, images, categories, and Arena on/off are saved for {cafe.name} only — not shared with other locations.
            Only what you change is stored; the rest follows shared defaults plus this café&apos;s live menu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={`/menu/${cafe.id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open customer menu
            </a>
          </Button>
          <Button type="submit" disabled={save.isPending || !dirty}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? 'Saving…' : 'Save design'}
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="manager-panel p-4 text-destructive">{error}</p>}

      <Section title="1. Arena style" hint={`Arena is the default public menu for ${cafe.name}. Turn it off only if this location should use the classic page.`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="arena-enabled" />
            <Label htmlFor="arena-enabled">{enabled ? 'Arena menu is on' : 'Classic menu (Arena off)'}</Label>
          </div>
          <Button type="button" variant="outline" onClick={resetAll}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset all to defaults
          </Button>
        </div>
      </Section>

      <Section title="2. Branding & SEO" onReset={() => { resetSection('seo'); resetSection('brand'); }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Page title">
            <Input value={effective.seo.title} onChange={(e) => patchSettings({ seo: { title: e.target.value } })} />
          </Field>
          <Field label="Logo alt text">
            <Input value={effective.brand.logoAlt} onChange={(e) => patchSettings({ brand: { logoAlt: e.target.value } })} />
          </Field>
        </div>
        <Field label="Meta description">
          <Textarea value={effective.seo.description} onChange={(e) => patchSettings({ seo: { description: e.target.value } })} rows={3} />
        </Field>
        <ImageSlot
          label="Logo override (empty = café logo)"
          url={settings.brand?.logoUrl === undefined ? null : settings.brand.logoUrl}
          onChange={(logoUrl) => patchSettings({ brand: { logoUrl } })}
        />
        <p className="text-xs text-muted-foreground">Leave cleared to use the café profile logo on the customer menu.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Social label">
            <Input value={effective.brand.socialLabel} onChange={(e) => patchSettings({ brand: { socialLabel: e.target.value } })} />
          </Field>
          <Field label="Social URL">
            <Input value={effective.brand.socialUrl || ''} onChange={(e) => patchSettings({ brand: { socialUrl: e.target.value || null } })} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={!!effective.brand.showSocial} onCheckedChange={(showSocial) => patchSettings({ brand: { showSocial } })} id="show-social" />
          <Label htmlFor="show-social">Show social link</Label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Footer text">
            <Input value={effective.brand.footerText} onChange={(e) => patchSettings({ brand: { footerText: e.target.value } })} />
          </Field>
          <Field label="Footer note">
            <Input value={effective.brand.footerNote} onChange={(e) => patchSettings({ brand: { footerNote: e.target.value } })} />
          </Field>
        </div>
      </Section>

      <Section title="3. Theme" onReset={() => resetSection('theme')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Accent colour">
            <Input type="color" className="h-10 p-1 w-full" value={effective.theme.accent} onChange={(e) => patchSettings({ theme: { accent: e.target.value } })} />
          </Field>
          <Field label="Text on accent">
            <Input type="color" className="h-10 p-1 w-full" value={effective.theme.accentInk} onChange={(e) => patchSettings({ theme: { accentInk: e.target.value } })} />
          </Field>
        </div>
        {accentContrast < 4.5 && (
          <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
            Contrast ratio {accentContrast.toFixed(2)}:1 — aim for at least 4.5:1 for readable text on the accent.
          </p>
        )}
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Heading font">
            <select className="manager-select w-full" value={effective.theme.fontHeading} onChange={(e) => patchSettings({ theme: { fontHeading: e.target.value } })}>
              {HEADING_FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Body font">
            <select className="manager-select w-full" value={effective.theme.fontBody} onChange={(e) => patchSettings({ theme: { fontBody: e.target.value } })}>
              {BODY_FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Arabic font">
            <select className="manager-select w-full" value={effective.theme.fontArabic} onChange={(e) => patchSettings({ theme: { fontArabic: e.target.value } })}>
              {ARABIC_FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="4. Hero" onReset={() => resetSection('hero')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title line 1">
            <Input value={effective.hero.titleLine1} onChange={(e) => patchSettings({ hero: { titleLine1: e.target.value } })} />
          </Field>
          <Field label="Title line 2">
            <Input value={effective.hero.titleLine2} onChange={(e) => patchSettings({ hero: { titleLine2: e.target.value } })} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={effective.hero.description} onChange={(e) => patchSettings({ hero: { description: e.target.value } })} rows={3} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Button label">
            <Input value={effective.hero.ctaLabel} onChange={(e) => patchSettings({ hero: { ctaLabel: e.target.value } })} />
          </Field>
          <Field label="Button icon">
            <Input value={effective.hero.ctaIcon} onChange={(e) => patchSettings({ hero: { ctaIcon: e.target.value } })} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={!!effective.hero.showBadge} onCheckedChange={(showBadge) => patchSettings({ hero: { showBadge } })} id="show-badge" />
          <Label htmlFor="show-badge">Show badge</Label>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Badge icon">
            <Input value={effective.hero.badgeIcon} onChange={(e) => patchSettings({ hero: { badgeIcon: e.target.value } })} />
          </Field>
          <Field label="Badge title">
            <Input value={effective.hero.badgeTitle} onChange={(e) => patchSettings({ hero: { badgeTitle: e.target.value } })} />
          </Field>
          <Field label="Badge subtitle">
            <Input value={effective.hero.badgeSubtitle} onChange={(e) => patchSettings({ hero: { badgeSubtitle: e.target.value } })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOKEN_CHIPS.map((t) => (
            <button
              key={t}
              type="button"
              className="manager-chip text-xs"
              onClick={() => patchSettings({ hero: { badgeSubtitle: `${effective.hero.badgeSubtitle} ${t}`.trim() } })}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Side line 1">
            <Input value={effective.hero.sideLine1} onChange={(e) => patchSettings({ hero: { sideLine1: e.target.value } })} />
          </Field>
          <Field label="Side line 2">
            <Input value={effective.hero.sideLine2} onChange={(e) => patchSettings({ hero: { sideLine2: e.target.value } })} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={!!effective.hero.showScrollCue} onCheckedChange={(showScrollCue) => patchSettings({ hero: { showScrollCue } })} id="scroll-cue" />
          <Label htmlFor="scroll-cue">Show scroll cue</Label>
        </div>
        <Field label="Scroll cue label">
          <Input value={effective.hero.scrollCueLabel} onChange={(e) => patchSettings({ hero: { scrollCueLabel: e.target.value } })} />
        </Field>
      </Section>

      <Section title="5. Groups & cards" hint="Food and drinks panels, rail labels, gradient, card art, and can texture." onReset={() => resetSection('groups')}>
        <div className="flex gap-2">
          {(['food', 'drinks'] as GroupKey[]).map((k) => (
            <Button key={k} type="button" variant={groupTab === k ? 'default' : 'outline'} onClick={() => setGroupTab(k)}>
              {k === 'food' ? 'Food' : 'Drinks'}
            </Button>
          ))}
        </div>
        {group && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Label">
                <Input value={group.label} onChange={(e) => updateGroup(groupTab, { label: e.target.value })} />
              </Field>
              <Field label="Rail label">
                <Input value={group.railLabel} onChange={(e) => updateGroup(groupTab, { railLabel: e.target.value })} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {(['inner', 'mid', 'outer'] as const).map((k) => (
                <Field key={k} label={`Background ${k}`}>
                  <Input
                    type="color"
                    className="h-10 p-1 w-full"
                    value={group.bg?.[k] || '#000000'}
                    onChange={(e) => updateGroup(groupTab, { bg: { ...group.bg, [k]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
            <div
              className="h-10 rounded-lg border"
              style={{ background: `linear-gradient(90deg, ${group.bg.inner}, ${group.bg.mid}, ${group.bg.outer})` }}
              aria-hidden
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Card label">
                <Input value={group.card.label} onChange={(e) => updateGroup(groupTab, { card: { ...group.card, label: e.target.value } })} />
              </Field>
              <Field label="Count suffix">
                <Input value={group.card.countSuffix} onChange={(e) => updateGroup(groupTab, { card: { ...group.card, countSuffix: e.target.value } })} />
              </Field>
            </div>
            <ImageSlot
              label="Card image"
              url={group.card.imageUrl}
              onChange={(imageUrl) => updateGroup(groupTab, { card: { ...group.card, imageUrl } })}
            />
            <ImageSlot
              label="Can texture"
              url={group.canTextureUrl}
              onChange={(canTextureUrl) => updateGroup(groupTab, { canTextureUrl })}
              accept="image/png,image/jpeg,image/webp"
            />
          </div>
        )}
      </Section>

      <Section title="6. Floating images" hint="Nine floater slots per group, plus four background leaves." onReset={() => { resetSection('groups'); resetSection('backFloaters'); }}>
        <div className="flex gap-2 mb-2">
          {(['food', 'drinks'] as GroupKey[]).map((k) => (
            <Button key={k} type="button" variant={groupTab === k ? 'default' : 'outline'} onClick={() => setGroupTab(k)}>
              {k === 'food' ? 'Food floaters' : 'Drinks floaters'}
            </Button>
          ))}
        </div>
        <FloaterMap
          urls={(group?.floaters || []).map((u: string | null) => u)}
          onSlot={(index, url) => {
            const floaters = [...(group.floaters || Array(9).fill(null))];
            floaters[index] = url;
            while (floaters.length < 9) floaters.push(null);
            updateGroup(groupTab, { floaters: floaters.slice(0, 9) });
          }}
        />
        <h3 className="font-semibold pt-2">Background floaters</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {(effective.backFloaters as any[]).map((back, i) => (
            <div key={i} className="manager-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Background {i + 1}</span>
                <Switch checked={!!back.enabled} onCheckedChange={(enabled) => updateBack(i, { enabled })} />
              </div>
              <ImageSlot label="Image" url={back.imageUrl} onChange={(imageUrl) => updateBack(i, { imageUrl })} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="7. 3D & effects" onReset={() => { resetSection('product3d'); resetSection('bubbles'); resetSection('effects'); }}>
        <div className="flex items-center gap-3">
          <Switch checked={!!effective.product3d.enabled} onCheckedChange={(enabled) => patchSettings({ product3d: { enabled } })} id="product3d" />
          <Label htmlFor="product3d">Show 3D can</Label>
        </div>
        <ImageSlot
          label="3D model (.glb)"
          url={effective.product3d.modelUrl}
          onChange={(modelUrl) => patchSettings({ product3d: { modelUrl } })}
          accept=".glb,model/gltf-binary"
        />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Alt text">
            <Input value={effective.product3d.alt} onChange={(e) => patchSettings({ product3d: { alt: e.target.value } })} />
          </Field>
          <Field label={`Exposure (${effective.product3d.exposure})`}>
            <Input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={effective.product3d.exposure}
              onChange={(e) => patchSettings({ product3d: { exposure: Number(e.target.value) } })}
            />
          </Field>
          <Field label={`Tilt ° (${effective.product3d.tiltDeg})`}>
            <Input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={effective.product3d.tiltDeg}
              onChange={(e) => patchSettings({ product3d: { tiltDeg: Number(e.target.value) } })}
            />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={!!effective.bubbles.enabled} onCheckedChange={(enabled) => patchSettings({ bubbles: { enabled } })} id="bubbles" />
          <Label htmlFor="bubbles">Bubbles</Label>
        </div>
        <ImageSlot label="Bubble image" url={effective.bubbles.imageUrl} onChange={(imageUrl) => patchSettings({ bubbles: { imageUrl } })} />
        <Field label={`Bubble interval ms (${effective.bubbles.intervalMs})`}>
          <Input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={effective.bubbles.intervalMs}
            onChange={(e) => patchSettings({ bubbles: { intervalMs: Number(e.target.value) } })}
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              ['reveal', 'Reveal animations'],
              ['countUp', 'Count-up stats'],
              ['tilt', 'Panel tilt'],
              ['cursorRepel', 'Cursor repel floaters'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <Switch
                checked={!!effective.effects[key]}
                onCheckedChange={(v) => patchSettings({ effects: { [key]: v } })}
                id={`fx-${key}`}
              />
              <Label htmlFor={`fx-${key}`}>{label}</Label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="8. Menu section" onReset={() => { resetSection('marquee'); resetSection('menuIntro'); resetSection('stats'); resetSection('labels'); resetSection('filters'); }}>
        <div className="flex items-center gap-3">
          <Switch checked={!!effective.marquee.enabled} onCheckedChange={(enabled) => patchSettings({ marquee: { enabled } })} id="marquee" />
          <Label htmlFor="marquee">Marquee on</Label>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Marquee mode">
            <select
              className="manager-select w-full"
              value={effective.marquee.mode}
              onChange={(e) => patchSettings({ marquee: { mode: e.target.value as 'categories' | 'custom' } })}
            >
              <option value="categories">Categories</option>
              <option value="custom">Custom words</option>
            </select>
          </Field>
          <Field label="Separator">
            <Input value={effective.marquee.separator} onChange={(e) => patchSettings({ marquee: { separator: e.target.value } })} />
          </Field>
          <Field label="Custom words (comma-separated)">
            <Input
              value={(effective.marquee.customItems || []).join(', ')}
              onChange={(e) =>
                patchSettings({
                  marquee: {
                    customItems: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Intro title">
            <Input value={effective.menuIntro.title} onChange={(e) => patchSettings({ menuIntro: { title: e.target.value } })} />
          </Field>
          <Field label="Intro Arabic title">
            <Input value={effective.menuIntro.titleAr} onChange={(e) => patchSettings({ menuIntro: { titleAr: e.target.value } })} dir="rtl" />
          </Field>
          <Field label="Intro subtitle">
            <Input value={effective.menuIntro.subtitle} onChange={(e) => patchSettings({ menuIntro: { subtitle: e.target.value } })} />
          </Field>
        </div>
        <div className="space-y-3">
          {(effective.stats as any[]).map((stat, i) => (
            <div key={stat.key} className="flex flex-wrap items-center gap-3">
              <Switch checked={!!stat.enabled} onCheckedChange={(enabled) => updateStat(i, { enabled })} />
              <Input className="max-w-xs" value={stat.label} onChange={(e) => updateStat(i, { label: e.target.value })} />
              <span className="text-xs text-muted-foreground">{stat.key}</span>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="ITEMS label">
            <Input value={effective.labels.itemsUpper} onChange={(e) => patchSettings({ labels: { itemsUpper: e.target.value } })} />
          </Field>
          <Field label="items label">
            <Input value={effective.labels.itemsLower} onChange={(e) => patchSettings({ labels: { itemsLower: e.target.value } })} />
          </Field>
          <Field label="Sold out label">
            <Input value={effective.labels.soldOut} onChange={(e) => patchSettings({ labels: { soldOut: e.target.value } })} />
          </Field>
        </div>
        <Field label="All filter label">
          <Input value={effective.filters.allLabel} onChange={(e) => patchSettings({ filters: { allLabel: e.target.value } })} />
        </Field>
      </Section>

      <Section title="9. Categories" hint={`Group, Arabic name, colour, banner, and tile icon for each category on ${cafe.name}. Other locations keep their own overrides.`} onReset={() => resetSection('categories')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3">Arabic</th>
                <th className="py-2 pr-3">Colour</th>
                <th className="py-2 pr-3">Banner</th>
                <th className="py-2">Icon</th>
              </tr>
            </thead>
            <tbody>
              {(menu.data?.categories || [])
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((cat) => {
                  const byTitle = (categoryVisualsByTitle as any)[cat.title.toLowerCase()] || {};
                  const ov = settings.categories?.[cat.id] || {};
                  const hue = ov.hue ?? byTitle.hue ?? (categoryFallback as any).hue;
                  const nameAr = ov.nameAr ?? byTitle.nameAr ?? '';
                  const groupVal = (ov.group ?? byTitle.group ?? 'food') as GroupKey;
                  const bannerUrl = ov.bannerUrl !== undefined ? ov.bannerUrl : byTitle.bannerUrl ?? null;
                  const iconUrl = ov.iconUrl !== undefined ? ov.iconUrl : byTitle.iconUrl ?? null;
                  return (
                    <tr key={cat.id} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-3 font-medium whitespace-nowrap">{cat.title}</td>
                      <td className="py-3 pr-3">
                        <select
                          className="manager-select"
                          value={groupVal}
                          onChange={(e) => updateCategory(cat.id, { group: e.target.value as GroupKey })}
                        >
                          <option value="food">food</option>
                          <option value="drinks">drinks</option>
                        </select>
                      </td>
                      <td className="py-3 pr-3">
                        <Input className="min-w-[8rem]" dir="rtl" value={nameAr} onChange={(e) => updateCategory(cat.id, { nameAr: e.target.value })} />
                      </td>
                      <td className="py-3 pr-3">
                        <Input type="color" className="h-9 w-14 p-1" value={hue} onChange={(e) => updateCategory(cat.id, { hue: e.target.value })} />
                      </td>
                      <td className="py-3 pr-3">
                        <ImageSlot label="" url={bannerUrl} onChange={(bannerUrl) => updateCategory(cat.id, { bannerUrl })} />
                      </td>
                      <td className="py-3">
                        <ImageSlot label="" url={iconUrl} onChange={(iconUrl) => updateCategory(cat.id, { iconUrl })} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="manager-save-bar">
        <span className="text-sm text-muted-foreground">{dirty ? 'You have unpublished design changes.' : 'Design is saved.'}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || save.isPending}
            onClick={() => {
              if (!designQuery.data) return;
              setEnabled(designQuery.data.enabled);
              setSettings(clone(designQuery.data.settings || {}));
              setError('');
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save design'}
          </Button>
        </div>
      </div>
    </form>
  );
}
