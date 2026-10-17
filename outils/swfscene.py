"""Read the display lists of a SWF (shapes, sprites, frames, labels, exports) into plain Python objects.

Usage as a module: scene = load(path) ; or  python3 -I swfscene.py <file.swf> tree <char id|export name> [label]
"""
import sys, struct, zlib, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swftags import body, tags, cstr

SHAPES = {2: 1, 22: 2, 32: 3, 83: 4}
MORPH = {46, 84}
IMAGES = {6, 20, 21, 35, 36, 90}


class Bits:
    def __init__(self, d, pos):
        self.d, self.pos, self.bit = d, pos, 0

    def u(self, n):
        v = 0
        for _ in range(n):
            byte = self.d[self.pos]
            v = (v << 1) | ((byte >> (7 - self.bit)) & 1)
            self.bit += 1
            if self.bit == 8:
                self.bit, self.pos = 0, self.pos + 1
        return v

    def s(self, n):
        v = self.u(n)
        return v - (1 << n) if n and v & (1 << (n - 1)) else v

    def align(self):
        if self.bit:
            self.bit, self.pos = 0, self.pos + 1
        return self.pos


def read_matrix(d, pos):
    b = Bits(d, pos)
    a = dd = 1.0
    bb = c = 0.0
    if b.u(1):
        n = b.u(5)
        a, dd = b.s(n) / 65536.0, b.s(n) / 65536.0
    if b.u(1):
        n = b.u(5)
        bb, c = b.s(n) / 65536.0, b.s(n) / 65536.0
    n = b.u(5)
    tx, ty = b.s(n), b.s(n)
    # SVG matrix(a,b,c,d,e,f) in pixels
    return [a, bb, c, dd, tx / 20.0, ty / 20.0], b.align()


def read_cxform(d, pos, alpha):
    b = Bits(d, pos)
    has_add, has_mult = b.u(1), b.u(1)
    n = b.u(4)
    k = 4 if alpha else 3
    mult, add = [256] * 4, [0] * 4
    if has_mult:
        mult[:k] = [b.s(n) for _ in range(k)]
    if has_add:
        add[:k] = [b.s(n) for _ in range(k)]
    # multipliers as factors, additions in 0..255 units
    return {'m': [x / 256.0 for x in mult], 'a': add}, b.align()


def read_rect(d, pos):
    b = Bits(d, pos)
    n = b.u(5)
    v = [b.s(n) / 20.0 for _ in range(4)]
    return v, b.align()


def parse_place(code, d, p, ln):
    end = p + ln
    if code == 4:
        cid, depth = struct.unpack_from('<HH', d, p)
        m, q = read_matrix(d, p + 4)
        op = {'op': 'place', 'depth': depth, 'char': cid, 'matrix': m, 'move': False}
        if q < end:
            op['cx'], q = read_cxform(d, q, False)
        return op
    f1 = d[p]
    q = p + 1
    f2 = 0
    if code == 70:
        f2 = d[q]
        q += 1
    depth = struct.unpack_from('<H', d, q)[0]
    q += 2
    op = {'op': 'place', 'depth': depth, 'move': bool(f1 & 1)}
    if code == 70 and (f2 & 0x08 or (f2 & 0x10 and f1 & 0x02)):
        op['class'], q = cstr(d, q)
    if f1 & 0x02:
        op['char'] = struct.unpack_from('<H', d, q)[0]
        q += 2
    if f1 & 0x04:
        op['matrix'], q = read_matrix(d, q)
    if f1 & 0x08:
        op['cx'], q = read_cxform(d, q, True)
    if f1 & 0x10:
        op['ratio'] = struct.unpack_from('<H', d, q)[0]
        q += 2
    if f1 & 0x20:
        op['name'], q = cstr(d, q)
    if f1 & 0x40:
        op['clipDepth'] = struct.unpack_from('<H', d, q)[0]
        q += 2
    if code == 70:
        if f2 & 0x01:
            op['filters'] = True        # not interpreted
        if f2 & 0x02:
            op['blend'] = True
    if f1 & 0x80:
        op['clipActions'] = True
    return op


