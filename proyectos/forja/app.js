import { construirTrabajos, variablesUsadas, extraerAlternativas, referenciasUsadas } from './plantilla.js';
import { descargar } from '../shared/bc3.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Recetas de ejemplo (las mismas que trae la app en /ejemplos)
const RECETAS = {
  crear: {
    plantilla: 'Render arquitectónico exterior de {{tipo}} con fachada de [hormigón visto|piedra caliza|estuco blanco], luz de {{hora}}, siguiendo la paleta de @moodboard',
    sufijo: 'fotorrealista, cámara a la altura del ojo, lente 24 mm, sin texto ni marcas de agua',
    variables: { tipo: 'casa patio de una planta, vivienda entre medianeras, pabellón de invitados', hora: 'amanecer, hora azul' },
    referencias: { moodboard: { rol: 'estilo' } },
    patronNombre: '{{indice}}-{{tipo}}-{{hora}}',
  },
  composicion: {
    modo: 'composicion',
    plantilla: 'coloca la máquina de @maquina [junto al muro del fondo|en el centro de la nave|en la esquina derecha, en diagonal], a la luz de {{hora}}',
    sufijo: '',
    conservar: 'la estructura metálica, las instalaciones existentes ni el encuadre',
    variables: { hora: 'media tarde, primera hora de la mañana' },
    referencias: { 'nave-actual': { rol: 'base' }, maquina: { rol: 'objeto' }, 'concepto-3d': { rol: 'estilo' } },
    patronNombre: '{{indice}}-{{hora}}-v{{variante}}',
    variantes: 2,
  },
};
let modo = 'crear';
let estado = structuredClone(RECETAS.crear);

function cargar(m) {
  modo = m;
  estado = structuredClone(RECETAS[m]);
  document.querySelectorAll('.modo button').forEach((b) => b.classList.toggle('on', b.dataset.modo === m));
  $('#plantilla').value = estado.plantilla;
  $('#sufijo').value = estado.sufijo || '';
  $('#conservar').value = estado.conservar || '';
  $('#bloqueConservar').hidden = m !== 'composicion';
  $('#variantes').value = estado.variantes || 1;
  pintarVars();
  pintarRefs();
  generar();
}

function pintarVars() {
  const usadas = variablesUsadas(extraerAlternativas($('#plantilla').value + ', ' + $('#sufijo').value).base).filter((v) => !v.startsWith('_alt'));
  for (const v of usadas) if (!(v in estado.variables)) estado.variables[v] = '';
  $('#vars').innerHTML = usadas.length
    ? usadas.map((v) => `<div class="v"><span class="mono small" style="padding-top:.45rem">{{${esc(v)}}}</span><input class="txt" data-v="${esc(v)}" value="${esc(estado.variables[v])}"></div>`).join('')
    : '<p class="small muted">Escribe {{algo}} en la plantilla para crear una variable.</p>';
  $('#vars').querySelectorAll('input').forEach((i) => i.addEventListener('input', () => { estado.variables[i.dataset.v] = i.value; generar(); }));
}

function pintarRefs() {
  const usadas = referenciasUsadas($('#plantilla').value);
  for (const r of usadas) if (!estado.referencias[r]) estado.referencias[r] = { rol: modo === 'composicion' ? 'otra' : 'estilo' };
  const todas = Object.keys(estado.referencias);
  $('#refs').innerHTML = todas.length
    ? todas.map((r) => `<div class="r"><span class="mono small">@${esc(r)}</span>${modo === 'composicion'
      ? `<select class="txt" data-r="${esc(r)}">${['base', 'objeto', 'material', 'estilo', 'otra'].map((x) => `<option ${estado.referencias[r].rol === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`
      : '<span class="small muted">imagen adjunta</span>'}</div>`).join('')
    : '<p class="small muted">Escribe @nombre en la plantilla para adjuntar una imagen.</p>';
  $('#refs').querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { estado.referencias[s.dataset.r].rol = s.value; generar(); }));
}

let trabajos = [];
function generar() {
  const receta = {
    ...estado,
    plantilla: $('#plantilla').value,
    sufijo: $('#sufijo').value,
    conservar: $('#conservar').value,
    variantes: Math.max(1, Math.min(4, +$('#variantes').value || 1)),
    variables: Object.fromEntries(Object.entries(estado.variables).map(([k, v]) => [k, String(v).split(',').map((x) => x.trim()).filter(Boolean)])),
  };
  try {
    trabajos = construirTrabajos(receta);
  } catch (e) {
    trabajos = [];
  }
  $('#cuenta').textContent = trabajos.length;
  $('#coste').textContent = trabajos.length ? `≈ ${(trabajos.length * 0.039).toFixed(2).replace('.', ',')} $ con Nano Banana · ${new Set(trabajos.map((t) => t.prompt)).size} prompts distintos` : '';
  const vals = new Set(Object.values(receta.variables).flat().concat(extraerAlternativas(receta.plantilla).grupos.flatMap((g) => g.opciones)));
  const marcar = (txt) => {
    let out = esc(txt);
    for (const v of [...vals].sort((a, b) => b.length - a.length)) if (v.length > 2) out = out.split(esc(v)).join(`<mark>${esc(v)}</mark>`);
    return out;
  };
  $('#lista').innerHTML = trabajos.slice(0, 60).map((t) => `<div class="job"><div class="n">${t.nombre}.png${t.referencias.length ? ' · refs: ' + t.referencias.map((r, i) => `${i + 1}) ${esc(r)}`).join(' ') : ''}</div><p>${marcar(t.prompt)}</p></div>`).join('')
    + (trabajos.length > 60 ? `<p class="small muted">… y ${trabajos.length - 60} más.</p>` : '');
  window.__demo = { ok: true, n: trabajos.length };
}

document.querySelectorAll('.modo button').forEach((b) => b.addEventListener('click', () => cargar(b.dataset.modo)));
['plantilla', 'sufijo'].forEach((id) => $('#' + id).addEventListener('input', () => { pintarVars(); pintarRefs(); generar(); }));
['conservar', 'variantes'].forEach((id) => $('#' + id).addEventListener('input', generar));
$('#txt').addEventListener('click', () => {
  const txt = trabajos.map((t, i) => `### ${i + 1} · ${t.nombre}\n${t.referencias.length ? 'Adjunta: ' + t.referencias.join(', ') + '\n' : ''}${t.prompt}\n`).join('\n');
  descargar('prompts.txt', txt, 'text/plain;charset=utf-8');
});
cargar('crear');
