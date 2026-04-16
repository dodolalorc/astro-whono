import { createWithBase } from '../../utils/format';
import { formatAdminMediaMetaSummary } from '../admin-shared/media-client';
import type { AdminMediaPickerController, AdminMediaPickerField } from '../admin-shared/media-picker';

type StatusSetter = (
  state: string,
  text: string,
  options?: { announce?: boolean }
) => void;

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

type ThemeMediaFieldConfig = {
  field: AdminMediaPickerField;
  inputId: string;
  buttonSelector: string;
  pickerTitle: string;
  pickerDescription: string;
};

type ThemeMediaFieldState = {
  enabled?: boolean;
  inactivePreviewText?: string;
  inactiveMetaText?: string;
};

type ThemeMediaPreviewState =
  | { kind: 'hidden' }
  | { kind: 'image'; src: string }
  | { kind: 'placeholder'; text: string };

const FIELD_CONFIGS: readonly ThemeMediaFieldConfig[] = [
  {
    field: 'home.heroImageSrc',
    inputId: 'home-hero-image-src',
    buttonSelector: '[data-admin-media-open="home.heroImageSrc"]',
    pickerTitle: '为 Hero 选择本地图片',
    pickerDescription: '支持 src/assets/** 与 public/**，保存仍复用 Theme Console 现有写盘链路。'
  },
  {
    field: 'page.bits.defaultAuthor.avatar',
    inputId: 'page-bits-author-avatar',
    buttonSelector: '[data-admin-media-open="page.bits.defaultAuthor.avatar"]',
    pickerTitle: '为 Bits 默认头像选择本地图片',
    pickerDescription: '仅列出可直接写入 page.bits.defaultAuthor.avatar 的本地 public/** 资源。'
  }
];

const getPreviewSrc = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('src/assets/')) return null;
  return withBase(normalized.startsWith('/') ? normalized : `/${normalized}`);
};

const getDefaultPreviewSrc = (previewWrap: HTMLElement | null): string | null =>
  previewWrap?.dataset.adminMediaDefaultPreviewSrc?.trim() || null;

const setPreview = (
  previewWrap: HTMLElement | null,
  previewImg: HTMLImageElement | null,
  previewPlaceholder: HTMLElement | null,
  state: ThemeMediaPreviewState
): void => {
  if (!(previewWrap instanceof HTMLElement)) return;

  previewWrap.dataset.adminMediaPreviewState = state.kind;

  if (state.kind === 'hidden') {
    previewWrap.hidden = true;
    previewImg?.removeAttribute('src');
    if (previewImg instanceof HTMLImageElement) previewImg.hidden = true;
    if (previewPlaceholder instanceof HTMLElement) {
      previewPlaceholder.textContent = '';
      previewPlaceholder.hidden = true;
    }
    return;
  }

  previewWrap.hidden = false;

  if (state.kind === 'image') {
    if (!(previewImg instanceof HTMLImageElement)) {
      previewWrap.hidden = true;
      return;
    }
    previewImg.src = state.src;
    previewImg.hidden = false;
    if (previewPlaceholder instanceof HTMLElement) {
      previewPlaceholder.textContent = '';
      previewPlaceholder.hidden = true;
    }
    return;
  }

  previewImg?.removeAttribute('src');
  if (previewImg instanceof HTMLImageElement) previewImg.hidden = true;
  if (!(previewPlaceholder instanceof HTMLElement)) {
    previewWrap.hidden = true;
    return;
  }
  previewPlaceholder.textContent = state.text;
  previewPlaceholder.hidden = false;
};

const setMetaText = (metaEl: HTMLElement | null, text: string): void => {
  if (!(metaEl instanceof HTMLElement)) return;
  metaEl.textContent = text;
  metaEl.hidden = text.trim().length === 0;
};

