import { formatAdminMediaMetaSummary, type AdminMediaPickerItem } from '../admin-shared/media-picker';

type AdminMediaDirectory =
  | ''
  | 'public'
  | 'public/author'
  | 'public/bits'
  | 'public/images'
  | 'src/assets'
  | 'src/content';

type AdminMediaOwnerOption = {
  value: string;
  label: string;
};

type AdminMediaListItem = AdminMediaPickerItem & {
  owner: string | null;
  ownerLabel: string | null;
};

type AdminMediaBootstrap = {
  listEndpoint: string;
  initialState: {
    directory: AdminMediaDirectory;
    query: string;
    owner: string;
    page: number;
  };
};

type AdminMediaListResponse = {
  directory: AdminMediaDirectory;
  owner: string;
  ownerOptions: AdminMediaOwnerOption[];
  items: AdminMediaListItem[];
  page: number;
  totalPages: number;
  totalCount: number;
};

type AdminMediaState = {
  directory: AdminMediaDirectory;
  query: string;
  owner: string;
  page: number;
};

const root = document.querySelector<HTMLElement>('[data-admin-media-root]');
const DEFAULT_DIRECTORY: AdminMediaDirectory = 'public';
const LARGE_FILE_THRESHOLD = 500 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const parseBootstrap = (text: string): AdminMediaBootstrap | null => {
  try {
    const payload = JSON.parse(text) as unknown;
    if (!isRecord(payload) || typeof payload.listEndpoint !== 'string' || !isRecord(payload.initialState)) {
      return null;
    }

    return {
      listEndpoint: payload.listEndpoint,
      initialState: {
        directory: typeof payload.initialState.directory === 'string'
          ? payload.initialState.directory as AdminMediaDirectory
          : DEFAULT_DIRECTORY,
        query: typeof payload.initialState.query === 'string' ? payload.initialState.query : '',
        owner: typeof payload.initialState.owner === 'string' ? payload.initialState.owner : '',
        page: typeof payload.initialState.page === 'number' && payload.initialState.page > 0
          ? payload.initialState.page
          : 1
      }
    };
  } catch {
    return null;
  }
};

const parseListResponse = (payload: unknown): AdminMediaListResponse => {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.result) || !Array.isArray(payload.result.items)) {
    throw new Error('媒体列表响应格式无效');
  }

  return {
    directory: typeof payload.result.directory === 'string'
      ? payload.result.directory as AdminMediaDirectory
      : DEFAULT_DIRECTORY,
    owner: typeof payload.result.owner === 'string' ? payload.result.owner : '',
    ownerOptions: Array.isArray(payload.result.ownerOptions)
      ? payload.result.ownerOptions
          .filter((option): option is AdminMediaOwnerOption =>
            isRecord(option) && typeof option.value === 'string' && typeof option.label === 'string'
          )
      : [],
    items: payload.result.items.filter((item): item is AdminMediaListItem =>
      isRecord(item)
      && typeof item.path === 'string'
      && (item.owner === null || typeof item.owner === 'string')
      && (item.ownerLabel === null || typeof item.ownerLabel === 'string')
    ),
    page: typeof payload.result.page === 'number' ? payload.result.page : 1,
    totalPages: typeof payload.result.totalPages === 'number' ? payload.result.totalPages : 1,
    totalCount: typeof payload.result.totalCount === 'number' ? payload.result.totalCount : 0
  };
};

const getResponseErrors = (payload: unknown): string[] =>
  isRecord(payload) && Array.isArray(payload.errors)
    ? payload.errors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const fetchList = async (endpoint: string, state: AdminMediaState): Promise<AdminMediaListResponse> => {
  const params = new URLSearchParams({
    dir: state.directory,
    page: String(state.page),
    limit: '24'
  });
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.owner.trim()) params.set('owner', state.owner.trim());

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(getResponseErrors(payload)[0] ?? `媒体列表请求失败（HTTP ${response.status}）`);
  }
  return parseListResponse(payload);
};

