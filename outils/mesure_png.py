"""Measure the exported PNGs from the files themselves (own PNG decoder, no browser).

Usage: python3 -I mesure_png.py <4 rotations png> <animations png>
Ink = a pixel whose darkest channel is under 240 on the white ground (what the eye sees).
"""
import sys, zlib, struct, json


def decode(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, w = 8, b'', 0
    while pos < len(d):
        ln, typ = struct.unpack('>I4s', d[pos:pos + 8])
        chunk = d[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, depth, ctype, _, _, inter = struct.unpack('>IIBBBBB', chunk)
            assert depth == 8 and ctype in (2, 6) and inter == 0, (depth, ctype, inter)
            bpp = 4 if ctype == 6 else 3
        elif typ == b'IDAT':
            idat += chunk
        pos += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev, i = [], bytearray(stride), 0
    for y in range(h):
        f = raw[i]; line = bytearray(raw[i + 1:i + 1 + stride]); i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line)); prev = line
    ink = [[min(r[x * bpp], r[x * bpp + 1], r[x * bpp + 2]) < 240 for x in range(w)] for r in rows]
    return w, h, ink


def box(ink, x0, y0, w, h):
    xs, ys = [], []
    for y in range(y0, y0 + h):
        row = ink[y]
        for x in range(x0, x0 + w):
            if row[x]:
                xs.append(x); ys.append(y)
    if not xs:
        return None
    return {'g': min(xs) - x0, 'd': x0 + w - 1 - max(xs), 'h': min(ys) - y0, 'b': y0 + h - 1 - max(ys)}


out = {}
W, H, ink = decode(sys.argv[1])
band = round(210 * W / 1800)
cw = W // 4
out['4 rotations'] = {'taille': [W, H], 'cases': [box(ink, i * cw, 0, cw, H - band) for i in range(4)],
                      'bandeau': box(ink, 0, H - band + 4, W, band - 4)}
W, H, ink = decode(sys.argv[2])
cw = round(W / 4 / (1 + 278 / 1400))
u = cw * 4 / 1400
lab, pad, bandH = round(250 * u), round(28 * u), round(210 * u)
ch = (H - pad - bandH) // 7
rows = []
for r in range(7):
    y = pad + r * ch + 3
    cells = [box(ink, lab + c * cw, y, cw, ch - 6) for c in range(4)]
    title = box(ink, round(pad * 0.5), y, lab - pad, ch - 6)
    rows.append({'g': min(c['g'] for c in cells), 'd': min(c['d'] for c in cells),
                 'h': min(c['h'] for c in cells), 'b': min(c['b'] for c in cells),
                 'titre_vs_centre': round((title['h'] - title['b']) / 2)})
bb = box(ink, 0, pad + 7 * ch + 20, W, round(bandH * 0.55))
out['animations'] = {'taille': [W, H], 'case': [cw, ch], 'colonne_titres': lab, 'lignes': rows,
                     'pastilles_sous_grille': {'g': bb['g'] - lab, 'd': bb['d'] - (W - lab - 4 * cw)}}
print(json.dumps(out, ensure_ascii=False, indent=1))
