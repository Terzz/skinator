"""Contact sheets of accessory symbols (one HTML page per type), to find an item by eye.

Usage: python3 -I sheet.py <accessories dir> <ffdec work dir> <items .sol> <out dir> <type> <label> [files...]
"""
import sys, os, re, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.expanduser('~/Documents/Dofus/analyse/tools'))
import swfscene, scripts_index, evaluate, build, sol

ACC, WORK, ITEMS, OUT, TYPE, LABEL = sys.argv[1:7]
FILES = sys.argv[7:] or ['a9', 'a8', 'a7', 'a6', 'a5', 'a3', 'a2', 'a1']
COLORS = {1: 0xF2E2FC, 2: 0x302C3E, 3: 0xF2E2FC}
PART = {'bottom': 3, 'body': 2, 'head': 1}          # Crâ (90/91) in _oMapPolykrome

I = sol.load(ITEMS)['_Data']['I']
names = {}
for k, v in I['u'].items():
    if isinstance(v, dict) and 't' in v and 'g' in v:
        names.setdefault((v['t'], v['g']), []).append('%s (%s)' % (v['n'], k))

build.with_depth_display_list()
log = {}


def flat(fid, c):
    r, g, b = (c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255
    return ('<filter id="%s" x="-20%%" y="-20%%" width="140%%" height="140%%" color-interpolation-filters="sRGB"><feColorMatrix '
            'type="matrix" values="0 0 0 0 %.4f  0 0 0 0 %.4f  0 0 0 0 %.4f  0 0 0 1 0"/></filter>' % (fid, r, g, b))


filters = ''.join(flat('slot%d' % n, c) for n, c in COLORS.items())
filters += ''.join(flat('part-' + p, COLORS[n]) for p, n in PART.items())
filters += ('<filter id="opaque" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" '
            'values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 255 0"/></filter>')
cells, defs = [], []
for f in FILES:
    path = os.path.join(ACC, f + '.swf')
    sc = swfscene.load(path)
    ev = evaluate.Evaluator(sc, scripts_index.index(os.path.join(WORK, f + '_script/scripts')), log)
    build.add_depths(ev)
    w = build.Writer(f, os.path.join(WORK, 'shapes', f))
    syms = sorted(((int(n.split('_')[1]), n, cid) for n, cid in sc['exports'].items()
                   if re.fullmatch(r'%s_\d+' % TYPE, n)), reverse=True)
    for gfx, name, cid in syms:
        spr = sc['sprites'].get(cid)
        if spr is None:
            continue
        frame = spr['labels'].get(LABEL, 0)
        t = ev.clip(cid, frame)
        pts = build.bbox(t, sc)
        if not pts:
            continue
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, y0, x1, y1 = min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1
        nm = names.get((int(TYPE), gfx), ['?'])
        colored = 'slot' in json.dumps(t) or 'part' in json.dumps(t)
        cells.append('<figure><svg viewBox="%s %s %s %s">%s</svg><figcaption><b>%s</b> %s%s<br>%s</figcaption></figure>'
                     % (build.fmt(x0), build.fmt(y0), build.fmt(x1 - x0), build.fmt(y1 - y0), w.node(t), name, f,
                        ' · couleurs' if colored else '', html.escape(' / '.join(nm))))
    defs.append(''.join(w.shapes.values()) + ''.join(w.cx.values()))
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'type_%s_%s.html' % (TYPE, LABEL)), 'w', encoding='utf-8') as fh:
    fh.write('<!doctype html><meta charset="utf-8"><title>type %s</title><style>body{margin:0;background:#bdbdbd;font:10px system-ui}'
             'main{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:3px;padding:3px}'
             'figure{margin:0;background:#d6d6d6;display:flex;flex-direction:column}svg{width:100%%;height:100px}'
             'figcaption{padding:2px;line-height:1.2}</style>'
             '<svg width="0" height="0" style="position:absolute"><defs>%s%s</defs></svg><main>%s</main>'
             % (TYPE, filters, ''.join(defs), ''.join(cells)))
print(TYPE, LABEL, len(cells), 'symboles')
