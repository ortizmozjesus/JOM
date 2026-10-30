import { descargar } from '../shared/bc3.js';

const $ = (s) => document.querySelector(s);
const CAPAS = {
  'A-MURO': { aci: 7, css: '#1a1a1a', w: 0.6 },
  'A-TABI': { aci: 8, css: '#6b6b6b', w: 0.35 },
  'A-CARP': { aci: 4, css: '#1f8fbf', w: 0.3 },
  'A-COTA': { aci: 1, css: '#cc0000', w: 0.25 },
  'A-TEXT': { aci: 3, css: '#2f7d3a', w: 0.25 },
};

/** Construye la planta: devuelve {lineas:[{c,x1,y1,x2,y2}], arcos:[], textos:[], sup:[]} */
function planta({ W, D, T, N, V, P }) {
  const L = [], A = [], X = [];
  const ln = (c, x1, y1, x2, y2) => L.push({ c, x1, y1, x2, y2 });
  const ti = 0.10;                                // tabique
  const cw = (W - 2 * T - (N - 1) * ti) / N;      // ancho libre de cada crujía
  // Huecos de fachada principal (y = 0): una ventana centrada por crujía
  const huecosF = [];
  for (let k = 0; k < N; k++) {
    const x0 = T + k * (cw + ti);
    const v = Math.min(V, cw - 0.4);
    if (v > 0.3) huecosF.push([x0 + (cw - v) / 2, x0 + (cw + v) / 2]);
  }
  // Puerta en fachada trasera (y = D), en la crujía central
  const kc = Math.floor(N / 2);
  const xc = T + kc * (cw + ti) + cw / 2;
  const p = Math.min(P, cw - 0.3);
  const huecosB = [[xc - p / 2, xc + p / 2]];

  // Línea horizontal con huecos
  const R = [];   // macizos para el poché del SVG
  const tramos = (x1, x2, huecos) => { const t = []; let x = x1; for (const [a, b] of huecos) { if (a > x) t.push([x, a]); x = b; } if (x < x2) t.push([x, x2]); return t; };
  tramos(0, W, huecosF).forEach(([a, b]) => R.push({ x: a, y: 0, w: b - a, h: T, c: 'A-MURO' }));
  tramos(0, W, huecosB).forEach(([a, b]) => R.push({ x: a, y: D - T, w: b - a, h: T, c: 'A-MURO' }));
  R.push({ x: 0, y: T, w: T, h: D - 2 * T, c: 'A-MURO' }, { x: W - T, y: T, w: T, h: D - 2 * T, c: 'A-MURO' });
  const conHuecos = (c, y, x1, x2, huecos) => {
    let x = x1;
    for (const [a, b] of huecos) { if (a > x) ln(c, x, y, a, y); x = b; }
    if (x < x2) ln(c, x, y, x2, y);
  };
  conHuecos('A-MURO', 0, 0, W, huecosF);
  conHuecos('A-MURO', T, T, W - T, huecosF);
  conHuecos('A-MURO', D, 0, W, huecosB);
  conHuecos('A-MURO', D - T, T, W - T, huecosB);
  ln('A-MURO', 0, 0, 0, D); ln('A-MURO', W, 0, W, D);
  ln('A-MURO', T, T, T, D - T); ln('A-MURO', W - T, T, W - T, D - T);
  const jambas = [...huecosF.map(([a, b]) => [a, b, 0]), ...huecosB.map(([a, b]) => [a, b, D - T])];
  for (const [x1, x2, y] of jambas) { ln('A-MURO', x1, y, x1, y + T); ln('A-MURO', x2, y, x2, y + T); }
  // Ventanas: marco exterior, interior y vidrio
  for (const [a, b] of huecosF) {
    ln('A-CARP', a, T * 0.35, b, T * 0.35); ln('A-CARP', a, T * 0.65, b, T * 0.65); ln('A-CARP', a, T * 0.5, b, T * 0.5);
  }
  // Puerta: hoja abierta 90º y arco de giro hacia dentro
  for (const [a, b] of huecosB) {
    ln('A-CARP', a, D - T, a, D - T - (b - a));
    A.push({ c: 'A-CARP', cx: a, cy: D - T, r: b - a, a0: 270, a1: 360 });
  }
  // Tabiques con paso de 0,80 m
  const sup = [];
  for (let k = 1; k < N; k++) {
    const x = T + k * cw + (k - 1) * ti;
    const y1 = D - T - 1.2, y0 = y1 - 0.8;
    for (const xx of [x, x + ti]) { ln('A-TABI', xx, T, xx, y0); ln('A-TABI', xx, y1, xx, D - T); }
    R.push({ x, y: T, w: ti, h: y0 - T, c: 'A-TABI' }, { x, y: y1, w: ti, h: D - T - y1, c: 'A-TABI' });
    ln('A-TABI', x, y0, x + ti, y0); ln('A-TABI', x, y1, x + ti, y1);
  }
  // Textos de estancia y superficie útil
  for (let k = 0; k < N; k++) {
    const x0 = T + k * (cw + ti);
    const s = cw * (D - 2 * T);
    sup.push(s);
    X.push({ c: 'A-TEXT', x: x0 + cw / 2, y: D / 2 + 0.25, h: Math.min(0.35, cw / 8), t: N === 1 ? 'ESTANCIA' : `ESTANCIA ${k + 1}` });
    X.push({ c: 'A-TEXT', x: x0 + cw / 2, y: D / 2 - 0.35, h: Math.min(0.25, cw / 10), t: `${s.toFixed(2).replace('.', ',')} m²` });
  }
  // Cotas: total horizontal y vertical, y crujías
  const cota = (x1, y1, x2, y2, off, txt, vertical = false) => {
    if (!vertical) {
      const y = y1 - off;
      ln('A-COTA', x1, y, x2, y); ln('A-COTA', x1, y1 - 0.15, x1, y - 0.15); ln('A-COTA', x2, y2 - 0.15, x2, y - 0.15);
      ln('A-COTA', x1 - 0.1, y - 0.1, x1 + 0.1, y + 0.1); ln('A-COTA', x2 - 0.1, y - 0.1, x2 + 0.1, y + 0.1);
      X.push({ c: 'A-COTA', x: (x1 + x2) / 2, y: y + 0.12, h: 0.22, t: txt });
    } else {
      const x = x1 - off;
      ln('A-COTA', x, y1, x, y2); ln('A-COTA', x1 - 0.15, y1, x - 0.15, y1); ln('A-COTA', x2 - 0.15, y2, x - 0.15, y2);
      ln('A-COTA', x - 0.1, y1 - 0.1, x + 0.1, y1 + 0.1); ln('A-COTA', x - 0.1, y2 - 0.1, x + 0.1, y2 + 0.1);
      X.push({ c: 'A-COTA', x: x - 0.15, y: (y1 + y2) / 2, h: 0.22, t: txt, rot: 90 });
    }
  };
  const f = (v) => v.toFixed(2).replace('.', ',');
  cota(0, 0, W, 0, 1.4, f(W));
  for (let k = 0; k < N; k++) { const x0 = T + k * (cw + ti); cota(x0, 0, x0 + cw, 0, 0.8, f(cw)); }
  cota(0, 0, 0, D, 0.9, f(D), true);
  return { L, A, X, R, sup };
}

