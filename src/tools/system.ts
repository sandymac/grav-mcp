import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { SystemInfo, LogEntry, BackupInfo, DashboardStats, Notification } from '../types/grav-api.js';
import { handleToolCall, toolResult, buildQuery, addPaginationInfo } from './helpers.js';

export function registerSystemTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  server.registerTool('get_system_info', {
    title: 'Get System Info',
    description:
      'Get comprehensive system information including Grav version, PHP version, disk usage, environment, and installed package counts. [Requires: api.system.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const response = await client.get<SystemInfo>('/system/info');
    return toolResult(response.data);
  }));

  server.registerTool('clear_cache', {
    title: 'Clear Cache',
    description:
      'Clear the Grav cache. Scope options: "all" clears everything, "standard" clears compiled pages/twig (default), "images" clears image cache, "assets" clears CSS/JS pipeline, "tmp" clears temporary files. [Requires: api.system.write]',
    inputSchema: {
      scope: z.enum(['all', 'standard', 'images', 'assets', 'tmp']).optional().describe('Cache scope to clear (default: "standard")'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.write');
    const query = buildQuery({ scope: args.scope });
    await client.delete('/cache', query);
    return toolResult({ success: true, message: `Cache cleared (scope: ${args.scope || 'standard'}).` });
  }));

  server.registerTool('get_logs', {
    title: 'Get Logs',
    description:
      'View Grav system logs with optional filtering by level (ERROR, WARNING, INFO, DEBUG) and text search. [Requires: api.system.read]',
    inputSchema: {
      level: z.enum(['ERROR', 'WARNING', 'INFO', 'DEBUG']).optional().describe('Filter by log level'),
      search: z.string().optional().describe('Search in log messages'),
      page: z.number().int().min(1).optional().describe('Page number'),
      per_page: z.number().int().min(1).max(100).optional().describe('Items per page'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const query = buildQuery({
      level: args.level,
      search: args.search,
      page: args.page ?? 1,
      per_page: args.per_page ?? 50,
    });
    const response = await client.get<LogEntry[]>('/system/logs', query);
    return toolResult(addPaginationInfo(response.data, response.meta));
  }));

  server.registerTool('create_backup', {
    title: 'Create Backup',
    description:
      'Create a full backup of the Grav installation. Returns the backup filename, size, and date. [Requires: api.system.write]',
    annotations: { readOnlyHint: false },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.write');
    const response = await client.post<BackupInfo>('/system/backup');
    return toolResult(response.data);
  }));

  server.registerTool('list_backups', {
    title: 'List Backups',
    description:
      'List all available backups with filenames, sizes, and dates. [Requires: api.system.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const response = await client.get<BackupInfo[]>('/system/backups');
    return toolResult(response.data);
  }));

  server.registerTool('get_scheduler', {
    title: 'Get Scheduler',
    description:
      'View scheduler information: configured jobs with their status, crontab installation status, and execution history. [Requires: api.scheduler.read]',
    inputSchema: {
      view: z.enum(['jobs', 'status', 'history']).optional().describe('Which view to return (default: all)'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.scheduler.read');
    if (args.view === 'status') {
      const response = await client.get<unknown>('/scheduler/status');
      return toolResult(response.data);
    } else if (args.view === 'history') {
      const response = await client.get<unknown>('/scheduler/history');
      return toolResult(response.data);
    } else {
      const response = await client.get<unknown>('/scheduler/jobs');
      return toolResult(response.data);
    }
  }));

  server.registerTool('run_scheduler', {
    title: 'Run Scheduler',
    description:
      'Manually trigger a scheduler run to execute due jobs immediately. [Requires: api.scheduler.write]',
    annotations: { readOnlyHint: false },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.scheduler.write');
    const response = await client.post<unknown>('/scheduler/run');
    return toolResult(response.data);
  }));

  // Dashboard & report tools
  server.registerTool('get_dashboard_stats', {
    title: 'Get Dashboard Stats',
    description:
      'Get site overview statistics: page counts, user counts, plugin/theme counts, media stats, and last backup info. [Requires: api.system.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const response = await client.get<DashboardStats>('/dashboard/stats');
    return toolResult(response.data);
  }));

  server.registerTool('get_notifications', {
    title: 'Get Notifications',
    description:
      'Get system notifications from getgrav.org including updates, security advisories, and announcements. [Requires: api.system.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const response = await client.get<Notification[]>('/dashboard/notifications');
    return toolResult(response.data);
  }));

  server.registerTool('dismiss_notification', {
    title: 'Dismiss Notification',
    description:
      'Dismiss/hide a system notification so it no longer appears. [Requires: api.system.write]',
    inputSchema: {
      id: z.string().describe('Notification ID to dismiss'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.write');
    await client.post<unknown>(`/dashboard/notifications/${args.id}/hide`);
    return toolResult({ success: true, message: `Notification "${args.id}" dismissed.` });
  }));

  server.registerTool('run_reports', {
    title: 'Run Reports',
    description:
      'Generate diagnostic reports including security checks, YAML linting, and any plugin-contributed reports. Each report contains a status and list of items. [Requires: api.reports.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.reports.read');
    const response = await client.get<unknown>('/reports');
    return toolResult(response.data);
  }));
}
