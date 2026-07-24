// Report generation service
import { supabase } from '../lib/supabase';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, AlignmentType } from 'docx';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';

export type ReportType = 'EXECUTIVE_SUMMARY' | 'OPERATIONAL' | 'FULL_ANALYSIS' | 'RISK_MATRIX';
export type ReportFormat = 'DOCX' | 'PDF' | 'XLSX' | 'CSV';

export interface ReportSchedule {
  id: string;
  userId: string;
  name: string;
  type: ReportType;
  format: ReportFormat[];
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  time: string; // HH:mm
  recipients: string[]; // emails
  filters: {
    countries?: string[];
    regions?: string[];
    severities?: string[];
    categories?: string[];
  };
  enabled: boolean;
  lastGeneratedAt?: Date;
  nextGenerationAt?: Date;
}

export interface Report {
  id: string;
  userId: string;
  type: ReportType;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  alerts: any[];
  statistics: any;
  correlations: any[];
  metadata: Record<string, any>;
}

export class ReportService {
  /**
   * Generate report in multiple formats
   */
  static async generateReport(
    userId: string,
    type: ReportType,
    filters: any,
    formats: ReportFormat[] = ['PDF']
  ): Promise<Map<ReportFormat, Buffer>> {
    // Fetch data
    const alerts = await this.fetchAlerts(userId, filters);
    const stats = await this.calculateStats(alerts);
    const correlations = await this.findCorrelations(alerts);

    const reportData = {
      title: this.getReportTitle(type),
      generatedAt: new Date(),
      alerts,
      stats,
      correlations,
    };

    const outputs = new Map<ReportFormat, Buffer>();

    for (const format of formats) {
      switch (format) {
        case 'DOCX':
          outputs.set('DOCX', await this.generateDocx(type, reportData));
          break;
        case 'PDF':
          outputs.set('PDF', await this.generatePdf(type, reportData));
          break;
        case 'XLSX':
          outputs.set('XLSX', await this.generateExcel(type, reportData));
          break;
        case 'CSV':
          outputs.set('CSV', await this.generateCsv(alerts));
          break;
      }
    }

    return outputs;
  }

