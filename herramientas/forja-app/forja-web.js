// Forja web: el mismo interfaz que la app local, pero sin servidor.
// Sustituye /api/* por codigo que corre en el navegador y llama directo a Google u OpenAI.
// La clave se guarda solo en este navegador (localStorage). Las referencias, en IndexedDB.
import { construirTrabajos, referenciasUsadas, ordenarReferencias, slug } from './plantilla.js';

const nativeFetch = window.fetch.bind(window);
const NativeES = window.EventSource;

// ---------------------------------------------------------------- utilidades
const LS = (k, d) => { try { const v = localStorage.getItem('forja-web.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const LSset = (k, v) => { try { localStorage.setItem('forja-web.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const dos = (n) => String(n).padStart(2, '0');
const blobToB64 = (blob) => new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(String(l.result).split(',').pop()); l.onerror = ko; l.readAsDataURL(blob); });
const b64ToBlob = (b64, mime = 'image/png') => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
};
const MIMES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const mimeDe = (n) => MIMES[String(n).split('.').pop().toLowerCase()] || 'image/png';
const respuesta = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });

// ---------------------------------------------------------------- almacenamiento de referencias
const refs = new Map(); // archivo -> { archivo, mime, blob, url }
let idb;
const abrirIDB = () => new Promise((ok) => {
  try {
    const q = indexedDB.open('forja-web', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('refs', { keyPath: 'archivo' });
    q.onsuccess = () => ok(q.result);
    q.onerror = () => ok(null);
  } catch { ok(null); }
});
const tx = (modo) => idb.transaction('refs', modo).objectStore('refs');
const ready = (async () => {
  idb = await abrirIDB();
  if (!idb) return;
  await new Promise((ok) => {
    const q = tx('readonly').getAll();
    q.onsuccess = () => { for (const r of q.result) refs.set(r.archivo, { ...r, url: URL.createObjectURL(r.blob) }); ok(); };
    q.onerror = () => ok();
  });
})();
const guardarRef = (r) => { if (idb) tx('readwrite').put({ archivo: r.archivo, mime: r.mime, blob: r.blob }); };
const borrarRef = (a) => { if (idb) tx('readwrite').delete(a); };

// ---------------------------------------------------------------- PNG de prueba (sin coste)
async function imagenPrueba(texto, ancho, alto) {
  const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
  const g = c.getContext('2d');
  g.fillStyle = '#f1f7f8'; g.fillRect(0, 0, ancho, alto);
  g.fillStyle = '#c4cccf';
  for (let x = 12; x < ancho; x += 24) for (let y = 12; y < alto; y += 24) g.fillRect(x, y, 2, 2);
  g.strokeStyle = '#2aa7c9'; g.lineWidth = 3; g.strokeRect(24, 24, ancho - 48, alto - 48);
  g.fillStyle = '#0a1522'; g.font = '600 26px Georgia, serif';
  const palabras = String(texto).replace(/\s+/g, ' ').slice(0, 220).split(' ');
  let linea = ''; let y = 80;
  for (const p of palabras) {
    if (g.measureText(linea + p).width > ancho - 100) { g.fillText(linea, 48, y); y += 34; linea = ''; if (y > alto - 60) break; }
    linea += p + ' ';
  }
  if (y <= alto - 60) g.fillText(linea, 48, y);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}

// ---------------------------------------------------------------- proveedores
class ErrorProveedor extends Error {
  constructor(m, { estado = 0, reintentar = false, esperar = 0 } = {}) { super(m); this.estado = estado; this.reintentar = reintentar; this.esperar = esperar; }
}
function extraerBase64(obj, prof = 0) {
  if (!obj || prof > 8) return null;
  if (typeof obj === 'string') {
    const s = obj.startsWith('data:') ? obj.slice(obj.indexOf(',') + 1) : obj;
    return s.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 256)) ? s.replace(/\s/g, '') : null;
  }
  if (Array.isArray(obj)) { for (const v of obj) { const r = extraerBase64(v, prof + 1); if (r) return r; } return null; }
  if (typeof obj === 'object') {
    for (const k of ['b64_json', 'data', 'bytesBase64Encoded', 'image_bytes', 'imageBytes']) {
      if (typeof obj[k] === 'string') { const r = extraerBase64(obj[k], prof + 1); if (r) return r; }
    }
    for (const v of Object.values(obj)) { const r = extraerBase64(v, prof + 1); if (r) return r; }
  }
  return null;
}
const fallo = (estado, texto) => new ErrorProveedor(`HTTP ${estado}: ${String(texto).slice(0, 400)}`, { estado, reintentar: estado === 429 || estado === 408 || estado >= 500, esperar: estado === 429 ? 20000 : 3000 });
const TAM_OPENAI = { '1:1': '1024x1024', '4:5': '1024x1536', '2:3': '1024x1536', '9:16': '1024x1536', '3:2': '1536x1024', '16:9': '1536x1024', '4:3': '1536x1024', '3:4': '1024x1536' };
const refDe = (nombre) => { const r = refs.get(nombre); return r ? { blob: r.blob, mime: r.mime, nombre: r.archivo } : null; };

