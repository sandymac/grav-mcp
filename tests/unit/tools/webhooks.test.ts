import { describe, it, expect, beforeAll } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWebhookTools } from '../../../src/tools/webhooks.js';

describe('Webhook Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerWebhookTools(server, client, ensureInit);
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('list_webhooks', () => {
    it('returns webhook list', async () => {
      const result = await callTool('list_webhooks');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].url).toContain('example.com');
    });
  });

  describe('manage_webhook', () => {
    it('creates webhook', async () => {
      const result = await callTool('manage_webhook', {
        action: 'create',
        url: 'https://hooks.example.com/new',
        events: ['page.created'],
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.url).toContain('example.com');
      expect(data.secret).toBeDefined();
    });

    it('updates webhook', async () => {
      const result = await callTool('manage_webhook', {
        action: 'update',
        id: 'wh_001',
        active: false,
      });
      expect(result.isError).toBeUndefined();
    });

    it('deletes webhook', async () => {
      const result = await callTool('manage_webhook', {
        action: 'delete',
        id: 'wh_001',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('returns error when updating without id', async () => {
      const result = await callTool('manage_webhook', { action: 'update' });
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('id is required');
    });
  });

  describe('get_webhook_deliveries', () => {
    it('returns delivery log', async () => {
      const result = await callTool('get_webhook_deliveries', { webhook_id: 'wh_001' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.data).toBeDefined();
    });
  });

  describe('test_webhook', () => {
    it('sends test payload', async () => {
      const result = await callTool('test_webhook', { webhook_id: 'wh_001' });
      expect(result.isError).toBeUndefined();
    });
  });
});
