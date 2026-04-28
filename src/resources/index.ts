import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { SystemInfo, UserProfile, LanguageInfo, PageTemplate, TaxonomyMap } from '../types/grav-api.js';

export function registerResources(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  server.registerResource('system-info', 'grav://system/info', {
    description: 'Grav CMS system information: version, PHP version, environment, disk usage, installed packages',
    mimeType: 'application/json',
  }, async () => {
    await ensureInit();
    try {
      const response = await client.get<SystemInfo>('/system/info');
      return {
        contents: [{
          uri: 'grav://system/info',
          mimeType: 'application/json',
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    } catch {
      return {
        contents: [{
          uri: 'grav://system/info',
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Failed to fetch system info. Check permissions (api.system.read).' }),
        }],
      };
    }
  });

  server.registerResource('user-permissions', 'grav://user/permissions', {
    description: 'Current API user\'s resolved permission map — shows what operations this API key can perform',
    mimeType: 'application/json',
  }, async () => {
    await ensureInit();
    try {
      const response = await client.get<UserProfile>('/me');
      return {
        contents: [{
          uri: 'grav://user/permissions',
          mimeType: 'application/json',
          text: JSON.stringify({
            username: response.data.username,
            super_admin: response.data.super_admin,
            access: response.data.access,
            groups: response.data.groups,
          }, null, 2),
        }],
      };
    } catch {
      return {
        contents: [{
          uri: 'grav://user/permissions',
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Failed to fetch permissions.' }),
        }],
      };
    }
  });

  server.registerResource('languages', 'grav://languages', {
    description: 'Configured site languages with codes, names, and default language',
    mimeType: 'application/json',
  }, async () => {
    await ensureInit();
    try {
      const response = await client.get<LanguageInfo[]>('/languages');
      return {
        contents: [{
          uri: 'grav://languages',
          mimeType: 'application/json',
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    } catch {
      return {
        contents: [{
          uri: 'grav://languages',
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Failed to fetch languages.' }),
        }],
      };
    }
  });

  server.registerResource('templates', 'grav://templates', {
    description: 'Available page templates/blueprints — the types of pages that can be created',
    mimeType: 'application/json',
  }, async () => {
    await ensureInit();
    try {
      const response = await client.get<PageTemplate[]>('/blueprints/pages');
      return {
        contents: [{
          uri: 'grav://templates',
          mimeType: 'application/json',
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    } catch {
      return {
        contents: [{
          uri: 'grav://templates',
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Failed to fetch templates.' }),
        }],
      };
    }
  });

  server.registerResource('taxonomy', 'grav://taxonomy', {
    description: 'All taxonomy types (e.g. category, tag) and their current values used across the site',
    mimeType: 'application/json',
  }, async () => {
    await ensureInit();
    try {
      const response = await client.get<TaxonomyMap>('/taxonomy');
      return {
        contents: [{
          uri: 'grav://taxonomy',
          mimeType: 'application/json',
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    } catch {
      return {
        contents: [{
          uri: 'grav://taxonomy',
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Failed to fetch taxonomy.' }),
        }],
      };
    }
  });
}
