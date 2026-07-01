# Handoff: Volve Solutions Landing Page

## Overview
A mobile-first marketing landing page for **Volve Solutions**, an Australian small-business advisory service targeting trade businesses (electricians first). The page sells a paid **$297 AI Business Audit**: a 12-minute phone assessment that produces a report of the customer's top three revenue leaks, reviewed personally by Hugh. The page is built as a single vertical scroll optimised for a 390px viewport, driving one primary action: tap-to-call.

## About the Design Files
The file in this bundle (`Hero.dc.html`) is a **design reference created in HTML** — a working prototype showing the intended look, copy, and behaviour. It is **not production code to lift directly**. The task is to **recreate this design in the target codebase's existing environment** (React, Vue, Next, SwiftUI, native, etc.) using that codebase's established components, tokens, and patterns. If no environment exists yet, choose the most appropriate framework for the project and implement the design there.

`CLAUDE.md` (also included) is the full Volve Solutions design system. Treat it as the source of truth for colours, typography, spacing, and component rules.

> Note: `Hero.dc.html` is authored as a "Design Component" (inline-styled HTML that streams into a live preview). Read it for exact markup, values, and copy — but rebuild using your codebase's styling approach rather than porting the inline styles verbatim.

## Fidelity
**High-fidelity (hifi).** Final colours, typography, spacing, copy, and interactions are all specified. Recreate the UI pixel-accurately using the codebase's existing libraries and patterns. Every hex value, font size, and string below is final.

## Screens / Views

Single screen: a one-page vertical scroll, 390px content width, mobile-first. Sections in order top to bottom:

### 1. Hero
- **Purpose**: State the value proposition and drive a call.
- **Layout**: Full-width block on slate `#6B5E52`, padding `40px 20px 44px`, vertical stack.
- **Components**:
  - **Eyebrow**: "AI Business Audit" — Inter 700, 11px, uppercase, letter-spacing 0.1em, colour gold `#E8A84A`.
  - **Headline**: "In 12 minutes, we'll tell you exactly where your business is **leaking money**." — Inter 700, 28px, line-height 1.15, letter-spacing -0.5px, colour parchment `#F9F6F1`; the phrase "leaking money" in gold `#E8A84A`. Margin-top 14px.
  - **Subheading**: "A short phone assessment that finds your top three revenue leaks, with practical fixes reviewed personally by Hugh." — Inter 400, 14px, line-height 1.55, colour dust `#DDD5C8`. Margin-top 16px.
  - **Call button (primary)**: full-width, background ochre `#C47B2E`, text `#FDF4E7`, Inter 700 16px, radius 14px, padding `16px 20px`, phone icon left of text, gap 8px. Text "Call 1300 AI GROW". `href="tel:1300244769"`. Margin-top 24px. **This is one of only two ochre-fill CTAs on the page.**
  - **Ghost button (secondary)**: full-width, transparent, border `2px solid #A89880`, radius 14px, padding `13px 20px`, text dust `#DDD5C8` Inter 600 14px. Text "See how it works". Margin-top 10px.
  - **Proof points** (3 rows, margin-top 24px, gap 7px): each row is a 5px solid ochre `#C47B2E` circle (no border/outline) + label, 8px gap, vertically centred. Labels Inter 400 12px colour muted `#A89880`: "$297 flat fee, no surprises" / "12 minutes by phone" / "Personal callback included".

### 2. Report Card (sample audit)
- **Purpose**: Show the product — what the audit produces — to build credibility and curiosity.
- **Layout**: Section on parchment `#F9F6F1`, padding `48px 20px`. Eyebrow + heading, then the card.
  - **Eyebrow**: "Sample report" — Inter 700 11px uppercase 0.1em, colour ochre-brown `#7A4F1E`.
  - **Heading**: "Here is what your audit could find." — Inter 700 24px, line-height 1.2, letter-spacing -0.3px, colour espresso `#1C1410`. Margin 10px 0 24px.
