// Integration types for external systems

export type IntegrationType = 'SLACK' | 'JIRA' | 'SALESFORCE' | 'WEBHOOK' | 'TEAMS' | 'GOOGLE_SHEETS';
export type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'RATE_LIMITED';

export interface Integration {
  id: string;
  userId: string;
  type: IntegrationType;
  name: string;
  enabled: boolean;
  config: Record<string, any>; // Type-specific credentials
  webhookUrl?: string;
  lastSyncAt?: Date;
  status: IntegrationStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Slack Integration
export interface SlackConfig {
  botToken: string;
  webhookUrl: string;
  channelId: string;
  alertSeverityFilter?: string[]; // ['CRITIQUE', 'ÉLEVÉ']
  mentionChannelOnCritical?: boolean;
  threadByCountry?: boolean;
}

// Jira Integration
export interface JiraConfig {
  domain: string; // acme.atlassian.net
  apiToken: string;
  email: string;
  projectKey: string;
  issueType: string; // 'Security Alert' | 'Incident'
  customFields?: Record<string, string>; // fieldId -> value mapping
  assigneeId?: string;
  autoCreateOnSeverity?: string[]; // ['CRITIQUE', 'ÉLEVÉ']
}

// Salesforce Integration
export interface SalesforceConfig {
  instanceUrl: string; // na1.salesforce.com
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  objectName: string; // 'SecurityAlert__c'
  fieldMapping: Record<string, string>; // alertField -> sfdcField
  accountLookupField?: string;
}

// Generic Webhook
export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  authType?: 'BEARER' | 'BASIC' | 'API_KEY';
  authValue?: string;
  payloadTemplate?: 'STANDARD' | 'CUSTOM';
  customPayload?: string; // Handlebars template
}

// Google Sheets Integration
export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  serviceAccountJson: any; // Service account JSON
  appendMode?: boolean; // Append vs replace
  columnMapping?: Record<string, number>; // Field -> column index
}

// API Key for public API
export interface ApiKey {
  id: string;
  userId: string;
  key: string; // hashed
  name: string;
  permissions: string[]; // ['alerts:read', 'alerts:create', 'stats:read']
  lastUsedAt?: Date;
  expiresAt?: Date;
  rateLimit: number; // requests per minute
  createdAt: Date;
}

// Webhook Event
export interface WebhookEvent {
  id: string;
  integrationId: string;
  event: 'alert.created' | 'alert.acknowledged' | 'alert.resolved' | 'alert.escalated';
  payload: any;
  status: 'PENDING' | 'SENT' | 'FAILED';
  retries: number;
  nextRetryAt?: Date;
  createdAt: Date;
}

// Public API Request/Response types
export interface PublicApiAlert {
  id: string;
  country: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  createdAt: string; // ISO 8601
  source?: string;
}

export interface PublicApiStats {
  total: number;
  critical: number;
  elevated: number;
  moderate: number;
  stable: number;
  byCountry: Record<string, number>;
  timestamp: string;
}

export interface PublicApiError {
  error: string;
  code: string;
  details?: string;
}
