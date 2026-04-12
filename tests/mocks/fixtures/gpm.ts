export const plugins = [
  {
    slug: 'email',
    type: 'plugin',
    name: 'Email',
    version: '4.0.3',
    description: 'Enables email functionality',
    author: 'Team Grav',
    enabled: true,
    update_available: false,
  },
  {
    slug: 'sitemap',
    type: 'plugin',
    name: 'Sitemap',
    version: '3.0.1',
    description: 'Generates a sitemap',
    author: 'Team Grav',
    enabled: true,
    update_available: true,
    latest_version: '3.0.2',
  },
];

export const pluginDetail = {
  slug: 'email',
  type: 'plugin',
  name: 'Email',
  version: '4.0.3',
  description: 'Enables email functionality for Grav CMS',
  author: 'Team Grav',
  homepage: 'https://github.com/getgrav/grav-plugin-email',
  installed: true,
  enabled: true,
  update_available: false,
};

export const searchResults = [
  {
    slug: 'comments',
    type: 'plugin',
    name: 'Comments',
    version: '1.5.0',
    description: 'Add comments to your Grav pages',
    author: 'Team Grav',
    installed: false,
  },
];

export const updates = {
  grav: { current: '1.7.46', available: '1.7.47' },
  plugins: [
    { slug: 'sitemap', current: '3.0.1', available: '3.0.2' },
  ],
  themes: [],
};
