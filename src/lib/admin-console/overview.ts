import { getCollection, type CollectionEntry } from 'astro:content';
import { PAGE_SIZE_BITS } from '../../../site.config.mjs';
import {
  getBitAnchorId,
  getBitsPagePath,
  getBitSlug,
  getSortedBits,
  type BitsEntry
} from '../bits';
import { getEssaySlug, getSortedEssays, type EssayEntry } from '../content';
import {
  getEditableThemeSettingsState,
  type ThemeSettingsEditableState
} from '../theme-settings';
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
  id: 'settings' | 'data' | 'boundary' | 'workflow';
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
  editableState: ThemeSettingsEditableState
): AdminOverviewChecksSummary => {
  const items: AdminOverviewCheckItem[] = editableState.ok
    ? [
        {
          id: 'settings',
          label: 'Settings 读写',
          status: 'ready',
          statusLabel: CHECK_STATUS_LABELS.ready,
          summary: '当前 settings JSON 可读可写，Theme Console 仍沿用 revision 与事务写盘链路。',
          detail: '若外部改动了本地 settings，服务端会返回最新 revision，阻止静默覆盖。',
          command: null
        },
        {
          id: 'data',
          label: 'Data Console',
          status: 'ready',
          statusLabel: CHECK_STATUS_LABELS.ready,
          summary: 'settings 快照可导出，导入会先走 schema 校验、dry-run 与变更预览。',
          detail: '导入与确认写入继续复用 `/api/admin/settings/`，不额外发明新的写盘协议。',
          command: 'GET /api/admin/data/settings/'
        },
        {
          id: 'boundary',
          label: '后台边界',
          status: 'manual',
          statusLabel: CHECK_STATUS_LABELS.manual,
          summary: 'preview / production 继续保持只读，发布前仍需复跑后台边界检查。',
          detail: '这条检查会覆盖 `/admin/`、`/admin/theme/`、`/admin/data/` 与 admin API 的只读边界。',
          command: 'npm run check:preview-admin && npm run check:prod-artifacts'
        },
        {
          id: 'workflow',
          label: '构建前基线',
          status: 'manual',
          statusLabel: CHECK_STATUS_LABELS.manual,
          summary: '代码与导入导出改动仍以 CLI 校验链为准，不在 Overview 内重复实现一套诊断器。',
          detail: '提交前至少执行类型检查、单测与构建，确保后台改动不破坏公开站点产物。',
          command: 'npm run check && npm test && npm run build'
        }
      ]
    : [
        {
          id: 'settings',
          label: 'Settings 读写',
          status: 'blocked',
          statusLabel: CHECK_STATUS_LABELS.blocked,
          summary: '当前处于 invalid-settings 保护态，Theme Console 已暂停写入。',
          detail: editableState.errors[0] ?? '需先修复 `src/data/settings/*.json` 结构错误后再继续。',
          command: null
        },
        {
          id: 'data',
          label: 'Data Console',
          status: 'blocked',
          statusLabel: CHECK_STATUS_LABELS.blocked,
          summary: '导入导出链路跟随 settings 保护态一起暂停，避免绕过现有事务与校验边界。',
          detail: '先修复本地 settings JSON，再重新执行导出、dry-run 与确认写入。',
          command: null
        },
        {
          id: 'boundary',
          label: '后台边界',
          status: 'manual',
          statusLabel: CHECK_STATUS_LABELS.manual,
          summary: 'preview / production 仍需保持只读，发布前继续复跑后台边界检查。',
          detail: '修复 settings 后，也要确认 `/admin` 与 admin API 没有在静态产物中泄露可写能力。',
          command: 'npm run check:preview-admin && npm run check:prod-artifacts'
        },
        {
          id: 'workflow',
          label: '构建前基线',
          status: 'manual',
          statusLabel: CHECK_STATUS_LABELS.manual,
          summary: '当前 CLI 校验链仍是最终准入门槛，Overview 只负责展示维护摘要，不取代 CI。',
          detail: '修复 settings 结构问题后，再继续执行类型检查、单测与构建。',
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
    statusLine: blockedCount > 0
      ? `当前有 ${blockedCount} 项阻塞，${readyCount} 项就绪，${manualCount} 项需手动复核。`
      : `当前 ${readyCount} 项已就绪，${manualCount} 项需在提交前手动复核。`,
    footer: blockedCount > 0
      ? '修复 settings 结构问题前，不要继续导入导出或宣告 Phase 1 已完全可用。'
      : 'Phase 1 先展示当前维护检查摘要；完整结构化问题聚合与最近检查结果留待 Phase 3。',
    items
  };
};

export const getAdminOverviewData = async (): Promise<AdminOverviewData> => {
  const [essays, bits, memos] = await Promise.all([
    getSortedEssays({ includeDraft: true }),
    getSortedBits(),
    getCollection('memo').then((entries) => entries.slice().sort(orderByMemoDate))
  ]);
  const editableSettingsState = getEditableThemeSettingsState();

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
    checksSummary: createAdminOverviewChecksSummary(editableSettingsState)
  };
};
