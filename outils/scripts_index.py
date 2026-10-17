"""Index FFDec-exported AS scripts: {(sprite id, 0-based frame): [text, ...]}"""
import os, re
def index(root):
    out = {}
    for dp, dn, fn in os.walk(root):
        m = re.search(r'DefineSprite_(\d+)(?:_[^/\\]+)?[/\\]frame_(\d+)$', dp)     # exported: DefineSprite_<id>_<name>
        if not m:
            continue
        for f in sorted(fn):
            if f.endswith('.as'):
                out.setdefault((int(m.group(1)), int(m.group(2)) - 1), []).append(open(os.path.join(dp, f), encoding='utf-8').read().strip())
    return out
