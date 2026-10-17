"""Count the raw LINESTYLE widths (twips) of the first style arrays of every DefineShape in a SWF."""
import sys, os, struct, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swftags import body, tags
from swfscene import read_rect, read_matrix

def fill(d, q, v):
    t = d[q]; q += 1
    if t == 0:
        return q + (4 if v >= 3 else 3)
    if t in (0x10, 0x12, 0x13):
        _, q = read_matrix(d, q)
        n = d[q] & 15; q += 1
        q += n * (1 + (4 if v >= 3 else 3))
        return q + (2 if t == 0x13 else 0)
    if t in (0x40, 0x41, 0x42, 0x43):
        _, q = read_matrix(d, q + 2)
        return q
    raise ValueError('fill type %x' % t)

def widths(path):
    d, pos = body(path)
    c = collections.Counter()
    for code, p, ln in tags(d, pos):
        v = {2: 1, 22: 2, 32: 3, 83: 4}.get(code)
        if not v:
            continue
        q = p + 2
        _, q = read_rect(d, q)
        if v == 4:
            _, q = read_rect(d, q); q += 1
        n = d[q]; q += 1
        if n == 0xFF and v >= 2:
            n = struct.unpack_from('<H', d, q)[0]; q += 2
        for _ in range(n):
            q = fill(d, q, v)
        n = d[q]; q += 1
        if n == 0xFF:
            n = struct.unpack_from('<H', d, q)[0]; q += 2
        for _ in range(n):
            w = struct.unpack_from('<H', d, q)[0]; q += 2
            if v == 4:
                f1, f2 = d[q], d[q + 1]; q += 2
                join = (f1 >> 4) & 3; hasfill = (f1 >> 3) & 1
                c[('noscale' if (f1 & 6) else 'scale', w)] += 1
                if join == 2: q += 2
                q = fill(d, q, v) if hasfill else q + 4
            else:
                c[('v%d' % v, w)] += 1
                q += 4 if v >= 3 else 3
    return c

for f in sys.argv[1:]:
    c = widths(f)
    print(os.path.basename(f), sorted(c.items(), key=lambda kv: -kv[1])[:10])
