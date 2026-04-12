import { describe, it, expect, beforeAll } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSystemTools } from '../../../src/tools/system.js';

describe('System Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerSystemTools(server, client, ensureInit);
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('get_system_info', () => {
    it('returns system info', async () => {
      const result = await callTool('get_system_info');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.grav_version).toBeDefined();
      expect(data.php_version).toBeDefined();
    });
  });

  describe('clear_cache', () => {
    it('clears cache with default scope', async () => {
      const result = await callTool('clear_cache');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('clears cache with specific scope', async () => {
      const result = await callTool('clear_cache', { scope: 'images' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('get_logs', () => {
    it('returns log entries', async () => {
      const result = await callTool('get_logs');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.data).toBeDefined();
    });

    it('filters by level', async () => {
      const result = await callTool('get_logs', { level: 'ERROR' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('create_backup', () => {
    it('creates backup', async () => {
      const result = await callTool('create_backup');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.filename).toBeDefined();
    });
  });

  describe('list_backups', () => {
    it('returns backup list', async () => {
      const result = await callTool('list_backups');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('get_scheduler', () => {
    it('returns jobs by default', async () => {
      const result = await callTool('get_scheduler');
      expect(result.isError).toBeUndefined();
    });

    it('returns status view', async () => {
      const result = await callTool('get_scheduler', { view: 'status' });
      expect(result.isError).toBeUndefined();
    });

    it('returns history view', async () => {
      const result = await callTool('get_scheduler', { view: 'history' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('run_scheduler', () => {
    it('triggers scheduler', async () => {
      const result = await callTool('run_scheduler');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('get_dashboard_stats', () => {
    it('returns stats', async () => {
      const result = await callTool('get_dashboard_stats');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.pages).toBeDefined();
    });
  });

  describe('get_notifications', () => {
    it('returns notifications', async () => {
      const result = await callTool('get_notifications');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('dismiss_notification', () => {
    it('dismisses notification', async () => {
      const result = await callTool('dismiss_notification', { id: 'notif-001' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('run_reports', () => {
    it('returns reports', async () => {
      const result = await callTool('run_reports');
      expect(result.isError).toBeUndefined();
    });
  });
});
