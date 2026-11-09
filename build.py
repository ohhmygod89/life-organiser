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
parts = ['core.js', 'demo.js', 'types/kanban.js', 'types/note.js', 'types/collection.js', 'types/tracker.js', 'types/checklist.js', 'types/bills.js']
js = '\n'.join((src/f).read_text() for f in parts).replace('__VERSION__', VERSION)
sortable = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>'
head = f'''<title>Life Organiser</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="generator" content="Life Organiser {VERSION}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
'''
body = head + '<style>\n' + css + '</style>\n' + shell + sortable + '\n<script>\n(() => {\n' + js + '\nstart();\n})();\n</script>\n'
(R/'dist').mkdir(exist_ok=True)
(R/'dist'/'life-organiser.html').write_text(body)
# GitHub Pages needs a full document
doc = ('<!doctype html><html lang="en-AU"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + body + '</body></html>\n')
(R/'dist'/'index.html').write_text(doc)
if '--local' in sys.argv:
    lib = (R/'node_modules'/'sortablejs'/'Sortable.min.js')
    if not lib.exists(): lib = R.parent/'node_modules'/'sortablejs'/'Sortable.min.js'
    (R/'test').mkdir(exist_ok=True)
    (R/'test'/'local.html').write_text(doc.replace(sortable, '<script>' + lib.read_text() + '</script>'))
print(f'Built Life Organiser {VERSION} ({len(body):,} bytes)')