  /**
   * Create scheduled report
   */
  static async createSchedule(userId: string, schedule: Omit<ReportSchedule, 'id'>) {
    const { data, error } = await supabase
      .from('report_schedules')
      .insert([{ userId, ...schedule }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Generate DOCX report
   */
  private static async generateDocx(type: ReportType, data: any): Promise<Buffer> {
    const sections = [];

    // Title
    sections.push({
      properties: {},
      children: [
        new Paragraph({
          text: data.title,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: `Generated: ${data.generatedAt.toLocaleDateString('fr-FR')}`,
          alignment: AlignmentType.CENTER,
          style: 'Normal',
        }),
      ],
    });

    // Executive Summary
    sections[0].children.push(
      new Paragraph({
        text: 'Executive Summary',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph(`Total Alerts: ${data.stats.total}`),
      new Paragraph(`🔴 Critical: ${data.stats.critical}`),
      new Paragraph(`🟠 Elevated: ${data.stats.elevated}`),
      new Paragraph(`🟡 Moderate: ${data.stats.moderate}`),
      new Paragraph(`🟢 Stable: ${data.stats.stable}`)
    );

    // Alerts table
    if (data.alerts.length > 0) {
      sections[0].children.push(
        new Paragraph({
          text: 'Active Alerts',
          heading: HeadingLevel.HEADING_2,
        }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Country')] }),
                new TableCell({ children: [new Paragraph('Title')] }),
                new TableCell({ children: [new Paragraph('Severity')] }),
                new TableCell({ children: [new Paragraph('Created')] }),
              ],
            }),
            ...data.alerts.slice(0, 20).map(
              (alert: any) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(alert.country)] }),
                    new TableCell({ children: [new Paragraph(alert.title)] }),
                    new TableCell({ children: [new Paragraph(alert.severity)] }),
                    new TableCell({
                      children: [new Paragraph(new Date(alert.createdAt).toLocaleDateString())],
                    }),
                  ],
                })
            ),
          ],
        })
      );
    }

    // Correlations
    if (data.correlations.length > 0) {
      sections[0].children.push(
        new Paragraph({
          text: 'Regional Correlations',
          heading: HeadingLevel.HEADING_2,
        }),
        ...data.correlations.map(
          (corr: any) =>
            new Paragraph(
              `${corr.theme}: ${corr.countries.join(', ')} (${corr.count} alerts)`
            )
        )
      );
    }

    const doc = new Document({ sections });
    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  /**
   * Generate PDF report
   */
  private static async generatePdf(type: ReportType, data: any): Promise<Buffer> {
    const doc = new jsPDF();
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.text(data.title, 105, y, { align: 'center' });
    y += 10;

    // Generated date
    doc.setFontSize(10);
    doc.text(`Generated: ${data.generatedAt.toLocaleDateString('fr-FR')}`, 105, y, {
      align: 'center',
    });
    y += 15;

    // Summary boxes
    doc.setFontSize(12);
    doc.text('Summary', 10, y);
    y += 8;

    doc.setFontSize(10);
    const summaryText = [
      `Total Alerts: ${data.stats.total}`,
      `🔴 Critical: ${data.stats.critical}`,
      `🟠 Elevated: ${data.stats.elevated}`,
      `🟡 Moderate: ${data.stats.moderate}`,
      `🟢 Stable: ${data.stats.stable}`,
    ];

    summaryText.forEach(line => {
      doc.text(line, 10, y);
      y += 6;
    });

    // Alerts table
    if (data.alerts.length > 0) {
      y += 5;
      doc.setFontSize(12);
      doc.text('Recent Alerts', 10, y);
      y += 8;

      const tableData = data.alerts.slice(0, 10).map((alert: any) => [
        alert.country,
        alert.title.substring(0, 30),
        alert.severity,
        new Date(alert.createdAt).toLocaleDateString('fr-FR'),
      ]);

      doc.autoTable({
        head: [['Country', 'Title', 'Severity', 'Date']],
        body: tableData,
        startY: y,
        theme: 'grid',
      });
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Generate Excel report
   */
  private static async generateExcel(type: ReportType, data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 20 }, { header: 'Value', key: 'value', width: 10 }];
    summarySheet.addRows([
      { metric: 'Total Alerts', value: data.stats.total },
      { metric: 'Critical', value: data.stats.critical },
      { metric: 'Elevated', value: data.stats.elevated },
      { metric: 'Moderate', value: data.stats.moderate },
      { metric: 'Stable', value: data.stats.stable },
    ]);

    // By Country
    summarySheet.addRow({ metric: '' });
    summarySheet.addRow({ metric: 'By Country' });
    Object.entries(data.stats.byCountry || {}).forEach(([country, count]) => {
      summarySheet.addRow({ metric: country, value: count });
    });

    // Alerts sheet
    const alertsSheet = workbook.addWorksheet('Alerts');
    alertsSheet.columns = [
      { header: 'Country', key: 'country', width: 15 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Created', key: 'createdAt', width: 18 },
    ];
    alertsSheet.addRows(data.alerts);

    // Correlations sheet
    if (data.correlations.length > 0) {
      const corrSheet = workbook.addWorksheet('Correlations');
      corrSheet.columns = [
        { header: 'Theme', key: 'theme', width: 20 },
        { header: 'Countries', key: 'countries', width: 40 },
        { header: 'Count', key: 'count', width: 8 },
      ];
      corrSheet.addRows(data.correlations);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  /**
   * Generate CSV report
   */
  private static async generateCsv(alerts: any[]): Promise<Buffer> {
    const headers = ['Country', 'Title', 'Severity', 'Category', 'CreatedAt', 'Source'];
    const rows = alerts.map(alert => [
      alert.country,
      `"${alert.title}"`,
      alert.severity,
      alert.category,
      alert.createdAt,
      alert.sourceUrl || 'N/A',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Helper: fetch alerts with filters
   */
  private static async fetchAlerts(userId: string, filters: any) {
    let query = supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filters.countries?.length) query = query.in('country', filters.countries);
    if (filters.severities?.length) query = query.in('severity', filters.severities);
    if (filters.categories?.length) query = query.in('category', filters.categories);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom.toISOString());
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo.toISOString());

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Helper: calculate statistics
   */
  private static async calculateStats(alerts: any[]) {
    const stats = {
      total: alerts.length,
      critical: 0,
      elevated: 0,
      moderate: 0,
      stable: 0,
      byCountry: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    alerts.forEach(alert => {
      stats[alert.severity.toLowerCase()] = (stats[alert.severity.toLowerCase()] || 0) + 1;
      stats.byCountry[alert.country] = (stats.byCountry[alert.country] || 0) + 1;
      stats.byCategory[alert.category] = (stats.byCategory[alert.category] || 0) + 1;
    });

    return stats;
  }

  /**
   * Helper: find correlations
   */
  private static async findCorrelations(alerts: any[]) {
    const correlations: Record<string, { countries: Set<string>; count: number }> = {};

    alerts.forEach(alert => {
      const key = alert.category;
      if (!correlations[key]) {
        correlations[key] = { countries: new Set(), count: 0 };
      }
      correlations[key].countries.add(alert.country);
      correlations[key].count++;
    });

    return Object.entries(correlations)
      .filter(([, data]) => data.countries.size > 1) // Only multi-country themes
      .map(([theme, data]) => ({
        theme,
        countries: Array.from(data.countries),
        count: data.count,
      }));
  }

  private static getReportTitle(type: ReportType): string {
    const titles = {
      EXECUTIVE_SUMMARY: 'Executive Summary Report',
      OPERATIONAL: 'Operational Alert Report',
      FULL_ANALYSIS: 'Full Analysis Report',
      RISK_MATRIX: 'Risk Matrix Report',
    };
    return titles[type];
  }
}