const updateUrl = (state: AdminMediaState) => {
  const url = new URL(window.location.href);
  if (state.directory && state.directory !== DEFAULT_DIRECTORY) {
    url.searchParams.set('dir', state.directory);
  } else {
    url.searchParams.delete('dir');
  }

  if (state.query.trim()) {
    url.searchParams.set('q', state.query.trim());
  } else {
    url.searchParams.delete('q');
  }

  if (state.owner.trim()) {
    url.searchParams.set('owner', state.owner.trim());
  } else {
    url.searchParams.delete('owner');
  }

  if (state.page > 1) {
    url.searchParams.set('page', String(state.page));
  } else {
    url.searchParams.delete('page');
  }

  history.replaceState(null, '', `${url.pathname}${url.search}`);
};

if (root) {
  const bootstrapEl = byId<HTMLDivElement>('admin-media-bootstrap');
  const formEl = byId<HTMLFormElement>('admin-media-form');
  const directorySelect = byId<HTMLSelectElement>('admin-media-directory');
  const ownerFieldEl = byId<HTMLElement>('admin-media-owner-field');
  const ownerSelect = byId<HTMLSelectElement>('admin-media-owner');
  const queryInput = byId<HTMLInputElement>('admin-media-query');
  const statusLiveEl = byId<HTMLElement>('admin-media-status-live');
  const statusEl = byId<HTMLElement>('admin-media-status');
  const resultsSummaryEl = byId<HTMLElement>('admin-media-results-summary');
  const resultsCountEl = byId<HTMLElement>('admin-media-results-count');
  const resultsPageEl = byId<HTMLElement>('admin-media-results-page');
  const pageMetaEl = byId<HTMLElement>('admin-media-page-meta');
  const resultListEl = byId<HTMLElement>('admin-media-result-list');
  const emptyEl = byId<HTMLElement>('admin-media-empty');
  const prevBtn = byId<HTMLButtonElement>('admin-media-prev');
  const nextBtn = byId<HTMLButtonElement>('admin-media-next');
  const resetBtn = byId<HTMLButtonElement>('admin-media-reset');

  if (
    !bootstrapEl
    || !formEl
    || !directorySelect
    || !ownerFieldEl
    || !ownerSelect
    || !queryInput
    || !statusLiveEl
    || !statusEl
    || !resultsSummaryEl
    || !resultsCountEl
    || !resultsPageEl
    || !pageMetaEl
    || !resultListEl
    || !emptyEl
    || !prevBtn
    || !nextBtn
    || !resetBtn
  ) {
    // Required controls are missing.
  } else {
    const bootstrap = parseBootstrap(bootstrapEl.textContent ?? '');
    if (!bootstrap) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = '媒体库初始化失败';
    } else {
      let busy = false;
      let requestToken = 0;
      let currentTotalPages = 1;
      let currentOwnerOptions: AdminMediaOwnerOption[] = [];
      let currentState: AdminMediaState = {
        directory: bootstrap.initialState.directory || DEFAULT_DIRECTORY,
        query: bootstrap.initialState.query,
        owner: bootstrap.initialState.owner,
        page: bootstrap.initialState.page
      };

      const setStatus = (
        state: 'idle' | 'loading' | 'ok' | 'warn' | 'error',
        message: string,
        announce = true
      ) => {
        statusEl.dataset.state = state;
        statusEl.textContent = message;
        if (announce) statusLiveEl.textContent = message;
      };

      const getResultsSummary = (totalCount: number): string => {
        if (totalCount <= 0) {
          return '没有找到符合条件的图片，可以换个分类或关键词再试。';
        }

        if (currentState.owner) {
          const activeOwner = currentOwnerOptions.find((option) => option.value === currentState.owner);
          const ownerLabel = activeOwner?.label ?? '当前内容';
          return `共找到 ${totalCount} 张图片，当前只显示“${ownerLabel}”下的图片。`;
        }

        if (currentState.directory === 'src/content') {
          return `共找到 ${totalCount} 张图片，可以按所属内容继续缩小范围。`;
        }

        return `共找到 ${totalCount} 张图片，可以直接复制文件路径或打开预览。`;
      };

      const syncBusy = () => {
        directorySelect.disabled = busy;
        ownerSelect.disabled = busy || ownerFieldEl.hidden || currentOwnerOptions.length === 0;
        queryInput.disabled = busy;
        prevBtn.disabled = busy || currentState.page <= 1;
        nextBtn.disabled = busy || currentState.page >= currentTotalPages;
        resetBtn.disabled = busy;
      };

      const syncOwnerField = () => {
        const shouldShow = currentState.directory === 'src/content' && currentOwnerOptions.length > 0;
        ownerFieldEl.hidden = !shouldShow;

        ownerSelect.replaceChildren();
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '全部内容';
        ownerSelect.append(defaultOption);

        currentOwnerOptions.forEach((option) => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.label;
          ownerSelect.append(optionEl);
        });

        ownerSelect.value = currentState.owner;
        if (ownerSelect.value !== currentState.owner) {
          currentState = { ...currentState, owner: '' };
          ownerSelect.value = '';
        }
      };

      const syncControls = () => {
        directorySelect.value = currentState.directory || DEFAULT_DIRECTORY;
        queryInput.value = currentState.query;
        syncOwnerField();
      };

      const copyText = async (text: string, label: string) => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus('ok', `已复制${label}`);
        } catch {
          setStatus('warn', `无法直接复制，请手动复制${label}`);
        }
      };

      const renderItems = (items: readonly AdminMediaListItem[]) => {
        resultListEl.replaceChildren();
        if (!items.length) {
          emptyEl.hidden = false;
          return;
        }

        emptyEl.hidden = true;
        const fragment = document.createDocumentFragment();

        items.forEach((item, index) => {
          const li = document.createElement('li');
          li.className = 'admin-media-list__item';
          li.dataset.origin = item.origin;
          li.style.setProperty('--item-index', String(index));

          const preview = document.createElement('div');
          preview.className = 'admin-media-list__preview';
          if (item.previewSrc) {
            const image = document.createElement('img');
            image.src = item.previewSrc;
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            preview.appendChild(image);
          } else {
            const fallback = document.createElement('span');
            fallback.className = 'admin-media-list__preview-fallback';
            fallback.textContent = item.origin;
            preview.appendChild(fallback);
          }

          const body = document.createElement('div');
          body.className = 'admin-media-list__body';

          const head = document.createElement('div');
          head.className = 'admin-media-list__head';

          const titleBlock = document.createElement('div');
          titleBlock.className = 'admin-media-list__title-block';

          const title = document.createElement('p');
          title.className = 'admin-media-list__title';
          title.textContent = item.fileName;

          const meta = document.createElement('p');
          meta.className = 'admin-media-list__meta';
          meta.textContent = formatAdminMediaMetaSummary({
            kind: 'local',
            origin: item.origin,
            width: item.width,
            height: item.height,
            size: item.size
          });

          titleBlock.append(title, meta);

          const badges = document.createElement('div');
          badges.className = 'admin-media-list__badges';

          const originBadge = document.createElement('span');
          originBadge.className = 'admin-badge admin-media-list__origin-badge';
          originBadge.dataset.origin = item.origin;
          originBadge.textContent = item.origin === 'src/content' ? 'content' : item.origin;
          badges.appendChild(originBadge);

          if (item.size !== null && item.size >= LARGE_FILE_THRESHOLD) {
            const largeBadge = document.createElement('span');
            largeBadge.className = 'admin-badge admin-media-list__badge--warn';
            largeBadge.textContent = '大文件';
            badges.appendChild(largeBadge);
          }

          head.append(titleBlock, badges);

          const valueBlock = document.createElement('div');
          valueBlock.className = 'admin-media-list__paths';

          if (item.ownerLabel) {
            const ownerLabel = document.createElement('p');
            ownerLabel.className = 'admin-media-list__path-label';
            ownerLabel.textContent = '所属内容';
            const ownerValue = document.createElement('p');
            ownerValue.className = 'admin-media-list__owner';
            ownerValue.textContent = item.ownerLabel;
            valueBlock.append(ownerLabel, ownerValue);
          }

          const valueLabelEl = document.createElement('p');
          valueLabelEl.className = 'admin-media-list__path-label';
          valueLabelEl.textContent = '文件路径';
          const valueCode = document.createElement('code');
          valueCode.className = 'admin-media-list__path-code';
          valueCode.textContent = item.path;
          valueCode.title = item.path;
          valueBlock.append(valueLabelEl, valueCode);

          const actions = document.createElement('div');
          actions.className = 'admin-media-list__actions';

          const copyValueBtn = document.createElement('button');
          copyValueBtn.className = 'admin-btn';
          copyValueBtn.type = 'button';
          copyValueBtn.textContent = '复制文件路径';
          copyValueBtn.addEventListener('click', () => {
            void copyText(item.path, '文件路径');
          });
          actions.appendChild(copyValueBtn);

          if (item.previewSrc) {
            const openBtn = document.createElement('a');
            openBtn.className = 'admin-btn admin-btn--ghost';
            openBtn.href = item.previewSrc;
            openBtn.target = '_blank';
            openBtn.rel = 'noreferrer';
            openBtn.textContent = '查看图片';
            actions.appendChild(openBtn);
          }

          if (!item.previewSrc && item.origin !== 'public') {
            const note = document.createElement('p');
            note.className = 'admin-media-list__note';
            note.textContent = '当前只提供路径和尺寸信息。';
            actions.appendChild(note);
          }

          body.append(head, valueBlock, actions);
          li.append(preview, body);
          fragment.appendChild(li);
        });

        resultListEl.appendChild(fragment);
      };

      const loadList = async () => {
        const token = ++requestToken;
        busy = true;
        syncControls();
        syncBusy();
        setStatus('loading', '正在加载图片...', false);

        try {
          const result = await fetchList(bootstrap.listEndpoint, currentState);
          if (token !== requestToken) return;

          currentTotalPages = result.totalPages;
          currentOwnerOptions = result.ownerOptions;
          currentState = {
            directory: result.directory || DEFAULT_DIRECTORY,
            query: currentState.query,
            owner: result.owner,
            page: result.page
          };

          syncControls();
          renderItems(result.items);
          resultsSummaryEl.textContent = getResultsSummary(result.totalCount);
          resultsCountEl.textContent = `${result.totalCount} 张`;
          resultsPageEl.textContent = `第 ${result.page} / ${result.totalPages} 页`;
          pageMetaEl.textContent = `第 ${result.page} / ${result.totalPages} 页`;
          prevBtn.disabled = result.page <= 1;
          nextBtn.disabled = result.page >= result.totalPages;
          updateUrl(currentState);
          setStatus(
            'ok',
            result.totalCount > 0
              ? `已找到 ${result.totalCount} 张图片`
              : '没有找到符合条件的图片'
          );
        } catch (error) {
          currentTotalPages = 1;
          resultListEl.replaceChildren();
          emptyEl.hidden = false;
          resultsSummaryEl.textContent = '图片暂时无法加载，请稍后再试。';
          resultsCountEl.textContent = '0 张';
          resultsPageEl.textContent = '第 1 / 1 页';
          pageMetaEl.textContent = '第 1 / 1 页';
          prevBtn.disabled = true;
          nextBtn.disabled = true;
          setStatus('error', error instanceof Error ? error.message : '图片列表加载失败');
        } finally {
          if (token === requestToken) {
            busy = false;
            syncBusy();
          }
        }
      };

      formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        const nextDirectory = (directorySelect.value || DEFAULT_DIRECTORY) as AdminMediaDirectory;
        currentState = {
          directory: nextDirectory,
          query: queryInput.value.trim(),
          owner: nextDirectory === 'src/content' ? ownerSelect.value.trim() : '',
          page: 1
        };
        void loadList();
      });

      resetBtn.addEventListener('click', () => {
        currentOwnerOptions = [];
        currentState = {
          directory: DEFAULT_DIRECTORY,
          query: '',
          owner: '',
          page: 1
        };
        syncControls();
        void loadList();
      });

      directorySelect.addEventListener('change', () => {
        const nextDirectory = (directorySelect.value || DEFAULT_DIRECTORY) as AdminMediaDirectory;
        if (nextDirectory !== 'src/content') {
          currentOwnerOptions = [];
          currentState = {
            ...currentState,
            directory: nextDirectory,
            owner: ''
          };
        } else {
          currentState = {
            ...currentState,
            directory: nextDirectory
          };
        }
        syncControls();
        syncBusy();
      });

      prevBtn.addEventListener('click', () => {
        if (busy || currentState.page <= 1) return;
        currentState = {
          ...currentState,
          page: currentState.page - 1
        };
        void loadList();
      });

      nextBtn.addEventListener('click', () => {
        if (busy) return;
        currentState = {
          ...currentState,
          page: currentState.page + 1
        };
        void loadList();
      });

      syncControls();
      syncBusy();
      void loadList();
    }
  }
}