def parse_timeline(d, pos, end, scene, top):
    frames, cur, labels, actions = [], [], {}, {}
    for code, p, ln in tags(d, pos, end):
        if code == 1:
            frames.append(cur)
            cur = []
        elif code in (4, 26, 70):
            cur.append(parse_place(code, d, p, ln))
        elif code == 5:
            cur.append({'op': 'remove', 'depth': struct.unpack_from('<H', d, p + 2)[0]})
        elif code == 28:
            cur.append({'op': 'remove', 'depth': struct.unpack_from('<H', d, p)[0]})
        elif code == 43:
            labels[cstr(d, p)[0]] = len(frames)          # 0-based frame index
        elif code == 12:
            actions.setdefault(len(frames), 0)
            actions[len(frames)] += 1
        elif top:
            if code in SHAPES:
                cid = struct.unpack_from('<H', d, p)[0]
                scene['shapes'][cid] = {'bounds': read_rect(d, p + 2)[0]}
            elif code in MORPH:
                scene['shapes'][struct.unpack_from('<H', d, p)[0]] = {'morph': True}
            elif code == 39:
                cid, nframes = struct.unpack_from('<HH', d, p)
                spr = parse_timeline(d, p + 4, p + ln, scene, False)
                spr['nframes'] = nframes
                scene['sprites'][cid] = spr
            elif code == 56:
                n = struct.unpack_from('<H', d, p)[0]
                q = p + 2
                for _ in range(n):
                    cid = struct.unpack_from('<H', d, q)[0]
                    name, q = cstr(d, q + 2)
                    scene['exports'][name] = cid
            elif code in (57, 71):
                url, q = cstr(d, p)
                if code == 71:
                    q += 2
                n = struct.unpack_from('<H', d, q)[0]
                q += 2
                for _ in range(n):
                    cid = struct.unpack_from('<H', d, q)[0]
                    name, q = cstr(d, q + 2)
                    scene['imports'][cid] = (url, name)
            elif code in IMAGES:
                scene['images'].add(struct.unpack_from('<H', d, p)[0])
            elif code in (7, 34, 11, 33, 37, 10, 48, 75):
                scene['other'][struct.unpack_from('<H', d, p)[0]] = code
    if cur:
        frames.append(cur)
    return {'frames': frames, 'labels': labels, 'actions': actions}


def load(path):
    d, pos = body(path)
    scene = {'shapes': {}, 'sprites': {}, 'exports': {}, 'imports': {}, 'images': set(), 'other': {}}
    scene['main'] = parse_timeline(d, pos, len(d), scene, True)
    return scene


def display_list(spr, frame):
    """State of the display list at 0-based frame index (replaying ops from frame 0)."""
    dl, n = {}, 0
    for i in range(min(frame + 1, len(spr['frames']))):
        for op in spr['frames'][i]:
            if op['op'] == 'remove':
                dl.pop(op['depth'], None)
            elif op['move'] and op['depth'] in dl:
                e = dict(dl[op['depth']])
                if 'char' in op and op['char'] != e.get('char'):
                    e = {k: v for k, v in e.items() if k in ('matrix', 'cx', 'name', 'clipDepth')}
                    n += 1
                    e['inst'] = n                   # another character: another instance
                e.update({k: v for k, v in op.items() if k not in ('op', 'move')})
                dl[op['depth']] = e
            else:
                n += 1
                dl[op['depth']] = dict({k: v for k, v in op.items() if k not in ('op', 'move')}, inst=n)
    return dl


def kind(scene, cid):
    if cid in scene['shapes']:
        return 'shape'
    if cid in scene['sprites']:
        return 'sprite'
    if cid in scene['imports']:
        return 'import:%s:%s' % scene['imports'][cid]
    if cid in scene['images']:
        return 'image'
    return 'other:%s' % scene['other'].get(cid)


def tree(scene, cid, frame=0, indent=0, maxdepth=6):
    spr = scene['sprites'][cid]
    for depth, e in sorted(display_list(spr, frame).items()):
        c = e.get('char')
        k = kind(scene, c)
        extra = ' name=%s' % e['name'] if 'name' in e else ''
        if 'clipDepth' in e:
            extra += ' clip<=%d' % e['clipDepth']
        if 'cx' in e:
            extra += ' cx=%s' % e['cx']
        print('  ' * indent + 'd%d %s %s%s' % (depth, k, c, extra))
        if k == 'sprite' and indent < maxdepth:
            tree(scene, c, 0, indent + 1, maxdepth)


if __name__ == '__main__':
    sc = load(sys.argv[1])
    if sys.argv[2] == 'tree':
        key = sys.argv[3]
        cid = int(key) if key.isdigit() else sc['exports'][key]
        spr = sc['sprites'][cid]
        print('sprite', cid, 'frames', len(spr['frames']), 'labels', spr['labels'], 'actions', spr['actions'])
        fr = spr['labels'][sys.argv[4]] if len(sys.argv) > 4 else 0
        tree(sc, cid, fr)
    elif sys.argv[2] == 'summary':
        print(len(sc['shapes']), 'shapes', len(sc['sprites']), 'sprites', len(sc['images']), 'images', sc['other'])
        masks = sum(1 for s in sc['sprites'].values() for f in s['frames'] for op in f if 'clipDepth' in op)
        print('masks', masks, 'filters', sum(1 for s in sc['sprites'].values() for f in s['frames'] for op in f if op.get('filters')))
