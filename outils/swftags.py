"""List ExportAssets / ImportAssets of SWF files. Usage: python3 -I swftags.py <file.swf>... [--grep text]"""
import sys, zlib, struct


def body(path):
    d = open(path, 'rb').read()
    sig = d[:3]
    if sig == b'CWS':
        d = d[:8] + zlib.decompress(d[8:])
    elif sig != b'FWS':
        raise ValueError('unsupported ' + repr(sig))
    nbits = d[8] >> 3
    rect_bytes = (5 + 4 * nbits + 7) // 8
    return d, 8 + rect_bytes + 4


def tags(d, pos, end=None):
    end = end or len(d)
    while pos < end:
        code_len = struct.unpack_from('<H', d, pos)[0]
        code, ln = code_len >> 6, code_len & 0x3f
        pos += 2
        if ln == 0x3f:
            ln = struct.unpack_from('<I', d, pos)[0]
            pos += 4
        yield code, pos, ln
        pos += ln
        if code == 0:
            break


def cstr(d, p):
    e = d.index(b'\0', p)
    return d[p:e].decode('latin-1'), e + 1


def assets(path):
    d, pos = body(path)
    exp, imp = [], []
    for code, p, ln in tags(d, pos):
        if code == 56:
            n = struct.unpack_from('<H', d, p)[0]
            q = p + 2
            for _ in range(n):
                cid = struct.unpack_from('<H', d, q)[0]
                name, q = cstr(d, q + 2)
                exp.append((cid, name))
        elif code in (57, 71):
            url, q = cstr(d, p)
            if code == 71:
                q += 2
            n = struct.unpack_from('<H', d, q)[0]
            q += 2
            for _ in range(n):
                cid = struct.unpack_from('<H', d, q)[0]
                name, q = cstr(d, q + 2)
                imp.append((url, cid, name))
    return exp, imp


if __name__ == '__main__':
    args = sys.argv[1:]
    pat = None
    if '--grep' in args:
        i = args.index('--grep')
        pat = args[i + 1]
        args = args[:i] + args[i + 2:]
    for f in args:
        exp, imp = assets(f)
        sel_e = [e for e in exp if pat is None or pat in e[1]]
        sel_i = [e for e in imp if pat is None or pat in e[2] or pat in e[0]]
        print('%s: %d exports, %d imports' % (f.rsplit('/', 1)[-1], len(exp), len(imp)))
        for cid, name in sel_e[:60]:
            print('  export', cid, name)
        for url, cid, name in sel_i[:60]:
            print('  import', url, cid, name)
