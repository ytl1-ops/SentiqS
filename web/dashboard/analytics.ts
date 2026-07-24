// Analytics helper for dashboard insights
export class DashboardAnalytics {
  /**
   * Calculate alert velocity (alerts per hour)
   */
  static calculateVelocity(alerts: any[], hours: number = 24): number {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentAlerts = alerts.filter(a => new Date(a.createdAt) > since);
    return parseFloat((recentAlerts.length / hours).toFixed(2));
  }

  /**
   * Calculate severity distribution percentage
   */
  static getSeverityDistribution(alerts: any[]) {
    const total = alerts.length;
    return {
      criticalPct: parseFloat(((alerts.filter(a => a.severity === 'CRITIQUE').length / total) * 100).toFixed(1)),
      elevatedPct: parseFloat(((alerts.filter(a => a.severity === 'ÉLEVÉ').length / total) * 100).toFixed(1)),
      moderatePct: parseFloat(((alerts.filter(a => a.severity === 'MODÉRÉ').length / total) * 100).toFixed(1)),
      stablePct: parseFloat(((alerts.filter(a => a.severity === 'STABLE').length / total) * 100).toFixed(1)),
    };
  }

  /**
   * Find hotspot countries (>5 alerts)
   */
  static getHotspots(stats: any): string[] {
    return Object.entries(stats?.byCountry || {})
      .filter(([, count]) => (count as number) > 5)
      .map(([country]) => country)
      .sort();
  }

  /**
   * Predict risk level for next 24h
   */
  static predictRiskLevel(alerts: any[]): 'CRITIQUE' | 'ÉLEVÉ' | 'MODÉRÉ' | 'STABLE' {
    const velocity = this.calculateVelocity(alerts, 24);
    const criticalCount = alerts.filter(a => a.severity === 'CRITIQUE').length;

    if (criticalCount > 5 || velocity > 2) return 'CRITIQUE';
    if (criticalCount > 2 || velocity > 1) return 'ÉLEVÉ';
    if (criticalCount > 0 || velocity > 0.5) return 'MODÉRÉ';
    return 'STABLE';
  }

  /**
   * Generate insights text
   */
  static generateInsights(alerts: any[], stats: any): string[] {
    const insights: string[] = [];

    const velocity = this.calculateVelocity(alerts);
    if (velocity > 2) {
      insights.push(`⚠️ High alert velocity: ${velocity} alerts/hour`);
    }

    const hotspots = this.getHotspots(stats);
    if (hotspots.length > 0) {
      insights.push(`🔥 Hotspots: ${hotspots.join(', ')}`);
    }

    const distribution = this.getSeverityDistribution(alerts);
    if (distribution.criticalPct > 20) {
      insights.push(`⛔ ${distribution.criticalPct}% of alerts are critical`);
    }

    const last24h = alerts.filter(
      a => new Date(a.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    if (last24h.length === 0) {
      insights.push('✅ No new alerts in last 24 hours');
    }

    return insights;
  }
}
