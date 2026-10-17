"""Build the data of ~/Documents/Dofus/skinator_local from SWF copies fetched from the CDN (never the game folder).

Usage: python3 -I build.py <clips dir> <ffdec work dir> <classes lang swf> <out dir> <items .sol or lang copy>
  <clips dir>/sprites/<gfx>.swf, <clips dir>/sprites/accessories/a9.swf
  <ffdec work dir>/scripts/<gfx>/scripts/..., <ffdec work dir>/a9_script/scripts/...
  <ffdec work dir>/shapes/<gfx>/<id>.svg, <ffdec work dir>/shapes/a9/<id>.svg
"""
import sys, os, re, json, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.expanduser('~/Documents/Dofus/DofusSuivi'))
sys.path.insert(0, os.path.expanduser('~/Documents/Dofus/analyse/tools'))
import swfscene, scripts_index, evaluate, anim_export
import jeu
import couleurs
import sol

CLIPS, WORK, CLASSES_SWF, OUT, ITEMS_SOL = sys.argv[1:6]
POSES = 'SRLFB'
# the 7 views of the client's SpriteViewer (stats window), clicked in turn: StaticF, StaticR, StaticL, WalkF, RunF,
# Anim2R, Anim2L (loader.swf, SpriteViewer @4826619), plus anim18End that the static sprites may call
ANIM_NAMES = r'staticF|staticR|staticL|walkF|runF|anim2R|anim2L'
LIBS = ['a1', 'a2', 'a3', 'a5', 'a6', 'a7', 'a8', 'a9', 'a4']     # a4 = accessories_autres (weapons, a few shields): last


def lib_scene(libs, lib):
    if lib not in libs:
        sc = swfscene.load(os.path.join(CLIPS, 'sprites/accessories/%s.swf' % lib))
        ev = evaluate.Evaluator(sc, scripts_index.index(os.path.join(WORK, '%s_script/scripts' % lib)), log)
        add_depths(ev)
        libs[lib] = {'sc': sc, 'ev': ev, 'w': Writer(lib, os.path.join(WORK, 'shapes', lib))}
    return libs[lib]

# the client's table (loader.swf, class ank.battlefield GAC .initialize, @5288383): Polykrome part -> colour slot
POLYKROME = {
    10: (2, 1, 3), 11: (2, 1, 3), 20: (1, 3, 2), 21: (1, 3, 2), 30: (2, 1, 3), 31: (2, 1, 3),
    40: (1, 3, 2), 41: (1, 3, 2), 50: (1, 3, 2), 51: (1, 3, 2), 60: (1, 3, 2), 61: (2, 3, 1),
    70: (1, 3, 2), 71: (1, 3, 2), 80: (1, 3, 2), 81: (1, 3, 2), 90: (3, 2, 1), 91: (3, 2, 1),
    100: (1, 2, 3), 101: (2, 3, 1), 110: (1, 3, 2), 111: (1, 3, 2), 120: (2, 3, 1), 121: (2, 3, 1),
}   # (bottom, body, head)

log = {}


def fmt(v):
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def mat(m):
    if m == [1, 0, 0, 1, 0, 0] or m == [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]:
        return ''
    return ' transform="matrix(%s)"' % ','.join(fmt(x) for x in m)


