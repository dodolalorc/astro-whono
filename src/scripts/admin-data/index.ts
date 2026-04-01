import {
  parseAdminSettingsExportBundle,
  type AdminSettingsExportBundle
} from '../../lib/admin-console/settings-data';

type AdminDataBootstrap = {
  revision: string;
  exportEndpoint: string;
  importEndpoint: string;
};

type WriteGroup = 'site' | 'shell' | 'home' | 'page' | 'ui';

type WriteResult = {
  changed: boolean;
  written: boolean;
};

const root = document.querySelector<HTMLElement>('[data-admin-data-root]');

const GROUP_ORDER: readonly WriteGroup[] = ['site', 'shell', 'home', 'page', 'ui'];
const GROUP_LABELS: Record<WriteGroup, string> = {
  site: 'Site',
  shell: 'Sidebar',
  home: 'Home',
  page: 'Inner Pages',
  ui: 'Reading / Code'
};
const GROUP_FILES: Record<WriteGroup, string> = {
  site: 'src/data/settings/site.json',
  shell: 'src/data/settings/shell.json',
  home: 'src/data/settings/home.json',
  page: 'src/data/settings/page.json',
  ui: 'src/data/settings/ui.json'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];

const parseBootstrap = (value: string): AdminDataBootstrap | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;
    const revision = typeof parsed.revision === 'string' ? parsed.revision.trim() : '';
    const exportEndpoint = typeof parsed.exportEndpoint === 'string' ? parsed.exportEndpoint.trim() : '';
    const importEndpoint = typeof parsed.importEndpoint === 'string' ? parsed.importEndpoint.trim() : '';
    if (!revision || !exportEndpoint || !importEndpoint) return null;
    return {
      revision,
      exportEndpoint,
      importEndpoint
    };
  } catch {
    return null;
  }
};

const getPayloadErrors = (value: unknown): string[] =>
  isRecord(value) ? getStringArray(value.errors) : [];

const getPayloadRevision = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const revision = value.payload.revision;
  return typeof revision === 'string' && revision.trim().length > 0 ? revision.trim() : null;
};

const getPayloadResults = (value: unknown): Partial<Record<WriteGroup, WriteResult>> | null => {
  if (!isRecord(value) || !isRecord(value.results)) return null;
  const resultMap: Partial<Record<WriteGroup, WriteResult>> = {};

  for (const group of GROUP_ORDER) {
    const current = value.results[group];
    if (!isRecord(current)) continue;
    resultMap[group] = {
      changed: current.changed === true,
      written: current.written === true
    };
  }

  return resultMap;
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const getDownloadFileName = (response: Response): string => {
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1]?.trim() || 'astro-whono-settings-export.json';
};

