# AI Business Audit

AI Business Audit helps small and medium businesses turn a discovery call transcript into a structured operations audit with prioritized recommendations.

The current app is a Node/Express API and phone-audit workbench with:

- industry-specific audit frameworks
- transcript cleanup
- inbound Retell webhook support for completed voice calls
- optional outbound Retell phone audit creation for internal testing
- Anthropic-powered report generation
- local SQLite call/report storage
- review, delivery, website review, and follow-up capture workflow
- simple health and discovery endpoints for deployment

## Quick Start

```bash
cd ai-audit-system
npm install
cp .env.example .env
npm start
```

The API runs on `http://localhost:3000` by default.

Open `http://localhost:3000` in a browser to use the MVP phone audit workbench.

## Endpoints

- `GET /` serves the MVP audit workbench.
- `GET /health` returns deployment health status.
- `GET /readiness` returns launch readiness checks.
- `GET /industries` lists supported industry slugs.
- `POST /voice/session` returns a voice prompt and config for an industry.
- `POST /voice/call` starts an outbound Retell phone audit call for internal testing.
- `GET /voice/calls` lists recent persisted call records.
- `GET /voice/calls/:callId` returns one persisted call record.
- `PATCH /voice/calls/:callId/review` updates review, delivery, website, and follow-up fields.
- `POST /voice/calls/:callId/website-review` runs a first-pass website review.
- `POST /voice/calls/:callId/deliver` sends the completed workbook by SMTP when configured.
- `POST /audit` turns an industry and transcript into a JSON audit report.
- `POST /webhook/retell` receives Retell call-ended webhooks and generates an audit report.

## Retell Setup

Add these values to `.env`:

```bash
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID=your_retell_agent_id
AUDIT_PHONE_NUMBER=your_public_audit_number
RETELL_WEBHOOK_URL=https://your-public-url.example/webhook/retell
```

`RETELL_FROM_NUMBER` is optional and only needed for internal outbound test calls.

The current Retell agent is a custom Voice Agent using a single-prompt setup. It should be published before any live call test.

Configure Retell to send call webhooks to:

```text
https://your-public-url.example/webhook/retell
```

For local testing, expose `http://localhost:3000` with a tunnel such as ngrok and use the tunnel URL as the webhook base.

The current call store is local SQLite at `ai-audit-system/data/calls.sqlite` by default.

The agent should ask open questions first, wait through thoughtful pauses, and confirm unclear tool names before moving on.

## Example Audit Request

```bash
curl -X POST http://localhost:3000/audit \
  -H "Content-Type: application/json" \
  -d '{
    "industry": "trades",
    "transcript": "Client: We miss a lot of after-hours calls. Agent: How do you follow up today?"
  }'
```

`POST /audit` requires `ANTHROPIC_API_KEY`.

## Product Direction

The first sellable version should focus on one painful promise:

> Turn a 20-minute business discovery call into a clear AI/process opportunity report that a business owner can act on.

Keep the first market narrow. Trades and home services are the strongest current starting point because the repo already has a detailed industry config for them and the pain is concrete: missed calls, booking leakage, weak follow-up, reviews, and maintenance plan conversion.

## Current Shipping Focus

The product is ready enough to validate the phone-led offer. Do not add deeper website crawling, accounts, CRM sync, payments, or more industries until the inbound call-to-report loop has been tested with real prospects.

Next commercial milestone:

1. Buy/configure the inbound audit number.
2. Connect SIPcity/Retell routing and the public webhook URL.
3. Run 10 opt-in electrician or small electrical contractor audits.
4. Deliver reviewed reports and book follow-up calls with Hugh.
5. Convert repeated findings into the first implementation sprint offer.

See [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) and [docs/BUSINESS_PLAN.md](docs/BUSINESS_PLAN.md).
