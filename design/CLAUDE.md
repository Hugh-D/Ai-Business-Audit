# Volve Solutions design system

v3.0 lives in `design/BRAND.md` (rules) and `design/tokens/volve.tokens.json` (values). Read BRAND.md before any visual or customer-facing work.

v2.1 (the website-only system with slate heroes and the rotating-corner cards) is retired. It is in git history if needed. The live website still uses some v2.1 styling until the Phase 3 migration onto the tokens.

## Folder map

| Path | What |
|---|---|
| `BRAND.md` | The brand book |
| `tokens/` | `volve.tokens.json` (source) and generated `volve.css` |
| `fonts/` | DM Serif Display and Inter (SIL OFL) |
| `logo/` | Outlined SVG lockups, symbols, avatar. `png/` exports |
| `templates/social/` | Facebook post templates and renderer |
| `prompts/` | Image direction pack and the agent instruction block for GrokBot, ChatGPT and Claude |
| `reference/` | The October 2026 posts graded benchmark or avoid, plus photo crops |
| `examples/social/` | Posts rendered from the templates |
| `scripts/` | `build-tokens.js`, `build-logo.py`, `check.js` (brand QA) |
| `Hero.dc.html`, `README.md` | Earlier website hero handoff (v2.1 era) |
