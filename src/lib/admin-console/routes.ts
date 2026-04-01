export type AdminRouteId = 'overview' | 'theme' | 'data';

export type AdminRouteDefinition = {
  id: AdminRouteId;
  href: '/admin/' | '/admin/theme/' | '/admin/data/';
  label: string;
  description: string;
};

export const ADMIN_ROUTES = [
  {
    id: 'overview',
    href: '/admin/',
    label: 'Overview',
    description: '概览与快捷入口'
  },
  {
    id: 'theme',
    href: '/admin/theme/',
    label: 'Theme',
    description: '主题设置'
  },
  {
    id: 'data',
    href: '/admin/data/',
    label: 'Data',
    description: '设置导入导出'
  }
] as const satisfies readonly AdminRouteDefinition[];

export const isAdminRouteId = (value: string): value is AdminRouteId =>
  ADMIN_ROUTES.some((route) => route.id === value);

export const getAdminRoute = (id: AdminRouteId): AdminRouteDefinition =>
  ADMIN_ROUTES.find((route) => route.id === id) ?? ADMIN_ROUTES[0];
