import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { site as legacySite } from '../../site.config.mjs';

export type SettingSource = 'new' | 'legacy' | 'default';

export type SidebarNavId = 'essay' | 'bits' | 'memo' | 'archive' | 'about';
type HeroPresetId = 'default' | 'minimal' | 'none';

export interface SidebarNavItem {
  id: SidebarNavId;
  label: string;
  visible: boolean;
  order: number;
}

export interface SiteSettings {
  title: string;
  brandTitle: string;
  description: string;
  author: string;
  authorAvatar: string;
  defaultLocale: string;
}

export interface HomeSettings {
  quote: string;
  sidebarNav: SidebarNavItem[];
  heroPresetId: HeroPresetId;
}

export interface UiSettings {
  codeBlock: {
    showLineNumbers: boolean;
  };
  readingMode: {
    showEntry: boolean;
  };
}

export interface ThemeSettings {
  site: SiteSettings;
  home: HomeSettings;
  ui: UiSettings;
}

export interface ThemeSettingsSources {
  site: {
    title: SettingSource;
    brandTitle: SettingSource;
    description: SettingSource;
    author: SettingSource;
    authorAvatar: SettingSource;
    defaultLocale: SettingSource;
  };
  home: {
    quote: SettingSource;
    sidebarNav: SettingSource;
    heroPresetId: SettingSource;
  };
  ui: {
    codeBlockShowLineNumbers: SettingSource;
    readingModeShowEntry: SettingSource;
  };
}

export interface ThemeSettingsResolved {
  settings: ThemeSettings;
  sources: ThemeSettingsSources;
}

const SETTINGS_DIR = join(process.cwd(), 'src', 'data', 'settings');

const LEGACY_QUOTE = 'A minimal Astro theme\nfor essays, notes, and docs.\nDesigned for reading,\nopen-source.';

const LEGACY_NAV: SidebarNavItem[] = [
  { id: 'essay', label: '随笔', visible: true, order: 1 },
  { id: 'bits', label: '絮语', visible: true, order: 2 },
  { id: 'memo', label: '小记', visible: true, order: 3 },
  { id: 'archive', label: '归档', visible: true, order: 4 },
  { id: 'about', label: '关于', visible: true, order: 5 }
];

const DEFAULT_SITE: SiteSettings = {
  title: 'Whono',
  brandTitle: 'Whono',
  description: '一个 Astro 主题的展示站：轻量、可维护、可复用。',
  author: 'Whono',
  authorAvatar: 'author/avatar.webp',
  defaultLocale: 'zh-CN'
};

const HERO_PRESETS: ReadonlySet<HeroPresetId> = new Set(['default', 'minimal', 'none']);
const NAV_IDS: ReadonlySet<SidebarNavId> = new Set(['essay', 'bits', 'memo', 'archive', 'about']);

const SIDEBAR_HREFS: Record<SidebarNavId, string> = {
  essay: '/essay/',
  bits: '/bits/',
  memo: '/memo/',
  archive: '/archive/',
  about: '/about/'
};

let cachedSettings: ThemeSettingsResolved | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

const asNonEmptyString = (value: unknown): string | undefined => {
  const next = asString(value);
  return next ? next : undefined;
};

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asNavId = (value: unknown): SidebarNavId | undefined => {
  if (typeof value !== 'string') return undefined;
  return NAV_IDS.has(value as SidebarNavId) ? (value as SidebarNavId) : undefined;
};

const asHeroPresetId = (value: unknown): HeroPresetId | undefined => {
  if (typeof value !== 'string') return undefined;
  return HERO_PRESETS.has(value as HeroPresetId) ? (value as HeroPresetId) : undefined;
};

const resolveValue = <T>(
  nextValue: T | undefined,
  legacyValue: T | undefined,
  defaultValue: T
): { value: T; source: SettingSource } => {
  if (nextValue !== undefined) return { value: nextValue, source: 'new' };
  if (legacyValue !== undefined) return { value: legacyValue, source: 'legacy' };
  return { value: defaultValue, source: 'default' };
};

const readSettingsObject = (name: 'site' | 'home' | 'ui'): Record<string, unknown> | undefined => {
  const filePath = join(SETTINGS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return undefined;
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return undefined;
    return parsed;
  } catch (error) {
    console.warn(`[astro-whono] Failed to read ${filePath}:`, error);
    return undefined;
  }
};

