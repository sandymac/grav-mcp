import type { ProblemDetail } from '../types/grav-api.js';

export class GravApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly isRetryable: boolean,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'GravApiError';
  }
}

export function mapGravError(status: number, body: ProblemDetail, headers?: Headers): GravApiError {
  switch (status) {
    case 401:
      return new GravApiError(
        'Authentication failed. Check your GRAV_API_KEY is valid and not expired.',
        401,
        false,
      );

    case 403:
      return new GravApiError(
        `Permission denied: ${body.detail || body.title}`,
        403,
        false,
        'Check that your API key has the required permission.',
      );

    case 404:
      return new GravApiError(
        body.detail || 'Resource not found.',
        404,
        false,
      );

    case 409:
      return new GravApiError(
        'Resource was modified by another user since you last read it.',
        409,
        true,
        'Fetch the latest version first to get a current ETag, then retry your update.',
      );

    case 422: {
      const fieldErrors = body.errors
        ?.map((e) => `${e.field}: ${e.message}`)
        .join('; ');
      return new GravApiError(
        `Validation error: ${fieldErrors || body.detail || 'Invalid input'}`,
        422,
        false,
      );
    }

    case 429: {
      const retryAfter = headers?.get('Retry-After') || headers?.get('X-RateLimit-Reset');
      const waitMsg = retryAfter ? ` Retry after ${retryAfter}s.` : '';
      return new GravApiError(
        `Rate limited.${waitMsg}`,
        429,
        true,
        'Wait for the rate limit window to reset before retrying.',
      );
    }

    default:
      if (status >= 500) {
        return new GravApiError(
          `Server error (${status}): ${body.detail || body.title || 'Internal error'}`,
          status,
          true,
        );
      }
      return new GravApiError(
        `API error (${status}): ${body.detail || body.title || 'Unknown error'}`,
        status,
        false,
      );
  }
}
