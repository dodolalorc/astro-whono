import {
    ADMIN_FRIEND_LINK_LIMIT,
    ADMIN_FRIEND_LINK_ORDER_MAX
} from '@/lib/admin-console/theme-shared';
import type { EditableFriendLinkItem } from './form-codec';

type Query = <T extends Element>(parent: ParentNode, selector: string) => T | null;
type QueryAll = <T extends Element>(parent: ParentNode, selector: string) => T[];

type FriendLinksContext = {
    query: Query;
    queryAll: QueryAll;
    friendLinksList: HTMLElement;
    friendLinksHead: HTMLElement;
    friendLinksCountEl: HTMLElement;
    friendLinksAddBtn: HTMLButtonElement;
    friendLinksTemplate: HTMLTemplateElement;
};

const parseOrder = (value: string | number | null | undefined, fallback: number): number => {
    const next = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(next) ? next : fallback;
};

export const createFriendLinks = ({
    query,
    queryAll,
    friendLinksList,
    friendLinksHead,
    friendLinksCountEl,
    friendLinksAddBtn,
    friendLinksTemplate
}: FriendLinksContext) => {
    const getFriendRows = (): HTMLElement[] => queryAll<HTMLElement>(friendLinksList, '[data-friend-link-row]');

    const getFriendFieldTarget = (
        index: number,
        field: 'order' | 'name' | 'url' | 'avatar' | 'bio'
    ): (() => HTMLElement | null) => () => {
        const row = getFriendRows()[index] ?? null;
        return row ? query<HTMLElement>(row, `[data-friend-link-field="${field}"]`) : null;
    };

    const getFriendVisibilityTarget = (index: number): (() => HTMLElement | null) => () => {
        const row = getFriendRows()[index] ?? null;
        return row ? query<HTMLElement>(row, '[data-friend-link-action="toggle-visible"]') : null;
    };

    const updateFriendRowsUi = (): void => {
        const rows = getFriendRows();
        friendLinksHead.hidden = false;
        friendLinksCountEl.textContent = `(${rows.length} / ${ADMIN_FRIEND_LINK_LIMIT})`;
        friendLinksAddBtn.disabled = rows.length >= ADMIN_FRIEND_LINK_LIMIT;
    };

    const syncFriendVisibilityButton = (row: HTMLElement): void => {
        const visibleInput = query<HTMLInputElement>(row, '[data-friend-link-field="visible"]');
        const toggleBtn = query<HTMLButtonElement>(row, '[data-friend-link-action="toggle-visible"]');
        const toggleLabel = query<HTMLElement>(row, '[data-friend-link-visible-label]');
        if (!(visibleInput instanceof HTMLInputElement) || !(toggleBtn instanceof HTMLButtonElement) || !(toggleLabel instanceof HTMLElement)) {
            return;
        }

        const visible = Boolean(visibleInput.checked);
        toggleBtn.dataset.state = visible ? 'visible' : 'hidden';
        toggleBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', visible ? '隐藏友链' : '显示友链');
        toggleBtn.setAttribute('title', visible ? '隐藏友链' : '显示友链');
        toggleLabel.textContent = visible ? '隐藏友链' : '显示友链';
    };

    const syncFriendRow = (row: HTMLElement): void => {
        syncFriendVisibilityButton(row);
    };

    const normalizeFriendOrders = (): void => {
        const rows = getFriendRows();
        const ordered = rows
            .map((row, index) => {
                const visible = Boolean(query<HTMLInputElement>(row, '[data-friend-link-field="visible"]')?.checked);
                const order = parseOrder(query<HTMLInputElement>(row, '[data-friend-link-field="order"]')?.value || '', index + 1);
                return { row, visible, order, index };
            })
            .sort((a, b) => {
                if (a.visible !== b.visible) return a.visible ? -1 : 1;
                if (a.order !== b.order) return a.order - b.order;
                return a.index - b.index;
            });

        ordered.forEach((item, index) => {
            const input = query<HTMLInputElement>(item.row, '[data-friend-link-field="order"]');
            if (input) input.value = String(index + 1);
        });
    };

    const createFriendRow = (
        item: Partial<EditableFriendLinkItem> | null | undefined,
        index: number
    ): HTMLElement | null => {
        const fragment = friendLinksTemplate.content.cloneNode(true) as DocumentFragment;
        const row = query<HTMLElement>(fragment, '[data-friend-link-row]');
        if (!(row instanceof HTMLElement)) return null;

        const orderInput = query<HTMLInputElement>(row, '[data-friend-link-field="order"]');
        const nameInput = query<HTMLInputElement>(row, '[data-friend-link-field="name"]');
        const urlInput = query<HTMLInputElement>(row, '[data-friend-link-field="url"]');
        const avatarInput = query<HTMLInputElement>(row, '[data-friend-link-field="avatar"]');
        const bioInput = query<HTMLInputElement>(row, '[data-friend-link-field="bio"]');
        const visibleInput = query<HTMLInputElement>(row, '[data-friend-link-field="visible"]');

        if (
            !(orderInput instanceof HTMLInputElement)
            || !(nameInput instanceof HTMLInputElement)
            || !(urlInput instanceof HTMLInputElement)
            || !(avatarInput instanceof HTMLInputElement)
            || !(bioInput instanceof HTMLInputElement)
            || !(visibleInput instanceof HTMLInputElement)
        ) {
            return null;
        }

        orderInput.value = String(parseOrder(item?.order, index + 1));
        orderInput.max = String(ADMIN_FRIEND_LINK_ORDER_MAX);
        nameInput.value = typeof item?.name === 'string' ? item.name.trim() : '';
        urlInput.value = typeof item?.url === 'string' ? item.url.trim() : '';
        avatarInput.value = typeof item?.avatar === 'string' ? item.avatar.trim() : '';
        bioInput.value = typeof item?.bio === 'string' ? item.bio.trim() : '';
        visibleInput.checked = item?.visible !== false;

        syncFriendRow(row);
        return row;
    };

    const replaceFriendRows = (items: EditableFriendLinkItem[]): void => {
        getFriendRows().forEach((row) => row.remove());
        items.forEach((item, index) => {
            const row = createFriendRow(item, index);
            if (row) friendLinksList.appendChild(row);
        });
        updateFriendRowsUi();
    };

    const getNextFriendOrder = (): number => {
        const orders = getFriendRows()
            .map((row) => parseOrder(query<HTMLInputElement>(row, '[data-friend-link-field="order"]')?.value || '', 0))
            .filter((value) => Number.isFinite(value));
        return orders.length ? Math.max(...orders) + 1 : 1;
    };

    return {
        getFriendRows,
        getFriendFieldTarget,
        getFriendVisibilityTarget,
        updateFriendRowsUi,
        normalizeFriendOrders,
        syncFriendRow,
        createFriendRow,
        replaceFriendRows,
        getNextFriendOrder
    };
};
