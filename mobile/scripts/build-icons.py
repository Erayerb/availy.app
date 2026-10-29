"""Builds the app's icon fonts from Tabler (assets/fonts/source, from @tabler/icons-webfont 3.50, MIT).

Only the icons the app uses go in, each at its own Tabler number (a few above U+FFFF are moved down to
U+E000 + n), so a number never changes between builds: the original font is 1.8 MB, has a damaged
"post" table characters above U+FFFF and the same internal name as the filled font, and iPhones refuse to load it
(icons show as "?").
Run after using a new icon name:  python3 scripts/build-icons.py  (needs: pip install fonttools)
"""
import json
import pathlib
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/fonts/source"
# Any quoted word in the code that is an icon name (a few extra icons do no harm)
WORD = re.compile(r"""['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]""")
code = "\n".join(p.read_text() for p in [*ROOT.glob("src/**/*.ts"), *ROOT.glob("src/**/*.tsx"), ROOT / "App.tsx"])
words = set(WORD.findall(code))

for name in ("tabler-icons", "tabler-icons-filled"):
    glyphs = json.loads((SOURCE / f"{name}.json").read_text())
    used = sorted(words & glyphs.keys())
    font = TTFont(SOURCE / f"{name}.ttf")
    cmap = font.getBestCmap()
    glyph_names = {n: cmap[glyphs[n]] for n in used}
    options = subset.Options()
    options.glyph_names = False
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(glyphs=list(glyph_names.values()))
    sub.subset(font)
    # Tabler's own numbers (stable between builds); the few above the Basic plane moved into U+E000–U+E3FF
    numbers = {n: glyphs[n] if glyphs[n] <= 0xFFFF else 0xE000 + glyphs[n] - 0x10000 for n in used}
    for table in font["cmap"].tables:
        table.cmap = {numbers[n]: glyph_names[n] for n in used} if table.isUnicode() else {}
    font["post"].formatType = 3.0
    # The same line box everywhere (iOS and Android read different tables), so icons sit in the middle
    hhea, os2 = font["hhea"], font["OS/2"]
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = hhea.ascent, hhea.descent, 0
    os2.usWinAscent, os2.usWinDescent = hhea.ascent, -hhea.descent
    hhea.lineGap = 0
    os2.fsSelection |= 1 << 7  # USE_TYPO_METRICS
    # Each font its own name: iPhones load one font per name, so two "tabler-icons" would clash
    # ("availy-icons": a new name, so phones do not keep the earlier renumbered font)
    family = name.replace("tabler-icons", "availy-icons")
    for record in font["name"].names:
        if record.nameID in (1, 3, 4, 6, 16):
            record.string = family
    font.save(ROOT / f"assets/fonts/{name}.ttf")
    (ROOT / f"src/lib/{'tablerFilledGlyphs' if 'filled' in name else 'tablerGlyphs'}.json").write_text(
        json.dumps(numbers, separators=(",", ":"), sort_keys=True)
    )
    print(name, len(used), "icons")
