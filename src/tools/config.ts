import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { ConfigScope } from '../types/grav-api.js';
import { handleToolCall, toolResult } from './helpers.js';

export function registerConfigTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  server.registerTool('list_config_scopes', {
    title: 'List Config Scopes',
    description:
      'List all available configuration sections: system, site, and all installed plugin and theme configs. Each scope can be read or updated individually. [Requires: api.config.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.config.read');
    const response = await client.get<ConfigScope[]>('/config');
    return toolResult(response.data);
  }));

  server.registerTool('get_config', {
    title: 'Get Config',
    description:
      'Read configuration values for a specific scope. Scopes: "system", "site", "plugins/{name}" (e.g. "plugins/email"), "themes/{name}". Returns the config object and an ETag for use with update_config. [Requires: api.config.read]',
    inputSchema: {
      scope: z.string().describe('Config scope (e.g. "system", "site", "plugins/email", "themes/quark")'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.config.read');
    const response = await client.get<Record<string, unknown>>(`/config/${args.scope}`);
    const result: Record<string, unknown> = { config: response.data };
    if (response.etag) result._etag = response.etag;
    return toolResult(result);
  }));

  server.registerTool('update_config', {
    title: 'Update Config',
    description:
      'Update configuration values for a scope. Values are deep-merged with existing config. Pass etag from get_config for conflict detection. [Requires: api.config.write]',
    inputSchema: {
      scope: z.string().describe('Config scope to update'),
      values: z.record(z.unknown()).describe('Configuration values to set (deep-merged)'),
      etag: z.string().optional().describe('ETag from get_config for conflict detection'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.config.write');
    const response = await client.patch<Record<string, unknown>>(
      `/config/${args.scope}`,
      args.values,
      { etag: args.etag },
    );
    const result: Record<string, unknown> = { config: response.data };
    if (response.etag) result._etag = response.etag;
    return toolResult(result);
  }));
}
