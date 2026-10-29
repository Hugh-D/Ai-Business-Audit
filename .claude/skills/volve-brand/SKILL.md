---
name: volve-brand
description: Volve Solutions brand system. Use for ANY visual or customer-facing work for Volve Solutions, the Business Check, VolveRighto or the AI Business Audit: Facebook posts, reports (web or PDF), proposals, website pages, emails, flyers, decks, logos, colours, fonts, image prompts, or checking an asset is on brand.
---

# Volve brand

Read `design/BRAND.md` before producing anything. It is the rulebook. Exact values live in `design/tokens/volve.tokens.json`.

## Fast facts

- Six colours only: Espresso `#1C1410`, Paper `#F9F6F1`, White `#FFFFFF`, Warm slate `#6B5E52`, Ochre `#C47B2E`, Gold `#E8A84A`. Alert `#A43B35` is functional (reports only).
- Two fonts: DM Serif Display (headlines, one italic accent phrase) and Inter (everything else). Files in `design/fonts/`.
- Three surfaces: Dark (social default), Light (documents default), Signal (gold, max 1 in 4 posts).
- Customer name: **Business Check**. Never show "Volve OS" or "AI Business Audit" to customers.
- Mobile first. Design at 390px or the phone feed first.
- No em dashes in any copy.

## What to use

| Job | Use |
|---|---|
| CSS for any page | `@import` or link `design/tokens/volve.css` and use the variables. Never hard-code hex |
| Logo | `design/logo/*.svg` (outlined) or `design/logo/png/`. Never retype the wordmark |
| Facebook post | Write a spec in `design/templates/social/posts/`, then `node design/templates/social/render.js <spec>`. See that folder's README |
| AI image | `design/prompts/image-direction.md`: photo only, no text, then render through a template |
| What good looks like | `design/reference/README.md` and `design/examples/social/` |
| Phone number change | Edit `contact.*` in the tokens, run `node design/scripts/build-tokens.js`, re-render |

## Before you call it done

1. Run `node design/scripts/check.js <files you changed>`: contrast and palette must pass.
2. Render or screenshot the result at phone size and look at it.
3. Walk the pre-publish checklist in `design/BRAND.md` section 11.
