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
    reviewStatus: 'reviewed',
    reviewNotes: 'Ready to send after checking phone number.',
    recipientEmail: 'mia@example.com',
    websiteUrl: 'https://greenstripe.example.com.au',
    deliveryNotes: 'Attach the workbook before sending.',
    followUpStatus: 'booked',
    followUpPreferredTime: 'Tuesday morning',
    followUpScheduledFor: '2026-06-02T09:30',
    followUpNotes: 'Cover the priority automation plan.',
    websiteReview: {
      websiteUrl: 'https://greenstripe.example.com.au',
      title: 'Green Stripe Lawn Care',
      description: 'Local lawn care help.',
      logoUrl: 'https://greenstripe.example.com.au/logo.png',
      checkedAt: '2026-06-01T00:00:00.000Z',
      signals: [
        { id: 'phoneVisibility', label: 'Phone Visibility', status: 'found', detail: 'Phone found.' },
        { id: 'afterHoursCapture', label: 'After-hours Lead Capture', status: 'missing', detail: 'No after-hours capture found.' },
      ],
      opportunities: ['No after-hours capture found.'],
    },
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
  assert.equal(workbook.getWorksheet('Summary').getCell('B9').value, 'Reviewed');
  assert.equal(workbook.getWorksheet('Summary').getCell('B10').value, 'Ready to send after checking phone number.');
  assert.equal(workbook.getWorksheet('Summary').getCell('B11').value, 'mia@example.com');
  assert.equal(workbook.getWorksheet('Summary').getCell('B12').value, 'https://greenstripe.example.com.au');
  assert.equal(workbook.getWorksheet('Summary').getCell('B13').value, 'Attach the workbook before sending.');
  assert.equal(workbook.getWorksheet('Summary').getCell('B14').value, 'Booked');
  assert.equal(workbook.getWorksheet('Summary').getCell('B15').value, 'Tuesday morning');
  assert.equal(workbook.getWorksheet('Summary').getCell('B16').value, '2026-06-02T09:30');
  assert.equal(workbook.getWorksheet('Summary').getCell('B17').value, 'Cover the priority automation plan.');
  assert.equal(workbook.getWorksheet('Findings').getCell('A2').value, 'Strength');
  assert.equal(workbook.getWorksheet('Website Review').getCell('C2').value, 'https://greenstripe.example.com.au');
  assert.equal(workbook.getWorksheet('Website Review').getCell('A9').value, 'Phone Visibility');
  assert.equal(workbook.getWorksheet('Website Review').getCell('B10').value, 'Missing');
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
