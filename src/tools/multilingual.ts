import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GravClient } from '../client/grav-client.js';
import type { LanguageInfo, PageTranslations, Page, AdoptLanguageResponse } from '../types/grav-api.js';
import { handleToolCall, toolResult } from './helpers.js';

export function registerMultilingualTools(
  server: McpServer,
  client: GravClient,
  ensureInit: () => Promise<void>,
): void {
  // @api GET /languages
  server.registerTool('list_languages', {
    title: 'List Languages',
    description:
      'List all configured site languages with codes, names, and which is the default. [Requires: api.pages.read]',
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.pages.read');
    const response = await client.get<LanguageInfo[]>('/languages');
    return toolResult(response.data);
  }));

  // @api GET /pages/{route}/languages
  server.registerTool('get_page_translations', {
    title: 'Get Page Translations',
    description:
      'Show which language translations exist and which are missing for a specific page. [Requires: api.pages.read]',
    inputSchema: {
      route: z.string().describe('Page route to check translations for'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.pages.read');
    const route = args.route.replace(/^\/+/, '');
    const response = await client.get<PageTranslations>(`/pages/${route}/languages`);
    return toolResult(response.data);
  }));

  // @api POST /pages/{route}/translate
  server.registerTool('create_translation', {
    title: 'Create Translation',
    description:
      'Create a new language translation for an existing page. Provide the language code and optionally the title, content, and header for the translated version. [Requires: api.pages.write]',
    inputSchema: {
      route: z.string().describe('Page route to translate'),
      lang: z.string().describe('Target language code (e.g. "fr", "de", "es")'),
      title: z.string().optional().describe('Translated title'),
      content: z.string().optional().describe('Translated content in markdown'),
      header: z.record(z.unknown()).optional().describe('Translated header/frontmatter fields'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.pages.write');
    const route = args.route.replace(/^\/+/, '');
    const body: Record<string, unknown> = { lang: args.lang };
    if (args.title !== undefined) body.title = args.title;
    if (args.content !== undefined) body.content = args.content;
    if (args.header !== undefined) body.header = args.header;

    const response = await client.post<Page>(`/pages/${route}/translate`, body);
    return toolResult(response.data);
  }));

  // @api POST /pages/{route}/adopt-language
  server.registerTool('adopt_page_language', {
    title: 'Adopt Page Language',
    description:
      'Claim an untyped base page file (e.g. `default.md`) as a specific language by renaming it to `{template}.{lang}.md` in place. Pure filesystem rename — content is untouched. Fails if the page already has an explicit file for that language, or if it has no untyped base file. Useful for "Save as English" workflows on sites that started single-language and later enabled multilang. [Requires: api.pages.write]',
    inputSchema: {
      route: z.string().describe('Page route to adopt'),
      language: z.string().describe('Target language code (e.g. "en", "fr")'),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.pages.write');
    const route = args.route.replace(/^\/+/, '');
    const response = await client.post<AdoptLanguageResponse>(
      `/pages/${route}/adopt-language`,
      { language: args.language },
    );
    return toolResult(response.data);
  }));

  // @api GET /pages/{route}/compare
  server.registerTool('compare_translations', {
    title: 'Compare Translations',
    description:
      'Compare two language versions of a page side-by-side to identify differences in content and frontmatter. [Requires: api.pages.read]',
    inputSchema: {
      route: z.string().describe('Page route'),
      source_lang: z.string().describe('Source language code'),
      target_lang: z.string().describe('Target language code to compare against'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => handleToolCall(ensureInit, async () => {
    client.checkPermission('api.pages.read');
    const route = args.route.replace(/^\/+/, '');
    const response = await client.get<unknown>(`/pages/${route}/compare`, {
      source: args.source_lang,
      target: args.target_lang,
    });
    return toolResult(response.data);
  }));
}
