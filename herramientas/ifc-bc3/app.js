// IFC -> Mediciones -> BC3
// Visor: That Open Engine (Fragments). Cantidades: web-ifc (Qto y Pset del propio IFC).
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import * as WEBIFC from 'web-ifc';
import { escribirBC3, descargar } from './bc3.js';

const WASM = 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.77/';
const $ = (s) => document.querySelector(s);
const statusEl = $('#status');
const status = (t, hide = false) => { statusEl.textContent = t; statusEl.classList.toggle('hide', hide); };
const eur = (x) => x.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }));

// ------------------------------------------------------------------ visor
const viewerEl = $('#viewer');
const components = new OBC.Components();
const world = components.get(OBC.Worlds).create();
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = null;
world.renderer = new OBC.SimpleRenderer(components, viewerEl);
world.camera = new OBC.OrthoPerspectiveCamera(components);
components.init();
const grid = components.get(OBC.Grids).create(world);
grid.config.color = new THREE.Color(0xc4cccf);

const ifcLoader = components.get(OBC.IfcLoader);
const fragments = components.get(OBC.FragmentsManager);
let model = null;

async function initEngine() {
  await ifcLoader.setup({ autoSetWasm: false, wasm: { path: WASM, absolute: true } });
  fragments.init(await OBC.FragmentsManager.getWorker());
  world.camera.controls.addEventListener('update', () => fragments.core.update());
  fragments.list.onItemSet.add(({ value }) => {
    value.useCamera(world.camera.three);
    world.scene.three.add(value.object);
    fragments.core.update(true);
  });
  fragments.core.models.materials.list.onItemSet.add(({ value: mat }) => {
    if (!('isLodMaterial' in mat && mat.isLodMaterial)) {
      mat.polygonOffset = true; mat.polygonOffsetUnits = 1; mat.polygonOffsetFactor = Math.random();
    }
  });
}

async function fit() {
  if (!model) return;
  const box = model.box && !model.box.isEmpty() ? model.box : new THREE.Box3().setFromObject(model.object);
  if (box.isEmpty()) return;
  const s = box.getBoundingSphere(new THREE.Sphere());
  const c = s.center, r = s.radius;
  await world.camera.controls.setLookAt(c.x - r * 1.25, c.y + r * 0.75, c.z - r * 1.75, c.x, c.y - r * 0.1, c.z, true);
}

// ------------------------------------------------------------------ lectura de cantidades
let ifcApi = null;
async function getIfcApi() {
  if (ifcApi) return ifcApi;
  ifcApi = new WEBIFC.IfcAPI();
  ifcApi.SetWasmPath(WASM, true);
  await ifcApi.Init();
  return ifcApi;
}

const CLASES = ['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCSLAB', 'IFCROOF', 'IFCFOOTING', 'IFCCOLUMN', 'IFCBEAM', 'IFCMEMBER',
  'IFCPLATE', 'IFCWINDOW', 'IFCDOOR', 'IFCSTAIR', 'IFCSTAIRFLIGHT', 'IFCRAMP', 'IFCRAILING', 'IFCCOVERING', 'IFCCURTAINWALL', 'IFCPILE'];

const val = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);

