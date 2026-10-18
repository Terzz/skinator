"""Les dragodindes : les modèles, leurs sprites et les 24 persos « chevaucheurs », au format du Skinator.

Usage : python3 -I montures.py <dossier swf> <dossier ffdec> <rides_fr_<v>.swf> <dossier skinator_local>
  <dossier swf>/ch<gfx>.swf (clips/sprites/chevauchor/<gfx>.swf) et <dossier swf>/<m>.swf (clips/sprites/<m>.swf)
  <dossier ffdec>/scripts/<nom>/…, <dossier ffdec>/shapes/<nom>/<id>.svg, <dossier ffdec>/morph/<nom>/<id>.svg

Comme le client (loader.swf, sprite monté @7381553 et @7388369, GAC.registerChevauchor @5288219) :
- le sprite de la dragodinde vient de clips/sprites/<g du modèle>.swf (langue « rides », table RI : n, g, c1, c2, c3) ;
  par pose, deux calques attachés au sprite : « static<P>_Back » (profondeur 10) et « static<P>_Front » (30) ;
- entre les deux (20), un clip « chevauchor » charge clips/sprites/chevauchor/<classe><sexe>.swf et y attache
  « static<P> » : un perso qui porte coiffe, cape, familier et bouclier comme le sprite normal ;
- un clip du calque appelle GAC.registerChevauchor(this) : le chevaucheur prend sa position (ramenée dans le sprite),
  sa rotation et ses échelles ;
- les couleurs de la dragodinde : GAC.applyColor(clip, n, true) lit mount.color<n> (filtres mslot1..3 dans la page).

Écrit data/montures.js (les modèles), data/monture/<g>.js (une dragodinde) et data/chevaucheur/<gfx>.js (un perso) ;
pour le lecteur d'animations, data/montureanim/<g>.js et data/chevaucheuranim/<gfx>.js (format de anim_export.py, plus
l'instruction ['hook'] pour GAC.registerChevauchor(this)).
"""
import json
import math
import os
import re
import sys

SWF, WORK, RIDES, OUT = sys.argv[1:5]
sys.argv = ['build.py', '', '', '', '', '']            # build.py lit ses arguments à l'import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.expanduser('~/Documents/Dofus/DofusSuivi'))
import anim_export, build, evaluate, scripts_index, swfscene
import jeu

POSES = 'SRLFB'
# GAC.applyColor(clip, n, true) : la couleur de la monture (3e argument) ; même filtre que le perso, renommé ensuite
evaluate.RE_COLOR = re.compile(r'^GAC\.applyColor\((\w+),(\d)(?:,true)?\);$')
anim_export.R_COLOR = evaluate.RE_COLOR
_statement = anim_export.statement
anim_export.statement = lambda line: ['hook'] if line == 'GAC.registerChevauchor(this);' else _statement(line)
# les vues du lecteur (fenêtre Caractéristiques) : statiques, marche et course de face, anim 2, plus la course de profil
# sur une dragodinde ; le client attache « <anim><dir>_Back/_Front » à la dragodinde et « <anim><dir> » au cavalier,
# sinon « static<dir> » (@7388369)
ANIM_DRAGO = r'(static[SRLFB]|walkF|run[FS])_(Back|Front)'
ANIM_CAVALIER = r'static[SRLFB]|anim2[RL]'
log = {}


def shapes_dir(nom):
    """Les formes de FFDec, plus les morphshapes (forme de départ, sans <animate>) recopiées à côté."""
    d = os.path.join(WORK, 'shapes', nom)
    morph = os.path.join(WORK, 'morph', nom)
    if os.path.isdir(morph):
        for f in os.listdir(morph):
            dst = os.path.join(d, f)
            if f.endswith('.svg') and not os.path.exists(dst):
                os.makedirs(d, exist_ok=True)
                s = open(os.path.join(morph, f), encoding='utf-8').read()
                open(dst, 'w', encoding='utf-8').write(re.sub(r'<animate\b[^>]*/>', '', s))
    return d


def scene(nom):
    sc = swfscene.load(os.path.join(SWF, nom + '.swf'))
    ev = evaluate.Evaluator(sc, scripts_index.index(os.path.join(WORK, 'scripts', nom)), log)
    build.add_depths(ev)
    orig = ev.instance

    def instance(e, mark, guard, _orig=orig):          # garde le n° de symbole des clips (le clip d'accroche)
        out = _orig(e, mark, guard)
        if isinstance(out, dict) and swfscene.kind(sc, e.get('char')) == 'sprite':
            out['cid'] = e['char']
        return out
    ev.instance = instance
    return sc, ev


def strip(node):
    """Retire les n° de symbole ajoutés pour la recherche (le Writer ne les connaît pas)."""
    if isinstance(node, dict):
        node.pop('cid', None)
        for k in node['c']:
            strip(k)
    return node