if (!root) {
  // Current page does not use admin data console.
} else {
  const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

  const bootstrapEl = byId<HTMLDivElement>('admin-data-bootstrap');
  const statusLiveEl = byId<HTMLElement>('admin-data-status-live');
  const statusEl = byId<HTMLElement>('admin-data-status');
  const errorBannerEl = byId<HTMLElement>('admin-data-error-banner');
  const errorTitleEl = byId<HTMLElement>('admin-data-error-title');
  const errorMessageEl = byId<HTMLElement>('admin-data-error-message');
  const errorListEl = byId<HTMLElement>('admin-data-error-list');
  const exportBtn = byId<HTMLButtonElement>('admin-data-export');
  const fileInput = byId<HTMLInputElement>('admin-data-file');
  const fileMetaEl = byId<HTMLElement>('admin-data-file-meta');
  const dryRunBtn = byId<HTMLButtonElement>('admin-data-dry-run');
  const applyBtn = byId<HTMLButtonElement>('admin-data-apply');
  const previewEl = byId<HTMLElement>('admin-data-preview');
  const previewTitleEl = byId<HTMLElement>('admin-data-preview-title');
  const previewBodyEl = byId<HTMLElement>('admin-data-preview-body');
  const resultListEl = byId<HTMLElement>('admin-data-result-list');

  if (
    !bootstrapEl
    || !statusLiveEl
    || !statusEl
    || !errorBannerEl
    || !errorTitleEl
    || !errorMessageEl
    || !errorListEl
    || !exportBtn
    || !fileInput
    || !fileMetaEl
    || !dryRunBtn
    || !applyBtn
    || !previewEl
    || !previewTitleEl
    || !previewBodyEl
    || !resultListEl
  ) {
    // Required controls are missing.
  } else {
    const bootstrap = parseBootstrap(bootstrapEl.textContent ?? '');
    if (!bootstrap) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = 'Data Console 初始化失败';
    } else {
      let currentRevision = bootstrap.revision;
      let currentBundle: AdminSettingsExportBundle | null = null;
      let busy = false;
      let lastDryRunKey = '';
      let lastDryRunHasChanges = false;

      const getBundleKey = (bundle: AdminSettingsExportBundle | null): string =>
        bundle ? JSON.stringify(bundle.manifest) : '';

      const setStatus = (
        state: 'idle' | 'loading' | 'ok' | 'warn' | 'error' | 'ready',
        text: string,
        options: {
          announce?: boolean;
        } = {}
      ) => {
        const { announce = true } = options;
        statusEl.dataset.state = state;
        statusEl.textContent = text;
        statusLiveEl.textContent = announce ? text : '';
      };

      const clearErrors = () => {
        errorBannerEl.hidden = true;
        errorMessageEl.hidden = true;
        errorMessageEl.textContent = '';
        errorListEl.hidden = true;
        errorListEl.replaceChildren();
      };

      const setErrors = (
        errors: readonly string[],
        options: {
          title?: string;
          message?: string;
        } = {}
      ) => {
        errorTitleEl.textContent = options.title ?? '导入导出未完成';
        if (options.message) {
          errorMessageEl.hidden = false;
          errorMessageEl.textContent = options.message;
        } else {
          errorMessageEl.hidden = true;
          errorMessageEl.textContent = '';
        }

        errorListEl.replaceChildren();
        if (errors.length > 0) {
          const fragment = document.createDocumentFragment();
          for (const error of errors) {
            const item = document.createElement('li');
            item.className = 'admin-banner__list-item';
            item.textContent = error;
            fragment.appendChild(item);
          }
          errorListEl.appendChild(fragment);
          errorListEl.hidden = false;
        } else {
          errorListEl.hidden = true;
        }

        errorBannerEl.hidden = false;
      };

      const clearPreview = () => {
        previewEl.hidden = true;
        resultListEl.replaceChildren();
      };

      const renderPreview = (
        results: Partial<Record<WriteGroup, WriteResult>> | null,
        options: {
          title: string;
          body: string;
        }
      ) => {
        previewTitleEl.textContent = options.title;
        previewBodyEl.textContent = options.body;
        resultListEl.replaceChildren();

        const changedGroups = GROUP_ORDER.filter((group) => results?.[group]?.changed === true);
        if (changedGroups.length === 0) {
          const item = document.createElement('li');
          item.className = 'admin-data-result-list__item';
          item.textContent = '当前导入快照与本地 settings 一致，不需要写盘。';
          resultListEl.appendChild(item);
          previewEl.hidden = false;
          return;
        }

        const fragment = document.createDocumentFragment();
        for (const group of changedGroups) {
          const item = document.createElement('li');
          item.className = 'admin-data-result-list__item';

          const heading = document.createElement('p');
          heading.className = 'admin-data-result-list__title';
          heading.textContent = `${GROUP_LABELS[group]} · ${results?.[group]?.written ? '已写入' : '将更新'}`;

          const meta = document.createElement('p');
          meta.className = 'admin-data-result-list__meta';
          meta.textContent = GROUP_FILES[group];

          item.append(heading, meta);
          fragment.appendChild(item);
        }

        resultListEl.appendChild(fragment);
        previewEl.hidden = false;
      };

      const renderFileMeta = (bundle: AdminSettingsExportBundle | null, fileName: string | null) => {
        fileMetaEl.replaceChildren();
        if (!bundle || !fileName) {
          fileMetaEl.hidden = true;
          return;
        }

        const rows: Array<[string, string]> = [
          ['文件', fileName],
          ['创建时间', bundle.manifest.createdAt],
          ['schemaVersion', String(bundle.manifest.schemaVersion)],
          ['locale', bundle.manifest.locale ?? '(missing / null)'],
          ['includedScopes', bundle.manifest.includedScopes.join(', ')],
          ['excludes', bundle.manifest.excludes.join(', ')]
        ];

        const fragment = document.createDocumentFragment();
        for (const [label, value] of rows) {
          const dt = document.createElement('dt');
          dt.className = 'admin-data-meta__label';
          dt.textContent = label;

          const dd = document.createElement('dd');
          dd.className = 'admin-data-meta__value';
          dd.textContent = value;

          fragment.append(dt, dd);
        }

        fileMetaEl.appendChild(fragment);
        fileMetaEl.hidden = false;
      };

      const syncButtons = () => {
        const hasBundle = currentBundle !== null;
        const canApply = hasBundle && lastDryRunKey === getBundleKey(currentBundle) && lastDryRunHasChanges;
        exportBtn.disabled = busy;
        dryRunBtn.disabled = busy || !hasBundle;
        applyBtn.disabled = busy || !canApply;
      };

      const postSettingsSnapshot = async (dryRun: boolean) => {
        if (!currentBundle) return;

        busy = true;
        syncButtons();
        clearErrors();
        setStatus('loading', dryRun ? '正在执行 dry-run 校验' : '正在写入 settings');

        try {
          const response = await fetch(
            dryRun ? `${bootstrap.importEndpoint}?dryRun=1` : bootstrap.importEndpoint,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json; charset=utf-8'
              },
              cache: 'no-store',
              body: JSON.stringify({
                revision: currentRevision,
                settings: currentBundle.settings
              })
            }
          );

          const payload = await parseResponseBody(response);
          const latestRevision = getPayloadRevision(payload);
          if (latestRevision) {
            currentRevision = latestRevision;
          }

          if (!response.ok || !isRecord(payload) || payload.ok !== true) {
            lastDryRunKey = '';
            lastDryRunHasChanges = false;
            setStatus(response.status === 409 ? 'warn' : 'error', dryRun ? 'dry-run 未通过' : '写入失败');
            setErrors(
              getPayloadErrors(payload).length > 0
                ? getPayloadErrors(payload)
                : [dryRun ? 'dry-run 校验失败，请检查导入文件与当前配置状态' : '写入 settings 失败，请检查响应与控制台日志'],
              {
                title: response.status === 409 ? '检测到外部更新' : '导入未完成'
              }
            );
            clearPreview();
            return;
          }

          const results = getPayloadResults(payload);
          if (dryRun) {
            lastDryRunKey = getBundleKey(currentBundle);
            lastDryRunHasChanges = GROUP_ORDER.some((group) => results?.[group]?.changed === true);
            renderPreview(results, {
              title: 'dry-run 结果',
              body: '以下分组会在确认写入后更新。真正写盘前，仍会再次执行 revision 校验，避免静默覆盖外部修改。'
            });
            setStatus(results && GROUP_ORDER.some((group) => results[group]?.changed === true) ? 'ok' : 'ready', 'dry-run 校验完成');
          } else {
            lastDryRunKey = '';
            lastDryRunHasChanges = false;
            renderPreview(results, {
              title: '写入结果',
              body: 'settings 快照已按现有事务链路写入；若继续导入其他快照，请重新执行 dry-run。'
            });
            setStatus('ok', 'settings 已写入');
          }
        } catch {
          lastDryRunKey = '';
          lastDryRunHasChanges = false;
          setStatus('error', dryRun ? 'dry-run 请求失败' : '写入请求失败');
          setErrors([dryRun ? 'dry-run 请求失败，请稍后重试' : '写入请求失败，请稍后重试']);
          clearPreview();
        } finally {
          busy = false;
          syncButtons();
        }
      };

      const handleFileChange = async () => {
        clearErrors();
        clearPreview();
        lastDryRunKey = '';
        lastDryRunHasChanges = false;
        currentBundle = null;
        syncButtons();

        const file = fileInput.files?.[0];
        if (!file) {
          renderFileMeta(null, null);
          setStatus('idle', '等待选择导入文件', { announce: false });
          return;
        }

        setStatus('loading', `正在解析 ${file.name}`, { announce: false });
        try {
          const text = await file.text();
          const json = JSON.parse(text) as unknown;
          const parsed = parseAdminSettingsExportBundle(json);
          if (!parsed.ok) {
            renderFileMeta(null, null);
            setStatus('error', '导入文件解析失败');
            setErrors(parsed.errors, {
              title: '导入文件不符合 settings 导出协议'
            });
            return;
          }

          currentBundle = parsed.bundle;
          renderFileMeta(parsed.bundle, file.name);
          setStatus('ready', '导入文件已就绪');
        } catch {
          renderFileMeta(null, null);
          setStatus('error', '导入文件不是合法 JSON');
          setErrors(['所选文件不是合法 JSON，或编码内容已损坏']);
        } finally {
          syncButtons();
        }
      };

      exportBtn.addEventListener('click', async () => {
        busy = true;
        syncButtons();
        clearErrors();
        setStatus('loading', '正在导出 settings 快照');

        try {
          const response = await fetch(bootstrap.exportEndpoint, {
            method: 'GET',
            headers: {
              Accept: 'application/json'
            },
            cache: 'no-store'
          });

          if (!response.ok) {
            const payload = await parseResponseBody(response);
            setStatus(response.status === 409 ? 'warn' : 'error', '导出失败');
            setErrors(
              getPayloadErrors(payload).length > 0
                ? getPayloadErrors(payload)
                : ['当前 settings 状态不可导出，请先修复本地配置后重试'],
              {
                title: response.status === 409 ? 'settings 当前不可导出' : '导出失败'
              }
            );
            return;
          }

          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = downloadUrl;
          anchor.download = getDownloadFileName(response);
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(downloadUrl);
          setStatus('ok', 'settings 快照已导出');
        } catch {
          setStatus('error', '导出请求失败');
          setErrors(['导出请求失败，请检查开发服务器状态后重试']);
        } finally {
          busy = false;
          syncButtons();
        }
      });

      fileInput.addEventListener('change', () => {
        void handleFileChange();
      });

      dryRunBtn.addEventListener('click', () => {
        void postSettingsSnapshot(true);
      });

      applyBtn.addEventListener('click', () => {
        void postSettingsSnapshot(false);
      });

      syncButtons();
      setStatus('idle', '等待选择导入文件或执行导出', { announce: false });
    }
  }
}
