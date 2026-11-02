import * as THREE from "three";
import * as OBC from "@thatopen/components";
import JSZip from "jszip";
import { FORMATS, UNSUPPORTED, Z_UP, extOf, loadThreeFile, groupsFor } from "./loaders.js";
import { ROOT } from "./base.js";

const $ = (id) => document.getElementById(id);
const lightTheme = () => true; /* tema Studio: siempre claro */

// ───────────────────────── Mundo de That Open ─────────────────────────
const components = new OBC.Components();
const world = components.get(OBC.Worlds).create();
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.renderer = new OBC.SimpleRenderer(components, $("viewer"));
world.camera = new OBC.OrthoPerspectiveCamera(components);
components.init();

const scene = world.scene.three;
const setBg = () => (scene.background = new THREE.Color(lightTheme() ? 0xf1f7f8 : 0x0e1816));
setBg();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", setBg);

const grid = components.get(OBC.Grids).create(world);

// Desplaza el centro de la vista a la derecha para que el panel lateral no tape el modelo
function offsetView() {
  const el = $("viewer"), w = el.clientWidth, h = el.clientHeight;
  const shift = w > 700 ? -($("side").offsetWidth + 16) / 2 : 0;
  for (const cam of [world.camera.threePersp, world.camera.threeOrtho]) {
    if (!cam) continue;
    if (shift) cam.setViewOffset(w, h, shift, 0, w, h);
    else cam.clearViewOffset();
  }
}
offsetView();
new ResizeObserver(offsetView).observe($("viewer"));
world.camera.controls.setLookAt(30, 22, 30, 0, 0, 0);

// Fragments: el motor de That Open que convierte y dibuja IFC/FRAG
const fragments = components.get(OBC.FragmentsManager);
fragments.init(ROOT + "fragments-worker.mjs");
world.camera.controls.addEventListener("rest", () => fragments.core.update(true));
fragments.list.onItemSet.add(({ value: model }) => {
  model.useCamera(world.camera.three);
  scene.add(model.object);
  fragments.core.update(true);
});
fragments.core.models.materials.list.onItemSet.add(({ value: m }) => {
  if (!("isLodMaterial" in m && m.isLodMaterial)) {
    m.polygonOffset = true;
    m.polygonOffsetUnits = 1;
    m.polygonOffsetFactor = Math.random();
  }
});

const ifcLoader = components.get(OBC.IfcLoader);
const ifcReady = ifcLoader.setup({
  autoSetWasm: false,
  wasm: { path: ROOT + "wasm/", absolute: true },
});

// ───────────────────────── Estado ─────────────────────────
/** @type {{id:string,name:string,ext:string,kind:'frag'|'three',root:THREE.Object3D,model?:any,groups?:any[],note?:string,revoke?:Function,fromIfc?:boolean}[]} */
const models = [];
let selected = null;
let seq = 0;

// ───────────────────────── Interfaz ─────────────────────────
$("fmts").textContent = "Admite: " + Object.keys(FORMATS).map((e) => "." + e).join(" ");
$("file").accept = [...Object.keys(FORMATS), "mtl", "png", "jpg", "jpeg", "bin", "tga", "bmp", ...Object.keys(UNSUPPORTED)].map((e) => "." + e).join(",");

function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.style.opacity = 1;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.style.opacity = 0), ms);
}
function busy(text) {
  $("busy").hidden = !text;
  if (text) $("busyt").textContent = text;
}

// ───────────────────────── Carga de archivos ─────────────────────────
async function expandZips(files) {
  const out = [];
  for (const f of files) {
    if (extOf(f.name) !== "zip") { out.push(f); continue; }
    const zip = await JSZip.loadAsync(f);
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name.startsWith("__MACOSX")) continue;
      const blob = await entry.async("blob");
      out.push(new File([blob], entry.name.split("/").pop()));
    }
  }
  return out;
}