def shape_markup(path, prefix):
    s = open(path, encoding='utf-8').read()
    if re.search(r'<g transform="[^"]*"/>\s*</svg>', s):
        return ''                                   # empty shape
    g = re.search(r'<svg[^>]*>\s*<g transform="matrix\(1\.0, 0\.0, 0\.0, 1\.0, [-\d.E]+, [-\d.E]+\)">(.*?)</g>\s*(<defs>(.*?)</defs>)?\s*</svg>', s, re.S)
    if not g:
        raise RuntimeError('unexpected FFDec layout in ' + path)
    inner, defs = g.group(1), g.group(3) or ''
    body = inner + (('<defs>' + defs + '</defs>') if defs else '')
    body = re.sub(r'id="([^"]+)"', lambda m: 'id="%s%s"' % (prefix, m.group(1)), body)
    body = re.sub(r'url\(#([^)]+)\)', lambda m: 'url(#%s%s)' % (prefix, m.group(1)), body)
    body = re.sub(r'xlink:href="#([^"]+)"', lambda m: 'xlink:href="#%s%s"' % (prefix, m.group(1)), body)
    body = re.sub(r'\s*\n\s*', '', body)
    # Flash draws a stroke thinner than one screen pixel at one pixel (hairline). FFDec marks those strokes and writes
    # them 1 unit wide, right only at 1:1 : keep the true width in data-sw, the page applies max(1 px, width x scale).
    body = re.sub(r'ffdec:has-small-stroke="true"\s+ffdec:original-stroke-width="([^"]*)"', r'data-sw="\1"', body)
    body = re.sub(r'\s+ffdec:[\w-]+="[^"]*"', '', body)       # FFDec's own attributes (namespace not declared here)
    return body


def depth(k):
    if isinstance(k, list):
        return k[3] if len(k) > 3 else 0
    return k.get('d', 0)


class Writer:
    """Tree (from evaluate.py) -> SVG markup. Filters are referenced by id; their definitions live in the page."""

    def __init__(self, key, shape_dir):
        self.key, self.shape_dir = key, shape_dir
        self.shapes, self.cx = {}, {}

    def cx_filter(self, cx):
        k = 'cx' + hashlib.md5(json.dumps(cx, sort_keys=True).encode()).hexdigest()[:8]
        if k not in self.cx:
            m, a = cx['m'], cx['a']
            vals = ' '.join(fmt(x) for x in [m[0], 0, 0, 0, a[0] / 255, 0, m[1], 0, 0, a[1] / 255,
                                              0, 0, m[2], 0, a[2] / 255, 0, 0, 0, m[3], a[3] / 255])
            self.cx[k] = ('<filter id="%s" x="-20%%" y="-20%%" width="140%%" height="140%%" color-interpolation-filters="sRGB">'
                          '<feColorMatrix type="matrix" values="%s"/></filter>' % (k, vals))
        return k

    def shape(self, sid):
        ref = '%s_%d' % (self.key, sid)
        if ref not in self.shapes:
            p = os.path.join(self.shape_dir, '%d.svg' % sid)
            if not os.path.exists(p):
                log.setdefault('no svg for shape', set()).add(ref)
                self.shapes[ref] = ''
            else:
                self.shapes[ref] = '<g id="%s">%s</g>' % (ref, shape_markup(p, ref + '_'))
        return ref

    def node(self, n):
        if isinstance(n, list):
            return '<use href="#%s"%s/>' % (self.shape(n[1]), mat(n[2]))
        attrs = mat(n.get('m', [1, 0, 0, 1, 0, 0]))
        if 'slot' in n:
            attrs += ' filter="url(#slot%d)"' % n['slot']
        elif 'part' in n:
            attrs += ' filter="url(#part-%s)"' % n['part']
        elif 'cx' in n:
            attrs += ' filter="url(#%s)"' % self.cx_filter(n['cx'])
        if n.get('flipx'):
            attrs += ' data-flipx="%s"' % ','.join(fmt(x) for x in n.get('m', IDENTITY))
        inner, kids = [], n['c']
        i = 0
        acc_done = 'acc' not in n
        while i < len(kids):
            k = kids[i]
            d = depth(k)
            if not acc_done and d > 10:
                inner.append(self.acc(n))
                acc_done = True
            if isinstance(k, dict) and 'mask' in k:
                upto, group = k['mask'], []
                j = i + 1
                while j < len(kids) and depth(kids[j]) <= upto:
                    group.append(kids[j])
                    j += 1
                mid = 'mask_%s_%s' % (self.key, hashlib.md5(json.dumps(k, sort_keys=True).encode()).hexdigest()[:8])
                k2 = dict(k)
                k2.pop('mask')
                inner.append('<mask id="%s" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-500" y="-500" '
                             'width="1000" height="1000"><g filter="url(#opaque)">%s</g></mask>' % (mid, self.node(k2)))
                inner.append('<g mask="url(#%s)">%s</g>' % (mid, ''.join(self.node(x) for x in group)))
                i = j
                continue
            inner.append(self.node(k))
            i += 1
        if not acc_done:
            inner.append(self.acc(n))
        return '<g%s>%s</g>' % (attrs, ''.join(inner))

    def acc(self, n):
        return '<g data-acc="%d" data-label="%s"></g>' % (n['acc'], n['label'])


