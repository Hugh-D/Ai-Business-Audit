# Social templates

Facebook posts rendered from a small JSON spec. The templates own the layout, logo, colours and the Call Bar, so every post comes out on brand.

## Render

```bash
node design/templates/social/render.js design/templates/social/posts/knocked-off-at-5.json
node design/templates/social/render.js --all
```

PNGs land in `design/templates/social/out/` (ignored by git). Add `--out <dir>` to send them elsewhere. A `WARN` line means the content overflows the canvas: shorten the copy, never squeeze the type.

When a phone number changes, edit `design/tokens/volve.tokens.json` and run `--all` again. Every post updates.

## Spec

```json
{
  "id": "knocked-off-at-5",
  "layout": "photo",
  "formats": ["4x5", "1x1", "9x16"],
  "headline": ["Knocked off at 5.", "Still working at 9."],
  "image": "design/reference/images/lamp-desk.jpg"
}
```

| Field | Values | Notes |
|---|---|---|
| `id` | kebab-case | File name prefix |
| `layout` | `photo`, `type`, `signal`, `site` | See below |
| `surface` | `dark` (default), `light` | `type` layout only |
| `formats` | `4x5`, `1x1`, `9x16` | 4x5 is the default. Card layouts and `site` skip 1x1 |
| `headline` | array of lines | `*words*` = italic accent (gold on dark, ochre on light). `[words]` = knockout block (Signal) |
| `size` | `medium`, `headline`, `large`, `display` | Optional override. Lines that would break the margin shrink automatically |
| `body` | string | Optional supporting line on `type` and `signal` |
| `image` | repo-relative path | `photo` layout |
| `card` | object | `type` layout: `paper` or `check` card (see `posts/the-works-done.json`, `posts/hows-the-business.json`) |
| `eyebrow`, `footer` | string | Optional overrides. Default to the tokens |
| `phone` | `business-check` (default), `volverighto` | Which number the Call Bar shows |

## Layouts

| Layout | Look | When |
|---|---|---|
| `photo` | Lockup, serif headline, photo band fading into espresso, Call Bar | The workhorse. Most posts |
| `type` + `card` | Headline over a paper card with stamps (dark) or a Business Check card (light) | Showing the problem or the product |
| `type` | Big headline only | Bold statements |
| `signal` | Gold surface, espresso headline, knockout accent, banded Call Bar | Max 1 in 4 posts |
| `site` | Hazard stripes, pre-start check card | Max 1 in 6 posts. 4x5 only |

Rules for copy and imagery: `design/BRAND.md`. Image prompts: `design/prompts/image-direction.md`.