async function openFiles(list) {
  let files;
  try {
    busy("Leyendo archivos…");
    files = await expandZips([...list]);
  } catch (e) {
    busy(null);
    return toast("No se pudo abrir el ZIP: " + e.message, 5000);
  }
  const mains = files.filter((f) => FORMATS[extOf(f.name)] || UNSUPPORTED[extOf(f.name)]);
  if (!mains.length) {
    busy(null);
    return toast("No hay ningún archivo 3D que se pueda abrir entre los seleccionados", 4000);
  }
  for (const f of mains) {
    const ext = extOf(f.name);
    if (UNSUPPORTED[ext]) { toast(UNSUPPORTED[ext], 9000); continue; }
    busy(`Abriendo ${f.name}…`);
    try {
      if (ext === "ifc" || ext === "frag") await openFragments(f, ext);
      else await openThree(f, ext, files);
    } catch (e) {
      console.error(e);
      toast(`Error con ${f.name}: ${e.message ?? e}`, 6000);
    }
  }
  busy(null);
  renderList();
  fit();
}

async function openFragments(file, ext) {
  const id = `${file.name}#${++seq}`;
  const data = new Uint8Array(await file.arrayBuffer());
  let model;
  if (ext === "ifc") {
    await ifcReady;
    model = await ifcLoader.load(data, true, id, {
      processData: { progressCallback: (p) => busy(`Convirtiendo IFC a fragments… ${Math.round(p * 100)}%`) },
    });
  } else {
    model = await fragments.core.load(data, { modelId: id, camera: world.camera.three });
  }
  await fragments.core.update(true);
  models.push({ id, name: file.name, ext, kind: "frag", root: model.object, model, fromIfc: ext === "ifc" });
}

async function openThree(file, ext, siblings) {
  const r = await loadThreeFile(file, siblings, { lightTheme: lightTheme() });
  const root = new THREE.Group();
  root.name = file.name;
  root.add(r.object);
  const zUp = Z_UP.has(ext);
  if (zUp) root.rotation.x = -Math.PI / 2;

  // Unidades: lo que diga el usuario, o lo que diga el archivo, o lo deducimos por el tamaño
  const choice = $("units").value;
  let scale = 1, note = "";
  if (choice !== "auto") { scale = +choice; note = $("units").selectedOptions[0].text; }
  else if (r.unitScale) { scale = r.unitScale; note = unitName(scale) + " (del archivo)"; }
  else {
    const size = new THREE.Box3().setFromObject(r.object).getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) > 1000) { scale = 0.001; note = "mm (supuesto)"; }
  }
  root.scale.setScalar(scale);
  scene.add(root);

  const skipped = Object.entries(r.skipped ?? {}).map(([k, v]) => `${v} ${k}`).join(", ");
  if (skipped) toast(`DXF cargado. No se dibujan: ${skipped}`, 5000);

  const id = `${file.name}#${++seq}`;
  models.push({ id, name: file.name, ext, kind: "three", root, zUp, note, revoke: r.revoke, groups: groupsFor(r.object, r.layers) });
  if (edgesOn) addEdges(root);
  if (wireOn) setWire(root, true);
}

const unitName = (s) => ({ 0.001: "mm", 0.01: "cm", 1: "m", 0.0254: "pulgadas", 0.3048: "pies", 0.1: "dm" })[s] ?? `×${s}`;

// ───────────────────────── Lista de modelos ─────────────────────────
function renderList() {
  const box = $("models");
  box.innerHTML = "";
  $("count").textContent = models.length ? `(${models.length})` : "";
  if (!models.length) {
    box.innerHTML = '<p class="mut tiny empty">Todavía no hay nada cargado.</p>';
    selectModel(null);
    return;
  }
  for (const m of models) {
    const row = document.createElement("div");
    row.className = "model" + (m === selected ? " sel" : "");
    const visible = m.root.visible;
    row.innerHTML = `
      <span class="tag">${m.ext.toUpperCase()}</span>
      <span class="nm" title="${m.name}">${m.name}</span>
      <span class="acts">
        <button data-a="eye" title="Mostrar/ocultar">${visible ? "👁" : "◌"}</button>
        <button data-a="focus" title="Encuadrar">⌖</button>
        ${m.kind === "three" ? '<button data-a="axis" title="Cambiar eje vertical (Z↑ / Y↑)">↻</button>' : ""}
        ${m.fromIfc ? '<button data-a="frag" title="Descargar como .frag (carga mucho más rápida)">⬇</button>' : ""}
        <button data-a="del" title="Quitar">✕</button>
      </span>
      <span class="meta">${meta(m)}</span>`;
    row.onclick = (ev) => {
      const a = ev.target.closest("button")?.dataset.a;
      if (a === "eye") toggleModel(m);
      else if (a === "focus") fit(m);
      else if (a === "axis") flipAxis(m);
      else if (a === "frag") exportFrag(m);
      else if (a === "del") removeModel(m);
      else selectModel(m === selected ? null : m);
    };
    box.appendChild(row);
  }
}

