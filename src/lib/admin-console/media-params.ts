import {
  ADMIN_MEDIA_DEFAULT_LIST_LIMIT,
  isAdminMediaOrigin,
  type AdminMediaOrigin
} from './media-contract';
import {
  normalizeAdminMediaBrowseGroup,
  normalizeAdminMediaBrowseSubgroup
} from './media-browse';
import { toSafeHttpUrl } from '../../utils/format';

export type AdminMediaFieldContext =
  | 'bits.images'
  | 'home.heroImageSrc'
  | 'page.bits.defaultAuthor.avatar';

export type AdminMediaDirectory =
  | ''
  | 'public'
  | 'public/author'
  | 'public/bits'
  | 'public/images'
  | 'src/assets'
  | 'src/content';

export type AdminMediaDirectoryOption = {
  value: AdminMediaDirectory;
  label: string;
  description: string;
};

export type AdminMediaListRequest = {
  field: AdminMediaFieldContext | null;
  directory: AdminMediaDirectory;
  owner: string;
  origin: AdminMediaOrigin | '';
  group: string;
  subgroup: string;
  query: string;
  page: number;
  limit: number;
};

export type AdminMediaMetaInput =
  | {
      field: AdminMediaFieldContext;
      value: string;
      path?: string;
    }
  | {
      path: string;
      field?: AdminMediaFieldContext;
      value?: string;
    };

type AdminMediaFieldConfig = {
  allowedOrigins: readonly AdminMediaOrigin[];
  preferredPrefixes: readonly string[];
  toValue: (assetPath: string, origin: AdminMediaOrigin) => string | null;
};

const IMAGE_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const FIELD_CONFIG: Record<AdminMediaFieldContext, AdminMediaFieldConfig> = {
  'bits.images': {
    allowedOrigins: ['public'],
    preferredPrefixes: ['public/bits/', 'public/images/', 'public/author/', 'public/'],
    toValue: (assetPath, origin) => (origin === 'public' ? assetPath.slice('public/'.length) : null)
  },
  'home.heroImageSrc': {
    allowedOrigins: ['src/assets', 'public'],
    preferredPrefixes: ['src/assets/', 'public/images/', 'public/'],
    toValue: (assetPath, origin) => {
      if (origin === 'src/assets') return assetPath;
      if (origin === 'public') return `/${assetPath.slice('public/'.length)}`;
      return null;
    }
  },
  'page.bits.defaultAuthor.avatar': {
    allowedOrigins: ['public'],
    preferredPrefixes: ['public/author/', 'public/bits/', 'public/images/', 'public/'],
    toValue: (assetPath, origin) => (origin === 'public' ? assetPath.slice('public/'.length) : null)
  }
};

const ADMIN_MEDIA_FIELD_CONTEXTS = Object.freeze(Object.keys(FIELD_CONFIG) as AdminMediaFieldContext[]);
const ADMIN_MEDIA_ALL_ORIGINS = ['public', 'src/assets', 'src/content'] as const satisfies readonly AdminMediaOrigin[];

export const ADMIN_MEDIA_DIRECTORY_OPTIONS = [
  {
    value: '',
    label: '全部资源',
    description: '查看站点里可用的本地图片。'
  },
  {
    value: 'public/author',
    label: '头像资源',
    description: '查看作者头像和默认头像图片。'
  },
  {
    value: 'public/bits',
    label: '絮语配图',
    description: '查看絮语常用的公开配图。'
  },
  {
    value: 'public/images',
    label: '页面插图',
    description: '查看首页和普通页面使用的插图。'
  },
  {
    value: 'public',
    label: '公开图片',
    description: '查看 public 下的全部公开图片。'
  },
  {
    value: 'src/assets',
    label: '站点素材',
    description: '查看站点主题和首页使用的本地素材。'
  },
  {
    value: 'src/content',
    label: '文章附件',
    description: '查看文章或笔记同目录下的图片附件。'
  }
] as const satisfies readonly AdminMediaDirectoryOption[];

export class AdminMediaError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AdminMediaError';
    this.status = status;
  }
}