// ------------------------------------------------------------ DXF R12
function dxf(pl) {
  const o = [];
  const g = (c, v) => o.push(String(c), String(v));
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 6); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, Object.keys(CAPAS).length);
  for (const [n, c] of Object.entries(CAPAS)) { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, c.aci); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const r = (v) => (+v).toFixed(4);
  for (const l of pl.L) { g(0, 'LINE'); g(8, l.c); g(10, r(l.x1)); g(20, r(l.y1)); g(30, 0); g(11, r(l.x2)); g(21, r(l.y2)); g(31, 0); }
  for (const a of pl.A) { g(0, 'ARC'); g(8, a.c); g(10, r(a.cx)); g(20, r(a.cy)); g(30, 0); g(40, r(a.r)); g(50, a.a0); g(51, a.a1); }
  for (const t of pl.X) {
    g(0, 'TEXT'); g(8, t.c); g(10, r(t.x)); g(20, r(t.y)); g(30, 0); g(40, r(t.h)); g(1, t.t.replace('²', '2'));
    if (t.rot) g(50, t.rot);
    g(72, 1); g(11, r(t.x)); g(21, r(t.y)); g(31, 0);
  }
  g(0, 'ENDSEC'); g(0, 'EOF');
  return o.join('\r\n') + '\r\n';
}

