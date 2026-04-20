import {
  ADMIN_IMAGE_BROWSE_GROUP_LABELS,
  ADMIN_IMAGE_BROWSE_GROUP_ORDER,
  isAdminImageBrowseGroup,
  type AdminImageBrowseGroup,
  type AdminImageScopeKey
} from './image-contract';

export type AdminImageBrowseResolvedGroup = Exclude<AdminImageBrowseGroup, 'all'>;

export type AdminImageBrowseFilterOption = {
  value: string;
  label: string;
  count: number;
};

type AdminImageQueryItem = {
  path: string;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
};

export type AdminImageBrowseFacetItem = AdminImageQueryItem & {
  browseGroup: AdminImageBrowseResolvedGroup;
  browseSubgroup: string;
  browseSubgroupLabel: string | null;
};

export type AdminImageScopeIndex = {
  recent: string[];
};

export const normalizeAdminImageBrowseGroup = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase().replace(/\\/g, '/');

export const normalizeAdminImageBrowseSubgroup = (value: string | null | undefined): string =>
  (value ?? '').trim().replace(/\\/g, '/');

const normalizeAdminImageQuery = (query: string): string => query.trim().toLowerCase();

export const matchesAdminImageQuery = (item: AdminImageQueryItem, query: string): boolean => {
  const normalizedQuery = normalizeAdminImageQuery(query);
  if (!normalizedQuery) return true;

  const haystack = `${item.path} ${item.fileName} ${item.owner ?? ''} ${item.ownerLabel ?? ''}`.toLowerCase();
  return haystack.includes(normalizedQuery);
};

export const buildAdminImageBrowseGroupOptions = <
  TItem extends Pick<AdminImageBrowseFacetItem, 'browseGroup'>
>(
  items: readonly TItem[]
): AdminImageBrowseFilterOption[] => {
  const counts = items.reduce((map, item) => {
    map.set(item.browseGroup, (map.get(item.browseGroup) ?? 0) + 1);
    return map;
  }, new Map<AdminImageBrowseResolvedGroup, number>());
  const totalCount = items.length;
  const getGroupCount = (group: AdminImageBrowseGroup): number =>
    group === 'all' ? totalCount : (counts.get(group) ?? 0);

  return ADMIN_IMAGE_BROWSE_GROUP_ORDER.map((group) => ({
    value: group,
    label: ADMIN_IMAGE_BROWSE_GROUP_LABELS[group],
    count: getGroupCount(group)
  }));
};

export const buildAdminImageBrowseSubgroupOptions = <
  TItem extends Pick<AdminImageBrowseFacetItem, 'browseGroup' | 'browseSubgroup' | 'browseSubgroupLabel'>
>(
  group: AdminImageBrowseResolvedGroup,
  items: readonly TItem[]
): AdminImageBrowseFilterOption[] => {
  const subgroupMap = items.reduce((map, item) => {
    if (item.browseGroup !== group || !item.browseSubgroup) return map;
    const current = map.get(item.browseSubgroup);
    if (current) {
      current.count += 1;
      return map;
    }

    map.set(item.browseSubgroup, {
      value: item.browseSubgroup,
      label: item.browseSubgroupLabel ?? item.browseSubgroup,
      count: 1
    });
    return map;
  }, new Map<string, AdminImageBrowseFilterOption>());

  return Array.from(subgroupMap.values()).sort((left, right) => {
    if (/^(?:19|20)\d{2}$/.test(left.value) && /^(?:19|20)\d{2}$/.test(right.value)) {
      return Number.parseInt(right.value, 10) - Number.parseInt(left.value, 10);
    }

    return left.label.localeCompare(right.label, 'zh-CN');
  });
};

export const paginateAdminImageItems = <TItem>({
  items,
  page,
  limit
}: {
  items: readonly TItem[];
  page: number;
  limit: number;
}): {
  items: TItem[];
  page: number;
  totalPages: number;
  totalCount: number;
} => {
  const safeLimit = Math.max(1, limit);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * safeLimit;

  return {
    items: items.slice(startIndex, startIndex + safeLimit),
    page: safePage,
    totalPages,
    totalCount
  };
};

export const resolveAdminImageBrowsePage = <TItem extends AdminImageBrowseFacetItem>({
  items,
  group,
  subgroup,
  query,
  page,
  limit
}: {
  items: readonly TItem[];
  group: string;
  subgroup: string;
  query: string;
  page: number;
  limit: number;
}): {
  query: string;
  isKnownGroup: boolean;
  activeGroup: AdminImageBrowseGroup;
  groupOptions: AdminImageBrowseFilterOption[];
  subgroupOptions: AdminImageBrowseFilterOption[];
  activeSubgroup: string;
  items: TItem[];
  page: number;
  totalPages: number;
  totalCount: number;
} => {
  const normalizedGroup = normalizeAdminImageBrowseGroup(group);
  const normalizedSubgroup = normalizeAdminImageBrowseSubgroup(subgroup);
  const isKnownGroup = isAdminImageBrowseGroup(normalizedGroup);
  const activeGroup: AdminImageBrowseGroup = isKnownGroup ? normalizedGroup : 'all';
  const trimmedQuery = query.trim();
  const queryPool = items.filter((item) => matchesAdminImageQuery(item, trimmedQuery));
  const groupOptions = buildAdminImageBrowseGroupOptions(queryPool);
  const browsePool = (() => {
    if (activeGroup === 'all') return queryPool;
    return queryPool.filter((item) => item.browseGroup === activeGroup);
  })();
  const subgroupOptions = activeGroup !== 'all'
    ? buildAdminImageBrowseSubgroupOptions(activeGroup, browsePool)
    : [];
  const activeSubgroup = activeGroup !== 'all'
    && subgroupOptions.some((option) => option.value === normalizedSubgroup)
    ? normalizedSubgroup
    : '';
  const filteredItems = activeSubgroup
    ? browsePool.filter((item) => item.browseSubgroup === activeSubgroup)
    : browsePool;
  const pagination = paginateAdminImageItems({
    items: filteredItems,
    page,
    limit
  });

  return {
    query: trimmedQuery,
    isKnownGroup,
    activeGroup,
    groupOptions,
    subgroupOptions,
    activeSubgroup,
    ...pagination
  };
};

export const buildAdminImageScopeItems = <
  TItem extends Pick<AdminImageBrowseFacetItem, 'path'>
>(
  scope: AdminImageScopeKey,
  browseIndex: readonly TItem[],
  scopeIndex: AdminImageScopeIndex
): TItem[] => {
  if (scope !== 'recent') return [];

  const orderMap = scopeIndex.recent.reduce((map, assetPath, index) => {
    if (!map.has(assetPath)) {
      map.set(assetPath, index);
    }
    return map;
  }, new Map<string, number>());

  return browseIndex
    .filter((item) => orderMap.has(item.path))
    .sort((left, right) => {
      const leftIndex = orderMap.get(left.path) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.get(right.path) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
};
