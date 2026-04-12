export const webhookList = [
  {
    id: 'wh_001',
    url: 'https://hooks.example.com/grav',
    events: ['page.created', 'page.updated'],
    active: true,
    created: '2024-01-10T10:00:00Z',
    modified: '2024-03-15T14:00:00Z',
    failure_count: 0,
  },
];

export const createdWebhook = {
  id: 'wh_002',
  url: 'https://hooks.example.com/new',
  events: ['page.created'],
  active: true,
  secret: 'whsec_abc123def456',
  created: '2024-04-01T15:00:00Z',
  modified: '2024-04-01T15:00:00Z',
};

export const deliveries = [
  {
    id: 'del_001',
    event: 'page.created',
    url: 'https://hooks.example.com/grav',
    status_code: 200,
    success: true,
    timestamp: '2024-04-01T14:00:00Z',
    response_time_ms: 150,
  },
  {
    id: 'del_002',
    event: 'page.updated',
    url: 'https://hooks.example.com/grav',
    status_code: 500,
    success: false,
    timestamp: '2024-04-01T14:30:00Z',
    response_time_ms: 5000,
  },
];
