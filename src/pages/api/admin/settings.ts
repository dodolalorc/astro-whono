import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import {
  getThemeSettings,
  resetThemeSettingsCache,
  type SidebarNavId,
  type ThemeSettings
} from '../../../lib/theme-settings';

export const prerender = false;

type WritableGroup = 'site' | 'home' | 'ui';
type HeroPresetId = 'default' | 'minimal' | 'none';

type NavInputItem = {
  id: SidebarNavId;
  label: string;
  visible: boolean;
  order: number;
};

const SETTINGS_DIR = join(process.cwd(), 'src', 'data', 'settings');
const SETTINGS_FILES: Record<WritableGroup, string> = {
  site: join(SETTINGS_DIR, 'site.json'),
  home: join(SETTINGS_DIR, 'home.json'),
  ui: join(SETTINGS_DIR, 'ui.json')
};

const NAV_IDS: ReadonlyArray<SidebarNavId> = ['essay', 'bits', 'memo', 'archive', 'about'];
const HERO_PRESETS: ReadonlySet<HeroPresetId> = new Set(['default', 'minimal', 'none']);
const LOCALE_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const SITE_KEYS = ['title', 'brandTitle', 'description', 'author', 'authorAvatar', 'defaultLocale'] as const;
const HOME_KEYS = ['quote', 'sidebarNav', 'heroPresetId'] as const;
const UI_KEYS = ['codeBlock', 'readingMode'] as const;
const CODE_BLOCK_KEYS = ['showLineNumbers'] as const;
const READING_MODE_KEYS = ['showEntry'] as const;
const NAV_ITEM_KEYS = ['id', 'label', 'visible', 'order'] as const;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

const toBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const toInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Number.isInteger(value) ? value : undefined;
};

const collectUnknownKeys = (
  scope: string,
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
  errors: string[]
): void => {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      errors.push(`${scope} 出现未知字段：${key}`);
    }
  }
};

const parseNavItem = (value: unknown, errors: string[], index: number): NavInputItem | null => {
  if (!isRecord(value)) {
    errors.push(`home.sidebarNav[${index}] 必须是对象`);
    return null;
  }

  collectUnknownKeys(`home.sidebarNav[${index}]`, value, NAV_ITEM_KEYS, errors);

  const idRaw = toTrimmedString(value.id);
  if (!idRaw || !NAV_IDS.includes(idRaw as SidebarNavId)) {
    errors.push(`home.sidebarNav[${index}].id 非法`);
    return null;
  }
  const id = idRaw as SidebarNavId;

  const label = toTrimmedString(value.label);
  if (!label) errors.push(`home.sidebarNav[${index}].label 不能为空`);

  const visible = toBoolean(value.visible);
  if (visible === undefined) errors.push(`home.sidebarNav[${index}].visible 必须是布尔值`);

  const order = toInteger(value.order);
  if (order === undefined || order < 1 || order > 999) {
    errors.push(`home.sidebarNav[${index}].order 必须是 1-999 的整数`);
  }

  if (!label || visible === undefined || order === undefined || order < 1 || order > 999) {
    return null;
  }

  return { id, label, visible, order };
};

