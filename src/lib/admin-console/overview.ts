import { getCollection, type CollectionEntry } from 'astro:content';
import { PAGE_SIZE_BITS } from '../../../site.config.mjs';
import {
  getBitAnchorId,
  getBitsPagePath,
  getBitSlug,
  getSortedBits,
  type BitsEntry
} from '../bits';
import { getAdminChecksData } from './checks';
import { getEssaySlug, getSortedEssays, type EssayEntry } from '../content';
import { formatDateTime, formatISODate, formatISODateUtc } from '../../utils/format';

export type AdminOverviewCollectionKey = 'essay' | 'bits' | 'memo';

export type AdminOverviewCollectionSummary = {
  key: AdminOverviewCollectionKey;
  label: string;
  totalCount: number;
  draftCount: number;
};

export type AdminOverviewRecentEntry = {
  collection: AdminOverviewCollectionKey;
  collectionLabel: string;
  title: string;
  id: string;
  slug: string | null;
  href: string;
  isDraft: boolean;
  date: Date | null;
  dateLabel: string;
};

export type AdminOverviewCheckStatus = 'ready' | 'manual' | 'blocked';

export type AdminOverviewCheckItem = {
  id: string;
  label: string;
  status: AdminOverviewCheckStatus;
  statusLabel: string;
  summary: string;
  detail: string;
  command: string | null;
};

export type AdminOverviewChecksSummary = {
  readyCount: number;
  manualCount: number;
  blockedCount: number;
  statusLine: string;
  footer: string;
  items: AdminOverviewCheckItem[];
};

export type AdminOverviewData = {
  collectionSummaries: AdminOverviewCollectionSummary[];
  totalCount: number;
  totalDraftCount: number;
  recentEntries: AdminOverviewRecentEntry[];
  checksSummary: AdminOverviewChecksSummary;
};

type MemoEntry = CollectionEntry<'memo'>;

const COLLECTION_LABELS: Record<AdminOverviewCollectionKey, string> = {
  essay: 'Essay',
  bits: 'Bits',
  memo: 'Memo'
};

const CHECK_STATUS_LABELS: Record<AdminOverviewCheckStatus, string> = {
  ready: '就绪',
  manual: '手动复核',
  blocked: '阻塞'
};

const orderByNullableDateDesc = (left: Date | null, right: Date | null): number =>
  (right?.valueOf() ?? -Infinity) - (left?.valueOf() ?? -Infinity);

const orderByMemoDate = (a: MemoEntry, b: MemoEntry): number =>
  orderByNullableDateDesc(a.data.date ?? null, b.data.date ?? null);

const getRecentEssayEntry = (entry: EssayEntry): AdminOverviewRecentEntry => ({
  collection: 'essay',
  collectionLabel: COLLECTION_LABELS.essay,
  title: entry.data.title,
  id: entry.id,
  slug: getEssaySlug(entry),
  href: `/archive/${getEssaySlug(entry)}/`,
  isDraft: entry.data.draft === true,
  date: entry.data.date,
  dateLabel: formatISODateUtc(entry.data.date)
});

const getRecentBitsEntry = (entry: BitsEntry, index: number): AdminOverviewRecentEntry => {
  const page = Math.floor(index / PAGE_SIZE_BITS) + 1;
  return {
    collection: 'bits',
    collectionLabel: COLLECTION_LABELS.bits,
    title: entry.data.title?.trim() || entry.data.description?.trim() || getBitSlug(entry),
    id: entry.id,
    slug: getBitSlug(entry),
    href: `${getBitsPagePath(page)}#${getBitAnchorId(entry.id)}`,
    isDraft: entry.data.draft === true,
    date: entry.data.date,
    dateLabel: formatDateTime(entry.data.date)
  };
};

const getRecentMemoEntry = (entry: MemoEntry): AdminOverviewRecentEntry => ({
  collection: 'memo',
  collectionLabel: COLLECTION_LABELS.memo,
  title: entry.data.title,
  id: entry.id,
  slug: entry.data.slug ?? null,
  href: '/memo/',
  isDraft: entry.data.draft === true,
  date: entry.data.date ?? null,
  dateLabel: entry.data.date ? formatISODate(entry.data.date) : '未设置日期'
});

