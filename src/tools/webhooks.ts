import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { Webhook, WebhookDelivery } from '../types/grav-api.js';
import { handleToolCall, toolResult, buildQuery, addPaginationInfo } from './helpers.js';

export function registerWebhookTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  server.registerTool('list_webhooks', {
    title: 'List Webhooks',
    description:
      'List all configured webhooks with their URLs, events, active status, and failure count. [Requires: api.webhooks.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.webhooks.read');
    const response = await client.get<Webhook[]>('/webhooks');
    return toolResult(response.data);
  }));

  server.registerTool('manage_webhook', {
    title: 'Manage Webhook',
    description:
      'Create, update, or delete a webhook. Available events: page.created, page.updated, page.deleted, page.moved, page.translated, pages.reordered, media.uploaded, media.deleted, user.created, user.updated, user.deleted, config.updated, gpm.installed, gpm.removed, grav.upgraded. [Requires: api.webhooks.write]',
    inputSchema: {
      action: z.enum(['create', 'update', 'delete']).describe('Action to perform'),
      id: z.string().optional().describe('Webhook ID (required for update and delete)'),
      url: z.string().optional().describe('Webhook endpoint URL (required for create)'),
      events: z.array(z.string()).optional().describe('Array of event names to subscribe to'),
      active: z.boolean().optional().describe('Whether the webhook is active'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.webhooks.write');

    switch (args.action) {
      case 'create': {
        const body: Record<string, unknown> = {
          url: args.url,
          events: args.events,
        };
        if (args.active !== undefined) body.active = args.active;
        const response = await client.post<Webhook>('/webhooks', body);
        return toolResult(response.data);
      }
      case 'update': {
        if (!args.id) return toolResult({ error: 'id is required for update action' });
        const body: Record<string, unknown> = {};
        if (args.url !== undefined) body.url = args.url;
        if (args.events !== undefined) body.events = args.events;
        if (args.active !== undefined) body.active = args.active;
        const response = await client.patch<Webhook>(`/webhooks/${args.id}`, body);
        return toolResult(response.data);
      }
      case 'delete': {
        if (!args.id) return toolResult({ error: 'id is required for delete action' });
        await client.delete(`/webhooks/${args.id}`);
        return toolResult({ success: true, message: `Webhook "${args.id}" deleted.` });
      }
    }
  }));

  server.registerTool('get_webhook_deliveries', {
    title: 'Get Webhook Deliveries',
    description:
      'View the delivery log for a webhook, showing each attempt with status code, success, response time, and timestamp. [Requires: api.webhooks.read]',
    inputSchema: {
      webhook_id: z.string().describe('Webhook ID'),
      page: z.number().int().min(1).optional().describe('Page number'),
      per_page: z.number().int().min(1).max(100).optional().describe('Items per page'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.webhooks.read');
    const query = buildQuery({
      page: args.page ?? 1,
      per_page: args.per_page ?? 50,
    });
    const response = await client.get<WebhookDelivery[]>(
      `/webhooks/${args.webhook_id}/deliveries`,
      query,
    );
    return toolResult(addPaginationInfo(response.data, response.meta));
  }));

  server.registerTool('test_webhook', {
    title: 'Test Webhook',
    description:
      'Send a test payload to a webhook endpoint to verify it is receiving and processing correctly. [Requires: api.webhooks.read]',
    inputSchema: {
      webhook_id: z.string().describe('Webhook ID to test'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.webhooks.read');
    const response = await client.post<unknown>(`/webhooks/${args.webhook_id}/test`);
    return toolResult(response.data);
  }));
}
