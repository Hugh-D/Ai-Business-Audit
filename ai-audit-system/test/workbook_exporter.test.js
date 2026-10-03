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
      diagnosticFindings: [
        {
          problemArea: 'Quote Follow-Up',
          status: 'red',
          maturity: 'Quote tracking is manual and not centrally visible.',
          evidence: 'Client: Quotes are on a whiteboard.',
          likelyImpact: 'Lost quote conversions and slower follow-up.',
          urgency: 'high',
          implementationPotential: 'high',
          fastestWin: 'Centralize quote intake and follow-up reminders.',
        },
      ],
      priorityAnalysis: {
        highestImpactIssue: 'Manual quote tracking',
        fastestVisibleWin: 'Centralize quote intake',
        implementationConfidence: 'high',
        reasoning: 'The transcript shows a clear manual process with a straightforward workflow fix.',
      },
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
  assert.equal(workbook.getWorksheet('Diagnostics').getCell('A2').value, 'Quote Follow-Up');
  assert.equal(workbook.getWorksheet('Diagnostics').getCell('B2').value, 'Red');
  assert.equal(workbook.getWorksheet('Findings').getCell('B3').value, 'Quote tracking is manual');
  assert.equal(workbook.getWorksheet('Action Plan').getCell('G2').value, 'Not Started');
  assert.equal(workbook.getWorksheet('Transcript').getCell('B2').value, 'Client: Quotes are on a whiteboard.');
});

test('buildWorkbookFilename returns a safe xlsx filename', () => {
  assert.equal(
    workbookExporter.buildWorkbookFilename({ industry: 'lawn_care', auditId: 'Audit 123!' }),
    'lawn-care-audit-123.xlsx'
  );
});

test('buildAuditWorkbookBuffer uses Inter and the Volve palette on every sheet', async () => {
  const buffer = await workbookExporter.buildAuditWorkbookBuffer({
    auditId: 'audit_fonts',
    industry: 'trades',
    businessName: 'Spark Co',
    transcript: 'Client: We miss calls after hours.',
    report: { overallScore: 6, scores: { leadResponse: 5 }, keyStrengths: ['Busy'], criticalGaps: ['Missed calls'] },
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  workbook.eachSheet((sheet) => {
    const header = sheet.getCell('A1');
    assert.equal(header.font.name, 'Inter', `${sheet.name} header font`);
    assert.equal(header.font.color.argb, 'FFF9F6F1', `${sheet.name} header text colour`);
    assert.equal(header.fill.fgColor.argb, 'FF1C1410', `${sheet.name} header fill`);
    sheet.eachRow((row) => row.eachCell((cell) => {
      assert.equal(cell.font && cell.font.name, 'Inter', `${sheet.name}!${cell.address} font`);
    }));
  });
});

test('buildAuditWorkbookBuffer drops closed topics and invented percentages', async () => {
  const buffer = await workbookExporter.buildAuditWorkbookBuffer({
    auditId: 'audit_closed',
    industry: 'trades',
    businessName: 'Pristine Kitchen Countertops',
    contactName: 'Albert',
    phoneNumber: '0474 779 497',
    transcript: [
      'Caller: I chase every missed enquiry.',
      'Caller: We do not ask for Google reviews.',
      'Caller: Leaks are not much. There is twenty-two thousand unpaid.',
    ].join('\n'),
    report: {
      overallScore: 6,
      scores: {},
      keyStrengths: [],
      criticalGaps: ['Lead handling has no safety net', 'Google reviews are not requested'],
      diagnosticFindings: [
        {
          problemArea: 'Lead Response',
          callerStance: 'handled',
          status: 'yellow',
          evidence: 'He chases every missed enquiry.',
          fastestWin: 'Add a safety net.',
        },
        {
          problemArea: 'Reviews and Reputation',
          callerStance: 'problem',
          status: 'yellow',
          evidence: 'They do not ask for Google reviews.',
          fastestWin: 'Ask after the job.',
        },
      ],
      actionPlan: [
        { priority: 'high', problemArea: 'Lead Response', action: 'Add a safety net for missed calls.', timeframe: '7 days' },
        { priority: 'medium', problemArea: 'Reviews and Reputation', action: 'Ask for a Google review after each job.', timeframe: '30 days', expectedImpact: 'About 2-3% of turnover.' },
      ],
    },
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const summary = workbook.getWorksheet('Summary');
  assert.equal(summary.getCell('B5').value, '0474 779 497');
  assert.equal(workbook.getWorksheet('Diagnostics').getCell('A2').value, 'Lead Response');
  assert.equal(workbook.getWorksheet('Diagnostics').getCell('B2').value, 'Green');
  assert.equal(workbook.getWorksheet('Diagnostics').getCell('H2').value, '');
  assert.equal(workbook.getWorksheet('Findings').getCell('A2').value, 'Strength');
  assert.equal(workbook.getWorksheet('Findings').getCell('B2').value, 'He chases every missed enquiry.');
  const findings = [];
  workbook.getWorksheet('Findings').eachRow(row => findings.push(row.getCell(2).value));
  assert.equal(findings.includes('Lead handling has no safety net'), false);
  assert.equal(findings.includes('Google reviews are not requested'), true);
  assert.equal(workbook.getWorksheet('Action Plan').getCell('B2').value, 'Ask for a Google review after each job.');
  assert.equal(workbook.getWorksheet('Action Plan').getCell('E2').value, '');
  assert.equal(workbook.getWorksheet('Action Plan').getCell('B3').value, null);
});