def find(node, hooks, m=build.IDENTITY):
    """Le clip qui appelle registerChevauchor : (matrice cumulée jusqu'à lui, sa matrice propre)."""
    if isinstance(node, list):
        return None
    own = node.get('m', build.IDENTITY)
    mm = build.compose(m, own)
    if node.get('cid') in hooks:
        return mm, own
    for k in node['c']:
        r = find(k, hooks, mm)
        if r:
            return r
    return None


def place(hook):
    """chevauchor._x/_y : la position de l'accroche dans le sprite ; _rotation, _xscale, _yscale : les siens."""
    acc, own = hook
    sx, sy = math.hypot(own[0], own[1]), math.hypot(own[2], own[3])
    rot = math.atan2(own[1], own[0])
    c, s = math.cos(rot), math.sin(rot)
    return [round(v, 4) for v in (c * sx, s * sx, -s * sy, c * sy, acc[4], acc[5])]


def write_js(path, kind, key, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('SKIN_ADD(%s, %s, %s);\n' % (json.dumps(kind), json.dumps(key), json.dumps(data, ensure_ascii=False)))


def anim(sc, ev, nom, names, prefix, kind, key):
    """La bibliothèque d'animations d'un SWF : les symboles exportés qui servent aux vues du lecteur."""
    exports = {n: cid for n, cid in sc['exports'].items() if re.fullmatch(names, n)}
    lib = anim_export.library(sc, ev.scripts, list(exports.values()), build.shape_markup, shapes_dir(nom), prefix)
    lib.update(fps=60, exports=exports)
    write_js(os.path.join(OUT, 'data', kind, '%s.js' % key), kind, key, lib)


def main():
    build.with_depth_display_list()
    RI = jeu.load_swf(RIDES)['RI']
    modeles = []
    for k, v in sorted(RI.items(), key=lambda kv: int(kv[0])):
        if not isinstance(v, dict) or 'g' not in v:
            continue
        couleurs = [None if int(v['c%d' % n]) == -1 else int(v['c%d' % n]) for n in (1, 2, 3)]   # -1 : repli du client
        modeles.append({'id': int(k), 'nom': v['n'], 'gfx': int(v['g']), 'couleurs': couleurs})
    gfxs = sorted({m['gfx'] for m in modeles})

    for g in gfxs:
        nom = str(g)
        sc, ev = scene(nom)
        hooks = {cid for (cid, fr), texts in ev.scripts.items() for t in texts if 'registerChevauchor' in t}
        w = build.Writer('m%d' % g, shapes_dir(nom))
        poses = {}
        for p in POSES:
            layers = {}
            for side in ('Back', 'Front'):
                cid = sc['exports'].get('static%s_%s' % (p, side))
                layers[side] = ev.clip(cid) if cid else {'c': []}
            hook = find(layers['Back'], hooks) or find(layers['Front'], hooks)
            if not hook:
                raise SystemExit('%d : pas de clip d\'accroche en static%s' % (g, p))
            pts = []
            for side in ('Back', 'Front'):
                strip(layers[side])
                pts += build.bbox(layers[side], sc)
            xs, ys = [q[0] for q in pts], [q[1] for q in pts]
            poses[p] = {'back': w.node(layers['Back']).replace('url(#slot', 'url(#mslot'),
                        'front': w.node(layers['Front']).replace('url(#slot', 'url(#mslot'),
                        'place': place(hook),
                        'box': [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)]}
        data = {'defs': ''.join(w.shapes.values()) + ''.join(w.cx.values()), 'poses': poses}
        write_js(os.path.join(OUT, 'data', 'monture', '%d.js' % g), 'monture', nom, data)
        anim(sc, ev, nom, ANIM_DRAGO, 'mm%d' % g, 'montureanim', nom)
        print('monture', g, 'accroches', sorted(hooks), 'ko', len(json.dumps(data)) // 1024)

    for c in range(1, 13):
        for s in (0, 1):
            gfx = c * 10 + s
            nom = 'ch%d' % gfx
            sc, ev = scene(nom)
            w = build.Writer('r%d' % gfx, shapes_dir(nom))
            poses = {p: w.node(strip(ev.clip(sc['exports']['static' + p]))) for p in POSES}
            data = {'defs': ''.join(w.shapes.values()) + ''.join(w.cx.values()), 'poses': poses}
            write_js(os.path.join(OUT, 'data', 'chevaucheur', '%d.js' % gfx), 'chevaucheur', str(gfx), data)
            anim(sc, ev, nom, ANIM_CAVALIER, 'mr%d' % gfx, 'chevaucheuranim', str(gfx))
            print('chevaucheur', gfx, 'ko', len(json.dumps(data)) // 1024)

    with open(os.path.join(OUT, 'data', 'montures.js'), 'w', encoding='utf-8') as f:
        f.write('window.SKIN_MONTURES = %s;\n' % json.dumps(modeles, ensure_ascii=False))
    print('modèles', len(modeles), 'dessins', gfxs)
    for k, v in log.items():
        if k.startswith(('play()', 'onClipEvent', 'SOMA.', 'GAC.registerChevauchor')):
            continue
        print('LOG', k[:90], sorted(v)[:8])


if __name__ == '__main__':
    main()
