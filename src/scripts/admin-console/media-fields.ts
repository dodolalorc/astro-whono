import { createWithBase } from '../../utils/format';
import type { AdminMediaPickerController, AdminMediaPickerField } from '../admin-shared/media-picker';
import { formatAdminMediaMetaSummary } from '../admin-shared/media-picker';

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
  emptyMeta: string;
  pickerTitle: string;
  pickerDescription: string;
};

const FIELD_CONFIGS: readonly ThemeMediaFieldConfig[] = [
  {
    field: 'home.heroImageSrc',
    inputId: 'home-hero-image-src',
    buttonSelector: '[data-admin-media-open="home.heroImageSrc"]',
    emptyMeta: '留空时回退内置默认图',
    pickerTitle: '为 Hero 选择本地图片',
    pickerDescription: '支持 src/assets/** 与 public/**，保存仍复用 Theme Console 现有写盘链路。'
  },
  {
    field: 'page.bits.defaultAuthor.avatar',
    inputId: 'page-bits-author-avatar',
    buttonSelector: '[data-admin-media-open="page.bits.defaultAuthor.avatar"]',
    emptyMeta: '仅支持 public/** 下的相对图片路径',
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

export const createAdminThemeMediaFields = ({
  root,
  picker,
  setStatus
}: {
  root: ParentNode;
  picker: AdminMediaPickerController | null;
  setStatus: StatusSetter;
}) => {
  const bindings = FIELD_CONFIGS.map((config) => {
    const input = root.querySelector<HTMLInputElement>(`#${config.inputId}`);
    const button = root.querySelector<HTMLButtonElement>(config.buttonSelector);
    const metaEl = root.querySelector<HTMLElement>(`[data-admin-media-meta="${config.field}"]`);
    const previewWrap = root.querySelector<HTMLElement>(`[data-admin-media-preview="${config.field}"]`);
    const previewImg = root.querySelector<HTMLImageElement>(`[data-admin-media-preview-img="${config.field}"]`);
    return {
      config,
      input,
      button,
      metaEl,
      previewWrap,
      previewImg
    };
  }).filter((binding) => binding.input instanceof HTMLInputElement);

  if (!bindings.length) return null;

  const updateField = async (field: AdminMediaPickerField) => {
    const binding = bindings.find((item) => item.config.field === field);
    if (!binding || !(binding.input instanceof HTMLInputElement)) return;

    const value = binding.input.value.trim();
    if (!value) {
      binding.metaEl && (binding.metaEl.textContent = binding.config.emptyMeta);
      if (binding.previewWrap instanceof HTMLElement && binding.previewImg instanceof HTMLImageElement) {
        binding.previewWrap.hidden = true;
        binding.previewImg.removeAttribute('src');
      }
      return;
    }

    const previewSrc = getPreviewSrc(value);
    if (binding.previewWrap instanceof HTMLElement && binding.previewImg instanceof HTMLImageElement) {
      if (previewSrc) {
        binding.previewImg.src = previewSrc;
        binding.previewWrap.hidden = false;
      } else {
        binding.previewWrap.hidden = true;
        binding.previewImg.removeAttribute('src');
      }
    }

    if (!picker) {
      binding.metaEl && (binding.metaEl.textContent = '当前页面未挂载 media picker');
      return;
    }

    try {
      const meta = await picker.readMeta({
        field,
        value
      });
      binding.metaEl && (binding.metaEl.textContent = formatAdminMediaMetaSummary(meta));
    } catch (error) {
      binding.metaEl && (binding.metaEl.textContent = error instanceof Error ? error.message : '路径暂时无法读取');
    }
  };

  bindings.forEach((binding) => {
    if (!(binding.input instanceof HTMLInputElement)) return;

    binding.input.addEventListener('input', () => {
      binding.metaEl && (binding.metaEl.textContent = '等待确认路径并读取元数据');
    });
    binding.input.addEventListener('change', () => {
      void updateField(binding.config.field);
    });

    binding.button?.addEventListener('click', () => {
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
    refreshAll: () => {
      bindings.forEach((binding) => {
        void updateField(binding.config.field);
      });
    }
  };
};
