"""Puts the website's fonts and icons in the site's own folder (mobile/public/tanitim/assets), so visitors' browsers
do not contact Google Fonts or jsDelivr (their IP address would go there). Run again after using a new icon
(`ti ti-…`) on a page, with a Python that has fontTools and brotli (the icon venv from build-icons.py):
  <venv>/bin/python mobile/scripts/build-site-assets.py
It downloads Figtree and Tinos (SIL Open Font License, Latin + Turkish letters) and the Tabler icons webfont
(MIT), keeps only the icons the pages use, writes assets/site.css and the licence files, and points every page
at it.
"""
import io
import pathlib
import re
import urllib.request

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "public/tanitim"
ASSETS = SITE / "assets"
TABLER = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.50.0"
GOOGLE_CSS = "https://fonts.googleapis.com/css2?family=Tinos:wght@400;700&family=Figtree:wght@400;500;600;700&display=swap"
# Google answers a modern browser with woff2 files split by alphabet
BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
SUBSETS = ("latin", "latin-ext")  # latin-ext has ğ ş ı İ


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": BROWSER}), timeout=60) as response:
        return response.read()


def fonts() -> str:
    css = get(GOOGLE_CSS).decode()
    out, saved = [], {}
    # Each block: /* latin */ @font-face { … url(…) … }
    for subset, block in re.findall(r"/\* ([a-z-]+) \*/\s*(@font-face \{.*?\})", css, re.S):
        if subset not in SUBSETS:
            continue
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        weight = re.search(r"font-weight: (\d+)", block).group(1)
        url = re.search(r"url\((https://[^)]+)\)", block).group(1)
        # Figtree is one variable font for every weight: one file, used by each weight's rule
        if url not in saved:
            saved[url] = f"{family.lower()}-{weight}-{subset}.woff2"
            (ASSETS / saved[url]).write_bytes(get(url))
        name = saved[url]
        out.append(block.replace(url, name))
    if len(out) < 4:
        raise SystemExit("Google Fonts answered unexpectedly; nothing written")
    return "\n".join(out)


def icons() -> str:
    used = sorted(set(re.findall(r'class="ti (ti-[a-z0-9-]+)', "".join(p.read_text() for p in SITE.glob("*.html")))))
    css = get(f"{TABLER}/dist/tabler-icons.min.css").decode()
    codes = {}
    for name in used:
        m = re.search(r"\." + re.escape(name) + r':before\{content:"\\([0-9a-f]+)"\}', css)
        if not m:
            raise SystemExit(f"Unknown icon: {name}")
        codes[name] = int(m.group(1), 16)
    font = TTFont(io.BytesIO(get(f"{TABLER}/dist/fonts/tabler-icons.woff2")))
    options = Options()
    options.flavor = "woff2"
    options.layout_features = []
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=codes.values())
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(ASSETS / "tabler-icons.woff2")
    rules = "".join(f'.{name}:before{{content:"\\{code:x}"}}' for name, code in codes.items())
    return (
        '@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;font-display:block;'
        'src:url("tabler-icons.woff2") format("woff2")}\n'
        '.ti{font-family:"tabler-icons"!important;speak:none;font-style:normal;font-weight:normal;font-variant:normal;'
        "text-transform:none;line-height:1;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}\n"
        + rules
        + "\n"
    ), len(codes)


def point_pages_here() -> None:
    for page in SITE.glob("*.html"):
        html = page.read_text()
        html = re.sub(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"( crossorigin)?>\n', "", html)
        html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2[^"]*" rel="stylesheet">\n', "", html)
        html = re.sub(r'<link rel="stylesheet" href="https://cdn\.jsdelivr\.net/npm/@tabler/icons-webfont[^"]*">\n', "", html)
        if 'href="assets/site.css"' not in html:
            html = html.replace('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="assets/site.css">\n<link rel="stylesheet" href="styles.css">')
        page.write_text(html)


ASSETS.mkdir(exist_ok=True)
for old in ASSETS.glob("*.woff2"):
    old.unlink()
icon_css, icon_count = icons()
(ASSETS / "site.css").write_text("/* Built by mobile/scripts/build-site-assets.py; licences in this folder */\n" + fonts() + "\n" + icon_css)
# The licences go with the files (OFL and MIT ask for it)
fonts_dir = ROOT / "node_modules/@expo-google-fonts"
(ASSETS / "LICENSE-fonts.txt").write_text(
    "Figtree\n" + (fonts_dir / "figtree/LICENSE_FONT").read_text() + "\n\nTinos\n" + (fonts_dir / "tinos/LICENSE_FONT").read_text()
)
(ASSETS / "LICENSE-tabler-icons.txt").write_text((ROOT / "assets/fonts/tabler-icons.LICENSE").read_text())
point_pages_here()
print(f"{icon_count} icons, fonts and site.css written to {ASSETS.relative_to(ROOT)}")
