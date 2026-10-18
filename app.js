// Skinator : le code de la page (index.html). Chargé juste après le premier affichage, après les données (data/*.js) :
// la page s'affiche sans attendre le code.
window.SKIN = { sprite: {}, acc: {}, anim: {}, accanim: {}, monture: {}, chevaucheur: {}, montureanim: {}, chevaucheuranim: {} };
function SKIN_ADD(kind, key, data) { SKIN[kind][key] = data; }
(() => {
  const M = window.SKIN_META, PERSOS = window.SKIN_PERSOS || [], CAT = window.SKIN_CATALOGUE || [];
  const BY_KEY = Object.fromEntries(CAT.map(x => [x.cle, x]));
  const SLOT_NAMES = { 1: 'Coiffe', 2: 'Cape', 3: 'Familier', 4: 'Bouclier' };
  const POSE_NAMES = { F: 'Face', R: '¾ face', S: 'Profil', L: '¾ dos', B: 'Dos' };
  const ROTATIONS = ['F', 'R', 'L', 'B'];                  // l'export PNG
  const state = { classe: 9, sexe: 0, pose: 'R', miroir: false, zoom: 10, fond: 'damier', mode: 'fixe', vue: 0, 
                  acc: { 1: null, 2: { cle: '17_317', niveau: null }, 3: null, 4: null },   // emplacement -> { cle, niveau }
                  colors: { 1: null, 2: null, 3: null },       // null = « défaut » (-1 côté jeu)
                  monture: null };                             // null ou { id : n° du modèle (langue « rides »), came : Caméléone }
  const $ = (s) => document.querySelector(s);
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  // ce qui vient du navigateur ou d'un lien se vérifie : classe connue, couleur 0xRRGGBB, objet du catalogue à sa place
  // (Object.hasOwn : « __proto__ » ou « constructor » ne passent pas pour une classe ou un objet)
  const isClasse = (c) => /^\d{1,2}$/.test(String(c)) && Object.hasOwn(M.classes, String(+c));
  const cleanColor = (v) => Number.isInteger(v) && v >= 0 && v <= 0xFFFFFF ? v : null;
  const itemOf = (cle) => typeof cle === 'string' && Object.hasOwn(BY_KEY, cle) ? BY_KEY[cle] : null;
  function cleanAcc(a, n) {                     // un objet porté valable à l'emplacement n, ou null
    const x = a && typeof a === 'object' ? itemOf(a.cle) : null;
    if (!x || x.emplacement !== n) return null;
    return { cle: x.cle, niveau: x.niveaux ? (x.niveaux.includes(a.niveau) ? a.niveau : x.niveaux[0]) : null };
  }
  const cleanColors = (c) => Object.fromEntries([1, 2, 3].map(n => [n, cleanColor(c && typeof c === 'object' ? c[n] : null)]));
  const cleanAccs = (a) => Object.fromEntries([1, 2, 3, 4].map(n => [n, cleanAcc(a && typeof a === 'object' ? a[n] : null, n)]));
  const joinEt = (l) => l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : l.join('');
  // les dragodindes : 75 modèles (data/montures.js). La Caméléone n'en est pas un : c'est un effet qu'une dragodinde peut
  // avoir ; elle prend alors les couleurs de son cavalier (le serveur envoie « modèle,c1,c2,c3 » : 214 caméléones dans les
  // captures DofusSuivi, toujours couleur II, III, III du perso), sur les Dragodindes de toutes couleurs ; jamais sur le
  // Paladin, le Tabi, le Karnage, le Bouftea Maur (125 joueurs montés), et la Squelette n'y apparaît pas : pas de Caméléone
  // pour eux. La Dragodinde en armure non plus, à sa demande (les captures en montrent 8 sur 45 aux couleurs du cavalier)
  // les 3 Sauvages (Amande, Rousse, Dorée) et la Squelette ne sont montées par aucun des 1 597 joueurs des captures :
  // pas proposées (75 modèles dans la langue, 71 ici)
  const JAMAIS_MONTEES = new Set([1, 6, 74, 75]);
  const MONTURES = (window.SKIN_MONTURES || []).filter(m => !JAMAIS_MONTEES.has(m.id)), MONTURE_BY_ID = Object.fromEntries(MONTURES.map(m => [m.id, m]));
  const SANS_CAMELEONE = new Set([75, 88, 89, 90, 91, 92]);
  function cleanMonture(v) {                    // { id, came } vérifié ; « cameleone » et un simple n° : les formes d'avant
    if (v === 'cameleone') return { id: 20, came: true };          // Dragodinde Amande : toutes les Dragodindes caméléones se ressemblent
    if (Number.isInteger(v)) v = { id: v, came: false };
    return v && typeof v === 'object' && Number.isInteger(v.id) && Object.hasOwn(MONTURE_BY_ID, v.id) ? { id: v.id, came: !!v.came && !SANS_CAMELEONE.has(v.id) } : null;
  }
  const montureOf = (v) => { const c = cleanMonture(v); return c ? { ...MONTURE_BY_ID[c.id], came: c.came } : null; };
  const sameMonture = (a, b) => { const x = cleanMonture(a), y = cleanMonture(b); return !x && !y || !!x && !!y && x.id === y.id && x.came === y.came; };
  const montureName = (m) => m.nom + (m.came ? ' caméléone' : '');
  const itemName = (x) => x.noms.length ? x.noms[0] + (x.noms.length > 1 ? ` (+${x.noms.length - 1})` : '') : `Sans nom (gfx ${x.gfx})`;

  // ---------- chargement à la demande (balises script : marche en file://)
  const pending = {};
  function load(kind, key, src) {
    if (SKIN[kind][key]) return Promise.resolve(SKIN[kind][key]);
    if (!pending[src]) pending[src] = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => ok(SKIN[kind][key]);
      s.onerror = () => ko(new Error(src + ' introuvable'));
      document.head.appendChild(s);
    });
    return pending[src];
  }
  const loadSprite = (g) => load('sprite', String(g), `data/sprite_${g}.js`);
  const loadAcc = (k) => load('acc', k, `data/acc/${k}.js`);
  const loadMonture = (g) => load('monture', String(g), `data/monture/${g}.js`);
  const loadChevaucheur = (g) => load('chevaucheur', String(g), `data/chevaucheur/${g}.js`);

  // ---------- filtres : la façon du client (GAC.applyColor -> Color.setTransform)
  // setTransform({ra:0, rb:R, ga:0, gb:G, ba:0, bb:B, aa:100, ab:0}) : la couleur devient (R,G,B), l'alpha reste.
  function flat(id, color) {
    if (color == null) return `<filter id="${id}"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter>`;
    const r = (color >> 16 & 255) / 255, g = (color >> 8 & 255) / 255, b = (color & 255) / 255;
    return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">` +
           `<feColorMatrix type="matrix" values="0 0 0 0 ${r.toFixed(4)}  0 0 0 0 ${g.toFixed(4)}  0 0 0 0 ${b.toFixed(4)}  0 0 0 1 0"/></filter>`;
  }
  // look = { classe, sexe, colors, acc } : l'éditeur par défaut, un autre perso pour la team
  const gfx = (L = state) => L.classe * 10 + L.sexe;
  const classDefault = (n, L = state) => M.classes[L.classe].defaut[L.sexe][n - 1];
  // Perso : couleur -1 -> rien. Accessoire (clip de clips/sprites/accessories/) : -1 -> couleur de la classe (langue « classes »).
  const accColor = (n, L = state) => L.colors[n] != null ? L.colors[n] : classDefault(n, L);
  // Objet Polykrome : partie -> couleur n selon _oMapPolykrome[gfx], avec le même repli.
  const partColor = (part, L = state) => accColor(M.polykrome[gfx(L)][part], L);
  // Dragodinde : GAC.applyColor(clip, n, true) lit mount.color<n>. Caméléone : 1 = couleur II du cavalier, 2 et 3 = sa
  // couleur III (loader.swf @4827179). Une couleur -1 prend celle de la classe du cavalier : 1 -> c2, 2 et 3 -> c3
  // (hasFallbackColor : sprites 7000 à 7027, @5285845).
  function montureColors(m, L = state) {
    const c = m.came ? [L.colors[2], L.colors[3], L.colors[3]] : m.couleurs;
    return c.map((x, i) => x != null ? x : classDefault(i ? 3 : 2, L));
  }
  function filtersMarkup(L = state) {
    const mo = montureOf(L.monture);
    return (mo ? montureColors(mo, L).map((c, i) => flat('mslot' + (i + 1), c)).join('') : '') +
      [1, 2, 3].map(n => flat('slot' + n, L.colors[n])).join('') +
      [1, 2, 3].map(n => flat('aslot' + n, accColor(n, L))).join('') +
      ['bottom', 'body', 'head'].map(p => flat('part-' + p, partColor(p, L))).join('') +
      '<filter id="opaque" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 255 0"/></filter>';
  }

  // Traits : Flash dessine un trait plus fin qu'un pixel écran à 1 pixel. Les formes partagées (<use>) sont recopiées
  // sur place pour donner à chaque trait sa largeur : max(1 px, largeur d'origine × échelle × zoom).
  function hairlines(svg, root, zoom) {
    root.querySelectorAll('use').forEach(u => {
      const src = svg.querySelector('[id="' + (u.getAttribute('href') || '').slice(1) + '"]');
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      if (u.hasAttribute('transform')) g.setAttribute('transform', u.getAttribute('transform'));
      if (src) for (const c of src.childNodes) g.appendChild(c.cloneNode(true));
      u.replaceWith(g);
    });
    const inv = root.getCTM().inverse();
    root.querySelectorAll('[data-sw]').forEach(p => {
      if (p.getAttribute('vector-effect') === 'non-scaling-stroke') return;    // trait « sans mise à l'échelle » : déjà 1 px
      const m = inv.multiply(p.getCTM()), k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) * zoom;
      if (k > 0) p.setAttribute('stroke-width', (Math.max(1, +p.dataset.sw * k) / k).toFixed(4));
    });
  }

  // ---------- dessin d'une pose dans un <svg> (aperçu ou export)
  async function draw(svg, pose, miroir, zoom, L = state) {
    const g = gfx(L);
    const keys = Object.values(L.acc).filter(Boolean).map(a => a.cle);
    const mo = montureOf(L.monture);
    const [spr, mt, ...accs] = await Promise.all([mo ? loadChevaucheur(g) : loadSprite(g), mo && loadMonture(mo.gfx), ...keys.map(loadAcc)]);
    const flip = miroir ? ' transform="scale(-1,1)"' : '';
    // sur une dragodinde (loader.swf @7388369) : son calque arrière, le perso « chevaucheur » posé sur le clip qui appelle
    // GAC.registerChevauchor, puis son calque avant
    const P = mt && mt.poses[pose];
    const body = P ? `<g>${P.back}</g><g transform="matrix(${P.place.join(',')})">${spr.poses[pose]}</g><g>${P.front}</g>` : spr.poses[pose];
    svg.innerHTML = `<defs class="filters">${filtersMarkup(L)}</defs><defs>${spr.defs}${mt ? mt.defs : ''}${accs.map(a => a.defs).join('')}</defs>` +
                    `<g class="root"${flip}>${body}</g>`;
    // applyAccessory : attachMovie("type_gfx", "clip", 10), gotoAndStop(étiquette + niveau de l'objet vivant) ; inconnue -> image 1
    const posed = [];
    svg.querySelectorAll('[data-acc]').forEach(el => {
      if (mo && el.dataset.acc === '3') return;  // le familier ne monte pas : 1 597 joueurs montés dans les captures, aucun familier
      const want = L.acc[el.dataset.acc];
      const a = want && SKIN.acc[want.cle];
      if (!a) return;
      const target = el.dataset.label + (want.niveau != null ? want.niveau : '');
      const lab = a.labels[target] != null ? target : Object.keys(a.labels)[0];
      el.innerHTML = a.labels[lab].replaceAll('url(#slot', 'url(#aslot');
      posed.push(`${itemName(BY_KEY[want.cle])} « ${lab} »`);
    });
    const root = svg.querySelector('.root');
    hairlines(svg, root, zoom);
    // familier : applyAccessory(…, true) -> _x = -_x quand le perso est retourné (directions 3, 4, 7)
    svg.querySelectorAll('[data-flipx]').forEach(el => {
      const m = el.dataset.flipx.split(',').map(Number);
      if (miroir) m[4] = -m[4];
      el.setAttribute('transform', `matrix(${m.join(',')})`);
    });
    const bb = root.getBBox();
    const box = miroir ? { x0: -(bb.x + bb.width), x1: -bb.x } : { x0: bb.x, x1: bb.x + bb.width };
    return { x0: box.x0, x1: box.x1, y0: bb.y, y1: bb.y + bb.height, posed };
  }
  const FRAME = { x0: -27, y0: -52, x1: 27, y1: 10 };    // cadre fixe (px du jeu) : la taille ne saute pas d'une pose à l'autre
  const FRAME_MONTE = { x0: -36, y0: -84, x1: 36, y1: 12 };     // le même, sur une dragodinde
  const union = (a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
  function frame(svg, b, zoom) {
    const x0 = b.x0 - 1, y0 = b.y0 - 1, w = b.x1 - b.x0 + 2, h = b.y1 - b.y0 + 2;
    svg.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`);
    svg.setAttribute('width', Math.round(w * zoom));
    svg.setAttribute('height', Math.round(h * zoom));
  }

  let renderId = 0;
  async function render() {
    const id = ++renderId;
    setStatus('Chargement…');
    const mo = montureOf(state.monture);
    syncUI();
    if (state.mode === 'anim') return player.show(id);
    player.stop();
    let r;
    try { r = await draw($('#stage'), state.pose, state.miroir, state.zoom); }
    catch (e) { if (id === renderId) setStatus(e.message); return; }
    if (id !== renderId) return;
    frame($('#stage'), union(mo ? FRAME_MONTE : FRAME, r), state.zoom);
    const cls = M.classes[state.classe].nom + (state.sexe ? ' femelle' : ' mâle');
    setStatus(`${cls} · ${POSE_NAMES[state.pose]}${state.miroir ? ' · miroir' : ''}${mo ? ' · ' + montureName(mo) : ''}`);
  }
  function refreshFilters() {           // changer une couleur ne refait que les filtres
    const f = $('#stage .filters');
    if (f) f.innerHTML = filtersMarkup();
    save();
  }

  // ---------- animation : la fenêtre Caractéristiques du jeu (SpriteViewer de loader.swf, @4826619).
  // Un clic sur le perso passe à la vue suivante, dans cet ordre, et chaque animation boucle (setAnim(…, true, true) :
  // GAC.applyAnim rejoue l'animation en cours). Directions du client : F = 2, R = 1, L = 5, jamais retournées.
  const VIEWS = [['static', 'F', 'Statique, face'], ['static', 'R', 'Statique, ¾ face'], ['static', 'L', 'Statique, ¾ dos'],
                 ['walk', 'F', 'Marche, face'], ['run', 'F', 'Course, face'], ['anim2', 'R', 'Anim 2, ¾ face'], ['anim2', 'L', 'Anim 2, ¾ dos']];
  // sur une dragodinde, la course de profil en plus, après la course de face (pas dans la fenêtre du jeu)
  const VIEWS_MONTE = [...VIEWS.slice(0, 5), ['run', 'S', 'Course, profil'], ...VIEWS.slice(5)];
  const viewsOf = () => montureOf(state.monture) ? VIEWS_MONTE : VIEWS;
  const FRAME_ANIM = { x0: -34, y0: -66, x1: 34, y1: 12 };
  const FRAME_ANIM_MONTE = { x0: -40, y0: -90, x1: 40, y1: 14 };
  const ID = [1, 0, 0, 1, 0, 0];
  const loadAnim = (g) => load('anim', String(g), `data/anim/${g}.js`);
  const loadAccAnim = (k) => load('accanim', k, `data/accanim/${k}.js`);
  const loadMontureAnim = (g) => load('montureanim', String(g), `data/montureanim/${g}.js`);
  const loadChevaucheurAnim = (g) => load('chevaucheuranim', String(g), `data/chevaucheuranim/${g}.js`);
  // ce que joue le lecteur : le perso et ses objets ; sur une dragodinde, le perso « chevaucheur » et la dragodinde
  async function animLibs() {
    const keys = Object.values(state.acc).filter(Boolean).map(a => a.cle), mo = montureOf(state.monture);
    const [lib, mlib] = await Promise.all([mo ? loadChevaucheurAnim(gfx()) : loadAnim(gfx()), mo && loadMontureAnim(mo.gfx), ...keys.map(loadAccAnim)]);
    return { lib, mlib, keys };
  }
  const compose = (p, c) => [p[0] * c[0] + p[2] * c[1], p[1] * c[0] + p[3] * c[1], p[0] * c[2] + p[2] * c[3], p[1] * c[2] + p[3] * c[3],
                             p[0] * c[4] + p[2] * c[5] + p[4], p[1] * c[4] + p[3] * c[5] + p[5]];
  const fmt = (v) => +v.toFixed(4);
  const matAttr = (m) => (m === ID || (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0)) ? '' : ` transform="matrix(${m.map(fmt).join(',')})"`;

  // liste d'affichage d'une image d'un symbole (rejouée depuis l'image 0, gardée en cache) ; chaque placement a une
  // clé : un même morceau reste le même objet (et garde sa couleur) tant que le scénario ne le remplace pas
  function dlOf(def, f) {
    def._dl = def._dl || [];
    if (def._dl[f]) return def._dl[f];
    const dl = new Map(f > 0 ? dlOf(def, f - 1) : []);
    (def.f[f] || []).forEach((op, j) => {
      if (op.r !== undefined) { dl.delete(op.r); return; }
      const cur = dl.get(op.d);
      if (op.mv && cur) {
        const e = { ...cur };
        if (op.c !== undefined && op.c !== cur.c) { e.c = op.c; e.key = f + ':' + j; }
        if (op.m) e.m = op.m; if (op.x) e.x = op.x; if (op.n) e.n = op.n; if (op.k) e.k = op.k;
        dl.set(op.d, e);
      } else dl.set(op.d, { c: op.c, m: op.m || ID, x: op.x || null, n: op.n || null, k: op.k || null, key: f + ':' + j });
    });
    return (def._dl[f] = dl);
  }

  class Clip {
    constructor(P, lib, id, parent, kind = '') {
      this.P = P; this.lib = lib; this.def = lib.sprites[id]; this.n = this.def.f.length; this.parent = parent;
      this.frame = -1; this.playing = true; this.kids = new Map(); this.color = null; this.att = null; this.kind = kind;
      this.born = P.tickN;
    }
    child(name) { for (const k of this.kids.values()) if (k.e.n === name) return k; return null; }
    setFrame(f, q) {
      f = Math.max(0, Math.min(this.n - 1, f));
      if (f === this.frame) return false;
      const kids = new Map();
      for (const [d, e] of dlOf(this.def, f)) {
        const old = this.kids.get(d);
        if (old && old.e.key === e.key) { kids.set(d, { e, inst: old.inst }); continue; }
        const inst = this.lib.sprites[e.c] ? new Clip(this.P, this.lib, e.c, this, this.kind) : null;
        kids.set(d, { e, inst });
        if (inst) inst.setFrame(0, q);
      }
      for (const [d, k] of this.kids) if (k.inst && kids.get(d)?.inst !== k.inst) k.inst.dead = true;
      this.kids = kids; this.frame = f;
      q.push([this, f]);
      return true;
    }
  }

  const player = {
    tickN: 0, raf: 0, root: null, lastAnim: undefined, cx: new Map(),
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.root = null; $('#stagebox').classList.remove('anim'); },
    async show(id) {
      cancelAnimationFrame(this.raf); this.raf = 0;
      const V = viewsOf();
      if (state.vue >= V.length) state.vue = 0;
      const view = V[state.vue];
      let L;
      try { L = await animLibs(); }
      catch (e) { if (id === renderId) setStatus(e.message); return; }
      if (id !== renderId) return;
      this.svg = $('#stage');
      this.prepare(L);
      frame(this.svg, L.mlib ? FRAME_ANIM_MONTE : FRAME_ANIM, state.zoom * 0.8);
      $('#stagebox').classList.add('anim');
      this.start(view);
      const cls = M.classes[state.classe].nom + (state.sexe ? ' femelle' : ' mâle');
      const mo = montureOf(state.monture);
      setStatus(`${cls} · animée, vue ${state.vue + 1}/${V.length} : ${view[2]}${mo ? ' · ' + montureName(mo) : ''} · clic sur le perso : vue suivante`);
      let last = performance.now(), acc = 0;
      const loop = (t) => {
        acc += Math.min(250, t - last); last = t;
        let n = 0;
        while (acc >= 1000 / 60 && n < 8) { this.tick(); acc -= 1000 / 60; n++; }
        if (n) this.paint();
        this.raf = requestAnimationFrame(loop);
      };
      this.paint();
      this.raf = requestAnimationFrame(loop);
    },
    prepare({ lib, mlib, keys }) {
      this.lib = lib; this.mlib = mlib || null;
      this.cx = new Map();
      this.svg.innerHTML = `<defs class="filters">${filtersMarkup()}</defs><defs class="cx"></defs>` +
        `<defs>${lib.defs}${mlib ? mlib.defs : ''}${keys.map(k => SKIN.accanim[k].defs).join('')}</defs><g class="root"></g>`;
    },
    start(view) {
      this.view = view;
      if (this.mlib) return this.startMonte(view);
      this.root = new Clip(this, this.lib, this.lib.exports[view[0] + view[1]], null);
      this.run(q => this.root.setFrame(0, q));
    },
    // sur une dragodinde (loader.swf @7388369) : « <vue>_Back » de la dragodinde (profondeur 10), le chevaucheur qui joue
    // « <vue> » (20), « <vue>_Front » (30) ; ce qui manque est remplacé par la pose fixe de la même direction. Le
    // chevaucheur suit à chaque image le clip qui appelle GAC.registerChevauchor (le client le replace à chaque image).
    startMonte(view) {
      const [anim, dir] = view, ml = this.mlib, rl = this.lib;
      const pick = (lib, name, alt) => lib.exports[name] ?? lib.exports[alt];
      const root = { n: 1, frame: 0, playing: false, kids: new Map(), att: null, parent: null, born: this.tickN, lib: rl, monte: true, child: () => null };
      for (const [d, lib, id, kind] of [[10, ml, pick(ml, `${anim}${dir}_Back`, `static${dir}_Back`), 'm'],
                                        [20, rl, pick(rl, anim + dir, 'static' + dir), ''],
                                        [30, ml, pick(ml, `${anim}${dir}_Front`, `static${dir}_Front`), 'm']])
        if (id !== undefined) root.kids.set(d, { e: { m: ID }, inst: new Clip(this, lib, id, root, kind) });
      this.root = root; this.hook = null;
      this.run(q => { for (const k of root.kids.values()) k.inst.setFrame(0, q); });
    },
    placeRider() {
      const h = this.hook, rider = this.root && this.root.monte && this.root.kids.get(20);
      if (!h || h.dead || !rider) return;
      let m = ID, own = null;
      for (let c = h; c && c.parent; c = c.parent) {
        const k = [...c.parent.kids.values()].find(x => x.inst === c);
        if (!k) return;                         // l'accroche n'est plus à l'image
        if (!own) own = k.e.m || ID;
        m = compose(k.e.m || ID, m);
      }
      // chevauchor._x/_y : la position de l'accroche ramenée dans le sprite ; _rotation, _xscale, _yscale : les siens
      const sx = Math.hypot(own[0], own[1]), sy = Math.hypot(own[2], own[3]), r = Math.atan2(own[1], own[0]);
      rider.e = { m: [Math.cos(r) * sx, Math.sin(r) * sx, -Math.sin(r) * sy, Math.cos(r) * sy, m[4], m[5]] };
    },
    run(fn) {                                   // une étape, puis les scripts des images atteintes (dans l'ordre)
      const q = [];
      this.depth = (this.depth || 0) + 1;
      fn(q);
      for (let i = 0; i < q.length && i < 4000; i++) {
        const [c, f] = q[i];
        if (c.dead || c.frame !== f) continue;
        const ops = c.def.s[f];
        if (ops) this.exec(c, ops, q);
      }
      this.depth--;
      if (this.again && this.depth === 0) { this.again = false; this.lastAnim = this.view[0]; this.start(this.view); }
      if (this.depth === 0 && this.mlib) this.placeRider();
    },
    tick() {
      this.tickN++;
      this.run(q => this.advance(this.root, q));
    },
    advance(c, q) {
      if (c.playing && c.n > 1) c.setFrame(c.frame + 1 >= c.n ? 0 : c.frame + 1, q);
      for (const k of c.kids.values()) if (k.inst && k.inst.born < this.tickN && !k.inst.dead) this.advance(k.inst, q);
      if (c.att && c.att.born < this.tickN) this.advance(c.att, q);
    },
    exec(c, ops, q) {
      for (const op of ops) {
        switch (op[0]) {
          case 'color': case 'part': {
            const k = c.child(op[1]);
            if (k && k.inst) k.inst.color = op[0] === 'color' ? { slot: op[2] } : { part: op[2] };
            break;
          }
          case 'acc': this.attach(c, op[1], op[2], op[3], op[4]); break;
          case 'anim': this.again = true; break;
          case 'stop': c.playing = false; break;
          case 'play': c.playing = true; break;
          case 'parentPlay': if (c.parent) c.parent.playing = true; break;
          case 'hook': this.hook = c; break;     // GAC.registerChevauchor(this)
          case 'goto': {
            const t = op[2];
            const f = t[0] === 'label' ? c.def.l[t[1]] : t[0] === 'frame' ? t[1] : Math.floor(Math.random() * t[1]) + t[2];
            c.playing = !!op[1];
            if (f !== undefined) c.setFrame(f, q);
            break;
          }
          case 'if': {
            const k = op[1];
            const ok = k[0] === 'lastAnim' ? (k[1] === '!==' ? this.lastAnim !== k[2] : this.lastAnim === k[2])
              : k[0] === 'rand' ? ((r) => k[2] === '==' ? r === k[3] : r !== k[3])(Math.floor(Math.random() * k[1]))
              : k[0] === 'true';
            this.exec(c, ok ? op[2] : op[3], q);
            break;
          }
        }
      }
    },
    // GAC.applyAccessory : attachMovie("type_gfx", "clip", 10) (son image 1 joue tout de suite), gotoAndStop(étiquette
    // + niveau) ; avec une coiffe, la tête désignée (_parent.X_Tete) passe à l'image 2
    attach(c, slot, label, flip, head) {
      c.att = null;
      if (slot === 3 && this.mlib) return;      // le familier ne monte pas sur la dragodinde
      const want = state.acc[slot], lib = want && SKIN.accanim[want.cle];
      if (!lib) return;
      const a = new Clip(this, lib, lib.root, c, 'a');
      this.run(q => a.setFrame(0, q));
      const target = label + (want.niveau != null ? want.niveau : '');
      const f = a.def.l[target];
      a.playing = false;
      if (f !== undefined) this.run(q => a.setFrame(f, q));
      c.att = a;
      if (head && slot === 1 && c.parent) {
        const h = c.parent.child(head);
        if (h && h.inst) { h.inst.playing = false; this.run(q => h.inst.setFrame(1, q)); }
      }
    },
    cxId(x) {
      const key = x.join(',');
      if (!this.cx.has(key)) {
        const id = 'acx' + this.cx.size;
        const v = [x[0], 0, 0, 0, x[4] / 255, 0, x[1], 0, 0, x[5] / 255, 0, 0, x[2], 0, x[6] / 255, 0, 0, 0, x[3], x[7] / 255].map(fmt).join(' ');
        this.svg.querySelector('.cx').insertAdjacentHTML('beforeend', `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${v}"/></filter>`);
        this.cx.set(key, id);
      }
      return this.cx.get(key);
    },
    markup(c) {
      const list = [...c.kids.entries()].filter(([d]) => !(c.att && d === 10));
      if (c.att) list.push([10, { att: c.att }]);
      list.sort((a, b) => a[0] - b[0]);
      let out = '';
      for (let i = 0; i < list.length;) {
        const k = list[i][1];
        if (k.e && k.e.k) {                     // masque : cache les profondeurs suivantes jusqu'à k
          const upto = k.e.k, group = [];
          let j = i + 1;
          while (j < list.length && list[j][0] <= upto) group.push(list[j++][1]);
          const id = 'amk' + (this.maskN++);
          out += `<mask id="${id}" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-500" y="-500" width="1000" height="1000">` +
            `<g filter="url(#opaque)">${this.one(k, c)}</g></mask><g mask="url(#${id})">${group.map(g => this.one(g, c)).join('')}</g>`;
          i = j;
          continue;
        }
        out += this.one(k, c);
        i++;
      }
      return out;
    },
    one(k, parent) {
      if (k.att) return `<g>${this.markup(k.att)}</g>`;
      const e = k.e, inst = k.inst;
      let f = '';
      if (inst && inst.color) f = inst.color.slot ? ` filter="url(#${inst.kind}slot${inst.color.slot})"` : ` filter="url(#part-${inst.color.part})"`;
      else if (e.x) f = ` filter="url(#${this.cxId(e.x)})"`;
      if (inst) return `<g${matAttr(e.m)}${f}>${this.markup(inst)}</g>`;
      if (!parent.lib.shapes.includes(e.c)) return '';
      const use = `<use href="#${parent.lib.prefix}_${e.c}"${f ? '' : matAttr(e.m)}/>`;
      return f ? `<g${matAttr(e.m)}${f}>${use}</g>` : use;
    },
    paint() {
      if (!this.root) return;
      this.maskN = 0;
      const g = this.svg.querySelector('.root');
      if (g) g.innerHTML = this.markup(this.root);
    },
  };
  // zoom réel : le perso est réduit quand il ne tient pas dans le cadre, l'étiquette le dit
  function showZoom() {
    const st = $('#stage'), w = +st.getAttribute('width'), r = st.getBoundingClientRect().width;
    const eff = w && r ? state.zoom * Math.min(1, r / w) : state.zoom;
    $('#zoomv').textContent = '×' + (Math.abs(eff - Math.round(eff)) < 0.05 ? Math.round(eff) : eff.toFixed(1).replace('.', ','));
  }
  new ResizeObserver(showZoom).observe($('#stage'));
  $('#stagebox').addEventListener('keydown', (e) => {
    if (state.mode === 'anim' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#stagebox').click(); }
  });
  $('#stagebox').addEventListener('click', () => {
    if (state.mode !== 'anim') return;
    const V = viewsOf();
    player.lastAnim = (V[state.vue] || V[0])[0];
    state.vue = (state.vue + 1) % V.length;
    render();
  });

  function setStatus(t) { const st = $('#status'); st.textContent = t; st.title = t; }   // coupé par « … » sur ordinateur : le texte entier en title

  // ---------- équipement
  function equipUI() {
    $('#equip').innerHTML = Object.entries(SLOT_NAMES).map(([n, what]) => {
      const a = state.acc[n], x = a && BY_KEY[a.cle];
      const lvl = x && x.niveaux ? `<label class="lvl">Niveau <select data-lvl="${n}">${x.niveaux.map(v =>
        `<option value="${v}"${v === a.niveau ? ' selected' : ''}>${v + 1}</option>`).join('')}</select></label>` : '';
      const nm = x ? esc(itemName(x)) : 'rien';
      return `<div class="slot" data-slot="${n}">
        <button class="pick" data-pick="${n}"${x ? ` title="${nm}"` : ''}><span class="thumb">${x && x.vignette ? `<img src="svg/vignettes/${x.cle}.svg" alt="" width="42" height="42">` : ''}</span>
          <span class="txt"><span class="what">${what}${n === '3' && x && montureOf(state.monture) ? ' · pas sur la dragodinde' : ''}</span><span class="name">${x ? nm : '—'}</span><span class="sr">, changer</span></span></button>${lvl}
        ${x ? `<button data-off="${n}" aria-label="Enlever : ${nm}">${CROSS}</button>` : ''}</div>`;
    }).join('') + montureTile();
    $('#equip').querySelectorAll('[data-pick]').forEach(b => b.onclick = () => openPicker(+b.dataset.pick));
    $('#equip').querySelectorAll('[data-off]').forEach(b => b.onclick = () => {
      const n = b.dataset.off;
      if (n === '5') state.monture = null; else { state.acc[n] = null; touched(); }      // la monture ne change pas le skin
      equipUI(); render();
      const t = document.querySelector(`[data-pick="${n}"]`); if (t) t.focus();   // le focus reste sur la tuile
    });
    $('#equip').querySelectorAll('[data-lvl]').forEach(s => s.onchange = () => { state.acc[s.dataset.lvl].niveau = +s.value; touched(); render(); });
  }
  const CROSS = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  // la monture : une tuile de plus, sur toute la largeur ; son aperçu se dessine quand la dragodinde est chargée
  function montureTile() {
    const mo = montureOf(state.monture), nm = mo ? esc(montureName(mo)) : 'aucune';
    if (mo && !SKIN.monture[mo.gfx]) loadMonture(mo.gfx).then(() => { if (sameMonture(state.monture, mo)) equipUI(); }).catch(() => {});
    return `<div class="slot monture" data-slot="5">
        <button class="pick" data-pick="5"${mo ? ` title="${esc(montureName(mo))}"` : ''}><span class="thumb">${mo ? montureThumb(mo) : ''}</span>
          <span class="txt"><span class="what">Monture</span><span class="name">${mo ? nm : '—'}</span><span class="sr">, changer</span></span></button>
        ${mo ? `<button data-off="5" aria-label="Enlever : ${nm}">${CROSS}</button>` : ''}</div>`;
  }
  // aperçu d'une dragodinde seule, à ses couleurs, de ¾ face : un petit <svg> qui reprend ses formes, posées une seule
  // fois dans la page ; chaque aperçu a ses propres filtres
  let thumbN = 0;
  function montureThumb(mo, L = state) {
    const mt = SKIN.monture[mo.gfx]; if (!mt) return '';
    if (!document.getElementById('mdefs-' + mo.gfx))
      document.body.insertAdjacentHTML('beforeend', `<svg id="mdefs-${mo.gfx}" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${mt.defs}</defs></svg>`);
    const id = 'mt' + (++thumbN), P = mt.poses.R, b = P.box;
    const fix = (str) => str.replace(/url\(#mslot(\d)\)/g, `url(#${id}-$1)`);
    return `<svg viewBox="${b[0] - 1} ${b[1] - 1} ${b[2] - b[0] + 2} ${b[3] - b[1] + 2}" aria-hidden="true"><defs>${montureColors(mo, L).map((c, i) => flat(`${id}-${i + 1}`, c)).join('')}</defs>${fix(P.back)}${fix(P.front)}</svg>`;
  }
  const touched = () => { $('#perso').value = ''; };   // le skin n'est plus celui du perso choisi
  let pickerSlot = null, pickerFor = null;      // pickerFor : null = l'éditeur ; { i } = le perso i + 2 de la team
  const pickerCurrent = () => { const a = pickerFor ? teamAccOf(pickerFor.i)[pickerSlot] : state.acc[pickerSlot]; return a && a.cle; };
  const MONTURE_SLOT = 5;                       // le choix d'objet sert aussi pour la monture
  const modal = (on) => { $('.wrap').inert = on; document.body.style.overflow = on ? 'hidden' : ''; };   // fond inerte, sans défilement
  function openPicker(slot, target = null) {
    pickerSlot = slot; pickerFor = target; pickerFilter = '';       // chaque ouverture repart de « Tous »
    const mnt = slot === MONTURE_SLOT;
    const what = mnt ? 'Monture' : SLOT_NAMES[slot];
    $('#pickerTitle').textContent = target ? `${what} · Perso ${target.i + 2}` : what;
    $('#pickerNone').textContent = target ? 'Comme le modèle' : mnt ? 'Aucune' : 'Rien';
    $('#pickerAucun').textContent = mnt ? 'Aucune' : 'Aucun';
    $('#pickerFilter').hidden = mnt; $('#pickerCame').hidden = !mnt;
    if (mnt) { const cur = montureOf(target ? teamMontureOf(target.i) : state.monture); pickerCame = !!(cur && cur.came); }
    $('#pickerSearch').placeholder = mnt ? 'Nom' : 'Nom ou numéro';
    if (mnt) Promise.all([...new Set(MONTURES.map(m => m.gfx))].map(loadMonture))     // les 7 dessins, puis leurs aperçus
      .then(() => { if (pickerSlot === MONTURE_SLOT) fillPicker(); }).catch(() => {});
    $('#pickerAucun').hidden = !target;
    $('#pickerSearch').value = '';
    $('#picker').classList.add('open');
    if (target) $('#teambox').inert = true; else modal(true);
    fillPicker();
    const g = $('#pickerGrid'); g.style.paddingRight = Math.max(0, 14 - (g.offsetWidth - g.clientWidth)) + 'px';
    const cur = $('#pickerGrid [aria-current="true"]');
    g.scrollTop = 0; if (cur) { cur.scrollIntoView({ block: 'center' }); g.scrollTop = Math.round(g.scrollTop); }   // l'objet porté en vue, sur un pixel entier
    $('#pickerSearch').focus();
  }
  function closePicker() {
    const slot = pickerSlot, target = pickerFor;
    $('#picker').classList.remove('open'); pickerSlot = null; pickerFor = null;
    if (target) $('#teambox').inert = false; else modal(false);
    setTimeout(() => {                          // le focus revient à la tuile qui a ouvert (après sa reconstruction)
      const b = document.querySelector(target ? `[data-tpick="${target.i}-${slot}"]` : `[data-pick="${slot}"]`); if (b) b.focus();
    });
  }
  // comment l'objet prend ses couleurs (champ « couleurs » du catalogue, outils/couleurs.py)
  let pickerFilter = '';
  const colorTag = (x) => x.couleurs === 'polykrome' ? 'Polykrome'
    : x.couleurs === 'perso' ? (x.slots.length > 1 ? `couleurs ${joinEt(x.slots)}` : `couleur ${x.slots[0]}`) : '';
  function fillPicker() {
    const q = $('#pickerSearch').value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (pickerSlot === MONTURE_SLOT) return fillMontures(q);
    const cur = pickerCurrent();
    const ofSlot = CAT.filter(x => x.emplacement === pickerSlot);
    const list = ofSlot.filter(x => !pickerFilter || x.couleurs === pickerFilter)
      .filter(x => !q || (x.noms.join(' | ') + ' ' + x.cle + ' ' + x.gfx).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
      .sort((a, b) => b.gfx - a.gfx);
    $('#pickerFilter').querySelectorAll('button').forEach(b => {
      const n = ofSlot.filter(x => !b.dataset.v || x.couleurs === b.dataset.v).length;
      b.setAttribute('aria-pressed', String(b.dataset.v === pickerFilter)); b.disabled = !n && b.dataset.v !== pickerFilter;
    });
    $('#pickerCount').textContent = `${list.length} objet${list.length > 1 ? 's' : ''}`;
    $('#pickerGrid').innerHTML = list.map(x => `<button class="card" data-key="${x.cle}" aria-current="${x.cle === cur}" title="${esc(x.noms.join('\n') || x.cle)}">
      <div class="pic">${x.vignette ? `<img loading="lazy" src="svg/vignettes/${x.cle}.svg" alt="" width="96" height="78">` : ''}</div>
      <div class="nm">${esc(itemName(x))}</div><div class="id">${[x.cle, x.niveaux ? 'objet vivant' : '', colorTag(x)].filter(Boolean).join(' · ')}</div></button>`).join('');
  }
  // les modèles dans l'ordre du jeu, avec leurs couleurs ou en Caméléone (les couleurs II et III du perso) ; sous chacun
  // ses trois couleurs. Pour un perso de la team, la Caméléone prend ses couleurs à lui
  let pickerCame = false;
  function pickerLook() {
    const m = pickerFor && teamMembers.find(x => x.i === pickerFor.i);
    return m ? { classe: m.classe, sexe: m.sexe, colors: { ...m.d } } : state;
  }
  function fillMontures(q) {
    const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const cur = pickerFor ? teamMontureOf(pickerFor.i) : state.monture, L = pickerLook();
    const list = MONTURES.filter(m => !pickerCame || !SANS_CAMELEONE.has(m.id)).map(m => ({ ...m, came: pickerCame })).filter(m => !q || norm(m.nom).includes(q));
    const grid = $('#pickerGrid'), top = grid.scrollTop;
    $('#pickerCame').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === '1') === pickerCame)));
    $('#pickerCount').textContent = `${list.length} monture${list.length > 1 ? 's' : ''}`;
    grid.innerHTML = list.map(m => `<button class="card" data-mid="${m.id}" aria-current="${sameMonture(m, cur)}" title="${esc(montureName(m))}">
      <div class="pic">${montureThumb(m, L)}</div><div class="nm">${esc(m.nom)}</div>
      <div class="id">${m.came || m.gfx === 7002 ? `<span class="sw">${montureColors(m, L).map(c => `<i style="background:${hex(c)}"></i>`).join('')}</span>` : ''}</div></button>`).join('');
    grid.scrollTop = top;                       // les aperçus arrivent après : la liste ne saute pas
  }
  $('#pickerCame').querySelectorAll('button').forEach(b => b.onclick = () => { pickerCame = b.dataset.v === '1'; fillPicker(); });
  $('#pickerFilter').querySelectorAll('button').forEach(b => b.onclick = () => { pickerFilter = b.dataset.v; fillPicker(); });
  $('#pickerGrid').onclick = (e) => {
    const c = e.target.closest('.card'); if (!c) return;
    if (c.dataset.mid) {                        // une monture
      const v = { id: +c.dataset.mid, came: pickerCame };
      if (pickerFor) { const i = pickerFor.i; closePicker(); return setTeamMonture(i, v); }
      state.monture = v; closePicker(); equipUI(); render(); return;
    }
    const x = BY_KEY[c.dataset.key], a = { cle: x.cle, niveau: x.niveaux ? x.niveaux[0] : null };
    if (pickerFor) {                            // le même objet vivant que le modèle : au même niveau
      const i = pickerFor.i, sl = pickerSlot, md = teamModel.acc[sl];
      if (md && md.cle === x.cle) a.niveau = md.niveau;
      closePicker(); return setTeamAcc(i, sl, a);
    }
    state.acc[pickerSlot] = a;
    touched(); closePicker(); equipUI(); render();
  };
  $('#pickerSearch').oninput = fillPicker;
  $('#pickerClose').onclick = closePicker;
  $('#pickerNone').onclick = () => {
    if (pickerFor) { const i = pickerFor.i, sl = pickerSlot; closePicker(); return sl === MONTURE_SLOT ? setTeamMonture(i, undefined) : setTeamAcc(i, sl, undefined); }   // comme le modèle
    if (pickerSlot === MONTURE_SLOT) state.monture = null; else { state.acc[pickerSlot] = null; touched(); }
    closePicker(); equipUI(); render();
  };
  $('#pickerAucun').onclick = () => { if (pickerFor) { const i = pickerFor.i, sl = pickerSlot; closePicker(); sl === MONTURE_SLOT ? setTeamMonture(i, null) : setTeamAcc(i, sl, null); } };
  $('#picker').onclick = (e) => { if (e.target.id === 'picker') closePicker(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pickerSlot) { e.stopImmediatePropagation(); closePicker(); } });

  // ---------- interface
  function syncUI() {
    $('#classe').value = state.classe;
    document.querySelectorAll('#sexe button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === state.sexe)));
    document.querySelectorAll('#pose button').forEach(b => b.setAttribute('aria-pressed', String(state.mode !== 'anim' && b.dataset.v === state.pose)));
    document.querySelectorAll('#fond button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === state.fond)));
    document.querySelectorAll('#mode button').forEach(b => b.setAttribute('aria-pressed', String(state.mode === 'anim')));
    const nv = viewsOf().length;                // 8 vues sur une dragodinde (la course de profil en plus)
    $('#pnganim .sub').textContent = `Les ${nv} vues sur une planche`; $('#gif .sub').textContent = `Les ${nv} vues qui bougent, en boucle`;
    $('#stagebox').dataset.fond = state.fond;
    const anim = state.mode === 'anim', sb = $('#stagebox');
    if (anim) { sb.tabIndex = 0; sb.setAttribute('role', 'button'); sb.setAttribute('aria-label', 'Vue suivante'); }
    else { sb.removeAttribute('tabindex'); sb.removeAttribute('role'); sb.removeAttribute('aria-label'); }
    $('#miroir').checked = state.miroir;
    $('#miroir').disabled = anim; $('#miroir').closest('label').classList.toggle('dim', anim);   // l'animation ignore le miroir
    $('#zoom').value = state.zoom; showZoom();
    document.querySelectorAll('.color').forEach(row => {
      const n = +row.dataset.slot, c = state.colors[n];
      const [pick, txt] = row.querySelectorAll('input[type=color], input[type=text]');
      const chk = row.querySelector('input[type=checkbox]');
      pick.value = hex(c != null ? c : classDefault(n)); if (document.activeElement !== txt) txt.value = c != null ? hex(c) : 'défaut';
      pick.disabled = txt.disabled = c == null; chk.checked = c == null;
    });
    save();
  }
  function save() { store.set('skinator_local_v2', JSON.stringify(state)); }
  function restore() {
    try {
      const s = JSON.parse(store.get('skinator_local_v2') || 'null');
      if (!s || typeof s !== 'object' || !isClasse(s.classe)) return;
      Object.assign(state, {
        classe: +s.classe, sexe: s.sexe ? 1 : 0, colors: cleanColors(s.colors), acc: cleanAccs(s.acc),
        pose: 'FRSLB'.includes(s.pose) && s.pose ? s.pose : state.pose, miroir: !!s.miroir,
        mode: s.mode === 'anim' ? 'anim' : 'fixe', vue: Number.isInteger(s.vue) && s.vue >= 0 && s.vue < 8 ? s.vue : 0,
        zoom: Number.isInteger(s.zoom) && s.zoom >= 2 && s.zoom <= 16 ? s.zoom : state.zoom,
        fond: ['damier', 'clair', 'sombre', 'herbe'].includes(s.fond) ? s.fond : state.fond, monture: cleanMonture(s.monture) });
    } catch (e) {}
  }

  for (const [c, v] of Object.entries(M.classes)) $('#classe').insertAdjacentHTML('beforeend', `<option value="${c}">${v.nom}</option>`);
  $('#perso').addEventListener('change', e => {
    const v = e.target.value;
    if (v.startsWith('s:')) { const k = loadSkins().find(x => x.id === v.slice(2)); if (k) openSkin(k); return; }
    const p = PERSOS[v]; if (!p) return;
    state.classe = Math.floor(p.gfx / 10); state.sexe = p.gfx % 10;
    p.couleurs.forEach((x, i) => state.colors[i + 1] = x == null ? null : parseInt(x.slice(1), 16));
    for (const n of Object.keys(SLOT_NAMES)) {
      const q = (p.equip || [])[n];
      state.acc[n] = q && BY_KEY[q.cle] ? { cle: q.cle, niveau: q.niveau ?? null } : null;
    }
    equipUI(); render();
  });
  // ---------- idées de couleurs : une fenêtre comme le choix d'objet. Chaque idée est dessinée sur le perso affiché
  // (classe, sexe et stuff du moment : « Sur mon stuff », par défaut) ou avec son propre stuff (« Avec leur stuff ») ;
  // un clic met ses couleurs (et, avec leur stuff, sa classe et ses objets). Les aperçus se dessinent quand ils
  // apparaissent, gardés tant que le perso et le stuff ne changent pas.
  const CAPTURE = { nom: 'Comme ta capture', groupe: 'Comme ta capture', classe: 9, sexe: 0, couleurs: ['#f5e3ff', '#332d40', '#f5e3ff'],
                    acc: { 1: { cle: '16_346', niveau: null }, 2: { cle: '17_317', niveau: null }, 3: { cle: '18_91', niveau: null }, 4: { cle: '82_216', niveau: null } } };
  let ideesP = null;                            // data/idees.js : à la première ouverture (ou au repos, après le démarrage)
  const loadIdees = () => ideesP || (ideesP = new Promise((ok, ko) => {
    if (window.SKIN_IDEES) return ok();
    const sc = document.createElement('script'); sc.src = 'data/idees.js';
    sc.onload = () => ok(); sc.onerror = () => { ideesP = null; ko(new Error('data/idees.js introuvable')); };
    document.head.appendChild(sc);
  }));
  const ideas = () => (window.SKIN_IDEES || []).map((d, i) => ({ ...d, i, groupe: d.groupe || 'Stuff et couleurs' })).concat([{ ...CAPTURE, i: 'capture' }]);
  const ideaGroups = () => {                    // l'ordre voulu (SKIN_IDEES_ORDRE), sinon la série la plus récente en premier
    const seen = [...new Set((window.SKIN_IDEES || []).map(d => d.groupe || 'Stuff et couleurs'))];
    const ord = window.SKIN_IDEES_ORDRE || [], g = ord.length ? ord.filter(x => seen.includes(x)).concat(seen.filter(x => !ord.includes(x))) : seen.reverse();
    return g.concat(['Comme ta capture']);
  };
  let ideaMode = 'mien', ideaToken = 0;
  const ideaShots = new Map();                  // aperçu déjà dessiné, par look
  const ideaHex = (d) => d.couleurs.map(x => parseInt(x.slice(1), 16));
  function ideaLook(d) {
    const c = ideaHex(d), colors = { 1: c[0], 2: c[1], 3: c[2] };
    return ideaMode === 'mien' ? { classe: state.classe, sexe: state.sexe, colors, acc: JSON.parse(JSON.stringify(state.acc)) }
                               : { classe: d.classe, sexe: d.sexe, colors, acc: JSON.parse(JSON.stringify(d.acc)) };
  }
  const ideaCurrent = (d) => { const c = ideaHex(d); return [1, 2, 3].every(n => state.colors[n] === c[n - 1]) &&
    (ideaMode === 'mien' || (state.classe === d.classe && state.sexe === d.sexe && [1, 2, 3, 4].every(n => sameItem(state.acc[n], d.acc[n])))); };
  function fillIdeas() {
    const q = $('#ideaSearch').value.trim().toLowerCase().replace(/^#/, ''), g = $('#ideaGroup').value;
    const list = ideas().filter(d => (!g || d.groupe === g) && (!q || d.nom.toLowerCase().includes(q) || d.couleurs.some(x => x.slice(1).includes(q))));
    $('#ideaCount').textContent = `${list.length} idée${list.length > 1 ? 's' : ''}`;
    const tok = ++ideaToken;
    let html = '';
    for (const grp of ideaGroups()) {
      const part = list.filter(d => d.groupe === grp); if (!part.length) continue;
      if (!g) html += `<div class="igroup caps">${esc(grp)} <span class="igcount">${part.length}</span></div>`;
      html += part.map(d => {
        const src = ideaShots.get(JSON.stringify(ideaLook(d)));
        return `<button class="icard" data-idea="${d.i}" title="${esc(d.nom)} · ${d.couleurs.join(' / ').toUpperCase()}"${ideaCurrent(d) ? ' aria-current="true"' : ''}>
          <span class="pic">${src ? `<img src="${src}" alt="">` : ''}</span><span class="nm">${esc(d.nom)}</span>
          <span class="sw">${d.couleurs.map(x => `<i style="background:${x}"></i>`).join('')}</span></button>`;
      }).join('');
    }
    $('#ideaGrid').innerHTML = html || '<p class="meta">Aucune idée ne correspond.</p>';
    const byI = new Map(ideas().map(d => [String(d.i), d]));
    $('#ideaGrid').querySelectorAll('.icard').forEach(c => { c.onclick = () => pickIdea(byI.get(c.dataset.idea)); });
    drainIdeas(tok, byI);
  }
  // Aperçus : d'une idée à l'autre, seules les couleurs changent. Le perso est dessiné une fois par classe, sexe et
  // stuff (un gabarit), puis chaque idée n'est que ce gabarit avec ses filtres de couleur, en fichier SVG (blob) que le
  // navigateur affiche quand la carte apparaît : quelques dixièmes de milliseconde par carte au lieu d'un dessin entier
  const ideaTemplates = new Map();
  function ideaTemplate(look) {
    const key = JSON.stringify([look.classe, look.sexe, look.acc]);
    if (!ideaTemplates.has(key)) ideaTemplates.set(key, (async () => {
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
      document.body.appendChild(holder);
      try {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); holder.appendChild(svg);
        const r = await draw(svg, 'R', false, 3, look);
        frame(svg, { x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1 }, 3);
        // les formes partagées ont été recopiées sur place (hairlines) : leurs définitions ne servent plus
        svg.querySelectorAll('defs:not(.filters) > g[id]').forEach(g => g.remove());
        const str = svgString(svg), i = str.indexOf('<defs class="filters">'), j = str.indexOf('</defs>', i) + 7;
        return { head: str.slice(0, i), tail: str.slice(j) };
      } finally { holder.remove(); }
    })().catch((e) => { ideaTemplates.delete(key); throw e; }));
    return ideaTemplates.get(key);
  }
  async function ideaShot(look) {
    const t = await ideaTemplate(look);
    const blob = new Blob([t.head, `<defs class="filters">${filtersMarkup(look)}</defs>`, t.tail], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }
  async function drainIdeas(tok, byI) {         // les cartes visibles d'abord, puis les autres de haut en bas
    const live = () => tok === ideaToken && $('#ideabox').classList.contains('open');
    const grid = $('#ideaGrid'), gr = grid.getBoundingClientRect();
    const cards = [...grid.querySelectorAll('.icard')].filter(c => !c.querySelector('img'));
    const seen = (c) => { const r = c.getBoundingClientRect(); return r.bottom >= gr.top && r.top <= gr.bottom; };
    const order = cards.filter(seen).concat(cards.filter(c => !seen(c)));
    for (let k = 0; k < order.length && live(); k++) {
      const c = order[k], look = ideaLook(byI.get(c.dataset.idea)), key = JSON.stringify(look);
      let src = ideaShots.get(key);
      if (!src) { try { src = await ideaShot(look); ideaShots.set(key, src); } catch (e) { c.dataset.fail = '1'; continue; } }
      if (!live()) return;
      c.querySelector('.pic').innerHTML = `<img src="${src}" alt="" decoding="async">`;
      if (k % 48 === 47) await new Promise(r => setTimeout(r));     // la fenêtre reste fluide pendant qu'elle se remplit
    }
  }
  function pickIdea(d) {
    if (ideaMode === 'leur') {
      if (d.i === 'capture') { closeIdeas(); return capture(); }
      state.classe = d.classe; state.sexe = d.sexe;
      for (const n of Object.keys(SLOT_NAMES)) state.acc[n] = d.acc[n] && BY_KEY[d.acc[n].cle] ? { ...d.acc[n] } : null;
    }
    const c = ideaHex(d); state.colors = { 1: c[0], 2: c[1], 3: c[2] };
    $('#perso').value = ''; closeIdeas(); equipUI(); render();
  }
  async function openIdeas() {
    await loadIdees().catch(() => {});
    const g = $('#ideaGroup'), keep = g.value;
    g.innerHTML = `<option value="">Toutes les séries (${ideas().length})</option>` + ideaGroups().map(x =>
      `<option value="${esc(x)}">${esc(x)} (${ideas().filter(d => d.groupe === x).length})</option>`).join('');
    g.value = keep;
    $('#ideaMode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ideaMode)));
    $('#ideabox').classList.add('open'); modal(true); fillIdeas();
    const cur = $('#ideaGrid [aria-current="true"]'); if (cur) { cur.scrollIntoView({ block: 'center' }); $('#ideaGrid').scrollTop = Math.round($('#ideaGrid').scrollTop); }
    $('#ideaSearch').focus();
  }
  function closeIdeas() { $('#ideabox').classList.remove('open'); ideaToken++; modal(false); $('#idee').focus(); }
  $('#idee').onclick = openIdeas;
  $('#ideaClose').onclick = closeIdeas;
  $('#ideabox').onclick = (e) => { if (e.target.id === 'ideabox') closeIdeas(); };
  $('#ideaSearch').oninput = fillIdeas;
  $('#ideaGroup').onchange = () => { fillIdeas(); $('#ideaGrid').scrollTop = 0; };
  $('#ideaMode').querySelectorAll('button').forEach(b => b.onclick = () => {
    ideaMode = b.dataset.v; $('#ideaMode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fillIdeas();
  });
  $('#classe').addEventListener('change', e => { state.classe = +e.target.value; $('#perso').value = ''; render(); });
  document.querySelectorAll('#sexe button').forEach(b => b.onclick = () => { state.sexe = +b.dataset.v; $('#perso').value = ''; render(); });
  document.querySelectorAll('#pose button').forEach(b => b.onclick = () => { state.pose = b.dataset.v; state.mode = 'fixe'; render(); });
  document.querySelectorAll('#fond button').forEach(b => b.onclick = () => { state.fond = b.dataset.v; syncUI(); });
  $('#miroir').onchange = e => { state.miroir = e.target.checked; render(); };
  $('#mode button').onclick = () => { state.mode = state.mode === 'anim' ? 'fixe' : 'anim'; state.vue = 0; render(); };
  $('#zoom').oninput = e => { state.zoom = +e.target.value; render(); };
  $('#reset').onclick = () => { state.colors = { 1: null, 2: null, 3: null }; touched(); syncUI(); refreshFilters(); };
  $('#nothing').onclick = () => { state.acc = { 1: null, 2: null, 3: null, 4: null }; state.monture = null; touched(); equipUI(); render(); };
  function capture() {                          // « Comme ta capture » (menu Idées)
    state.classe = 9; state.sexe = 0; state.pose = 'F'; state.miroir = false; state.mode = 'fixe';
    state.colors = { 1: 0xf5e3ff, 2: 0x332d40, 3: 0xf5e3ff };
    state.acc = { 1: { cle: '16_346', niveau: null }, 2: { cle: '17_317', niveau: null }, 3: { cle: '18_91', niveau: null }, 4: { cle: '82_216', niveau: null } };
    $('#perso').value = ''; equipUI(); render();
  }
  document.querySelectorAll('.color').forEach(row => {
    const n = +row.dataset.slot;
    const [pick, txt] = row.querySelectorAll('input[type=color], input[type=text]');
    const chk = row.querySelector('input[type=checkbox]');
    pick.addEventListener('input', () => { state.colors[n] = parseInt(pick.value.slice(1), 16); touched(); syncUI(); refreshFilters(); });
    txt.addEventListener('change', () => syncUI());
    txt.addEventListener('input', () => {
      const m = txt.value.trim().match(/^#?([0-9a-f]{6})$/i);
      if (m) { state.colors[n] = parseInt(m[1], 16); touched(); syncUI(); refreshFilters(); }
    });
    chk.addEventListener('change', () => { state.colors[n] = chk.checked ? null : classDefault(n); touched(); syncUI(); refreshFilters(); });
  });

  // ---------- team : mêmes objets Polykrome sur chaque perso
  // Chaque sprite envoie ses couleurs 1-3 vers les parties bas / corps / tête d'un objet Polykrome selon sa propre table
  // (_oMapPolykrome du client, M.polykrome) : la tête prend la couleur 1 sur un Crâ, la 3 sur un Enutrof. Les 24 tables
  // sont des permutations de 1-2-3 : pour chaque perso il existe donc un jeu de 3 couleurs qui redonne, partie par
  // partie, ce que le modèle affiche.
  const PARTS = ['bottom', 'body', 'head'], TEAM_MAX = 8;
  const clsName = (c, s) => M.classes[c].nom + (s ? ' F' : ' M');
  // l'orientation des persos de la team (aperçus et PNG), retenue par le navigateur
  let teamPose = (() => { const v = store.get('skinator_team_pose'); return v && 'FRSLB'.includes(v) && v.length === 1 ? v : 'F'; })();
  let team = (() => { try { const t = JSON.parse(store.get('skinator_team_v1') || '[]'); return Array.isArray(t) ? t : []; } catch (e) { return []; } })();
  let teamModel = null, teamMembers = [], teamToken = 0, shotChain = Promise.resolve();
  // ce que l'objet lit, au niveau porté pour un objet vivant : parties Polykrome, couleurs du perso en direct
  function usage(key, niveau = null) {
    const a = SKIN.acc[key]; if (!a) return { parts: [], slots: [] };
    const keys = Object.keys(a.labels), lvl = niveau == null ? [] : keys.filter(k => k.replace(/^\D*/, '') === String(niveau));
    const text = (lvl.length ? lvl : keys).map(k => a.labels[k]).join('');
    return { parts: PARTS.filter(p => text.includes(`#part-${p})`)), slots: [1, 2, 3].filter(n => text.includes(`#slot${n})`)) };
  }
  function memberOf(v) {                        // « n:Nom » : un de mes persos, par son nom ; « c:3:0 » : classe 3, mâle
    const s = String(v || ''), k = s.slice(0, 2);
    const p = k === 'n:' ? PERSOS.find(q => q.nom === s.slice(2)) : k === 'p:' ? PERSOS[+s.slice(2)] : null;   // « p:3 » : ancien rang
    if (p) return M.classes[Math.floor(p.gfx / 10)] ? { nom: p.nom, classe: Math.floor(p.gfx / 10), sexe: p.gfx % 10 } : null;
    const [, a, b] = s.split(':');
    return k === 'c:' && M.classes[+a] ? { nom: null, classe: +a, sexe: +b ? 1 : 0 } : null;
  }
  // une entrée de team : { qui: 'n:Nom', acc: { 3: {cle, niveau} | null, 4: … } } (clé absente : comme le modèle) ;
  // les anciennes entrées texte (« n:Nom », « p:3 ») restent lues
  function entryOf(v) {                         // vérifiée : seuls le familier et le bouclier, des objets du catalogue
    if (!v) return null;
    if (typeof v === 'string') return { qui: v, acc: {} };
    if (typeof v !== 'object') return null;
    const acc = {}, a = v.acc && typeof v.acc === 'object' ? v.acc : {};
    for (const sl of [3, 4]) if (Object.hasOwn(a, sl)) { if (a[sl] === null) acc[sl] = null; else { const c = cleanAcc(a[sl], sl); if (c) acc[sl] = c; } }
    const out = { qui: typeof v.qui === 'string' ? v.qui : '', acc };
    if (Object.hasOwn(v, 'monture')) { if (v.monture === null) out.monture = null; else { const c = cleanMonture(v.monture); if (c) out.monture = c; } }
    return out;
  }
  const saveTeam = () => store.set('skinator_team_v1', JSON.stringify(team));
  const OWN_SLOTS = [3, 4];                     // familier, bouclier : propres à chaque perso ; coiffe et cape : le modèle
  function teamAccOf(i) {                       // ce que porte le perso i + 2
    const e = entryOf(team[i]), acc = JSON.parse(JSON.stringify(teamModel.acc));
    if (e) for (const sl of OWN_SLOTS) if (sl in e.acc) acc[sl] = e.acc[sl];
    return acc;
  }
  function teamMontureOf(i) {                   // la monture du perso i + 2 : la sienne, sinon celle du modèle
    const e = entryOf(team[i]);
    return e && Object.hasOwn(e, 'monture') ? e.monture : teamModel.monture;
  }
  function setTeamMonture(i, v) {               // v : une monture ; null : aucune ; undefined : comme le modèle
    const e = entryOf(team[i]) || { qui: '', acc: {} };
    if (v === undefined) delete e.monture; else e.monture = v;
    team[i] = e; saveTeam(); renderMembers(); drawTeam();
  }
  function setTeamAcc(i, slot, a) {             // a : un objet ; null : aucun ; undefined : comme le modèle
    const e = entryOf(team[i]) || { qui: '', acc: {} };
    if (a === undefined) delete e.acc[slot]; else e.acc[slot] = a;
    team[i] = e; saveTeam(); renderMembers(); drawTeam();
  }
  const sameItem = (a, b) => (!a && !b) || (!!a && !!b && a.cle === b.cle && (a.niveau ?? null) === (b.niveau ?? null));
  function itemsOf(acc, model) {                // ce que lisent les objets portés (repris du modèle quand c'est le même)
    return [1, 2, 3, 4].map(n => {
      const a = acc[n]; if (!a) return null;
      if (model && sameItem(a, model.acc[n]) && model.bySlot[n]) return model.bySlot[n];
      return { slot: n, cle: a.cle, niveau: a.niveau, nom: itemName(BY_KEY[a.cle]), ...usage(a.cle, a.niveau) };
    }).filter(Boolean);
  }
  const defOf = (m, n) => M.classes[m.classe].defaut[m.sexe][n - 1];
  const shown = (m, n) => m.d[n] != null ? m.d[n] : defOf(m, n);               // couleur que reçoivent les objets
  const chipHtml = (m, n) => `<div class="tcol"><i style="background:${hex(shown(m, n))}"></i><span>Couleur ${n}</span><code>${m.d[n] != null ? hex(m.d[n]).toUpperCase() : 'défaut'}</code></div>`;
  function solveTeam(model, m) {
    const mA = M.polykrome[model.classe * 10 + model.sexe], mB = M.polykrome[m.classe * 10 + m.sexe];
    const d = { 1: null, 2: null, 3: null }, from = {};                       // from[n] : case du modèle d'où vient d[n]
    const put = (n, k) => { d[n] = model.c[k]; from[n] = k; };
    if (!model.parts.length) [1, 2, 3].forEach(n => put(n, n));               // rien de Polykrome : mêmes couleurs
    else {
      for (const p of model.parts) put(mB[p], mA[p]);                          // 1. ce que montrent les Polykrome portés
      for (const it of (m.items || model.items).filter(it => !m.acc || sameItem(m.acc[it.slot], model.acc[it.slot])))   // 2. un objet du modèle
        if (it.slots.length && it.slots.every(n => from[n] == null || d[n] === model.c[n]))   // en direct, seulement
          it.slots.forEach(n => { if (from[n] == null) put(n, n); });          //    s'il peut sortir pareil en entier
      const used = new Set(Object.values(from));                               // 3. cases libres : les couleurs du modèle pas
      for (const n of [1, 2, 3]) if (from[n] == null) {                        //    encore prises (la palette reste entière),
        const p = PARTS.find(q => mB[q] === n);                                //    dans l'ordre Polykrome, sinon la même case
        const k = [mA[p], n, 1, 2, 3].find(i => !used.has(i));
        put(n, k); used.add(k);
      }
    }
    // une couleur laissée « défaut » chez le modèle reste « défaut » quand la classe du perso donne la même : en jeu, -1
    for (const n of [1, 2, 3]) if (model.own[from[n]] == null && d[n] === defOf(m, n)) d[n] = null;
    return d;
  }
  // rendu de face d'un autre perso, hors écran, sans toucher à l'éditeur ; un portrait d'une liste périmée est sauté
  function shot(look, valid, zoom = 3, pose = 'F', serre = false) {   // valid() : faux si la fenêtre a changé ; serre : cadré au plus près
    return (shotChain = shotChain.then(async () => {
      if (!valid()) return null;
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
      document.body.appendChild(holder);
      try {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); holder.appendChild(svg);
        const r = await draw(svg, pose, false, zoom, look);
        frame(svg, serre ? { x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1 } : union(FRAME, r), zoom);
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString(svg));
      } finally { holder.remove(); }
    }).catch(() => null));
  }
  function memberOptions(sel) {
    const mine = PERSOS.map((q, i) => M.classes[Math.floor(q.gfx / 10)] ? `<option value="n:${esc(q.nom)}"${sel === 'n:' + q.nom || sel === 'p:' + i ? ' selected' : ''}>${esc(q.nom)} · ${clsName(Math.floor(q.gfx / 10), q.gfx % 10)}</option>` : '').join('');
    const cls = Object.entries(M.classes).flatMap(([c, v]) => [0, 1].map(s =>
      `<option value="c:${c}:${s}"${sel === `c:${c}:${s}` ? ' selected' : ''}>${v.nom} ${s ? 'femelle' : 'mâle'}</option>`)).join('');
    return `<option value="">— personne —</option>${mine ? `<optgroup label="Mes persos">${mine}</optgroup>` : ''}<optgroup label="Classes">${cls}</optgroup>`;
  }
  function renderMembers() {                    // les menus Perso 2 à 8 et, pour chacun, ses tuiles familier / bouclier
    const tile = (i, sl) => {
      const e = entryOf(team[i]), own = !!e && sl in e.acc, a = own ? e.acc[sl] : teamModel.acc[sl], x = a && itemOf(a.cle);
      const what = SLOT_NAMES[sl] + (own ? '' : ' · modèle'), name = x ? itemName(x) : 'aucun';
      return `<button class="mtile" data-tpick="${i}-${sl}" title="${esc(what + ' : ' + name)}" aria-label="${SLOT_NAMES[sl]} du perso ${i + 2} : ${esc(name)}${own ? '' : ', comme le modèle'}">
        <span class="thumb">${x && x.vignette ? `<img src="svg/vignettes/${x.cle}.svg" alt="" width="26" height="26">` : ''}</span>
        <span class="txt"><span class="what">${esc(what)}</span><span class="name">${esc(name)}</span></span></button>`;
    };
    const mtile = (i) => {
      const e = entryOf(team[i]), own = !!e && Object.hasOwn(e, 'monture'), mo = montureOf(own ? e.monture : teamModel.monture);
      if (mo && !SKIN.monture[mo.gfx]) loadMonture(mo.gfx).then(() => { if ($('#teambox').classList.contains('open')) renderMembers(); }).catch(() => {});
      const m = teamMembers.find(x => x.i === i), L = m ? { classe: m.classe, sexe: m.sexe, colors: { ...m.d } } : state;
      const what = 'Monture' + (own ? '' : ' · modèle'), name = mo ? montureName(mo) : 'aucune';
      return `<button class="mtile monture" data-tpick="${i}-${MONTURE_SLOT}" title="${esc(what + ' : ' + name)}" aria-label="Monture du perso ${i + 2} : ${esc(name)}${own ? '' : ', comme le modèle'}">
        <span class="thumb">${mo ? montureThumb(mo, L) : ''}</span>
        <span class="txt"><span class="what">${esc(what)}</span><span class="name">${esc(name)}</span></span></button>`;
    };
    const modele = (teamModel.nom ? esc(teamModel.nom) + ' · ' : '') + clsName(teamModel.classe, teamModel.sexe);
    $('#teamMembers').innerHTML = `<div class="member"><span>Perso 1 · modèle</span><span class="fixed" title="${modele}">${modele}</span></div>` +
      Array.from({ length: TEAM_MAX - 1 }, (_, i) => {
        const e = entryOf(team[i]);
        return `<div class="member"><label for="tm${i}">Perso ${i + 2}</label><select id="tm${i}" data-m="${i}">${memberOptions(e && e.qui)}</select>
          ${e && memberOf(e.qui) ? `<div class="mtiles">${OWN_SLOTS.map(sl => tile(i, sl)).join('')}${mtile(i)}</div>` : ''}</div>`;
      }).join('');
    $('#teamMembers').querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const i = +sel.dataset.m, e = entryOf(team[i]) || { qui: '', acc: {} };
      e.qui = sel.value; team[i] = e.qui || Object.keys(e.acc).length ? e : null;   // ses objets propres restent à sa ligne
      saveTeam(); renderMembers(); drawTeam();
      const again = $(`#tm${i}`); if (again) again.focus();
    });
    $('#teamMembers').querySelectorAll('[data-tpick]').forEach(b => b.onclick = () => {
      const [i, sl] = b.dataset.tpick.split('-').map(Number); openPicker(sl, { i });
    });
  }
  async function openTeam() {
    try { const t = JSON.parse(store.get('skinator_team_v1') || '[]'); if (Array.isArray(t)) team = t; } catch (e) {}
    const worn = Object.values(state.acc).filter(Boolean);
    await Promise.all(worn.map(a => loadAcc(a.cle))).catch(() => null);
    const bySlot = {};
    for (const n of [1, 2, 3, 4]) { const a = cleanAcc(state.acc[n], n); bySlot[n] = a ? { slot: n, cle: a.cle, niveau: a.niveau, nom: itemName(BY_KEY[a.cle]), ...usage(a.cle, a.niveau) } : null; }
    const items = Object.values(bySlot).filter(Boolean);
    const pv = $('#perso').value, p = pv.startsWith('s:') ? loadSkins().find(x => x.id === pv.slice(2)) : PERSOS[pv];
    teamModel = { nom: p ? p.nom : null, classe: state.classe, sexe: state.sexe, own: { ...state.colors }, items, bySlot,
                  acc: JSON.parse(JSON.stringify(state.acc)), monture: cleanMonture(state.monture),
                  c: { 1: accColor(1), 2: accColor(2), 3: accColor(3) }, parts: [...new Set(items.flatMap(i => i.parts))] };
    renderMembers(); syncTeamPose();
    $('#teambox').classList.add('open'); modal(true);
    await drawTeam();
    const first = $('#teamMembers select'); if (first) first.focus();
  }
  async function drawTeam() {
    const token = ++teamToken, model = teamModel;
    const entries = team.slice(0, TEAM_MAX - 1).map(entryOf);
    const own = entries.flatMap(e => e ? OWN_SLOTS.map(sl => e.acc[sl]).filter(Boolean) : []);
    await Promise.all(own.map(a => loadAcc(a.cle))).catch(() => null);      // pour lire leurs couleurs (usage)
    if (token !== teamToken) return;
    const members = [{ ...model, model: true, d: model.own }]
      .concat(entries.map((e, i) => e && memberOf(e.qui) ? { ...memberOf(e.qui), i, acc: teamAccOf(i), monture: teamMontureOf(i) } : null).filter(Boolean)
        .map(m => { m.items = itemsOf(m.acc, model); m.d = solveTeam(model, m); return m; }));
    teamMembers = members;
    // ce qui sort pareil sur toute la team, ce qui change
    const same = [], differs = [];
    const nm = (m) => esc(m.nom || clsName(m.classe, m.sexe));
    for (const it of model.items) {                                      // chez ceux qui portent le même objet
      if (!it.parts.length && !it.slots.length) continue;                  // couleurs fixes : pareil partout, rien à dire
      const others = members.filter(m => !m.model && !(it.slot === 3 && montureOf(m.monture)));   // un familier ne monte pas
      const wear = others.filter(m => sameItem(m.acc[it.slot], model.acc[it.slot]));
      const off = wear.filter(m => it.slots.some(n => shown(m, n) !== model.c[n]));
      const not = others.filter(m => !wear.includes(m)), sauf = not.length ? ` (remplacé chez ${not.map(nm).join(', ')})` : '';
      const which = it.slots.length > 1 ? `les couleurs ${joinEt(it.slots)}` : `la couleur ${it.slots[0]}`;
      (off.length ? differs : same).push(off.length ? `${esc(it.nom)} (prend ${which} du perso : change sur ${off.map(nm).join(', ')})${sauf}` : esc(it.nom) + sauf);
    }
    $('#teamSame').innerHTML = !model.parts.length
      ? 'Le modèle ne porte rien de Polykrome : rien à aligner, chaque perso reprend ses couleurs.'
      : (same.length ? `Pareil sur toute la team : <b>${same.join('</b>, <b>')}</b>.` : '') +
        (differs.length ? ` Change d'un perso à l'autre : ${differs.join(' ; ')}.` : '');
    const ownLine = (m) => {                    // ce que ce perso porte à la place du modèle
      const t = OWN_SLOTS.filter(sl => !sameItem(m.acc[sl], model.acc[sl]))
        .map(sl => `${SLOT_NAMES[sl]} : ${m.acc[sl] && itemOf(m.acc[sl].cle) ? esc(itemName(itemOf(m.acc[sl].cle))) : 'aucun'}`);
      if (!sameMonture(m.monture, model.monture)) t.push(`Monture : ${montureOf(m.monture) ? esc(montureName(montureOf(m.monture))) : 'aucune'}`);
      return t.length ? `<div class="own">${t.join('<br>')}</div>` : '';
    };
    const chip = chipHtml;
    $('#teamGrid').innerHTML = members.map((m, i) => `<div class="tcard">
      ${m.model ? '' : `<button class="tdel" data-del="${m.i}" title="Retirer de la team" aria-label="Retirer ${nm(m)} de la team"><i><svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></i></button>`}
      <div class="pic"><img alt="${esc((m.nom ? m.nom + ', ' : '') + clsName(m.classe, m.sexe))}, ${POSE_NAMES[teamPose].toLowerCase()}"></div>
      <div class="nm">${esc(m.nom || clsName(m.classe, m.sexe))}</div>
      <div class="cl">${[m.nom ? clsName(m.classe, m.sexe) : '', m.model ? 'modèle' : ''].filter(Boolean).join(' · ') || '&nbsp;'}</div>
      <div class="tcols">${[1, 2, 3].map(n => chip(m, n)).join('')}</div>
      ${m.model ? '' : ownLine(m)}
      ${m.model ? '' : `<button class="btn small" data-open="${i}">Ouvrir ce perso</button>`}</div>`).join('');
    // retirer : les suivants remontent. Le second clic d'un double-clic (detail > 1) tomberait sur la croix du perso
    // suivant, remonté à la même place : il est ignoré, comme tout clic pendant le redessin
    $('#teamGrid').querySelectorAll('[data-del]').forEach((b, k) => b.onclick = async (e) => {
      if (e.detail > 1 || drawTeam.busy) return;
      drawTeam.busy = true;
      try {
        team = team.slice(0, TEAM_MAX - 1); team.splice(+b.dataset.del, 1);   // rien d'invisible au-delà du 8e ne remonte
        saveTeam(); renderMembers(); await drawTeam();
      } finally { drawTeam.busy = false; }
      const del = $('#teamGrid').querySelectorAll('[data-del]'); (del[k] || del[k - 1] || $('#teamPng')).focus();
    });
    $('#teamGrid').querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const m = members[+b.dataset.open];
      state.classe = m.classe; state.sexe = m.sexe; state.colors = { ...m.d }; state.acc = JSON.parse(JSON.stringify(m.acc || model.acc));
      state.monture = cleanMonture(m.monture);
      $('#perso').value = ''; closeTeam(); equipUI(); render();
    });
    members.forEach((m, i) => shot({ classe: m.classe, sexe: m.sexe, colors: { ...m.d }, acc: m.acc || model.acc, monture: m.monture }, () => token === teamToken, 3, teamPose).then(src => {
      if (token !== teamToken || !src) return;
      const img = $('#teamGrid').querySelectorAll('.tcard img')[i]; if (img) img.src = src;
    }));
  }
  function syncTeamPose() { $('#teamPose').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === teamPose))); }
  $('#teamPose').querySelectorAll('button').forEach(b => b.onclick = () => {
    if (b.dataset.v === teamPose) return;
    teamPose = b.dataset.v; store.set('skinator_team_pose', teamPose); syncTeamPose(); drawTeam();
  });
  function closeTeam() { $('#teambox').classList.remove('open'); teamToken++; modal(false); $('#team').focus(); }
  $('#team').onclick = () => openTeam();
  $('#teamClose').onclick = closeTeam;
  $('#teambox').onclick = (e) => { if (e.target.id === 'teambox') closeTeam(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#teambox').classList.contains('open') && !pickerSlot) closeTeam(); });

  // ---------- pipette : les 3 couleurs relevées sur une capture du perso en jeu. Le jeu pose chaque couleur en aplat
  // (Color.setTransform) : à l'intérieur d'une zone colorée, le pixel EST le code. Capture agrandie (2 px d'écran ou plus
  // par pixel) : on voit chaque pixel, le pixel visé est pris tel quel. Sinon, il est pris s'il touche un pixel de la même
  // couleur (un liseré d'1 px compte), et sur un bord adouci c'est la couleur qui pèse le plus autour (7 × 7 px, les
  // pixels proches comptent plus). La capture reste dans le navigateur.
  // rôle de chaque couleur, relevé sur les 24 sprites (1 rouge, 2 vert, 3 bleu, face et dos)
  const ROLES = {
    10: ['Tunique', 'Bottes', 'Cheveux'], 11: ['Robe', 'Bottes', 'Cheveux'],
    20: ['Cornes · tunique', 'Cheveux · gants · bottes', 'Peau'], 21: ['Bonnet · robe', 'Cheveux · gants · bottes', 'Peau'],
    30: ['Tenue', 'Ceinture · sandales', 'Barbe'], 31: ['Robe', 'Liseré', 'Cheveux'],
    40: ['Gants · bottes', 'Capuche · cape', 'Tenue'], 41: ['Voile', 'Capuche · bandes', 'Peau'],
    50: ['Manches', 'Étoile', 'Robe'], 51: ['Manchettes · bottes', 'Pantalon', 'Haut'],
    60: ['Pantalon', 'Gilet', 'Pelage'], 61: ['Mèches · veste', 'Pantalon', 'Pelage'],
    70: ['Ailes · tenue', 'Cheveux · jambes', 'Peau'], 71: ['Ailes', 'Haut · ruban', 'Peau'],
    80: ['Épaulettes · bottes', 'Cheveux', 'Tenue'], 81: ['Ruban · bottes', 'Cheveux', 'Robe'],
    90: ['Cheveux', 'Tenue', 'Épaules · gants · bottes'], 91: ['Cheveux', 'Jupe', 'Haut · gants · bottes'],
    100: ['Pagne · bottes', 'Peau', 'Cheveux'], 101: ['Cheveux', 'Haut · ceinture', 'Peau'],
    110: ['Bandana · pantalon', 'Cheveux', 'Peau'], 111: ['Bandana · pantalon', 'Cheveux · ceinture', 'Peau'],
    120: ['Foulard', 'Brassards · corde', 'Pantalon'], 121: ['Nœuds · foulard', 'Brassards', 'Haut · pagne'],
  };
  let pipTarget = 1, pipData = null, pipZoom = 0, pipBefore = null, pipLoadToken = 0;
  function pipTargets() {
    const roles = ROLES[gfx()] || ['', '', ''];
    $('#pipTargets').innerHTML = [1, 2, 3].map(n => { const c = state.colors[n];
      return `<button class="piptarget" data-n="${n}" aria-pressed="${n === pipTarget}">
        <i style="background:${hex(c != null ? c : classDefault(n))}"></i>
        <span><span>Couleur ${n}</span><span class="r">${esc(roles[n - 1])}</span></span>
        <code>${c != null ? hex(c).toUpperCase() : 'défaut'}</code></button>`; }).join('');
    $('#pipTargets').querySelectorAll('.piptarget').forEach(b => b.onclick = () => {
      pipTarget = +b.dataset.n; pipTargets(); $(`.piptarget[data-n="${pipTarget}"]`).focus();   // le focus suit (clavier)
    });
  }
  function pipShow() {                          // la capture : entière dans la zone (agrandie par pas entiers si petite), ou ×2, ×4
    $('#pipZoom').querySelectorAll('button').forEach(b => { b.setAttribute('aria-pressed', String(+b.dataset.v === pipZoom)); b.disabled = !pipData; });
    const cv = $('#pipCanvas'); if (!pipData) return;
    const box = $('#pipDrop'), H = Math.max(320, Math.floor(innerHeight * 0.64));   // 16 de cadre (8 + 8) et 2 de bordure
    const fit = Math.min((box.clientWidth - 16) / cv.width, (H - 18) / cv.height);   // clientWidth : sans la bordure
    const k = pipZoom || (fit >= 1 ? Math.min(4, Math.floor(fit)) : fit);
    cv.style.width = Math.round(cv.width * k) + 'px'; cv.style.height = Math.round(cv.height * k) + 'px';
    cv.style.imageRendering = k < 1 ? 'auto' : '';   // pixels nets quand on agrandit, lissés quand on réduit
  }
  async function pipLoad(file) {                // type vide (fichier sans extension) : on essaie quand même
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) { $('#pipHover').textContent = 'Ce fichier n’est pas une image.'; return; }
    const tok = ++pipLoadToken;                 // une image choisie après une autre plus lourde garde la place
    let bmp; try { bmp = await createImageBitmap(file); } catch (e) { if (tok === pipLoadToken) $('#pipHover').textContent = 'Image illisible.'; return; }
    if (tok !== pipLoadToken) return;
    const cv = $('#pipCanvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
    cv.width = bmp.width; cv.height = bmp.height; ctx.drawImage(bmp, 0, 0);
    pipData = ctx.getImageData(0, 0, cv.width, cv.height).data;
    cv.hidden = false; $('#pipEmpty').hidden = true; $('#pipOther').hidden = false;
    pipZoom = 0; pipShow(); $('#pipHover').textContent = '';
  }
  function pipAt(e) {                           // la couleur sous le pointeur (voir plus haut)
    const cv = $('#pipCanvas'), r = cv.getBoundingClientRect(), W = cv.width, H = cv.height;
    const x = Math.floor((e.clientX - r.left) * W / r.width), y = Math.floor((e.clientY - r.top) * H / r.height);
    if (!pipData || !(x >= 0 && y >= 0 && x < W && y < H)) return null;
    const at = (X, Y) => {                      // null : hors image ou transparent
      if (X < 0 || Y < 0 || X >= W || Y >= H) return null;
      const i = (Y * W + X) * 4; return pipData[i + 3] < 200 ? null : pipData[i] << 16 | pipData[i + 1] << 8 | pipData[i + 2];
    };
    const c0 = at(x, y);
    if (c0 != null) {                           // le pixel visé : vu en grand, ou dans un aplat
      if (r.width / W >= 2) return c0;
      let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === c0) k++;
      if (k >= 2) return c0;
    }
    const score = new Map();                    // sinon : le poids de chaque couleur autour, décroissant avec la distance
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const c = at(x + dx, y + dy); if (c != null) score.set(c, (score.get(c) || 0) + Math.exp(-(dx * dx + dy * dy) / 4.5));
    }
    let best = null, bw = 0; for (const [c, w] of score) if (w > bw) { bw = w; best = c; }
    return best;
  }
  function openPipette() {
    pipBefore = { colors: { ...state.colors }, perso: $('#perso').value }; pipTarget = 1; pipTargets(); $('#pipHover').textContent = '';
    $('#pipbox').classList.add('open'); modal(true); pipShow(); $('#pipClose').focus();
  }
  function closePipette() { $('#pipbox').classList.remove('open'); modal(false); $('#pipette').focus(); }
  $('#pipette').onclick = openPipette;
  addEventListener('resize', () => { if (!pipZoom && $('#pipbox').classList.contains('open')) pipShow(); });
  $('#pipClose').onclick = closePipette;
  $('#pipbox').onclick = (e) => { if (e.target.id === 'pipbox') closePipette(); };
  $('#pipUndo').onclick = () => {                // l'état d'avant l'ouverture : couleurs et perso choisi
    if (!pipBefore) return;
    state.colors = { ...pipBefore.colors }; $('#perso').value = pipBefore.perso; syncUI(); refreshFilters();
    pipTarget = 1; pipTargets();
  };
  $('#pipZoom').querySelectorAll('button').forEach(b => b.onclick = () => { pipZoom = +b.dataset.v; pipShow(); });
  $('#pipChoose').onclick = $('#pipOther').onclick = () => $('#pipFile').click();
  $('#pipFile').onchange = (e) => { pipLoad(e.target.files[0]); e.target.value = ''; };
  // déposer : partout dans la fenêtre. Ailleurs sur la page, un fichier lâché est ignoré (sinon le navigateur l'ouvre
  // à la place de la page)
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  document.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return; e.preventDefault();
    const inPip = $('#pipbox').classList.contains('open');
    e.dataTransfer.dropEffect = inPip ? 'copy' : 'none'; $('#pipDrop').classList.toggle('over', inPip);
  });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('#pipDrop').classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return; e.preventDefault(); $('#pipDrop').classList.remove('over');
    if ($('#pipbox').classList.contains('open')) pipLoad(e.dataTransfer.files[0]);
  });
  document.addEventListener('paste', (e) => {
    if (!$('#pipbox').classList.contains('open')) return;
    const it = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith('image/'));
    if (it) { e.preventDefault(); pipLoad(it.getAsFile()); }
  });
  $('#pipCanvas').onmouseleave = () => { $('#pipHover').textContent = ''; };
  $('#pipCanvas').onmousemove = (e) => {
    const c = pipAt(e); $('#pipHover').innerHTML = c == null ? '' : `<i style="background:${hex(c)}"></i><code>${hex(c).toUpperCase()}</code>`;
  };
  $('#pipCanvas').onclick = (e) => {             // la couleur choisie passe au perso, puis on passe à la suivante
    const c = pipAt(e); if (c == null) return;
    state.colors[pipTarget] = c; touched(); syncUI(); refreshFilters();
    pipTarget = pipTarget % 3 + 1; pipTargets();
  };

  // ---------- mes skins : enregistrés dans le navigateur (classe, sexe, couleurs, objets), rouverts d'un clic, ici ou
  // depuis le menu « Mes persos » ; le portrait est redessiné à l'ouverture (rien d'autre n'est stocké)
  const SKINS_KEY = 'skinator_skins_v1';
  function loadSkins() {                        // vérifiés : ce qui vient du navigateur peut avoir été abîmé
    let t; try { t = JSON.parse(store.get(SKINS_KEY) || '[]'); } catch (e) { return []; }
    if (!Array.isArray(t)) return [];
    return t.filter(k => k && typeof k === 'object' && isClasse(k.classe) && typeof k.id === 'string' && /^[\w-]{1,40}$/.test(k.id))
      .map(k => ({ id: k.id, nom: (typeof k.nom === 'string' && k.nom.trim() ? k.nom : 'Skin').slice(0, 40),
                   date: typeof k.date === 'string' && !isNaN(Date.parse(k.date)) ? k.date : '',
                   classe: +k.classe, sexe: k.sexe ? 1 : 0, colors: cleanColors(k.colors), acc: cleanAccs(k.acc),
                   monture: k.monture === undefined ? undefined : cleanMonture(k.monture) }));
  }
  const saveSkins = (list) => store.set(SKINS_KEY, JSON.stringify(list));
  const lookOfSkin = (k) => ({ classe: k.classe, sexe: k.sexe, colors: { ...k.colors }, acc: JSON.parse(JSON.stringify(k.acc)) });
  const itemsLine = (acc) => [1, 2, 3, 4].map(n => acc[n] && itemOf(acc[n].cle)).filter(Boolean).map(itemName).map(esc).join(' · ');
  const dateFr = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '';
  let skinsToken = 0;
  function fillPersoMenu() {                    // mes persos (captures DofusSuivi) et mes skins enregistrés
    const sel = $('#perso'), v = sel.value, skins = loadSkins();
    const mine = PERSOS.map((p, i) => {
      const c = Math.floor(p.gfx / 10), sx = p.gfx % 10, cl = M.classes[c] ? clsName(c, sx) : 'gfx ' + p.gfx;
      return `<option value="${i}">${esc(p.nom)} · ${cl} · niv. ${p.niveau}</option>`;
    }).join('');
    sel.innerHTML = `<option value="">Mes persos</option>` +
      (mine ? `<optgroup label="Mes persos">${mine}</optgroup>` : '') +
      (skins.length ? `<optgroup label="Mes skins">${skins.map(k => `<option value="s:${esc(k.id)}">${esc(k.nom)} · ${clsName(k.classe, k.sexe)}</option>`).join('')}</optgroup>` : '');
    sel.value = [...sel.options].some(o => o.value === v) ? v : '';
  }
  function openSkin(k) {
    Object.assign(state, lookOfSkin(k), { mode: 'fixe' });
    if (k.monture !== undefined) state.monture = k.monture;
    equipUI(); render(); $('#perso').value = 's:' + k.id;
  }
  function drawSkins() {
    const tok = ++skinsToken, list = loadSkins();
    $('#skinsEmpty').textContent = list.length ? '' : 'Aucun skin enregistré pour l’instant.';
    $('#skinsGrid').innerHTML = list.map(k => {
      const L = lookOfSkin(k), m = { classe: L.classe, sexe: L.sexe, d: L.colors };
      return `<div class="tcard" data-id="${esc(k.id)}">
        <div class="pic"><img alt="${esc(k.nom)}, de face"></div>
        <div class="nm">${esc(k.nom)}</div>
        <div class="cl">${[clsName(L.classe, L.sexe), dateFr(k.date)].filter(Boolean).join(' · ')}</div>
        <div class="tcols">${[1, 2, 3].map(n => chipHtml(m, n)).join('')}</div>
        <div class="own">${[itemsLine(L.acc), montureOf(k.monture) ? esc(montureName(montureOf(k.monture))) : ''].filter(Boolean).join(' · ') || 'rien de porté'}</div>
        <div class="acts"><button class="btn small" data-act="open" aria-label="Ouvrir ${esc(k.nom)}">Ouvrir</button><button class="btn small" data-act="cmp" aria-label="Comparer ${esc(k.nom)}">Comparer</button><button class="btn small" data-act="del" aria-label="Supprimer ${esc(k.nom)}">Supprimer</button></div>
      </div>`;
    }).join('');
    $('#skinsGrid').querySelectorAll('.tcard').forEach((card, i) => {
      const k = list[i];
      card.querySelector('[data-act="open"]').onclick = () => { closeSkins(); openSkin(k); };
      card.querySelector('[data-act="cmp"]').onclick = () => openCompare('s:' + k.id);
      const del = card.querySelector('[data-act="del"]');
      del.onclick = () => {                     // en deux temps : « Supprimer », puis « Oui, supprimer »
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Oui, supprimer'; setTimeout(() => { if (del.isConnected) { delete del.dataset.sure; del.textContent = 'Supprimer'; } }, 3000); return; }
        saveSkins(loadSkins().filter(x => x.id !== k.id));
        if ($('#perso').value === 's:' + k.id) $('#perso').value = '';
        fillPersoMenu(); drawSkins(); $('#skinName').focus();
      };
      shot(lookOfSkin(k), () => tok === skinsToken).then(src => { const img = card.querySelector('img'); if (src && img) img.src = src; });
    });
  }
  function saveCurrentSkin() {
    if (saveCurrentSkin.busy) return;           // une seule fois par appui (Entrée maintenue, double clic)
    saveCurrentSkin.busy = true; setTimeout(() => { saveCurrentSkin.busy = false; }, 600);
    const list = loadSkins(), used = new Set(list.map(k => k.nom));
    let d = 1; while (used.has(`Skin ${d}`)) d++;                     // le premier « Skin n » libre
    const nom = ($('#skinName').value.trim() || `Skin ${d}`).slice(0, 40);
    const k = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nom, date: new Date().toISOString(),
                classe: state.classe, sexe: state.sexe, colors: { ...state.colors }, acc: JSON.parse(JSON.stringify(state.acc)), monture: state.monture };
    if (!saveSkins([k, ...list])) {             // stockage plein ou bloqué : on le dit, le nom tapé reste
      $('#skinsEmpty').textContent = 'Enregistrement impossible : le stockage du navigateur est plein ou bloqué.'; return;
    }
    $('#skinName').value = ''; fillPersoMenu(); $('#perso').value = 's:' + k.id; drawSkins();
  }
  function openSkins(focus = '#skinName') {
    $('#skinsbox').classList.add('open'); modal(true); drawSkins(); ($(focus) || $('#skinName')).focus();
  }
  function closeSkins(back = true) { $('#skinsbox').classList.remove('open'); skinsToken++; if (back) { modal(false); $('#skins').focus(); } }
  $('#skins').onclick = () => openSkins();
  $('#skinsClose').onclick = () => closeSkins();
  $('#skinSave').onclick = saveCurrentSkin;
  $('#skinName').onkeydown = (e) => { if (e.key === 'Enter' && !e.repeat) saveCurrentSkin(); };
  $('#skinsCompare').onclick = () => openCompare();
  $('#skinsbox').onclick = (e) => { if (e.target.id === 'skinsbox') closeSkins(); };

  // ---------- avant / après : deux skins côte à côte, dans la pose affichée (le skin actuel, un skin enregistré, un
  // de mes persos), et leur PNG (le même export que la team)
  let cmpToken = 0;
  function sourceOptions(sel) {
    const skins = loadSkins();
    return `<option value="cur"${sel === 'cur' ? ' selected' : ''}>Skin actuel</option>` +
      (skins.length ? `<optgroup label="Mes skins">${skins.map(k => `<option value="s:${esc(k.id)}"${sel === 's:' + k.id ? ' selected' : ''}>${esc(k.nom)} · ${clsName(k.classe, k.sexe)}${k.date ? ' · ' + dateFr(k.date) : ''}</option>`).join('')}</optgroup>` : '') +
      (PERSOS.length ? `<optgroup label="Mes persos">${PERSOS.map((q, i) => M.classes[Math.floor(q.gfx / 10)] ? `<option value="p:${i}"${sel === 'p:' + i ? ' selected' : ''}>${esc(q.nom)}</option>` : '').join('')}</optgroup>` : '');
  }
  function sourceLook(v) {                      // { nom, classe, sexe, colors, acc }
    if (v.startsWith('s:')) { const k = loadSkins().find(x => x.id === v.slice(2)); if (k) return { nom: k.nom, ...lookOfSkin(k) }; }
    if (v.startsWith('p:')) {
      const q = PERSOS[+v.slice(2)];
      if (q && M.classes[Math.floor(q.gfx / 10)]) return { nom: q.nom, classe: Math.floor(q.gfx / 10), sexe: q.gfx % 10,
        colors: Object.fromEntries([1, 2, 3].map(n => { const x = q.couleurs[n - 1]; return [n, x == null ? null : parseInt(x.slice(1), 16)]; })),
        acc: Object.fromEntries([1, 2, 3, 4].map(n => { const a = (q.equip || [])[n]; return [n, a && BY_KEY[a.cle] ? { cle: a.cle, niveau: a.niveau ?? null } : null]; })) };
    }
    const pv = $('#perso').value, k = pv.startsWith('s:') ? loadSkins().find(x => x.id === pv.slice(2)) : PERSOS[pv];   // son nom s'il en a un
    return { nom: k ? k.nom : 'Skin actuel', classe: state.classe, sexe: state.sexe, colors: { ...state.colors }, acc: JSON.parse(JSON.stringify(state.acc)) };
  }
  const cmpCards = () => [['Avant', $('#cmpA').value], ['Après', $('#cmpB').value]].map(([t, v]) => {
    const L = sourceLook(v); return { titre: t, sous: `${L.nom} · ${clsName(L.classe, L.sexe)}`, classe: L.classe, sexe: L.sexe, d: L.colors, acc: L.acc };
  });
  function drawCompare() {
    const tok = ++cmpToken, cards = cmpCards();
    $('#cmpGrid').innerHTML = cards.map(c => `<div class="tcard">
      <div class="pic"><img alt="${esc(c.titre)} : ${esc(c.sous)}"></div>
      <div class="nm">${esc(c.titre)}</div><div class="cl">${esc(c.sous)}</div>
      <div class="tcols">${[1, 2, 3].map(n => chipHtml(c, n)).join('')}</div>
      <div class="own">${itemsLine(c.acc) || 'rien de porté'}</div></div>`).join('');
    const imgs = $('#cmpGrid').querySelectorAll('img');
    cards.forEach((c, i) => shot({ classe: c.classe, sexe: c.sexe, colors: { ...c.d }, acc: c.acc }, () => tok === cmpToken, 3, state.pose)
      .then(src => { if (src && imgs[i]) imgs[i].src = src; }));
  }
  let cmpFromSkins = false, cmpOpener = null;
  function openCompare(avant = null) {
    const skins = loadSkins();
    cmpFromSkins = $('#skinsbox').classList.contains('open');
    const card = avant && avant.startsWith('s:') ? avant.slice(2) : null;   // « Comparer » d'une carte, ou « Avant / après »
    cmpOpener = card ? `#skinsGrid .tcard[data-id="${card}"] [data-act="cmp"]` : '#skinsCompare';
    if (cmpFromSkins) closeSkins(false);        // on passe d'une fenêtre à l'autre (Fermer y ramène)
    // par défaut, « Avant » est le premier skin (ou perso) qui diffère du skin actuel : la première vue compare vraiment
    const cur = JSON.stringify(sourceLook('cur').acc) + JSON.stringify(sourceLook('cur').colors) + state.classe + state.sexe;
    const differs = (v) => { const L = sourceLook(v); return JSON.stringify(L.acc) + JSON.stringify(L.colors) + L.classe + L.sexe !== cur; };
    const first = [...skins.map(k => 's:' + k.id), ...PERSOS.map((q, i) => 'p:' + i)].find(differs);
    $('#cmpA').innerHTML = sourceOptions(avant || first || 'cur');
    $('#cmpB').innerHTML = sourceOptions('cur');
    $('#cmpbox').classList.add('open'); modal(true); drawCompare(); $('#cmpA').focus();
  }
  function closeCompare() {
    $('#cmpbox').classList.remove('open'); cmpToken++;
    if (cmpFromSkins) { cmpFromSkins = false; openSkins(cmpOpener); return; }   // retour à Mes skins, sur le bouton d'origine
    modal(false); $('#skins').focus();
  }
  $('#cmpA').onchange = $('#cmpB').onchange = drawCompare;
  $('#cmpClose').onclick = closeCompare;
  $('#cmpbox').onclick = (e) => { if (e.target.id === 'cmpbox') closeCompare(); };
  // fermer par le fond : seulement un clic commencé sur le fond (un glisser parti de la fenêtre et relâché dehors
  // envoie aussi un click au fond)
  for (const id of ['picker', 'teambox', 'skinsbox', 'cmpbox', 'pipbox', 'ideabox']) {
    const el = $('#' + id);
    el.addEventListener('pointerdown', (e) => { el.downOnVeil = e.target === el; }, true);
    el.addEventListener('click', (e) => { if (e.target === el && !el.downOnVeil) e.stopImmediatePropagation(); }, true);
  }
  $('#cmpPng').onclick = async () => {
    const btn = $('#cmpPng'); btn.style.minWidth = btn.offsetWidth + 'px'; btn.disabled = true; btn.textContent = 'Export…';
    try {
      const cards = cmpCards(), cv = await plancheGroupe(cards, state.pose), b = await new Promise(r => cv.toBlob(r, 'image/png'));
      const part = (v) => {                     // le nom en ASCII, coupé entre deux mots s'il est long
        const sl = sourceLook(v).nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
        return (sl.length > 28 ? sl.slice(0, 28).replace(/-[^-]*$/, '') : sl) || 'skin';
      };
      b ? download(b, `avant_apres_${part($('#cmpA').value)}_${part($('#cmpB').value)}_${POSE_FILE[state.pose] || 'face'}.png`) : alert('Export PNG refusé par le navigateur.');
    } catch (e) { alert('Export PNG impossible (' + e.message + ').'); }
    finally { btn.disabled = false; btn.textContent = 'PNG avant / après'; }
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || pickerSlot) return;
    if ($('#cmpbox').classList.contains('open')) closeCompare();
    else if ($('#skinsbox').classList.contains('open')) closeSkins();
    else if ($('#pipbox').classList.contains('open')) closePipette();
    else if ($('#ideabox').classList.contains('open')) closeIdeas();
  });

  // ---------- thème : clair par défaut (comme la maquette), sombre au choix, retenu par le navigateur
  const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  function setTheme(t) {
    document.documentElement.dataset.theme = t; store.set('skinator_theme', t);
    $('#theme').innerHTML = t === 'dark' ? SUN : MOON;
    $('#theme').setAttribute('aria-label', t === 'dark' ? 'Passer en clair' : 'Passer en sombre');
  }
  $('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  // ---------- exports
  function fileBase() { return `skin_${M.classes[state.classe].nom}-${state.sexe ? 'F' : 'M'}`; }
  function svgString(svg) {
    const c = svg.cloneNode(true);
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(c);
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const toImage = (str) => new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error('le navigateur n’a pas pu relire le SVG'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  });
  // les 4 rotations, même cadre pour toutes (les pieds restent alignés), fond blanc
  // ce qui se voit vraiment sur le papier des exports (#f6f3ee), ombre au sol comprise : un pixel compte quand, posé sur
  // le papier, il s'en écarte de plus de 24 (somme des 3 canaux) — la même règle que les contrôles au pixel
  function inkBox(img) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let i = y * c.width * 4 + 3, xx = 0; xx < c.width; xx++, i += 4) {
      const a = d[i] / 255; if (!a) continue;    // la couleur arrondie comme sur l'export, posée sur le papier
      const dr = Math.abs(Math.round(d[i - 3] * a + 246 * (1 - a)) - 246), dg = Math.abs(Math.round(d[i - 2] * a + 243 * (1 - a)) - 243),
            db = Math.abs(Math.round(d[i - 1] * a + 238 * (1 - a)) - 238);
      if (dr + dg + db > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? { x0: 0, y0: 0, x1: c.width - 1, y1: c.height - 1 } : { x0, y0, x1, y1 };
  }
  const BIG = { x0: -75, y0: -105, x1: 75, y1: 25 };     // cadre de travail, plus grand que tout objet porté
  // début de découpe qui pose le milieu de l'encre [x0, x1] d'une image au point c d'une case (en pixels, c peut finir
  // en ,5). Quand il reste un demi-pixel : side < 0 le pousse à gauche, side > 0 à droite ; les persos de gauche et de
  // droite d'une rangée s'équilibrent ainsi deux à deux au lieu de pencher tous du même côté
  const cropX = (b, c, side = 0) => { const v = (b.x0 + b.x1) / 2 - c; return side < 0 ? Math.ceil(v) : side > 0 ? Math.floor(v) : Math.round(v); };
  const sideOf = (i, n) => (i < (n - 1) / 2 ? -1 : i > (n - 1) / 2 ? 1 : 0);
  // ---------- exports PNG : papier ivoire uni, beaucoup d'air, filets d'un pixel, une seule police (Geist), petites
  // capitales espacées ; ni dégradé, ni lueur, ni ombre. Pas de titre : les persos prennent la place.
  // Chaque figure est centrée au pixel sur ce qu'elle contient, pieds alignés.
  const LX = { paper: '#f6f3ee', ink: '#1d1b18', muted: '#716a60', hair: '#ddd7cd', ring: '#d3ccc0',
               sans: '"Geist", system-ui, -apple-system, "Segoe UI", sans-serif' };
  async function fontsReady() {                 // Geist est servie avec la page (fonts/) ; à défaut, les polices du système
    if (!document.fonts) return;
    const want = ['400 20px "Geist"', '500 20px "Geist"'];
    await Promise.race([Promise.all(want.map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, 2500))]);
  }
  function txt(ctx, str, x, y, font, color, align = 'left', spacing = 0) {
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing.toFixed(2)}px`;
    if (align === 'center') {                   // centré sur l'encre des lettres : ni leurs approches, ni l'espacement
      ctx.textAlign = 'left';                   // que le canvas ajoute après la dernière
      const m = ctx.measureText(str);
      ctx.fillText(str, x - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, y);
    } else {
      ctx.textAlign = align;                    // à droite : on rend l'espacement ajouté après la dernière lettre
      ctx.fillText(str, x + (align === 'right' && 'letterSpacing' in ctx ? spacing : 0), y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  const caps = (str) => str.toLocaleUpperCase('fr-FR');
  function lxRule(ctx, x0, x1, y, u) {
    ctx.strokeStyle = LX.hair; ctx.lineWidth = Math.max(1, u);
    ctx.beginPath(); ctx.moveTo(x0, Math.round(y) + 0.5); ctx.lineTo(x1, Math.round(y) + 0.5); ctx.stroke();
  }
  // une légende de figure : numéro en petites capitales, puis le nom
  function lxCaption(ctx, cx, y, num, name, u) {
    txt(ctx, num, cx, y, `400 ${Math.round(11 * u)}px ${LX.sans}`, LX.muted, 'center', 3.5 * u);
    txt(ctx, name, cx, y + 30 * u, `400 ${Math.round(19 * u)}px ${LX.sans}`, LX.ink, 'center');
  }
  // pied : les trois couleurs (pastille nette, numéro, code), puis l'équipement ; renvoie la ligne de base du dernier
  // texte, mesurée depuis le filet
  function lxFooter(ctx, left, top, width, u) {
    const lum = (c) => (0.2126 * (c >> 16 & 255) + 0.7152 * (c >> 8 & 255) + 0.0722 * (c & 255)) / 255;
    lxRule(ctx, left, left + width, top, u);
    const colW = Math.min(width / 3, 330 * u), x0 = left + (width - 3 * colW) / 2;
    [1, 2, 3].forEach((n, i) => {
      const c = state.colors[n] != null ? state.colors[n] : classDefault(n), cx = x0 + i * colW + colW / 2, cy = top + 52 * u, r = 26 * u;
      ctx.fillStyle = hex(c); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      if (lum(c) > 0.8) { ctx.strokeStyle = LX.ring; ctx.lineWidth = Math.max(1, u); ctx.beginPath(); ctx.arc(cx, cy, r - 0.5 * u, 0, Math.PI * 2); ctx.stroke(); }
      txt(ctx, `COULEUR ${['I', 'II', 'III'][i]}` + (state.colors[n] == null ? '  ·  DÉFAUT' : ''), cx, cy + 48 * u, `400 ${Math.round(11 * u)}px ${LX.sans}`, LX.muted, 'center', 3.5 * u);
      txt(ctx, hex(c).toUpperCase(), cx, cy + 76 * u, `500 ${Math.round(21 * u)}px ${LX.sans}`, LX.ink, 'center', 2 * u);
    });
    const mo = montureOf(state.monture);                // sur une dragodinde, le familier ne se voit pas : il n'est pas cité
    const worn = Object.entries(state.acc).filter(([n, a]) => a && !(mo && n === '3')).map(([, a]) => BY_KEY[a.cle]).filter(Boolean).map(itemName)
      .concat(mo ? [montureName(mo)] : []);
    if (!worn.length) return 128 * u;
    // centrée sur sa longueur : caler le point du milieu sur l'axe faisait partir toute la ligne du côté des noms longs
    txt(ctx, worn.join('   ·   '), left + width / 2, top + 180 * u, `400 ${Math.round(18 * u)}px ${LX.sans}`, LX.muted, 'center');
    return 180 * u;
  }
  const LX_ROT = { F: 'Face', R: 'Trois-quarts face', S: 'Profil', L: 'Trois-quarts dos', B: 'Dos' };
  async function renderPoses(poses, zoom, look = state) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
    document.body.appendChild(holder);
    try {
      const imgs = [];
      for (const pose of poses) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        holder.appendChild(svg);
        await draw(svg, pose, false, zoom, look);
        frame(svg, BIG, zoom);
        imgs.push(await toImage(svgString(svg)));
      }
      return imgs;
    } finally { holder.remove(); }
  }
  // les 4 rotations, sans titre ni légende, puis les couleurs et l'équipement
  async function planche(zoom = 10, poses = ROTATIONS) {
    await fontsReady();
    const imgs = await renderPoses(poses, zoom);
    const ink = imgs.map(inkBox), P = Math.round(6 * zoom), PV = Math.round(2 * zoom);
    const W = Math.max(40 * zoom, ...ink.map(b => b.x1 - b.x0 + 1 + 2 * P));
    const top = Math.min(...ink.map(b => b.y0)) - PV, H = Math.max(...ink.map(b => b.y1)) + PV - top;
    const gridW = W * imgs.length, u = gridW / 1700, m = Math.round(80 * u), my = Math.round(48 * u);
    const below = 36 * u;                             // des pieds au filet du pied
    const footH = Object.values(state.acc).some(Boolean) || montureOf(state.monture) ? 180 * u : 128 * u;     // ce que lxFooter renverra
    const cv = document.createElement('canvas');
    cv.width = gridW + 2 * m;
    cv.height = Math.round(my + H + below + footH + my + PV);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = LX.paper; ctx.fillRect(0, 0, cv.width, cv.height);
    const y0 = my;
    imgs.forEach((im, i) => {
      ctx.drawImage(im, cropX(ink[i], (W - 1) / 2, sideOf(i, imgs.length)), top, W, H, m + i * W, y0, W, H);
    });
    lxFooter(ctx, m, y0 + H + below, gridW, u);
    cv.layout = { m, W, H, y0, cols: imgs.length };      // pour les vérifications
    return cv;
  }
  // un groupe de persos (la team, l'avant / après) : chacun dans la pose demandée, son titre (et une ligne dessous), ses
  // 3 couleurs à saisir en jeu (de gauche à droite : 1, 2, 3) ; 4 persos par ligne au plus (5 -> 3 + 2, 8 -> 4 + 4). En
  // bas, le stuff commun à tous ; sous chacun, ce qu'il porte en propre. Mêmes papier, police et centrage que les autres.
  // carte : { titre, sous, classe, sexe, d (couleurs, null = défaut), acc }
  async function plancheGroupe(cards, pose = 'F', zoom = 10, axe = 'encre') {
    await fontsReady();
    const imgs = [];
    for (const k of cards) imgs.push((await renderPoses([pose], zoom, { classe: k.classe, sexe: k.sexe, colors: { ...k.d }, acc: k.acc, monture: k.monture }))[0]);
    const ink = imgs.map(inkBox), P = Math.round(6 * zoom), PV = Math.round(2 * zoom);
    // axe 'encre' : chaque perso centré sur son encre (avant / après) ; axe 'perso' (team) : posé sur son origine (entre
    // ses pieds), au-dessus de la pastille du milieu, le familier dépasse ; les couleurs restent au milieu de la case
    const O = -(BIG.x0 - 1) * zoom;              // l'origine du perso dans l'image (cadre BIG, 1 unité de marge)
    const W = Math.max(40 * zoom, ...ink.map(b => axe === 'perso' ? 2 * Math.max(O - b.x0, b.x1 + 1 - O) + 2 * P : b.x1 - b.x0 + 1 + 2 * P));
    const top = Math.min(...ink.map(b => b.y0)) - PV, H = Math.max(...ink.map(b => b.y1)) + PV - top;
    const n = cards.length, cols = Math.min(4, Math.ceil(n / Math.ceil(n / 4)));
    const rows = []; for (let i = 0; i < n; i += cols) rows.push(Array.from({ length: Math.min(cols, n - i) }, (_, k) => i + k));
    const names = (list) => list.filter(Boolean).map(a => BY_KEY[a.cle]).filter(Boolean).map(itemName);
    // la monture comme un 5e emplacement ; sur une dragodinde, le familier ne se voit pas : il n'est pas cité
    const mName = (k) => montureOf(k.monture) ? montureName(montureOf(k.monture)) : null;
    const shownSl = (k) => [1, 2, 3, 4].filter(sl => !(sl === 3 && montureOf(k.monture)));
    const common = [1, 2, 3, 4].filter(sl => cards.every(k => sameItem(k.acc[sl], cards[0].acc[sl]) && shownSl(k).includes(sl)) ||
                                            cards.every(k => !shownSl(k).includes(sl)));
    const sameM = cards.every(k => sameMonture(k.monture, cards[0].monture));
    const worn = names(common.filter(sl => shownSl(cards[0]).includes(sl)).map(sl => cards[0].acc[sl])).concat(sameM && mName(cards[0]) ? [mName(cards[0])] : []);
    const ownOf = (k) => shownSl(k).filter(sl => !common.includes(sl))
      .map(sl => k.acc[sl] && itemOf(k.acc[sl].cle) ? itemName(itemOf(k.acc[sl].cle)) : 'sans ' + SLOT_NAMES[sl].toLowerCase())
      .concat(sameM ? [] : [mName(k) || 'sans monture']);
    const anyOwn = cards.some(k => ownOf(k).length);
    const gridW = W * cols, u = W / 470, m = Math.round(80 * u), my = Math.round(48 * u);
    const cap = Math.round((anyOwn ? 176 : 150) * u), rowGap = Math.round(36 * u), rowH = H + cap;
    const lastBase = my + (rows.length - 1) * (rowH + rowGap) + H + (anyOwn ? 154 : 128) * u;   // dernière ligne de texte
    const ruleY = lastBase + 46 * u, stuffY = ruleY + 46 * u;
    // l'image est au moins aussi large que la ligne du stuff (un seul perso : la ligne est plus large que lui)
    const stuffFont = `400 ${Math.round(18 * u)}px ${LX.sans}`, stuff = worn.join('   ·   ');
    const probe = document.createElement('canvas').getContext('2d'); probe.font = stuffFont;
    let width = Math.ceil(Math.max(gridW, worn.length ? probe.measureText(stuff).width : 0) + 2 * m);
    if ((width - gridW) % 2) width++;           // sinon la grille tombe sur un demi-pixel
    const mx = (width - gridW) / 2;
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = Math.round((worn.length ? stuffY : lastBase) + my + PV);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = LX.paper; ctx.fillRect(0, 0, cv.width, cv.height);
    const lum = (c) => (0.2126 * (c >> 16 & 255) + 0.7152 * (c >> 8 & 255) + 0.0722 * (c & 255)) / 255;
    // une même taille pour toutes les cases, réduite s'il le faut pour que le texte le plus long tienne
    const fit = (texts, size, min, weight) => { let fs = size * u;
      for (const t of texts.filter(Boolean)) { probe.font = `${weight} ${fs}px ${LX.sans}`; while (fs > min * u && probe.measureText(t).width > W - 24 * u) { fs -= 0.5 * u; probe.font = `${weight} ${fs}px ${LX.sans}`; } }
      return `${weight} ${fs.toFixed(1)}px ${LX.sans}`; };
    const titreFont = fit(cards.map(c => c.titre), 20, 13, 500), sousFont = fit(cards.map(c => c.sous), 14, 10, 400);
    const ownFont = fit(cards.map(c => ownOf(c).join('   ·   ')), 13, 9, 400);
    rows.forEach((idx, r) => {
      const y0 = my + r * (rowH + rowGap), left = mx + (cols - idx.length) * W / 2, L = Math.floor(left);   // ligne courte centrée
      idx.forEach((i, k) => {
        const sx = axe === 'perso' ? Math.round(O - (left - L) - W / 2) : cropX(ink[i], left - L + (W - 1) / 2, sideOf(k, idx.length));
        ctx.drawImage(imgs[i], sx, top, W, H, L + k * W, y0, W, H);
        const card = cards[i], cx = left + k * W + W / 2;
        txt(ctx, card.titre, cx, y0 + H + 34 * u, titreFont, LX.ink, 'center');
        if (card.sous) txt(ctx, card.sous, cx, y0 + H + 57 * u, sousFont, LX.muted, 'center');
        const colW = Math.min(W / 3, 140 * u);
        [1, 2, 3].forEach((c, j) => {
          const col = shown(card, c), px = cx + (j - 1) * colW, py = y0 + H + 92 * u, rr = 13 * u;
          ctx.fillStyle = hex(col); ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
          if (lum(col) > 0.8) { ctx.strokeStyle = LX.ring; ctx.lineWidth = Math.max(1, u); ctx.beginPath(); ctx.arc(px, py, rr - 0.5 * u, 0, Math.PI * 2); ctx.stroke(); }
          if (card.d[c] != null) txt(ctx, hex(card.d[c]).toUpperCase(), px, py + 36 * u, `500 ${Math.round(15 * u)}px ${LX.sans}`, LX.ink, 'center', 1.2 * u);
          else txt(ctx, 'DÉFAUT', px, py + 36 * u, `400 ${Math.round(11 * u)}px ${LX.sans}`, LX.muted, 'center', 2.5 * u);
        });
        const mine = ownOf(card).join('   ·   ');
        if (mine) txt(ctx, mine, cx, y0 + H + 154 * u, ownFont, LX.muted, 'center');   // ce qu'il porte en propre
      });
    });
    if (worn.length) {
      lxRule(ctx, m, width - m, ruleY, u);
      txt(ctx, stuff, width / 2, stuffY, stuffFont, LX.muted, 'center');
    }
    cv.layout = { m, W, H, my, cols, rows: rows.map(r => r.length), cap, rowGap };      // pour les vérifications
    return cv;
  }
  const teamCards = () => teamMembers.map(m => ({ titre: m.nom || clsName(m.classe, m.sexe), sous: m.nom ? clsName(m.classe, m.sexe) : '',
                                                   classe: m.classe, sexe: m.sexe, d: m.d, acc: m.acc || teamModel.acc, monture: m.monture }));
  // les 7 vues du jeu (8 sur une dragodinde) : les 3 poses fixes sur une ligne, puis la marche, la course et l'anim 2 à 4 instants
  // (0 ; 0,2 ; 0,4 ; 0,6 s, repères au-dessus des colonnes)
  async function captureAnim(zoom, instants) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
    document.body.appendChild(holder);
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      holder.appendChild(svg);
      const P = Object.assign(Object.create(player), { svg, tickN: 0, raf: 0, root: null, depth: 0, again: false, lastAnim: undefined, hook: null });
      P.prepare(await animLibs());
      frame(svg, BIG, zoom);
      const shoot = async (view, ats) => {
        P.start(view);
        const out = [];
        let t = 0;
        for (const at of ats) { while (t < at) { P.tick(); t++; } P.paint(); out.push(await toImage(svgString(svg))); }
        P.lastAnim = view[0];
        return out;
      };
      const statics = [];
      const V = viewsOf();
      for (const v of V.slice(0, 3)) statics.push((await shoot(v, [0]))[0]);
      const rows = [];
      for (const v of V.slice(3)) rows.push(await shoot(v, instants));
      return { statics, rows };
    } finally { holder.remove(); }
  }
  // ---------- GIF animé : les 7 vues de la fenêtre Caractéristiques, dans l'ordre du jeu. Les 3 poses fixes tenues
  // 0,8 s, puis marche, course, anim 2 ¾ face et ¾ dos sur une boucle complète chacune (4 s au plus), 20 images/s.
  // Papier des exports, cadre commun à toutes les images (le perso ne saute pas), boucle infinie.
  async function gifAnim(zoom = 5, onStep = () => {}) {         // zoom 5 : ~300 px de côté, ~2 Mo
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
    document.body.appendChild(holder);
    const shots = [];                                                    // { img, delay (centièmes de s) }
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      holder.appendChild(svg);
      const P = Object.assign(Object.create(player), { svg, tickN: 0, raf: 0, root: null, depth: 0, again: false, lastAnim: undefined, hook: null });
      P.prepare(await animLibs());
      frame(svg, BIG, zoom);
      const snap = () => { P.paint(); return toImage(svgString(svg)); };
      // ce qui boucle : l'image principale, ou, quand elle n'a qu'une image (marche, course), le clip animé qu'elle porte
      const cycleOf = (root) => {
        if (!root || root.n > 1) return root;
        let best = null; for (const k of root.kids.values()) if (k.inst && k.inst.n > 1 && (!best || k.inst.n > best.n)) best = k.inst;
        return best || root;
      };
      const V = viewsOf();
      for (const [vi, view] of V.entries()) {
        P.start(view);
        if (view[0] === 'static') shots.push({ img: await snap(), delay: 80 });
        else {
          shots.push({ img: await snap(), delay: 5 });
          for (let t = 0, n = 1, done = false; !done && n < 80;) {         // une boucle (80 images, 4 s au plus) : ce qui
            for (let k = 0; k < 3; k++) {                                  // boucle revient au début, ou la vue est relancée
              const r0 = P.root, c0 = cycleOf(r0), f0 = c0.frame;
              P.tick(); t++;
              const c1 = cycleOf(P.root);
              if (t > 6 && (P.root !== r0 || c1 !== c0 || c1.frame < f0)) { done = true; break; }
            }
            if (!done) { shots.push({ img: await snap(), delay: 5 }); n++; }
          }
        }
        P.lastAnim = view[0];
        onStep(vi + 1, V.length);
      }
    } finally { holder.remove(); }
    // cadre commun : l'encre de toutes les images, plus une marge
    const boxes = shots.map(sh => inkBox(sh.img)), M = 4 * zoom;
    const x0 = Math.max(0, Math.min(...boxes.map(b => b.x0)) - M), y0 = Math.max(0, Math.min(...boxes.map(b => b.y0)) - M);
    const W = Math.min(shots[0].img.width, Math.max(...boxes.map(b => b.x1)) + M + 1) - x0;
    const H = Math.min(shots[0].img.height, Math.max(...boxes.map(b => b.y1)) + M + 1) - y0;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const frames = shots.map(sh => {
      ctx.fillStyle = LX.paper; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(sh.img, x0, y0, W, H, 0, 0, W, H);
      return { rgba: ctx.getImageData(0, 0, W, H).data, delay: sh.delay };
    });
    onStep(viewsOf().length, viewsOf().length, true); await new Promise(r => setTimeout(r, 30));   // « encodage » s'affiche
    return new Blob([gifEncode(W, H, frames)], { type: 'image/gif' });
  }
  // encodeur GIF89a, sans dépendance : pour chaque image seulement le rectangle qui a changé (les images identiques
  // s'additionnent en durée), avec sa propre table de 256 couleurs (les couleurs exactes quand il y en a 256 au plus,
  // sinon les plus fréquentes à 5 bits par canal et le reste au plus proche : les effets d'une seule vue gardent leurs
  // couleurs), LZW, boucle infinie
  function gifEncode(W, H, frames) {
    const rgb = frames.map(f => { const a = new Uint32Array(W * H);
      for (let i = 0, p = 0; p < a.length; i += 4, p++) a[p] = f.rgba[i] << 16 | f.rgba[i + 1] << 8 | f.rgba[i + 2];
      return a; });
    let buf = new Uint8Array(1 << 20), n = 0;
    const grow = (k) => { if (n + k > buf.length) { const nb = new Uint8Array(Math.max(buf.length * 2, n + k)); nb.set(buf); buf = nb; } };
    const put = (...bytes) => { grow(bytes.length); for (const x of bytes) buf[n++] = x; };
    const w16 = (v) => put(v & 255, v >> 8 & 255);
    put(...[...'GIF89a'].map(c => c.charCodeAt(0))); w16(W); w16(H); put(0x70, 0, 0);            // pas de table globale
    put(0x21, 0xFF, 0x0B, ...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0);        // boucle infinie
    const out = [];
    rgb.forEach((a, i) => {
      let bx0 = 0, by0 = 0, bx1 = W - 1, by1 = H - 1;
      if (i) {                                  // rectangle qui a changé depuis l'image d'avant
        const pr = rgb[i - 1]; bx0 = W; by0 = H; bx1 = -1; by1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0, p = y * W; x < W; x++, p++) if (a[p] !== pr[p]) {
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
        if (bx1 < 0) { out[out.length - 1].delay += frames[i].delay; return; }   // identique : on allonge la précédente
      }
      const w = bx1 - bx0 + 1, h = by1 - by0 + 1, px = new Uint32Array(w * h);
      for (let y = 0; y < h; y++) px.set(a.subarray((by0 + y) * W + bx0, (by0 + y) * W + bx0 + w), y * w);
      const count = new Map(); for (const c of px) count.set(c, (count.get(c) || 0) + 1);
      let pal, index;
      if (count.size <= 256) {                  // les couleurs exactes
        pal = [...count.keys()]; const at = new Map(pal.map((c, j) => [c, j])); index = (c) => at.get(c);
      } else {                                  // les plus fréquentes à 5 bits, le reste au plus proche
        const sums = new Map();
        for (const [c, k] of count) { const b = (c >> 19 & 31) << 10 | (c >> 11 & 31) << 5 | (c >> 3 & 31), e = sums.get(b) || [0, 0, 0, 0];
          e[0] += (c >> 16 & 255) * k; e[1] += (c >> 8 & 255) * k; e[2] += (c & 255) * k; e[3] += k; sums.set(b, e); }
        const top = [...sums.entries()].sort((x, y) => y[1][3] - x[1][3]).slice(0, 256);
        pal = top.map(([, e]) => Math.round(e[0] / e[3]) << 16 | Math.round(e[1] / e[3]) << 8 | Math.round(e[2] / e[3]));
        const memo = new Map();
        index = (c) => { let j = memo.get(c); if (j !== undefined) return j;
          let bd = Infinity; const r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255;
          for (let q = 0; q < pal.length; q++) { const p = pal[q], d = ((p >> 16 & 255) - r) ** 2 + ((p >> 8 & 255) - g) ** 2 + ((p & 255) - b) ** 2; if (d < bd) { bd = d; j = q; } }
          memo.set(c, j); return j; };
      }
      const ix = new Uint8Array(px.length); for (let q = 0; q < px.length; q++) ix[q] = index(px[q]);
      out.push({ x: bx0, y: by0, w, h, delay: frames[i].delay, pal, data: lzw(ix) });
    });
    for (const f of out) {
      put(0x21, 0xF9, 4, 0x04, f.delay & 255, f.delay >> 8 & 255, 0, 0);   // on laisse l'image en place (disposition 1)
      put(0x2C); w16(f.x); w16(f.y); w16(f.w); w16(f.h); put(0x87);        // table locale de 256 couleurs
      grow(768); for (let q = 0; q < 256; q++) { const c = f.pal[q] || 0; buf[n++] = c >> 16 & 255; buf[n++] = c >> 8 & 255; buf[n++] = c & 255; }
      put(8);
      grow(f.data.length + Math.ceil(f.data.length / 255) + 1);
      for (let i = 0; i < f.data.length; i += 255) { const m = Math.min(255, f.data.length - i); buf[n++] = m; for (let j = 0; j < m; j++) buf[n++] = f.data[i + j]; }
      buf[n++] = 0;
    }
    put(0x3B);
    return buf.slice(0, n);
  }
  function lzw(ix) {                            // LZW du GIF, codes de 9 à 12 bits, table remise à zéro à 4096
    const clear = 256, eoi = 257, out = [];
    let size = 9, next = 258, cur = 0, bits = 0, dict = new Map();
    const emit = (c) => { cur |= c << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
    emit(clear);
    let pre = ix[0];
    for (let i = 1; i < ix.length; i++) {
      const k = ix[i], key = pre << 8 | k, v = dict.get(key);
      if (v !== undefined) { pre = v; continue; }
      emit(pre);
      if (next === 4096) { emit(clear); dict = new Map(); size = 9; next = 258; }
      else { if (next >= 1 << size) size++; dict.set(key, next++); }
      pre = k;
    }
    emit(pre); emit(eoi);
    if (bits > 0) out.push(cur & 255);
    return out;
  }
  async function plancheAnim(zoom = 6, instants = [0, 12, 24, 36]) {
    await fontsReady();
    const { statics, rows } = await captureAnim(zoom, instants);
    const MX = Math.round(6 * zoom), MV = Math.round(3 * zoom), cols = instants.length;
    const sInk = statics.map(inkBox), rInk = rows.map(r => r.map(inkBox));
    // une découpe par ligne (les 4 instants ensemble : le mouvement ne saute pas), centrée sur ce que la ligne contient
    const rowBox = rInk.map(r => ({ x0: Math.min(...r.map(b => b.x0)), x1: Math.max(...r.map(b => b.x1)),
                                   y0: Math.min(...r.map(b => b.y0)), y1: Math.max(...r.map(b => b.y1)) }));
    const cw = Math.round(Math.max(46 * zoom, ...sInk.map(b => b.x1 - b.x0 + 1 + 2 * MX), ...rowBox.map(b => b.x1 - b.x0 + 1 + 2 * MX)));
    const sTop = Math.min(...sInk.map(b => b.y0)) - MV, sH = Math.round(Math.max(...sInk.map(b => b.y1)) + MV - sTop);
    const ch = Math.round(Math.max(...rowBox.map(b => b.y1 - b.y0 + 1 + 2 * MV)));
    const gridW = cw * cols, u = gridW / 1400, m = Math.round(80 * u), my = Math.round(48 * u), labelW = Math.round(220 * u);
    const contentW = labelW + gridW, capH = Math.round(76 * u), secH = Math.round(100 * u);
    const width = m + contentW + m;
    const footH = Object.values(state.acc).some(Boolean) || montureOf(state.monture) ? 180 * u : 128 * u;     // ce que lxFooter renverra
    const height = Math.round(my + sH + capH + secH + ch * rows.length + 36 * u + footH + my + MV);
    const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = LX.paper; ctx.fillRect(0, 0, width, height);
    const gx = m + labelW;
    let y = my;
    // les trois poses fixes, centrées sur toute la largeur
    const sx0 = m + (contentW - 3 * cw) / 2;
    statics.forEach((im, i) => {
      const left = Math.floor(sx0) + i * cw;     // case posée sur un pixel entier, le reste passe dans la découpe
      ctx.drawImage(im, cropX(sInk[i], sx0 - Math.floor(sx0) + (cw - 1) / 2, sideOf(i, 3)), sTop, cw, sH, left, y, cw, sH);
      lxCaption(ctx, sx0 + i * cw + cw / 2, y + sH + 30 * u, String(i + 1).padStart(2, '0'), LX_ROT[viewsOf()[i][1]], u);
    });
    y += sH + capH;
    // « En mouvement » : titre de section, puis les instants au-dessus des colonnes
    lxRule(ctx, m, m + contentW, y + 14 * u, u);
    txt(ctx, 'EN MOUVEMENT', m, y + 58 * u, `400 ${Math.round(12 * u)}px ${LX.sans}`, LX.muted, 'left', 4 * u);
    instants.forEach((t, c) => txt(ctx, ((t / 60).toFixed(1).replace('.', ',').replace(',0', '')) + ' s', gx + c * cw + cw / 2, y + 58 * u,
                                   `400 ${Math.round(12 * u)}px ${LX.sans}`, LX.muted, 'center', 3 * u));
    y += secH;
    rows.forEach((row, r) => {
      const v = viewsOf()[3 + r], [what, dir] = v[2].split(', '), cy = y + ch / 2;
      if (r) lxRule(ctx, m, m + contentW, y, u);
      txt(ctx, String(4 + r).padStart(2, '0'), m, cy - 30 * u, `400 ${Math.round(11 * u)}px ${LX.sans}`, LX.muted, 'left', 3.5 * u);
      txt(ctx, what, m, cy + 8 * u, `500 ${Math.round(28 * u)}px ${LX.sans}`, LX.ink, 'left', -0.3 * u);
      txt(ctx, dir.replace('¾', 'trois-quarts'), m, cy + 36 * u, `400 ${Math.round(17 * u)}px ${LX.sans}`, LX.muted);
      const b = rowBox[r], sx = cropX(b, (cw - 1) / 2), sy = Math.round((b.y0 + b.y1) / 2 - (ch - 1) / 2);
      row.forEach((im, c) => ctx.drawImage(im, sx, sy, cw, ch, gx + c * cw, y, cw, ch));
      y += ch;
    });
    lxFooter(ctx, m, y + 36 * u, contentW, u);
    cv.layout = { m, labelW, gx, cw, ch, sH, cols, rows: rows.length, gridW, contentW };
    return cv;
  }
  // accès programmable (idées de skins, essais) : SKINATOR.apply({classe, sexe, colors, acc}) puis SKINATOR.planche(zoom, poses)
  window.SKINATOR = {
    state, planche, plancheAnim, gifAnim, catalogue: CAT, player, shareHash, team: { solveTeam, usage, openTeam, memberOf, members: () => teamMembers, model: () => teamModel, cards: teamCards, setAcc: (i, sl, a) => setTeamAcc(i, sl, a) },
    plancheGroupe, skins: { load: loadSkins, open: openSkins, compare: openCompare, cards: cmpCards },
    apply: async (o) => { Object.assign(state, o); $('#perso').value = ''; equipUI(); await render(); },
  };
  $('#png').onclick = async () => {
    const btn = $('#png'); btn.style.minWidth = btn.offsetWidth + 'px'; btn.disabled = true; btn.textContent = 'Export…';
    try {
      const cv = await planche(10), b = await new Promise(r => cv.toBlob(r, 'image/png'));
      b ? download(b, fileBase() + '.png') : alert('Export PNG refusé par le navigateur : utilise le bouton SVG.');
    } catch (e) { alert('Export PNG impossible (' + e.message + ') : utilise le bouton SVG.'); }
    finally { btn.disabled = false; btn.textContent = 'PNG 4 rotations'; btn.style.minWidth = ''; }
  };
  // menu Exporter : s'ouvre au clic (focus sur le premier choix), flèches haut / bas, Échap ou clic ailleurs le ferme ;
  // l'export choisi montre sa progression sur le bouton « Exporter »
  const exportItems = () => [...$('#exportMenu').querySelectorAll('[role=menuitem]:not(:disabled)')];
  function exportMenu(open, focusBtn = false) {
    $('#exportMenu').hidden = !open; $('#exportBtn').setAttribute('aria-expanded', String(open));
    if (open) exportItems()[0].focus(); else if (focusBtn) $('#exportBtn').focus();
  }
  $('#exportBtn').onclick = () => exportMenu($('#exportMenu').hidden);
  $('#exportMenu').addEventListener('keydown', (e) => {
    const items = exportItems(), i = items.indexOf(document.activeElement);
    const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (go !== undefined) { e.preventDefault(); items[(go + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); exportMenu(false, true); }
    else if (e.key === 'Tab') exportMenu(false);
  });
  document.addEventListener('pointerdown', (e) => { if (!$('#exportMenu').hidden && !e.target.closest('.menuwrap')) exportMenu(false); });
  async function exportFromMenu(label, run) {
    exportMenu(false, true);
    const btn = $('#exportBtn'), lbl = $('#exportLbl'); btn.style.minWidth = btn.offsetWidth + 'px'; btn.disabled = true; lbl.textContent = label;
    try { await run((t) => { lbl.textContent = t; }); }
    finally { btn.disabled = false; lbl.textContent = 'Exporter'; btn.style.minWidth = ''; if (document.activeElement === document.body) btn.focus(); }
  }
  $('#gif').onclick = () => exportFromMenu('GIF…', async (show) => {
    try {
      const b = await gifAnim(5, (i, n, enc) => show(enc ? 'GIF : encodage…' : `GIF ${Math.round(90 * i / n)} %`));
      download(b, fileBase() + '_animations.gif');
    } catch (e) { alert('Export GIF impossible (' + e.message + ').'); }
  });
  $('#pnganim').onclick = () => exportFromMenu('Export…', async () => {
    try {
      const cv = await plancheAnim(6), b = await new Promise(r => cv.toBlob(r, 'image/png'));
      b ? download(b, fileBase() + '_animations.png') : alert('Export PNG refusé par le navigateur.');
    } catch (e) { alert('Export PNG impossible (' + e.message + ').'); }
  });
  $('#teamPng').onclick = async () => {
    const btn = $('#teamPng'); btn.style.minWidth = btn.offsetWidth + 'px'; btn.disabled = true; btn.textContent = 'Export…';
    try {
      const cv = await plancheGroupe(teamCards(), teamPose, 10, 'perso'), b = await new Promise(r => cv.toBlob(r, 'image/png'));
      b ? download(b, `team_${teamMembers.length}-persos${teamPose === 'F' ? '' : '_' + POSE_FILE[teamPose]}.png`) : alert('Export PNG refusé par le navigateur.');
    } catch (e) { alert('Export PNG impossible (' + e.message + ').'); }
    finally { btn.disabled = false; btn.textContent = 'PNG de la team'; btn.style.minWidth = ''; }
  };
  const POSE_FILE = { F: 'face', R: 'trois-quarts-face', S: 'profil', L: 'trois-quarts-dos', B: 'dos' };
  $('#svgdl').onclick = () => { exportMenu(false, true); download(new Blob([svgString($('#stage'))], { type: 'image/svg+xml' }),
    `${fileBase()}_${state.mode === 'anim' ? 'anim-vue' + (state.vue + 1) : POSE_FILE[state.pose] + (state.miroir ? '-miroir' : '')}.svg`); };

  // ---------- lien de partage : le skin dans l'adresse de la page
  // index.html#c=9&s=0&k=f5e3ff,332d40,f5e3ff&a=16_41,81_57,18_31,82_106&m=20c (k : « - » = défaut ; a : emplacements
  // 1 à 4, vide = rien, « cle~n » = objet vivant au niveau n ; m : le n° du modèle de la monture, « c » en plus pour une
  // caméléone (« 20c »), absente = aucune ; l'ancien « m=cameleone » reste lu)
  function shareHash() {
    const k = [1, 2, 3].map(n => state.colors[n] != null ? hex(state.colors[n]).slice(1) : '-').join(',');
    const a = [1, 2, 3, 4].map(n => { const x = state.acc[n]; return x ? x.cle + (x.niveau != null ? '~' + x.niveau : '') : ''; }).join(',');
    const mo = cleanMonture(state.monture);
    return `c=${state.classe}&s=${state.sexe}&k=${k}&a=${a}` + (mo ? `&m=${mo.id}${mo.came ? 'c' : ''}` : '');
  }
  function applyHash() {                        // vrai si l'adresse portait un skin valable
    const q = new URLSearchParams(location.hash.slice(1));
    if (!q.has('c')) return false;
    const clean = () => history.replaceState(null, '', location.pathname + location.search);   // l'adresse redevient propre
    if (!isClasse(q.get('c'))) {                // lien abîmé : on le dit, rien ne change
      clean(); flash('Lien de skin illisible : rien n’a été changé.'); return false;
    }
    state.classe = +q.get('c'); state.sexe = q.get('s') === '1' ? 1 : 0;
    const k = (q.get('k') || '').split(',');
    state.colors = Object.fromEntries([1, 2, 3].map(n => [n, /^[0-9a-f]{6}$/i.test(k[n - 1] || '') ? parseInt(k[n - 1], 16) : null]));
    const parts = (q.get('a') || '').split(',');
    for (const n of [1, 2, 3, 4]) {
      const [cle, lvl] = (parts[n - 1] || '').split('~');
      state.acc[n] = cleanAcc({ cle, niveau: /^\d{1,3}$/.test(lvl || '') ? +lvl : null }, n);
    }
    const m = q.get('m') || '';
    const mm = /^(\d{1,4})(c?)$/.exec(m);
    state.monture = cleanMonture(m === 'cameleone' ? m : mm ? { id: +mm[1], came: !!mm[2] } : null);
    state.mode = 'fixe';
    clean();                                    // l'état reste mémorisé
    return true;
  }
  function flash(msg) {                         // un message bref dans la barre de l'aperçu
    setStatus(msg); clearTimeout(flash.t); flash.t = setTimeout(() => render(), 4000);
  }
  window.addEventListener('hashchange', () => {
    if (!new URLSearchParams(location.hash.slice(1)).has('c')) return;
    if (pickerSlot) closePicker();              // un lien ouvert par-dessus une fenêtre : on la ferme d'abord
    for (const [box, close] of [['#teambox', () => closeTeam()], ['#cmpbox', () => closeCompare()], ['#skinsbox', () => closeSkins()], ['#pipbox', () => closePipette()], ['#ideabox', () => closeIdeas()]])
      if ($(box).classList.contains('open')) close();
    if (applyHash()) { touched(); equipUI(); render(); }
  });
  $('#share').onclick = async () => {
    const url = location.href.split('#')[0] + '#' + shareHash(), b = $('#share');
    let ok = true;
    try { await navigator.clipboard.writeText(url); }
    catch (e) {                                 // repli : sélection d'un champ caché puis copie
      const t = document.createElement('textarea'); t.value = url; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } t.remove();
      b.focus();                                // le champ caché a pris le focus : on le rend au bouton
    }
    b.textContent = ok ? 'Lien copié' : 'Copie impossible'; clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = 'Copier le lien'; }, 1500);
  };

  // ---------- démarrage
  fillPersoMenu();
  restore();
  applyHash();
  equipUI();
  syncUI();
  // les idées se chargent ensuite, au repos, pour être prêtes au premier clic
  render();
  const later = () => setTimeout(() => (window.requestIdleCallback || setTimeout)(() => loadIdees().catch(() => {})), 2000);
  if (document.readyState === 'complete') later(); else addEventListener('load', later);
})();
