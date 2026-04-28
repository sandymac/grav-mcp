import type { ApiResponse, ApiMeta, ProblemDetail, UserProfile } from '../types/grav-api.js';
import { mapGravError, GravApiError } from './error-mapper.js';

export interface GravClientConfig {
  baseUrl: string;
  apiKey: string;
  environment?: string;
}

export interface GravResponseEnvelope<T> {
  data: T;
  meta?: ApiMeta;
  etag?: string;
}

export class GravClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly environment?: string;
  private access: Record<string, boolean> | null = null;
  private isSuperAdmin = false;
  private rateLimitRemaining: number | null = null;

  constructor(config: GravClientConfig) {
    // Normalize URL: strip trailing slash, ensure /v1 suffix
    let url = config.baseUrl.replace(/\/+$/, '');
    if (!url.endsWith('/v1')) {
      url += '/v1';
    }
    this.baseUrl = url;
    this.apiKey = config.apiKey;
    this.environment = config.environment;
  }

  async initialize(): Promise<UserProfile> {
    const response = await this.get<UserProfile>('/me');
    const user = response.data;
    this.access = user.access ?? {};
    // Grav 2.0 API authority is gated solely on `access.api.super`; the legacy
    // `admin.super` from admin-classic is intentionally not honored. The /me
    // endpoint already does this resolution server-side and returns it as
    // `super_admin`, so just trust it.
    this.isSuperAdmin = user.super_admin === true;
    return user;
  }

  hasPermission(permission: string): boolean {
    if (this.isSuperAdmin) return true;
    if (!this.access) return true; // Not initialized yet, let server decide
    return this.resolvePermission(permission);
  }

  checkPermission(permission: string): void {
    if (!this.hasPermission(permission)) {
      throw new GravApiError(
        `Your API key does not have the '${permission}' permission. Contact your Grav administrator.`,
        403,
        false,
      );
    }
  }

  getRateLimitStatus(): { remaining: number | null } {
    return { remaining: this.rateLimitRemaining };
  }

  async get<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    options?: { headers?: Record<string, string> },
  ): Promise<GravResponseEnvelope<T>> {
    return this.request<T>('GET', path, { query, headers: options?.headers });
  }

  async post<T>(
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
    options?: { headers?: Record<string, string> },
  ): Promise<GravResponseEnvelope<T>> {
    return this.request<T>('POST', path, { body, query, headers: options?.headers });
  }

  async patch<T>(
    path: string,
    body?: Record<string, unknown>,
    options?: {
      etag?: string;
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
    },
  ): Promise<GravResponseEnvelope<T>> {
    return this.request<T>('PATCH', path, {
      body,
      etag: options?.etag,
      query: options?.query,
      headers: options?.headers,
    });
  }

  async delete(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    options?: { headers?: Record<string, string>; body?: Record<string, unknown> },
  ): Promise<void> {
    await this.request('DELETE', path, {
      query,
      headers: options?.headers,
      body: options?.body,
    });
  }

  async uploadFile<T>(
    path: string,
    files: Array<{ filename: string; content: Buffer; contentType: string }>,
    options?: {
      method?: 'POST' | 'PUT';
      fields?: Record<string, string>;
      headers?: Record<string, string>;
      query?: Record<string, string | number | boolean | undefined>;
    },
  ): Promise<GravResponseEnvelope<T>> {
    const formData = new FormData();
    for (const file of files) {
      const blob = new Blob([file.content], { type: file.contentType });
      formData.append('file', blob, file.filename);
    }
    if (options?.fields) {
      for (const [key, value] of Object.entries(options.fields)) {
        formData.append(key, value);
      }
    }

    const url = this.buildUrl(path, options?.query);
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
    };
    if (this.environment) {
      headers['X-Config-Environment'] = this.environment;
    }
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const response = await fetch(url, {
      method: options?.method ?? 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      query?: Record<string, string | number | boolean | undefined>;
      etag?: string;
      headers?: Record<string, string>;
    },
  ): Promise<GravResponseEnvelope<T>> {
    const url = this.buildUrl(path, options?.query);

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Accept': 'application/json',
    };

    if (this.environment) {
      headers['X-Config-Environment'] = this.environment;
    }

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    if (options?.etag) {
      headers['If-Match'] = options.etag;
    }

    // Per-request header overrides (e.g. X-Config-Environment for update_config)
    // win over the constructor-level environment. Spread last so callers can
    // override Content-Type or auth in advanced cases too.
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    // Track rate limits
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining !== null) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<GravResponseEnvelope<T>> {
    if (response.status === 204) {
      return { data: undefined as T };
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      if (!response.ok) {
        throw new GravApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.status >= 500,
        );
      }
      return { data: undefined as T };
    }

    const json = await response.json() as ApiResponse<T> | ProblemDetail;

    if (!response.ok) {
      throw mapGravError(response.status, json as ProblemDetail, response.headers);
    }

    const apiResponse = json as ApiResponse<T>;
    const etag = response.headers.get('ETag') || undefined;

    return {
      data: apiResponse.data,
      meta: apiResponse.meta,
      etag,
    };
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private resolvePermission(permission: string): boolean {
    if (!this.access) return false;

    // Direct match against the resolved access map returned by /me
    if (this.access[permission] === true) return true;

    // Walk up parent permissions (e.g. `api.pages` grants `api.pages.read`),
    // matching how the server's PermissionResolver inherits permissions.
    const parts = permission.split('.');
    for (let i = parts.length - 1; i >= 1; i--) {
      const parent = parts.slice(0, i).join('.');
      if (this.access[parent] === true) return true;
    }

    return false;
  }
}
