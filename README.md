# AI Business Audit

AI Business Audit helps small and medium businesses turn a discovery call transcript into a structured operations audit with prioritized recommendations.

The current app is a Node/Express API and phone-audit workbench with:

- industry-specific audit frameworks
- transcript cleanup
- outbound Retell phone audit creation
- Anthropic-powered report generation
- Retell webhook support for completed voice calls
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
- `GET /industries` lists supported industry slugs.
- `POST /voice/session` returns a voice prompt and config for an industry.
- `POST /voice/call` starts an outbound Retell phone audit call.
- `GET /voice/calls` lists recent in-memory call records.
- `GET /voice/calls/:callId` returns one in-memory call record.
- `POST /audit` turns an industry and transcript into a JSON audit report.
- `POST /webhook/retell` receives Retell call-ended webhooks and generates an audit report.

## Retell Setup

Add these values to `.env`:

```bash
RETELL_API_KEY=your_retell_api_key
RETELL_FROM_NUMBER=+15551234567
RETELL_AGENT_ID=your_retell_agent_id
```

The current Retell agent is a custom Voice Agent using a single-prompt setup. It should be published before any live call test.

Configure Retell to send call webhooks to:

```text
https://your-public-url.example/webhook/retell
```

For local testing, expose `http://localhost:3000` with a tunnel such as ngrok and use the tunnel URL as the webhook base.

The current call store is in memory, so call records reset when the server restarts.

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

See [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) and [docs/BUSINESS_PLAN.md](docs/BUSINESS_PLAN.md).
