# Production deployment

The repository root contains Railway config-as-code (`railway.json`) for the
complete website, internal audit workbench, and Retell webhook. The service uses
the shared website-audit package in this monorepo, so deploy from the repository
root rather than setting `ai-audit-system` as an isolated root directory.

## Deploy

1. In Railway, create a service from `Hugh-D/Ai-Business-Audit` on `main`.
2. Keep the service root at `/` so the app can load `packages/website-audit-core`.
3. Attach a volume to the service at `/var/data`, then set
   `CALL_STORE_PATH=/var/data/calls.sqlite` so call records survive deployments.
4. Add the environment variables listed below. SMTP values can remain unset until
   report email delivery is enabled. Use a long random `WORKBENCH_PASSWORD`.
5. Generate a public domain under the service's Networking settings, then set:
   - `PUBLIC_BASE_URL=https://your-service.up.railway.app`
   - `RETELL_WEBHOOK_URL=https://your-service.up.railway.app/webhook/retell`
6. In Retell, update the account-level webhook to the same `/webhook/retell` URL.
7. Confirm `/health`, the public homepage, the authenticated `/workbench`, and a
   signed Retell webhook test before routing the SIPCity number.

## Railway variables

```text
NODE_ENV=production
CALL_STORE_PATH=/var/data/calls.sqlite
AUDIT_PHONE_NUMBER=1300 244 769
DEFAULT_INBOUND_INDUSTRY=trades
AUDIT_MODEL=claude-sonnet-4-6
AUDIT_MAX_TOKENS=5000
VOICE_MODEL=claude-sonnet-4-6
ANTHROPIC_API_KEY=...
RETELL_API_KEY=...
RETELL_AGENT_ID=...
WORKBENCH_USERNAME=...
WORKBENCH_PASSWORD=...
PUBLIC_BASE_URL=...
RETELL_WEBHOOK_URL=...
```

Only `/workbench` and the internal audit, voice, and export APIs use HTTP Basic
authentication. The public website audit, health check, and signed Retell webhook
remain reachable without workbench credentials.
