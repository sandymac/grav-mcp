import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GravClient } from './client/grav-client.js';
import { registerPageTools } from './tools/pages.js';
import { registerMultilingualTools } from './tools/multilingual.js';
import { registerMediaTools } from './tools/media.js';
import { registerConfigTools } from './tools/config.js';
import { registerUserTools } from './tools/users.js';
import { registerGpmTools } from './tools/gpm.js';
import { registerSystemTools } from './tools/system.js';
import { registerWebhookTools } from './tools/webhooks.js';
import { registerBlueprintTools } from './tools/blueprints.js';
import { registerPluginTools } from './tools/plugins.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

export interface ServerConfig {
  url: string;
  apiKey: string;
  environment?: string;
}

export function createServer(config: ServerConfig): McpServer {
  const client = new GravClient({
    baseUrl: config.url,
    apiKey: config.apiKey,
    environment: config.environment,
  });

  const server = new McpServer(
    {
      name: 'grav-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  // Initialize client (fetch permissions) on first connection
  let initialized = false;
  const ensureInitialized = async (): Promise<void> => {
    if (!initialized) {
      try {
        await client.initialize();
        initialized = true;
      } catch (error) {
        // Log but don't block — tools will get permission errors at call time
        console.error('Warning: Failed to fetch user permissions:', error);
        initialized = true;
      }
    }
  };

  // Register all tool groups
  registerPageTools(server, client, ensureInitialized);
  registerMultilingualTools(server, client, ensureInitialized);
  registerMediaTools(server, client, ensureInitialized);
  registerConfigTools(server, client, ensureInitialized);
  registerUserTools(server, client, ensureInitialized);
  registerGpmTools(server, client, ensureInitialized);
  registerSystemTools(server, client, ensureInitialized);
  registerWebhookTools(server, client, ensureInitialized);
  registerBlueprintTools(server, client, ensureInitialized);
  registerPluginTools(server, client, ensureInitialized);

  // Register resources and prompts
  registerResources(server, client, ensureInitialized);
  registerPrompts(server);

  return server;
}