const parseSidebarNav = (value: unknown): SidebarNavItem[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const merged = new Map<SidebarNavId, SidebarNavItem>(
    LEGACY_NAV.map((item) => [item.id, { ...item }])
  );
  let hasOverride = false;

  for (const row of value) {
    if (!isRecord(row)) continue;
    const id = asNavId(row.id);
    if (!id) continue;
    const current = merged.get(id);
    if (!current) continue;

    const label = asNonEmptyString(row.label) ?? current.label;
    const visible = asBoolean(row.visible) ?? current.visible;
    const order = asFiniteNumber(row.order) ?? current.order;

    merged.set(id, { id, label, visible, order });
    hasOverride = true;
  }

  if (!hasOverride) return undefined;
  return Array.from(merged.values()).sort((a, b) => a.order - b.order);
};

export const getThemeSettings = (): ThemeSettingsResolved => {
  if (cachedSettings) return cachedSettings;

  const siteJson = readSettingsObject('site');
  const homeJson = readSettingsObject('home');
  const uiJson = readSettingsObject('ui');

  const title = resolveValue(
    asNonEmptyString(siteJson?.title),
    asNonEmptyString(legacySite.title),
    DEFAULT_SITE.title
  );
  const brandTitle = resolveValue(
    asNonEmptyString(siteJson?.brandTitle),
    asNonEmptyString(legacySite.brandTitle),
    DEFAULT_SITE.brandTitle
  );
  const description = resolveValue(
    asNonEmptyString(siteJson?.description),
    asNonEmptyString(legacySite.description),
    DEFAULT_SITE.description
  );
  const author = resolveValue(
    asNonEmptyString(siteJson?.author),
    asNonEmptyString(legacySite.author),
    DEFAULT_SITE.author
  );
  const authorAvatar = resolveValue(
    asString(siteJson?.authorAvatar),
    asString(legacySite.authorAvatar),
    DEFAULT_SITE.authorAvatar
  );
  const defaultLocale = resolveValue(
    asNonEmptyString(siteJson?.defaultLocale),
    undefined,
    DEFAULT_SITE.defaultLocale
  );

  const quote = resolveValue(
    asNonEmptyString(homeJson?.quote),
    LEGACY_QUOTE,
    LEGACY_QUOTE
  );
  const sidebarNav = resolveValue(
    parseSidebarNav(homeJson?.sidebarNav),
    LEGACY_NAV,
    LEGACY_NAV
  );
  const legacyHeroPresetId: HeroPresetId = 'default';
  const heroPresetId = resolveValue(
    asHeroPresetId(homeJson?.heroPresetId),
    legacyHeroPresetId,
    legacyHeroPresetId
  );

  const uiCodeBlock = isRecord(uiJson?.codeBlock) ? uiJson.codeBlock : undefined;
  const uiReadingMode = isRecord(uiJson?.readingMode) ? uiJson.readingMode : undefined;

  const showLineNumbers = resolveValue(
    asBoolean(uiCodeBlock?.showLineNumbers),
    true,
    true
  );
  const showReadingEntry = resolveValue(
    asBoolean(uiReadingMode?.showEntry),
    true,
    true
  );

  const resolved: ThemeSettingsResolved = {
    settings: {
      site: {
        title: title.value,
        brandTitle: brandTitle.value,
        description: description.value,
        author: author.value,
        authorAvatar: authorAvatar.value,
        defaultLocale: defaultLocale.value
      },
      home: {
        quote: quote.value,
        sidebarNav: sidebarNav.value,
        heroPresetId: heroPresetId.value
      },
      ui: {
        codeBlock: {
          showLineNumbers: showLineNumbers.value
        },
        readingMode: {
          showEntry: showReadingEntry.value
        }
      }
    },
    sources: {
      site: {
        title: title.source,
        brandTitle: brandTitle.source,
        description: description.source,
        author: author.source,
        authorAvatar: authorAvatar.source,
        defaultLocale: defaultLocale.source
      },
      home: {
        quote: quote.source,
        sidebarNav: sidebarNav.source,
        heroPresetId: heroPresetId.source
      },
      ui: {
        codeBlockShowLineNumbers: showLineNumbers.source,
        readingModeShowEntry: showReadingEntry.source
      }
    }
  };

  cachedSettings = resolved;
  return resolved;
};

export const resetThemeSettingsCache = (): void => {
  cachedSettings = null;
};

export const getSidebarHref = (id: SidebarNavId): string => SIDEBAR_HREFS[id];