def add_depths(ev):
    """evaluate.py keeps children in depth order without the depth: wrap Evaluator.instance to keep it."""
    orig = ev.instance

    def instance(e, mark, guard, _orig=orig):
        out = _orig(e, mark, guard)
        if out is None:
            return None
        if isinstance(out, list):
            return out + [e['depth']]
        out['d'] = e['depth']
        return out
    ev.instance = instance


def with_depth_display_list():
    orig = swfscene.display_list

    def display_list(spr, frame):
        dl = orig(spr, frame)
        for d, e in dl.items():
            e['depth'] = d
        return dl
    swfscene.display_list = display_list


IDENTITY = [1, 0, 0, 1, 0, 0]


def compose(p, c):
    return [p[0] * c[0] + p[2] * c[1], p[1] * c[0] + p[3] * c[1], p[0] * c[2] + p[2] * c[3], p[1] * c[2] + p[3] * c[3],
            p[0] * c[4] + p[2] * c[5] + p[4], p[1] * c[4] + p[3] * c[5] + p[5]]


def bbox(node, sc, m=IDENTITY, acc=None):
    """Bounds of a tree in its own space, from the DefineShape bounds (plus the attached accessory tree if given)."""
    out = []
    if isinstance(node, list):
        b = sc['shapes'].get(node[1], {}).get('bounds')
        if b:
            mm = compose(m, node[2])
            pts = [(x, y) for x in (b[0], b[1]) for y in (b[2], b[3])]
            out = [(mm[0] * x + mm[2] * y + mm[4], mm[1] * x + mm[3] * y + mm[5]) for x, y in pts]
        return out
    mm = compose(m, node.get('m', IDENTITY))
    for k in node['c']:
        out += bbox(k, sc, mm, acc)
    if acc and 'acc' in node and node['acc'] == 2 and node['label'] in acc[0]:
        out += bbox(acc[0][node['label']], acc[1], mm)
    return out


def standalone(path, writer, markup, pts, title):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, y0, x1, y1 = min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1
    ident = '<feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>'
    filters = ''.join('<filter id="%s">%s</filter>' % (f, ident) for f in
                      ('slot1', 'slot2', 'slot3', 'part-bottom', 'part-body', 'part-head'))
    filters += ('<filter id="opaque" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" '
                'values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 255 0"/></filter>')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" '
                'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="%s %s %s %s" width="%d" height="%d">'
                '<title>%s</title><style>[data-sw]{vector-effect:non-scaling-stroke;stroke-width:1px}</style>'
                '<defs>%s%s%s</defs>%s</svg>\n'
                % (fmt(x0), fmt(y0), fmt(x1 - x0), fmt(y1 - y0), round((x1 - x0) * 8), round((y1 - y0) * 8), title,
                   filters, ''.join(writer.shapes.values()), ''.join(writer.cx.values()), markup))


