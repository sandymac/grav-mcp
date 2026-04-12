export const sidebarItems = [
  {
    id: 'license-manager',
    plugin: 'license-manager',
    label: 'Licenses',
    icon: 'fa-key',
    route: '/plugin/license-manager',
    priority: 10,
    badge: '3',
  },
  {
    id: 'flex-objects-contacts',
    plugin: 'flex-objects',
    label: 'Contacts',
    icon: 'fa-address-book',
    route: '/flex-objects/contacts',
    priority: 20,
  },
];

export const floatingWidgets = [
  {
    id: 'ai-assistant',
    plugin: 'ai-pro',
    label: 'AI Assistant',
    icon: 'fa-robot',
    priority: 1,
    autoLoad: false,
    showFab: true,
  },
];

export const contextPanels = [
  {
    id: 'seo-analysis',
    plugin: 'seo-magic',
    label: 'SEO Analysis',
    icon: 'fa-search',
    contexts: ['/pages/edit'],
    badgeEndpoint: '/seo/score',
  },
];

export const settingsPanels = [
  {
    id: 'email-settings',
    plugin: 'email',
    label: 'Email',
    icon: 'fa-envelope',
    blueprint: 'email',
    data_endpoint: '/config/plugins/email',
    save_endpoint: '/config/plugins/email',
    priority: 5,
  },
];

export const pluginPageDef = {
  id: 'license-manager',
  plugin: 'license-manager',
  title: 'License Manager',
  icon: 'fa-key',
  page_type: 'blueprint' as const,
  blueprint: 'licenses',
  data_endpoint: '/licenses/form-data',
  save_endpoint: '/licenses',
  actions: [
    { id: 'save', label: 'Save', icon: 'fa-check', primary: true },
  ],
};
