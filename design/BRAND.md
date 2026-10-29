# Volve Solutions Brand System

**Version 3.0 · 29 October 2026 · Owner: Hugh**

This is the single brand book for Volve Solutions. It governs reports, social posts, the website, proposals, emails, flyers and decks. Agents (Claude, GrokBot, ChatGPT) and people follow it the same way. If anything here conflicts with an older file, this file wins.

**Browsable version:** https://claude.ai/artifact/7siLUrdNSBpf73gqqB2rLx (the Volve Solutions design system page; private until shared from its Share menu).

**Source-of-truth order:** `design/tokens/volve.tokens.json` (exact values) > this file (rules) > `design/prompts/` (agent and image instructions) > examples.

---

## 1. The idea in one line

**Premium, plain-spoken, on the tradie's side.**

We look like a firm that charges serious money and talk like a mate who has run a business. Apple-level restraint in the design, pub-table honesty in the words. Every asset should make a busy tradie stop scrolling, feel understood in one line, and know exactly what to do next: call.

Three tests every asset must pass:

1. **The 2-second test.** On a phone, at arm's length, the headline and the phone number read instantly.
2. **The sparky test.** A real tradie sees nothing fake: no wrong gear, no unsafe work, no AI faces, no American details.
3. **The Apple test.** Nothing on the page that does not need to be there.

---

## 2. Brand architecture

One brand. Products are named in type, never given their own logos.

| Layer | Name | Seen by | How it appears |
|---|---|---|---|
| Company and master brand | **Volve Solutions** | Everyone | The only logo |
| Customer offer | **Business Check** (Free 12-minute Business Check) | Customers | Set in type next to or under the lockup |
| Product | **VolveRighto** (AI receptionist) | Customers | Set in type. One word, capital V and R |
| Paid builds and services | Named per build | Customers | Set in type |
| Operating system | **Volve OS** | Hugh, staff, agents | Internal only. Never on customer assets |
| Internal name for the Check | **AI Business Audit** | Internal, repo, agents | Never on customer assets |

**Why "Business Check" for customers:** plain English, no jargon, sits with "pre-start check" and "12-minute check". Tradies hear "audit" and think ATO. "AI" puts some of them off before they hear the offer.

**Naming pattern:** `Volve Solutions · Business Check`, `Volve Solutions · VolveRighto`. The product name is Inter 600 in the surface's text colour.

---

## 3. Logo

Files live in `design/logo/` (SVG, text outlined) and `design/logo/png/` (transparent PNG, 2400px wide).

**The lockup** is the V symbol (a bold V with a narrower forward stroke) plus VOLVE SOLUTIONS in Inter Bold, tracked 0.15em. Proportions are fixed by `design/scripts/build-logo.py`. Never retype or redraw it.

| Surface | File | Colours |
|---|---|---|
| Dark (espresso, photos) | `volve-lockup-on-dark.svg` | Symbol + VOLVE paper, SOLUTIONS gold |
| Light (paper, white) | `volve-lockup-on-light.svg` | Symbol + VOLVE espresso, SOLUTIONS ochre |
| Signal (gold) | `volve-lockup-on-gold.svg` | All espresso |
| One-colour jobs (embroidery, stamps, fax) | `volve-lockup-mono-*.svg` | Single colour |
| Profile pictures, app icon, favicon | `volve-avatar.svg` | Paper symbol on espresso, circle-safe |

**Clear space:** keep empty space around the lockup equal to the symbol's height.
**Minimum size:** lockup 120px wide on screen, 30mm in print. Symbol alone 20px or 6mm.
**Placement on social:** top left inside the safe margin at 36px symbol height on 4:5 and 9:16. On 1:1 it moves into the Call Bar, top right.

**Never:** recolour outside the table above, stretch, add effects or shadows, put it on a busy part of a photo, rebuild it in another font, use the slate-coloured legacy files, or give a product its own logo.

---

## 4. Colour

### The six

