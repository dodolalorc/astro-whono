import {
  isAdminMediaOrigin,
  type AdminMediaOrigin
} from '../../lib/admin-console/media-contract';

export type AdminMediaClientItem = {
  path: string;
  value: string;
  origin: AdminMediaOrigin;
  fileName: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

export type AdminMediaClientMeta = {
  kind: 'local' | 'remote';
  path: string | null;
  value: string;
  origin: AdminMediaOrigin | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

export type AdminMediaListPage<TItem> = {
  items: TItem[];
  page: number;
  totalPages: number;
  totalCount: number;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
export const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === 'number';

const parsePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;

export const formatAdminMediaBytes = (size: number | null): string => {
  if (!size || size <= 0) return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const getAdminMediaOriginLabel = (origin: AdminMediaClientMeta['origin']): string => {
  if (origin === 'public') return '公开资源';
  if (origin === 'src/assets') return '站点素材';
  if (origin === 'src/content') return '文章附件';
  return '本地资源';
};

export const formatAdminMediaMetaSummary = (
  meta: Pick<AdminMediaClientMeta, 'kind' | 'origin' | 'width' | 'height' | 'size'>
): string => {
  if (meta.kind === 'remote') {
    return '远程图片；不自动读取本地尺寸';
  }

  const originLabel = getAdminMediaOriginLabel(meta.origin);
  const sizeLabel = formatAdminMediaBytes(meta.size);
  if (meta.width && meta.height) {
    return `${originLabel} · ${meta.width}×${meta.height} · ${sizeLabel}`;
  }
  return `${originLabel} · 尺寸未知 · ${sizeLabel}`;
};

export const getAdminMediaResponseErrors = (payload: unknown): string[] =>
  isRecord(payload) && Array.isArray(payload.errors)
    ? payload.errors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const isAdminMediaClientItem = (item: unknown): item is AdminMediaClientItem =>
  isRecord(item)
  && typeof item.path === 'string'
  && typeof item.value === 'string'
  && isAdminMediaOrigin(item.origin)
  && typeof item.fileName === 'string'
  && isNullableNumber(item.width)
  && isNullableNumber(item.height)
  && isNullableNumber(item.size)
  && isNullableString(item.mimeType)
  && isNullableString(item.previewSrc);

export const isAdminMediaClientMeta = (meta: unknown): meta is AdminMediaClientMeta =>
  isRecord(meta)
  && (meta.kind === 'local' || meta.kind === 'remote')
  && isNullableString(meta.path)
  && typeof meta.value === 'string'
  && (meta.origin === null || isAdminMediaOrigin(meta.origin))
  && isNullableNumber(meta.width)
  && isNullableNumber(meta.height)
  && isNullableNumber(meta.size)
  && isNullableString(meta.mimeType)
  && isNullableString(meta.previewSrc);

export const parseAdminMediaListResponse = (payload: unknown): AdminMediaListPage<AdminMediaClientItem> => {
  if (!isRecord(payload) || !isRecord(payload.result) || !Array.isArray(payload.result.items)) {
    throw new Error('媒体列表响应格式无效');
  }

  return {
    items: payload.result.items.filter(isAdminMediaClientItem),
    page: parsePositiveInteger(payload.result.page, 1),
    totalPages: parsePositiveInteger(payload.result.totalPages, 1),
    totalCount: typeof payload.result.totalCount === 'number' && payload.result.totalCount >= 0
      ? payload.result.totalCount
      : 0
  };
};

export const parseAdminMediaMetaResponse = (payload: unknown): AdminMediaClientMeta => {
  if (!isRecord(payload) || !isRecord(payload.result) || !isAdminMediaClientMeta(payload.result)) {
    throw new Error('媒体元数据响应格式无效');
  }

  return payload.result;
};

export const fetchAdminMediaJson = async (url: string, fallbackMessage = '媒体接口请求失败'): Promise<unknown> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (response.ok && isRecord(payload) && payload.ok === true) {
    return payload;
  }

  const errors = getAdminMediaResponseErrors(payload);
  if (!response.ok) {
    throw new Error(errors[0] ?? `${fallbackMessage}（HTTP ${response.status}）`);
  }

  throw new Error(errors[0] ?? fallbackMessage);
};