function meta(m) {
  const s = boxOf(m).getSize(new THREE.Vector3());
  const dims = s.x ? `${fmt(s.x)} × ${fmt(s.z)} × ${fmt(s.y)} m` : "";
  return [dims, m.note, m.kind === "three" ? (m.zUp ? "Z arriba" : "Y arriba") : "That Open Fragments"].filter(Boolean).join(" · ");
}
const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3));

function toggleModel(m) {
  m.root.visible = !m.root.visible;
  if (m.kind === "frag") fragments.core.update(true);
  renderList();
}
function flipAxis(m) {
  m.zUp = !m.zUp;
  m.root.rotation.x = m.zUp ? -Math.PI / 2 : 0;
  renderList();
  fit(m);
}
async function exportFrag(m) {
  busy("Generando .frag…");
  const buf = await m.model.getBuffer(false);
  busy(null);
  download(new Blob([buf]), m.name.replace(/\.ifc$/i, "") + ".frag");
}
async function removeModel(m) {
  if (m === selected) selectModel(null);
  clearPick();
  if (m.kind === "frag") await fragments.core.disposeModel(m.model.modelId);
  else {
    scene.remove(m.root);
    m.root.traverse((o) => {
      o.geometry?.dispose();
      for (const mat of [].concat(o.material ?? [])) mat.dispose?.();
    });
    m.revoke?.();
  }
  models.splice(models.indexOf(m), 1);
  renderList();
}

// ───────────────────────── Capas / categorías del modelo elegido ─────────────────────────
async function selectModel(m) {
  selected = m;
  document.querySelectorAll(".model").forEach((r, i) => r.classList.toggle("sel", models[i] === m));
  const wrap = $("layersw"), list = $("layers");
  list.innerHTML = "";
  if (!m) return (wrap.hidden = true);

  let items = m.groups;
  if (m.kind === "frag") {
    $("layersh").textContent = "Categorías IFC";
    if (!m.groups) {
      const cats = (await m.model.getCategories()).sort();
      const map = await m.model.getItemsOfCategories(cats.map((c) => new RegExp(`^${c}$`)));
      m.groups = cats.map((c) => ({ name: prettyIfc(c), ids: map[c] ?? [], count: (map[c] ?? []).length, on: true })).filter((g) => g.count);
    }
    items = m.groups;
  } else {
    $("layersh").textContent = m.ext === "dxf" ? "Capas DXF" : m.ext === "3dm" ? "Capas" : "Objetos";
  }
  if (!items?.length) return (wrap.hidden = true);
  wrap.hidden = false;

  for (const g of items) {
    const lab = document.createElement("label");
    const on = m.kind === "frag" ? g.on : g.object.visible;
    const color = g.color !== undefined ? `#${g.color.toString(16).padStart(6, "0")}` : "transparent";
    lab.innerHTML = `<input type="checkbox" ${on ? "checked" : ""}/><span class="sw" style="background:${color}"></span><span>${g.name}</span><span class="n">${g.count.toLocaleString("es-ES")}</span>`;
    lab.querySelector("input").onchange = (e) => setGroup(m, g, e.target.checked);
    list.appendChild(lab);
  }
}
const prettyIfc = (c) => c.replace(/^IFC/, "").toLowerCase().replace(/^\w/, (x) => x.toUpperCase());

