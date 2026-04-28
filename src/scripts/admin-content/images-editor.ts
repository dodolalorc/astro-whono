import { getAdminImageFieldPreviewSrc } from '../../lib/admin-console/image-params';
import { formatAdminImageMetaSummary } from '../admin-shared/image-client';
import type { AdminImagePickerController } from '../admin-shared/image-picker';

type StatusSetter = (
  state: 'idle' | 'loading' | 'ready' | 'ok' | 'warn' | 'error',
  text: string,
  options?: { announce?: boolean }
) => void;

type SerializedImageRow = {
  src: string;
  width: string;
  height: string;
  alt?: string;
};

type ImageRowRefs = {
  row: HTMLElement;
  titleEl: HTMLElement | null;
  srcField: HTMLElement | null;
  srcInput: HTMLInputElement | null;
  widthField: HTMLElement | null;
  widthInput: HTMLInputElement | null;
  heightField: HTMLElement | null;
  heightInput: HTMLInputElement | null;
  altInput: HTMLInputElement | null;
  metaEl: HTMLElement | null;
  previewWrap: HTMLElement | null;
  previewImg: HTMLImageElement | null;
  removeBtn: HTMLButtonElement | null;
  pickBtn: HTMLButtonElement | null;
  srcError: HTMLElement | null;
  widthError: HTMLElement | null;
  heightError: HTMLElement | null;
};

const base = import.meta.env.BASE_URL ?? '/';

const getRowRefs = (row: HTMLElement): ImageRowRefs => ({
  row,
  titleEl: row.querySelector<HTMLElement>('[data-admin-content-image-title], .admin-content-image-row__title'),
  srcField: row.querySelector<HTMLElement>('[data-field-path$=".src"]'),
  srcInput: row.querySelector<HTMLInputElement>('[data-admin-content-image-src]'),
  widthField: row.querySelector<HTMLElement>('[data-field-path$=".width"]'),
  widthInput: row.querySelector<HTMLInputElement>('[data-admin-content-image-width]'),
  heightField: row.querySelector<HTMLElement>('[data-field-path$=".height"]'),
  heightInput: row.querySelector<HTMLInputElement>('[data-admin-content-image-height]'),
  altInput: row.querySelector<HTMLInputElement>('[data-admin-content-image-alt]'),
  metaEl: row.querySelector<HTMLElement>('[data-admin-content-image-meta]'),
  previewWrap: row.querySelector<HTMLElement>('[data-admin-content-image-preview]'),
  previewImg: row.querySelector<HTMLImageElement>('[data-admin-content-image-preview-img]'),
  removeBtn: row.querySelector<HTMLButtonElement>('[data-admin-content-image-remove]'),
  pickBtn: row.querySelector<HTMLButtonElement>('[data-admin-content-image-pick]'),
  srcError: row.querySelector<HTMLElement>('[data-field-error$=".src"]'),
  widthError: row.querySelector<HTMLElement>('[data-field-error$=".width"]'),
  heightError: row.querySelector<HTMLElement>('[data-field-error$=".height"]')
});

const getPreviewSrc = (value: string): string | null =>
  getAdminImageFieldPreviewSrc('bits.images', value, base);

const setPreview = (refs: ImageRowRefs, value: string) => {
  const previewSrc = getPreviewSrc(value);
  if (!(refs.previewWrap instanceof HTMLElement) || !(refs.previewImg instanceof HTMLImageElement)) return;
  if (!previewSrc) {
    refs.previewWrap.hidden = true;
    refs.previewImg.removeAttribute('src');
    return;
  }
  refs.previewImg.src = previewSrc;
  refs.previewWrap.hidden = false;
};

const setMeta = (refs: ImageRowRefs, text: string) => {
  if (!(refs.metaEl instanceof HTMLElement)) return;
  refs.metaEl.textContent = text;
};

const clearRowErrors = (refs: ImageRowRefs) => {
  [refs.srcField, refs.widthField, refs.heightField].forEach((field) => field?.classList.remove('is-invalid'));
  [refs.srcError, refs.widthError, refs.heightError].forEach((error) => {
    if (!error) return;
    error.hidden = true;
    error.textContent = '';
  });
};

const serializeRows = (rows: readonly ImageRowRefs[]): string => {
  const items = rows
    .map((refs) => {
      const src = refs.srcInput?.value.trim() ?? '';
      const width = refs.widthInput?.value.trim() ?? '';
      const height = refs.heightInput?.value.trim() ?? '';
      const alt = refs.altInput?.value.trim() ?? '';
      if (!src && !width && !height && !alt) return null;
      return {
        src,
        width,
        height,
        ...(alt ? { alt } : {})
      };
    })
    .filter((item): item is SerializedImageRow => item !== null);

  return items.length > 0 ? JSON.stringify(items, null, 2) : '';
};

const renumberRows = (rows: readonly ImageRowRefs[]) => {
  rows.forEach((refs, index) => {
    refs.titleEl && (refs.titleEl.textContent = `图片 #${index + 1}`);
    if (refs.srcField) refs.srcField.dataset.fieldPath = `images[${index}].src`;
    if (refs.widthField) refs.widthField.dataset.fieldPath = `images[${index}].width`;
    if (refs.heightField) refs.heightField.dataset.fieldPath = `images[${index}].height`;
    if (refs.srcError) refs.srcError.dataset.fieldError = `images[${index}].src`;
    if (refs.widthError) refs.widthError.dataset.fieldError = `images[${index}].width`;
    if (refs.heightError) refs.heightError.dataset.fieldError = `images[${index}].height`;
  });
};

