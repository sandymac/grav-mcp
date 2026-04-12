#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

interface CliConfig {
  url: string;
  apiKey: string;
  environment?: string;
  transport: 'stdio' | 'http';
  port: number;
}

function parseArgs(): CliConfig {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      parsed.url = args[++i];
    } else if (arg === '--key' && args[i + 1]) {
      parsed.key = args[++i];
    } else if (arg === '--environment' && args[i + 1]) {
      parsed.environment = args[++i];
    } else if (arg === '--transport' && args[i + 1]) {
      parsed.transport = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      parsed.port = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      console.log('grav-mcp 0.1.0');
      process.exit(0);
    }
  }

  const url = parsed.url || process.env.GRAV_API_URL;
  const apiKey = parsed.key || process.env.GRAV_API_KEY;
  const environment = parsed.environment || process.env.GRAV_ENVIRONMENT;
  const transport = (parsed.transport || 'stdio') as 'stdio' | 'http';
  const port = parseInt(parsed.port || '3100', 10);

  if (!url) {
    console.error('Error: GRAV_API_URL is required. Set via --url or GRAV_API_URL environment variable.');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Error: GRAV_API_KEY is required. Set via --key or GRAV_API_KEY environment variable.');
    process.exit(1);
  }

  if (transport !== 'stdio' && transport !== 'http') {
    console.error(`Error: Invalid transport "${transport}". Must be "stdio" or "http".`);
    process.exit(1);
  }

  return { url, apiKey, environment, transport, port };
}

function printUsage(): void {
  console.log(`
grav-mcp — MCP server for Grav CMS

Usage:
  grav-mcp [options]

Options:
  --url <url>           Grav API base URL (or GRAV_API_URL env var)
  --key <key>           API key (or GRAV_API_KEY env var)
  --environment <env>   Grav environment override (or GRAV_ENVIRONMENT env var)
  --transport <type>    Transport: stdio (default) or http
  --port <port>         HTTP port (default: 3100, only with --transport http)
  -h, --help            Show this help
  -v, --version         Show version

Examples:
  # stdio transport (for Claude Code, Cursor, VS Code)
  GRAV_API_URL=https://mysite.com/api GRAV_API_KEY=grav_abc123 grav-mcp

  # HTTP transport (for remote/hosted deployment)
  grav-mcp --url https://mysite.com/api --key grav_abc123 --transport http --port 3100
`);
}

async function main(): Promise<void> {
  const config = parseArgs();
  const server = createServer({
    url: config.url,
    apiKey: config.apiKey,
    environment: config.environment,
  });

  if (config.transport === 'stdio') {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    // HTTP transport — dynamic import to avoid loading when not needed
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const http = await import('node:http');

    const httpServer = http.createServer(async (req, res) => {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    });

    httpServer.listen(config.port, () => {
      console.error(`grav-mcp HTTP server listening on port ${config.port}`);
    });
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
