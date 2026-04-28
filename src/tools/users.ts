import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { User, ApiKeyInfo, ApiKeyCreated } from '../types/grav-api.js';
import { handleToolCall, toolResult, buildQuery, addPaginationInfo } from './helpers.js';

export function registerUserTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  // @api GET /users
  server.registerTool('list_users', {
    title: 'List Users',
    description:
      'List all user accounts with optional search and pagination. [Requires: api.users.read]',
    inputSchema: {
      search: z.string().optional().describe('Search users by username, email, or name'),
      page: z.number().int().min(1).optional().describe('Page number'),
      per_page: z.number().int().min(1).max(100).optional().describe('Items per page'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.users.read');
    const query = buildQuery({
      search: args.search,
      page: args.page ?? 1,
      per_page: args.per_page ?? 50,
    });
    const response = await client.get<User[]>('/users', query);
    return toolResult(addPaginationInfo(response.data, response.meta));
  }));

  // @api GET /users/{username}
  server.registerTool('get_user', {
    title: 'Get User',
    description:
      'Get full details for a specific user including their access permissions and groups. [Requires: api.users.read]',
    inputSchema: {
      username: z.string().describe('Username to look up'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.users.read');
    const response = await client.get<User>(`/users/${args.username}`);
    const result: Record<string, unknown> = { ...response.data };
    if (response.etag) result._etag = response.etag;
    return toolResult(result);
  }));

  // @api POST /users
  server.registerTool('create_user', {
    title: 'Create User',
    description:
      'Create a new user account. Username, password, and email are required. Optionally set full name, title, state, and access permissions. [Requires: api.users.write]',
    inputSchema: {
      username: z.string().describe('Username (alphanumeric, no spaces)'),
      password: z.string().describe('Password'),
      email: z.string().email().describe('Email address'),
      fullname: z.string().optional().describe('Full display name'),
      title: z.string().optional().describe('Title/role description'),
      state: z.enum(['enabled', 'disabled']).optional().describe('Account state'),
      access: z.record(z.unknown()).optional().describe('Permission access map'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.users.write');
    const body: Record<string, unknown> = {
      username: args.username,
      password: args.password,
      email: args.email,
    };
    if (args.fullname !== undefined) body.fullname = args.fullname;
    if (args.title !== undefined) body.title = args.title;
    if (args.state !== undefined) body.state = args.state;
    if (args.access !== undefined) body.access = args.access;

    const response = await client.post<User>('/users', body);
    return toolResult(response.data);
  }));

  // @api PATCH /users/{username}
  server.registerTool('update_user', {
    title: 'Update User',
    description:
      'Update user profile fields, password, or access permissions. Only provided fields are changed. [Requires: api.users.write]',
    inputSchema: {
      username: z.string().describe('Username to update'),
      email: z.string().email().optional().describe('New email'),
      fullname: z.string().optional().describe('New full name'),
      title: z.string().optional().describe('New title'),
      state: z.enum(['enabled', 'disabled']).optional().describe('Account state'),
      password: z.string().optional().describe('New password'),
      access: z.record(z.unknown()).optional().describe('Updated permission access map'),
      etag: z.string().optional().describe('ETag for conflict detection'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.users.write');
    const body: Record<string, unknown> = {};
    if (args.email !== undefined) body.email = args.email;
    if (args.fullname !== undefined) body.fullname = args.fullname;
    if (args.title !== undefined) body.title = args.title;
    if (args.state !== undefined) body.state = args.state;
    if (args.password !== undefined) body.password = args.password;
    if (args.access !== undefined) body.access = args.access;

    const response = await client.patch<User>(`/users/${args.username}`, body, { etag: args.etag });
    return toolResult(response.data);
  }));

  // @api DELETE /users/{username}
  server.registerTool('delete_user', {
    title: 'Delete User',
    description:
      'Delete a user account. You cannot delete your own account. [Requires: api.users.write]',
    inputSchema: {
      username: z.string().describe('Username to delete'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.users.write');
    await client.delete(`/users/${args.username}`);
    return toolResult({ success: true, message: `User "${args.username}" deleted.` });
  }));

  // @api GET /users/{username}/api-keys
  // @api POST /users/{username}/api-keys
  // @api DELETE /users/{username}/api-keys/{keyId}
  server.registerTool('manage_api_keys', {
    title: 'Manage API Keys',
    description:
      'List, create, or revoke API keys for a user. For "create": returns the key value once — save it immediately. For "revoke": provide the key_id. [Requires: api.users.write]',
    inputSchema: {
      username: z.string().describe('Username whose API keys to manage'),
      action: z.enum(['list', 'create', 'revoke']).describe('Action to perform'),
      name: z.string().optional().describe('Name for new key (required for "create")'),
      expiry_days: z.number().int().min(1).optional().describe('Days until expiry (for "create")'),
      key_id: z.string().optional().describe('Key ID to revoke (required for "revoke")'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.users.write');

    switch (args.action) {
      case 'list': {
        const response = await client.get<ApiKeyInfo[]>(`/users/${args.username}/api-keys`);
        return toolResult(response.data);
      }
      case 'create': {
        const body: Record<string, unknown> = { name: args.name || 'MCP-generated key' };
        if (args.expiry_days) body.expiry = args.expiry_days;
        const response = await client.post<ApiKeyCreated>(`/users/${args.username}/api-keys`, body);
        return toolResult({
          ...response.data,
          _warning: 'This API key is shown only once. Save it now.',
        });
      }
      case 'revoke': {
        if (!args.key_id) {
          return toolResult({ error: 'key_id is required for revoke action' });
        }
        await client.delete(`/users/${args.username}/api-keys/${args.key_id}`);
        return toolResult({ success: true, message: `API key "${args.key_id}" revoked.` });
      }
    }
  }));
}
