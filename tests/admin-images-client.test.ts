import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchList } from '../src/scripts/admin-images/data';
import {
  DEFAULT_GROUP,
  type AdminImageListItem,
  type AdminImageState
} from '../src/scripts/admin-images/types';

const listItem: AdminImageListItem = {
  path: 'public/images/archive/cover.png',
  origin: 'public',
  fileName: 'cover.png',
  owner: null,
  ownerLabel: null,
  browseGroup: 'pages',
  browseGroupLabel: '页面插图',
  browseSubgroup: 'archive',
  browseSubgroupLabel: '归档',
  preferredValue: '/images/archive/cover.png',
  previewSrc: '/images/archive/cover.png',
  value: '/images/archive/cover.png',
  width: 1200,
  height: 800,
  size: 2048,
  mimeType: 'image/png'
};

const createState = (state: Partial<AdminImageState> = {}): AdminImageState => ({
  scope: '',
  group: DEFAULT_GROUP,
  subgroup: '',
  query: '',
  page: 1,
  ...state
});

const createListPayload = () => ({
  ok: true,
  result: {
    scope: 'recent',
    group: '',
    subgroup: '',
    groupOptions: [],
    subgroupOptions: [],
    items: [listItem],
    page: 1,
    totalPages: 1,
    totalCount: 1
  }
});

const mockListFetch = (payload: unknown) => {
  const requestedUrls: string[] = [];
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    requestedUrls.push(String(input));
    return Response.json(payload);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requestedUrls };
};

describe('admin-images/data', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends recent scope and accepts a matching response contract', async () => {
    const { fetchMock, requestedUrls } = mockListFetch(createListPayload());

    const result = await fetchList(
      '/api/admin/images/list',
      createState({ scope: 'recent', query: 'cover', page: 2 }),
      20
    );

    expect(result.scope).toBe('recent');
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = new URL(requestedUrls[0] ?? '', 'http://127.0.0.1');
    expect(requestUrl.searchParams.get('scope')).toBe('recent');
    expect(requestUrl.searchParams.get('group')).toBeNull();
    expect(requestUrl.searchParams.get('q')).toBe('cover');
    expect(requestUrl.searchParams.get('page')).toBe('2');
  });
});
