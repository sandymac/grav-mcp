import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GravClient } from '../../../src/client/grav-client.js';
import { mockServer } from '../../mocks/handlers.js';
import { limitedUserProfile } from '../../mocks/fixtures/users.js';
import { registerSystemTools } from '../../../src/tools/system.js';
import { registerWebhookTools } from '../../../src/tools/webhooks.js';
import { registerBlueprintTools } from '../../../src/tools/blueprints.js';
import { registerUserTools } from '../../../src/tools/users.js';

/**
 * Pre-flight permission gates must match what the API plugin's controllers
 * actually enforce (requirePermission()). Each case boots a non-super profile
 * holding ONLY the permission the server wants for that route and asserts the
 * local gate lets the call through; a sibling permission must be refused
 * before any request is sent. Source of truth: grav-plugin-api
 * classes/Api/Controllers/*Controller.php.
 */
type Register = (server: McpServer, client: GravClient, ensureInit: () => Promise<void>) => void;

const registrars: Register[] = [
  registerSystemTools,
  registerWebhookTools,
  registerBlueprintTools,
  registerUserTools,
];

function bootWithAccess(access: Record<string, boolean>) {
  mockServer.use(
    http.get('*/v1/me', () =>
      HttpResponse.json({ data: { ...limitedUserProfile, access: { 'api.access': true, ...access } } }),
    ),
  );
  const client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const ensureInit = async () => { await client.initialize(); };
  for (const register of registrars) register(server, client, ensureInit);
  return async (name: string, args: Record<string, unknown> = {}): Promise<any> => {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  };
}

interface Case {
  tool: string;
  args?: Record<string, unknown>;
  requires: string;
  /** A neighbouring permission that must NOT satisfy the gate. */
  decoy: string;
}

const cases: Case[] = [
  // SystemController::backup() / backups() — api.system.backup (GHSA-2f86-9cp8-6hcf)
  { tool: 'create_backup', requires: 'api.system.backup', decoy: 'api.system.write' },
  { tool: 'list_backups', requires: 'api.system.backup', decoy: 'api.system.read' },
  // SystemController::createEnvironment() — api.config.write
  { tool: 'create_environment', args: { name: 'staging' }, requires: 'api.config.write', decoy: 'api.system.write' },
  // WebhookController::test() — PERMISSION_WRITE
  { tool: 'test_webhook', args: { webhook_id: 'wh_001' }, requires: 'api.webhooks.write', decoy: 'api.webhooks.read' },
  // UsersController::requireApiKeyPermission() — read for list, write for mutations
  { tool: 'manage_api_keys', args: { username: 'someone-else', action: 'list' }, requires: 'api.users.read', decoy: 'api.pages.read' },
  { tool: 'manage_api_keys', args: { username: 'someone-else', action: 'create', name: 'k' }, requires: 'api.users.write', decoy: 'api.users.read' },
];

describe('pre-flight permission gates match the API plugin', () => {
  for (const c of cases) {
    describe(`${c.tool}${c.args?.action ? ` (${c.args.action})` : ''}`, () => {
      it(`passes with only ${c.requires}`, async () => {
        const callTool = bootWithAccess({ [c.requires]: true });
        const result = await callTool(c.tool, c.args);
        expect(result.isError).toBeUndefined();
      });

      it(`is refused locally with only ${c.decoy}`, async () => {
        const callTool = bootWithAccess({ [c.decoy]: true });
        const result = await callTool(c.tool, c.args);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain(`'${c.requires}' permission`);
      });
    });
  }

  // Routes the server gates on bare api.access must not demand a narrower tier.
  const accessOnly: Array<{ tool: string; args?: Record<string, unknown> }> = [
    { tool: 'get_dashboard_widgets' },                       // DashboardWidgetController::widgets()
    { tool: 'update_dashboard_layout', args: { widgets: [] } }, // DashboardWidgetController::saveUserLayout()
    { tool: 'get_blueprint', args: { type: 'user', name: 'users' } }, // BlueprintController::userBlueprint()
  ];

  for (const c of accessOnly) {
    it(`${c.tool} passes with only api.access`, async () => {
      const callTool = bootWithAccess({});
      const result = await callTool(c.tool, c.args);
      expect(result.isError).toBeUndefined();
    });
  }
});
