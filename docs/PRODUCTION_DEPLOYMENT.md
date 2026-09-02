# Production deployment

The repository root contains a Render Blueprint (`render.yaml`) for the complete
website, internal audit workbench, Retell webhook, and persistent call storage.

## Deploy

1. In Render, create a Blueprint from `Hugh-D/Ai-Business-Audit` and select the
   `main` branch.
2. Confirm the paid web-service plan and 1 GB persistent disk. A free service is
   not suitable for live Retell calls because it sleeps and its filesystem is
   ephemeral.
3. Supply every secret marked `sync: false` in `render.yaml`. SMTP values can be
   left blank until report email delivery is enabled. Use a long random password
   for `WORKBENCH_PASSWORD`.
4. After Render assigns the production URL, set:
   - `PUBLIC_BASE_URL=https://your-service.onrender.com`
   - `RETELL_WEBHOOK_URL=https://your-service.onrender.com/webhook/retell`
5. In Retell, update the account-level webhook to the same `/webhook/retell` URL.
6. Confirm `/health`, the public homepage, the authenticated `/workbench`, and a
   signed Retell webhook test before routing the SIPCity number.

Only `/workbench` and the internal audit, voice, and export APIs use HTTP Basic
authentication. The public website audit, health check, and signed Retell webhook
remain reachable without workbench credentials.
