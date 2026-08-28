import { describe, it, expect } from 'vitest';
import { mapGravError, GravApiError } from '../../../src/client/error-mapper.js';

describe('mapGravError', () => {
  it('maps 401 to non-retryable auth error', () => {
    const error = mapGravError(401, { status: 401, title: 'Unauthorized' });
    expect(error).toBeInstanceOf(GravApiError);
    expect(error.status).toBe(401);
    expect(error.isRetryable).toBe(false);
    expect(error.message).toContain('Authentication failed');
    expect(error.message).toContain('GRAV_API_KEY');
  });

  it('maps 403 to non-retryable permission error', () => {
    const error = mapGravError(403, {
      status: 403,
      title: 'Forbidden',
      detail: 'Missing permission: api.pages.write',
    });
    expect(error.status).toBe(403);
    expect(error.isRetryable).toBe(false);
    expect(error.message).toContain('Permission denied');
    expect(error.message).toContain('api.pages.write');
  });

  it('maps 404 to non-retryable not found', () => {
    const error = mapGravError(404, {
      status: 404,
      title: 'Not Found',
      detail: 'Page "/nonexistent" not found',
    });
    expect(error.status).toBe(404);
    expect(error.isRetryable).toBe(false);
    expect(error.message).toContain('/nonexistent');
  });

  it('maps 409 to retryable conflict with hint', () => {
    const error = mapGravError(409, {
      status: 409,
      title: 'Conflict',
      detail: 'Resource was modified',
    });
    expect(error.status).toBe(409);
    expect(error.isRetryable).toBe(true);
    expect(error.hint).toContain('ETag');
  });

  it('reads data.message from a 404 that carries a data envelope', () => {
    const error = mapGravError(404, {
      status: 404,
      title: 'Not Found',
      data: { message: 'No license matches that key.', code: 'license_not_found' },
    } as never);
    expect(error.status).toBe(404);
    expect(error.message).toBe('No license matches that key.');
  });

  it('passes a plugin state conflict through on 409', () => {
    const error = mapGravError(409, {
      status: 409,
      title: 'Conflict',
      detail: "Attribute 'material' is answered by 12 product(s); delete it with force to remove those values too",
    });
    expect(error.status).toBe(409);
    expect(error.isRetryable).toBe(false);
    expect(error.message).toContain('delete it with force');
    expect(error.hint).not.toContain('ETag');
  });

  it('maps 422 with field errors', () => {
    const error = mapGravError(422, {
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'Validation failed',
      errors: [
        { field: 'title', message: 'Title is required' },
        { field: 'route', message: 'Route must start with /' },
      ],
    });
    expect(error.status).toBe(422);
    expect(error.isRetryable).toBe(false);
    expect(error.message).toContain('title: Title is required');
    expect(error.message).toContain('route: Route must start with /');
  });

  it('maps 422 without field errors', () => {
    const error = mapGravError(422, {
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'Invalid input data',
    });
    expect(error.message).toContain('Invalid input data');
  });

  it('maps 429 to retryable rate limit error', () => {
    const headers = new Headers({ 'Retry-After': '30' });
    const error = mapGravError(429, {
      status: 429,
      title: 'Too Many Requests',
    }, headers);
    expect(error.status).toBe(429);
    expect(error.isRetryable).toBe(true);
    expect(error.message).toContain('Rate limited');
    expect(error.message).toContain('30');
  });

  it('maps 429 without Retry-After header', () => {
    const error = mapGravError(429, {
      status: 429,
      title: 'Too Many Requests',
    });
    expect(error.isRetryable).toBe(true);
    expect(error.message).toContain('Rate limited');
  });

  it('maps 500 to retryable server error', () => {
    const error = mapGravError(500, {
      status: 500,
      title: 'Internal Server Error',
      detail: 'Something went wrong',
    });
    expect(error.status).toBe(500);
    expect(error.isRetryable).toBe(true);
    expect(error.message).toContain('Server error');
  });

  it('maps 503 to retryable server error', () => {
    const error = mapGravError(503, {
      status: 503,
      title: 'Service Unavailable',
    });
    expect(error.status).toBe(503);
    expect(error.isRetryable).toBe(true);
  });

  it('maps unknown status to non-retryable error', () => {
    const error = mapGravError(418, {
      status: 418,
      title: "I'm a teapot",
    });
    expect(error.status).toBe(418);
    expect(error.isRetryable).toBe(false);
  });
});
