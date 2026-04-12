import { beforeAll, afterAll, afterEach } from 'vitest';
import { mockServer } from './mocks/handlers.js';

beforeAll(() => {
  mockServer.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  mockServer.resetHandlers();
});

afterAll(() => {
  mockServer.close();
});
