export const pageTemplates = [
  { type: 'default', label: 'Default' },
  { type: 'blog', label: 'Blog Listing' },
  { type: 'item', label: 'Blog Item' },
  { type: 'modular', label: 'Modular' },
];

export const defaultBlueprint = {
  type: 'default',
  fields: {
    'header.title': {
      type: 'text',
      label: 'Title',
      validate: { required: true },
    },
    content: {
      type: 'editor',
      label: 'Content',
    },
    'header.published': {
      type: 'toggle',
      label: 'Published',
      default: true,
    },
    'header.taxonomy.category': {
      type: 'taxonomy',
      label: 'Category',
    },
    'header.taxonomy.tag': {
      type: 'taxonomy',
      label: 'Tags',
    },
  },
};

export const permissions = {
  'admin.super': { label: 'Super Admin' },
  'api.access': { label: 'API Access' },
  'api.pages.read': { label: 'Read Pages' },
  'api.pages.write': { label: 'Write Pages' },
  'api.media.read': { label: 'Read Media' },
  'api.media.write': { label: 'Write Media' },
  'api.config.read': { label: 'Read Config' },
  'api.config.write': { label: 'Write Config' },
  'api.users.read': { label: 'Read Users' },
  'api.users.write': { label: 'Write Users' },
  'api.system.read': { label: 'Read System' },
  'api.system.write': { label: 'Write System' },
};

export const taxonomy = {
  category: ['blog', 'news', 'tutorial'],
  tag: ['intro', 'advanced', 'grav', 'cms', 'first-post'],
};
