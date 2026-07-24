// Report scheduling & generation jobs
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { supabase } from '../lib/supabase';
import { ReportService, ReportFormat } from './report-service';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export class ReportScheduler {
  private jobs: Map<string, any> = new Map();

  /**
   * Initialize report scheduler
   */
  async initialize() {
    console.log('📊 Initializing report scheduler...');

    // Fetch all enabled schedules
    const { data: schedules, error } = await supabase
      .from('report_schedules')
      .select('*')
      .eq('enabled', true);

    if (error) {
      console.error('Failed to fetch schedules:', error);
      return;
    }

    // Schedule each report
    schedules?.forEach(schedule => {
      this.scheduleReport(schedule);
    });

    console.log(`✅ ${schedules?.length || 0} reports scheduled`);
  }

  /**
   * Schedule a single report
   */
  private scheduleReport(schedule: any) {
    const { id, frequency, time, userId, type, format, recipients, filters } = schedule;

    // Parse time (HH:mm)
    const [hours, minutes] = time.split(':').map(Number);

    // Build cron expression
    let cronExpression: string;
    switch (frequency) {
      case 'DAILY':
        cronExpression = `${minutes} ${hours} * * *`; // Daily at HH:mm
        break;
      case 'WEEKLY':
        cronExpression = `${minutes} ${hours} * * 1`; // Monday at HH:mm
        break;
      case 'MONTHLY':
        cronExpression = `${minutes} ${hours} 1 * *`; // 1st of month at HH:mm
        break;
      default:
        return;
    }

    // Schedule job
    const task = cron.schedule(cronExpression, async () => {
      console.log(`📊 Generating ${frequency} report: ${schedule.name}`);
      try {
        await this.generateAndSendReport({
          userId,
          type,
          formats: format,
          recipients,
          filters,
          scheduleName: schedule.name,
        });

        // Update last generated time
        await supabase
          .from('report_schedules')
          .update({ lastGeneratedAt: new Date().toISOString() })
          .eq('id', id);
      } catch (err) {
        console.error(`Report generation failed for ${id}:`, err);
      }
    });

    this.jobs.set(id, task);
    console.log(`✅ Scheduled: ${schedule.name} (${frequency} at ${time})`);
  }

  /**
   * Generate report and send to recipients
   */
  private async generateAndSendReport(options: any) {
    const { userId, type, formats, recipients, filters, scheduleName } = options;

    // Generate report
    const reportBuffers = await ReportService.generateReport(
      userId,
      type,
      filters,
      formats
    );

    // Prepare email attachments
    const attachments: any[] = [];
    const formatExtensions = {
      DOCX: 'docx',
      PDF: 'pdf',
      XLSX: 'xlsx',
      CSV: 'csv',
    };

    reportBuffers.forEach((buffer, format) => {
      attachments.push({
        filename: `sentiqs-${scheduleName.replace(/\s+/g, '-')}.${formatExtensions[format]}`,
        content: buffer,
      });
    });

    // Send emails
    for (const recipient of recipients) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'reports@sentiqs.com',
        to: recipient,
        subject: `SentiqS Report: ${scheduleName}`,
        html: `
          <h2>SentiqS Report</h2>
          <p>Your scheduled report <strong>${scheduleName}</strong> has been generated.</p>
          <p>Generated at: ${new Date().toLocaleString('fr-FR')}</p>
          <p>Please see attached files.</p>
          <hr>
          <p><em>SentiqS — Real-time security intelligence for Africa</em></p>
        `,
        attachments,
      });

      console.log(`✉️ Report sent to ${recipient}`);
    }
  }

  /**
   * Stop scheduler
   */
  async stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
    console.log('📊 Report scheduler stopped');
  }
}

// Export singleton
export const reportScheduler = new ReportScheduler();