const parsePatch = (
  input: unknown,
  current: ThemeSettings
): { patch: Partial<ThemeSettings>; writtenGroups: WritableGroup[]; errors: string[] } => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { patch: {}, writtenGroups: [], errors: ['请求体必须是 JSON 对象'] };
  }

  collectUnknownKeys('root', input, ['site', 'home', 'ui'], errors);

  const patch: Partial<ThemeSettings> = {};
  const writtenGroups: WritableGroup[] = [];

  if (Object.prototype.hasOwnProperty.call(input, 'site')) {
    const rawSite = input.site;
    if (!isRecord(rawSite)) {
      errors.push('site 必须是对象');
    } else {
      collectUnknownKeys('site', rawSite, SITE_KEYS, errors);
      const nextSite = { ...current.site };

      if (Object.prototype.hasOwnProperty.call(rawSite, 'title')) {
        const value = toTrimmedString(rawSite.title);
        if (!value) errors.push('site.title 不能为空');
        else nextSite.title = value;
      }
      if (Object.prototype.hasOwnProperty.call(rawSite, 'brandTitle')) {
        const value = toTrimmedString(rawSite.brandTitle);
        if (!value) errors.push('site.brandTitle 不能为空');
        else nextSite.brandTitle = value;
      }
      if (Object.prototype.hasOwnProperty.call(rawSite, 'description')) {
        const value = toTrimmedString(rawSite.description);
        if (!value) errors.push('site.description 不能为空');
        else nextSite.description = value;
      }
      if (Object.prototype.hasOwnProperty.call(rawSite, 'author')) {
        const value = toTrimmedString(rawSite.author);
        if (!value) errors.push('site.author 不能为空');
        else nextSite.author = value;
      }
      if (Object.prototype.hasOwnProperty.call(rawSite, 'authorAvatar')) {
        const value = toTrimmedString(rawSite.authorAvatar);
        if (value === undefined) {
          errors.push('site.authorAvatar 必须是字符串');
        } else {
          if (value.startsWith('/')) {
            errors.push('site.authorAvatar 必须是相对路径，不能以 / 开头');
          }
          if (/^[A-Za-z]+:\/\//.test(value)) {
            errors.push('site.authorAvatar Phase 1 不允许 URL');
          }
          nextSite.authorAvatar = value;
        }
      }
      if (Object.prototype.hasOwnProperty.call(rawSite, 'defaultLocale')) {
        const value = toTrimmedString(rawSite.defaultLocale);
        if (!value) {
          errors.push('site.defaultLocale 不能为空');
        } else if (!LOCALE_RE.test(value)) {
          errors.push('site.defaultLocale 格式非法（示例：zh-CN）');
        } else {
          nextSite.defaultLocale = value;
        }
      }

      patch.site = nextSite;
      writtenGroups.push('site');
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'home')) {
    const rawHome = input.home;
    if (!isRecord(rawHome)) {
      errors.push('home 必须是对象');
    } else {
      collectUnknownKeys('home', rawHome, HOME_KEYS, errors);
      const nextHome = { ...current.home };

      if (Object.prototype.hasOwnProperty.call(rawHome, 'quote')) {
        const value = toTrimmedString(rawHome.quote);
        if (!value) errors.push('home.quote 不能为空');
        else nextHome.quote = value;
      }

      if (Object.prototype.hasOwnProperty.call(rawHome, 'heroPresetId')) {
        const value = toTrimmedString(rawHome.heroPresetId);
        if (!value || !HERO_PRESETS.has(value as HeroPresetId)) {
          errors.push('home.heroPresetId 只允许 default/minimal/none');
        } else {
          nextHome.heroPresetId = value as HeroPresetId;
        }
      }

      if (Object.prototype.hasOwnProperty.call(rawHome, 'sidebarNav')) {
        const rawNav = rawHome.sidebarNav;
        if (!Array.isArray(rawNav)) {
          errors.push('home.sidebarNav 必须是数组');
        } else {
          const parsedNav = rawNav
            .map((item, index) => parseNavItem(item, errors, index))
            .filter((item): item is NavInputItem => item !== null);

          if (parsedNav.length === NAV_IDS.length) {
            const seenIds = new Set<SidebarNavId>();
            const seenOrder = new Set<number>();
            for (const row of parsedNav) {
              if (seenIds.has(row.id)) errors.push(`home.sidebarNav ID 重复：${row.id}`);
              if (seenOrder.has(row.order)) errors.push(`home.sidebarNav 排序重复：${row.order}`);
              seenIds.add(row.id);
              seenOrder.add(row.order);
            }
            for (const navId of NAV_IDS) {
              if (!seenIds.has(navId)) {
                errors.push(`home.sidebarNav 缺少导航项：${navId}`);
              }
            }

            nextHome.sidebarNav = parsedNav.sort((a, b) => {
              if (a.order !== b.order) return a.order - b.order;
              return NAV_IDS.indexOf(a.id) - NAV_IDS.indexOf(b.id);
            });
          } else if (rawNav.length !== NAV_IDS.length) {
            errors.push(`home.sidebarNav 必须包含 ${NAV_IDS.length} 个既有导航项`);
          }
        }
      }

      patch.home = nextHome;
      writtenGroups.push('home');
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'ui')) {
    const rawUi = input.ui;
    if (!isRecord(rawUi)) {
      errors.push('ui 必须是对象');
    } else {
      collectUnknownKeys('ui', rawUi, UI_KEYS, errors);
      const nextUi = {
        codeBlock: { ...current.ui.codeBlock },
        readingMode: { ...current.ui.readingMode }
      };

      if (Object.prototype.hasOwnProperty.call(rawUi, 'codeBlock')) {
        const rawCodeBlock = rawUi.codeBlock;
        if (!isRecord(rawCodeBlock)) {
          errors.push('ui.codeBlock 必须是对象');
        } else {
          collectUnknownKeys('ui.codeBlock', rawCodeBlock, CODE_BLOCK_KEYS, errors);
          if (Object.prototype.hasOwnProperty.call(rawCodeBlock, 'showLineNumbers')) {
            const value = toBoolean(rawCodeBlock.showLineNumbers);
            if (value === undefined) errors.push('ui.codeBlock.showLineNumbers 必须是布尔值');
            else nextUi.codeBlock.showLineNumbers = value;
          }
        }
      }

      if (Object.prototype.hasOwnProperty.call(rawUi, 'readingMode')) {
        const rawReadingMode = rawUi.readingMode;
        if (!isRecord(rawReadingMode)) {
          errors.push('ui.readingMode 必须是对象');
        } else {
          collectUnknownKeys('ui.readingMode', rawReadingMode, READING_MODE_KEYS, errors);
          if (Object.prototype.hasOwnProperty.call(rawReadingMode, 'showEntry')) {
            const value = toBoolean(rawReadingMode.showEntry);
            if (value === undefined) errors.push('ui.readingMode.showEntry 必须是布尔值');
            else nextUi.readingMode.showEntry = value;
          }
        }
      }

      patch.ui = nextUi;
      writtenGroups.push('ui');
    }
  }

  if (!writtenGroups.length) {
    errors.push('请求体至少需要包含 site/home/ui 中的一组');
  }

  return { patch, writtenGroups, errors };
};

