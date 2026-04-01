import type { APIRoute } from 'astro';
import { createAdminSettingsExportBundle, getAdminSettingsExportFileName } from '../../../../lib/admin-console/settings-data';
import { getEditableThemeSettingsState } from '../../../../lib/theme-settings';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

export const GET: APIRoute = async () => {
  if (!import.meta.env.DEV) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const editableState = getEditableThemeSettingsState();
  if (!editableState.ok) {
    return new Response(JSON.stringify(editableState, null, 2), {
      status: 409,
      headers: JSON_HEADERS
    });
  }

  const bundle = createAdminSettingsExportBundle(editableState.payload);
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      ...JSON_HEADERS,
      'content-disposition': `attachment; filename="${getAdminSettingsExportFileName(bundle.manifest.createdAt)}"`
    }
  });
};
