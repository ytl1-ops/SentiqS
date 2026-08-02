import { jsPDF } from 'jspdf';

interface ReportContent {
  executiveSummary: string;
  sections: Array<{ title: string; text: string }>;
  stats: Array<{ label: string; value: string | number }>;
  alertsIncluded: Array<{
    id: string;
    title: string;
    severity: string;
    locality: string;
    department: string;
  }>;
  correlationsIncluded: Array<{
    id: string;
    type: string;
    strength: string;
    confidence: number;
    description: string;
  }>;
  charts: Array<{ label: string; values: number[]; max: number }>;
}

interface ReportData {
  id: string;
  title: string;
  type: string;
  format: string;
  region: string;
  countries: string[];
  localities?: string[];
  alertCount: number;
  corrCount: number;
  generatedAt: string;
  status: string;
  size: string;
  author: string;
  summary: string;
  content?: ReportContent;
}

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

let doc: jsPDF;
let yPos: number;

function addPageIfNeeded(needed: number) {
  if (yPos + needed > PAGE_H - MARGIN) {
    doc.addPage();
    yPos = MARGIN;
  }
}

function drawHeader() {
  doc.setFillColor(10, 25, 47);
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SENTIQS — RAPPORT DE RENSEIGNEMENT STRATÉGIQUE', MARGIN, 13);
  doc.setTextColor(150, 160, 180);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Classification : Confidentiel — Diffusion restreinte', MARGIN, 19);
  yPos = 30;
}

function drawFooter(pageNum: number, totalPages: number) {
  const footerY = PAGE_H - 14;
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY - 4, PAGE_W - MARGIN, footerY - 4);
  doc.setTextColor(130, 140, 155);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Page ${pageNum} / ${totalPages}`, MARGIN, footerY);
  doc.text(`Generé le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} a ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, PAGE_W - MARGIN, footerY, { align: 'right' });
}

