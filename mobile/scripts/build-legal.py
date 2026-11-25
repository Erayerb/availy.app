"""Builds mobile/src/lib/legal.ts (the in-app Gizlilik politikası and Kullanım koşulları) from the drafts in
docs/hukuk/. Run from the repo root after editing them:
  python3 mobile/scripts/build-legal.py docs/hukuk/gizlilik-politikasi.md docs/hukuk/kullanim-kosullari.md > mobile/src/lib/legal.ts
"""
import json, re, sys
def clean(t): return re.sub(r"\*\*(.+?)\*\*", r"\1", t).strip()
def parse(path, level):
    """Sections at heading `level` (## or ###); the text under them as paragraphs."""
    sections=[]; cur=None; in_table=False
    for line in open(path, encoding='utf-8').read().split('\n'):
        was_table, in_table = in_table, line.startswith('|')
        if line.startswith('# ') or line.startswith('**Taslak') or line.startswith('**Yürürlük') or line.strip()=='---':
            continue
        m=re.match(r'^(#{2,3}) (.+)$', line)
        if m:
            depth=len(m.group(1))
            if depth==level:
                cur={'title': clean(m.group(2)), 'paragraphs': []}; sections.append(cur)
            elif depth<level:
                cur=None  # a part title (BÖLÜM B …): carried by the sections under it
            else:
                if cur is not None: cur['paragraphs'].append(clean(m.group(2))+':')
            continue
        if cur is None or not line.strip(): continue
        if re.match(r'^\|[-| ]+\|$', line): continue
        if line.startswith('|'):
            cells=[clean(c) for c in line.strip('|').split('|')]
            if not was_table: continue  # a table's first row is its header
            cur['paragraphs'].append(' — '.join(c for c in cells if c)); continue
        text=clean(re.sub(r'^\s*[-*]\s+','• ',re.sub(r'^>\s*','',line)))
        cur['paragraphs'].append(text)
    return sections
priv=parse(sys.argv[1], 2); terms=parse(sys.argv[2], 3)
def ts(name, id_, title, secs):
    out=[f"export const {name}: LegalDoc = {{", f"  id: '{id_}',", f"  title: '{title}',", "  updated: UPDATED,", "  sections: ["]
    for s in secs:
        out.append("    {"); out.append(f"      title: {json.dumps(s['title'], ensure_ascii=False)},"); out.append("      paragraphs: [")
        for p in s['paragraphs']: out.append(f"        {json.dumps(p, ensure_ascii=False)},")
        out.append("      ],"); out.append("    },")
    out+= ["  ],","};"]
    return '\n'.join(out)
head='''/**
 * Gizlilik politikası (KVKK aydınlatma metni) and kullanım koşulları, shown in Daha fazla > Kullanım koşulları.
 * GENERATED from docs/hukuk/gizlilik-politikasi.md and docs/hukuk/kullanim-kosullari.md (edit those, then
 * regenerate): a DRAFT, to be checked by a lawyer and its bracketed company details filled in before the release.
 */
export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDoc = { id: 'privacy' | 'terms'; title: string; updated: string; sections: LegalSection[] };

const UPDATED = '25 Kasım 2026 (taslak)';

'''
print(head+ts('PRIVACY_POLICY','privacy','Gizlilik politikası',priv)+'\n\n'+ts('TERMS','terms','Kullanım koşulları',terms)+'\n\nexport const LEGAL_DOCS = [PRIVACY_POLICY, TERMS];')
