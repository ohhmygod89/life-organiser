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
parts = ['core.js', 'demo.js', 'firebase.js', 'backup.js', 'types/kanban.js', 'types/timeline.js', 'types/note.js', 'types/collection.js', 'types/tracker.js', 'types/checklist.js', 'types/bills.js', 'types/page.js']
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
body = head + '<style>\n' + css + '</style>\n' + shell + sortable + '\n<script>\n(() => {\n' + js + '\nstart();\n})();\n</script>\n'
(R/'dist').mkdir(exist_ok=True)
(R/'dist'/'life-organiser.html').write_text(body)
# GitHub Pages needs a full document
doc = ('<!doctype html><html lang="en-AU"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"></head><body>' + body + '</body></html>\n')
# Your real app lives on Firebase Hosting (dist/firebase/ -> life-organiser-7fc5f.web.app): Google sign-in + your encrypted data.
# GitHub Pages shows the public demo with sample data (at / and /demo/).
SITE = 'life-organiser-7fc5f.web.app'
FIREBASE = {"apiKey":"AIzaSyAoOMq_oTa8WAy8TvIjmGhItv1BHQpZO8A","authDomain":SITE,"projectId":"life-organiser-7fc5f",
            "storageBucket":"life-organiser-7fc5f.firebasestorage.app","messagingSenderId":"1018557951375","appId":"1:1018557951375:web:4c4a7e6cea44e744b0affa"}
FB = 'https://www.gstatic.com/firebasejs/10.14.1/'
fb_scripts = ''.join(f'<script src="{FB}firebase-{m}-compat.js"></script>' for m in ('app','auth','firestore'))
mode = lambda m, extra='': f'<script>window.LO_MODE="{m}";{extra}</script>'
demo_doc = doc.replace(sortable, mode('demo') + sortable, 1)
(R/'dist'/'index.html').write_text(demo_doc)
(R/'dist'/'demo').mkdir(exist_ok=True)
(R/'dist'/'demo'/'index.html').write_text(demo_doc)
(R/'dist'/'firebase').mkdir(exist_ok=True)
(R/'dist'/'firebase'/'index.html').write_text(doc.replace(sortable, fb_scripts + mode('firebase', 'window.LO_FIREBASE='+json.dumps(FIREBASE)+';') + sortable, 1))
if '--local' in sys.argv:
    lib = (R/'node_modules'/'sortablejs'/'Sortable.min.js')
    if not lib.exists(): lib = R.parent/'node_modules'/'sortablejs'/'Sortable.min.js'
    (R/'test').mkdir(exist_ok=True)
    (R/'test'/'local.html').write_text(doc.replace(sortable, '<script>' + lib.read_text() + '</script>'))
print(f'Built Life Organiser {VERSION} ({len(body):,} bytes)')