- **Card**: white background, border `0.5px solid #DDD5C8`, radius 14px, overflow hidden. Three parts:
  - **Header** (espresso `#1C1410`, padding `12px 14px`, flex space-between):
    - Left: label "Audit report" (Inter 700 9px uppercase 0.08em, colour muted `#A89880` — passes WCAG AA on espresso; do not use `#6B5E52`), title "Your top 3 revenue leaks" (Inter 700 12px, parchment `#F9F6F1`).
    - Right: label "Est. impact" (same label style), value "$34k+/yr" (Inter 700 14px, gold `#E8A84A`).
  - **Body** (white, padding 10px, gap 7px between items):
    - **Leak item** (×2 full): background parchment `#F9F6F1`, border `0.5px solid #DDD5C8`, radius 8px, padding `10px 11px`.
      - Top row (flex, gap 8px, centred): number badge (18px ochre `#C47B2E` circle, text `#FDF4E7` Inter 700 9px, centred) + title (Inter 700 11px espresso `#1C1410`) + tag pushed right ("High", Inter 700 9px, ochre `#C47B2E` on pale ochre `#FDF4E7`, border `0.5px solid #E8A84A`, pill, padding `2px 8px`).
      - Description: Inter 400 11px, line-height 1.5, colour slate `#6B5E52`, margin-top 8px.
      - Fix block: background `#F2EDE5`, radius 6px, padding `7px 8px`, margin-top 8px. Label "Fix" (Inter 700 9px uppercase 0.07em, colour `#7A4F1E`) + text (10px, line-height 1.5, espresso `#1C1410`).
      - **Leak 1**: title "Missed calls going to voicemail". Desc: "Roughly 1 in 4 inbound calls go unanswered during jobs. Each missed call is a quote you never got to give." Fix: "Auto-reply by text within 60 seconds so the lead never goes cold."
      - **Leak 2**: title "Quotes sent, never followed up". Desc: "Quotes that take days to send win less often. No follow-up means warm leads quietly go elsewhere." Fix: "Same-day quote template plus an automatic two-day follow-up."
    - **Leak 3 (faded preview)**: same card shell at `opacity: 0.4`. Number badge in dust `#DDD5C8` with white numeral "3"; title replaced by a 9px×140px dust pill; two placeholder line pills below (8px tall, 100% and 75% width, dust). **Always render the third leak faded/placeholder — never reveal it.**
  - **Footer** (espresso `#1C1410`, padding `11px 14px`, flex space-between): left "Reviewed by **Hugh** within 48 hrs" (Inter 400 10px colour muted `#A89880`, "Hugh" in gold `#E8A84A`); right "Get yours" (Inter 600 11px parchment) + 22px ochre `#C47B2E` circle containing a `#FDF4E7` arrow, gap 7px.

### 3. How It Works
- **Purpose**: De-risk the call by explaining the three steps plainly.
- **Layout**: Section on canvas-soft `#F2EDE5`, padding `48px 20px`.
  - **Eyebrow**: "How it works" — Inter 700 11px uppercase 0.1em, ochre-brown `#7A4F1E`.
  - **Heading**: "Three steps. No sales pitch." — Inter 700 26px, line-height 1.2, letter-spacing -0.5px, espresso `#1C1410`. Margin 10px 0 28px.
  - **Timeline**: vertical stack, 26px between steps. Each step is a flex row (gap 14px): a fixed 32px column holding the badge, and the content.
    - **Connector line**: 2px dust `#DDD5C8` vertical line running behind the badges, from the centre of step 1's badge to the centre of step 3's badge. Implemented per-step (each of steps 1 and 2 draws a segment from its badge centre down to the next), so the line always terminates at badge 3 regardless of text length. Badges sit above the line (z-index).
    - **Badge**: 32px ochre `#C47B2E` circle, numeral `#FDF4E7` Inter 700 14px, centred.
    - **Step title**: Inter 700 16px espresso `#1C1410`. **Body**: Inter 400 14px line-height 1.6 slate `#6B5E52`, margin-top 5px.
    - **Step 1 "Call"**: "Call 1300 AI GROW and tell the agent you want the audit. It costs $297. The call is recorded so we can build your report, and the agent asks first. Say no and the call ends there."
    - **Step 2 "Audit"**: "Answer plain questions about how your business handles calls, quotes, follow-up and other day-to-day operations. Twelve minutes. No jargon, no AI talk."
    - **Step 3 "Report"**: "You'll get a payment link by email after the call. Pay $297 and Hugh, a real person, reviews your findings and prepares your report within 48 hours: your top three revenue leaks, what they're costing you, and what to do about each one."

