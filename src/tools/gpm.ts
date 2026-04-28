import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type {
  PackageSummary,
  PackageDetail,
  UpdatesResponse,
  GpmUpdateAllResponse,
  GpmUpgradeGravResponse,
} from '../types/grav-api.js';
import { handleToolCall, toolResult, buildQuery, addPaginationInfo } from './helpers.js';

export function registerGpmTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  // @api GET /gpm/plugins
  // @api GET /gpm/themes
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

  // @api GET /gpm/plugins/{slug}
  // @api GET /gpm/themes/{slug}
  // @api GET /gpm/plugins/{slug}/readme
  // @api GET /gpm/themes/{slug}/readme
  // @api GET /gpm/plugins/{slug}/changelog
  // @api GET /gpm/themes/{slug}/changelog
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

  // @api GET /gpm/search
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

  // @api GET /gpm/updates
  server.registerTool('check_updates', {
    title: 'Check Updates',
    description:
      'Check for available updates across Grav core, plugins, and themes. Response includes `total`, `plugins[]`, `themes[]`, and (when applicable) a `grav` block with `version`, `available`, and `is_symlink` so callers can avoid offering self-upgrade on symlinked installs. [Requires: api.gpm.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.read');
    const response = await client.get<UpdatesResponse>('/gpm/updates');
    return toolResult(response.data);
  }));

  // @api POST /gpm/install
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

  // @api POST /gpm/remove
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

  // @api POST /gpm/update
  server.registerTool('update_package', {
    title: 'Update Package',
    description:
      'Update a single installed plugin or theme to its latest version. Server auto-detects whether the slug is a plugin or theme. Blueprint-declared dependencies (and any deps that themselves need updating) are installed first; a Grav-too-old or PHP-too-old failure surfaces with the original GPM message. Response includes `dependencies: string[]` listing slugs installed alongside. [Requires: api.gpm.write]',
    inputSchema: {
      package: z.string().describe('Package slug to update'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.write');
    const response = await client.post<unknown>('/gpm/update', { package: args.package });
    return toolResult(response.data);
  }));

  // @api POST /gpm/update-all
  server.registerTool('update_all_packages', {
    title: 'Update All Packages',
    description:
      'Bulk-update every updatable plugin and theme. Per-package dependency validation (Grav/PHP version, cross-package version constraints) runs up-front; mismatches land in `failed[]` with the original GPM message rather than silently failing. Returns four buckets: `updated[]`, `failed[]`, `skipped[]` (became current via cascade), and `cascaded_dependencies[]` (deps installed alongside). [Requires: api.gpm.write]',
    annotations: { readOnlyHint: false },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.write');
    const response = await client.post<GpmUpdateAllResponse>('/gpm/update-all');
    return toolResult(response.data);
  }));

  // @api POST /gpm/upgrade
  server.registerTool('upgrade_grav', {
    title: 'Upgrade Grav Core',
    description:
      'Self-upgrade the Grav core to the latest available version. Refuses to run when Grav is installed via symlink (typical for development setups) — check the `is_symlink` flag in `check_updates` before calling. Fires `onApiBeforeGravUpgrade` / `onApiGravUpgraded` events. [Requires: api.gpm.write + super_admin recommended]',
    annotations: { readOnlyHint: false },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.gpm.write');
    const response = await client.post<GpmUpgradeGravResponse>('/gpm/upgrade');
    return toolResult(response.data);
  }));
}
