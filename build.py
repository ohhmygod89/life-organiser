#!/usr/bin/env python3
"""Build Life Organiser into one self-contained HTML page.

  python3 build.py            -> dist/life-organiser.html  (claude.ai artifact; also works standalone in demo mode)
                                 dist/index.html           (same page, for GitHub Pages)
  python3 build.py --local    -> test/local.html with Sortable inlined from node_modules (offline testing)
"""
import sys, pathlib
R = pathlib.Path(__file__).parent
VERSION = (R/'VERSION').read_text().strip()
src = R/'src'
css = (src/'styles.css').read_text()
shell = (src/'shell.html').read_text().replace('__VERSION__', VERSION)
parts = ['core.js', 'demo.js', 'backup.js', 'types/kanban.js', 'types/timeline.js', 'types/note.js', 'types/collection.js', 'types/tracker.js', 'types/checklist.js', 'types/bills.js', 'types/page.js']
import json, re
def changelog(n=8):
    out, cur = [], None
    for line in (R/'CHANGELOG.md').read_text().splitlines():
        m = re.match(r'## \[(.+?)\] - (\S+)', line)
        if m:
            cur = {'v': m.group(1), 'd': m.group(2), 'items': []}; out.append(cur)
            if len(out) > n: out.pop(); break
        elif cur is not None and line.startswith('- '):
            cur['items'].append(re.sub(r'\*\*|`', '', line[2:]))
    return out
js = '\n'.join((src/f).read_text() for f in parts).replace('__VERSION__', VERSION).replace("'__CHANGELOG__'", json.dumps(changelog()))
sortable = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>'
head = f'''<title>Life Organiser</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="generator" content="Life Organiser {VERSION}">
<!-- Font: system stack by default (see --font-ui in styles.css and the commented Inter link in shell.html) -->
'''
# Optional licensed font: python3 build.py --fonts fonts/fh-oscar "FH Oscar"
# Embeds every *.woff2 in that folder (gitignored, never committed) as @font-face and puts the family first in --font-ui.
# Missing characters fall back to the system font. Builds without --fonts (and GitHub Pages) use the system font.
if '--fonts' in sys.argv:
    import base64
    i = sys.argv.index('--fonts'); fdir = R/sys.argv[i+1]; fam = sys.argv[i+2] if len(sys.argv) > i+2 and not sys.argv[i+2].startswith('--') else 'Brand'
    W = {'thin':100, 'extralight':200, 'light':300, 'regular':400, 'medium':500, 'semibold':600, 'bold':700, 'extrabold':800, 'black':900}
    faces = []
    for f in sorted(fdir.glob('*.woff2')):
        st = f.stem.split('-')[-1].lower(); ital = st.endswith('italic'); key = st[:-6] if ital else st
        w = W.get(key or 'regular', 400)
        faces.append(f'@font-face{{font-family:"{fam}";src:url(data:font/woff2;base64,{base64.b64encode(f.read_bytes()).decode()}) format("woff2");font-weight:{w};font-style:{"italic" if ital else "normal"};font-display:swap}}')
    css = '\n'.join(faces) + f'\n:root{{--font-ui:"{fam}",-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}}\n' + css
    css += f'\n/* embedded font */ :root{{--font-ui:"{fam}",-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}}\n'
    print(f'Embedded {len(faces)} font files as "{fam}"')
body = head + '<style>\n' + css + '</style>\n' + shell + sortable + '\n<script>\n(() => {\n' + js + '\nstart();\n})();\n</script>\n'
(R/'dist').mkdir(exist_ok=True)
(R/'dist'/'life-organiser.html').write_text(body)
# GitHub Pages needs a full document
doc = ('<!doctype html><html lang="en-AU"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"></head><body>' + body + '</body></html>\n')
(R/'dist'/'index.html').write_text(doc)
if '--local' in sys.argv:
    lib = (R/'node_modules'/'sortablejs'/'Sortable.min.js')
    if not lib.exists(): lib = R.parent/'node_modules'/'sortablejs'/'Sortable.min.js'
    (R/'test').mkdir(exist_ok=True)
    (R/'test'/'local.html').write_text(doc.replace(sortable, '<script>' + lib.read_text() + '</script>'))
print(f'Built Life Organiser {VERSION} ({len(body):,} bytes)')
