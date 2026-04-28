import { describe, it, expect, beforeAll } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerConfigTools } from '../../../src/tools/config.js';

describe('Config Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerConfigTools(server, client, ensureInit);
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('list_config_scopes', () => {
    it('returns available config scopes', async () => {
      const result = await callTool('list_config_scopes');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].scope).toBe('system');
    });
  });

  describe('get_config', () => {
    it('returns system config with ETag', async () => {
      const result = await callTool('get_config', { scope: 'system' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.config).toBeDefined();
      expect(data._etag).toBe('"etag-system"');
    });

    it('returns plugin config', async () => {
      const result = await callTool('get_config', { scope: 'plugins/email' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.config).toBeDefined();
      expect(data._etag).toBeDefined();
    });
  });

  describe('update_config', () => {
    it('updates config values', async () => {
      const result = await callTool('update_config', {
        scope: 'system',
        values: { cache: { enabled: false } },
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data._etag).toBe('"etag-config-updated"');
    });

    it('passes etag for conflict detection', async () => {
      const result = await callTool('update_config', {
        scope: 'system',
        values: { cache: { enabled: false } },
        etag: '"etag-system"',
      });
      expect(result.isError).toBeUndefined();
    });

    it('routes to env folder via X-Config-Environment when environment arg is set', async () => {
      // The MSW handler echoes the body — we just verify the call succeeds.
      // The header propagation itself is exercised at the client layer.
      const result = await callTool('update_config', {
        scope: 'system',
        values: { cache: { enabled: false } },
        environment: 'production',
      });
      expect(result.isError).toBeUndefined();
    });
  });
});