/** Devuelve [{expressID, guid, cls, name, ptype, storey, q:{...}, p:{...}}] */
async function leerElementos(buffer) {
  const api = await getIfcApi();
  const id = api.OpenModel(buffer, { COORDINATE_TO_ORIGIN: false });
  const els = new Map();
  for (const cls of CLASES) {
    const T = WEBIFC[cls];
    if (T === undefined) continue;
    const ids = api.GetLineIDsWithType(id, T);
    for (let i = 0; i < ids.size(); i++) {
      const e = api.GetLine(id, ids.get(i), false);
      els.set(e.expressID, {
        expressID: e.expressID, guid: val(e.GlobalId), cls: cls.replace('STANDARDCASE', ''), name: val(e.Name) || '',
        ptype: val(e.PredefinedType) || '', ow: val(e.OverallWidth), oh: val(e.OverallHeight), storey: '', q: {}, p: {},
      });
    }
  }
  // Cantidades y propiedades
  const rels = api.GetLineIDsWithType(id, WEBIFC.IFCRELDEFINESBYPROPERTIES);
  for (let i = 0; i < rels.size(); i++) {
    const rel = api.GetLine(id, rels.get(i), false);
    const defId = val(rel.RelatingPropertyDefinition);
    const objs = (rel.RelatedObjects || []).map(val).filter((o) => els.has(o));
    if (!objs.length || !defId) continue;
    const def = api.GetLine(id, defId, false);
    const tipo = api.GetLineType(id, defId);
    if (tipo === WEBIFC.IFCELEMENTQUANTITY) {
      for (const qr of def.Quantities || []) {
        const q = api.GetLine(id, val(qr), false);
        const v = val(q.AreaValue) ?? val(q.VolumeValue) ?? val(q.LengthValue) ?? val(q.CountValue) ?? val(q.WeightValue);
        if (v != null) for (const o of objs) els.get(o).q[val(q.Name)] = +v;
      }
    } else if (tipo === WEBIFC.IFCPROPERTYSET) {
      for (const pr of def.HasProperties || []) {
        const p = api.GetLine(id, val(pr), false);
        if (p.NominalValue != null) for (const o of objs) els.get(o).p[val(p.Name)] = val(p.NominalValue);
      }
    }
  }
  // Planta de cada elemento
  const cont = api.GetLineIDsWithType(id, WEBIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
  for (let i = 0; i < cont.size(); i++) {
    const rel = api.GetLine(id, cont.get(i), false);
    const st = api.GetLine(id, val(rel.RelatingStructure), false);
    for (const o of (rel.RelatedElements || []).map(val)) if (els.has(o)) els.get(o).storey = val(st.Name) || '';
  }
  api.CloseModel(id);
  return [...els.values()];
}

// ------------------------------------------------------------------ reglas elemento -> partida
const CAPS = [
  ['CAP01#', 'Cimentación'], ['CAP02#', 'Estructura'], ['CAP03#', 'Fachadas y particiones'], ['CAP04#', 'Cubiertas'],
  ['CAP05#', 'Solados y soleras'], ['CAP06#', 'Carpintería exterior e interior'], ['CAP07#', 'Otros elementos del modelo'],
];
// q: lista de nombres de cantidad por orden de preferencia
const PARTIDAS = [
  { code: '01.01', cap: 'CAP01#', ud: 'm3', q: ['NetVolume', 'GrossVolume'], price: 165,
    summary: 'Losa de cimentación de hormigón armado HA-25/B/20/IIa',
    text: 'Losa de cimentación de hormigón armado HA-25/B/20/IIa, armada con acero B 500 S, incluso vertido, vibrado y curado. Medido el volumen teórico del modelo.',
    test: (e) => e.cls === 'IFCFOOTING' || e.cls === 'IFCPILE' || (e.cls === 'IFCSLAB' && e.ptype === 'BASESLAB') },
  { code: '02.01', cap: 'CAP02#', ud: 'm2', q: ['NetArea', 'GrossArea'], price: 96,
    summary: 'Forjado de losa maciza de hormigón armado',
    text: 'Forjado de losa maciza de hormigón armado HA-25, con encofrado, armado y hormigonado. Medida la superficie del modelo.',
    test: (e) => e.cls === 'IFCSLAB' && e.ptype !== 'ROOF' && e.ptype !== 'BASESLAB' && (e.q.Width ?? e.q.Depth ?? 0) >= 0.2 },
  { code: '02.02', cap: 'CAP02#', ud: 'm3', q: ['NetVolume', 'GrossVolume'], price: 420,
    summary: 'Pilares y vigas de hormigón armado',
    text: 'Pilares y vigas de hormigón armado HA-25, incluso encofrado y armado.',
    test: (e) => e.cls === 'IFCCOLUMN' || e.cls === 'IFCBEAM' },
  { code: '02.03', cap: 'CAP02#', ud: 'ud', q: [], price: 3200,
    summary: 'Escalera de zanca metálica con peldaño de madera',
    text: 'Escalera de un tramo con zancas de acero laminado y peldaños de madera maciza, incluso anclajes y barandilla.',
    test: (e) => e.cls === 'IFCSTAIR' || e.cls === 'IFCSTAIRFLIGHT' || e.cls === 'IFCRAMP' },
  { code: '03.01', cap: 'CAP03#', ud: 'm2', q: ['NetSideArea', 'GrossSideArea'], price: 78,
    summary: 'Muro exterior de fábrica de 30 cm revestido',
    text: 'Muro exterior de fábrica de bloque de hormigón de 30 cm, aislado y revestido por ambas caras. Medida la superficie neta, descontando huecos.',
    test: (e) => e.cls === 'IFCWALL' && (e.p.IsExternal === true || (e.q.Width ?? 0) >= 0.2) },
  { code: '03.02', cap: 'CAP03#', ud: 'm2', q: ['NetSideArea', 'GrossSideArea'], price: 34,
    summary: 'Tabique de ladrillo hueco doble de 10 cm',
    text: 'Tabique interior de ladrillo cerámico hueco doble de 10 cm, recibido con mortero, enlucido por ambas caras.',
    test: (e) => e.cls === 'IFCWALL' || e.cls === 'IFCCURTAINWALL' && false },
  { code: '03.03', cap: 'CAP03#', ud: 'm2', q: ['NetArea', 'GrossArea', 'Area'], price: 390,
    summary: 'Muro cortina de aluminio y vidrio',
    text: 'Fachada ligera de montantes y travesaños de aluminio con rotura de puente térmico y vidrio doble bajo emisivo.',
    test: (e) => e.cls === 'IFCCURTAINWALL' || e.cls === 'IFCPLATE' || e.cls === 'IFCMEMBER' },
  { code: '04.01', cap: 'CAP04#', ud: 'm2', q: ['NetArea', 'GrossArea'], price: 88,
    summary: 'Cubierta plana invertida no transitable',
    text: 'Cubierta plana invertida no transitable con formación de pendientes, impermeabilización bicapa, aislamiento XPS y acabado de grava.',
    test: (e) => e.cls === 'IFCROOF' || (e.cls === 'IFCSLAB' && e.ptype === 'ROOF') },
  { code: '05.01', cap: 'CAP05#', ud: 'm2', q: ['NetArea', 'GrossArea'], price: 39,
    summary: 'Solera de hormigón pulido de 15 cm',
    text: 'Solera de hormigón HA-25 de 15 cm con mallazo, acabado fratasado y pulido mecánico.',
    test: (e) => e.cls === 'IFCSLAB' || e.cls === 'IFCCOVERING' },
  { code: '06.01', cap: 'CAP06#', ud: 'm2', q: ['Area'], price: 430, ow: true,
    summary: 'Carpintería de aluminio con RPT y vidrio doble',
    text: 'Carpintería exterior de aluminio con rotura de puente térmico y doble acristalamiento bajo emisivo, incluso premarco y sellado. Medida la superficie del hueco.',
    test: (e) => e.cls === 'IFCWINDOW' },
  { code: '06.02', cap: 'CAP06#', ud: 'ud', q: [], price: 2600,
    summary: 'Portón pivotante de acero de gran formato',
    text: 'Portón de acceso pivotante de chapa de acero, de más de 1,50 m de ancho, con herrajes y cerradura.',
    test: (e) => e.cls === 'IFCDOOR' && ((e.q.Width ?? e.ow ?? 0) > 1.5) },
  { code: '06.03', cap: 'CAP06#', ud: 'ud', q: [], price: 420,
    summary: 'Puerta de paso de madera',
    text: 'Puerta de paso abatible de una hoja, de madera, con precerco, tapajuntas y herrajes.',
    test: (e) => e.cls === 'IFCDOOR' },
  { code: '07.01', cap: 'CAP07#', ud: 'ud', q: [], price: 0,
    summary: 'Elementos sin partida asignada (revisar)',
    text: 'Elementos del modelo que no encajan en ninguna regla. Se listan para revisarlos.',
    test: () => true },
];

let partidas = [];   // [{...def, lines:[{e, value, missing}], qty}]
let elementos = [];

function clasificar(els) {
  const map = new Map(PARTIDAS.map((p) => [p.code, { ...p, lines: [] }]));
  for (const e of els) {
    const def = PARTIDAS.find((p) => p.test(e));
    let value = null, src = '';
    if (def.ud === 'ud') { value = 1; src = 'unidad'; }
    else {
      for (const k of def.q) if (e.q[k] != null) { value = e.q[k]; src = k; break; }
      if (value == null && def.ow && e.ow && e.oh) { value = e.ow * e.oh; src = 'OverallWidth × OverallHeight'; }
    }
    map.get(def.code).lines.push({ e, value, src, missing: value == null });
    e.partida = def.code;
  }
  partidas = [...map.values()].filter((p) => p.lines.length);
  partidas.forEach((p) => { p.qty = p.lines.reduce((s, l) => s + (l.value || 0), 0); });
}

// ------------------------------------------------------------------ tabla
const tbody = $('#tabla tbody');
let selGuid = null;

function pintarTabla() {
  tbody.innerHTML = '';
  let total = 0;
  for (const [capCode, capName] of CAPS) {
    const ps = partidas.filter((p) => p.cap === capCode);
    if (!ps.length) continue;
    const trc = document.createElement('tr');
    trc.className = 'cap';
    const capTot = ps.reduce((s, p) => s + p.qty * p.price, 0);
    trc.innerHTML = `<td>${capCode.replace('#', '')}</td><td></td><td>${capName}</td><td></td><td></td><td class="n">${eur(capTot)}</td>`;
    tbody.appendChild(trc);
    for (const p of ps) {
      const tr = document.createElement('tr');
      tr.className = 'part';
      tr.dataset.code = p.code;
      const faltan = p.lines.filter((l) => l.missing).length;
      tr.innerHTML = `<td class="mono">${p.code}</td><td>${p.ud}</td><td>${p.summary}${faltan ? ` <span class="tag warn">${faltan} sin Qto</span>` : ''}</td>
        <td class="n">${num(p.qty, p.ud === 'ud' ? 0 : 2)}</td>
        <td class="n"><input class="num" type="number" min="0" step="1" value="${p.price}" aria-label="Precio ${p.code}"></td>
        <td class="n imp">${eur(p.qty * p.price)}</td>`;
      tr.querySelector('input').addEventListener('input', (ev) => {
        p.price = Math.max(0, +ev.target.value || 0);
        tr.querySelector('.imp').textContent = eur(p.qty * p.price);
        totales();
      });
      tr.addEventListener('click', (ev) => {
        if (ev.target.tagName === 'INPUT') return;
        const open = tr.classList.toggle('sel');
        tbody.querySelectorAll(`tr.line[data-code="${p.code}"]`).forEach((l) => (l.hidden = !open));
        if (open) resaltar(p.lines.map((l) => l.e.guid));
      });
      tbody.appendChild(tr);
      for (const l of p.lines) {
        const trl = document.createElement('tr');
        trl.className = 'line';
        trl.dataset.code = p.code;
        trl.dataset.guid = l.e.guid;
        trl.hidden = true;
        trl.innerHTML = `<td colspan="3">${l.e.name || l.e.cls} <span class="muted">· ${l.e.storey || 'sin planta'}</span></td>
          <td class="n">${l.missing ? '<span class="tag warn">medir</span>' : num(l.value, p.ud === 'ud' ? 0 : 2)}</td><td colspan="2" class="small muted">${l.src}</td>`;
        trl.addEventListener('click', () => seleccionar(l.e.guid, true));
        tbody.appendChild(trl);
      }
      total += p.qty * p.price;
    }
  }
  totales();
}

function totales() {
  const total = partidas.reduce((s, p) => s + p.qty * p.price, 0);
  $('#kTotal').textContent = eur(total);
  $('#kParts').textContent = partidas.length;
  $('#kElems').textContent = elementos.length;
  for (const tr of tbody.querySelectorAll('tr.cap')) {
    const capCode = tr.firstElementChild.textContent + '#';
    const t = partidas.filter((p) => p.cap === capCode).reduce((s, p) => s + p.qty * p.price, 0);
    tr.lastElementChild.textContent = eur(t);
  }
}

// ------------------------------------------------------------------ selección 3D <-> tabla
const HL = { color: new THREE.Color('#ff2800'), renderedFaces: FRAGS.RenderedFaces?.TWO ?? 1, opacity: 1, transparent: false };

async function resaltar(guids) {
  if (!model) return;
  await model.resetHighlight();
  const ids = (await model.getLocalIdsByGuids(guids)).filter((x) => x != null);
  if (ids.length) await model.highlight(ids, HL);
  await fragments.core.update(true);
}

async function seleccionar(guid, desdeTabla = false) {
  selGuid = guid;
  tbody.querySelectorAll('tr.line.sel').forEach((t) => t.classList.remove('sel'));
  const e = elementos.find((x) => x.guid === guid);
  if (!e) { $('#info').innerHTML = '<span class="muted">Elemento sin partida (no es un elemento constructivo).</span>'; await resaltar([]); return; }
  const p = partidas.find((x) => x.code === e.partida);
  const tr = tbody.querySelector(`tr.part[data-code="${p.code}"]`);
  if (!tr.classList.contains('sel')) tr.click();
  const tl = tbody.querySelector(`tr.line[data-guid="${guid}"]`);
  if (tl) { tl.classList.add('sel'); if (!desdeTabla) tl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  const qs = Object.entries(e.q).map(([k, v]) => `${k} ${num(v)}`).join(' · ') || 'sin cantidades en el IFC';
  $('#info').innerHTML = `<b>${e.name || e.cls}</b> <span class="tag">${e.cls}${e.ptype && e.ptype !== 'NOTDEFINED' ? ' · ' + e.ptype : ''}</span><br>
    <span class="muted small">Partida ${p.code} · ${p.summary}</span><br><span class="small mono">${qs}</span>`;
  await resaltar([guid]);
}

let down = null;
viewerEl.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; });
viewerEl.addEventListener('pointerup', async (ev) => {
  if (!model || !down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 4) return;
  if (ev.target.closest('.tools')) return;
  const res = await model.raycast({ camera: world.camera.three, mouse: new THREE.Vector2(ev.clientX, ev.clientY), dom: world.renderer.three.domElement });
  if (!res) { await model.resetHighlight(); await fragments.core.update(true); return; }
  const [guid] = await model.getGuidsByLocalIds([res.localId]);
  if (guid) seleccionar(guid);
});

