# Public Webhook Runbook

## Goal

Expose the local AI Business Audit app to Retell long enough to test the complete inbound call-to-report flow.

Do not deploy a larger production stack before the first live validation calls require it.

## Current Local State

The app already provides:

- `GET /health`
- `GET /readiness`
- `POST /webhook/retell`
- Retell webhook signature verification
- fast `204` acknowledgement
- background report generation
- local SQLite call/report persistence

The remaining requirements are:

- a public HTTPS URL
- `RETELL_WEBHOOK_URL`
- `AUDIT_PHONE_NUMBER`
- the same webhook URL configured in Retell

## Start The App

From `ai-audit-system`:

```powershell
npm start
```

Verify locally:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/readiness
```

## Expose Port 3000

Neither ngrok nor Cloudflare Tunnel is currently installed on this machine.

Preferred validation option: ngrok.

After ngrok is installed and authenticated:

```powershell
ngrok http 3000
```

Copy the public HTTPS forwarding URL, for example:

```text
https://example.ngrok-free.app
```

The Retell webhook URL is:

```text
https://example.ngrok-free.app/webhook/retell
```

## Configure Environment

Set these values in `ai-audit-system/.env`:

```text
AUDIT_PHONE_NUMBER=1300 244 769
PUBLIC_BASE_URL=https://example.ngrok-free.app
RETELL_WEBHOOK_URL=https://example.ngrok-free.app/webhook/retell
```

Restart the Node app after changing `.env`.

Do not set the advertised number until SIPCity confirms and activates it.

## Verify Public Readiness

From `ai-audit-system`:

```powershell
$env:PUBLIC_BASE_URL='https://example.ngrok-free.app'
npm run check:launch
```

This checks the public `/health` and `/readiness` endpoints and exits with an error while required inbound configuration is missing.

You can also open:

```text
https://example.ngrok-free.app/readiness
```

## Configure Retell

In Retell:

1. Configure the webhook as the public `RETELL_WEBHOOK_URL`.
2. Ensure completed-call events are enabled.
3. Assign the published `AI Business Audit assistant` to the inbound SIP number.
4. Keep the industry metadata set to `trades` for the electrician pilot where Retell supports call metadata.
5. Confirm the prompt uses the consent-first opening before discovery.

## First Inbound Test

Use Hugh as the first caller.

Success means:

1. The 1300 number connects to the correct Retell agent.
2. The agent identifies itself as AI.
3. The agent says the call will be recorded and transcribed.
4. The agent waits for explicit permission.
5. The assessment completes without closing before contact details are confirmed.
6. Retell posts `call_ended` to `/webhook/retell`.
7. The webhook responds `204`.
8. The app stores the call.
9. Status moves from `generating_report` to `report_ready`.
10. The report appears in the workbench.
11. The workbook exports successfully.
12. Hugh can review and deliver the report.

## Tunnel Limitations

An ngrok development URL may change when restarted. When it changes:

1. update `PUBLIC_BASE_URL`
2. update `RETELL_WEBHOOK_URL`
3. restart the app
4. update the webhook URL in Retell
5. rerun `npm run check:launch`

This is acceptable for validation. Move to a stable deployed URL only when repeated prospect calls make tunnel maintenance a real operational problem.
