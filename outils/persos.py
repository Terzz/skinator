"""List the player's characters from DofusSuivi's raw captures -> data/persos.js.

Usage: python3 -I persos.py <brut dir> <out js>
- ALK<subscription>|<count>|<id>;<name>;<level>;<gfx>;<color1>;<color2>;<color3>;<accessories>;...   (character list)
- GM|+<cell>;<dir>;<bonus>;<id>;<name>;<class>,<?>;<gfx>^<size>;<?>;<align>;<color1>;<color2>;<color3>;<accessories>;...
- Oa<id>|<accessories>                                                                            (equipment changed)
The latest of the three wins, per character id. Accessories are parsed like the client (loader.swf @4216686):
"<hex item id>" or "<hex item id>~<type>~<frame>[#]" with frame - 1, at least 0.
"""
import sys, os, glob, re, json, datetime

brut, out = sys.argv[1], sys.argv[2]
chars, looks = {}, {}


def accessories(s):
    res = []
    for part in s.split(','):
        part = part.rstrip('#')
        if not part:
            res.append(None)
            continue
        if '~' in part:
            uid, typ, frame = part.split('~')[:3]
            res.append({'id': int(uid, 16), 'type': int(typ), 'frame': max(0, int(frame.rstrip('#')) - 1)})
        else:
            res.append({'id': int(part, 16)})
    return res


def look(cid, t, gfx=None, colors=None, acc=None):
    old = looks.get(cid, {})
    if old.get('t', 0) > t:
        return
    new = dict(old, t=t)
    if gfx is not None:
        new['gfx'] = gfx
    if colors is not None:
        new['couleurs'] = [None if c == '-1' else '#' + c.zfill(6) for c in colors]
    if acc is not None:
        new['accessoires'] = accessories(acc)
    looks[cid] = new


for f in sorted(glob.glob(os.path.join(brut, '*.log'))):
    for line in open(f, encoding='utf-8', errors='replace'):
        m = re.match(r'^(\d+\.\d+) \d+ (ALK|GM\|\+|Oa)(.*)$', line.rstrip('\n'))
        if not m:
            continue
        t, kind, rest = float(m.group(1)), m.group(2), m.group(3)
        if kind == 'ALK':
            for p in rest.split('|')[2:]:
                q = p.split(';')
                if len(q) < 8 or not q[3].isdigit():
                    continue
                chars[q[0]] = {'nom': q[1], 'niveau': int(q[2])}
                look(q[0], t, int(q[3]), q[4:7], q[7])
        elif kind == 'Oa':
            cid, _, acc = rest.partition('|')
            if cid in chars:
                look(cid, t, acc=acc)
        else:
            for p in rest.split('|+'):
                q = p.split(';')
                if len(q) > 12 and q[3] in chars and '^' in q[6]:
                    look(q[3], t, int(q[6].split('^')[0]), q[9:12], q[12])

rows = []
for cid, c in chars.items():
    lk = looks[cid]
    rows.append(dict(c, gfx=lk['gfx'], couleurs=lk['couleurs'], accessoires=lk.get('accessoires', []),
                     vu=datetime.datetime.fromtimestamp(lk['t']).strftime('%d/%m/%Y %H:%M')))
rows.sort(key=lambda r: (-r['niveau'], r['nom']))
with open(out, 'w', encoding='utf-8') as f:
    f.write('window.SKIN_PERSOS = %s;\n' % json.dumps(rows, ensure_ascii=False))
print(len(rows), 'persos')
for r in rows[:3]:
    print(r)
