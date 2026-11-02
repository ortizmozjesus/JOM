// Convierte un DXF (texto) en objetos de Three.js agrupados por capa.
// Soporta LINE, LWPOLYLINE/POLYLINE (con arcos), CIRCLE, ARC, ELLIPSE, SPLINE,
// 3DFACE, SOLID, POINT, mallas polyface y bloques (INSERT, también cotas).
import * as THREE from "three";
import DxfParser from "dxf-parser";
import { NURBSCurve } from "three/examples/jsm/curves/NURBSCurve.js";

const V3 = THREE.Vector3;
const SEG = Math.PI / 32; // resolución angular de arcos

// Factor a metros según la variable $INSUNITS de la cabecera
const INSUNITS = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1, 14: 0.1 };

function normalOf(e) {
  if (e.extrusionDirection) return e.extrusionDirection;
  if (e.extrusionDirectionZ !== undefined)
    return { x: e.extrusionDirectionX ?? 0, y: e.extrusionDirectionY ?? 0, z: e.extrusionDirectionZ };
  return null;
}

// Sistema de coordenadas de objeto (OCS) de AutoCAD: "arbitrary axis algorithm"
function ocsMatrix(n) {
  if (!n || (Math.abs(n.x) < 1e-9 && Math.abs(n.y) < 1e-9 && n.z > 0)) return null;
  const N = new V3(n.x, n.y, n.z).normalize();
  const ax = Math.abs(N.x) < 1 / 64 && Math.abs(N.y) < 1 / 64 ? new V3(0, 1, 0).cross(N) : new V3(0, 0, 1).cross(N);
  ax.normalize();
  const ay = N.clone().cross(ax).normalize();
  return new THREE.Matrix4().makeBasis(ax, ay, N);
}

// Puntos intermedios del arco definido por un "bulge" entre p1 y p2
function bulgePoints(p1, p2, b, z, out) {
  const th = 4 * Math.atan(b);
  const dx = p2.x - p1.x, dy = p2.y - p1.y, c = Math.hypot(dx, dy);
  if (!c) return;
  const r = c / (2 * Math.sin(th / 2));
  const h = r * Math.cos(th / 2);
  const cx = (p1.x + p2.x) / 2 - (dy / c) * h, cy = (p1.y + p2.y) / 2 + (dx / c) * h;
  const a1 = Math.atan2(p1.y - cy, p1.x - cx), R = Math.abs(r);
  const n = Math.max(2, Math.ceil(Math.abs(th) / SEG));
  for (let i = 1; i < n; i++) {
    const a = a1 + (th * i) / n;
    out.push(new V3(cx + R * Math.cos(a), cy + R * Math.sin(a), z));
  }
}

function arcPoints(c, r, a0, a1) {
  if (a1 <= a0) a1 += Math.PI * 2;
  const n = Math.max(4, Math.ceil((a1 - a0) / SEG));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new V3(c.x + r * Math.cos(a), c.y + r * Math.sin(a), c.z ?? 0));
  }
  return pts;
}

