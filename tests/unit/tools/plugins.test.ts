import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPluginTools, clearDiscoveryCache } from '../../../src/tools/plugins.js';

describe('Plugin Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerPluginTools(server, client, ensureInit);
  });

  beforeEach(() => {
    clearDiscoveryCache();
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('discover_plugins', () => {
    it('returns all plugin features', async () => {
      const result = await callTool('discover_plugins');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.sidebar_items).toBeDefined();
      expect(data.floating_widgets).toBeDefined();
      expect(data.context_panels).toBeDefined();
      expect(data.settings_panels).toBeDefined();
      expect(data.plugin_pages).toBeDefined();
    });

    it('includes sidebar items from plugins', async () => {
      const result = await callTool('discover_plugins');
      const data = JSON.parse(result.content[0].text);
      expect(data.sidebar_items.length).toBeGreaterThan(0);
      expect(data.sidebar_items[0].plugin).toBe('license-manager');
    });

    it('discovers plugin page definitions', async () => {
      const result = await callTool('discover_plugins');
      const data = JSON.parse(result.content[0].text);
      expect(data.plugin_pages.length).toBeGreaterThan(0);
      expect(data.plugin_pages[0].id).toBe('license-manager');
      expect(data.plugin_pages[0].page_type).toBe('blueprint');
    });

    it('uses cache on second call', async () => {
      await callTool('discover_plugins');
      const result = await callTool('discover_plugins');
      expect(result.isError).toBeUndefined();
    });

    it('refreshes cache when requested', async () => {
      await callTool('discover_plugins');
      const result = await callTool('discover_plugins', { refresh: true });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('plugin_action', () => {
    it('executes menubar action', async () => {
      const result = await callTool('plugin_action', {
        plugin: 'license-manager',
        action: 'save',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('passes data payload', async () => {
      const result = await callTool('plugin_action', {
        plugin: 'license-manager',
        action: 'import',
        data: { format: 'json' },
      });
      expect(result.isError).toBeUndefined();
    });
  });
});