def main():
    with_depth_display_list()
    os.makedirs(os.path.join(OUT, 'data'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'svg'), exist_ok=True)
    G = jeu.load_swf(CLASSES_SWF)['G']
    classes = {}
    for c in range(1, 13):
        e = G[c] if c in G else G[str(c)]
        p = lambda s: e['p%d' % s] if ('p%d' % s) in e else e[s]
        classes[c] = {'nom': e['sn'], 'defaut': {s: [p(s)['c1'], p(s)['c2'], p(s)['c3']] for s in (0, 1)}}

    # accessories: every symbol "<type>_<gfx>" of hats (16), capes (17) and backpacks (81, worn as capes), pets (18), shields (82). The client attaches it
    # (Accessory: type = the "~type" of the packet or the item's, gfx = the item's) and goes to the label of the pose, plus
    # the living item's level when there is one ("R" + 6 = "R6").
    items = sol.load(ITEMS_SOL)['_Data']['I']['u']
    names = {}
    for iid, it in items.items():
        if isinstance(it, dict) and 'g' in it and 't' in it:
            names.setdefault((it['t'], it['g']), []).append(it['n'])
    os.makedirs(os.path.join(OUT, 'data', 'acc'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'svg', 'vignettes'), exist_ok=True)
    libs, catalogue = {}, {}
    for lib in LIBS:
        L = lib_scene(libs, lib)
        for key, cid in sorted(L['sc']['exports'].items()):
            m = re.fullmatch(r'(16|17|18|81|82)_(\d+)', key)
            spr = L['sc']['sprites'].get(cid)
            if not m or key in catalogue or not spr:
                continue
            typ, gfx = int(m.group(1)), int(m.group(2))
            w = Writer(lib, os.path.join(WORK, 'shapes', lib))
            labels, trees = {}, {}
            for label, frame in sorted(spr['labels'].items(), key=lambda kv: kv[1]):
                trees[label] = L['ev'].clip(cid, frame)
                labels[label] = w.node(trees[label])
            if not labels:
                trees[''] = L['ev'].clip(cid, 0)
                labels[''] = w.node(trees[''])
            drawn = {}                              # living item level -> drawn in at least one label
            for l, mk in labels.items():
                x = re.fullmatch(r'([A-Z]+)(\d+)', l)
                if x:
                    drawn[int(x.group(2))] = drawn.get(int(x.group(2)), False) or '<use' in mk
            levels = sorted(v for v, ok in drawn.items() if ok) or sorted(drawn)
            nm = list(names.get((typ, gfx), []))
            if levels or not nm:
                nm += names.get((113, gfx), [])            # objets vivants: their own item type is 113
            with open(os.path.join(OUT, 'data', 'acc', key + '.js'), 'w', encoding='utf-8') as f:
                f.write('SKIN_ADD("acc", %s, %s);\n' % (json.dumps(key), json.dumps(
                    {'defs': ''.join(w.shapes.values()) + ''.join(w.cx.values()), 'labels': labels}, ensure_ascii=False)))
            base = 'F' if typ in (16, 18) else 'R'
            thumb = next((l for l in (base, base + str(levels[0]) if levels else None, 'R', 'R0') if l in trees), next(iter(trees)))
            w1 = Writer(lib, os.path.join(WORK, 'shapes', lib))
            pts = bbox(trees[thumb], L['sc'])
            if pts:
                standalone(os.path.join(OUT, 'svg', 'vignettes', key + '.svg'), w1, w1.node(trees[thumb]), pts, key)
            catalogue[key] = {'cle': key, 'emplacement': {16: 1, 17: 2, 81: 2, 18: 3, 82: 4}[typ], 'type': typ, 'gfx': gfx,
                              'noms': nm, 'niveaux': levels or None, 'vignette': bool(pts),
                              'symbole': cid, 'fichier': 'clips/sprites/accessories/%s.swf' % lib}
    with open(os.path.join(OUT, 'data', 'catalogue.js'), 'w', encoding='utf-8') as f:
        f.write('window.SKIN_CATALOGUE = %s;\n' % json.dumps(list(catalogue.values()), ensure_ascii=False))
    print('catalogue', len(catalogue), 'objets', couleurs.annoter(OUT))   # + comment chaque objet prend ses couleurs

    # timelines for the animation player: one file per accessory (data/accanim/<key>.js)
    os.makedirs(os.path.join(OUT, 'data', 'accanim'), exist_ok=True)
    for key, x in catalogue.items():
        lib = x['fichier'].rsplit('/', 1)[1][:-4]
        L = lib_scene(libs, lib)
        data = anim_export.library(L['sc'], L['ev'].scripts, [x['symbole']], shape_markup,
                                   os.path.join(WORK, 'shapes', lib), 'm' + lib)
        data['root'] = x['symbole']
        write_js(os.path.join(OUT, 'data', 'accanim', key + '.js'), 'accanim', key, data)

    # what the characters wear, as catalogue keys (the page puts it back with « Mes persos »)
    persos_js = os.path.join(OUT, 'data', 'persos.js')
    if os.path.exists(persos_js):
        txt = open(persos_js, encoding='utf-8').read()
        persos = json.loads(txt[txt.index('['):txt.rindex(']') + 1])
        for p in persos:
            equip = []
            for slot, a in enumerate(p.get('accessoires') or []):
                it = items.get(str(a['id'])) if a else None
                key = it and '%s_%s' % (a.get('type', it['t']), it['g'])
                equip.append({'cle': key, 'niveau': a.get('frame'), 'nom': it['n']} if key in catalogue else None)
            p['equip'] = equip
        with open(persos_js, 'w', encoding='utf-8') as f:
            f.write('window.SKIN_PERSOS = %s;\n' % json.dumps(persos, ensure_ascii=False))

    sprites = {}
    os.makedirs(os.path.join(OUT, 'svg', 'persos'), exist_ok=True)
    for c in range(1, 13):
        for s in (0, 1):
            gfx = c * 10 + s
            sc = swfscene.load(os.path.join(CLIPS, 'sprites/%d.swf' % gfx))
            ev = evaluate.Evaluator(sc, scripts_index.index(os.path.join(WORK, 'scripts/%d/scripts' % gfx)), log)
            add_depths(ev)
            w = Writer('c%d' % gfx, os.path.join(WORK, 'shapes/%d' % gfx))
            poses = {}
            for pose in POSES:
                pid = sc['exports']['static' + pose]
                t = ev.clip(pid)
                poses[pose] = w.node(t)
                w1 = Writer('c%d' % gfx, os.path.join(WORK, 'shapes/%d' % gfx))
                standalone(os.path.join(OUT, 'svg', 'persos', '%d_static%s.svg' % (gfx, pose)), w1, w1.node(t), bbox(t, sc),
                           '%s %s, static%s, couleurs d\'origine du dessin' % (classes[c]['nom'], 'F' if s else 'M', pose))
            data = {'defs': ''.join(w.shapes.values()) + ''.join(w.cx.values()), 'poses': poses}
            write_js(os.path.join(OUT, 'data', 'sprite_%d.js' % gfx), 'sprite', str(gfx), data)
            # animations (the player of the page): every exported animation of the sprite, 60 images/s like the client
            exports = {n: cid for n, cid in sc['exports'].items() if re.fullmatch(ANIM_NAMES, n)}
            lib = anim_export.library(sc, ev.scripts, list(exports.values()), shape_markup,
                                      os.path.join(WORK, 'shapes/%d' % gfx), 'mc%d' % gfx)
            lib.update(fps=60, exports=exports)
            os.makedirs(os.path.join(OUT, 'data', 'anim'), exist_ok=True)
            write_js(os.path.join(OUT, 'data', 'anim', '%d.js' % gfx), 'anim', str(gfx), lib)
            sprites[gfx] = {'classe': c, 'sexe': s}
            print(gfx, 'shapes', len(w.shapes), 'kB', len(json.dumps(data)) // 1024)

    meta = {'classes': classes, 'polykrome': {str(k): {'bottom': v[0], 'body': v[1], 'head': v[2]} for k, v in POLYKROME.items()},
            'sprites': sprites}
    with open(os.path.join(OUT, 'data', 'meta.js'), 'w', encoding='utf-8') as f:
        f.write('window.SKIN_META = %s;\n' % json.dumps(meta, ensure_ascii=False))
    for k, v in log.items():
        print('LOG', k, sorted(v)[:12])


def write_js(path, kind, key, data):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('SKIN_ADD(%s, %s, %s);\n' % (json.dumps(kind), json.dumps(key), json.dumps(data, ensure_ascii=False)))


if __name__ == '__main__':
    main()
