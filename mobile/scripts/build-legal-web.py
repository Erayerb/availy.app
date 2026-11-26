"""Builds the website's legal pages (mobile/public/tanitim/gizlilik.html and kosullar.html) from the drafts in
docs/hukuk/, so the site, the app (build-legal.py) and the lawyer's copy say the same. Run from the repo root:
  python3 mobile/scripts/build-legal-web.py
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = ROOT / "mobile/public/tanitim"
PAGES = [
    ("gizlilik", "Gizlilik Politikası ve Aydınlatma Metni", "docs/hukuk/gizlilik-politikasi.md"),
    ("kosullar", "Kullanım Koşulları", "docs/hukuk/kullanim-kosullari.md"),
]


def inline(text: str) -> str:
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\s*\[Hukukçu:[^\]]+\]", "", text)  # notes for the lawyer stay out of the public page
    return text


def body(markdown: str) -> str:
    out, lines, i, open_list = [], markdown.split("\n"), 0, None

    def close():
        nonlocal open_list
        if open_list:
            out.append(f"</{open_list}>")
            open_list = None

    while i < len(lines):
        line = lines[i]
        if line.startswith("# ") or line.startswith("**Taslak sürüm"):
            i += 1
            continue
        m = re.match(r"^(#{2,3}) (.+)$", line)
        if m:
            close()
            level = len(m.group(1))
            out.append(f"<h{level}>{inline(m.group(2))}</h{level}>")
        elif line.strip() == "---":
            close()
            out.append("<hr>")
        elif line.startswith("|"):
            close()
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                if not re.match(r"^\|[-| ]+\|$", lines[i]):
                    rows.append([c.strip() for c in lines[i].strip("|").split("|")])
                i += 1
            head = "".join(f"<th>{inline(c)}</th>" for c in rows[0])
            rest = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows[1:])
            out.append(f'<div class="legal-table"><table><thead><tr>{head}</tr></thead><tbody>{rest}</tbody></table></div>')
            continue
        elif re.match(r"^\s*[-*] ", line):
            if open_list != "ul":
                close()
                out.append("<ul>")
                open_list = "ul"
            item = re.sub(r"^\s*[-*] ", "", line)
            out.append(f"<li>{inline(item)}</li>")
        elif line.strip():
            close()
            out.append(f"<p>{inline(line)}</p>")
        else:
            close()
        i += 1
    close()
    return "\n".join(out)


def page(slug: str, title: str, content: str) -> str:
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>availo · {title}</title>
<meta name="description" content="availo {title}">
<link rel="canonical" href="https://erayerb.github.io/availy.app/v2/tanitim/{slug}.html">
<meta name="theme-color" content="#17110E">
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="styles.css">
<style>
  .legal {{ max-width: 760px; }}
  .legal h1 {{ font-size: 34px; }}
  .legal h2 {{ font-size: 22px; margin-top: 30px; }}
  .legal h3 {{ font-size: 18px; margin-top: 20px; }}
  .legal p, .legal li {{ line-height: 1.6; }}
  .legal-draft {{ border: 2px solid var(--primary); border-radius: 12px; padding: 12px 14px; margin: 16px 0 6px; }}
  .legal-table {{ overflow-x: auto; margin: 12px 0; }}
  .legal-table table {{ border-collapse: collapse; width: 100%; font-size: 15px; }}
  .legal-table th, .legal-table td {{ text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--border); }}
</style>
</head>
<body>
<div class="wrap legal">
  <header><a class="logo" href="index.html"><svg class="mark" viewBox="0 17 100 70" aria-hidden="true"><path d="M18 78 L35.19 35.95 A16 16 0 0 1 64.81 35.95 L82 78"/><circle cx="50" cy="60" r="8"/></svg>Availo</a></header>
  <section>
    <h1>{title}</h1>
    <p class="legal-draft"><strong>Taslak.</strong> Bu metin hukuk incelemesi sürerken yayınlanan taslaktır; köşeli parantez içindeki bilgiler doldurulacaktır.</p>
{content}
    <p style="margin-top:30px"><a class="cta secondary" href="index.html">Ana sayfaya dön</a></p>
  </section>
</div>
</body>
</html>
"""


for slug, title, source in PAGES:
    (SITE / f"{slug}.html").write_text(page(slug, title, body((ROOT / source).read_text(encoding="utf-8"))), encoding="utf-8")
    print(f"{slug}.html")
