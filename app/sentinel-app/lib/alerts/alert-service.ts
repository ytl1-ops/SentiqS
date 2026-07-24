// Alert Service - handles fetching and managing alerts
import { supabase } from '../supabase';
import { Alert, AlertFilter, AlertStats, AlertRule } from './alert-types';

export class AlertService {
  /**
   * Fetch active alerts with filtering
   */
  static async fetchAlerts(filter?: AlertFilter, limit = 50, offset = 0) {
    let query = supabase
      .from('alerts')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('severity', { ascending: false })
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter?.countries?.length) query = query.in('country', filter.countries);
    if (filter?.regions?.length) query = query.in('region', filter.regions);
    if (filter?.severities?.length) query = query.in('severity', filter.severities);
    if (filter?.categories?.length) query = query.in('category', filter.categories);
    if (filter?.status?.length) query = query.in('status', filter.status);
    if (filter?.assignedTo) query = query.eq('assignedTo', filter.assignedTo);
    if (filter?.unassignedOnly) query = query.is('assignedTo', null);
    if (filter?.dateFrom) query = query.gte('createdAt', filter.dateFrom.toISOString());
    if (filter?.dateTo) query = query.lte('createdAt', filter.dateTo.toISOString());

    const { data, error } = await query;
    if (error) throw error;
    return data as Alert[];
  }

  /**
   * Get alert statistics
   */
  static async getStats(): Promise<AlertStats> {
    const { data, error } = await supabase
      .from('alerts')
      .select('country, category, severity, status, escalationLevel')
      .eq('status', 'ACTIVE');

    if (error) throw error;

    const stats: AlertStats = {
      total: data?.length || 0,
      critical: data?.filter(a => a.severity === 'CRITIQUE').length || 0,
      elevated: data?.filter(a => a.severity === 'ÉLEVÉ').length || 0,
      moderate: data?.filter(a => a.severity === 'MODÉRÉ').length || 0,
      stable: data?.filter(a => a.severity === 'STABLE').length || 0,
      byCountry: {},
      byCategory: {
        'SÉCURITÉ': 0,
        'HUMANITAIRE': 0,
        'POLITIQUE': 0,
        'ÉCONOMIE': 0,
      },
      avgResponseTime: 0,
      escalatedInLast24h: 0,
    };

    // Count by country
    data?.forEach(alert => {
      stats.byCountry[alert.country] = (stats.byCountry[alert.country] || 0) + 1;
      stats.byCategory[alert.category]++;
      if (alert.escalationLevel > 0) stats.escalatedInLast24h++;
    });

    return stats;
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(alertId: string, userId: string) {
    const { data, error } = await supabase
      .from('alerts')
      .update({
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: userId,
        assignedTo: userId,
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data as Alert;
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string, userId: string, notes?: string) {
    const { data, error } = await supabase
      .from('alerts')
      .update({
        status: 'RESOLVED',
        metadata: { resolvedBy: userId, resolvedNotes: notes },
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data as Alert;
  }

  /**
   * Escalate an alert to next level
   */
  static async escalateAlert(alertId: string, userId: string, reason: string) {
    // Fetch alert to increment escalation level
    const { data: alert, error: fetchError } = await supabase
      .from('alerts')
      .select('escalationLevel')
      .eq('id', alertId)
      .single();

    if (fetchError) throw fetchError;

    const nextLevel = (alert?.escalationLevel || 0) + 1;
    if (nextLevel > 3) throw new Error('Maximum escalation level reached');

    const { data, error } = await supabase
      .from('alerts')
      .update({
        escalationLevel: nextLevel,
        status: 'ESCALATED',
        nextEscalationAt: new Date(Date.now() + 30 * 60000).toISOString(), // +30 min
        metadata: {
          ...alert?.metadata,
          escalations: [
            ...(alert?.metadata?.escalations || []),
            { level: nextLevel, by: userId, reason, at: new Date().toISOString() },
          ],
        },
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data as Alert;
  }

  /**
   * Assign alert to a user
   */
  static async assignAlert(alertId: string, userId: string) {
    const { data, error } = await supabase
      .from('alerts')
      .update({ assignedTo: userId })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data as Alert;
  }

  /**
   * Create a new alert (for testing/admin)
   */
  static async createAlert(alert: Omit<Alert, 'id' | 'createdAt'>) {
    const { data, error } = await supabase
      .from('alerts')
      .insert([{
        ...alert,
        createdAt: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Alert;
  }

  /**
   * Subscribe to user's alert rules
   */
  static async getAlertRules(userId: string): Promise<AlertRule[]> {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('userId', userId)
      .eq('enabled', true);

    if (error) throw error;
    return data as AlertRule[];
  }
}
