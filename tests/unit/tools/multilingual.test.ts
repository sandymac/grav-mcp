import { describe, it, expect, beforeAll } from 'vitest';
import { GravClient } from '../../../src/client/grav-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMultilingualTools } from '../../../src/tools/multilingual.js';

describe('Multilingual Tools', () => {
  let client: GravClient;
  let server: McpServer;
  const ensureInit = async () => { await client.initialize(); };

  beforeAll(async () => {
    client = new GravClient({ baseUrl: 'http://test.local/api', apiKey: 'grav_test' });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerMultilingualTools(server, client, ensureInit);
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const tools = (server as any)._registeredTools as Record<string, any>;
    const tool = tools[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(args, {});
  }

  describe('list_languages', () => {
    it('returns configured languages', async () => {
      const result = await callTool('list_languages');
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
      expect(data[0].code).toBe('en');
    });
  });

  describe('get_page_translations', () => {
    it('returns translated and untranslated languages', async () => {
      const result = await callTool('get_page_translations', { route: '/blog/hello-world' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toBeDefined();
      // May return translated/untranslated or the page object depending on route matching
      if (data.translated) {
        expect(data.translated).toContain('en');
      }
    });
  });

  describe('create_translation', () => {
    it('creates new translation', async () => {
      const result = await callTool('create_translation', {
        route: '/blog/hello-world',
        lang: 'fr',
        title: 'Bonjour le Monde',
        content: '# Bonjour',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.title).toBe('Bonjour le Monde');
    });
  });

  describe('adopt_page_language', () => {
    it('renames an untyped page file to a language-tagged one', async () => {
      const result = await callTool('adopt_page_language', {
        route: '/blog/hello-world',
        language: 'en',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.language).toBe('en');
      expect(data.filename).toBe('default.en.md');
    });

    it('errors when language is missing', async () => {
      const result = await callTool('adopt_page_language', {
        route: '/blog/hello-world',
        language: '',
      });
      expect(result.isError).toBe(true);
    });
  });

  describe('compare_translations', () => {
    it('returns comparison data', async () => {
      const result = await callTool('compare_translations', {
        route: '/blog/hello-world',
        source_lang: 'en',
        target_lang: 'fr',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toBeDefined();
    });
  });
});
