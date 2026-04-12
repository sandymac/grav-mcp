import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { PageTemplate, Blueprint, TaxonomyMap } from '../types/grav-api.js';
import { handleToolCall, toolResult } from './helpers.js';

export function registerBlueprintTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  server.registerTool('list_page_templates', {
    title: 'List Page Templates',
    description:
      'List all available page templates/blueprints. Each template defines a page type with its own set of fields. Use this before creating pages to know which templates are available. [Requires: api.pages.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.pages.read');
    const response = await client.get<PageTemplate[]>('/blueprints/pages');
    return toolResult(response.data);
  }));

  server.registerTool('get_blueprint', {
    title: 'Get Blueprint',
    description:
      'Get the full field schema (blueprint) for a page template, plugin config, theme config, user accounts, or system config. The blueprint describes all available fields, their types, validation rules, and default values. Types: "page" (page templates), "plugin" (plugin config), "theme" (theme config), "user" (user account fields), "config" (system/site config). [Requires: api.pages.read or api.config.read]',
    inputSchema: {
      type: z.enum(['page', 'plugin', 'theme', 'user', 'config']).describe('Blueprint type'),
      name: z.string().describe('Blueprint name: template name for "page", plugin/theme slug for "plugin"/"theme", "users" for "user", scope for "config"'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    let path: string;
    switch (args.type) {
      case 'page':
        client.checkPermission('api.pages.read');
        path = `/blueprints/pages/${args.name}`;
        break;
      case 'plugin':
        client.checkPermission('api.config.read');
        path = `/blueprints/plugins/${args.name}`;
        break;
      case 'theme':
        client.checkPermission('api.config.read');
        path = `/blueprints/themes/${args.name}`;
        break;
      case 'user':
        client.checkPermission('api.users.read');
        path = '/blueprints/users';
        break;
      case 'config':
        client.checkPermission('api.config.read');
        path = `/blueprints/config/${args.name}`;
        break;
    }
    const response = await client.get<Blueprint>(path);
    return toolResult(response.data);
  }));

  server.registerTool('get_permissions', {
    title: 'Get Permissions',
    description:
      'Get all registered permission actions and their hierarchy. Useful for understanding what access levels exist and configuring user permissions. [Requires: api.users.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.users.read');
    const response = await client.get<unknown>('/blueprints/users/permissions');
    return toolResult(response.data);
  }));

  server.registerTool('get_taxonomy', {
    title: 'Get Taxonomy',
    description:
      'Get all taxonomy types and their current values used across the site. Taxonomy types (like "category", "tag") are defined in site config; values come from pages. [Requires: api.pages.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.pages.read');
    const response = await client.get<TaxonomyMap>('/taxonomy');
    return toolResult(response.data);
  }));
}
