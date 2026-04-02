import type { APIRoute } from 'astro';
import {
  AdminMediaError,
  getAdminMediaMeta,
  isAdminMediaFieldContext
} from '../../../../lib/admin-console/media-shared';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
} as const;

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  try {
    const rawField = (url.searchParams.get('field') ?? '').trim();
    const rawValue = (url.searchParams.get('value') ?? '').trim();
    const rawPath = (url.searchParams.get('path') ?? '').trim();

    const request = rawPath
      ? { path: rawPath }
      : (() => {
          if (!isAdminMediaFieldContext(rawField)) {
            throw new AdminMediaError('field 参数非法，无法读取媒体元数据');
          }

          return {
            field: rawField,
            value: rawValue
          };
        })();

    const result = await getAdminMediaMeta(request);

    return new Response(JSON.stringify({ ok: true, result }, null, 2), {
      headers: JSON_HEADERS
    });
  } catch (error) {
    const status = error instanceof AdminMediaError ? error.status : 500;
    const message = error instanceof Error ? error.message : '媒体元数据读取失败';
    return new Response(JSON.stringify({ ok: false, errors: [message] }, null, 2), {
      status,
      headers: JSON_HEADERS
    });
  }
};
