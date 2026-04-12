import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GravApiError } from '../client/error-mapper.js';

export function toolResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(message: string, hint?: string): CallToolResult {
  const text = hint ? `${message}\n\nHint: ${hint}` : message;
  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}

export async function handleToolCall(
  ensureInit: () => Promise<void>,
  fn: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  await ensureInit();
  try {
    return await fn();
  } catch (error) {
    if (error instanceof GravApiError) {
      return toolError(error.message, error.hint);
    }
    const msg = error instanceof Error ? error.message : String(error);
    return toolError(`Unexpected error: ${msg}`);
  }
}

// Strip leading slash for API path consistency
export function normalizePath(route: string): string {
  return route.startsWith('/') ? route : `/${route}`;
}

// Build query params, filtering out undefined values
export function buildQuery(
  params: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> {
  const query: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = value;
    }
  }
  return query;
}

export function addPaginationInfo(
  data: unknown,
  meta?: { pagination?: { page: number; per_page: number; total: number; total_pages: number } },
): unknown {
  if (!meta?.pagination) return data;
  return {
    data,
    pagination: meta.pagination,
  };
}
