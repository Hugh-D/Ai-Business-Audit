# Volve Solutions — Design System
# CLAUDE.md v2.0 | June 2026
# For use in Claude Design project only.

---

## PALETTE

Five working colours. Do not introduce new colours.

```
ink:          #1C1410   Espresso. Primary text. Dark card surfaces. Footer bands.
slate:        #6B5E52   Slate. Hero background. Primary dark surface.
canvas:       #F9F6F1   Parchment. Primary body background. Light card base.
canvas-soft:  #F2EDE5   Warm off-white. Section bands. Card backgrounds.

accent:       #C47B2E   Ochre. Primary CTA only. One per page maximum.
accent-light: #E8A84A   Warm gold. Accent text on dark surfaces. Eyebrow on slate.
accent-bg:    #FDF4E7   Pale ochre. Tag backgrounds. Fix block backgrounds.

text-body:    #6B5E52   Body text on light surfaces.
text-secondary:#8A7D72  Captions, labels, meta.
text-muted:   #A89880   Proof points on dark surfaces. Placeholders.
text-on-dark: #DDD5C8   Body text on slate or espresso surfaces.

border:       #DDD5C8   Card borders. Input borders. Dividers.
dark-label:   #A89880   De-emphasised labels on espresso surfaces (WCAG AA on #1C1410). Do not use #6B5E52 for text on espresso — it fails contrast.
```

---

## TYPOGRAPHY

Inter only. No serif mixing. No display font experiments.

```
Hero headline:    Inter 700 / 28px mobile / 34-40px desktop / -0.5px tracking / 1.15 line-height
Section heading:  Inter 700 / 24px mobile / 28px desktop / -0.3px tracking / 1.2 line-height
Subheading:       Inter 600 / 18px / 1.35 line-height
Eyebrow:          Inter 700 / 11px / uppercase / 0.1em tracking
                  Gold (#E8A84A) on slate. Ochre-brown (#7A4F1E) on canvas.
Body large:       Inter 400 / 16px / 1.6 line-height
Body default:     Inter 400 / 14px / 1.55 line-height
Caption / label:  Inter 700 / 10px / uppercase / 0.07em tracking
Button large:     Inter 700 / 16px (mobile full-width call button)
Button default:   Inter 600 / 14px
Button small:     Inter 600 / 13px / 0.02em tracking
```

---

## SPACING

```
sm:  8px  |  md: 12px  |  lg: 16px  |  xl: 24px
2xl: 32px |  3xl: 48px |  4xl: 64px |  5xl: 96px
Section spacing: 80px desktop / 48px mobile
Container padding: 20px mobile / 28px desktop
```

---

## BORDER RADIUS

```
sm: 6px  |  md: 8px  |  lg: 12px  |  xl: 16px  |  pill: 9999px
Report card: 14px
Mobile button: 14px

Card rhythm rule:
Rotate a single large corner (28px) clockwise across cards in a group.
Top-left: 28px 8px 8px 8px
Top-right: 8px 28px 8px 8px
Bottom-left: 8px 8px 8px 28px
Bottom-right: 8px 8px 28px 8px
Uniform: 8px
```

---

## LAYOUT

```
Max width: 1140px centred
Content width: 720px
Mobile-first: design for 390px, scale up to 768px, then 1140px
Card gap: 10px
Grid gap: 24px
```

---

## COMPONENTS

