import { describe, it, expect, beforeAll } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGpmTools } from '../../../src/tools/gpm.js';

describe('GPM Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerGpmTools(server, client, ensureInit);
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('list_packages', () => {
    it('lists plugins', async () => {
      const result = await callTool('list_packages', { type: 'plugins' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].slug).toBe('email');
    });

    it('lists themes', async () => {
      const result = await callTool('list_packages', { type: 'themes' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('get_package_info', () => {
    it('returns plugin details', async () => {
      const result = await callTool('get_package_info', {
        type: 'plugins',
        slug: 'email',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.slug).toBe('email');
    });

    it('includes readme when requested', async () => {
      const result = await callTool('get_package_info', {
        type: 'plugins',
        slug: 'email',
        include: 'readme',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.readme).toContain('Email Plugin');
    });

    it('includes changelog when requested', async () => {
      const result = await callTool('get_package_info', {
        type: 'plugins',
        slug: 'email',
        include: 'changelog',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.changelog).toContain('4.0.3');
    });
  });

  describe('search_packages', () => {
    it('searches repository', async () => {
      const result = await callTool('search_packages', { query: 'comments' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('check_updates', () => {
    it('returns update info', async () => {
      const result = await callTool('check_updates');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.grav).toBeDefined();
      expect(data.plugins).toBeDefined();
    });
  });

  describe('install_package', () => {
    it('installs plugin', async () => {
      const result = await callTool('install_package', {
        package: 'comments',
        type: 'plugin',
      });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('remove_package', () => {
    it('removes plugin', async () => {
      const result = await callTool('remove_package', { package: 'comments' });
      expect(result.isError).toBeUndefined();
    });
  });
});