export function parseDXF(text, { lightTheme = true } = {}) {
  const dxf = new DxfParser().parseSync(text);
  if (!dxf) throw new Error("DXF vacío o no válido");

  const layerColor = {};
  for (const [n, l] of Object.entries(dxf.tables?.layer?.layers ?? {})) layerColor[n] = l.color ?? 0xffffff;

  // Un "cubo" por capa con líneas, triángulos y puntos (cada vértice con su color)
  const layers = new Map();
  const bucket = (name) => {
    if (!layers.has(name)) layers.set(name, { lp: [], lc: [], tp: [], tc: [], pp: [], pc: [], count: 0 });
    return layers.get(name);
  };
  const skipped = {};
  const tmp = new V3();
  const col = new THREE.Color();

  const fixColor = (c) => {
    // El blanco/negro de AutoCAD (color 7) se adapta al fondo
    if (c === 0xffffff && lightTheme) return 0x2b2b2b;
    if (c === 0x000000 && !lightTheme) return 0xdddddd;
    return c;
  };

  function resolveColor(e, layer, inherited) {
    const ci = e.colorIndex;
    if (ci === 0) return inherited ?? layerColor[layer] ?? 0xffffff; // BYBLOCK
    if (ci > 0 && ci < 256 && e.color !== undefined) return e.color;
    if (ci === undefined && e.color !== undefined) return e.color; // color verdadero (420)
    return layerColor[layer] ?? 0xffffff; // BYLAYER
  }

  const pushPt = (arr, p, m) => {
    tmp.set(p.x, p.y, p.z ?? 0).applyMatrix4(m);
    arr.push(tmp.x, tmp.y, tmp.z);
  };
  const pushCol = (arr, c, n) => {
    col.setHex(fixColor(c));
    for (let i = 0; i < n; i++) arr.push(col.r, col.g, col.b);
  };
  function polyline(b, pts, closed, m, c) {
    const n = pts.length;
    for (let i = 0; i < n - 1 + (closed && n > 2 ? 1 : 0); i++) {
      pushPt(b.lp, pts[i], m); pushPt(b.lp, pts[(i + 1) % n], m); pushCol(b.lc, c, 2);
    }
  }
  function tri(b, a, bb, cc, m, c) {
    pushPt(b.tp, a, m); pushPt(b.tp, bb, m); pushPt(b.tp, cc, m); pushCol(b.tc, c, 3);
  }

  function walk(entities, m, inhLayer, inhColor, depth) {
    for (const e of entities ?? []) {
      if (e.visible === false || e.inPaperSpace) continue;
      let layer = e.layer ?? "0";
      if (layer === "0" && inhLayer) layer = inhLayer;
      const c = resolveColor(e, layer, inhColor);
      const ocs = ocsMatrix(normalOf(e));
      const M = ocs ? m.clone().multiply(ocs) : m;
      const b = bucket(layer);
      b.count++;

      switch (e.type) {
        case "LINE":
          polyline(b, e.vertices, false, m, c);
          break;
        case "LWPOLYLINE":
        case "POLYLINE": {
          const vs = e.vertices ?? [];
          if (e.isPolyfaceMesh) {
            const pos = vs.filter((v) => v.threeDPolylineMesh || v.faceA === undefined);
            for (const f of vs.filter((v) => v.faceA !== undefined && !v.threeDPolylineMesh)) {
              const ids = [f.faceA, f.faceB, f.faceC, f.faceD].filter((i) => i).map((i) => pos[Math.abs(i) - 1]);
              if (ids.length >= 3 && ids.every(Boolean)) {
                tri(b, ids[0], ids[1], ids[2], m, c);
                if (ids[3]) tri(b, ids[0], ids[2], ids[3], m, c);
              }
            }
            break;
          }
          const z = e.elevation ?? 0;
          const closed = !!e.shape;
          const pts = [];
          const plane = e.type === "LWPOLYLINE" || !e.is3dPolyline;
          for (let i = 0; i < vs.length; i++) {
            const v = vs[i];
            const p = new V3(v.x, v.y, plane && e.type === "LWPOLYLINE" ? z : v.z ?? 0);
            pts.push(p);
            const next = vs[i + 1] ?? (closed ? vs[0] : null);
            if (v.bulge && next) bulgePoints(v, next, v.bulge, p.z, pts);
          }
          if (closed && pts.length > 2) pts.push(pts[0]);
          polyline(b, pts, false, plane ? M : m, c);
          break;
        }
        case "CIRCLE":
          polyline(b, arcPoints(e.center, e.radius, 0, Math.PI * 2), false, M, c);
          break;
        case "ARC":
          polyline(b, arcPoints(e.center, e.radius, e.startAngle, e.endAngle), false, M, c);
          break;
        case "ELLIPSE": {
          const C = new V3(e.center.x, e.center.y, e.center.z ?? 0);
          const maj = new V3(e.majorAxisEndPoint.x, e.majorAxisEndPoint.y, e.majorAxisEndPoint.z ?? 0);
          const n = normalOf(e) ?? { x: 0, y: 0, z: 1 };
          const min = new V3(n.x, n.y, n.z).cross(maj).multiplyScalar(e.axisRatio);
          let a0 = e.startAngle ?? 0, a1 = e.endAngle ?? Math.PI * 2;
          if (a1 <= a0) a1 += Math.PI * 2;
          const k = Math.max(8, Math.ceil((a1 - a0) / SEG));
          const pts = [];
          for (let i = 0; i <= k; i++) {
            const t = a0 + ((a1 - a0) * i) / k;
            pts.push(C.clone().addScaledVector(maj, Math.cos(t)).addScaledVector(min, Math.sin(t)));
          }
          polyline(b, pts, false, m, c);
          break;
        }
        case "SPLINE": {
          let pts = [];
          const cp = e.controlPoints, kn = e.knotValues, d = e.degreeOfSplineCurve ?? 3;
          if (cp?.length > d && kn?.length === cp.length + d + 1) {
            const curve = new NURBSCurve(d, kn, cp.map((p) => new THREE.Vector4(p.x, p.y, p.z ?? 0, 1)));
            pts = curve.getPoints(Math.max(16, cp.length * 8));
          } else if (e.fitPoints?.length > 1) {
            pts = new THREE.CatmullRomCurve3(e.fitPoints.map((p) => new V3(p.x, p.y, p.z ?? 0))).getPoints(e.fitPoints.length * 8);
          } else if (cp?.length > 1) {
            pts = cp;
          }
          polyline(b, pts, false, m, c);
          break;
        }
        case "3DFACE": {
          const v = e.vertices ?? [];
          if (v.length >= 3) {
            tri(b, v[0], v[1], v[2], m, c);
            if (v[3] && (v[3].x !== v[2].x || v[3].y !== v[2].y || v[3].z !== v[2].z)) tri(b, v[0], v[2], v[3], m, c);
          }
          break;
        }
        case "SOLID": {
          const v = e.points ?? e.vertices ?? [];
          if (v.length >= 3) {
            tri(b, v[0], v[1], v[2], M, c);
            if (v[3]) tri(b, v[1], v[3], v[2], M, c);
          }
          break;
        }
        case "POINT":
          if (e.position) { pushPt(b.pp, e.position, m); pushCol(b.pc, c, 1); }
          break;
        case "INSERT":
        case "DIMENSION": {
          const blk = dxf.blocks?.[e.type === "INSERT" ? e.name : e.block];
          if (!blk || depth > 12) { b.count--; break; }
          const base = blk.position ?? { x: 0, y: 0, z: 0 };
          if (e.type === "DIMENSION") {
            walk(blk.entities, m, layer, c, depth + 1);
            break;
          }
          const p = e.position ?? { x: 0, y: 0, z: 0 };
          const cols = Math.max(1, e.columnCount ?? 1), rows = Math.max(1, e.rowCount ?? 1);
          for (let r = 0; r < rows; r++)
            for (let k = 0; k < cols; k++) {
              const T = M.clone()
                .multiply(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z ?? 0))
                .multiply(new THREE.Matrix4().makeRotationZ(((e.rotation ?? 0) * Math.PI) / 180))
                .multiply(new THREE.Matrix4().makeTranslation(k * (e.columnSpacing ?? 0), r * (e.rowSpacing ?? 0), 0))
                .multiply(new THREE.Matrix4().makeScale(e.xScale ?? 1, e.yScale ?? 1, e.zScale ?? 1))
                .multiply(new THREE.Matrix4().makeTranslation(-base.x, -base.y, -(base.z ?? 0)));
              walk(blk.entities, T, layer, c, depth + 1);
            }
          break;
        }
        default:
          b.count--;
          skipped[e.type] = (skipped[e.type] ?? 0) + 1;
      }
    }
  }

  walk(dxf.entities, new THREE.Matrix4(), null, null, 0);

  // Recentrar: los DXF suelen venir en coordenadas UTM enormes y la GPU pierde precisión
  const box = new THREE.Box3();
  for (const b of layers.values())
    for (const arr of [b.lp, b.tp, b.pp])
      for (let i = 0; i < arr.length; i += 3) box.expandByPoint(tmp.set(arr[i], arr[i + 1], arr[i + 2]));
  if (box.isEmpty()) throw new Error("El DXF no tiene geometría que se pueda dibujar (¿solo textos o sombreados?)");
  const center = box.getCenter(new V3());

  const root = new THREE.Group();
  root.position.copy(center);
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true });
  const meshMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 });
  const ptsMat = new THREE.PointsMaterial({ vertexColors: true, size: 3, sizeAttenuation: false });
  const geo = (p, c) => {
    for (let i = 0; i < p.length; i += 3) { p[i] -= center.x; p[i + 1] -= center.y; p[i + 2] -= center.z; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    return g;
  };

  const layerInfo = [];
  for (const [name, b] of [...layers].sort((a, z) => a[0].localeCompare(z[0]))) {
    if (!b.lp.length && !b.tp.length && !b.pp.length) continue;
    const g = new THREE.Group();
    g.name = name;
    g.userData.layer = name;
    if (b.lp.length) g.add(Object.assign(new THREE.LineSegments(geo(b.lp, b.lc), lineMat), { name }));
    if (b.tp.length) {
      const tg = geo(b.tp, b.tc);
      tg.computeVertexNormals();
      g.add(Object.assign(new THREE.Mesh(tg, meshMat), { name }));
    }
    if (b.pp.length) g.add(Object.assign(new THREE.Points(geo(b.pp, b.pc), ptsMat), { name }));
    g.traverse((o) => (o.userData.layer = name));
    root.add(g);
    layerInfo.push({ name, color: fixColor(layerColor[name] ?? 0xffffff), count: b.count, object: g });
  }

  return {
    object: root,
    unitScale: INSUNITS[dxf.header?.$INSUNITS],
    layers: layerInfo,
    skipped,
  };
}
