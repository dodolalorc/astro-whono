import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  getBitsAvatarLocalFilePath,
  getHeroImageLocalFilePath,
  normalizeBitsAvatarPath,
  normalizeHeroImageSrc,
  toSafeHttpUrl
} from '../../utils/format';

export type AdminMediaFieldContext =
  | 'bits.images'
  | 'home.heroImageSrc'
  | 'page.bits.defaultAuthor.avatar';

export type AdminMediaOrigin = 'public' | 'src/assets' | 'src/content';
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

export type AdminMediaOwnerOption = {
  value: string;
  label: string;
};

export type AdminMediaListItem = {
  path: string;
  value: string;
  origin: AdminMediaOrigin;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

export type AdminMediaListResult = {
  field: AdminMediaFieldContext | null;
  directory: AdminMediaDirectory;
  owner: string;
  ownerOptions: AdminMediaOwnerOption[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  items: AdminMediaListItem[];
};

export type AdminMediaMetaResult = {
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

type AdminMediaAssetRecord = {
  path: string;
  origin: AdminMediaOrigin;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
};

type ContentCollectionKey = keyof typeof CONTENT_COLLECTION_LABELS;

type AdminMediaContentOwner = {
  value: string;
  label: string;
  aliases: string[];
};

type AdminMediaMetaInput =
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

type LocalMediaTarget = {
  path: string;
  value: string;
  origin: AdminMediaOrigin;
  previewSrc: string | null;
};

const IMAGE_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const MARKDOWN_EXT_RE = /\.(?:md|mdx)$/i;
const RELATIVE_CONTENT_ASSET_RE = /!\[[^\]]*]\(([^)]+)\)|<img[^>]+src=["']([^"']+)["']/g;
const CONTENT_COLLECTION_LABELS = {
  essay: '随笔',
  bits: '絮语',
  memo: '小记'
} as const;
const OWNER_PATH_SEPARATORS = ['/', '.', '-', '_'] as const;
const ADMIN_MEDIA_SCAN_ROOTS = [
  {
    origin: 'public',
    prefix: 'public',
    pathSegments: ['public']
  },
  {
    origin: 'src/assets',
    prefix: 'src/assets',
    pathSegments: ['src', 'assets']
  },
  {
    origin: 'src/content',
    prefix: 'src/content',
    pathSegments: ['src', 'content']
  }
] as const satisfies readonly {
  origin: AdminMediaOrigin;
  prefix: Exclude<AdminMediaDirectory, ''>;
  pathSegments: readonly string[];
}[];

const MIME_BY_EXT: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const FIELD_CONFIG: Record<
  AdminMediaFieldContext,
  {
    allowedOrigins: readonly AdminMediaOrigin[];
    preferredPrefixes: readonly string[];
    toValue: (assetPath: string, origin: AdminMediaOrigin) => string | null;
  }
> = {
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

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

export const isAdminMediaFieldContext = (value: string): value is AdminMediaFieldContext =>
  value in FIELD_CONFIG;

export const isAdminMediaDirectory = (value: string): value is AdminMediaDirectory =>
  ADMIN_MEDIA_DIRECTORY_OPTIONS.some((option) => option.value === value);

export const normalizeAdminMediaDirectory = (value: string | null | undefined): AdminMediaDirectory => {
  const normalized = (value ?? '').trim().replace(/\\/g, '/');
  return isAdminMediaDirectory(normalized) ? normalized : '';
};

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
const normalizeOwnerValue = (value: string | null | undefined): string => (value ?? '').trim().replace(/\\/g, '/');

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

const getPreviewSrcFromPath = (assetPath: string): string | null =>
  assetPath.startsWith('public/') ? `/${assetPath.slice('public/'.length)}` : null;

const getMimeType = (assetPath: string): string | null =>
  MIME_BY_EXT[path.extname(assetPath).toLowerCase()] ?? null;

const isImageFile = (name: string): boolean => IMAGE_LOCAL_EXT_RE.test(name);

const walkImageFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walkImageFiles(fullPath);
      }
      return entry.isFile() && isImageFile(entry.name) ? [fullPath] : [];
    })
  );
  return nested.flat();
};

const walkMarkdownFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walkMarkdownFiles(fullPath);
      }
      return entry.isFile() && MARKDOWN_EXT_RE.test(entry.name) ? [fullPath] : [];
    })
  );
  return nested.flat();
};

