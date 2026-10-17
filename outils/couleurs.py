"""Annoter le catalogue : comment chaque objet prend ses couleurs.

Usage : python3 -I couleurs.py <dossier skinator_local>   (build.py l'appelle aussi après avoir écrit le catalogue)

Lit les étiquettes de data/acc/<cle>.js et ajoute à chaque objet de data/catalogue.js :
- couleurs : « polykrome » (une partie bas / corps / tête : url(#part-…), table _oMapPolykrome du client),
  « perso » (une couleur du perso en direct : url(#slotN)), « fixe » (rien de tout ça) ;
- slots : les numéros de couleur lus en direct ([1, 2] pour le Plan K…), [] sinon.
Objets vivants : l'union de tous les niveaux, comme usage() sans niveau dans index.html.
"""
import json
import os
import re
import sys


def annoter(root):
    cat_path = os.path.join(root, 'data', 'catalogue.js')
    src = open(cat_path, encoding='utf-8').read()
    cat = json.loads(src[src.index('['):src.rindex(']') + 1])
    compte = {}
    for x in cat:
        p = os.path.join(root, 'data', 'acc', x['cle'] + '.js')
        text = ''
        if os.path.exists(p):
            s = open(p, encoding='utf-8').read()
            d = json.loads(s[s.index('{'):s.rindex('}') + 1])
            text = ''.join(d.get('labels', {}).values())
        parts = sorted(set(re.findall(r'#part-(bottom|body|head)\)', text)))
        slots = sorted({int(n) for n in re.findall(r'#slot([123])\)', text)})
        x['couleurs'] = 'polykrome' if parts else 'perso' if slots else 'fixe'
        x['slots'] = slots
        compte[x['couleurs']] = compte.get(x['couleurs'], 0) + 1
    with open(cat_path, 'w', encoding='utf-8') as f:
        f.write('window.SKIN_CATALOGUE = %s;\n' % json.dumps(cat, ensure_ascii=False))
    return compte


if __name__ == '__main__':
    print(annoter(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