function drawLine(y: number) {
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (doc.getTextWidth(test) > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function severityLabel(s: string): string {
  const map: Record<string, string> = { critical: 'CRITIQUE', high: 'ÉLEVÉ', medium: 'MOYEN', low: 'FAIBLE' };
  return map[s] || s;
}

function severityColorHex(s: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    critical: [220, 38, 38],
    high: [234, 88, 12],
    medium: [217, 119, 6],
    low: [107, 114, 128],
  };
  return map[s] || [107, 114, 128];
}

function typeLabel(tp: string): string {
  const map: Record<string, string> = {
    correlation: 'Corrélation', monthly: 'Mensuel', risk: 'Risque',
    executive: 'Exécutif', quarterly: 'Trimestriel', data: 'Données',
  };
  return map[tp] || tp;
}

function correlationTypeLabel(tp: string): string {
  const map: Record<string, string> = { direct: 'Directe', cluster: 'Cluster', chain: 'Chaîne', pattern: 'Schéma' };
  return map[tp] || tp;
}

function generateSingleReport(report: ReportData) {
  const content = report.content;
  const genDate = new Date(report.generatedAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // Title block
  doc.setFontSize(16);
  doc.setTextColor(10, 25, 47);
  doc.setFont('helvetica', 'bold');
  const titleLines = wrapText(report.title, CONTENT_W, 16);
  titleLines.forEach((line, i) => {
    addPageIfNeeded(10);
    doc.text(line, MARGIN, yPos);
    yPos += i === 0 ? 10 : 7;
  });
  yPos += 4;

  // Metadata line
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 125);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ref: ${report.id}  |  Type: ${typeLabel(report.type)}  |  ${genDate}`, MARGIN, yPos);
  yPos += 5;

  doc.text(`Auteur: ${report.author}  |  Région: ${report.region}  |  Pays: ${report.countries.join(', ')}`, MARGIN, yPos);
  yPos += 5;

  if (report.localities && report.localities.length > 0) {
    doc.text(`Localités: ${report.localities.join(', ')}`, MARGIN, yPos);
    yPos += 5;
  }
  yPos += 3;

  drawLine(yPos);
  yPos += 8;

  if (!content) {
    addPageIfNeeded(20);
    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'normal');
    const summaryLines = wrapText(report.summary, CONTENT_W, 9);
    summaryLines.forEach((line) => {
      addPageIfNeeded(7);
      doc.text(line, MARGIN, yPos);
      yPos += 6;
    });
    return;
  }

  // Executive summary
  yPos += 2;
  doc.setFillColor(235, 240, 250);
  doc.rect(MARGIN, yPos - 5, CONTENT_W, 8, 'F');
  doc.setFontSize(9);
  doc.setTextColor(10, 25, 47);
  doc.setFont('helvetica', 'bold');
  doc.text('RÉSUMÉ EXÉCUTIF', MARGIN + 3, yPos);
  yPos += 12;

  doc.setFontSize(8.5);
  doc.setTextColor(40, 50, 70);
  doc.setFont('helvetica', 'normal');
  const execLines = wrapText(content.executiveSummary, CONTENT_W - 4, 8.5);
  execLines.forEach((line) => {
    addPageIfNeeded(6);
    doc.text(line, MARGIN + 3, yPos);
    yPos += 5.5;
  });
  yPos += 6;

  // Stats grid
  if (content.stats.length > 0) {
    addPageIfNeeded(30);
    drawLine(yPos);
    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    doc.text('STATISTIQUES', MARGIN, yPos);
    yPos += 10;

    const cols = 3;
    const cellW = (CONTENT_W - (cols - 1) * 4) / cols;
    content.stats.forEach((s, i) => {
      if (i % cols === 0) {
        addPageIfNeeded(22);
      }
      const col = i % cols;
      const cx = MARGIN + col * (cellW + 4);
      doc.setFillColor(245, 247, 250);
      doc.rect(cx, yPos, cellW, 18, 'F');
      doc.setFontSize(11);
      doc.setTextColor(10, 25, 47);
      doc.setFont('helvetica', 'bold');
      doc.text(String(s.value), cx + cellW / 2, yPos + 8, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setTextColor(100, 110, 125);
      doc.setFont('helvetica', 'normal');
      doc.text(s.label.toUpperCase(), cx + cellW / 2, yPos + 15, { align: 'center' });
      if (col === cols - 1 || i === content.stats.length - 1) yPos += 25;
    });
    yPos += 4;
  }

  // Sections
  content.sections.forEach((sec) => {
    addPageIfNeeded(40);
    drawLine(yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    const secTitleLines = wrapText(sec.title, CONTENT_W, 10);
    secTitleLines.forEach((line) => {
      addPageIfNeeded(8);
      doc.text(line, MARGIN, yPos);
      yPos += 7;
    });
    yPos += 4;

    doc.setFontSize(8.5);
    doc.setTextColor(50, 60, 80);
    doc.setFont('helvetica', 'normal');
    const textLines = wrapText(sec.text, CONTENT_W, 8.5);
    textLines.forEach((line) => {
      addPageIfNeeded(6);
      doc.text(line, MARGIN, yPos);
      yPos += 5.5;
    });
    yPos += 4;
  });

  // Charts
  if (content.charts.length > 0) {
    addPageIfNeeded(50);
    drawLine(yPos);
    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAPHIQUES', MARGIN, yPos);
    yPos += 8;

    content.charts.forEach((chart) => {
      addPageIfNeeded(50);
      doc.setFontSize(8);
      doc.setTextColor(80, 90, 110);
      doc.setFont('helvetica', 'bold');
      doc.text(chart.label, MARGIN, yPos);
      yPos += 6;

      const barW = (CONTENT_W - (chart.values.length - 1) * 2) / chart.values.length;
      const barMaxH = 30;
      doc.setFontSize(6);
      doc.setTextColor(100, 110, 125);
      doc.setFont('helvetica', 'normal');
      chart.values.forEach((v, vi) => {
        const bx = MARGIN + vi * (barW + 2);
        const barH = (v / chart.max) * barMaxH;
        doc.setFillColor(20, 40, 80);
        doc.rect(bx, yPos + barMaxH - barH, barW, barH, 'F');
        doc.text(String(v), bx + barW / 2, yPos + barMaxH + barH + 4, { align: 'center' });
      });
      yPos += barMaxH + 12;
    });
    yPos += 4;
  }

  // Alerts included
  if (content.alertsIncluded.length > 0) {
    addPageIfNeeded(40);
    drawLine(yPos);
    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    doc.text('ALERTES INCLUSES', MARGIN, yPos);
    yPos += 10;

    content.alertsIncluded.forEach((alt) => {
      addPageIfNeeded(18);
      const [r, g, b] = severityColorHex(alt.severity);
      doc.setFillColor(r, g, b);
      doc.rect(MARGIN, yPos, CONTENT_W, 14, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(severityLabel(alt.severity), MARGIN + 4, yPos + 5);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(alt.title, MARGIN + 4, yPos + 10.5);

      doc.setTextColor(200, 210, 225);
      doc.setFontSize(6);
      doc.text(`${alt.id} — ${alt.locality}, ${alt.department}`, MARGIN + CONTENT_W - 4, yPos + 10.5, { align: 'right' });
      yPos += 17;
    });
    yPos += 4;
  }

  // Correlations included
  if (content.correlationsIncluded.length > 0) {
    addPageIfNeeded(40);
    drawLine(yPos);
    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    doc.text('CORRÉLATIONS DÉTECTÉES', MARGIN, yPos);
    yPos += 10;

    content.correlationsIncluded.forEach((cor) => {
      addPageIfNeeded(22);
      doc.setFillColor(245, 247, 250);
      doc.rect(MARGIN, yPos, CONTENT_W, 20, 'F');

      doc.setFontSize(7);
      doc.setTextColor(10, 25, 47);
      doc.setFont('helvetica', 'bold');
      doc.text(cor.id, MARGIN + 4, yPos + 6);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 70, 90);
      doc.text(`Type: ${correlationTypeLabel(cor.type)} — Force: ${cor.strength === 'strong' ? 'Forte' : 'Moyenne'} — Confiance: ${cor.confidence}%`, MARGIN + 4, yPos + 12);

      doc.setFontSize(7.5);
      doc.setTextColor(40, 50, 70);
      doc.text(cor.description, MARGIN + 4, yPos + 18);
      yPos += 24;
    });
  }
}

export function generatePdfReport(report: ReportData): void {
  doc = new jsPDF({ unit: 'mm', format: 'a4' });
  yPos = 30;

  drawHeader();
  generateSingleReport(report);

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const safeName = report.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`SentiqS_${safeName}.pdf`);
}

export function generatePdfBatch(reports: ReportData[]): void {
  doc = new jsPDF({ unit: 'mm', format: 'a4' });
  yPos = 30;

  // Cover page
  drawHeader();
  doc.setFontSize(20);
  doc.setTextColor(10, 25, 47);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPORT BATCH', PAGE_W / 2, 60, { align: 'center' });
  doc.text('Rapports de renseignement', PAGE_W / 2, 72, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 110, 125);
  doc.setFont('helvetica', 'normal');
  const nowStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Generé le ${nowStr}`, PAGE_W / 2, 84, { align: 'center' });
  doc.text(`${reports.length} rapports inclus`, PAGE_W / 2, 92, { align: 'center' });

  // Table of contents
  yPos = 105;
  doc.setFontSize(9);
  doc.setTextColor(10, 25, 47);
  doc.setFont('helvetica', 'bold');
  doc.text('SOMMAIRE', MARGIN, yPos);
  yPos += 10;

  reports.forEach((rpt, idx) => {
    addPageIfNeeded(8);
    doc.setFontSize(8);
    doc.setTextColor(60, 70, 90);
    doc.setFont('helvetica', 'normal');
    doc.text(`${idx + 1}. ${rpt.id} — ${rpt.title}`, MARGIN, yPos);
    yPos += 6;
  });

  // Each report on a new page
  reports.forEach((rpt, idx) => {
    doc.addPage();
    yPos = 30;
    drawHeader();
    doc.setFontSize(8);
    doc.setTextColor(130, 140, 155);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rapport ${idx + 1} / ${reports.length}`, PAGE_W - MARGIN, 22, { align: 'right' });
    generateSingleReport(rpt);
  });

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  doc.save(`SentiqS_BatchExport_${dateSlug}.pdf`);
}