// ------------------------------------------------------------ SVG
function svg(pl, W, D) {
  const m = 2.2, s = 40;
  const vb = [-m * s, -(D + m * 0.8) * s, (W + 2 * m) * s, (D + 2 * m) * s].join(' ');
  const Y = (y) => -y * s;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" font-family="Work Sans, Arial, sans-serif">`];
  out.push(`<rect x="${-m * s}" y="${-(D + m * 0.8) * s}" width="${(W + 2 * m) * s}" height="${(D + 2 * m) * s}" fill="#fbfaf7"/>`);
  out.push(`<rect x="0" y="${Y(D)}" width="${W * s}" height="${D * s}" fill="#ece8e0"/>`);
  for (const r of pl.R) out.push(`<rect x="${r.x * s}" y="${Y(r.y + r.h)}" width="${r.w * s}" height="${r.h * s}" fill="${r.c === 'A-MURO' ? '#2b2b2b' : '#9a9a9a'}"/>`);
  for (const l of pl.L) {
    const c = CAPAS[l.c];
    out.push(`<line x1="${l.x1 * s}" y1="${Y(l.y1)}" x2="${l.x2 * s}" y2="${Y(l.y2)}" stroke="${c.css}" stroke-width="${c.w * s / 10}" stroke-linecap="square"/>`);
  }
  for (const a of pl.A) {
    const rad = (d) => (d * Math.PI) / 180;
    const p0 = [a.cx + a.r * Math.cos(rad(a.a0)), a.cy + a.r * Math.sin(rad(a.a0))];
    const p1 = [a.cx + a.r * Math.cos(rad(a.a1)), a.cy + a.r * Math.sin(rad(a.a1))];
    out.push(`<path d="M${p0[0] * s} ${Y(p0[1])} A${a.r * s} ${a.r * s} 0 0 0 ${p1[0] * s} ${Y(p1[1])}" fill="none" stroke="${CAPAS[a.c].css}" stroke-width="${CAPAS[a.c].w * s / 10}" stroke-dasharray="6 5"/>`);
  }
  for (const t of pl.X) {
    const tr = t.rot ? ` transform="rotate(${-t.rot} ${t.x * s} ${Y(t.y)})"` : '';
    out.push(`<text x="${t.x * s}" y="${Y(t.y)}" font-size="${t.h * s}" fill="${CAPAS[t.c].css}" text-anchor="middle"${tr}>${t.t}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

// ------------------------------------------------------------ UI
const ids = ['W', 'D', 'T', 'N', 'V', 'P'];
let actual = null;
function render() {
  const v = Object.fromEntries(ids.map((k) => [k, +$('#' + k).value]));
  ids.forEach((k) => ($('#o' + k).textContent = k === 'T' ? v[k] : (k === 'N' ? v[k] : v[k].toFixed(1).replace('.', ','))));
  const par = { ...v, T: v.T / 100 };
  const pl = planta(par);
  const txt = dxf(pl);
  const sv = svg(pl, par.W, par.D);
  $('#lienzo').innerHTML = sv;
  $('#code').textContent = txt.split('\r\n').slice(0, 60).join('\n') + '\n…';
  const su = pl.sup.reduce((a, b) => a + b, 0);
  $('#sup').innerHTML = `Superficie útil ${su.toFixed(2).replace('.', ',')} m² · construida ${(par.W * par.D).toFixed(2).replace('.', ',')} m² · ${pl.L.length} líneas, ${pl.X.length} textos.`;
  actual = { txt, sv, par };
  window.__demo = { ok: true, lineas: pl.L.length };
}
ids.forEach((k) => $('#' + k).addEventListener('input', render));
$('#capas').innerHTML = Object.entries(CAPAS).map(([n, c]) => `<span><i style="background:${c.css}"></i>${n} · ACI ${c.aci}</span>`).join('');
$('#dxf').addEventListener('click', () => descargar(`planta_${actual.par.W}x${actual.par.D}.dxf`, actual.txt, 'application/dxf'));
$('#svg').addEventListener('click', () => descargar(`planta_${actual.par.W}x${actual.par.D}.svg`, actual.sv, 'image/svg+xml'));
render();