const stripQuotes = (value: string): string => value.replace(/^['"]|['"]$/g, '').trim();

const humanizeEntryId = (value: string): string =>
  value
    .split(/[/-]+/)
    .filter(Boolean)
    .join(' ')
    .trim();

const extractContentTitle = (source: string): string | null => {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const frontmatterSource = match[1] ?? '';

  const titleLine = frontmatterSource
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith('title:'));

  if (!titleLine) return null;
  const [, rawTitle = ''] = titleLine.split(/:(.+)/, 2);
  const normalized = stripQuotes(rawTitle);
  return normalized || null;
};

const normalizeRelativeContentAssetRef = (value: string): string | null => {
  const normalized = stripQuotes((value.split(/[?#]/, 1)[0] ?? '').trim());
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || /^[A-Za-z]+:\/\//.test(normalized)
    || !normalized.startsWith('.')
  ) {
    return null;
  }

  return normalized;
};

const extractContentAssetAliases = (source: string, ownerValue: string): string[] => {
  const aliases = new Set<string>([ownerValue]);
  const ownerDirectory = path.posix.dirname(ownerValue);

  for (const match of source.matchAll(RELATIVE_CONTENT_ASSET_RE)) {
    const relativeRef = normalizeRelativeContentAssetRef(match[1] ?? match[2] ?? '');
    if (!relativeRef) continue;

    const resolvedPath = path.posix.normalize(path.posix.join(ownerDirectory, relativeRef));
    if (!resolvedPath.startsWith('src/content/')) continue;

    aliases.add(resolvedPath);
    const resolvedDirectory = path.posix.dirname(resolvedPath);
    if (resolvedDirectory && resolvedDirectory !== ownerDirectory) {
      aliases.add(resolvedDirectory);
    }
  }

  return Array.from(aliases);
};

const loadContentOwnerOptions = async (): Promise<AdminMediaContentOwner[]> => {
  const projectRoot = getProjectRoot();
  const contentRoot = path.join(projectRoot, 'src', 'content');
  if (!existsSync(contentRoot)) return [];

  const markdownFiles = await walkMarkdownFiles(contentRoot);
  const owners = await Promise.all(
    markdownFiles.map(async (filePath) => {
      const relativeFilePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
      const relativeWithoutExt = relativeFilePath.replace(MARKDOWN_EXT_RE, '');
      const segments = relativeWithoutExt.split('/');
      const collection = segments[2] as ContentCollectionKey | undefined;
      if (!collection || !(collection in CONTENT_COLLECTION_LABELS)) return null;

      const entryId = segments.slice(3).join('/');
      if (!entryId) return null;

      const source = await readFile(filePath, 'utf8');
      const title = extractContentTitle(source);
      const fallbackId = entryId.endsWith('/index') ? entryId.slice(0, -'/index'.length) : entryId;
      const normalizedTitle = title || humanizeEntryId(fallbackId || entryId) || entryId;

      return {
        value: relativeWithoutExt,
        label: `${CONTENT_COLLECTION_LABELS[collection]} · ${normalizedTitle}`,
        aliases: extractContentAssetAliases(source, relativeWithoutExt)
      } satisfies AdminMediaContentOwner;
    })
  );

  return owners.filter((owner): owner is AdminMediaContentOwner => owner !== null);
};

const resolveAssetOwner = (
  assetPath: string,
  owners: readonly AdminMediaContentOwner[]
): AdminMediaContentOwner | null => {
  const matched = owners
    .map((owner) => {
      const matchingAlias = owner.aliases
        .filter((alias) =>
          assetPath === alias
          || OWNER_PATH_SEPARATORS.some((separator) => assetPath.startsWith(`${alias}${separator}`))
          || (alias.endsWith('/index') && assetPath.startsWith(`${alias.slice(0, -'/index'.length)}/`))
        )
        .sort((left, right) => right.length - left.length)[0];

      return matchingAlias
        ? {
            owner,
            aliasLength: matchingAlias.length
          }
        : null;
    })
    .filter((entry): entry is { owner: AdminMediaContentOwner; aliasLength: number } => entry !== null)
    .sort((left, right) => right.aliasLength - left.aliasLength);

  return matched[0]?.owner ?? null;
};

const resolveMediaScanTargets = (
  directory: AdminMediaDirectory
): Array<{ origin: AdminMediaOrigin; rootPath: string }> => {
  const projectRoot = getProjectRoot();
  if (!directory) {
    return ADMIN_MEDIA_SCAN_ROOTS.map((root) => ({
      origin: root.origin,
      rootPath: path.join(projectRoot, ...root.pathSegments)
    }));
  }

  const matchedRoot = ADMIN_MEDIA_SCAN_ROOTS.find(
    (root) => directory === root.prefix || directory.startsWith(`${root.prefix}/`)
  );
  if (!matchedRoot) return [];

  return [
    {
      origin: matchedRoot.origin,
      rootPath: path.join(projectRoot, ...directory.split('/'))
    }
  ];
};

const getOriginSortRank = (assetPath: string): number => {
  const index = ADMIN_MEDIA_SCAN_ROOTS.findIndex((root) => assetPath.startsWith(`${root.prefix}/`));
  return index === -1 ? ADMIN_MEDIA_SCAN_ROOTS.length : index;
};

const listAdminMediaAssets = async (
  directory: AdminMediaDirectory,
  contentOwners?: readonly AdminMediaContentOwner[]
): Promise<AdminMediaAssetRecord[]> => {
  const projectRoot = getProjectRoot();
  const roots = resolveMediaScanTargets(directory);
  const resolvedContentOwners = roots.some((root) => root.origin === 'src/content')
    ? (contentOwners?.length ? [...contentOwners] : await loadContentOwnerOptions())
    : [];

  const entries = await Promise.all(
    roots.map(async ({ origin, rootPath }) => {
      if (!existsSync(rootPath)) return [] as AdminMediaAssetRecord[];
      const files = await walkImageFiles(rootPath);
      return files.map((filePath) => {
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        const matchedOwner = origin === 'src/content'
          ? resolveAssetOwner(relativePath, resolvedContentOwners)
          : null;

        return {
          path: relativePath,
          origin,
          fileName: path.basename(filePath),
          owner: matchedOwner?.value ?? null,
          ownerLabel: matchedOwner?.label ?? null
        } satisfies AdminMediaAssetRecord;
      });
    })
  );

  return entries.flat();
};

const getFieldSortRank = (field: AdminMediaFieldContext | null, assetPath: string): number => {
  if (!field) return 999;
  const prefixes = FIELD_CONFIG[field].preferredPrefixes;
  const index = prefixes.findIndex((prefix) => assetPath.startsWith(prefix));
  return index === -1 ? prefixes.length : index;
};

const sortMediaAssets = (field: AdminMediaFieldContext | null, left: AdminMediaAssetRecord, right: AdminMediaAssetRecord): number => {
  const rankDiff = field
    ? getFieldSortRank(field, left.path) - getFieldSortRank(field, right.path)
    : getOriginSortRank(left.path) - getOriginSortRank(right.path);
  if (rankDiff !== 0) return rankDiff;
  return left.path.localeCompare(right.path);
};

const matchesMediaQuery = (record: AdminMediaAssetRecord, query: string): boolean => {
  if (!query) return true;
  const haystack = `${record.path} ${record.fileName} ${record.owner ?? ''} ${record.ownerLabel ?? ''}`.toLowerCase();
  return haystack.includes(query);
};

const toFieldValue = (field: AdminMediaFieldContext | null, record: AdminMediaAssetRecord): string | null => {
  if (!field) return record.path;
  const config = FIELD_CONFIG[field];
  if (!config.allowedOrigins.includes(record.origin)) return null;
  return config.toValue(record.path, record.origin);
};

const readSvgSize = (buffer: Buffer): { width: number | null; height: number | null } => {
  const source = buffer.toString('utf8');
  const widthMatch = source.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
  const heightMatch = source.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
  const parseSvgNumber = (value?: string): number | null => {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const width = parseSvgNumber(widthMatch?.[1]);
  const height = parseSvgNumber(heightMatch?.[1]);
  if (width && height) return { width, height };

  const viewBoxMatch = source.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
  return {
    width: parseSvgNumber(viewBoxMatch?.[1]),
    height: parseSvgNumber(viewBoxMatch?.[2])
  };
};

const readPngSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const readGifSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 10 || (buffer.toString('ascii', 0, 6) !== 'GIF87a' && buffer.toString('ascii', 0, 6) !== 'GIF89a')) {
    return null;
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
};

const readJpegSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (typeof marker !== 'number') {
      break;
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;

    const isSofMarker =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSofMarker) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
};

const readWebpSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    const signatureOffset = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (signatureOffset !== -1 && signatureOffset + 7 < buffer.length) {
      return {
        width: buffer.readUInt16LE(signatureOffset + 3) & 0x3fff,
        height: buffer.readUInt16LE(signatureOffset + 5) & 0x3fff
      };
    }
  }

  if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return null;
};

const readLocalImageSize = async (assetPath: string): Promise<{ width: number | null; height: number | null }> => {
  const absolutePath = path.join(getProjectRoot(), ...assetPath.split('/'));
  const buffer = await readFile(absolutePath);
  const extension = path.extname(assetPath).toLowerCase();

  if (extension === '.svg') {
    return readSvgSize(buffer);
  }

  const readers = [readPngSize, readGifSize, readJpegSize, readWebpSize];
  for (const reader of readers) {
    const result = reader(buffer);
    if (result) return result;
  }

  return { width: null, height: null };
};

const readLocalMediaMeta = async (target: LocalMediaTarget): Promise<AdminMediaMetaResult> => {
  const absolutePath = path.join(getProjectRoot(), ...target.path.split('/'));
  if (!existsSync(absolutePath)) {
    throw new AdminMediaError(`媒体文件不存在：${target.path}`, 404);
  }

  const [{ width, height }, fileStat] = await Promise.all([readLocalImageSize(target.path), stat(absolutePath)]);

  return {
    kind: 'local',
    path: target.path,
    value: target.value,
    origin: target.origin,
    width,
    height,
    size: fileStat.size,
    mimeType: getMimeType(target.path),
    previewSrc: target.previewSrc
  };
};

const resolveLocalTargetFromFieldValue = (field: AdminMediaFieldContext, rawValue: string): LocalMediaTarget | null => {
  const value = rawValue.trim();
  if (!value) {
    throw new AdminMediaError('媒体值为空，无法读取元数据');
  }

  if (field === 'bits.images') {
    const safeRemoteUrl = toSafeHttpUrl(value);
    if (safeRemoteUrl && safeRemoteUrl.startsWith('https://')) return null;

    const normalized = normalizeAdminLocalImageSource(value);
    if (!normalized) {
      throw new AdminMediaError('bits.images 只允许 public/** 下的相对图片路径或 https:// 远程 URL');
    }

    return {
      path: `public/${normalized}`,
      value: normalized,
      origin: 'public',
      previewSrc: `/${normalized}`
    };
  }

  if (field === 'page.bits.defaultAuthor.avatar') {
    const normalized = normalizeBitsAvatarPath(value);
    if (normalized === undefined || !normalized) {
      throw new AdminMediaError('Bits 默认头像只允许相对图片路径（例如 author/avatar.webp）');
    }

    return {
      path: getBitsAvatarLocalFilePath(normalized) ?? `public/${normalized}`,
      value: normalized,
      origin: 'public',
      previewSrc: `/${normalized}`
    };
  }

  const normalized = normalizeHeroImageSrc(value);
  if (!normalized) {
    throw new AdminMediaError('Hero 图片地址为空，无法读取元数据');
  }

  if (/^https?:\/\//i.test(normalized)) return null;

  const localPath = getHeroImageLocalFilePath(normalized);
  if (!localPath) {
    throw new AdminMediaError('Hero 图片地址不支持当前本地路径格式');
  }

  return {
    path: localPath,
    value: normalized,
    origin: localPath.startsWith('public/') ? 'public' : 'src/assets',
    previewSrc: getPreviewSrcFromPath(localPath)
  };
};

const resolveLocalTargetFromPath = (assetPath: string): LocalMediaTarget => {
  const normalizedPath = assetPath.trim().replace(/\\/g, '/');
  if (!normalizedPath || !IMAGE_LOCAL_EXT_RE.test(normalizedPath)) {
    throw new AdminMediaError('媒体路径不是受支持的本地图片文件');
  }

  if (normalizedPath.startsWith('public/')) {
    return {
      path: normalizedPath,
      value: normalizedPath.slice('public/'.length),
      origin: 'public',
      previewSrc: getPreviewSrcFromPath(normalizedPath)
    };
  }

  if (normalizedPath.startsWith('src/assets/')) {
    return {
      path: normalizedPath,
      value: normalizedPath,
      origin: 'src/assets',
      previewSrc: null
    };
  }

  if (normalizedPath.startsWith('src/content/')) {
    return {
      path: normalizedPath,
      value: normalizedPath,
      origin: 'src/content',
      previewSrc: null
    };
  }

  throw new AdminMediaError('媒体路径必须位于 public/**、src/assets/** 或 src/content/**');
};

export const getAdminMediaMeta = async (input: AdminMediaMetaInput): Promise<AdminMediaMetaResult> => {
  const rawPath = 'path' in input && typeof input.path === 'string' ? input.path.trim() : '';
  if (rawPath) {
    return readLocalMediaMeta(resolveLocalTargetFromPath(rawPath));
  }

  const rawValue = 'value' in input && typeof input.value === 'string' ? input.value.trim() : '';
  if (!('field' in input) || !input.field) {
    throw new AdminMediaError('缺少 field 或 path，无法读取媒体元数据');
  }

  if (!rawValue) {
    throw new AdminMediaError('缺少媒体值，无法读取元数据');
  }

  const safeRemoteUrl = toSafeHttpUrl(rawValue);
  if (safeRemoteUrl && /^https?:\/\//i.test(safeRemoteUrl)) {
    return {
      kind: 'remote',
      path: null,
      value: safeRemoteUrl,
      origin: null,
      width: null,
      height: null,
      size: null,
      mimeType: null,
      previewSrc: safeRemoteUrl
    };
  }

  const localTarget = resolveLocalTargetFromFieldValue(input.field, rawValue);
  if (!localTarget) {
    return {
      kind: 'remote',
      path: null,
      value: rawValue,
      origin: null,
      width: null,
      height: null,
      size: null,
      mimeType: null,
      previewSrc: rawValue
    };
  }

  return readLocalMediaMeta(localTarget);
};

export const listAdminMediaItems = async ({
  field = null,
  directory = '',
  owner = '',
  query = '',
  page = 1,
  limit = 24
}: {
  field?: AdminMediaFieldContext | null;
  directory?: AdminMediaDirectory;
  owner?: string;
  query?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AdminMediaListResult> => {
  const normalizedQuery = query.trim().toLowerCase();
  const ownerOptions = directory === 'src/content' ? await loadContentOwnerOptions() : [];
  const normalizedOwner = directory === 'src/content'
    ? (() => {
        const candidate = normalizeOwnerValue(owner);
        return ownerOptions.some((option) => option.value === candidate) ? candidate : '';
      })()
    : '';
  const assets = await listAdminMediaAssets(directory, ownerOptions);

  const filtered = assets
    .map((asset) => {
      const value = toFieldValue(field, asset);
      if (!value) return null;
      return { ...asset, value };
    })
    .filter((asset): asset is AdminMediaAssetRecord & { value: string } => asset !== null)
    .filter((asset) => !normalizedOwner || asset.owner === normalizedOwner)
    .filter((asset) => matchesMediaQuery(asset, normalizedQuery))
    .sort((left, right) => sortMediaAssets(field, left, right));

  const safeLimit = Math.max(1, Math.min(limit, 60));
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * safeLimit;
  const pageItems = filtered.slice(startIndex, startIndex + safeLimit);

  const items = await Promise.all(
    pageItems.map(async (item) => {
      const meta = await readLocalMediaMeta({
        path: item.path,
        value: item.value,
        origin: item.origin,
        previewSrc: getPreviewSrcFromPath(item.path)
      });

      return {
        path: item.path,
        value: item.value,
        origin: item.origin,
        fileName: item.fileName,
        owner: item.owner,
        ownerLabel: item.ownerLabel,
        width: meta.width,
        height: meta.height,
        size: meta.size,
        mimeType: meta.mimeType,
        previewSrc: meta.previewSrc
      } satisfies AdminMediaListItem;
    })
  );

  return {
    field,
    directory,
    owner: normalizedOwner,
    ownerOptions,
    page: safePage,
    limit: safeLimit,
    totalCount: filtered.length,
    totalPages,
    items
  };
};

export const getAdminMediaListRequest = (searchParams: URLSearchParams): {
  field: AdminMediaFieldContext | null;
  directory: AdminMediaDirectory;
  owner: string;
  query: string;
  page: number;
  limit: number;
} => {
  const rawField = (searchParams.get('field') ?? '').trim();
  return {
    field: isAdminMediaFieldContext(rawField) ? rawField : null,
    directory: normalizeAdminMediaDirectory(searchParams.get('dir')),
    owner: normalizeOwnerValue(searchParams.get('owner')),
    query: normalizeSearchQuery(searchParams.get('q')),
    page: normalizePositiveInteger(searchParams.get('page'), { fallback: 1 }),
    limit: normalizePositiveInteger(searchParams.get('limit'), { fallback: 24, max: 60 })
  };
};