| Name | Hex | Role |
|---|---|---|
| **Espresso** | `#1C1410` | Primary dark surface. Primary text on light. The Call Bar. |
| **Paper** | `#F9F6F1` | Primary light surface. Primary text on dark. |
| **White** | `#FFFFFF` | Cards on paper. Print pages. |
| **Warm slate** | `#6B5E52` | Secondary text on light. Small surfaces only (card headers, chips). |
| **Ochre** | `#C47B2E` | Accent on light (24px and up only). Primary button fill. |
| **Gold** | `#E8A84A` | Accent on dark. Signal surface. Eyebrows on dark. |

**Functional only:** Alert `#A43B35` for urgent findings and errors in reports and apps. Never decoration, headings or marketing.

**Tints** (lines, quiet fills, pill backgrounds) are the six at low opacity, listed in the tokens with resolved hex for tools that cannot do transparency. They are not new colours.

### Surfaces: pick one per composition

| Mode | Background | Text | Accent | Use |
|---|---|---|---|---|
| **Dark** | Espresso | Paper | Gold | Default for social, website hero, deck covers |
| **Light** | Paper (white cards) | Espresso, slate | Ochre | Default for reports, proposals, documents, email, website body |
| **Signal** | Gold | Espresso | Espresso knockout | Loud social posts, max 1 in 4. Never reports or documents |

### Colour rules

- **One accent per composition.** One gold or ochre phrase, plus the eyebrow. That is it.
- **Proportion:** roughly 70% surface, 25% text and imagery, 5% accent.
- Slate is never a full background (it was the hero colour in v2; retired).
- Gold is never text on light (1.9:1). Slate is never text on espresso (2.9:1). Ochre is never small text on light (3.1:1).
- Status always pairs colour with a word (FIX FIRST, WATCH, ON TRACK). Never colour alone.
- **Banned:** blue, purple, violet, indigo, neon, any new hex. Decorative gradients and glows.
- The **only** gradient allowed is the photo fade into espresso (section 8).

Contrast for every approved pairing is tested by `node design/scripts/check.js`.

---

## 5. Typography

Two families. No others.

| Family | Weights | Use |
|---|---|---|
| **DM Serif Display** | 400 and 400 italic | Headlines, big numbers, the accent phrase (italic). Never body text, never under 22px |
| **Inter** | 400, 500, 600, 700, 800 | Everything else: body, eyebrows, labels, buttons, the phone number |

Fonts are bundled in `design/fonts/` (SIL Open Font License). Embed them in every PDF.

### The accent phrase

The signature move. Each headline may carry **one** accent phrase:

- **On dark:** DM Serif Display italic in gold. *"Is the money?"*
- **On light:** DM Serif Display italic in ochre. *"really"*
- **On Signal:** a knockout, gold italic on an espresso block. "as **paid.**"

### Scales

Exact values are in the tokens (`type.social-1080`, `type.screen-390`, `type.print-a4`).

| Role | Social (1080 canvas) | Phone screen (390) | A4 print |
|---|---|---|---|
| Display | Serif 168 / 0.94 | Serif 40 / 1.05 | Serif 40pt |
| Headline | Serif 104 / 1.04 | Serif 32 / 1.1 | Serif 26pt |
| Subhead | Inter 600 40 | Inter 600 19 | Inter 700 11.5pt |
| Body | Inter 500 40 / 1.3 | Inter 400 17 / 1.55 | Inter 400 10.5pt / 1.5 |
| Eyebrow | Inter 700 32, caps, +0.16em | Inter 700 12, caps, +0.14em | Inter 700 8pt, caps |
| Phone number | Inter 800 160, -0.03em | Inter 800 32 | Inter 800 24pt |

**Mobile-first floors:** nothing under 30px on a 1080 social canvas (it shows at about 0.36x on a phone). Body never under 16px on screen. Nothing under 9pt in print.

### Type rules

- Sentence case for headlines. Caps only for eyebrows, labels and stamps.
- Curly apostrophes and quotes (’ “ ”), never straight ones in headlines.
- Headlines: max 2 lines on photo posts, max 4 short lines on type-led posts. About 22 characters per line at headline size; longer lines get shrunk by the renderer, so write shorter.
- Tight leading on serif headlines, generous leading on body.
- Never fake bold, italic or small caps. Never outline text.

---

## 6. Layout and spacing