export const initAdminContentBitsImagesEditor = ({
  root,
  picker,
  setStatus
}: {
  root: HTMLElement;
  picker: AdminImagePickerController | null;
  setStatus: StatusSetter;
}) => {
  const editor = root.querySelector<HTMLElement>('#admin-content-image-editor');
  const hiddenInput = root.querySelector<HTMLInputElement>('#admin-content-images-json');
  const addButton = root.querySelector<HTMLButtonElement>('#admin-content-image-add');
  const template = root.querySelector<HTMLTemplateElement>('#admin-content-image-row-template');
  if (!(editor instanceof HTMLElement) || !(hiddenInput instanceof HTMLInputElement) || !(addButton instanceof HTMLButtonElement) || !(template instanceof HTMLTemplateElement)) {
    return null;
  }

  const syncHiddenInput = () => {
    const rows = Array.from(editor.querySelectorAll<HTMLElement>('[data-admin-content-image-row]')).map(getRowRefs);
    renumberRows(rows);
    hiddenInput.value = serializeRows(rows);
  };

  const applyMeta = async (refs: ImageRowRefs) => {
    clearRowErrors(refs);
    const value = refs.srcInput?.value.trim() ?? '';
    setPreview(refs, value);
    if (!value) {
      setMeta(refs, '等待选择图片或输入路径');
      return;
    }
    if (!picker) {
      setMeta(refs, '当前页面未挂载 image picker');
      return;
    }

    try {
      const meta = await picker.readMeta({ field: 'bits.images', value });
      if ((refs.srcInput?.value.trim() ?? '') !== value) return;
      setMeta(refs, formatAdminImageMetaSummary(meta));
      if (meta.kind === 'local' && refs.widthInput && refs.heightInput) {
        if (meta.width) refs.widthInput.value = String(meta.width);
        if (meta.height) refs.heightInput.value = String(meta.height);
      }
    } catch (error) {
      if ((refs.srcInput?.value.trim() ?? '') !== value) return;
      setMeta(refs, error instanceof Error ? error.message : '路径暂时无法读取');
    } finally {
      syncHiddenInput();
    }
  };

  const bindRow = (row: HTMLElement) => {
    const refs = getRowRefs(row);

    refs.srcInput?.addEventListener('input', () => {
      clearRowErrors(refs);
      setPreview(refs, refs.srcInput?.value ?? '');
      syncHiddenInput();
    });
    refs.srcInput?.addEventListener('change', () => {
      void applyMeta(refs);
    });
    refs.widthInput?.addEventListener('input', syncHiddenInput);
    refs.heightInput?.addEventListener('input', syncHiddenInput);
    refs.altInput?.addEventListener('input', syncHiddenInput);

    refs.removeBtn?.addEventListener('click', () => {
      const rows = editor.querySelectorAll<HTMLElement>('[data-admin-content-image-row]');
      if (rows.length <= 1) {
        refs.srcInput && (refs.srcInput.value = '');
        refs.widthInput && (refs.widthInput.value = '');
        refs.heightInput && (refs.heightInput.value = '');
        refs.altInput && (refs.altInput.value = '');
        setPreview(refs, '');
        setMeta(refs, '等待选择图片或输入路径');
      } else {
        row.remove();
      }
      syncHiddenInput();
    });

    refs.pickBtn?.addEventListener('click', () => {
      if (!picker) {
        setStatus('warn', '当前页面未挂载 image picker');
        return;
      }
      picker.open({
        field: 'bits.images',
        title: '为 bits.images 选择本地图片',
        description: '仅列出可直接写入 `bits.images[*].src` 的本地 public/** 资源。',
        query: refs.srcInput?.value ?? '',
        onSelect: (item) => {
          if (refs.srcInput) refs.srcInput.value = item.value;
          if (refs.widthInput && item.width) refs.widthInput.value = String(item.width);
          if (refs.heightInput && item.height) refs.heightInput.value = String(item.height);
          setPreview(refs, item.value);
          setMeta(refs, formatAdminImageMetaSummary({ kind: 'local', origin: item.origin, width: item.width, height: item.height, size: item.size }));
          syncHiddenInput();
          setStatus('ok', `已选择本地图片：${item.value}`);
        }
      });
    });

    setPreview(refs, refs.srcInput?.value ?? '');
    if ((refs.srcInput?.value ?? '').trim()) {
      void applyMeta(refs);
    } else {
      setMeta(refs, '等待选择图片或输入路径');
    }
  };

  Array.from(editor.querySelectorAll<HTMLElement>('[data-admin-content-image-row]')).forEach(bindRow);
  syncHiddenInput();

  addButton.addEventListener('click', () => {
    const nextRow = template.content.firstElementChild?.cloneNode(true);
    if (!(nextRow instanceof HTMLElement)) return;
    editor.appendChild(nextRow);
    bindRow(nextRow);
    syncHiddenInput();
    nextRow.querySelector<HTMLInputElement>('[data-admin-content-image-src]')?.focus();
  });

  return {
    syncHiddenInput
  };
};
