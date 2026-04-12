import { describe, it, expect, beforeAll } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerUserTools } from '../../../src/tools/users.js';

describe('User Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerUserTools(server, client, ensureInit);
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('list_users', () => {
    it('returns paginated user list', async () => {
      const result = await callTool('list_users');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(2);
    });
  });

  describe('get_user', () => {
    it('returns user with ETag', async () => {
      const result = await callTool('get_user', { username: 'admin' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.username).toBe('admin');
      expect(data._etag).toBeDefined();
    });

    it('returns error for nonexistent user', async () => {
      const result = await callTool('get_user', { username: 'nonexistent' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('create_user', () => {
    it('creates user with required fields', async () => {
      const result = await callTool('create_user', {
        username: 'newuser',
        password: 'password123',
        email: 'new@example.com',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.username).toBe('newuser');
    });
  });

  describe('update_user', () => {
    it('updates user fields', async () => {
      const result = await callTool('update_user', {
        username: 'admin',
        fullname: 'Updated Admin',
      });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('delete_user', () => {
    it('deletes user', async () => {
      const result = await callTool('delete_user', { username: 'editor' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });
  });

  describe('manage_api_keys', () => {
    it('lists API keys', async () => {
      const result = await callTool('manage_api_keys', {
        username: 'admin',
        action: 'list',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
    });

    it('creates API key with warning', async () => {
      const result = await callTool('manage_api_keys', {
        username: 'admin',
        action: 'create',
        name: 'Test Key',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.key).toBeDefined();
      expect(data._warning).toContain('shown only once');
    });

    it('revokes API key', async () => {
      const result = await callTool('manage_api_keys', {
        username: 'admin',
        action: 'revoke',
        key_id: 'key_abc123',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('returns error when revoking without key_id', async () => {
      const result = await callTool('manage_api_keys', {
        username: 'admin',
        action: 'revoke',
      });
      expect(result.isError).toBeUndefined(); // Returns error in data, not isError
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('key_id is required');
    });
  });
});