### Nav — Mobile
- Background: slate (#6B5E52)
- Logo: parchment (#F9F6F1) / 15px / 700
- Hamburger: dust (#DDD5C8) lines
- Padding: 8px 20px 14px

### Nav — Desktop
- Background: slate (#6B5E52)
- Links: 13px / dust (#DDD5C8)
- CTA pill: transparent / parchment text / 1px muted border / pill radius

### Button — Call (mobile primary)
- Background: ochre (#C47B2E)
- Text: pale ochre (#FDF4E7) / 16px / 700
- Width: 100% on mobile
- Radius: 14px
- Padding: 16px 20px
- Phone icon left of text
- href="tel:1300244769"
- One per page. This is the only ochre element.

### Button — Ghost (secondary on dark)
- Background: transparent
- Text: dust (#DDD5C8) / 14px / 600
- Border: 2px / text-secondary (#8A7D72)
- Width: 100% on mobile
- Radius: 14px
- Padding: 13px 20px

### Button — Pill (desktop secondary)
- Background: transparent
- Text: parchment / 13px / 600
- Border: 1px muted (#A89880)
- Radius: pill

### Proof Row
- 5px ochre circle dot
- Text: 12px / muted (#A89880)
- Gap: 8px
- Margin bottom: 7px

### Report Card (hero sample)
Structure: header (espresso) / body (white) / footer (espresso)

Header:
- Background: espresso (#1C1410)
- Left: label 9px/700/uppercase/dark-label (#A89880), title 12px/700/parchment
- Right: impact label 9px/dark-label (#A89880), impact value 14px/700/gold (#E8A84A)

Leak item:
- Background: parchment (#F9F6F1)
- Border: 0.5px dust / 8px radius / 10px 11px padding
- Number badge: 18px ochre circle / parchment number / 9px 700
- Title: 11px / 700 / espresso
- Tag: 9px/700/ochre on accent-bg / pill / 0.5px accent-light border
- Description: 11px / text-body / 1.5 line-height
- Fix block: canvas-soft bg / 6px radius / "Fix" label in #7A4F1E / 10px espresso text

Third leak: 40% opacity. Number badge in dust. Lines as placeholders. Always faded — never show all three.

Footer:
- Background: espresso (#1C1410)
- Left: "Reviewed by Hugh within 48 hrs" — 10px/dark-label (#A89880), Hugh in gold
- Right: "Get yours" + 22px ochre arrow circle

### Service Cards (three column)
- Background: white
- Border: 0.5px dust
- Padding: 24px 20px
- Rotate card-rhythm corner per card (card 1 top-left, card 2 uniform, card 3 top-right)
- Stack to single column on mobile

Icon wrap: 44px / 12px radius / variant colours:
- Audit: accent-bg background / ochre icon
- Automations: canvas-soft background / text-body icon
- Support: espresso background / gold icon

Icon circle: 18px / bottom-right / -4px offset / matches variant colour

Tag variants:
- "Start here": accent-bg / #7A4F1E text
- "Do the work": canvas-soft / espresso text
- "Ongoing": espresso / dust text

Card footer: 0.5px dust border top / price 12px/600/espresso / 26px espresso arrow circle

---

## PAGE STRUCTURE

Mobile section order:
1. Nav (slate, hamburger)
2. Hero (slate)
3. Report card section (parchment)
4. Services section (parchment)
5. How it works (canvas-soft)
6. Before / After (parchment)
7. About Hugh (slate)
8. Pricing (parchment)
9. Final CTA band (espresso)
10. Footer (espresso)

### Hero — Mobile
Surface: slate (#6B5E52)
1. Eyebrow: "AI Business Audit" — gold (#E8A84A)
2. Headline: "In 12 minutes, we'll tell you exactly where your business is leaking money."
   "leaking money" in gold (#E8A84A)
3. Subheading: dust (#DDD5C8) / 14px / max 2 lines
4. Call button (full width, ochre, tap-to-call)
5. Ghost button (full width, "See how it works")
6. Proof points: "$299 flat fee, no surprises" / "12 minutes by phone" / "Personal callback included"

### Hero — Desktop
Two column: 58% left (headline, CTA, proof) / 42% right (report card)
Report card is supporting evidence — not co-headline. Scale down accordingly.

---

## DESIGN RULES

Do:
- Mobile-first always. 390px base.
- Slate hero. Parchment body. Espresso footer and dark callouts.
- Single ochre CTA per page — the call button only.
- Rotate card corner radii for rhythm across card groups.
- Report card fades third leak — always. Never show all three.
- Inter throughout.
- Eyebrow labels set context above every headline.
- Touch targets minimum 44px on mobile.
- White space over decoration.

Do not:
- No purple, violet, indigo, or blue — AI slop zone.
- No gradients or glow effects anywhere.
- No decorative illustrations or icon clusters.
- No em-dashes in any copy.
- No "Learn more" as CTA text.
- Do not show all three report leaks — always fade the third.
- Do not mix card surface styles in the same row.
- No light-grey on white — check contrast.