const writeJsonAtomic = async (filePath: string, data: unknown): Promise<void> => {
  await mkdir(SETTINGS_DIR, { recursive: true });
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

  try {
    await writeFile(tempPath, serialized, 'utf8');
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
};

export const GET: APIRoute = async () => {
  const payload = getThemeSettings();
  return new Response(JSON.stringify(payload, null, 2), { headers: JSON_HEADERS });
};

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return new Response('Not Found', { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    const rawBody = await request.clone().text();
    const trimmedBody = rawBody.trim();
    if (!trimmedBody) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            errors: ['请求体为空，请确认前端请求地址未发生重定向且已发送 JSON 字符串']
          },
          null,
          2
        ),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, errors: ['请求体不是合法 JSON'] }, null, 2),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const current = getThemeSettings().settings;
  const { patch, writtenGroups, errors } = parsePatch(body, current);

  if (errors.length) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          errors,
          results: {
            site: { received: writtenGroups.includes('site'), written: false },
            home: { received: writtenGroups.includes('home'), written: false },
            ui: { received: writtenGroups.includes('ui'), written: false }
          }
        },
        null,
        2
      ),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const results = {
    site: { received: writtenGroups.includes('site'), written: false },
    home: { received: writtenGroups.includes('home'), written: false },
    ui: { received: writtenGroups.includes('ui'), written: false }
  };

  try {
    if (patch.site && results.site.received) {
      await writeJsonAtomic(SETTINGS_FILES.site, patch.site);
      results.site.written = true;
    }
    if (patch.home && results.home.received) {
      await writeJsonAtomic(SETTINGS_FILES.home, patch.home);
      results.home.written = true;
    }
    if (patch.ui && results.ui.received) {
      await writeJsonAtomic(SETTINGS_FILES.ui, patch.ui);
      results.ui.written = true;
    }

    resetThemeSettingsCache();
    const payload = getThemeSettings();

    return new Response(
      JSON.stringify(
        {
          ok: true,
          results,
          payload
        },
        null,
        2
      ),
      { headers: JSON_HEADERS }
    );
  } catch (error) {
    console.error('[astro-whono] Failed to persist admin settings:', error);
    return new Response(
      JSON.stringify(
        {
          ok: false,
          errors: ['写入失败，请检查文件权限或磁盘状态'],
          results
        },
        null,
        2
      ),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