export const createAdminThemeMediaFields = ({
  root,
  picker,
  setStatus,
  getFieldState = () => ({ enabled: true })
}: {
  root: ParentNode;
  picker: AdminMediaPickerController | null;
  setStatus: StatusSetter;
  getFieldState?: (field: AdminMediaPickerField) => ThemeMediaFieldState;
}) => {
  const bindings = FIELD_CONFIGS.map((config) => {
    const input = root.querySelector<HTMLInputElement>(`#${config.inputId}`);
    const button = root.querySelector<HTMLButtonElement>(config.buttonSelector);
    const metaEl = root.querySelector<HTMLElement>(`[data-admin-media-meta="${config.field}"]`);
    const previewWrap = root.querySelector<HTMLElement>(`[data-admin-media-preview="${config.field}"]`);
    const previewImg = root.querySelector<HTMLImageElement>(`[data-admin-media-preview-img="${config.field}"]`);
    const previewPlaceholder = root.querySelector<HTMLElement>(
      `[data-admin-media-preview-placeholder="${config.field}"]`
    );
    return {
      config,
      input,
      button,
      metaEl,
      previewWrap,
      previewImg,
      previewPlaceholder
    };
  }).filter((binding) => binding.input instanceof HTMLInputElement);

  if (!bindings.length) return null;

  const updateField = async (field: AdminMediaPickerField) => {
    const binding = bindings.find((item) => item.config.field === field);
    if (!binding || !(binding.input instanceof HTMLInputElement)) return;

    const state = getFieldState(field);
    const isEnabled = state.enabled !== false;
    if (binding.button instanceof HTMLButtonElement) {
      binding.button.disabled = !isEnabled || binding.input.disabled;
    }

    if (!isEnabled) {
      setMetaText(binding.metaEl, state.inactiveMetaText ?? '');
      setPreview(
        binding.previewWrap,
        binding.previewImg,
        binding.previewPlaceholder,
        state.inactivePreviewText
          ? { kind: 'placeholder', text: state.inactivePreviewText }
          : { kind: 'hidden' }
      );
      return;
    }

    const value = binding.input.value.trim();
    if (!value) {
      setMetaText(binding.metaEl, '');
      const defaultPreviewSrc = getDefaultPreviewSrc(binding.previewWrap);
      setPreview(
        binding.previewWrap,
        binding.previewImg,
        binding.previewPlaceholder,
        defaultPreviewSrc ? { kind: 'image', src: defaultPreviewSrc } : { kind: 'hidden' }
      );
      return;
    }

    const previewSrc = getPreviewSrc(value);
    setPreview(
      binding.previewWrap,
      binding.previewImg,
      binding.previewPlaceholder,
      previewSrc ? { kind: 'image', src: previewSrc } : { kind: 'hidden' }
    );

    if (!picker) {
      setMetaText(binding.metaEl, '当前页面未挂载 media picker');
      return;
    }

    try {
      const meta = await picker.readMeta({
        field,
        value
      });
      if (binding.input.value.trim() !== value) return;
      if (getFieldState(field).enabled === false) return;
      if (meta.previewSrc) {
        setPreview(
          binding.previewWrap,
          binding.previewImg,
          binding.previewPlaceholder,
          { kind: 'image', src: meta.previewSrc }
        );
      }
      setMetaText(binding.metaEl, formatAdminMediaMetaSummary(meta));
    } catch (error) {
      if (binding.input.value.trim() !== value) return;
      if (getFieldState(field).enabled === false) return;
      setMetaText(binding.metaEl, error instanceof Error ? error.message : '路径暂时无法读取');
    }
  };

  bindings.forEach((binding) => {
    if (!(binding.input instanceof HTMLInputElement)) return;

    binding.input.addEventListener('input', () => {
      setMetaText(binding.metaEl, '等待确认路径并读取元数据');
    });
    binding.input.addEventListener('change', () => {
      void updateField(binding.config.field);
    });

    binding.button?.addEventListener('click', () => {
      if (getFieldState(binding.config.field).enabled === false) return;
      if (!picker) {
        setStatus('warn', '当前页面未挂载 media picker');
        return;
      }

      picker.open({
        field: binding.config.field,
        title: binding.config.pickerTitle,
        description: binding.config.pickerDescription,
        query: binding.input?.value ?? '',
        onSelect: (item) => {
          if (!(binding.input instanceof HTMLInputElement)) return;
          if (getFieldState(binding.config.field).enabled === false) return;
          binding.input.value = item.value;
          binding.input.dispatchEvent(new Event('input', { bubbles: true }));
          binding.input.dispatchEvent(new Event('change', { bubbles: true }));
          setStatus('ok', `已选择本地图片：${item.value}`);
        }
      });
    });

    void updateField(binding.config.field);
  });

  return {
    refresh: (field: AdminMediaPickerField) => {
      void updateField(field);
    },
    refreshAll: () => {
      bindings.forEach((binding) => {
        void updateField(binding.config.field);
      });
    }
  };
};