const normalizePositiveInteger = (
  value: string | null,
  { fallback, min = 1, max = Number.MAX_SAFE_INTEGER }: { fallback: number; min?: number; max?: number }
): number => {
  const parsed = Number.parseInt((value ?? '').trim(), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const normalizeSearchQuery = (value: string | null): string => (value ?? '').trim().toLowerCase();

export const normalizeAdminMediaOwnerValue = (value: string | null | undefined): string =>
  (value ?? '').trim().replace(/\\/g, '/');

export const isAdminMediaFieldContext = (value: string): value is AdminMediaFieldContext =>
  value in FIELD_CONFIG;

export const isAdminMediaDirectory = (value: string): value is AdminMediaDirectory =>
  ADMIN_MEDIA_DIRECTORY_OPTIONS.some((option) => option.value === value);

export const normalizeAdminMediaDirectory = (value: string | null | undefined): AdminMediaDirectory => {
  const normalized = (value ?? '').trim().replace(/\\/g, '/');
  return isAdminMediaDirectory(normalized) ? normalized : '';
};

export const getAdminMediaFieldValue = (
  field: AdminMediaFieldContext | null,
  assetPath: string,
  origin: AdminMediaOrigin
): string | null => {
  if (!field) return assetPath;
  const config = FIELD_CONFIG[field];
  if (!config.allowedOrigins.includes(origin)) return null;
  return config.toValue(assetPath, origin);
};

export const getAdminMediaFieldAllowedOrigins = (
  field: AdminMediaFieldContext | null
): readonly AdminMediaOrigin[] => (field ? FIELD_CONFIG[field].allowedOrigins : ADMIN_MEDIA_ALL_ORIGINS);

export const getAdminMediaFieldSortRank = (
  field: AdminMediaFieldContext | null,
  assetPath: string
): number => {
  if (!field) return 999;
  const prefixes = FIELD_CONFIG[field].preferredPrefixes;
  const index = prefixes.findIndex((prefix) => assetPath.startsWith(prefix));
  return index === -1 ? prefixes.length : index;
};

export const getAdminMediaCompatibleFieldValues = (
  assetPath: string,
  origin: AdminMediaOrigin
): string[] =>
  Array.from(
    new Set(
      ADMIN_MEDIA_FIELD_CONTEXTS
        .map((field) => getAdminMediaFieldValue(field, assetPath, origin))
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );

export const normalizeAdminLocalImageSource = (value: string): string | null => {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || normalized.startsWith('public/')
    || /^[A-Za-z]+:\/\//.test(normalized)
    || /(^|\/)\.\.(?:\/|$)/.test(normalized)
    || normalized.includes('?')
    || normalized.includes('#')
  ) {
    return null;
  }

  return IMAGE_LOCAL_EXT_RE.test(normalized) ? normalized : null;
};

export const normalizeAdminBitsImageSource = (value: string): string | null => {
  const safeRemoteUrl = toSafeHttpUrl(value);
  if (safeRemoteUrl && safeRemoteUrl.startsWith('https://')) return safeRemoteUrl;
  return normalizeAdminLocalImageSource(value);
};

export const getAdminMediaListRequest = (searchParams: URLSearchParams): AdminMediaListRequest => {
  const rawField = (searchParams.get('field') ?? '').trim();
  const field = isAdminMediaFieldContext(rawField) ? rawField : null;
  const rawOrigin = (searchParams.get('origin') ?? '').trim();
  const origin = isAdminMediaOrigin(rawOrigin) && getAdminMediaFieldAllowedOrigins(field).includes(rawOrigin)
    ? rawOrigin
    : '';

  return {
    field,
    directory: normalizeAdminMediaDirectory(searchParams.get('dir')),
    owner: normalizeAdminMediaOwnerValue(searchParams.get('owner')),
    origin,
    group: normalizeAdminMediaBrowseGroup(searchParams.get('group')),
    subgroup: normalizeAdminMediaBrowseSubgroup(searchParams.get('sub')),
    query: normalizeSearchQuery(searchParams.get('q')),
    page: normalizePositiveInteger(searchParams.get('page'), { fallback: 1 }),
    limit: normalizePositiveInteger(searchParams.get('limit'), {
      fallback: ADMIN_MEDIA_DEFAULT_LIST_LIMIT,
      max: 60
    })
  };
};

export const getAdminMediaMetaRequest = (searchParams: URLSearchParams): AdminMediaMetaInput => {
  const rawPath = (searchParams.get('path') ?? '').trim();
  if (rawPath) {
    return { path: rawPath };
  }

  const rawField = (searchParams.get('field') ?? '').trim();
  if (!isAdminMediaFieldContext(rawField)) {
    throw new AdminMediaError('field 参数非法，无法读取媒体元数据');
  }

  return {
    field: rawField,
    value: (searchParams.get('value') ?? '').trim()
  };
};
