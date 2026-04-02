import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

vi.mock('../src/lib/bits', () => ({
  getBitAnchorId: () => 'bit-anchor',
  getBitsPagePath: () => '/bits/',
  getBitSlug: () => 'bit-slug',
  getSortedBits: vi.fn()
}));

vi.mock('../src/lib/content', () => ({
  getEssaySlug: () => 'essay-slug',
  getSortedEssays: vi.fn()
}));

import {
  ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION,
  createAdminSettingsExportBundle,
  parseAdminSettingsExportBundle
} from '../src/lib/admin-console/settings-data';
import type { AdminChecksCategoryResult } from '../src/lib/admin-console/checks';
import { createAdminOverviewChecksSummary } from '../src/lib/admin-console/overview';
import { getEditableThemeSettingsPayload } from '../src/lib/theme-settings';

const createChecksCategory = (
  id: 'settings' | 'essay-slug' | 'bits-media' | 'tag',
  issueCount = 0
): AdminChecksCategoryResult => ({
  id,
  label: id,
  description: `${id} description`,
  issueCount,
  status: issueCount > 0 ? 'blocked' : 'ready',
  statusLabel: issueCount > 0 ? '需处理' : '已通过',
  issues: issueCount > 0
    ? [
        {
          id: `${id}-issue`,
          title: `${id} issue`,
          message: `${id} issue message`,
          detail: null,
          relativePath: `src/${id}.json`,
          fieldPath: 'field',
          collection: null,
          entryId: null,
          href: '/admin/checks/'
        }
      ]
    : []
});

describe('admin-console/settings-data', () => {
  it('creates a settings export bundle with manifest metadata', () => {
    const payload = getEditableThemeSettingsPayload();
    const bundle = createAdminSettingsExportBundle(payload, {
      createdAt: '2026-04-01T08:00:00.000Z'
    });

    expect(bundle.manifest.schemaVersion).toBe(ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION);
    expect(bundle.manifest.createdAt).toBe('2026-04-01T08:00:00.000Z');
    expect(bundle.manifest.includedScopes).toEqual(['settings']);
    expect(bundle.manifest.locale).toBe(payload.settings.site.defaultLocale);
    expect(bundle.settings).toEqual(payload.settings);
  });

  it('accepts older bundles that do not provide manifest.locale', () => {
    const payload = getEditableThemeSettingsPayload();
    const bundle = createAdminSettingsExportBundle(payload);
    const legacyBundle = {
      ...bundle,
      manifest: {
        ...bundle.manifest
      } as Record<string, unknown>
    };
    delete legacyBundle.manifest.locale;

    const parsed = parseAdminSettingsExportBundle(legacyBundle);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.bundle.manifest.locale).toBeNull();
      expect(parsed.bundle.settings).toEqual(bundle.settings);
    }
  });

  it('rejects bundles that do not declare settings in includedScopes', () => {
    const payload = getEditableThemeSettingsPayload();
    const bundle = createAdminSettingsExportBundle(payload);

    const parsed = parseAdminSettingsExportBundle({
      ...bundle,
      manifest: {
        ...bundle.manifest,
        includedScopes: ['content']
      }
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('manifest.includedScopes 必须包含 settings');
    }
  });

  it('summarizes ready maintenance checks when settings stay editable', () => {
    const summary = createAdminOverviewChecksSummary({
      totalIssueCount: 0,
      blockedCategoryCount: 0,
      readyCategoryCount: 4,
      affectedPathCount: 0,
      categories: [
        createChecksCategory('settings'),
        createChecksCategory('essay-slug'),
        createChecksCategory('bits-media'),
        createChecksCategory('tag')
      ]
    });

    expect(summary.readyCount).toBe(4);
    expect(summary.manualCount).toBe(2);
    expect(summary.blockedCount).toBe(0);
    expect(summary.statusLine).toContain('4 个源文件分类已通过');
    expect(summary.items.map((item) => item.status)).toEqual(['ready', 'ready', 'ready', 'ready', 'manual', 'manual']);
  });

  it('surfaces blocked maintenance checks when settings enter invalid-settings guard', () => {
    const summary = createAdminOverviewChecksSummary({
      totalIssueCount: 2,
      blockedCategoryCount: 2,
      readyCategoryCount: 2,
      affectedPathCount: 2,
      categories: [
        createChecksCategory('settings', 1),
        createChecksCategory('essay-slug', 1),
        createChecksCategory('bits-media'),
        createChecksCategory('tag')
      ]
    });

    expect(summary.readyCount).toBe(2);
    expect(summary.manualCount).toBe(2);
    expect(summary.blockedCount).toBe(2);
    expect(summary.statusLine).toContain('发现 2 个问题');
    expect(summary.items[0]?.detail).toContain('settings issue message');
  });
});
