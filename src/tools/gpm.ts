import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { PackageSummary, PackageDetail } from '../types/grav-api.js';
import { handleToolCall, toolResult, buildQuery, addPaginationInfo } from './helpers.js';

export function registerGpmTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  server.registerTool('list_packages', {
    title: 'List Packages',
    description:
      'List installed plugins or themes with version info and update availability status. [Requires: api.gpm.read]',
    inputSchema: {
      type: z.enum(['plugins', 'themes']).describe('Package type to list'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.read');
    const response = await client.get<PackageSummary[]>(`/gpm/${args.type}`);
    return toolResult(response.data);
  }));

  server.registerTool('get_package_info', {
    title: 'Get Package Info',
    description:
      'Get detailed information about a specific installed plugin or theme, including description, version, author, readme content, and changelog. [Requires: api.gpm.read]',
    inputSchema: {
      type: z.enum(['plugins', 'themes']).describe('Package type'),
      slug: z.string().describe('Package slug (e.g. "email", "quark")'),
      include: z.enum(['readme', 'changelog']).optional().describe('Include readme or changelog content'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.read');
    const response = await client.get<PackageDetail>(`/gpm/${args.type}/${args.slug}`);
    const result: Record<string, unknown> = { ...response.data };

    if (args.include === 'readme') {
      const readme = await client.get<string>(`/gpm/${args.type}/${args.slug}/readme`);
      result.readme = readme.data;
    } else if (args.include === 'changelog') {
      const changelog = await client.get<string>(`/gpm/${args.type}/${args.slug}/changelog`);
      result.changelog = changelog.data;
    }

    return toolResult(result);
  }));

  server.registerTool('search_packages', {
    title: 'Search Packages',
    description:
      'Search the GPM repository for available plugins and themes to install. [Requires: api.gpm.read]',
    inputSchema: {
      query: z.string().describe('Search query'),
      page: z.number().int().min(1).optional().describe('Page number'),
      per_page: z.number().int().min(1).max(100).optional().describe('Results per page'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.read');
    const query = buildQuery({
      query: args.query,
      page: args.page,
      per_page: args.per_page,
    });
    const response = await client.get<unknown>('/gpm/search', query);
    return toolResult(addPaginationInfo(response.data, response.meta));
  }));

  server.registerTool('check_updates', {
    title: 'Check Updates',
    description:
      'Check for available updates across Grav core, plugins, and themes. [Requires: api.gpm.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.read');
    const response = await client.get<unknown>('/gpm/updates');
    return toolResult(response.data);
  }));

  server.registerTool('install_package', {
    title: 'Install Package',
    description:
      'Install a plugin or theme from the GPM repository. After installation, configure via update_config with scope "plugins/{slug}" or "themes/{slug}". [Requires: api.gpm.write]',
    inputSchema: {
      package: z.string().describe('Package slug to install'),
      type: z.enum(['plugin', 'theme']).describe('Package type'),
      license: z.string().optional().describe('License key (for premium packages)'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.write');
    const body: Record<string, unknown> = {
      package: args.package,
      type: args.type,
    };
    if (args.license) body.license = args.license;

    const response = await client.post<unknown>('/gpm/install', body);
    return toolResult(response.data);
  }));

  server.registerTool('remove_package', {
    title: 'Remove Package',
    description:
      'Remove (uninstall) a plugin or theme. This deletes the package files. [Requires: api.gpm.write]',
    inputSchema: {
      package: z.string().describe('Package slug to remove'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.write');
    const response = await client.post<unknown>('/gpm/remove', {
      package: args.package,
    });
    return toolResult(response.data);
  }));
}
