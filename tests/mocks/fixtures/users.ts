export const userProfile = {
  username: 'admin',
  email: 'admin@example.com',
  fullname: 'Admin User',
  title: 'Administrator',
  state: 'enabled',
  groups: ['administrators'],
  super_admin: true,
  content_editor: '',
  grav_version: '2.0.0',
  admin_version: '2.0.0',
  // Flat dot-notation map of resolved api.* permissions, matching what
  // PermissionResolver::resolvedMap() returns. Super-admin → all true.
  access: {
    'api.access': true,
    'api.pages.read': true,
    'api.pages.write': true,
    'api.media.read': true,
    'api.media.write': true,
    'api.config.read': true,
    'api.config.write': true,
    'api.users.read': true,
    'api.users.write': true,
    'api.system.read': true,
    'api.system.write': true,
    'api.gpm.read': true,
    'api.gpm.write': true,
    'api.scheduler.read': true,
    'api.scheduler.write': true,
    'api.reports.read': true,
    'api.webhooks.read': true,
    'api.webhooks.write': true,
    'api.collab.read': true,
    'api.collab.write': true,
  },
};

export const userList = [
  {
    username: 'admin',
    email: 'admin@example.com',
    fullname: 'Admin User',
    title: 'Administrator',
    state: 'enabled',
    access: { admin: { super: true } },
    groups: ['administrators'],
  },
  {
    username: 'editor',
    email: 'editor@example.com',
    fullname: 'Editor User',
    title: 'Editor',
    state: 'enabled',
    access: { api: { access: true, pages: { read: true, write: true } } },
    groups: ['editors'],
  },
];

export const apiKeys = [
  {
    id: 'key_abc123',
    name: 'CI/CD Key',
    prefix: 'grav_abc1',
    created: '2024-01-15T10:00:00Z',
    last_used: '2024-04-01T14:30:00Z',
  },
];

export const createdApiKey = {
  id: 'key_new456',
  name: 'New Key',
  prefix: 'grav_new4',
  created: '2024-04-01T15:00:00Z',
  key: 'grav_new456789abcdef0123456789abcdef0123456789abcdef',
};

export const limitedUserProfile = {
  username: 'editor',
  email: 'editor@example.com',
  fullname: 'Editor User',
  title: 'Editor',
  state: 'enabled',
  groups: ['editors'],
  super_admin: false,
  content_editor: '',
  grav_version: '2.0.0',
  admin_version: '2.0.0',
  access: {
    'api.access': true,
    'api.pages.read': true,
    'api.pages.write': true,
  },
};