async function setGroup(m, g, on) {
  if (m.kind === "frag") {
    g.on = on;
    await m.model.setVisible(g.ids, on);
    await fragments.core.update(true);
  } else g.object.visible = on;
}
async function setAllGroups(on) {
  if (!selected?.groups) return;
  for (const g of selected.groups) await setGroup(selected, g, on);
  selectModel(selected);
}
$("lall").onclick = () => setAllGroups(true);
$("lnone").onclick = () => setAllGroups(false);

// ───────────────────────── Cámara ─────────────────────────
function boxOf(m) {
  if (m.kind === "frag") return m.model.box.clone();
  return new THREE.Box3().setFromObject(m.root, true);
}
function sceneBox() {
  const b = new THREE.Box3();
  for (const m of models) if (m.root.visible) b.union(boxOf(m));
  return b;
}
async function fit(m) {
  const box = m ? boxOf(m) : sceneBox();
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  // La cámara de That Open trae un límite de 300 m: lo adaptamos al tamaño del modelo
  world.camera.controls.maxDistance = Math.max(300, sphere.radius * 20);
  world.camera.controls.minDistance = Math.min(1, sphere.radius / 50);
  world.camera.three.far = Math.max(world.camera.three.far, sphere.radius * 50);
  world.camera.three.updateProjectionMatrix();
  await world.camera.controls.fitToSphere(sphere, true);
  updateCutRange();
}
async function view(kind) {
  const c = world.camera.controls;
  if (kind === "top") await c.rotateTo(0, 0.0001, true);
  if (kind === "front") await c.rotateTo(0, Math.PI / 2, true);
  if (kind === "iso") await c.rotateTo(Math.PI / 4, Math.PI / 3, true);
  fit();
}
document.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => (b.dataset.view === "fit" ? fit() : view(b.dataset.view))));

$("proj").onclick = async () => {
  const ortho = world.camera.projection.current !== "Orthographic";
  await world.camera.projection.set(ortho ? "Orthographic" : "Perspective");
  $("proj").classList.toggle("on", ortho);
  for (const m of models) if (m.kind === "frag") m.model.useCamera(world.camera.three);
  fragments.core.update(true);
};

// ───────────────────────── Herramientas ─────────────────────────
let edgesOn = false, wireOn = false;

function addEdges(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.edges) return;
    const tris = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    if (tris > 400000) return; // demasiado pesado
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), edgeMat);
    e.userData.isEdge = true;
    e.raycast = () => {};
    o.userData.edges = e;
    o.add(e);
  });
}
const edgeMat = new THREE.LineBasicMaterial({ color: 0x0a1522, transparent: true, opacity: 0.55 });
$("edges").onclick = () => {
  edgesOn = !edgesOn;
  $("edges").classList.toggle("on", edgesOn);
  for (const m of models) {
    if (m.kind !== "three") continue;
    if (edgesOn) addEdges(m.root);
    m.root.traverse((o) => o.userData.isEdge && (o.visible = edgesOn));
  }
  if (models.some((m) => m.kind === "frag") && edgesOn) toast("Las aristas solo se aplican a mallas (no a IFC/FRAG)");
};

function setWire(root, on) {
  root.traverse((o) => o.isMesh && [].concat(o.material).forEach((mt) => (mt.wireframe = on)));
}
$("wire").onclick = () => {
  wireOn = !wireOn;
  $("wire").classList.toggle("on", wireOn);
  models.filter((m) => m.kind === "three").forEach((m) => setWire(m.root, wireOn));
};

$("gridb").onclick = () => {
  grid.visible = !grid.visible;
  $("gridb").classList.toggle("on", grid.visible);
};

$("shot").onclick = () => {
  const r = world.renderer.three;
  r.render(scene, world.camera.three);
  r.domElement.toBlob((b) => b && download(b, "captura.png"));
};

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Sección horizontal
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
let cutRange = [0, 10];
function updateCutRange() {
  const b = sceneBox();
  if (b.isEmpty()) return;
  cutRange = [b.min.y, b.max.y];
  applyCut();
}
function applyCut() {
  const on = $("cut").checked;
  $("cutv").disabled = !on;
  world.renderer.setPlane(false, cutPlane);
  if (!on) { $("cutl").textContent = ""; return; }
  const h = cutRange[0] + ((cutRange[1] - cutRange[0]) * +$("cutv").value) / 100;
  cutPlane.constant = h;
  world.renderer.setPlane(true, cutPlane);
  $("cutl").textContent = `Corte a ${h.toFixed(2)} m`;
}
$("cut").onchange = applyCut;
$("cutv").oninput = applyCut;