**Spacing scale (4px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Use these steps only.

**Mobile first, always.** Design at 390px wide for screens and at the phone-feed view for social, then scale up. If it does not work on a phone, it does not ship.

| Medium | Margins and safe zones |
|---|---|
| Social 4:5 (1080x1350) | 72px side margins. Lockup top left. Call Bar bottom |
| Social 1:1 (1080x1080) | 72px side margins. Lockup moves into the Call Bar |
| Social 9:16 (1080x1920) | Keep text out of the top 220px and bottom 260px (Facebook UI) |
| Screen | 20px gutter at 390, 32px at 768+. Body measure max 640px. Page max 1140px |
| A4 print | 18mm margins. Single column for reports |

**Touch targets:** 48px minimum. **Radius:** 6 (small chips), 10 (buttons), 16 (screen cards), 24 (social cards), pill. The v2 "rotating corner" rule is retired.

---

## 7. Components

### The Call Bar (signature, used on every marketing asset)

Espresso band. Top to bottom:

1. **Eyebrow:** "FREE 12-MINUTE BUSINESS CHECK", Inter 700 caps, gold.
2. **Phone number:** Inter 800, paper, the biggest thing on the page after the headline. Fitted to the margins, never wider.
3. **Footer row:** "Call any time. No contract." left, `volvesolutions.com.au` right, Inter 500, secondary text colour.

On dark posts the Call Bar sits on the same espresso (no visible band). On light and Signal posts it becomes a full-bleed espresso band. The number comes from the tokens, never typed by hand.

### Business Check card (the product as hero)

White card, 24px radius, soft shadow. Slate header with paper symbol, "BUSINESS CHECK" and a "SAMPLE" chip. Serif title ("Your top 3"). Numbered rows (espresso circles) with a status pill on the right: **FIX FIRST** (alert on alert wash) or **WATCH** (espresso on gold wash, gold dot). Footer: Hugh's photo and "Reviewed personally by Hugh." The real web report must look like this card, so an ad and the report feel like the same thing.

### Paper card with stamps (paper props)

A paper-coloured sheet, tilted about 1 degree, with a heavy rule under a caps title. Rows of real paperwork (title + small grey detail) with a rubber stamp on the right: ochre outline stamps (UNCHASED, NOT INVOICED, STILL WAITING) and one espresso stamp for the punchline (ONLY YOU). Stamps tilt between -4 and +4 degrees.

### Photo band

Full bleed, between the headline and the Call Bar. Fades into espresso over the top and bottom 16%. See section 8 for what goes in it.

### Buttons (screen)

- **Primary:** ochre fill, paper text, Inter 700 19px (paper on ochre is 3.1:1, which passes only as large text, so never smaller), 10px radius, full width on phones, phone icon left. **One per screen.** Label says what happens: "Call 02 5700 0037", never "Learn more".
- **Secondary:** transparent, 1.5px line in the surface's line colour, same size.

### Eyebrow

Small caps label above a headline that sets context ("BUSINESS CHECK", "WHAT WE FOUND"). Gold on dark, slate on light, espresso on Signal.

---

## 8. Photography and imagery

### The look

**Warm, low, single light source.** Golden hour, last light, or a desk lamp at night. Deep shadows that fall into espresso. Grain is fine, gloss is not. The mood is the quiet moment after the job, when the business side catches up with you.

**Content:** real Australian trade life. Utes, tailgates, tool bags, worn boots, clipboards, paperwork, phones, stubby holders, switchboards, split systems, timber frames, skip bins, brick veneer homes, gum trees.

### The rules

1. **No clear AI faces.** People appear from behind, in silhouette, cropped at the neck, or as hands only. Real faces come only from real photography.
2. **Australian and correct.** Australian coins (silver 5c to 50c, gold $1 and $2; no copper), right-hand-drive utes, Australian power points and switchboards, correct wiring colours, correct PPE for the task. A sparky must not see unsafe work.
3. **No readable fake text** in AI images. Paperwork is blurred or angled away. All words come from the templates.
4. **Grade warm.** Pull hi-vis orange, blue sky and navy workwear toward ochre and gold. Lift blacks to espresso, not pure black.
5. **No flat daylight, no blue skies, no stock smiles, no thumbs up, no handshakes.**
6. **One story per image.** Two or three objects, one idea.

Full prompts, a scene library and a checklist live in `design/prompts/image-direction.md`.

### Real shoot (when booked)

Half day, one location with a ute and one workshop or kitchen table, at golden hour. Shot list: Hugh on the phone at a tailgate; Hugh and a tradie looking at the report on a phone; hands holding the phone showing the Business Check; Hugh portrait (dark background, warm side light) for the report footer and website; details (boots, clipboard, tool bag, phone on tray). Shoot horizontal and vertical of every setup.

---

## 9. Voice and copy

Write the way Hugh talks: direct, warm, plain Australian English.

**Headline formula (the signature):** line one states a trade truth, line two turns it into a business question or sting, in the accent.

- "Testing every circuit. *Who's testing the business?*"
- "The work's done. *Is the money?*"
- "Booked solid till Christmas. *Still waiting to get paid.*"

**Rules:**

- Short sentences. Active voice. Second person ("your quotes", "you").
- Talk about money, time and evenings, not "AI", "automation" or "digital transformation".
- One idea per post. One call to action: call the number.
- Numbers as numerals (12 minutes, 3 weeks).
- **Never use em dashes.** Rewrite the sentence.
- **Banned words:** delve, crucial, leverage, utilise, streamline, unlock, empower, seamless, game-changer, revolutionise, synergy, "dive into", "touch base", "circle back", "Learn more".
- Australian spelling (colour, organise, cheque).
- Seasonal hooks are welcome (EOFY, Christmas shutdown, new year, wet season).

---

## 10. Formats by channel

| Channel | Format | Surface | Status |
|---|---|---|---|
| Facebook feed | 4:5 (1080x1350) default, 1:1 when needed | Dark mostly, Light for product posts, Signal max 1 in 4, Site max 1 in 6 | Live: `design/templates/social/` |
| Facebook Stories and Reels covers | 9:16 (1080x1920) | Same | Live |
| Business Check report (web) | Phone-first page, 390 base | Light, dark header | Phase 2 |
| Business Check report (print) | A4 PDF, attached to the email | Light | Phase 2 |
| Proposals and offers | A4 PDF | Light, dark cover | Phase 2 |
| Website | Responsive, 390 base | Dark hero, Light body, espresso footer | Phase 3 |
| Email | 600px single column, system fonts fall back to Arial | Light | Phase 3 |
| Flyers | A5 and A4 | Dark or Light | Phase 3 |
| Pitch decks | 16:9 | Dark covers, Light content | Phase 3 |

**The "Site" campaign style** (hazard stripes, pre-start card) is a deliberate tradie nod. Social only, max 1 in 6 posts, 4:5 only. Never reports, proposals or the website.

---

## 11. Pre-publish checklist

- [ ] One surface mode. One accent phrase. Six colours only.
- [ ] Lockup is the right file for the surface, in the right slot.
- [ ] Headline reads in 2 seconds on a phone. Phone number is current (from the tokens).
- [ ] Nothing under the size floors (30px social, 16px screen body, 9pt print).
- [ ] Imagery passes the sparky test: no AI faces, Australian details, safe work, warm grade, no fake text.
- [ ] No em dashes, no banned words, Australian spelling.
- [ ] `node design/scripts/check.js` passes for any template or code you changed.

---

## 12. Contact facts

Held in the tokens (`contact.*`) so a change is one edit.

- **Business Check line:** 02 5700 0037 today. From about 10 November 2026 it becomes **1300 244 769** (Twilio port), and 02 5700 0037 moves to VolveRighto. Update the tokens and re-render.
- **Web:** volvesolutions.com.au · **Email:** hello@volvesolutions.com.au · **ABN:** 60 928 990 855

---

## Changelog

- **3.0 (29 Oct 2026):** Rebuilt from the approved Facebook posts. Six-colour palette (deep ochre, canvas-soft, pale ochre and the grey text colours retired). Slate retired as a background. DM Serif Display allowed in reports at headline level. Three surface modes. Call Bar, Business Check card and paper card defined. Photography rules. "Business Check" is the customer name. Tokens, outlined logo lockups, social templates and the QA script added.
- **2.1 (Sep 2026):** Website-only system (kept in git history).
