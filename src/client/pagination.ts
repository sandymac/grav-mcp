import type { GravClient } from './grav-client.js';

const MAX_AUTO_PAGINATE = 1000;

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export async function* paginateAll<T>(
  client: GravClient,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): AsyncGenerator<T> {
  let page = 1;
  let yielded = 0;

  while (true) {
    const response = await client.get<T[]>(path, { ...query, page, per_page: 100 });
    const items = response.data;

    for (const item of items) {
      yield item;
      yielded++;
      if (yielded >= MAX_AUTO_PAGINATE) return;
    }

    const totalPages = response.meta?.pagination?.total_pages ?? 1;
    if (page >= totalPages) break;
    page++;
  }
}

export async function fetchAllPages<T>(
  client: GravClient,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<{ items: T[]; total: number; truncated: boolean }> {
  const items: T[] = [];
  let total = 0;

  for await (const item of paginateAll<T>(client, path, query)) {
    items.push(item);
  }

  // Get total from a single request to check if truncated
  const probe = await client.get<T[]>(path, { ...query, page: 1, per_page: 1 });
  total = probe.meta?.pagination?.total ?? items.length;

  return {
    items,
    total,
    truncated: items.length < total,
  };
}
