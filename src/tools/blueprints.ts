import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { PageTemplate, Blueprint, TaxonomyMap, BlueprintUploadResponse } from '../types/grav-api.js';
import { handleToolCall, toolResult } from './helpers.js';

export function registerBlueprintTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  // @api GET /blueprints/pages
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

  // @api GET /blueprints/pages/{template}
  // @api GET /blueprints/plugins/{plugin}
  // @api GET /blueprints/themes/{theme}
  // @api GET /blueprints/users
  // @api GET /blueprints/config/{scope}
  server.registerTool('get_blueprint', {
    title: 'Get Blueprint',
    description:
      'Get the full field schema (blueprint) for a page template, plugin config, theme config, user accounts, or system config. The blueprint describes all available fields, their types, validation rules, and default values. Types: "page" (page templates), "plugin" (plugin config), "theme" (theme config), "user" (user account fields), "config" (system/site config). [Requires: api.pages.read for "page", api.config.read for "plugin"/"theme"/"config", api.access for "user"]',
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
        // The account form schema is needed by every authenticated user to render
        // their own profile, so the server only gates it on api.access.
        client.checkPermission('api.access');
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

  // @api GET /blueprints/users/permissions
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

  // @api GET /taxonomy
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

  // @api POST /blueprint-upload
  server.registerTool('upload_blueprint_file', {
    title: 'Upload Blueprint File',
    description:
      'Upload a file referenced by a blueprint file/upload field (theme/plugin config form, account avatar, etc.). The `destination` is a Grav stream like `theme://images/logo`, `user://assets`, `account://avatars`, a `self@:subpath` relative to the blueprint owner, or a plain user-rooted relative path. The `scope` (`plugins/<slug>`, `themes/<slug>`, `pages/<route>`, `users/<username>`) anchors `self@:` resolution. Returns the logical user-rooted path — pass that path back to `delete_blueprint_file` to remove it. [Requires: api.media.write]',
    inputSchema: {
      destination: z.string().describe('Blueprint destination (stream, self@:subpath, or relative user-rooted path)'),
      scope: z.string().describe('Owning scope: plugins/<slug>, themes/<slug>, pages/<route>, or users/<username>'),
      filename: z.string().describe('Filename for the uploaded file'),
      content_base64: z.string().describe('File contents, base64-encoded'),
      content_type: z.string().optional().describe('MIME type (defaults to application/octet-stream)'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.media.write');
    const buffer = Buffer.from(args.content_base64, 'base64');
    const response = await client.uploadFile<BlueprintUploadResponse | BlueprintUploadResponse[]>(
      '/blueprint-upload',
      [{ filename: args.filename, content: buffer, contentType: args.content_type ?? 'application/octet-stream' }],
      {
        fields: {
          destination: args.destination,
          scope: args.scope,
        },
      },
    );
    return toolResult(response.data);
  }));

  // @api DELETE /blueprint-upload
  server.registerTool('delete_blueprint_file', {
    title: 'Delete Blueprint File',
    description:
      'Delete a file previously uploaded via `upload_blueprint_file`. Pass the logical user-rooted `path` returned from the upload response (e.g. `user/themes/quark2/images/logo/foo.png`). Idempotent — already-deleted files return success. [Requires: api.media.write]',
    inputSchema: {
      path: z.string().describe('User-rooted logical path returned from upload_blueprint_file'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.media.write');
    await client.delete('/blueprint-upload', undefined, { body: { path: args.path } });
    return toolResult({ success: true, path: args.path });
  }));
}
