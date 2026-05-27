const test = require('node:test');
const assert = require('node:assert/strict');

const deliveryAgent = require('../agents/delivery_agent');

test('hasEmailConfig requires SMTP host, port, and from address', () => {
  assert.equal(deliveryAgent.hasEmailConfig({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_FROM: 'audit@example.com',
  }), true);

  assert.equal(deliveryAgent.hasEmailConfig({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
  }), false);
});

test('buildDeliveryMessage creates a client-ready email body', () => {
  const message = deliveryAgent.buildDeliveryMessage({
    industry: 'trades',
    businessName: 'Demo Plumbing Co',
    contactName: 'Sam',
    websiteUrl: 'https://demoplumbing.com.au',
    deliveryNotes: 'Book a follow-up consult next week.',
    report: {
      overallScore: 8,
      criticalGaps: ['Missed after-hours calls'],
      actionPlan: [{ action: 'Add missed-call follow-up automation.' }],
    },
  });

  assert.equal(message.subject, 'Trades audit report for Demo Plumbing Co');
  assert.match(message.text, /Hi Sam/);
  assert.match(message.text, /Missed after-hours calls/);
  assert.match(message.text, /https:\/\/demoplumbing\.com\.au/);
  assert.match(message.text, /Book a follow-up consult next week/);
});
