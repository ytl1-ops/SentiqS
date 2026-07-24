// Service for managing integrations
import { supabase } from '../lib/supabase';
import { Integration, IntegrationType, WebhookEvent, ApiKey } from './integration-types';

export class IntegrationService {
  /**
   * Create integration
   */
  static async createIntegration(
    userId: string,
    type: IntegrationType,
    name: string,
    config: any
  ): Promise<Integration> {
    const { data, error } = await supabase
      .from('integrations')
      .insert([{ userId, type, name, config, enabled: true, status: 'ACTIVE' }])
      .select()
      .single();

    if (error) throw error;
    return data as Integration;
  }

  /**
   * Get user integrations
   */
  static async getIntegrations(userId: string): Promise<Integration[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return (data || []) as Integration[];
  }

  /**
   * Update integration
   */
  static async updateIntegration(id: string, updates: Partial<Integration>) {
    const { data, error } = await supabase
      .from('integrations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Integration;
  }

  /**
   * Delete integration
   */
  static async deleteIntegration(id: string) {
    const { error } = await supabase.from('integrations').delete().eq('id', id);
    if (error) throw error;
  }

  /**
   * Send alert to integration
   */
  static async sendToIntegration(integration: Integration, alert: any) {
    switch (integration.type) {
      case 'SLACK':
        return await this.sendToSlack(integration, alert);
      case 'JIRA':
        return await this.sendToJira(integration, alert);
      case 'SALESFORCE':
        return await this.sendToSalesforce(integration, alert);
      case 'WEBHOOK':
        return await this.sendWebhook(integration, alert);
      case 'GOOGLE_SHEETS':
        return await this.appendToGoogleSheets(integration, alert);
      default:
        throw new Error(`Unknown integration type: ${integration.type}`);
    }
  }

  private static async sendToSlack(integration: Integration, alert: any) {
    const { botToken, channelId, mentionChannelOnCritical, threadByCountry } = integration.config;
    const severityColor = {
      CRITIQUE: '#DC2626',
      'ÉLEVÉ': '#F97316',
      'MODÉRÉ': '#EAB308',
      STABLE: '#22C55E',
    };

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 ${alert.severity} - ${alert.title}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Country:*\n${alert.country}`,
          },
          {
            type: 'mrkdwn',
            text: `*Category:*\n${alert.category}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alert.description,
        },
      },
    ];

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${botToken}`,
        },
        body: JSON.stringify({
          channel: channelId,
          blocks,
          ...(mentionChannelOnCritical && alert.severity === 'CRITIQUE' && {
            text: '@channel Alert critique!',
          }),
        }),
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.error);
      return { success: true, messageId: result.ts };
    } catch (err) {
      throw new Error(`Slack integration failed: ${err.message}`);
    }
  }

  private static async sendToJira(integration: Integration, alert: any) {
    const { domain, apiToken, email, projectKey, issueType, customFields, assigneeId } =
      integration.config;

    const issueData = {
      fields: {
        project: { key: projectKey },
        summary: `${alert.severity}: ${alert.title}`,
        description: alert.description,
        issuetype: { name: issueType },
        priority: {
          name:
            alert.severity === 'CRITIQUE'
              ? 'Highest'
              : alert.severity === 'ÉLEVÉ'
                ? 'High'
                : 'Medium',
        },
        ...(assigneeId && { assignee: { id: assigneeId } }),
        ...customFields,
      },
    };

    try {
      const response = await fetch(`https://${domain}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
        },
        body: JSON.stringify(issueData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.errorMessages?.[0] || 'Jira API error');
      return { success: true, issueKey: result.key };
    } catch (err) {
      throw new Error(`Jira integration failed: ${err.message}`);
    }
  }

  private static async sendToSalesforce(integration: Integration, alert: any) {
    // TODO: Implement Salesforce OAuth + REST API
    throw new Error('Salesforce integration not yet implemented');
  }

  private static async sendWebhook(integration: Integration, alert: any) {
    const { url, method, headers, authType, authValue, customPayload } = integration.config;

    const payload = customPayload
      ? this.renderTemplate(customPayload, alert)
      : {
          id: alert.id,
          country: alert.country,
          title: alert.title,
          severity: alert.severity,
          category: alert.category,
          createdAt: alert.createdAt,
          timestamp: new Date().toISOString(),
        };

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (authType === 'BEARER') {
      requestHeaders['Authorization'] = `Bearer ${authValue}`;
    } else if (authType === 'BASIC') {
      requestHeaders['Authorization'] = `Basic ${authValue}`;
    } else if (authType === 'API_KEY') {
      requestHeaders['X-API-Key'] = authValue;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { success: true };
    } catch (err) {
      throw new Error(`Webhook failed: ${err.message}`);
    }
  }

  private static async appendToGoogleSheets(integration: Integration, alert: any) {
    // TODO: Implement Google Sheets API
    throw new Error('Google Sheets integration not yet implemented');
  }

  private static renderTemplate(template: string, data: any): any {
    // Simple Handlebars-style template rendering
    let rendered = template;
    Object.entries(data).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });
    return JSON.parse(rendered);
  }

  /**
   * Create API key
   */
  static async createApiKey(userId: string, name: string, permissions: string[]) {
    const key = this.generateApiKey();
    const hashedKey = await this.hashApiKey(key);

    const { data, error } = await supabase
      .from('api_keys')
      .insert([{ userId, name, key: hashedKey, permissions, rateLimit: 100 }])
      .select()
      .single();

    if (error) throw error;
    return { ...data, key }; // Return unhashed key only once
  }

  private static generateApiKey(): string {
    return `sk_${Math.random().toString(36).substr(2, 32)}`;
  }

  private static async hashApiKey(key: string): Promise<string> {
    // Use crypto or bcrypt in production
    return Buffer.from(key).toString('base64');
  }

  /**
   * Verify API key
   */
  static async verifyApiKey(key: string): Promise<ApiKey | null> {
    const hashedKey = await this.hashApiKey(key);
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key', hashedKey)
      .single();

    if (error || !data) return null;
    return data as ApiKey;
  }
}
