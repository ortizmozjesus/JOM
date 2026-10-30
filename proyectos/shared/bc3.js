// FIEBDC-3 (BC3): escritura y lectura en el navegador.
// Sigue el estilo de Presto 8.8 (FIEBDC-3/2002, ANSI/Windows-1252, CRLF):
// raíz "##", capítulos "#", partidas con medición detallada (~M) y texto largo (~T).

const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96,
  '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };

/** Codifica texto a bytes Windows-1252 (lo que espera Presto en un BC3 "ANSI"). */
export function encodeCp1252(str) {
  const out = new Uint8Array(str.length);
  let n = 0;
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out[n++] = c;
    else if (CP1252[ch]) out[n++] = CP1252[ch];
    else out[n++] = 0x3f; // '?'
  }
  return out.slice(0, n);
}

const clean = (s) => String(s ?? '').replace(/[|~\\\r\n]+/g, ' ').trim();
const fmt = (x, d = 3) => (Number.isFinite(+x) ? (+x).toFixed(d) : '');
export const fechaBC3 = (d = new Date()) =>
  String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(2);

export function cantidadPartida(p) {
  if (p.lines && p.lines.length) {
    return p.lines.reduce((s, l) => {
      const f = [l.units, l.length, l.width, l.height].filter((v) => v !== '' && v != null && Number.isFinite(+v));
      return s + (f.length ? f.reduce((a, b) => a * b, 1) : 0);
    }, 0);
  }
  return +p.qty || 0;
}

/**
 * obra = { code, name, chapters:[{ code, name, items:[{ code, unit, summary, text, price, qty?, lines?:[{comment, units, length, width, height}] }] }] }
 * Devuelve { text, bytes, total }.
 */
export function escribirBC3(obra, { programa = 'JOM Lab', version = '1.0' } = {}) {
  const f = fechaBC3();
  const L = [];
  const root = obra.code.endsWith('##') ? obra.code : obra.code.replace(/#*$/, '') + '##';
  let total = 0;
  const caps = obra.chapters.filter((c) => c.items.length);
  const capTotals = caps.map((c) => c.items.reduce((s, p) => s + cantidadPartida(p) * (+p.price || 0), 0));
  total = capTotals.reduce((a, b) => a + b, 0);

  L.push(`~V|${clean(programa)}|FIEBDC-3/2002|${clean(programa)} ${version}||ANSI|`);
  L.push('~K|\\2\\2\\3\\2\\2\\2\\2\\EUR\\|');
  L.push(`~C|${root}||${clean(obra.name).slice(0, 64)}|${fmt(total, 2)}|${f}|0|`);
  L.push(`~D|${root}|${caps.map((c) => `${c.code}\\1\\1\\`).join('')}|`);
  caps.forEach((c, ci) => {
    L.push(`~C|${c.code}||${clean(c.name).slice(0, 64)}|${fmt(capTotals[ci], 2)}|${f}|0|`);
    L.push(`~D|${c.code}|${c.items.map((p) => `${p.code}\\1\\${fmt(cantidadPartida(p))}\\`).join('')}|`);
    c.items.forEach((p, pi) => {
      const q = cantidadPartida(p);
      L.push(`~C|${p.code}|${clean(p.unit)}|${clean(p.summary).slice(0, 64)}|${fmt(p.price, 2)}|${f}|0|`);
      if (p.text) L.push(`~T|${p.code}|${clean(p.text)}|`);
      if (p.lines && p.lines.length) {
        const det = p.lines
          .map((l) => `\\${clean(l.comment)}\\${fmt(l.units)}\\${fmt(l.length)}\\${fmt(l.width)}\\${fmt(l.height)}\\`)
          .join('');
        L.push(`~M|${c.code}\\${p.code}|${ci + 1}\\${pi + 1}\\|${fmt(q)}|${det}|`);
      }
    });
  });
  const text = L.join('\r\n') + '\r\n';
  return { text, bytes: encodeCp1252(text), total };
}

export function descargar(nombre, datos, tipo = 'application/octet-stream') {
  const blob = datos instanceof Blob ? datos : new Blob([datos], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Lee un BC3 (bytes o texto) y devuelve el árbol con importes recalculados. */
export function leerBC3(input) {
  const text = typeof input === 'string' ? input : new TextDecoder('windows-1252').decode(input);
  const regs = text.split('~').slice(1).map((r) => r.replace(/[\r\n]+$/, ''));
  const C = new Map(); const D = new Map(); const T = new Map(); const M = new Map();
  let cabecera = '';
  for (const r of regs) {
    const f = r.split('|');
    const tipo = f[0];
    if (tipo === 'V') cabecera = [f[1], f[2], f[3]].filter(Boolean).join(' · ');
    else if (tipo === 'C') {
      for (const code of f[1].split('\\').filter(Boolean)) {
        C.set(code, { code, unit: f[2] || '', summary: f[3] || '', price: parseFloat((f[4] || '0').split('\\')[0]) || 0, tipo: f[6] || '' });
      }
    } else if (tipo === 'D') {
      const parts = (f[2] || '').split('\\');
      const hijos = [];
      for (let i = 0; i + 2 < parts.length; i += 3) {
        if (!parts[i]) continue;
        hijos.push({ code: parts[i], factor: parseFloat(parts[i + 1]) || 1, rend: parts[i + 2] === '' ? 1 : parseFloat(parts[i + 2]) || 0 });
      }
      D.set(f[1], hijos);
    } else if (tipo === 'T') T.set(f[1], f[2] || '');
    else if (tipo === 'M') {
      const [padre, hijo] = f[1].split('\\');
      const lines = [];
      const p = (f[4] || '').split('\\');
      for (let i = 0; i + 5 < p.length; i += 6) {
        lines.push({ tipo: p[i], comment: p[i + 1], units: p[i + 2], length: p[i + 3], width: p[i + 4], height: p[i + 5] });
      }
      M.set(`${padre}\\${hijo}`, { total: parseFloat(f[3]) || 0, lines });
    }
  }
  const raiz = [...C.keys()].find((k) => k.endsWith('##')) || [...C.keys()][0];
  const visit = (code, rend = 1, padre = null, depth = 0) => {
    const c = C.get(code) || { code, unit: '', summary: '(sin definir)', price: 0 };
    const hijos = D.get(code) || [];
    const node = { ...c, rend, depth, text: T.get(code) || '', med: M.get(`${padre}\\${code}`) || null, children: [] };
    if (hijos.length && depth < 8) {
      node.children = hijos.map((h) => visit(h.code, h.rend * h.factor, code, depth + 1));
      const suma = node.children.reduce((s, h) => s + h.rend * h.price, 0);
      // Capítulos (#): se suman. Partidas descompuestas: manda el precio del ~C (incluye %BI, medios aux.)
      if (code.endsWith('#') || !(c.price > 0)) node.price = suma;
    }
    node.amount = node.price * rend;
    return node;
  };
  const tree = raiz ? visit(raiz) : null;
  const count = { conceptos: C.size, mediciones: M.size };
  return { cabecera, tree, count };
}
