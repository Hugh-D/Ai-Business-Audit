# AI Business Audit — CLAUDE.md

## What This Is
A tool that helps small-to-medium businesses audit their current AI tool usage and identify opportunities to reduce cost, increase leverage, or eliminate redundancy. The output is a structured report with prioritised recommendations.

This is a solo build. The developer is Buzzy — learning by doing. Decisions favour clarity over cleverness.

---

## Workflow Principles

1. **Plan first, check in before starting** — for any multi-step task, write the plan and confirm before executing.
2. **No temporary fixes** — find root causes, minimal footprint, only touch what's necessary.
3. **Capture lessons after corrections** — when something goes wrong or gets corrected, update this file so the same mistake doesn't repeat.
4. **Verify before calling it done** — don't mark something complete without demonstrating it works.
5. **Simplicity first** — ask "is there a more elegant way?" before over-engineering.

---

## Build Philosophy
- AI = brain (interprets, recommends, drafts). Code = structure (captures input, formats output, routes data).
- Never use an LLM where deterministic logic will do.
- Prefer one working thing over three half-built things.
- When in doubt, reduce scope — build the smallest version that delivers real value.

---

## Current Status
🔜 Early build — structure TBC. Update this section as the project takes shape.

**Planned separate tool: Missed-call text-back (build on hold).** Planning is complete. Full detail is in `missed-call-textback-handoff.md`. Do not start building until Buzzy says go. The build goes in a new repo, not this one.

---

## Lessons Learned
_Capture errors and corrections here as they occur._

---

## Key Decisions Log
_Record significant architectural or scope decisions here with brief rationale._

### Missed-call text-back (2026-10-28)
Pilot client is Volve AI Business Audit (Buzzy's own business), then on-sell in AU and NZ. Full list in `missed-call-textback-handoff.md`.
- New repo, separate from this one. Different product and lifecycle.
- Twilio for voice and SMS behind a small provider interface, so AU providers can be swapped in later.
- Twilio `<Dial>` handles forwarding, not carrier conditional-forward codes. More reliable and under our control.
- Railway hosts the server and Postgres. Not SQLite, because Railway disk does not persist across deploys.
- v1 has no LLM. The missed-call flow is deterministic. An LLM is added in Phase 2 for reply qualification only.
- Calendly link goes in the text-back message.
- Landline filtering by number prefix (+614 AU, +642 NZ), not a paid lookup.
- `business_id` on every table from day one, single business in v1.
- The 1300 244 769 port from SIPCity is in progress. Do not point it at a webhook until the port completes.
- Unverified, check before relying on them: 1300 numbers cannot send SMS, AU mobile number requirements, Twilio STOP handling, and voicemail answering inside the dial window.
