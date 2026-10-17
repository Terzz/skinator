"""Read a Cytrus v6 manifest (flatbuffers) and fetch single files from the public CDN, without the game folder.

Usage:
  python3 -I cytrus.py list <manifest> [<substring>]
  python3 -I cytrus.py get  <manifest> <out dir> <path in bundle>...
Schema (Ankama.Cytrus): Manifest{fragments:[Fragment]} Fragment{name, files:[File], bundles:[Bundle]}
Bundle{hash:[ubyte], chunks:[Chunk]} Chunk{hash:[ubyte], size:long, offset:long}
File{name, size:long, hash:[ubyte], chunks:[Chunk], executable:bool, symlink:string}
"""
import sys, os, struct, hashlib, urllib.request

CDN = 'https://cytrus.cdn.ankama.com/retro/bundles/'


class Table:
    def __init__(self, buf, pos):
        self.buf, self.pos = buf, pos
        vt = pos - struct.unpack_from('<i', buf, pos)[0]
        self.vt, self.vlen = vt, struct.unpack_from('<H', buf, vt)[0]

    def _field(self, i):
        o = 4 + 2 * i
        if o >= self.vlen:
            return None
        off = struct.unpack_from('<H', self.buf, self.vt + o)[0]
        return self.pos + off if off else None

    def _deref(self, p):
        return p + struct.unpack_from('<I', self.buf, p)[0]

    def string(self, i):
        p = self._field(i)
        if p is None:
            return None
        s = self._deref(p)
        n = struct.unpack_from('<I', self.buf, s)[0]
        return self.buf[s + 4:s + 4 + n].decode('utf-8')

    def bytes(self, i):
        p = self._field(i)
        if p is None:
            return b''
        s = self._deref(p)
        n = struct.unpack_from('<I', self.buf, s)[0]
        return self.buf[s + 4:s + 4 + n]

    def long(self, i):
        p = self._field(i)
        return struct.unpack_from('<q', self.buf, p)[0] if p is not None else 0

    def tables(self, i):
        p = self._field(i)
        if p is None:
            return []
        s = self._deref(p)
        n = struct.unpack_from('<I', self.buf, s)[0]
        return [Table(self.buf, self._deref(s + 4 + 4 * k)) for k in range(n)]


def load(path):
    buf = open(path, 'rb').read()
    root = Table(buf, struct.unpack_from('<I', buf, 0)[0])
    files, chunk_home = {}, {}
    for frag in root.tables(0):
        for b in frag.tables(2):
            bh = b.bytes(0).hex()
            for c in b.tables(1):
                chunk_home[c.bytes(0).hex()] = (bh, c.long(2), c.long(1))
        for f in frag.tables(1):
            chunks = [(c.bytes(0).hex(), c.long(1), c.long(2)) for c in f.tables(3)]
            files[f.string(0)] = {'size': f.long(1), 'hash': f.bytes(2).hex(), 'chunks': chunks,
                                  'fragment': frag.string(0)}
    return files, chunk_home


def fetch_range(bundle, offset, size):
    req = urllib.request.Request(CDN + bundle[:2] + '/' + bundle,
                                 headers={'Range': 'bytes=%d-%d' % (offset, offset + size - 1)})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    if len(data) != size:
        raise RuntimeError('short read %d/%d on %s' % (len(data), size, bundle))
    return data


def get(files, chunk_home, name):
    f = files[name]
    # a small file is one chunk whose hash is the file hash; a big one lists its chunks (hash, size, offset in file)
    parts = f['chunks'] or [(f['hash'], f['size'], 0)]
    out = bytearray(f['size'])
    for h, size, off in parts:
        bundle, boff, bsize = chunk_home[h]
        data = fetch_range(bundle, boff, bsize)
        if hashlib.sha1(data).hexdigest() != h:
            raise RuntimeError('chunk hash mismatch for %s' % name)
        out[off:off + size] = data
    if hashlib.sha1(out).hexdigest() != f['hash']:
        raise RuntimeError('file hash mismatch for %s' % name)
    return bytes(out)


if __name__ == '__main__':
    cmd, manifest = sys.argv[1], sys.argv[2]
    files, chunk_home = load(manifest)
    if cmd == 'list':
        sub = sys.argv[3] if len(sys.argv) > 3 else ''
        for n in sorted(files):
            if sub in n:
                print('%s\t%d\t%s\t%d chunks' % (n, files[n]['size'], files[n]['hash'], len(files[n]['chunks'])))
    elif cmd == 'get':
        out_dir = sys.argv[3]
        for name in sys.argv[4:]:
            data = get(files, chunk_home, name)
            dest = os.path.join(out_dir, name)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            open(dest, 'wb').write(data)
            print('ok', name, len(data), hashlib.sha256(data).hexdigest())
