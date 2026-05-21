const ExcelJS = require('exceljs');

const HEADER_FILL = '0D6B57';
const HEADER_FONT = 'FFFFFF';
const SUBTLE_FILL = 'E5F3EE';
const BORDER = { style: 'thin', color: { argb: 'D9DFDC' } };

async function buildAuditWorkbookBuffer(audit) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Business Audit';
  workbook.created = new Date();
  workbook.modified = new Date();

  const report = audit.report || {};
  addSummarySheet(workbook, audit, report);
  addScoresSheet(workbook, report);
  addFindingsSheet(workbook, report);
  addActionPlanSheet(workbook, report);
  addTranscriptSheet(workbook, audit);

  return workbook.xlsx.writeBuffer();
}

function addSummarySheet(workbook, audit, report) {
  const sheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Value', key: 'value', width: 70 },
  ];

  sheet.addRows([
    ['Prepared For', audit.businessName || audit.contactName || audit.phoneNumber || 'Business Owner'],
    ['Business Name', audit.businessName || ''],
    ['Contact Name', audit.contactName || ''],
    ['Phone Number', audit.phoneNumber || ''],
    ['Industry', formatLabel(audit.industry || 'unknown')],
    ['Audit ID', audit.auditId || 'draft'],
    ['Overall Score', report.overallScore ?? ''],
    ['Review Status', formatLabel(audit.reviewStatus || 'draft')],
    ['Review Notes', audit.reviewNotes || ''],
    ['Recipient Email', audit.recipientEmail || ''],
    ['Delivery Notes', audit.deliveryNotes || ''],
    ['Generated At', new Date().toLocaleString()],
  ]);

  styleTitle(sheet, 'A1:B1');
  sheet.getCell('B7').numFmt = '0';

  const strengths = normalizeList(report.keyStrengths).slice(0, 3);
  const gaps = normalizeList(report.criticalGaps).slice(0, 3);
  const startRow = sheet.rowCount + 2;
  sheet.getCell(`A${startRow}`).value = 'Top Strengths';
  sheet.getCell(`B${startRow}`).value = 'Top Gaps';
  sheet.getRange?.(`A${startRow}:B${startRow}`);

  for (let i = 0; i < Math.max(strengths.length, gaps.length, 1); i += 1) {
    sheet.addRow([strengths[i] || '', gaps[i] || '']);
  }

  styleSectionHeader(sheet.getRow(startRow));
  applyBorders(sheet);
}

function addScoresSheet(workbook, report) {
  const sheet = workbook.addWorksheet('Scores', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Dimension', key: 'dimension', width: 30 },
    { header: 'Score', key: 'score', width: 12 },
    { header: 'Notes', key: 'notes', width: 70 },
  ];

  for (const [label, score] of Object.entries(report.scores || {})) {
    sheet.addRow([formatLabel(label), score, '']);
  }

  styleTitle(sheet, 'A1:C1');
  sheet.getColumn('B').numFmt = '0';
  sheet.autoFilter = 'A1:C1';
  applyBorders(sheet);
}

function addFindingsSheet(workbook, report) {
  const sheet = workbook.addWorksheet('Findings', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Finding', key: 'finding', width: 90 },
    { header: 'Notes', key: 'notes', width: 45 },
  ];

  for (const item of normalizeList(report.keyStrengths)) {
    sheet.addRow(['Strength', item, '']);
  }
  for (const item of normalizeList(report.criticalGaps)) {
    sheet.addRow(['Gap', item, '']);
  }

  styleTitle(sheet, 'A1:C1');
  sheet.autoFilter = 'A1:C1';
  applyBorders(sheet);
}

function addActionPlanSheet(workbook, report) {
  const sheet = workbook.addWorksheet('Action Plan', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Priority', key: 'priority', width: 16 },
    { header: 'Action', key: 'action', width: 70 },
    { header: 'Timeframe', key: 'timeframe', width: 22 },
    { header: 'Owner', key: 'owner', width: 22 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Notes', key: 'notes', width: 45 },
  ];

  for (const item of Array.isArray(report.actionPlan) ? report.actionPlan : []) {
    sheet.addRow([
      item.priority || '',
      item.action || '',
      item.timeframe || '',
      '',
      'Not Started',
      '',
    ]);
  }

  styleTitle(sheet, 'A1:F1');
  sheet.autoFilter = 'A1:F1';
  for (let rowNumber = 2; rowNumber <= Math.max(sheet.rowCount, 25); rowNumber += 1) {
    sheet.getCell(`E${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Not Started,In Progress,Blocked,Done"'],
    };
  }
  applyBorders(sheet);
}

function addTranscriptSheet(workbook, audit) {
  const sheet = workbook.addWorksheet('Transcript');
  sheet.columns = [
    { header: 'Line', key: 'line', width: 10 },
    { header: 'Transcript Text', key: 'text', width: 120 },
  ];

  const lines = String(audit.transcript || '').split('\n').filter(Boolean);
  if (lines.length) {
    lines.forEach((line, index) => sheet.addRow([index + 1, line]));
  } else {
    sheet.addRow([1, '']);
  }

  styleTitle(sheet, 'A1:B1');
  sheet.getColumn('B').alignment = { wrapText: true, vertical: 'top' };
  applyBorders(sheet);
}

function styleTitle(sheet, headerRange) {
  void headerRange;
  sheet.getRow(1).font = { bold: true, color: { argb: HEADER_FONT } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 24;
}

function styleSectionHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: '084C3E' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTLE_FILL } };
  });
}

function applyBorders(sheet) {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: BORDER,
        right: BORDER,
        bottom: BORDER,
        left: BORDER,
      };
      cell.alignment = {
        wrapText: true,
        vertical: 'top',
      };
    });
  });

  sheet.getColumn(1).font = { bold: true };
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function formatLabel(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildWorkbookFilename(audit) {
  return `${slugify(audit.industry || 'audit')}-${slugify(audit.auditId || 'report')}.xlsx`;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

module.exports = {
  buildAuditWorkbookBuffer,
  buildWorkbookFilename,
};
