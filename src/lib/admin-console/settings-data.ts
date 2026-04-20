import type { EditableThemeSettings, ThemeSettingsEditablePayload } from '../theme-settings';

export const ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION = 1;
export const ADMIN_SETTINGS_EXPORT_SCOPE = 'settings';
export const ADMIN_SETTINGS_EXPORT_EXCLUDES = [
  'content',
  'images',
  '.local',
  'private-files',
  'credentials'
] as const;

export type AdminSettingsExportManifest = {
  schemaVersion: typeof ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION;
  createdAt: string;
  includedScopes: readonly [typeof ADMIN_SETTINGS_EXPORT_SCOPE];
  excludes: readonly string[];
  locale: string | null;
};

export type AdminSettingsExportBundle = {
  manifest: AdminSettingsExportManifest;
  settings: EditableThemeSettings;
};

type ParseAdminSettingsExportBundleResult =
  | {
      ok: true;
      bundle: AdminSettingsExportBundle;
    }
  | {
      ok: false;
      errors: string[];
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeLocale = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const createAdminSettingsExportBundle = (
  payload: ThemeSettingsEditablePayload,
  options: {
    createdAt?: string;
  } = {}
): AdminSettingsExportBundle => ({
  manifest: {
    schemaVersion: ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION,
    createdAt: options.createdAt ?? new Date().toISOString(),
    includedScopes: [ADMIN_SETTINGS_EXPORT_SCOPE],
    excludes: [...ADMIN_SETTINGS_EXPORT_EXCLUDES],
    locale: normalizeLocale(payload.settings.site.defaultLocale)
  },
  settings: payload.settings
});

export const parseAdminSettingsExportBundle = (
  input: unknown
): ParseAdminSettingsExportBundleResult => {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: ['导入文件必须是 JSON 对象']
    };
  }

  const errors: string[] = [];
  const rawManifest = input.manifest;
  const rawSettings = input.settings;

  if (!isRecord(rawManifest)) {
    errors.push('导入文件缺少 manifest 对象');
  }

  if (!isRecord(rawSettings)) {
    errors.push('导入文件缺少 settings 快照');
  }

  if (errors.length > 0 || !isRecord(rawManifest) || !isRecord(rawSettings)) {
    return {
      ok: false,
      errors
    };
  }

  const schemaVersion = rawManifest.schemaVersion;
  if (schemaVersion !== ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION) {
    errors.push(
      `仅支持 schemaVersion=${ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION} 的 settings 导入包`
    );
  }

  const createdAt = typeof rawManifest.createdAt === 'string' ? rawManifest.createdAt.trim() : '';
  if (!createdAt) {
    errors.push('manifest.createdAt 缺失');
  }

  const includedScopes = Array.isArray(rawManifest.includedScopes)
    ? rawManifest.includedScopes.filter((value): value is string => typeof value === 'string')
    : [];
  if (!includedScopes.includes(ADMIN_SETTINGS_EXPORT_SCOPE)) {
    errors.push('manifest.includedScopes 必须包含 settings');
  }

  const excludes = Array.isArray(rawManifest.excludes)
    ? rawManifest.excludes.filter((value): value is string => typeof value === 'string')
    : [];
  if (!Array.isArray(rawManifest.excludes)) {
    errors.push('manifest.excludes 缺失');
  }

  const rawLocale = Object.prototype.hasOwnProperty.call(rawManifest, 'locale')
    ? rawManifest.locale
    : null;
  if (
    rawLocale !== null
    && rawLocale !== undefined
    && typeof rawLocale !== 'string'
  ) {
    errors.push('manifest.locale 必须是字符串、null，或在旧导出包中直接缺失');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    bundle: {
      manifest: {
        schemaVersion: ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION,
        createdAt,
        includedScopes: [ADMIN_SETTINGS_EXPORT_SCOPE],
        excludes,
        locale: normalizeLocale(rawLocale)
      },
      settings: rawSettings as unknown as EditableThemeSettings
    }
  };
};

export const getAdminSettingsExportFileName = (createdAt: string): string => {
  const normalized = createdAt
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[^0-9TZ]/g, '');
  return `astro-whono-settings-${normalized || 'snapshot'}.json`;
};