// ------------------------------------------------------------------ carga
let nombreObra = 'Casa-Taller Escultor';

async function cargar(buffer, nombre) {
  try {
    $('#bc3').disabled = $('#csv').disabled = true;
    status('Leyendo cantidades con web-ifc…');
    elementos = await leerElementos(new Uint8Array(buffer));
    clasificar(elementos);
    pintarTabla();
    status('Convirtiendo a Fragments con That Open Engine…');
    if (model) { await fragments.core.disposeModel(model.modelId); model = null; }
    model = await ifcLoader.load(new Uint8Array(buffer), true, nombre.replace(/\W+/g, '_'), {
      processData: { progressCallback: (p) => status(`Convirtiendo a Fragments… ${Math.round(p * 100)} %`) },
    });
    await fragments.core.update(true);
    await fit();
    status('', true);
    nombreObra = nombre;
    $('#bc3').disabled = $('#csv').disabled = false;
    $('#info').innerHTML = `<b>${nombre}</b><br><span class="small muted">${elementos.length} elementos constructivos en ${partidas.length} partidas. Clic en el modelo o en una partida.</span>`;
    window.__ifcDemo = { elementos: elementos.length, partidas: partidas.length, ok: true };
  } catch (err) {
    console.error(err);
    status('No se pudo abrir el IFC: ' + (err?.message || err));
    window.__ifcDemo = { ok: false, error: String(err?.message || err) };
  }
}

