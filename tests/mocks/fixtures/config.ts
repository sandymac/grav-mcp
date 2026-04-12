export const configScopes = [
  { scope: 'system', label: 'System' },
  { scope: 'site', label: 'Site' },
  { scope: 'plugins/email', label: 'Email Plugin' },
  { scope: 'plugins/sitemap', label: 'Sitemap Plugin' },
  { scope: 'themes/quark', label: 'Quark Theme' },
];

export const systemConfig = {
  home: { alias: '/home' },
  pages: {
    theme: 'quark',
    order: { by: 'default', dir: 'asc' },
  },
  cache: {
    enabled: true,
    check: { method: 'file' },
    driver: 'auto',
    lifetime: 604800,
  },
  debugger: { enabled: false },
};

export const pluginConfig = {
  enabled: true,
  engine: 'smtp',
  from: 'noreply@example.com',
  from_name: 'My Site',
  to: 'admin@example.com',
};
