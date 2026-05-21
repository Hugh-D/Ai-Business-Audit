const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const workbookExporter = require('../agents/workbook_exporter');

test('buildAuditWorkbookBuffer creates an editable audit workbook structure', async () => {
  const buffer = await workbookExporter.buildAuditWorkbookBuffer({
    auditId: 'audit_test',
    industry: 'lawn_care',
    businessName: 'Green Stripe',
    contactName: 'Mia',
    phoneNumber: '+61474779711',
    transcript: 'Client: Quotes are on a whiteboard.',
    report: {
      overallScore: 7,
      scores: {
        leadResponse: 6,
        followUp: 5,
      },
      keyStrengths: ['Good seasonal demand'],
      criticalGaps: ['Quote tracking is manual'],
      sections: {
        leadFlow: 'Requests arrive from calls and Facebook.',
      },
      actionPlan: [
        {
          priority: 'High',
          action: 'Centralize quote intake.',
          timeframe: '30 days',
        },
      ],
    },
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.equal(workbook.getWorksheet('Summary').getCell('B2').value, 'Green Stripe');
  assert.equal(workbook.getWorksheet('Summary').getCell('B8').value, 7);
  assert.equal(workbook.getWorksheet('Findings').getCell('A2').value, 'Strength');
  assert.equal(workbook.getWorksheet('Findings').getCell('B3').value, 'Quote tracking is manual');
  assert.equal(workbook.getWorksheet('Action Plan').getCell('E2').value, 'Not Started');
  assert.equal(workbook.getWorksheet('Transcript').getCell('B2').value, 'Client: Quotes are on a whiteboard.');
});

test('buildWorkbookFilename returns a safe xlsx filename', () => {
  assert.equal(
    workbookExporter.buildWorkbookFilename({ industry: 'lawn_care', auditId: 'Audit 123!' }),
    'lawn-care-audit-123.xlsx'
  );
});