async function gemini({ modelo, apiKey, prompt, refs: rs, opciones }) {
  if (!apiKey) throw new ErrorProveedor('Falta la clave de Google (Gemini). Ponla en «Claves API».');
  const imgs = await Promise.all(rs.map(async (r) => ({ ...r, b64: await blobToB64(r.blob) })));
  const cuerpo = {
    model: modelo,
    input: [{ type: 'text', text: prompt }, ...imgs.map((r) => ({ type: 'image', mime_type: r.mime, data: r.b64 }))],
    response_format: { type: 'image', mime_type: opciones.formato === 'jpg' ? 'image/jpeg' : 'image/png', ...(opciones.aspecto ? { aspect_ratio: opciones.aspecto } : {}), ...(opciones.tamano ? { image_size: opciones.tamano } : {}) },
  };
  let r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  if (r.status === 404 || r.status === 400) {
    const alt = {
      contents: [{ role: 'user', parts: [{ text: prompt }, ...imgs.map((i) => ({ inline_data: { mime_type: i.mime, data: i.b64 } }))] }],
      generationConfig: { responseModalities: ['IMAGE'], ...(opciones.aspecto ? { imageConfig: { aspectRatio: opciones.aspecto } } : {}) },
    };
    const r2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(alt) });
    if (r2.ok) r = r2;
  }
  if (!r.ok) throw fallo(r.status, await r.text());
  const b64 = extraerBase64(await r.json());
  if (!b64) throw new ErrorProveedor('La respuesta no contiene imagen');
  const ext = opciones.formato === 'jpg' ? 'jpg' : 'png';
  return { blob: b64ToBlob(b64, MIMES[ext]), extension: ext };
}
async function openai({ modelo, apiKey, prompt, refs: rs, opciones }) {
  if (!apiKey) throw new ErrorProveedor('Falta la clave de OpenAI. Ponla en «Claves API».');
  const tamano = opciones.tamanoExacto || TAM_OPENAI[opciones.aspecto] || '1024x1024';
  const formato = opciones.formato === 'jpg' ? 'jpeg' : opciones.formato || 'png';
  let r;
  if (rs.length) {
    const fd = new FormData();
    fd.append('model', modelo); fd.append('prompt', prompt); fd.append('size', tamano); fd.append('output_format', formato);
    if (opciones.calidad) fd.append('quality', opciones.calidad);
    if (opciones.fidelidad) fd.append('input_fidelity', opciones.fidelidad);
    if (opciones.fondo) fd.append('background', opciones.fondo);
    for (const ref of rs.slice(0, 16)) fd.append('image', ref.blob, ref.nombre);
    r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd });
  } else {
    r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelo, prompt, n: 1, size: tamano, output_format: formato, ...(opciones.calidad ? { quality: opciones.calidad } : {}), ...(opciones.fondo ? { background: opciones.fondo } : {}) }) });
  }
  if (!r.ok) throw fallo(r.status, await r.text());
  const b64 = extraerBase64(await r.json());
  if (!b64) throw new ErrorProveedor('La respuesta no contiene imagen');
  const ext = formato === 'jpeg' ? 'jpg' : formato;
  return { blob: b64ToBlob(b64, MIMES[ext] || 'image/png'), extension: ext };
}
async function compatible({ modelo, apiKey, prompt, opciones, base }) {
  if (!base) throw new ErrorProveedor('Falta la URL base del proveedor compatible');
  const r = await fetch(base.replace(/\/$/, '') + '/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelo, prompt, n: 1, size: opciones.tamanoExacto || TAM_OPENAI[opciones.aspecto] || '1024x1024', response_format: 'b64_json' }) });
  if (!r.ok) throw fallo(r.status, await r.text());
  const b64 = extraerBase64(await r.json());
  if (!b64) throw new ErrorProveedor('La respuesta no contiene imagen');
  return { blob: b64ToBlob(b64, 'image/png'), extension: 'png' };
}
async function prueba({ prompt, opciones }) {
  await dormir(120 + Math.random() * 400);
  const [a, b] = (opciones.aspecto || '3:2').split(':').map(Number);
  return { blob: await imagenPrueba(prompt, 768, Math.round((768 * (b || 2)) / (a || 3))), extension: 'png' };
}
const PROVEEDORES = {
  gemini: { nombre: 'Google Gemini', fn: gemini, modelos: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'], refs: true, clave: 'Gemini' },
  openai: { nombre: 'OpenAI', fn: openai, modelos: ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'], refs: true, clave: 'OpenAI' },
  compatible: { nombre: 'Compatible OpenAI (fal, Together, local...)', fn: compatible, modelos: [], refs: false, clave: 'la API' },
  prueba: { nombre: 'Prueba (sin coste, imagenes falsas)', fn: prueba, modelos: ['mock'], refs: false, clave: null },
};

// ---------------------------------------------------------------- configuracion
const leerConfig = () => LS('config', {});
const guardarConfig = (c) => LSset('config', c);

// ---------------------------------------------------------------- eventos (EventSource simulado)
const oyentes = new Set();
const difundir = (ev) => { for (const o of oyentes) { try { o.onmessage && o.onmessage({ data: JSON.stringify(ev) }); } catch { /* oyente roto */ } } };
class EventSimulado { constructor() { oyentes.add(this); } close() { oyentes.delete(this); } }
window.EventSource = function (url, ...resto) { return String(url).startsWith('/api/eventos') ? new EventSimulado() : new NativeES(url, ...resto); };

// ---------------------------------------------------------------- ZIP minimo (sin compresion)
const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u) => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = TABLA[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
async function crearZip(archivos) { // [{nombre, blob|texto}]
  const enc = new TextEncoder(); const partes = []; const central = []; let pos = 0;
  for (const f of archivos) {
    const nombre = enc.encode(f.nombre);
    const datos = f.blob ? new Uint8Array(await f.blob.arrayBuffer()) : enc.encode(f.texto || '');
    const crc = crc32(datos);
    const cab = new DataView(new ArrayBuffer(30));
    cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true);
    cab.setUint32(14, crc, true); cab.setUint32(18, datos.length, true); cab.setUint32(22, datos.length, true); cab.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(cab.buffer), nombre, datos);
    const ce = new DataView(new ArrayBuffer(46));
    ce.setUint32(0, 0x02014b50, true); ce.setUint16(4, 20, true); ce.setUint16(6, 20, true); ce.setUint16(8, 0x0800, true);
    ce.setUint32(16, crc, true); ce.setUint32(20, datos.length, true); ce.setUint32(24, datos.length, true); ce.setUint16(28, nombre.length, true); ce.setUint32(42, pos, true);
    central.push(new Uint8Array(ce.buffer), nombre);
    pos += 30 + nombre.length + datos.length;
  }
  const tam = central.reduce((n, u) => n + u.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true); fin.setUint32(12, tam, true); fin.setUint32(16, pos, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' });
}
function descargar(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------------------------------------------------------------- lotes
function preparar(receta) {
  const refsR = receta.referencias || {};
  const resolver = (alias) => { const r = refsR[alias]; if (!r) return null; const ruta = String(r.ruta || r); const a = ruta.split('/').pop(); return refs.has(a) ? a : null; };
  return construirTrabajos(receta).map((t) => ({ ...t, rutasRef: t.referencias.map(resolver).filter(Boolean) }));
}
let loteActivo = null; let ultimoLote = [];
class Lote {
  constructor(receta, claves) {
    this.receta = receta; this.claves = claves; this.id = 'lote-' + Date.now().toString(36);
    this.cancelado = false; this.trabajos = preparar(receta); this.hechos = 0; this.fallidos = 0; this.resultados = [];
  }
  cancelar() { this.cancelado = true; difundir({ tipo: 'cancelado' }); }
  async ejecutar() {
    const r = this.receta; const prov = PROVEEDORES[r.proveedor];
    if (!prov) return difundir({ tipo: 'fatal', error: `Proveedor desconocido: ${r.proveedor}` });
    if (prov.clave && !this.claves[r.proveedor]) return difundir({ tipo: 'fatal', error: `Falta la clave de ${prov.nombre}. Ponla en «Claves API».` });
    if (!this.trabajos.length) return difundir({ tipo: 'fatal', error: 'La plantilla no genera ningún prompt.' });
    ultimoLote = [];
    difundir({ tipo: 'inicio', lote: this.id, total: this.trabajos.length, carpeta: 'este navegador', carpetaRel: 'este navegador (descarga el ZIP al terminar)', trabajos: this.trabajos.map((t) => ({ id: t.id, n: t.n, prompt: t.prompt, nombre: t.nombre, referencias: t.referencias })) });
    const cola = [...this.trabajos]; const hilos = Math.max(1, Math.min(12, Number(r.concurrencia) || 3));
    await Promise.all(Array.from({ length: hilos }, async () => { while (cola.length && !this.cancelado) await this.uno(cola.shift()); }));
    difundir({ tipo: 'fin', total: this.trabajos.length, hechos: this.hechos, fallidos: this.fallidos, carpeta: '', carpetaRel: '', cancelado: this.cancelado });
    window.dispatchEvent(new CustomEvent('forja:fin', { detail: { hechos: this.hechos } }));
  }
  async uno(t, intentosMax = 3) {
    const r = this.receta; difundir({ tipo: 'trabajo:inicio', id: t.id, n: t.n, prompt: t.prompt });
    let ultimo;
    for (let intento = 1; intento <= intentosMax; intento++) {
      if (this.cancelado) return;
      const t0 = Date.now();
      try {
        const { blob, extension } = await PROVEEDORES[r.proveedor].fn({ proveedor: r.proveedor, modelo: r.modelo, apiKey: this.claves[r.proveedor] || '', base: r.base, prompt: t.prompt, refs: t.rutasRef.map(refDe).filter(Boolean), opciones: r.opciones || {} });
        const nombre = `${t.nombre}.${extension}`; const url = URL.createObjectURL(blob);
        ultimoLote.push({ nombre, blob });
        if (r.guardarPrompt !== false) ultimoLote.push({ nombre: nombre.replace(/\.[^.]+$/, '.json'), texto: JSON.stringify({ prompt: t.prompt, combinacion: t.combo, variante: t.variante, referencias: t.referencias, proveedor: r.proveedor, modelo: r.modelo, opciones: r.opciones, fecha: new Date().toISOString() }, null, 2) });
        this.hechos++;
        difundir({ tipo: 'trabajo:ok', id: t.id, n: t.n, archivo: nombre, relativo: nombre, url, prompt: t.prompt, combo: t.combo, ms: Date.now() - t0, bytes: blob.size, hechos: this.hechos, fallidos: this.fallidos, total: this.trabajos.length });
        return;
      } catch (e) {
        ultimo = e; const reintentable = e instanceof ErrorProveedor ? e.reintentar : true;
        if (!reintentable || intento === intentosMax) break;
        const espera = (e.esperar || 2000) * intento;
        difundir({ tipo: 'trabajo:reintento', id: t.id, n: t.n, intento, espera, error: String(e.message).slice(0, 200) });
        await dormir(espera);
      }
    }
    this.fallidos++;
    difundir({ tipo: 'trabajo:error', id: t.id, n: t.n, error: String(ultimo?.message || ultimo).slice(0, 400), hechos: this.hechos, fallidos: this.fallidos, total: this.trabajos.length });
  }
}

// ---------------------------------------------------------------- exportar para Nano Banana (ZIP)
const ORIENTACION = { '1:1': 'cuadrada', '3:2': 'apaisada', '16:9': 'apaisada panorámica', '4:3': 'apaisada', '2:3': 'vertical', '9:16': 'vertical alargada', '3:4': 'vertical' };
const promptParaChat = (prompt, receta) => {
  const o = receta.opciones || {}; const partes = [prompt.trim()];
  if (o.aspecto) partes.push(`Formato de salida: imagen ${ORIENTACION[o.aspecto] || ''} de proporción ${o.aspecto}, la máxima resolución posible, sin texto, logotipos ni marcas de agua.`);
  return partes.join('\n\n');
};
const resumenTarea = (p) => { const m = p.match(/Tarea:\s*([\s\S]*?)(?:\n\n|$)/); const t = (m ? m[1] : p).replace(/\s+/g, ' ').trim(); return t.length > 220 ? t.slice(0, 217) + '…' : t; };
async function exportarManual(receta) {
  const trabajos = preparar(receta);
  if (!trabajos.length) throw new Error('La plantilla no genera ningún prompt.');
  const nombreLote = slug(receta.nombre || 'lote');
  const { alias } = ordenarReferencias(receta.referencias || {});
  const lista = []; const archivos = [];
  for (const [i, a] of alias.entries()) {
    const def = receta.referencias[a]; const origen = String(def.ruta).split('/').pop(); const r = refs.get(origen);
    if (!r) continue;
    const ext = (origen.match(/\.[^.]+$/) || ['.png'])[0];
    const destino = `${i + 1}-${def.rol || 'ref'}-${slug(a, 30)}${ext}`;
    archivos.push({ nombre: destino, blob: r.blob });
    lista.push({ orden: i + 1, alias: a, rol: def.rol || 'otra', archivo: destino, url: r.url });
  }
  const mapa = new Map();
  for (const t of trabajos) {
    const texto = promptParaChat(t.prompt, receta);
    const g = mapa.get(texto) || { prompt: texto, veces: 0, referencias: t.referencias, etiqueta: '' };
    g.veces++; if (!g.etiqueta) g.etiqueta = Object.values(t.combo).join(', ') || `imagen ${t.n}`; mapa.set(texto, g);
  }
  const grupos = [...mapa.values()].map((g, i) => ({ ...g, n: i + 1, tarea: resumenTarea(g.prompt) }));
  archivos.push({ nombre: 'prompts.txt', texto: grupos.map((g) => `${'='.repeat(70)}\n[${g.n}/${grupos.length}] ${g.etiqueta}${g.veces > 1 ? `  (pídelo ${g.veces} veces)` : ''}\n${'='.repeat(70)}\n\n${g.prompt}\n`).join('\n') });
  archivos.push({ nombre: 'LEEME.txt', texto: `SESIÓN MANUAL EN NANO BANANA\n\n1. Abre gemini.google.com o Google AI Studio y elige el modelo de imagen.\n2. Adjunta las imágenes de esta carpeta EN ESTE ORDEN:\n${lista.map((r) => `   ${r.orden}. ${r.archivo} (${r.rol})`).join('\n') || '   (ninguna)'}\n3. Pega el primer prompt de prompts.txt y envía.\n4. Sigue en la MISMA conversación con los siguientes prompts.\n\nPrompts distintos: ${grupos.length}\nImágenes previstas: ${trabajos.length}\n` });
  descargar(await crearZip(archivos), `${nombreLote}-nano-banana.zip`);
  return { carpeta: '', carpetaRel: 'el ZIP que se acaba de descargar', total: trabajos.length, refs: lista, grupos };
}

// ---------------------------------------------------------------- estudio (conversacion con Nano Banana)
const MODELOS = [
  { id: 'gemini-2.5-flash-image', nombre: 'Nano Banana (2.5 Flash)', precio: 0.039 },
  { id: 'gemini-3.1-flash-image', nombre: 'Nano Banana 2 (3.1 Flash)', precio: 0.067 },
  { id: 'gemini-3-pro-image', nombre: 'Nano Banana Pro (3 Pro)', precio: 0.134 },
  { id: 'mock', nombre: 'Prueba (sin coste, imágenes falsas)', precio: 0 },
];
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_PETICION = 18e6, MAX_HISTORIAL = 12e6, MAX_TURNOS = 8;
class ErrorApi extends Error { constructor(m, estado = 0, bruto = '') { super(m); this.estado = estado; this.bruto = bruto; } }
function explicar(estado, bruto) {
  let detalle = ''; try { detalle = JSON.parse(bruto)?.error?.message || ''; } catch { /* no era JSON */ }
  const d = (detalle || String(bruto)).slice(0, 300);
  if (estado === 400 && /api key/i.test(d)) return `La clave de API no es válida. Revísala en «Claves API». (${d})`;
  if (estado === 401 || estado === 403) return `Google rechaza la clave o no tiene permiso para este modelo. (${d})`;
  if (estado === 402) return `Sin saldo en la API de Gemini. (${d})`;
  if (estado === 404) return `Ese modelo no está disponible con tu clave. Prueba con otro. (${d})`;
  if (estado === 429) return `Demasiadas peticiones o cuota agotada. Espera un minuto y reintenta. (${d})`;
  if (estado >= 500) return `Fallo temporal de Google (${estado}). Reintenta en unos segundos. (${d})`;
  return `Error ${estado}: ${d}`;
}
async function llamarGemini({ modelo, clave, contents, aspecto, tamano }) {
  const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] }; const imageConfig = {};
  if (aspecto && aspecto !== 'auto') imageConfig.aspectRatio = aspecto;
  if (tamano && tamano !== 'auto' && !/2\.5/.test(modelo)) imageConfig.imageSize = tamano;
  if (Object.keys(imageConfig).length) generationConfig.imageConfig = imageConfig;
  const cuerpo = JSON.stringify({ contents, generationConfig }); let ultimo = new ErrorApi('Sin respuesta de Google');
  for (let intento = 0; intento < 3; intento++) {
    let r;
    try { r = await fetch(`${BASE}/models/${encodeURIComponent(modelo)}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': clave, 'Content-Type': 'application/json' }, body: cuerpo }); }
    catch (e) { ultimo = new ErrorApi(`No se pudo conectar con Google: ${e.message}`); await dormir(2000 * (intento + 1)); continue; }
    if (r.ok) return r.json();
    const bruto = await r.text(); ultimo = new ErrorApi(explicar(r.status, bruto), r.status, bruto);
    if (r.status === 429 || r.status >= 500) { await dormir(r.status === 429 ? 15000 : 3000 * (intento + 1)); continue; }
    throw ultimo;
  }
  throw ultimo;
}
function leerRespuesta(j) {
  const cand = j.candidates?.[0]; const partes = (cand?.content?.parts || []).filter((p) => p.thought !== true);
  let imagen = null; const textos = [];
  for (const p of partes) { const d = p.inlineData || p.inline_data; if (d?.data) { if (!imagen) imagen = { b64: d.data, mime: d.mimeType || d.mime_type || 'image/png' }; } else if (typeof p.text === 'string' && p.text.trim()) textos.push(p.text.trim()); }
  const texto = textos.join('\n');
  if (!imagen && !texto) {
    const bloqueo = j.promptFeedback?.blockReason; const fin = cand?.finishReason;
    if (bloqueo) throw new ErrorApi(`Google ha bloqueado la petición (${bloqueo}). Prueba a reformular la instrucción o cambiar la imagen.`);
    throw new ErrorApi(`El modelo no devolvió ninguna imagen${fin && fin !== 'STOP' ? ` (motivo: ${fin})` : ''}.`);
  }
  return { partes, imagen, texto };
}
async function simulado({ texto, aspecto }) {
  await dormir(300 + Math.random() * 500);
  if (/\berror\b/i.test(texto)) throw new ErrorApi('Fallo simulado (has escrito «error» en la instrucción).');
  const [a, b] = (aspecto && aspecto !== 'auto' ? aspecto : '3:2').split(':').map(Number);
  const b64 = await blobToB64(await imagenPrueba(texto, 768, Math.round((768 * (b || 2)) / (a || 3))));
  const aviso = 'Imagen de prueba: no se ha llamado a Google.';
  return { partes: [{ text: aviso }, { inlineData: { mimeType: 'image/png', data: b64 } }], imagen: { b64, mime: 'image/png' }, texto: aviso };
}
const conversaciones = new Map();
function crear() {
  const f = new Date(); const sello = `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}_${dos(f.getHours())}-${dos(f.getMinutes())}-${dos(f.getSeconds())}`;
  const conv = { id: `${sello}-${Math.random().toString(36).slice(2, 6)}`, historial: [], pendiente: null, turno: 0, nImg: 0, ultima: null, nota: null };
  conversaciones.set(conv.id, conv); return conv;
}
const tamanoB64 = (h) => h.reduce((n, m) => n + m.parts.reduce((k, p) => k + ((p.inlineData || p.inline_data)?.data?.length || 0), 0), 0);
function podar(conv) {
  let olvidado = false;
  while (conv.historial.length > MAX_TURNOS * 2 || (conv.historial.length > 2 && tamanoB64(conv.historial) > MAX_HISTORIAL)) { conv.historial.splice(0, 2); olvidado = true; }
  if (olvidado) conv.nota = 'Para no pasar el límite de tamaño, Nano Banana ya no recuerda los primeros pasos de esta conversación.';
}
function confirmar(conv, elegido) {
  const p = conv.pendiente; if (!p) return; conv.pendiente = null;
  const c = (elegido != null && p.candidatos[elegido] && !p.candidatos[elegido].error) ? p.candidatos[elegido] : p.candidatos.find((x) => !x.error);
  if (!c) return;
  conv.historial.push({ role: 'user', parts: p.partesUsuario }, { role: 'model', parts: c.partes });
  if (c.imagen) conv.ultima = { mime: c.imagen.mime, b64: c.imagen.b64 };
  podar(conv);
}
const extDe = (m) => (/jpe?g/.test(m) ? 'jpg' : /webp/.test(m) ? 'webp' : 'png');
async function generarUno({ conv, modelo, clave, contents, partesUsuario, texto, aspecto, tamano }) {
  if (modelo === 'mock') return simulado({ texto, aspecto });
  try { return leerRespuesta(await llamarGemini({ modelo, clave, contents, aspecto, tamano })); }
  catch (e) {
    const recuperable = e instanceof ErrorApi && e.estado === 400 && !/api key/i.test(e.bruto) && conv.historial.length;
    if (!recuperable) throw e;
    const parts = [];
    if (conv.ultima) parts.push({ text: 'Imagen base (resultado anterior):' }, { inlineData: { mimeType: conv.ultima.mime, data: conv.ultima.b64 } });
    parts.push(...partesUsuario);
    const r = leerRespuesta(await llamarGemini({ modelo, clave, contents: [{ role: 'user', parts }], aspecto, tamano })); r.simplificado = true; return r;
  }
}
async function enviarEstudio(clave, b) {
  const modelo = String(b.modelo || 'gemini-3.1-flash-image');
  if (!MODELOS.some((m) => m.id === modelo)) throw new Error(`Modelo desconocido: ${modelo}`);
  const texto = String(b.texto || '').trim();
  if (!texto) throw new Error('Escribe qué quieres hacer con las imágenes.');
  if (modelo !== 'mock' && !clave) throw new Error('Falta la clave de Gemini: pulsa «Claves API» arriba a la derecha.');
  const n = Math.min(4, Math.max(1, Number(b.n) || 1)); const entrada = [];
  for (const img of (Array.isArray(b.imagenes) ? b.imagenes : []).slice(0, 8)) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(img.datos || ''));
    if (!m) throw new Error(`La imagen «${img.nombre || 'sin nombre'}» no es PNG, JPG o WebP.`);
    entrada.push({ mime: m[1], b64: m[2], nombre: String(img.nombre || '').slice(0, 60) });
  }
  let conv = b.id && conversaciones.get(b.id);
  if (!conv) { conv = crear(); if (b.id) conv.nota = 'La conversación se reinició: Nano Banana ya no recuerda lo anterior. Adjunta de nuevo la imagen que quieras seguir editando.'; }
  confirmar(conv, null);
  const nImgAntes = conv.nImg; const partesUsuario = []; const entradas = [];
  for (const e of entrada) {
    conv.nImg += 1; entradas.push({ numero: conv.nImg, archivo: `imagen-${dos(conv.nImg)}.${extDe(e.mime)}` });
    partesUsuario.push({ text: `Imagen ${conv.nImg}${e.nombre ? ` (${e.nombre})` : ''}:` }, { inlineData: { mimeType: e.mime, data: e.b64 } });
  }
  partesUsuario.push({ text: texto });
  const contents = [...conv.historial, { role: 'user', parts: partesUsuario }];
  const peso = contents.reduce((k, m) => k + m.parts.reduce((s, p) => s + ((p.inlineData || p.inline_data)?.data?.length || 0), 0), 0);
  if (peso > MAX_PETICION) { conv.nImg = nImgAntes; throw new Error('Las imágenes pesan demasiado para una sola petición (límite ~20 MB). Adjunta menos imágenes o más pequeñas, o empieza una conversación nueva.'); }
  const turno = conv.turno + 1;
  const resultados = await Promise.all(Array.from({ length: n }, () => generarUno({ conv, modelo, clave, contents, partesUsuario, texto, aspecto: b.aspecto, tamano: b.tamano }).catch((e) => ({ error: String(e.message || e) }))));
  const candidatos = [];
  for (const r of resultados) { if (r.imagen) r.url = URL.createObjectURL(b64ToBlob(r.imagen.b64, r.imagen.mime)); candidatos.push(r); }
  const buenos = candidatos.filter((c) => !c.error);
  if (!buenos.length) conv.nImg = nImgAntes;
  else { conv.turno = turno; conv.pendiente = { turno, partesUsuario, candidatos }; if (buenos.length === 1) confirmar(conv, candidatos.indexOf(buenos[0])); }
  const nota = conv.nota || null; conv.nota = null;
  return { id: conv.id, carpeta: 'esta pestaña (descarga lo que quieras conservar)', turno, nImg: conv.nImg, entradas, pendiente: Boolean(conv.pendiente), nota, candidatos: candidatos.map((c) => ({ url: c.url || null, texto: c.texto || '', error: c.error || null, simplificado: Boolean(c.simplificado) })) };
}
async function probarClave(clave) {
  if (!clave) return { ok: false, mensaje: 'Todavía no hay ninguna clave de Gemini guardada.' };
  try {
    const ids = []; let pagina = '';
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${BASE}/models?pageSize=200${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''}`, { headers: { 'x-goog-api-key': clave } });
      if (!r.ok) return { ok: false, mensaje: explicar(r.status, await r.text()) };
      const j = await r.json(); for (const m of j.models || []) ids.push(String(m.name).replace(/^models\//, '')); pagina = j.nextPageToken || ''; if (!pagina) break;
    }
    const imagen = ids.filter((id) => /image/i.test(id));
    return { ok: true, modelos: imagen, mensaje: (imagen.length ? `La clave es válida. Modelos de imagen que ve tu cuenta: ${imagen.join(', ')}.` : 'La clave es válida, pero no veo modelos de imagen en tu cuenta.') + ' El saldo no se puede comprobar desde aquí.' };
  } catch (e) { return { ok: false, mensaje: `No se pudo conectar con Google: ${e.message}` }; }
}

// ---------------------------------------------------------------- enrutador /api/*
async function ruta(url, init = {}) {
  await ready;
  const u = new URL(url, 'http://x'); const p = u.pathname; const metodo = (init.method || 'GET').toUpperCase();
  const cuerpo = () => { try { return init.body ? JSON.parse(init.body) : {}; } catch { return {}; } };
  const cfg = leerConfig();
  try {
    if (p === '/api/estado') {
      return respuesta({
        proveedores: Object.fromEntries(Object.entries(PROVEEDORES).map(([k, v]) => [k, { nombre: v.nombre, modelos: v.modelos, refs: v.refs }])),
        claves: Object.fromEntries(Object.keys(PROVEEDORES).map((k) => [k, Boolean(cfg.claves?.[k])])),
        base: cfg.base || '', ultima: cfg.ultima || null, referencias: [...refs.keys()],
        recetas: Object.keys(LS('recetas', {})).map((n) => n + '.json'), ocupado: Boolean(loteActivo),
      });
    }
    if (p === '/api/claves' && metodo === 'POST') {
      const b = cuerpo(); cfg.claves = { ...(cfg.claves || {}) };
      for (const [k, v] of Object.entries(b.claves || {})) if (typeof v === 'string' && v.trim()) cfg.claves[k] = v.trim();
      if (b.base !== undefined) cfg.base = b.base; guardarConfig(cfg); return respuesta({ ok: true });
    }
    if (p === '/api/referencias' && metodo === 'POST') {
      const { nombre, datos } = cuerpo(); let limpio = String(nombre || 'ref').replace(/[^\w.-]/g, '_');
      const mime = (/^data:([^;]+);/.exec(String(datos)) || [])[1] || mimeDe(limpio);
      const blob = b64ToBlob(String(datos).split(',').pop(), mime);
      const r = { archivo: limpio, mime, blob, url: URL.createObjectURL(blob) }; refs.set(limpio, r); guardarRef(r);
      return respuesta({ ok: true, archivo: limpio });
    }
    if (p === '/api/referencias/borrar' && metodo === 'POST') { const { archivo } = cuerpo(); refs.delete(String(archivo)); borrarRef(String(archivo)); return respuesta({ ok: true }); }
    if (p === '/api/receta' && metodo === 'POST') { const { nombre, receta } = cuerpo(); const todas = LS('recetas', {}); const n = String(nombre || 'receta').replace(/[^\w.-]/g, '_'); todas[n] = receta; LSset('recetas', todas); return respuesta({ ok: true, archivo: n + '.json' }); }
    if (p === '/api/receta' && metodo === 'GET') { const n = (u.searchParams.get('nombre') || '').replace(/\.json$/, ''); const r = LS('recetas', {})[n]; return r ? respuesta(r) : respuesta({ error: 'No existe esa receta' }, 404); }
    if (p === '/api/previsualizar') {
      const { receta } = cuerpo(); const trabajos = preparar(receta);
      const definidas = Object.keys(receta.referencias || {}).map((k) => k.toLowerCase());
      const faltantes = referenciasUsadas(`${receta.plantilla || ''} ${receta.sufijo || ''}`).filter((r) => !definidas.includes(r.toLowerCase()));
      return respuesta({ total: trabajos.length, faltantes, ejemplos: trabajos.slice(0, 12).map((t) => ({ n: t.n, nombre: t.nombre, prompt: t.prompt, referencias: t.referencias })) });
    }
    if (p === '/api/exportar') { const { receta } = cuerpo(); cfg.ultima = receta; guardarConfig(cfg); return respuesta(await exportarManual(receta)); }
    if (p === '/api/lote') {
      if (loteActivo) return respuesta({ error: 'Ya hay un lote en marcha' }, 409);
      const { receta } = cuerpo(); cfg.ultima = receta; guardarConfig(cfg);
      const lote = new Lote(receta, { ...(cfg.claves || {}) }); loteActivo = lote;
      setTimeout(() => lote.ejecutar().catch((e) => difundir({ tipo: 'fatal', error: String(e.message || e) })).finally(() => { loteActivo = null; }), 50);
      return respuesta({ ok: true, lote: lote.id, total: lote.trabajos.length });
    }
    if (p === '/api/cancelar') { if (loteActivo) loteActivo.cancelar(); return respuesta({ ok: true }); }
    if (p === '/api/estudio/modelos') return respuesta(MODELOS);
    if (p === '/api/estudio/nueva') { const c = crear(); return respuesta({ id: c.id, carpeta: c.id }); }
    if (p === '/api/estudio/enviar') { try { return respuesta(await enviarEstudio(cfg.claves?.gemini || '', cuerpo())); } catch (e) { return respuesta({ error: String(e.message || e) }, 400); } }
    if (p === '/api/estudio/elegir') { const b = cuerpo(); const conv = conversaciones.get(b.id); if (!conv?.pendiente || conv.pendiente.turno !== Number(b.turno)) return respuesta({ ok: false }); confirmar(conv, Number(b.candidato)); return respuesta({ ok: true }); }
    if (p === '/api/estudio/probar') return respuesta(await probarClave(cfg.claves?.gemini || ''));
  } catch (e) { return respuesta({ error: String(e.message || e) }, 500); }
  return respuesta({ error: 'No encontrado' }, 404);
}
window.fetch = (input, init) => { const u = typeof input === 'string' ? input : input?.url || ''; return u.startsWith('/api/') ? ruta(u, init) : nativeFetch(input, init); };

// ---------------------------------------------------------------- hooks para la interfaz
window.FORJA_WEB = {
  refUrl: (archivo) => refs.get(archivo)?.url || '',
  async descargarUltimoLote() { if (ultimoLote.length) descargar(await crearZip(ultimoLote), `forja-lote-${Date.now().toString(36)}.zip`); },
  hayLote: () => ultimoLote.length > 0,
};
