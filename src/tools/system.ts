import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type {
  SystemInfo,
  LogEntry,
  BackupInfo,
  DashboardStats,
  Notification,
  EnvironmentsResponse,
  DashboardWidget,
  DashboardWidgetLayout,
  PasswordPolicy,
} from '../types/grav-api.js';
import { handleToolCall, toolResult, buildQuery, addPaginationInfo } from './helpers.js';

export function registerSystemTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  // @api GET /system/info
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

  // @api DELETE /cache
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

  // @api GET /system/logs
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

  // @api POST /system/backup
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

  // @api GET /system/backups
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

  // @api GET /scheduler/jobs
  // @api GET /scheduler/status
  // @api GET /scheduler/history
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

  // @api POST /scheduler/run
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
  // @api GET /dashboard/stats
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

  // @api GET /dashboard/notifications
  server.registerTool('get_notifications', {
    title: 'Get Notifications',
    description:
      'Get system notifications from getgrav.org. v2 schema: each notification carries `type` (info|notice|warning|promo), `icon`, `title`, `message` (markdown), optional `link`, `image`, `accent`, `action: {label,url}`, and `dependencies` for version-gating. [Requires: api.system.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const response = await client.get<Notification[]>('/dashboard/notifications');
    return toolResult(response.data);
  }));

  // @api POST /dashboard/notifications/{id}/hide
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

  // @api GET /reports
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

  // Environment management (beta.12)
  // @api GET /system/environments
  server.registerTool('list_environments', {
    title: 'List Environments',
    description:
      'List configurable Grav environments under user/env/. Returns the auto-detected host environment and an array of environments with `name`, `label`, `exists`, and `hasOverrides`. Use with `update_config` to target a specific env via the `environment` arg. [Requires: api.system.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const response = await client.get<EnvironmentsResponse>('/system/environments');
    return toolResult(response.data);
  }));

  // @api POST /system/environments
  server.registerTool('create_environment', {
    title: 'Create Environment',
    description:
      'Create a new `user/env/<name>/config/` folder for environment-scoped configuration overrides. Environments are not created implicitly — clients must opt in. [Requires: api.system.write]',
    inputSchema: {
      name: z.string().describe('Environment name (folder under user/env/, e.g. "production", "staging")'),
      label: z.string().optional().describe('Human-readable label (defaults to name)'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.write');
    const body: Record<string, unknown> = { name: args.name };
    if (args.label !== undefined) body.label = args.label;
    const response = await client.post<EnvironmentsResponse>('/system/environments', body);
    return toolResult(response.data);
  }));

  // Dashboard widgets (beta.13)
  // @api GET /dashboard/widgets
  server.registerTool('get_dashboard_widgets', {
    title: 'Get Dashboard Widgets',
    description:
      'Get the resolved dashboard widget list (visibility, size, order) merged from the core registry, plugin contributions, the site-wide layout, and the current user\'s overrides. Each widget carries `sizes[]`, `defaultSize`, `icon`, and `authorize` permission so clients can render the customize-mode size picker. [Requires: api.system.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.read');
    const response = await client.get<DashboardWidget[]>('/dashboard/widgets');
    return toolResult(response.data);
  }));

  // @api PATCH /dashboard/layout
  server.registerTool('update_dashboard_layout', {
    title: 'Update Dashboard Layout',
    description:
      'Save the current user\'s dashboard layout (visibility, size, order per widget). Site-hidden widgets cannot be re-enabled per-user. Stale or unsupported sizes are silently coerced server-side back to the widget\'s `defaultSize`. [Requires: api.system.write]',
    inputSchema: {
      widgets: z.array(z.object({
        id: z.string(),
        visible: z.boolean().optional(),
        size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
        order: z.number().int().optional(),
      })).describe('Per-widget layout overrides'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.system.write');
    const response = await client.patch<DashboardWidget[]>('/dashboard/layout', {
      widgets: args.widgets as unknown as DashboardWidgetLayout[],
    });
    return toolResult(response.data);
  }));

  // @api PATCH /dashboard/site-layout
  server.registerTool('update_site_dashboard_layout', {
    title: 'Update Site Dashboard Layout',
    description:
      'Save the site-wide default dashboard layout. Hides widgets globally for everyone (super-admin only). [Requires: super_admin]',
    inputSchema: {
      widgets: z.array(z.object({
        id: z.string(),
        visible: z.boolean().optional(),
        size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
        order: z.number().int().optional(),
      })).describe('Per-widget site-default overrides'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    // Server-side requires super_admin; permission check on client side is best-effort.
    const response = await client.patch<DashboardWidget[]>('/dashboard/site-layout', {
      widgets: args.widgets as unknown as DashboardWidgetLayout[],
    });
    return toolResult(response.data);
  }));

  // @api GET /auth/password-policy
  server.registerTool('get_password_policy', {
    title: 'Get Password Policy',
    description:
      'Get the configured password policy as a structured `{ regex, min_length, rules[] }` payload. Public — no authentication required. Use to render strength meters or surface policy hints to users before they submit a new password.',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    // No permission check — this endpoint is intentionally public.
    const response = await client.get<PasswordPolicy>('/auth/password-policy');
    return toolResult(response.data);
  }));
}