$('#file').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if (f) cargar(await f.arrayBuffer(), f.name.replace(/\.ifc$/i, ''));
});
['dragenter', 'dragover'].forEach((t) => viewerEl.addEventListener(t, (e) => { e.preventDefault(); viewerEl.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((t) => viewerEl.addEventListener(t, (e) => { e.preventDefault(); viewerEl.classList.remove('dragging'); }));
viewerEl.addEventListener('drop', async (e) => {
  const f = [...e.dataTransfer.files].find((x) => /\.ifc$/i.test(x.name));
  if (f) cargar(await f.arrayBuffer(), f.name.replace(/\.ifc$/i, ''));
});

$('#fit').addEventListener('click', fit);
let xray = false;
$('#xray').addEventListener('click', async () => {
  if (!model) return;
  xray = !xray;
  $('#xray').classList.toggle('red', xray);
  if (xray) await model.setOpacity(undefined, 0.25); else await model.resetOpacity(undefined);
  await fragments.core.update(true);
});

// ------------------------------------------------------------------ exportar
function obraBC3() {
  return {
    code: nombreObra.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) + '##',
    name: nombreObra,
    chapters: CAPS.map(([code, name]) => ({
      code, name,
      items: partidas.filter((p) => p.cap === code).map((p) => ({
        code: p.code, unit: p.ud, summary: p.summary, text: p.text, price: p.price,
        lines: p.lines.map((l) => ({ comment: `${l.e.name || l.e.cls} [${l.e.guid}]${l.missing ? ' SIN QTO' : ''}`, units: l.missing ? '' : l.value })),
      })),
    })),
  };
}
$('#bc3').addEventListener('click', () => {
  const { bytes } = escribirBC3(obraBC3(), { programa: 'JOM IFC2BC3' });
  descargar(`${nombreObra.replace(/\W+/g, '_')}.bc3`, bytes);
});
$('#csv').addEventListener('click', () => {
  const rows = [['Capitulo', 'Codigo', 'Ud', 'Resumen', 'Elemento', 'GlobalId', 'Planta', 'Cantidad', 'Origen', 'Precio']];
  for (const p of partidas) for (const l of p.lines) {
    rows.push([p.cap, p.code, p.ud, p.summary, l.e.name, l.e.guid, l.e.storey, l.missing ? '' : String(l.value).replace('.', ','), l.src, String(p.price).replace('.', ',')]);
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  descargar(`${nombreObra.replace(/\W+/g, '_')}_mediciones.csv`, csv, 'text/csv;charset=utf-8');
});

// ------------------------------------------------------------------ arranque
(async () => {
  try {
    await initEngine();
    status('Descargando el modelo de ejemplo…');
    const buf = await (await fetch('./casa-taller.ifc')).arrayBuffer();
    await cargar(buf, 'Casa-Taller Escultor');
  } catch (err) {
    console.error(err);
    status('Error al iniciar: ' + (err?.message || err));
    window.__ifcDemo = { ok: false, error: String(err?.message || err) };
  }
})();
