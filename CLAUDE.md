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
Node/Express app in `ai-audit-system/`. Public marketing site (`/`, `/automations`, `/privacy`) plus an internal audit workbench at `/workbench`. See README.md for endpoints.

The public site is built on a token system in `public/landing.css`. `automations.css` layers on top of it and inherits the same tokens.

---

## Lessons Learned

**Never hardcode a font size or a colour in the public site CSS.** Everything comes from the tokens at the top of `landing.css`. The stylesheet had drifted to 28 distinct font sizes (including 6px and 7px text) and hardcoded hex values scattered through it. Use `--fs-*` and the colour tokens.

**`--ink` and `--slate` flip in dark mode. Dark bands must not use them.** The hero, trust band, CTA bands and footer are dark surfaces by design in BOTH themes. Building them on `--slate`/`--ink` inverted the hero to pale taupe with near-white text on it. Use the `--band-*` tokens, which never flip.

**Check contrast before shipping a colour pairing.** Several pairings that looked fine failed WCAG AA badly: white on gold at 2.07:1 (the primary CTA), gold on parchment at 1.92:1, ochre on canvas at 2.90:1 for small text. Run the audit script (see below) rather than eyeballing it.

**`--ochre` (#c47b2e) is not safe for small text on light backgrounds** at 2.90:1. Use `--ochre-text` for ochre TEXT under ~18px. `--ochre` stays for buttons, icons, borders and display headings.

**Gold (#e8a84a) is not safe on the slate band** at 3.03:1. Gold labels belong on the espresso bands, where they read at 8.76:1.

**Verify design changes by rendering, not by reading CSS.** Chromium and Playwright are available. Two bugs were only visible in a screenshot: the report card's sign-off overlapping the findings, and the whole dark-mode hero being unreadable.

**Google Fonts is blocked in the sandboxed container**, so headless screenshots fall back to Georgia and Arial unless the font files are downloaded and served through a Playwright route intercept. Screenshots taken without that are not showing the real typefaces.

**Making a `<summary>` a flex row removes the native disclosure triangle.** If you do it, add your own affordance or the panel looks like plain text.

**`<small>` inherits at 0.8333em**, so it renders off-scale unless given an explicit `font-size`.

---

## Key Decisions Log

**Colour scheme is fixed.** The five working colours do not change. Accessibility fixes work within them by adjusting which colour is used where, not by introducing new brand colours. The one addition is `--ochre-text`, a darker ochre for small text only.

**Dark bands use non-flipping `--band-*` tokens.** Separating "band surface" from "semantic colour" is what makes dark mode work without a duplicated stylesheet. Component rules read from tokens, so the dark-mode block only redefines tokens. This removed about 40 lines of duplicated overrides.

**Integration logos are tinted with a CSS filter, not by editing the SVGs.** They load through `<img>`, so page CSS cannot reach the fills inside them. `filter: brightness(0) opacity(.45)` works on any logo dropped into `assets/logos/`, whatever colours it ships with. Per-logo optical sizing uses the `--h` custom property on `.logo-item`. Do not put `width`/`height` attributes on the logo `<img>` tags: real brand marks have their own aspect ratios.

**The report card in the hero is an illustration, not a real report.** If a real anonymised report page becomes available, swap it in. Keep the third finding faded.

**No fake trust signals.** The ABN is left as an HTML comment rather than a placeholder number, and the testimonial slot is commented out rather than filled with invented quotes. A wrong ABN is worse than no ABN.

---

## Verifying the Public Site

Design changes to the public site should be checked by rendering, not by reading CSS.

1. Serve `ai-audit-system/public` on a local port.
2. Download the Google Fonts CSS and its woff2 files, then intercept `fonts.googleapis.com` and `fonts.gstatic.com` in Playwright and fulfil from disk. Without this the screenshots use fallback fonts.
3. Walk the rendered DOM checking every text node's computed colour against its effective background. Resolve the background by compositing ancestors, and hit-test with `elementsFromPoint` for out-of-flow elements (otherwise the header over the hero reads as a false failure).
4. Assert every interactive element is at least 44px tall at 390px wide. Links inline in a sentence are exempt under WCAG 2.5.8.
5. Check both `colorScheme: light` and `dark`, at 390px and 1440px.

Targets: zero contrast failures, zero tap-target failures, no horizontal overflow, and no rendered font size below 11px.
