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
  private permissions: Record<string, boolean> | null = null;
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
    this.permissions = user.permissions ?? {};
    this.isSuperAdmin = this.resolvePermission('admin.super');
    return user;
  }

  hasPermission(permission: string): boolean {
    if (this.isSuperAdmin) return true;
    if (!this.permissions) return true; // Not initialized yet, let server decide
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
  ): Promise<GravResponseEnvelope<T>> {
    return this.request<T>('GET', path, { query });
  }

  async post<T>(
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<GravResponseEnvelope<T>> {
    return this.request<T>('POST', path, { body, query });
  }

  async patch<T>(
    path: string,
    body?: Record<string, unknown>,
    options?: { etag?: string; query?: Record<string, string | number | boolean | undefined> },
  ): Promise<GravResponseEnvelope<T>> {
    return this.request<T>('PATCH', path, {
      body,
      etag: options?.etag,
      query: options?.query,
    });
  }

  async delete(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<void> {
    await this.request('DELETE', path, { query });
  }

  async uploadFile<T>(
    path: string,
    files: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<GravResponseEnvelope<T>> {
    const boundary = `----GravMCP${Date.now()}`;
    let body = '';

    for (const file of files) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="file${files.indexOf(file)}"; filename="${file.filename}"\r\n`;
      body += `Content-Type: ${file.contentType}\r\n\r\n`;
    }

    // For multipart we need to use FormData with Node's fetch
    const formData = new FormData();
    for (const file of files) {
      const blob = new Blob([file.content], { type: file.contentType });
      formData.append('file', blob, file.filename);
    }

    const url = this.buildUrl(path);
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
    };
    if (this.environment) {
      headers['X-Grav-Environment'] = this.environment;
    }

    const response = await fetch(url, {
      method: 'POST',
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
    },
  ): Promise<GravResponseEnvelope<T>> {
    const url = this.buildUrl(path, options?.query);

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Accept': 'application/json',
    };

    if (this.environment) {
      headers['X-Grav-Environment'] = this.environment;
    }

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    if (options?.etag) {
      headers['If-Match'] = options.etag;
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
    if (!this.permissions) return false;

    // Direct match
    if (this.permissions[permission] === true) return true;

    // Check parent permissions (e.g., api.pages grants api.pages.read)
    const parts = permission.split('.');
    for (let i = parts.length - 1; i >= 1; i--) {
      const parent = parts.slice(0, i).join('.');
      if (this.permissions[parent] === true) return true;
    }

    // Check in access.admin.super and access.api hierarchy
    if (permission.startsWith('api.')) {
      if (this.permissions['access.admin.super'] === true) return true;
    }

    return false;
  }
}
