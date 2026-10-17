"""Timelines of a SWF for the page's animation player: sprites (frames, labels, scripts) and shapes, from root symbols.

Scripts (FFDec's decompiled AS) are reduced to the statements the sprites use:
  ['color', name, n] ['part', name, part] ['acc', slot, label, flip, head clip of _parent] ['anim', name] ['stop'] ['play']
  ['parentPlay']
  ['goto', play(0/1), target]  target: ['label', s] | ['frame', i] (0-based) | ['rand', n, add] (random(n) + add, 0-based)
  ['if', cond, then, else]     cond: ['lastAnim', '!==' | '===', s] | ['rand', n, op, m] | ['true'] | ['false']
Everything else (sounds, traces, onClipEvent and onEnterFrame code) is dropped.
"""
import re, json, os
import swfscene

R_COLOR = re.compile(r'^GAC\.applyColor\((\w+),(\d)\);$')
R_PART = re.compile(r'^GAC\.apply(Bottom|Body|Head)Color\((\w+)\);$')
R_ACC = re.compile(r'^GAC\.applyAccessory\(this,(\d),"(\w*)"(?:,([^,)]*))?(?:,(true|false))?\);$')
R_ANIM = re.compile(r'^GAC\.applyAnim\(this,"(\w*)"\);$')
R_GOTO = re.compile(r'^goto(And)(Stop|Play)\((.*)\);$')


def target(arg):
    arg = arg.strip()
    m = re.fullmatch(r'"(\w*)"', arg)
    if m:
        return ['label', m.group(1)]
    if re.fullmatch(r'\d+', arg):
        return ['frame', int(arg) - 1]
    m = re.fullmatch(r'random\((\d+)\)\s*\+\s*(\d+)', arg)
    if m:
        return ['rand', int(m.group(1)), int(m.group(2)) - 1]
    return None


def condition(text):
    m = re.fullmatch(r'\(_loc0_ = _parent\.lastAnimation\) (!==|===) "(\w*)"', text)
    if m:
        return ['lastAnim', m.group(1), m.group(2)]
    m = re.fullmatch(r'random\((\d+)\) (==|!=) (\d+)', text)
    if m:
        return ['rand', int(m.group(1)), m.group(2), int(m.group(3))]
    if text == '_parent.load != 1':
        return ['true']
    return ['false']


def statement(line):
    for rx, make in ((R_COLOR, lambda m: ['color', m.group(1), int(m.group(2))]),
                     (R_PART, lambda m: ['part', m.group(2), m.group(1).lower()]),
                     (R_ACC, lambda m: ['acc', int(m.group(1)), m.group(2), 1 if m.group(4) == 'true' else 0,
                                        (m.group(3) or '').replace('_parent.', '') if (m.group(3) or '').startswith('_parent.') else '']),
                     (R_ANIM, lambda m: ['anim', m.group(1)])):
        m = rx.match(line)
        if m:
            return make(m)
    if line == 'stop();':
        return ['stop']
    if line == 'play();':
        return ['play']
    if line == '_parent.play();':
        return ['parentPlay']
    m = R_GOTO.match(line)
    if m:
        t = target(m.group(3))
        return ['goto', 1 if m.group(2) == 'Play' else 0, t] if t else None
    return None


def compile_script(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    pos = [0]

    def skip_braced(first_has_brace):
        depth = 1 if first_has_brace else 0
        if not first_has_brace:                       # the brace is on the next line
            if pos[0] < len(lines) and lines[pos[0]].startswith('{'):
                depth = 1
                pos[0] += 1
        while pos[0] < len(lines) and depth > 0:
            l = lines[pos[0]]
            depth += l.count('{') - l.count('}')
            pos[0] += 1

    def block():
        ops = []
        while pos[0] < len(lines):
            l = lines[pos[0]]
            if l.startswith('}'):
                pos[0] += 1
                return ops
            pos[0] += 1
            if l.startswith('if(') or l.startswith('if ('):
                cond = condition(l[l.index('(') + 1:l.rindex(')')])
                then = sub()
                other = []
                if pos[0] < len(lines) and lines[pos[0]] == 'else':
                    pos[0] += 1
                    other = sub()
                ops.append(['if', cond, then, other])
            elif l.startswith('onClipEvent') or l.startswith('this.onEnterFrame'):
                skip_braced(l.endswith('{'))
            else:
                op = statement(l)
                if op:
                    ops.append(op)
        return ops

    def sub():
        if pos[0] < len(lines) and lines[pos[0]] == '{':
            pos[0] += 1
            return block()
        if pos[0] < len(lines):                       # single statement without braces
            pos[0] += 1
            op = statement(lines[pos[0] - 1])
            return [op] if op else []
        return []

    return block()


def r4(v):
    return round(v, 4)


def compact_place(op):
    o = {'d': op['depth']}
    if op['op'] == 'remove':
        return {'r': op['depth']}
    if 'char' in op:
        o['c'] = op['char']
    if 'matrix' in op:
        o['m'] = [r4(x) for x in op['matrix']]
    if 'cx' in op:
        o['x'] = [r4(x) for x in op['cx']['m']] + op['cx']['a']
    if 'name' in op:
        o['n'] = op['name']
    if 'clipDepth' in op:
        o['k'] = op['clipDepth']
    if op.get('move'):
        o['mv'] = 1
    return o


def anim_stroke(markup):
    """Flash: a stroke is at least one screen pixel. 1-twip lines -> 1 px whatever the zoom; others scale."""
    def fix(m):
        tag = m.group(0)
        sw = re.search(r'data-sw="([^"]*)"', tag)
        if not sw:
            return tag
        w = float(sw.group(1))
        if 'vector-effect' in tag:
            return tag
        if w <= 0.1:
            tag = re.sub(r'stroke-width="[^"]*"', 'stroke-width="1"', tag)
            return tag.replace('<path ', '<path vector-effect="non-scaling-stroke" ', 1)
        return re.sub(r'stroke-width="[^"]*"', 'stroke-width="%s"' % sw.group(1), tag)
    return re.sub(r'<path [^>]*>', fix, markup)


def library(sc, scripts, roots, shape_markup, shape_dir, prefix):
    """All sprites and shapes reachable from `roots`. scripts: {(sprite, frame): [text]}."""
    sprites, shapes, todo = {}, {}, list(roots)
    while todo:
        cid = todo.pop()
        if cid in sprites or cid not in sc['sprites']:
            continue
        spr = sc['sprites'][cid]
        frames = [[compact_place(op) for op in fr] for fr in spr['frames']]
        s = {}
        for fi in range(len(spr['frames'])):
            ops = []
            for text in scripts.get((cid, fi), []):
                ops += compile_script(text)
            if ops:
                s[fi] = ops
        sprites[cid] = {'f': frames, 'l': spr['labels'], 's': s}
        for fr in spr['frames']:
            for op in fr:
                c = op.get('char')
                if c is None:
                    continue
                if c in sc['sprites']:
                    todo.append(c)
                elif c in sc['shapes'] and c not in shapes:
                    p = os.path.join(shape_dir, '%d.svg' % c)
                    ref = '%s_%d' % (prefix, c)
                    shapes[c] = '<g id="%s">%s</g>' % (ref, anim_stroke(shape_markup(p, ref + '_'))) if os.path.exists(p) else ''
    return {'sprites': sprites, 'shapes': sorted(shapes), 'defs': ''.join(shapes.values()), 'prefix': prefix}