// ───────────────────────── Selección, propiedades y medición ─────────────────────────
const raycaster = new THREE.Raycaster();
const hiMat = { color: new THREE.Color(1, 0.72, 0.1), opacity: 1, transparent: false, renderedFaces: 1 };
let pickedFrag = null, pickedBox = null;
let measuring = false, mPts = [], mLine = null;

async function pick(ev) {
  const cam = world.camera.three;
  const dom = world.renderer.three.domElement;
  const rect = dom.getBoundingClientRect();
  const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);

  // Mallas de Three.js
  raycaster.setFromCamera(ndc, cam);
  const size = sceneBox().getSize(new THREE.Vector3()).length() || 10;
  raycaster.params.Line.threshold = size * 0.002;
  raycaster.params.Points.threshold = size * 0.003;
  const roots = models.filter((m) => m.kind === "three" && m.root.visible).map((m) => m.root);
  let best = raycaster.intersectObjects(roots, true).find((h) => h.object.visible && visibleChain(h.object));
  let hit = best ? { point: best.point, distance: best.distance, three: best.object } : null;

  // Fragments (IFC/FRAG)
  for (const m of models) {
    if (m.kind !== "frag" || !m.root.visible) continue;
    const r = await m.model.raycast({ camera: cam, mouse: new THREE.Vector2(ev.clientX, ev.clientY), dom });
    if (!r) continue;
    const d = r.point.distanceTo(cam.position);
    if (!hit || d < hit.distance) hit = { point: r.point, distance: d, frag: r, entry: m };
  }
  return hit;
}
const visibleChain = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

async function clearPick() {
  if (pickedFrag) {
    await pickedFrag.model.resetHighlight(pickedFrag.ids).catch(() => {});
    pickedFrag = null;
    fragments.core.update(true);
  }
  if (pickedBox) { scene.remove(pickedBox); pickedBox = null; }
  $("propsw").hidden = true;
}