export const createAdminOverviewChecksSummary = (
  checksData: Awaited<ReturnType<typeof getAdminChecksData>>
): AdminOverviewChecksSummary => {
  const items: AdminOverviewCheckItem[] = [
    ...checksData.categories.map((category) => {
      const status: AdminOverviewCheckStatus = category.issueCount > 0 ? 'blocked' : 'ready';
      return {
        id: category.id,
        label: category.label,
        status,
        statusLabel: CHECK_STATUS_LABELS[status],
        summary: category.issueCount > 0
          ? `发现 ${category.issueCount} 个问题，建议进入 Checks Console 逐项处理。`
          : '当前分类未发现结构化问题。',
        detail: category.issueCount > 0
          ? category.issues[0]?.message ?? category.description
          : category.description,
        command: null
      };
    }),
    {
      id: 'boundary',
      label: '后台边界',
      status: 'manual' as const,
      statusLabel: CHECK_STATUS_LABELS.manual,
      summary: 'preview / production 继续保持只读，新增后台子路由后仍需复跑边界检查。',
      detail: '发布前请确认 `/admin/`、`/admin/media/`、`/admin/checks/` 与 admin API 没有在静态产物中泄露可写能力。',
      command: 'npm run check:preview-admin && npm run check:prod-artifacts'
    },
    {
      id: 'workflow',
      label: '构建前基线',
      status: 'manual' as const,
      statusLabel: CHECK_STATUS_LABELS.manual,
      summary: 'Checks Console 只覆盖源文件层高价值问题，最终准入仍以 CLI 校验链为准。',
      detail: '提交前至少执行类型检查、单测与构建，确保后台改动不破坏公开站点产物。',
      command: 'npm run check && npm test && npm run build'
    }
  ];

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const manualCount = items.filter((item) => item.status === 'manual').length;
  const blockedCount = items.filter((item) => item.status === 'blocked').length;

  return {
    readyCount,
    manualCount,
    blockedCount,
    statusLine: checksData.totalIssueCount > 0
      ? `当前源文件层发现 ${checksData.totalIssueCount} 个问题，涉及 ${checksData.affectedPathCount} 个文件；另有 ${manualCount} 项 CLI 基线需手动复核。`
      : `当前 ${checksData.readyCategoryCount} 个源文件分类已通过，另有 ${manualCount} 项 CLI 基线需在提交前手动复核。`,
    footer: checksData.totalIssueCount > 0
      ? '先处理 Checks Console 中的结构化问题，再执行 preview/build 基线，避免把本地已知问题带入发布链路。'
      : 'Checks Console 当前未发现源文件层问题；提交前仍需执行 preview/build CLI 基线。',
    items
  };
};

export const getAdminOverviewData = async (): Promise<AdminOverviewData> => {
  const [essays, bits, memos, checksData] = await Promise.all([
    getSortedEssays({ includeDraft: true }),
    getSortedBits(),
    getCollection('memo').then((entries) => entries.slice().sort(orderByMemoDate)),
    getAdminChecksData()
  ]);

  const collectionSummaries: AdminOverviewCollectionSummary[] = [
    {
      key: 'essay',
      label: COLLECTION_LABELS.essay,
      totalCount: essays.length,
      draftCount: essays.filter((entry) => entry.data.draft === true).length
    },
    {
      key: 'bits',
      label: COLLECTION_LABELS.bits,
      totalCount: bits.length,
      draftCount: bits.filter((entry) => entry.data.draft === true).length
    },
    {
      key: 'memo',
      label: COLLECTION_LABELS.memo,
      totalCount: memos.length,
      draftCount: memos.filter((entry) => entry.data.draft === true).length
    }
  ];

  const recentEntries = [
    ...essays.map((entry) => getRecentEssayEntry(entry)),
    ...bits.map((entry, index) => getRecentBitsEntry(entry, index)),
    ...memos.map((entry) => getRecentMemoEntry(entry))
  ]
    .sort((left, right) => orderByNullableDateDesc(left.date, right.date))
    .slice(0, 6);

  return {
    collectionSummaries,
    totalCount: collectionSummaries.reduce((total, summary) => total + summary.totalCount, 0),
    totalDraftCount: collectionSummaries.reduce((total, summary) => total + summary.draftCount, 0),
    recentEntries,
    checksSummary: createAdminOverviewChecksSummary(checksData)
  };
};
