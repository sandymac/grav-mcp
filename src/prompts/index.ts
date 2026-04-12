import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt('create_blog_post', {
    title: 'Create Blog Post',
    description: 'Guided workflow for creating a new blog post with proper template, frontmatter, taxonomy, and media.',
    argsSchema: {
      topic: z.string().describe('Blog post topic or title'),
      lang: z.string().optional().describe('Language code (for multilingual sites)'),
      template: z.string().optional().describe('Page template to use (default: "item" or "blog")'),
    },
  }, async (args) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Create a blog post about: ${args.topic}

Steps:
1. Use list_page_templates to find the right blog template (usually "item" or "blog")
2. Use get_taxonomy to see existing categories and tags
3. Use list_pages with parent="/blog" to understand the blog structure
4. Use create_page with:
   - An SEO-friendly slug derived from the topic
   - The appropriate template${args.template ? ` (use "${args.template}")` : ''}
   - Well-structured markdown content
   - Relevant taxonomy tags and categories from existing values
   - Published: true${args.lang ? `\n   - Language: ${args.lang}` : ''}
5. Confirm the page was created successfully with get_page`,
      },
    }],
  }));

  server.registerPrompt('translate_page', {
    title: 'Translate Page',
    description: 'Translate a page to a target language, preserving structure and adapting content appropriately.',
    argsSchema: {
      route: z.string().describe('Page route to translate'),
      target_lang: z.string().describe('Target language code (e.g. "fr", "de", "es")'),
    },
  }, async (args) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Translate the page at "${args.route}" to ${args.target_lang}.

Steps:
1. Use get_page to read the current page content and frontmatter
2. Use get_page_translations to see which translations already exist
3. Use list_languages to confirm ${args.target_lang} is a configured language
4. Translate the title, content, and relevant frontmatter fields
5. Use create_translation with the translated content
6. Use compare_translations to verify the translation covers all content`,
      },
    }],
  }));

  server.registerPrompt('site_health_check', {
    title: 'Site Health Check',
    description: 'Comprehensive site health check: updates, reports, logs, backups, and scheduler status.',
  }, async () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Perform a comprehensive health check on this Grav site.

Steps:
1. Use get_system_info to check Grav and PHP versions
2. Use check_updates to find available updates for core, plugins, and themes
3. Use run_reports to run security and YAML lint checks
4. Use get_logs with level="ERROR" to check for recent errors
5. Use list_backups to verify backup recency
6. Use get_scheduler with view="status" to check cron is configured
7. Use get_notifications for any important system notices

Summarize findings as:
- Critical issues (security, errors)
- Updates available
- Backup status
- Scheduler status
- Recommendations`,
      },
    }],
  }));

  server.registerPrompt('content_audit', {
    title: 'Content Audit',
    description: 'Audit site content for missing metadata, unpublished drafts, and content quality issues.',
    argsSchema: {
      scope: z.enum(['all', 'published', 'drafts']).optional().describe('Scope of audit'),
    },
  }, async (args) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Audit the site content${args.scope ? ` (scope: ${args.scope})` : ''}.

Steps:
1. Use list_pages to get all pages${args.scope === 'drafts' ? ' with published=false' : args.scope === 'published' ? ' with published=true' : ''}
2. For each page, use get_page to check:
   - Missing or empty title
   - Missing or very short content
   - Missing taxonomy (categories, tags)
   - Missing date
   - Unpublished status (if scope includes drafts)
3. Use get_taxonomy to check for unused or orphaned taxonomy values
4. Check for pages with no media vs pages that could benefit from images

Summarize findings as:
- Pages missing metadata (list routes)
- Unpublished drafts (if applicable)
- Content quality issues
- Taxonomy health
- Recommendations`,
      },
    }],
  }));

  server.registerPrompt('plugin_setup', {
    title: 'Plugin Setup',
    description: 'Search for, install, and configure a Grav plugin end-to-end.',
    argsSchema: {
      search_query: z.string().describe('What kind of plugin you need'),
    },
  }, async (args) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Find, install, and configure a plugin for: ${args.search_query}

Steps:
1. Use search_packages to find relevant plugins
2. For promising results, use get_package_info with include="readme" to review docs
3. Use install_package to install the chosen plugin
4. Use get_blueprint with type="plugin" and the plugin slug to see all config options
5. Use get_config with scope="plugins/{slug}" to see default config
6. Use update_config to set appropriate configuration values
7. Use clear_cache to ensure changes take effect
8. Verify with get_config that the settings were saved correctly`,
      },
    }],
  }));

  server.registerPrompt('bulk_update', {
    title: 'Bulk Update Frontmatter',
    description: 'Update a specific frontmatter field across multiple pages matching a filter.',
    argsSchema: {
      field: z.string().describe('Header field to update (e.g. "taxonomy.category", "metadata.author")'),
      value: z.string().describe('New value to set'),
      filter: z.string().optional().describe('Page filter: template name, parent route, or search query'),
    },
  }, async (args) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Bulk update the "${args.field}" field to "${args.value}" across pages${args.filter ? ` matching: ${args.filter}` : ''}.

Steps:
1. Use list_pages${args.filter ? ` with appropriate filter for "${args.filter}"` : ''} to identify target pages
2. For each page:
   a. Use get_page to read current content and get the ETag
   b. Use update_page with the header field set and the ETag for safe update
3. Report results: how many pages updated, any errors

Important:
- Always use ETags to prevent overwriting concurrent changes
- Log which pages were updated and which failed
- If any update fails with 409 (conflict), re-fetch and retry`,
      },
    }],
  }));
}