### 4. FAQ
- **Purpose**: Answer objections before the call.
- **Layout**: Section on parchment `#F9F6F1`, padding `48px 20px`.
  - **Eyebrow**: "Common questions" — Inter 700 11px uppercase 0.1em, ochre-brown `#7A4F1E`.
  - **Heading**: "Straight answers before you call." — Inter 700 26px, letter-spacing -0.5px, espresso `#1C1410`. Margin 10px 0 24px.
  - **Accordion**: 8 items, 8px gap. **Use a native disclosure pattern** (`<details>`/`<summary>` or the codebase's accessible accordion) — keyboard-operable and screen-reader friendly. **First item open on load**, the rest collapsed.
    - **Item**: white background, border `0.5px solid #DDD5C8`, radius 12px, overflow hidden.
    - **Question row** (summary): flex space-between, padding `14px 16px`, cursor pointer, Inter 600 15px espresso `#1C1410`; chevron on the right, ochre `#C47B2E`, 16px, that rotates 180° when open (transition 0.2s ease). Hide the native default marker.
    - **Answer**: Inter 400 14px line-height 1.6 slate `#6B5E52`, padding `0 16px 16px` (no top padding).
  - **Q&A in order**:
    1. "Is this a sales call?" → "No. The call is the audit. You answer questions, we build your report. Nobody pitches you software or upsells you during the call, because there is nothing to pitch. You get a report. What you do with it is yours to decide."
    2. "Will this replace my staff or change how I run things?" → "No. The audit shows you where money is slipping through, not how to run your business. Your report can flag ways to run more efficiently or clear bottlenecks, but what you do with the findings, fix it yourself, bring in help, or do nothing, is entirely up to you."
    3. "What happens to the call recording?" → "The agent records the call to build your report accurately, because the report is generated from what you say, not a generic template. It asks for your permission before the call starts. Say no and it ends there. Nothing is recorded without it."
    4. "Do I have to commit to anything?" → "No. You pay $297 for the audit and the report. No contract, no upsell on the call, no obligation beyond the audit itself."
    5. "What if my report doesn't find much?" → "You may not be losing money outright, but there's almost always a way to run more efficiently or capture revenue you're currently missing. Either way, you'll know within 48 hours, not after months of guessing."
    6. "How is this different to a free online quiz?" → "A quiz gives you a template answer. This comes from a real 12-minute conversation about your business, and Hugh checks every report personally before it goes out."
    7. "Do I get to talk to someone about my report?" → "Yes, if you want to. Once your report lands, you can book a call with Hugh to walk through the findings together. It's included, and entirely your choice."
    8. "What number do I call?" → "1300 AI GROW is 1300 244 769. On a phone, tap any call button on this page and it dials for you. On a desktop, just dial the digits."

### 5. Final CTA Band
- **Purpose**: Closing call to action, directly above the footer.
- **Layout**: Section on espresso `#1C1410`, padding `40px 20px`, centred stack (align-items center, text-align center).
  - **Headline**: "Stop guessing where the money goes." — Inter 700 28px, line-height 1.15, letter-spacing -0.3px, parchment `#F9F6F1`.
  - **Sub-line**: "Twelve minutes on the phone. Your top three revenue leaks, found." — Inter 400 15px, line-height 1.5, dust `#DDD5C8`, margin-top 14px.
  - **Primary CTA**: full-width ochre `#C47B2E` call button, text `#FDF4E7` Inter 700 16px, radius 14px, padding `16px 20px`, phone icon left, gap 8px. Text "Call 1300 AI GROW". `href="tel:1300244769"`. Margin-top 24px. **This is the second and final ochre-fill CTA on the page — no ochre fill below this point.**
  - **Micro-reassurance**: "$297 flat. No software pitch. Personal callback if you want it." — Inter 400 12px muted `#A89880`, centred, margin-top 14px.

### 6. Footer
- **Layout**: Section on espresso `#1C1410`, padding `28px 20px`, top border `0.5px solid #6B5E52` (separates it from the CTA band above).
  - **Business name**: "Volve Solutions" — Inter 700 16px parchment `#F9F6F1`.
  - **Tagline**: "Straight answers for Australian trade businesses." — Inter 400 13px muted `#A89880`, margin-top 5px.
  - **Phone link (NOT a filled button)**: inline phone icon + "Call 1300 AI GROW", both gold `#E8A84A`, Inter 700 17px, `href="tel:1300244769"`, margin-top 18px. Text link because the ochre fill is reserved for hero + final CTA band.
  - **Plain-text number**: "1300 244 769" — Inter 400 13px muted `#A89880`, margin-top 8px, directly under the phone link. Gives desktop users (where `tel:` often does nothing) the literal digits, since "1300 AI GROW" is a vanity spelling.
  - **Privacy + copyright** (margin-top 22px, padding-top 16px, top border `0.5px solid #6B5E52`):
    - Privacy: "Calls are recorded with your permission, used only to build your report. We don't share your data." — Inter 400 12px line-height 1.55 colour `#8A7D72`.
    - Copyright: "© 2026 Volve Solutions. Sydney, Australia." — Inter 400 12px colour `#6B5E52`, margin-top 12px.

## Interactions & Behavior
- **Tap-to-call**: all "Call 1300 AI GROW" actions are `tel:1300244769` links. On mobile these open the dialer.
- **Ghost button**: "See how it works" scrolls to the How It Works section (in-page anchor).
- **FAQ accordion**: tap a question to expand/collapse. First item open on initial load; others collapsed. Chevron rotates 180° on open (0.2s ease). Native disclosure semantics — keyboard and screen-reader operable.
- **Responsive**: designed mobile-first at 390px. Per the design system, desktop (>1024px) should shift the hero to a 58/42 two-column split (headline/CTA left, report card right, scaled down) and services to a three-column grid. Only the mobile layout is realised in this prototype; scale up following `CLAUDE.md`.
- No gradients, no glow, no decorative illustration anywhere.

## State Management
Minimal. The only interactive state is the FAQ accordion (which items are open) — one open by default, independently toggleable. If rebuilt with a controlled accordion, track an open-set or per-item boolean. No data fetching; the page is static marketing content. (The live product flow — calling, consent, payment link, report generation — happens off-page via the phone agent; see `CLAUDE.md` call-funnel notes if present.)

## Design Tokens
**Colours**
- Espresso (ink): `#1C1410` — primary text, dark card surfaces, footer + CTA bands
- Slate: `#6B5E52` — hero background, dark surface, muted labels/borders on dark
- Parchment (canvas): `#F9F6F1` — body background, light card base
- Canvas-soft: `#F2EDE5` — section band (How It Works), fix blocks
- Ochre (accent): `#C47B2E` — primary CTA fill + accent dots/badges. One fill per allowed location only.
- Gold (accent-light): `#E8A84A` — accent text on dark surfaces, eyebrow on slate, tag border
- Pale ochre (accent-bg): `#FDF4E7` — CTA text on ochre, tag background
- Ochre-brown: `#7A4F1E` — eyebrow on light surfaces, "Fix" label
- Text body: `#6B5E52` · Secondary: `#8A7D72` · Muted: `#A89880` · On-dark: `#DDD5C8`
- Border/dust: `#DDD5C8`
- White: `#FFFFFF` (report card body only)

**Typography** — Inter throughout (400 / 600 / 700). No other families.
- Hero/CTA headline 28px/700, section heading 24–26px/700, step/subheading 15–18px, body 14–16px/400, eyebrow 11px/700 uppercase 0.1em, caption/label 9–12px.

**Spacing** — 8 / 12 / 16 / 24 / 32 / 48px scale. Section padding `48px 20px` (light) and `28–40px 20px` (dark bands). Container padding 20px.

**Radius** — sm 6px, md 8px, lg 12px, report card 14px, mobile button 14px, pill 9999px. Card-rhythm rule (rotate a single 28px corner across a card group) applies to any multi-card row you add.

**Borders** — `0.5px solid #DDD5C8` on light cards; `0.5px solid #6B5E52` dividers on dark. Ghost button `2px solid #A89880`.

## Assets
- **Icons**: inline SVG only (Feather-style). Phone icon (hero, final CTA, footer), right-arrow (report card footer), chevron-down (FAQ). No raster assets. Recreate with the codebase's icon library (e.g. lucide/feather) at the sizes noted.
- **Fonts**: Inter via Google Fonts (weights 400/600/700). Use the codebase's existing font pipeline.
- No images or logos in this prototype.

## Files
- `Hero.dc.html` — the full landing page prototype (all six sections). Despite the name, it contains the entire page, not just the hero.
- `CLAUDE.md` — the Volve Solutions design system (palette, type, spacing, components, voice, and design rules). Authoritative for tokens and copy tone.

## Copy / Voice Rules (from the design system — honour these in any new copy)
- Plain, direct, warm. Lead with revenue loss, not technology. No AI-transformation language.
- **No em-dashes anywhere.** No "Learn more" as a CTA. Banned words include leverage, streamline, utilise, delve, crucial.
- Single ochre-fill CTA per allowed location (hero, final CTA band). Everything else that calls is a text link.
