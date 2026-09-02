# Product Roadmap

## Product Thesis

Small businesses do not need a generic AI report. They need a fast diagnosis of where leads, follow-up, operations, and customer experience are leaking money, plus a simple action plan they trust.

The app should become an audit engine that captures a discovery conversation, extracts operational signals, scores the business, and produces a practical report.

## MVP

The MVP should prove one workflow end to end:

1. Receive an inbound phone assessment from a business owner who responds to an ad or offer.
2. Capture the completed Retell transcript.
3. Generate a structured audit report.
4. Present the report in a clean web view.
5. Offer report delivery and an optional booked follow-up call with Hugh.

## Current Shipping Gate

The app should now be treated as validation-ready, not feature-hungry.

The next gate is commercial proof with electricians:

1. A real prospect completes the audit by public audit number or the temporary Hugh-led fallback.
2. Retell completes the consent-first assessment.
3. The webhook generates a report without manual transcript copying.
4. Hugh reviews and delivers the report.
5. The prospect either books a follow-up call, declines, or gives clear feedback.

Until this has happened with at least 10 opt-in electrician or small electrical contractor prospects, avoid expanding scope. New ideas should be judged by whether they increase completed audits, delivered reports, or booked implementation conversations in the next 30 days.

If the public number is delayed by SIPCity, Twilio compliance, or another provider issue, use [PHONE_NUMBER_BLOCKED_FALLBACK.md](PHONE_NUMBER_BLOCKED_FALLBACK.md) and keep validating with Hugh-led discovery calls.

## Build Phases

### Phase 1: API You Can Trust

- Add health/root endpoints.
- Add `.env.example`.
- Harden JSON parsing from the model.
- Add automated tests for industry routing, transcript cleaning, and report parsing.
- Add request validation for `/audit` and `/voice/session`.
- Log audit generation failures without leaking secrets.

### Phase 2: Usable Web App

- Build a simple dashboard with:
  - industry selector
  - transcript input
  - report generation button
  - report preview
  - export to PDF or copy-to-clipboard
- Add loading, error, and empty states.
- Store generated audits locally or in a small database.

### Phase 3: Voice-Led Audit Flow

- Make inbound SIPcity/Retell calls the primary live customer path.
- Keep Retell outbound call creation only as an internal testing utility. Done for the MVP.
- Pass `metadata.industry` into calls and prefer it over transcript detection. Done for the MVP.
- Store call ID, transcript, report, and status in local SQLite. Done for the MVP.
- Require AI identity and recording/transcription consent at the start of each assessment.
- Add a review step before sending the final report. Done for the MVP.

### Phase 4: Business Workflow

- Add lead intake form.
- Add CRM export or webhook.
- Add email delivery for completed reports.
- Add per-client audit history.
- Add templates for follow-up offers.
- Add follow-up booking capture to report review. Done for the MVP.
- Capture the customer's website URL for later customer-journey checks and personalised reporting. Done for the MVP.
- Add a first-pass website customer-journey review from the captured URL. Done for the MVP.
- Extract website auditing into a shared core and create a standalone website audit tool. Done for the MVP.

## First Differentiators

- Industry-specific scoring rather than generic AI advice.
- Concrete money-leak framing: missed calls, slow follow-up, low review capture, weak conversion.
- Report sections written for business owners, not AI hobbyists.
- Fast turnaround from call to consultative deliverable.

## Near-Term Technical Backlog

Shipping blockers:

- Buy/configure the inbound audit number. Current likely path is SIPCity 1300 number plus SIP trunk; see [SIPCITY_RETELL_SETUP.md](SIPCITY_RETELL_SETUP.md).
- Configure SIPcity/Retell routing and the public webhook URL.
- Verify the live inbound call-to-report loop with Hugh as the first caller.
- Run 10 opt-in audits with electricians or small electrical contractors.
- Track completed audits, delivered reports, follow-up bookings, paid conversions, and repeated implementation opportunities.

Number blocked fallback:

- Run Hugh-led discovery calls using normal phone, Zoom, Google Meet, or Teams.
- Paste the transcript or structured notes into the manual audit workflow.
- Count these toward validation when the report is reviewed, delivered, and tracked.

Only after the live loop works:

- Add deployment config.
- Add CI.
- Add `eslint` or a minimal formatter.
- Add schema validation with `zod` or `joi`.
- Add model output schema enforcement.
- Add server-side PDF generation if browser print/PDF is not enough.
- Decide standalone website audit monetisation path: lead magnet, paid mini-audit, or internal sales qualifier.

Explicitly parked until revenue signal:

- More industries.
- Deeper website crawling and brand/logo extraction.
- Accounts, CRM sync, payments, or calendar integration.
- More report features that do not improve conversion to a follow-up or implementation sprint.
