import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type {
  SidebarItem,
  FloatingWidget,
  ContextPanel,
  SettingsPanel,
  PluginPageDefinition,
  PackageSummary,
} from '../types/grav-api.js';
import { handleToolCall, toolResult } from './helpers.js';
import { getPluginToolSummaries } from './plugin-tools.js';

interface DiscoveryResult {
  sidebar_items: SidebarItem[];
  floating_widgets: FloatingWidget[];
  context_panels: ContextPanel[];
  settings_panels: SettingsPanel[];
  plugin_pages: PluginPageDefinition[];
}

let discoveryCache: DiscoveryResult | null = null;

export function clearDiscoveryCache(): void {
  discoveryCache = null;
}

/**
 * The plugin tools loaded from /mcp/tools are read from the loader's last
 * response, never re-fetched, and are added outside the cache so they stay
 * current after a refresh_plugin_tools call.
 */
function withPluginTools(discovery: DiscoveryResult): DiscoveryResult & {
  mcp_tools: Array<{ plugin: string; tools: string[] }>;
} {
  return { ...discovery, mcp_tools: getPluginToolSummaries() };
}

export function registerPluginTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  // @api GET /sidebar/items
  // @api GET /gpm/plugins/{slug}/page
  server.registerTool('discover_plugins', {
    title: 'Discover Plugin Features',
    description:
      'Discover what features installed plugins expose: sidebar navigation items, floating widgets, context panels, settings panels, custom admin pages, and the MCP tools plugins publish through their manifests (mcp_tools). This reveals all plugin-provided functionality that can be accessed through the API. Use get_config/update_config to read/write plugin configuration. [Requires: api.access]',
    inputSchema: {
      refresh: z.boolean().optional().describe('Force refresh the discovery cache'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.access');

    if (discoveryCache && !args.refresh) {
      return toolResult(withPluginTools(discoveryCache));
    }

    // Fetch all discovery endpoints in parallel
    const [sidebarRes, widgetsRes, panelsRes, settingsRes] = await Promise.all([
      client.get<SidebarItem[]>('/sidebar/items').catch(() => ({ data: [] as SidebarItem[] })),
      client.get<FloatingWidget[]>('/floating-widgets').catch(() => ({ data: [] as FloatingWidget[] })),
      client.get<ContextPanel[]>('/context-panels').catch(() => ({ data: [] as ContextPanel[] })),
      client.get<SettingsPanel[]>('/settings/panels').catch(() => ({ data: [] as SettingsPanel[] })),
    ]);

    // Discover plugin pages from sidebar items that reference plugins
    const pluginSlugs = new Set(
      sidebarRes.data
        .filter((item) => item.plugin && item.route?.startsWith('/plugin/'))
        .map((item) => item.plugin),
    );

    const pluginPages: PluginPageDefinition[] = [];
    for (const slug of pluginSlugs) {
      try {
        const pageRes = await client.get<PluginPageDefinition>(`/gpm/plugins/${slug}/page`);
        if (pageRes.data) pluginPages.push(pageRes.data);
      } catch {
        // Plugin may not have a custom page, that's fine
      }
    }

    discoveryCache = {
      sidebar_items: sidebarRes.data,
      floating_widgets: widgetsRes.data,
      context_panels: panelsRes.data,
      settings_panels: settingsRes.data,
      plugin_pages: pluginPages,
    };

    return toolResult(withPluginTools(discoveryCache));
  }));

  // @api POST /menubar/actions/{plugin}/{action}
  server.registerTool('plugin_action', {
    title: 'Execute Plugin Action',
    description:
      'Execute a plugin-registered menubar action. Use discover_plugins first to see available actions for each plugin. [Requires: api.access]',
    inputSchema: {
      plugin: z.string().describe('Plugin slug'),
      action: z.string().describe('Action ID from the plugin page definition'),
      data: z.record(z.unknown()).optional().describe('Optional data payload for the action'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.access');
    const response = await client.post<unknown>(
      `/menubar/actions/${args.plugin}/${args.action}`,
      args.data,
    );
    return toolResult(response.data);
  }));
}
