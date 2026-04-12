export const systemInfo = {
  grav_version: '1.7.46',
  php_version: '8.3.4',
  environment: 'localhost',
  disk_total: 500000000000,
  disk_free: 250000000000,
  plugins_count: 25,
  themes_count: 3,
};

export const logEntries = [
  {
    date: '2024-04-01 14:30:00',
    level: 'ERROR',
    message: 'Plugin "broken-plugin" threw an exception',
    context: { exception: 'RuntimeException' },
  },
  {
    date: '2024-04-01 14:25:00',
    level: 'WARNING',
    message: 'Cache directory is not writable',
  },
  {
    date: '2024-04-01 14:20:00',
    level: 'INFO',
    message: 'Page cache cleared',
  },
];

export const backups = [
  {
    filename: 'grav-backup-2024-04-01.zip',
    size: 52428800,
    date: '2024-04-01T10:00:00Z',
  },
  {
    filename: 'grav-backup-2024-03-15.zip',
    size: 48234567,
    date: '2024-03-15T10:00:00Z',
  },
];

export const dashboardStats = {
  pages: { total: 47, published: 42, drafts: 5 },
  users: { total: 3 },
  plugins: { installed: 25, updates_available: 2 },
  themes: { installed: 3 },
  last_backup: '2024-04-01T10:00:00Z',
};

export const notifications = [
  {
    id: 'notif-001',
    type: 'info',
    message: 'Grav 1.7.47 is available',
    date: '2024-04-01',
  },
];

export const schedulerJobs = [
  {
    id: 'clear-cache',
    command: 'cache:clear',
    at: '0 */6 * * *',
    output: '/dev/null',
    status: 'success',
  },
];
