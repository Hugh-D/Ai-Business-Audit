#!/usr/bin/env python3
"""Builds the Volve Solutions logo files in design/logo/ with the wordmark outlined.

Proportions are measured from the approved Facebook posts (Oct 2026):
  symbol height = 1.64 x cap height, gap = 0.58 x cap height, tracking = 0.15em, Inter Bold.
Run: python3 design/scripts/build-logo.py   (needs: pip install fonttools)
"""
import json
import os

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)
OUT = os.path.join(ROOT, 'logo')
FONT = os.path.join(REPO, 'ai-audit-system', 'assets', 'fonts', 'Inter-Bold.ttf')

tokens = json.load(open(os.path.join(ROOT, 'tokens', 'volve.tokens.json')))
C = {k: v['$value'] for k, v in tokens['color'].items() if isinstance(v, dict) and '$value' in v}

# The symbol: a bold V with a narrower forward stroke (viewBox 749 x 604).
SYMBOL_PATHS = [
    'M0 0H140L295 350L430 60C442 25 470 0 505 0H575L325 604C293 604 269 580 259 550L0 0Z',
    'M395 604H439C471 604 495 580 505 550L749 0H705C673 0 649 24 639 54L395 604Z',
]
SYM_W, SYM_H = 749, 604

font = TTFont(FONT)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font['hmtx']
UPM = font['head'].unitsPerEm
CAP = font['OS/2'].sCapHeight
TRACK = 0.15 * UPM


def word_path(text, x0, baseline):
    """Outline a word at font-unit scale; returns (path_d, advance_end_x)."""
    pen = SVGPathPen(glyphs, ntos=lambda n: ('%.1f' % n).rstrip('0').rstrip('.'))
    x = x0
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, baseline)))
        x += hmtx[name][0] + (TRACK if i < len(text) - 1 else 0)
    return pen.getCommands(), x


def symbol_group(fill, scale, tx, ty):
    paths = ''.join(f'<path d="{d}"/>' for d in SYMBOL_PATHS)
    return f'<g fill="{fill}" transform="translate({tx:.1f} {ty:.1f}) scale({scale:.4f})">{paths}</g>'


def lockup(symbol_fill, volve_fill, solutions_fill):
    sym_h = 1.64 * CAP
    scale = sym_h / SYM_H
    sym_w = SYM_W * scale
    gap = 0.58 * CAP
    top_pad = (sym_h - CAP) / 2           # cap-height band is centred on the symbol
    baseline = top_pad + CAP
    volve_d, x = word_path('VOLVE', sym_w + gap, baseline)
    space = hmtx[cmap[ord(' ')]][0] + 2 * TRACK
    sol_d, x_end = word_path('SOLUTIONS', x + space, baseline)
    w, h = x_end, sym_h
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="Volve Solutions">'
        f'{symbol_group(symbol_fill, scale, 0, 0)}'
        f'<path fill="{volve_fill}" d="{volve_d}"/>'
        f'<path fill="{solutions_fill}" d="{sol_d}"/>'
        '</svg>\n'
    )


def symbol(fill):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SYM_W} {SYM_H}" role="img" aria-label="Volve Solutions">'
        f'{symbol_group(fill, 1, 0, 0)}</svg>\n'
    )


def avatar():
    """Facebook profile / app icon. Symbol sits inside the circle crop with room to breathe."""
    size = 1000
    sym_w = 520
    scale = sym_w / SYM_W
    sym_h = SYM_H * scale
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="Volve Solutions">'
        f'<rect width="{size}" height="{size}" fill="{C["espresso"]}"/>'
        f'{symbol_group(C["paper"], scale, (size - sym_w) / 2, (size - sym_h) / 2 + 12)}'
        '</svg>\n'
    )


FILES = {
    'volve-lockup-on-dark.svg': lockup(C['paper'], C['paper'], C['gold']),
    'volve-lockup-on-light.svg': lockup(C['espresso'], C['espresso'], C['ochre']),
    'volve-lockup-on-gold.svg': lockup(C['espresso'], C['espresso'], C['espresso']),
    'volve-lockup-mono-espresso.svg': lockup(C['espresso'], C['espresso'], C['espresso']),
    'volve-lockup-mono-paper.svg': lockup(C['paper'], C['paper'], C['paper']),
    'volve-symbol-espresso.svg': symbol(C['espresso']),
    'volve-symbol-paper.svg': symbol(C['paper']),
    'volve-symbol-gold.svg': symbol(C['gold']),
    'volve-avatar.svg': avatar(),
}

os.makedirs(OUT, exist_ok=True)
for name, svg in FILES.items():
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(svg)
    print('wrote', name, f'{len(svg) // 1024 or 1}KB')
