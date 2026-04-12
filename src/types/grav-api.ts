// API response envelope
export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
  links?: ApiLinks;
}

export interface ApiMeta {
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiLinks {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
}

// RFC 7807 error response
export interface ProblemDetail {
  status: number;
  title: string;
  detail?: string;
  errors?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

// Page types
export interface PageSummary {
  route: string;
  slug: string;
  template: string;
  title: string;
  published: boolean;
  visible: boolean;
  routable: boolean;
  date: string;
  modified: number;
  order: number | null;
  has_children: boolean;
}

export interface Page extends PageSummary {
  content: string;
  header: Record<string, unknown>;
  media: MediaItem[];
  languages?: Record<string, { modified: number }>;
  path: string;
  file_path: string;
}

// Media types
export interface MediaItem {
  filename: string;
  url: string;
  path?: string;
  type: string;
  mime?: string;
  size: number;
  modified: number;
  width?: number;
  height?: number;
  thumbnails?: Record<string, string>;
}

export interface MediaFolder {
  name: string;
  path: string;
  type: 'folder';
}

// User types
export interface User {
  username: string;
  email: string;
  fullname: string;
  title: string;
  avatar_url?: string;
  state: string;
  access: Record<string, unknown>;
  groups: string[];
}

export interface UserProfile extends User {
  permissions: Record<string, boolean>;
}

// API key types
export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  created: string;
  expires?: string;
  last_used?: string;
}

export interface ApiKeyCreated extends ApiKeyInfo {
  key: string; // Only shown once at creation
}

// Config types
export interface ConfigScope {
  scope: string;
  label: string;
}

// Package types
export interface PackageSummary {
  slug: string;
  type: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  update_available: boolean;
  latest_version?: string;
}

export interface PackageDetail extends PackageSummary {
  homepage?: string;
  installed: boolean;
  release_date?: string;
  screenshot?: string;
  custom_fields?: Record<string, string>;
}

// System types
export interface SystemInfo {
  grav_version: string;
  php_version: string;
  environment: string;
  [key: string]: unknown;
}

export interface LogEntry {
  date: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface BackupInfo {
  filename: string;
  size: number;
  date: string;
}

// Webhook types
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  created: string;
  modified: string;
  failure_count?: number;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  url: string;
  status_code: number;
  success: boolean;
  timestamp: string;
  response_time_ms: number;
}

// Blueprint types
export interface PageTemplate {
  type: string;
  label: string;
}

export interface Blueprint {
  type: string;
  fields: Record<string, BlueprintField>;
}

export interface BlueprintField {
  type: string;
  label?: string;
  help?: string;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  validate?: Record<string, unknown>;
  [key: string]: unknown;
}

// Scheduler types
export interface SchedulerJob {
  id: string;
  command: string;
  at: string;
  output: string;
  status: string;
}

// Dashboard types
export interface DashboardStats {
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  date: string;
  [key: string]: unknown;
}

// Plugin discovery types
export interface SidebarItem {
  id: string;
  plugin: string;
  label: string;
  icon: string;
  route: string;
  priority: number;
  badge?: string;
  authorize?: string;
}

export interface PluginPageDefinition {
  id: string;
  plugin: string;
  title: string;
  icon: string;
  page_type: 'blueprint' | 'component';
  blueprint?: string;
  data_endpoint?: string;
  save_endpoint?: string;
  actions?: PluginPageAction[];
}

export interface PluginPageAction {
  id: string;
  label: string;
  icon: string;
  primary?: boolean;
  upload?: boolean;
  download?: boolean;
}

export interface FloatingWidget {
  id: string;
  plugin: string;
  label: string;
  icon: string;
  priority: number;
  autoLoad?: boolean;
  showFab?: boolean;
  width?: number;
  height?: number;
}

export interface ContextPanel {
  id: string;
  plugin: string;
  label: string;
  icon: string;
  contexts: string[];
  badgeEndpoint?: string;
}

export interface SettingsPanel {
  id: string;
  plugin: string;
  label: string;
  icon: string;
  blueprint: string;
  data_endpoint: string;
  save_endpoint: string;
  priority: number;
}

// Translation types
export interface LanguageInfo {
  code: string;
  name: string;
  native?: string;
  default?: boolean;
}

export interface PageTranslations {
  translated: string[];
  untranslated: string[];
}

// Taxonomy types
export interface TaxonomyMap {
  [type: string]: string[];
}