async function onClick(ev) {
  const hit = await pick(ev);
  if (measuring) return measure(hit);
  await clearPick();
  if (!hit) return;
  const p = hit.point;
  const coord = `<div class="k">Punto</div><table><tr><td>X</td><td>${p.x.toFixed(3)} m</td></tr><tr><td>Y</td><td>${(-p.z).toFixed(3)} m</td></tr><tr><td>Z (altura)</td><td>${p.y.toFixed(3)} m</td></tr></table>`;

  if (hit.frag) {
    const { fragments: model, localId } = hit.frag;
    await model.highlight([localId], hiMat);
    pickedFrag = { model, ids: [localId] };
    fragments.core.update(true);
    $("props").innerHTML = "<p class='mut'>Leyendo propiedades…</p>";
    $("propsw").hidden = false;
    const [d] = await model.getItemsData([localId], {
      attributesDefault: true,
      relations: { IsDefinedBy: { attributes: true, relations: true } },
    });
    $("props").innerHTML = ifcHtml(d, hit.entry) + coord;
  } else {
    const o = hit.three;
    const entry = models.find((m) => { let x = o; for (; x; x = x.parent) if (x === m.root) return true; });
    pickedBox = new THREE.BoxHelper(o, 0xff2800);
    scene.add(pickedBox);
    const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const g = o.geometry;
    const tris = o.isMesh ? Math.round((g.index?.count ?? g.attributes.position.count) / 3) : null;
    const mat = [].concat(o.material)[0];
    const rows = [
      ["Archivo", entry?.name],
      ["Tipo", o.isMesh ? "Malla" : o.isLine ? "Líneas" : o.isPoints ? "Puntos" : o.type],
      ["Capa", o.userData.layer],
      ["Material", mat?.name],
      ["Triángulos", tris?.toLocaleString("es-ES")],
      ["Tamaño", `${fmt(s.x)} × ${fmt(s.z)} × ${fmt(s.y)} m`],
    ].filter((r) => r[1]);
    $("props").innerHTML = `<h3>${o.name || o.parent?.name || "Objeto"}</h3><table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join("")}</table>${coord}`;
    $("propsw").hidden = false;
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const val = (d, k) => (d?.[k] && !Array.isArray(d[k]) && d[k].value != null ? d[k].value : null);

function ifcHtml(d, entry) {
  if (!d) return "<p class='mut'>Sin datos</p>";
  const name = val(d, "Name") ?? "(sin nombre)";
  const cat = val(d, "_category") ?? d.type?.value ?? "";
  const attrs = Object.entries(d)
    .filter(([k, v]) => !Array.isArray(v) && v && typeof v === "object" && "value" in v && v.value !== null && !k.startsWith("_") && k !== "Name")
    .map(([k, v]) => [k, v.value]);
  if (val(d, "_guid")) attrs.unshift(["GlobalId", val(d, "_guid")]);
  let html = `<h3>${esc(name)}</h3><div class="mut tiny">${esc(prettyIfc(String(cat)))} · ${esc(entry.name)}</div>`;
  if (attrs.length) html += `<div class="k">Atributos</div><table>${attrs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
  for (const pset of d.IsDefinedBy ?? []) {
    const props = pset.HasProperties ?? pset.Quantities ?? [];
    const pname = val(pset, "Name");
    if (!pname || !props.length) continue;
    const rows = props.map((p) => {
      const v = p.NominalValue?.value ?? p.LengthValue?.value ?? p.AreaValue?.value ?? p.VolumeValue?.value ?? p.CountValue?.value ?? p.WeightValue?.value ?? "";
      return `<tr><td>${esc(val(p, "Name") ?? "")}</td><td>${esc(typeof v === "number" ? +v.toFixed(4) : v)}</td></tr>`;
    });
    html += `<div class="k">${esc(pname)}</div><table>${rows.join("")}</table>`;
  }
  return html;
}

$("close").onclick = clearPick;

// Medición de distancias
$("measure").onclick = () => {
  measuring = !measuring;
  mPts = [];
  $("measure").classList.toggle("on", measuring);
  $("mres").textContent = measuring ? "Haz clic en dos puntos del modelo" : "";
  if (!measuring && mLine) { scene.remove(mLine); mLine = null; }
};
function measure(hit) {
  if (!hit) return;
  mPts.push(hit.point.clone());
  if (mPts.length === 1) {
    if (mLine) scene.remove(mLine);
    $("mres").textContent = "Ahora el segundo punto…";
    return;
  }
  const [a, b] = mPts;
  mLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([a, b]),
    new THREE.LineBasicMaterial({ color: 0xb31b00, depthTest: false })
  );
  mLine.renderOrder = 999;
  scene.add(mLine);
  const plan = Math.hypot(b.x - a.x, b.z - a.z);
  $("mres").textContent = `Distancia ${a.distanceTo(b).toFixed(3)} m · en planta ${plan.toFixed(3)} m · desnivel ${Math.abs(b.y - a.y).toFixed(3)} m`;
  mPts = [];
}

// Clic sin arrastrar = seleccionar
const canvas = world.renderer.three.domElement;
let down = null;
canvas.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener("pointerup", (e) => {
  if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5 && e.button === 0) onClick(e);
  down = null;
});

addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.key === "f" || e.key === "F") fit();
  if (e.key === "Escape") {
    clearPick();
    if (measuring) $("measure").click();
  }
});

// ───────────────────────── Abrir archivos ─────────────────────────
$("file").onchange = (e) => { openFiles(e.target.files); e.target.value = ""; };
let dragDepth = 0;
addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; $("dropfx").hidden = false; });
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("dropfx").hidden = true; } });
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  $("dropfx").hidden = true;
  if (e.dataTransfer.files.length) openFiles(e.dataTransfer.files);
});

// Para depurar desde la consola
window.visor = { components, world, fragments, models, openFiles };
