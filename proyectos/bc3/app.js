import { escribirBC3, leerBC3, descargar } from '../shared/bc3.js';

const $ = (s) => document.querySelector(s);
const eur = (x) => (x || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n3 = (x) => (x || 0).toLocaleString('es-ES', { maximumFractionDigits: 3 });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------ pestañas
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== b.dataset.tab));
}));

// ------------------------------------------------------------ tabla -> BC3
const EJEMPLO = `Demoliciones\t01.01\tm2\tDemolición de solera existente de hormigón\t180\t14,50
Demoliciones\t01.02\tud\tDesmontaje de instalación eléctrica existente\t1\t650
Pavimentos\t02.01\tm2\tSolera de hormigón pulido HA-25 de 15 cm\t180\t38,90
Pavimentos\t02.02\tm2\tRevestimiento continuo de resina epoxi autonivelante\t180\t27,40
Pavimentos\t02.03\tm\tRodapié sanitario de resina\t64\t12,80
Cerramientos\t03.01\tm2\tPanel sándwich de 50 mm lacado en blanco\t96\t46,20
Cerramientos\t03.02\tm2\tPartición de panel sándwich con puerta de paso\t24\t58,00
Saneamiento\t04.01\tm\tRejilla lineal de acero inoxidable con canaleta\t18\t142,00`;

const numES = (s) => {
  const t = String(s ?? '').trim().replace(/\s|€/g, '');
  if (!t) return NaN;
  return /,\d{1,3}$/.test(t) || (t.includes('.') && t.includes(',')) ? +t.replace(/\./g, '').replace(',', '.') : +t.replace(',', '.');
};

function parseTabla(txt) {
  const caps = new Map();
  const errores = [];
  txt.split(/\r?\n/).forEach((linea, i) => {
    if (!linea.trim()) return;
    const f = linea.split(linea.includes('\t') ? '\t' : ';').map((x) => x.trim());
    if (f.length < 6) { errores.push(`Línea ${i + 1}: faltan columnas (${f.length} de 6)`); return; }
    const [cap, code, unit, summary, q, p] = f;
    const qty = numES(q), price = numES(p);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) { errores.push(`Línea ${i + 1}: cantidad o precio no numérico`); return; }
    if (!caps.has(cap)) caps.set(cap, []);
    caps.get(cap).push({ code, unit, summary, qty, price, text: summary });
  });
  const chapters = [...caps.entries()].map(([name, items], i) => ({ code: `CAP${String(i + 1).padStart(2, '0')}#`, name, items }));
  return { chapters, errores };
}

function previsualizar() {
  const { chapters, errores } = parseTabla($('#tabla').value);
  const tb = $('#prev tbody');
  tb.innerHTML = '';
  let total = 0;
  for (const c of chapters) {
    const ct = c.items.reduce((s, p) => s + p.qty * p.price, 0);
    total += ct;
    tb.insertAdjacentHTML('beforeend', `<tr class="d1"><td class="code">${c.code}</td><td></td><td>${esc(c.name)}</td><td></td><td></td><td class="n">${eur(ct)}</td></tr>`);
    for (const p of c.items) {
      tb.insertAdjacentHTML('beforeend', `<tr><td class="code">${esc(p.code)}</td><td>${esc(p.unit)}</td><td>${esc(p.summary)}</td><td class="n">${n3(p.qty)}</td><td class="n">${eur(p.price)}</td><td class="n">${eur(p.qty * p.price)}</td></tr>`);
    }
  }
  tb.insertAdjacentHTML('beforeend', `<tr class="sum"><td></td><td></td><td>Presupuesto de ejecución material</td><td></td><td></td><td class="n">${eur(total)}</td></tr>`);
  $('#chk').innerHTML = errores.length
    ? `<span class="tag warn">${errores.length} línea(s) sin leer</span> ${errores.map(esc).join(' · ')}`
    : `<span class="tag ok">OK</span> ${chapters.reduce((s, c) => s + c.items.length, 0)} partidas en ${chapters.length} capítulos.`;
  return chapters;
}

$('#tabla').value = EJEMPLO;
$('#tabla').addEventListener('input', previsualizar);
previsualizar();
$('#gen').addEventListener('click', () => {
  const chapters = previsualizar();
  const nombre = $('#obra').value.trim() || 'Obra';
  const { bytes } = escribirBC3({ code: nombre.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12), name: nombre, chapters }, { programa: 'JOM Tabla2BC3' });
  descargar(nombre.replace(/\W+/g, '_') + '.bc3', bytes);
});

// ------------------------------------------------------------ lector BC3
function pintarArbol({ cabecera, tree, count }, nombre) {
  const tb = $('#arbol tbody');
  tb.innerHTML = '';
  $('#cab').textContent = `${nombre} · ${cabecera} · ${count.conceptos} conceptos, ${count.mediciones} mediciones`;
  if (!tree) { tb.innerHTML = '<tr><td colspan="6">No se encontró la raíz del presupuesto.</td></tr>'; return; }
  const filas = [];
  const visit = (n) => {
    const esPartida = !n.code.endsWith('#') && n.depth >= 1;
    filas.push(`<tr class="d${Math.min(n.depth, 2)} ${esPartida ? 'part' : ''}" data-code="${esc(n.code)}" title="${esc(n.text)}">
      <td class="code">${'&nbsp;'.repeat(Math.max(0, n.depth - 1) * 2)}${esc(n.code)}</td><td>${esc(n.unit)}</td><td>${esc(n.summary)}</td>
      <td class="n">${n.depth ? n3(n.rend) : ''}</td><td class="n">${eur(n.price)}</td><td class="n">${eur(n.amount)}</td></tr>`);
    if (esPartida && n.med) {
      for (const l of n.med.lines) {
        const f = [l.units, l.length, l.width, l.height].filter((v) => v !== '' && v != null && !Number.isNaN(+v));
        filas.push(`<tr class="med" data-of="${esc(n.code)}" hidden><td colspan="3">${esc(l.comment)}</td><td class="n">${f.length ? n3(f.reduce((a, b) => a * +b, 1)) : ''}</td><td></td><td></td></tr>`);
      }
    }
    if (n.code.endsWith('#') || n.depth === 0) n.children.forEach(visit);
  };
  visit(tree);
  tb.innerHTML = filas.join('');
  tb.querySelectorAll('tr.part').forEach((tr) => tr.addEventListener('click', () => {
    tb.querySelectorAll(`tr.med[data-of="${CSS.escape(tr.dataset.code)}"]`).forEach((m) => (m.hidden = !m.hidden));
  }));
  window.__demo = { ok: true, total: tree.amount, filas: filas.length };
}

async function abrir(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  pintarArbol(leerBC3(buf), file.name);
}
const drop = $('#drop');
drop.addEventListener('click', () => $('#file').click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') $('#file').click(); });
$('#file').addEventListener('change', (e) => e.target.files[0] && abrir(e.target.files[0]));
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) abrir(f); });

function ejemplo() {
  const { text } = escribirBC3({ code: 'REFORMA', name: 'Reforma de sala de producción', chapters: parseTabla(EJEMPLO).chapters }, { programa: 'JOM Tabla2BC3' });
  pintarArbol(leerBC3(text), 'ejemplo.bc3');
}
$('#ejemplo').addEventListener('click', ejemplo);
ejemplo();
