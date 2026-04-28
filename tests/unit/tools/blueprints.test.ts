import { describe, it, expect, beforeAll } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBlueprintTools } from '../../../src/tools/blueprints.js';

describe('Blueprint Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerBlueprintTools(server, client, ensureInit);
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('list_page_templates', () => {
    it('returns available templates', async () => {
      const result = await callTool('list_page_templates');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.find((t: any) => t.type === 'default')).toBeDefined();
      expect(data.find((t: any) => t.type === 'blog')).toBeDefined();
    });
  });

  describe('get_blueprint', () => {
    it('returns page blueprint', async () => {
      const result = await callTool('get_blueprint', { type: 'page', name: 'default' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.fields).toBeDefined();
    });

    it('returns plugin blueprint', async () => {
      const result = await callTool('get_blueprint', { type: 'plugin', name: 'email' });
      expect(result.isError).toBeUndefined();
    });

    it('returns theme blueprint', async () => {
      const result = await callTool('get_blueprint', { type: 'theme', name: 'quark' });
      expect(result.isError).toBeUndefined();
    });

    it('returns user blueprint', async () => {
      const result = await callTool('get_blueprint', { type: 'user', name: 'users' });
      expect(result.isError).toBeUndefined();
    });

    it('returns config blueprint', async () => {
      const result = await callTool('get_blueprint', { type: 'config', name: 'system' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('get_permissions', () => {
    it('returns permission hierarchy', async () => {
      const result = await callTool('get_permissions');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data['api.access']).toBeDefined();
    });
  });

  describe('get_taxonomy', () => {
    it('returns taxonomy types and values', async () => {
      const result = await callTool('get_taxonomy');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.category).toBeDefined();
      expect(data.tag).toBeDefined();
      expect(data.category).toContain('blog');
    });
  });

  describe('upload_blueprint_file', () => {
    it('uploads a file to a blueprint destination', async () => {
      const png = Buffer.from('not really png').toString('base64');
      const result = await callTool('upload_blueprint_file', {
        destination: 'theme://images/logo',
        scope: 'themes/quark2',
        filename: 'logo.png',
        content_base64: png,
        content_type: 'image/png',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data) ? data[0].path : data.path).toContain('user/');
    });
  });

  describe('delete_blueprint_file', () => {
    it('deletes by logical path', async () => {
      const result = await callTool('delete_blueprint_file', {
        path: 'user/themes/quark2/images/logo/logo.png',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('errors when path is empty', async () => {
      const result = await callTool('delete_blueprint_file', { path: '' });
      expect(result.isError).toBe(true);
    });
  });
});
