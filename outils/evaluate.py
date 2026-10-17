"""Evaluate a static pose of a Dofus Retro sprite the way the client's GAC (ank.battlefield) does it.

Output node types (JSON-friendly):
  ["s", shape_id, matrix]                         a shape
  {"m": matrix, "c": [children], ...}             a clip; optional keys:
     "cx": {"m": [r,g,b,a], "a": [r,g,b,a]}       placement colour transform
     "slot": 1|2|3                                GAC.applyColor(clip, n)
     "part": "bottom"|"body"|"head"               GAC.apply<Part>Color(clip) (Polykrome items)
     "acc": index, "label": "R"                   GAC.applyAccessory(this, index, label) hook (attach at depth 10)
     "flipx": true                                its 5th argument: the client negates _x when the sprite is mirrored
     "mask": depth                                this clip masks siblings up to that depth
"""
import re
import swfscene

RE_COLOR = re.compile(r'^GAC\.applyColor\((\w+),(\d)\);$')
RE_PART = re.compile(r'^GAC\.apply(Bottom|Body|Head)Color\((\w+)\);$')
RE_ACC = re.compile(r'^GAC\.applyAccessory\(this,(\d),"(\w*)"(?:,([^,)]*))?(?:,(true|false))?\);$')
RE_GOTO = re.compile(r'^gotoAndStop\(("?)(\w+)\1\);$')
IGNORED = re.compile(r'^(GAC\.applyAnim\(this,"\w+"\);|GAC\.applyEnd\(this\);|stop\(\);|var _loc0_;|\}|\{|else|'
                     r'if\(\(_loc0_ = _parent\.lastAnimation\) !== "anim18"\))$')


class Evaluator:
    def __init__(self, scene, scripts, log):
        self.sc, self.scripts, self.log = scene, scripts, log
        self.used_shapes = set()

    def frame_index(self, spr, target):
        if target.isdigit():
            return int(target) - 1
        return spr['labels'].get(target)

    def run_script(self, cid, frame):
        """Return (goto frame or None, effects) for the DoAction(s) of a frame."""
        effects, goto = [], None
        for text in self.scripts.get((cid, frame), []):
            in_else = False
            for line in (l.strip() for l in text.splitlines()):
                if not line:
                    continue
                if line == 'else':
                    in_else = True       # the 'else' branch is the anim18 ending: not a static pose
                    continue
                if in_else:
                    continue
                m = RE_COLOR.match(line)
                if m:
                    effects.append(('slot', m.group(1), int(m.group(2))))
                    continue
                m = RE_PART.match(line)
                if m:
                    effects.append(('part', m.group(2), m.group(1).lower()))
                    continue
                m = RE_ACC.match(line)
                if m:
                    effects.append(('acc', 'this', int(m.group(1)), m.group(2), m.group(4) == 'true'))
                    continue
                m = RE_GOTO.match(line)
                if m:
                    if goto is None:
                        goto = m.group(2)
                    continue
                if not IGNORED.match(line):
                    self.log.setdefault(line, set()).add(cid)
        return goto, effects

    def clip(self, cid, frame=0, depth_guard=0):
        """A clip created (attachMovie or placement: its first frame's actions run), then sent to `frame` by the caller
        (applyAccessory's gotoAndStop(label)). Colours set on a child stay while that same instance stays on stage."""
        spr = self.sc['sprites'][cid]
        marks, this_effects = {}, []

        def run(fr):
            goto, eff = self.run_script(cid, fr)
            by_name = {e['name']: e for e in swfscene.display_list(spr, fr).values() if 'name' in e}
            for kind, target, *rest in eff:
                if target == 'this':
                    this_effects.append((kind, rest))
                    continue
                e = by_name.get(target)
                if e is None:
                    self.log.setdefault('missing child %s' % target, set()).add(cid)
                    continue
                marks.setdefault(e['inst'], {})[kind] = rest[0]
            return goto

        def follow(fr):
            seen = set()
            while True:
                goto = run(fr)
                if goto is None:
                    return fr
                nxt = self.frame_index(spr, goto)
                if nxt is None or nxt in seen or nxt == fr:
                    if nxt is None:
                        self.log.setdefault('unresolved goto %s' % goto, set()).add(cid)
                    return fr
                seen.add(fr)
                fr = nxt

        cur = follow(0)
        if frame != cur:
            cur = follow(frame)
        dl = swfscene.display_list(spr, cur)
        node = {'c': []}
        for kind, rest in this_effects:
            if kind == 'acc':
                node['acc'], node['label'] = rest[0], rest[1]
                if rest[2]:
                    node['flipx'] = True     # applyAccessory(..., true): _x = -_x for directions 3, 4, 7
        for d, e in sorted(dl.items()):
            child = self.instance(e, marks.get(e['inst'], {}), depth_guard)
            if child is not None:
                node['c'].append(child)
        return node

    def instance(self, e, mark, depth_guard):
        c = e.get('char')
        m = e.get('matrix', [1, 0, 0, 1, 0, 0])
        k = swfscene.kind(self.sc, c)
        if k == 'shape':
            self.used_shapes.add(c)
            out = ['s', c, m]
            if 'cx' in e or 'clipDepth' in e or mark:
                out = {'m': m, 'c': [['s', c, [1, 0, 0, 1, 0, 0]]]}
            else:
                return out
        elif k == 'sprite':
            if depth_guard > 30:
                raise RuntimeError('recursion')
            out = self.clip(c, 0, depth_guard + 1)
            out['m'] = m
        else:
            self.log.setdefault('unsupported child ' + k, set()).add(c)
            return None
        # Color.setTransform replaces the clip's own colour transform
        if 'slot' in mark:
            out['slot'] = mark['slot']
        elif 'part' in mark:
            out['part'] = mark['part']
        elif 'cx' in e:
            out['cx'] = e['cx']
        if 'clipDepth' in e:
            out['mask'] = e['clipDepth']
        for flag in ('filters', 'blend'):
            if e.get(flag):
                self.log.setdefault('ignored ' + flag, set()).add(c)
        return out
