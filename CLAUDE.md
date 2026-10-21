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

---

## Lessons Learned
_Capture errors and corrections here as they occur._

- Calendly scheduling: inspect the expanded Retell field instructions as well as the main prompt. Copy the selected availability slot's complete `start_time`, including its timezone suffix; a field instruction requesting a local datetime can override the main scheduling rules. Verify the actual Calendly event duration, not its title or URL. An active invitee response and a report's stated booking time do not independently verify the appointment's start and end times.
- Calendly HTTP 429: check the account plan and endpoint-specific quotas before further booking tests. The trial Scheduling API permits five create-invitee requests per user per day (verified 2026-10-21); quota applies across pathways. Stop same-call booking retries on 429 rather than trying different times. Keep main-prompt failure handling consistent with the function description, and verify phone input uses international format. A successful test earlier in the day does not establish that quota remains available for the next voice test.

---

## Key Decisions Log
_Record significant architectural or scope decisions here with brief rationale._
