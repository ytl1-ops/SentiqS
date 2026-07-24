// Types for the real-time alerts system
export type AlertSeverity = 'CRITIQUE' | 'ÉLEVÉ' | 'MODÉRÉ' | 'STABLE';
export type AlertCategory = 'SÉCURITÉ' | 'HUMANITAIRE' | 'POLITIQUE' | 'ÉCONOMIE';
export type AlertChannel = 'PUSH' | 'EMAIL' | 'SMS' | 'WEBHOOK' | 'IN_APP';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED';

export interface Alert {
  id: string;
  userId: string;
  country: string;
  region: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: AlertCategory;
  location?: {
    lat: number;
    lng: number;
    city?: string;
  };
  sourceUrl: string;
  sourceType: 'RSS' | 'TWITTER' | 'NEWS' | 'GOVERNMENT';
  createdAt: Date;
  detectedAt: Date;
  status: AlertStatus;
  channels: AlertChannel[];
  priority: number; // 1-100
  tags: string[];
  relatedAlerts?: string[]; // IDs of related alerts
  assignedTo?: string; // User ID
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  escalationLevel: number; // 0 = no escalation, 1 = team lead, 2 = manager, 3 = CEO
  nextEscalationAt?: Date;
  metadata?: Record<string, any>;
}

export interface AlertFilter {
  countries?: string[];
  regions?: string[];
  severities?: AlertSeverity[];
  categories?: AlertCategory[];
  status?: AlertStatus[];
  channels?: AlertChannel[];
  dateFrom?: Date;
  dateTo?: Date;
  assignedTo?: string;
  unassignedOnly?: boolean;
}

export interface AlertStats {
  total: number;
  critical: number;
  elevated: number;
  moderate: number;
  stable: number;
  byCountry: Record<string, number>;
  byCategory: Record<AlertCategory, number>;
  avgResponseTime: number; // minutes
  escalatedInLast24h: number;
}

export interface AlertEvent {
  type: 'NEW' | 'UPDATE' | 'ACKNOWLEDGE' | 'RESOLVE' | 'ESCALATE';
  alert: Alert;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: {
    severity?: AlertSeverity[];
    category?: AlertCategory[];
    countries?: string[];
    keywords?: string[];
  };
  actions: {
    channels: AlertChannel[];
    escalateAfter: number; // minutes
    escalateToRole: string; // 'MANAGER' | 'CEO' | etc
    notifyUsers: string[]; // user IDs
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WebSocketMessage {
  type: 'ALERT_NEW' | 'ALERT_UPDATE' | 'ALERT_ACKNOWLEDGE' | 'STATS_UPDATE' | 'PING' | 'ERROR';
  data: any;
  timestamp: Date;
  requestId?: string;
}
