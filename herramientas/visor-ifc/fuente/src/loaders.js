// Lectores de Three.js para los formatos que no son IFC/FRAG.
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { KMZLoader } from "three/examples/jsm/loaders/KMZLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";
import { USDZLoader } from "three/examples/jsm/loaders/USDZLoader.js";
import { Rhino3dmLoader } from "three/examples/jsm/loaders/3DMLoader.js";
import { parseDXF } from "./dxf.js";
import { ROOT } from "./base.js";

// Formato → descripción (lo que se puede abrir)
export const FORMATS = {
  ifc: "IFC (BIM)", frag: "Fragments de That Open", dxf: "AutoCAD DXF", stl: "STL", obj: "OBJ (+ .mtl y texturas)",
  "3ds": "3D Studio", fbx: "FBX", glb: "glTF binario", gltf: "glTF", dae: "Collada", kmz: "SketchUp/Google Earth KMZ",
  ply: "PLY", "3mf": "3MF", "3dm": "Rhino", wrl: "VRML", usdz: "USDZ", zip: "ZIP con cualquiera de los anteriores",
};

// Formatos cerrados: explicamos cómo exportarlos a algo que sí se pueda abrir
export const UNSUPPORTED = {
  skp: "SketchUp (.skp) es un formato cerrado y no hay lector web. En SketchUp: Archivo → Exportar → Modelo 3D → .dae, .obj, .3ds, .fbx, .stl o .ifc. En SketchUp web (gratis) exporta a .stl.",
  dwg: "DWG es un formato cerrado. En AutoCAD usa GUARDARCOMO → DXF, o conviértelo gratis con ODA File Converter.",
  rvt: "Revit: Archivo → Exportar → IFC.",
  pln: "Archicad: Archivo → Guardar como → IFC.",
  blend: "Blender: Archivo → Exportar → glTF 2.0 (.glb).",
  max: "3ds Max: Archivo → Exportar → FBX o 3DS.",
  stp: "STEP: ábrelo en Rhino/FreeCAD y exporta a .3dm, .stl u .obj.",
  step: "STEP: ábrelo en Rhino/FreeCAD y exporta a .3dm, .stl u .obj.",
};

// Formatos que suelen venir con Z hacia arriba (Three.js usa Y arriba)
export const Z_UP = new Set(["dxf", "stl", "3ds", "ply", "3mf", "3dm"]);

export const extOf = (name) => (name.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();

// Los archivos auxiliares (.mtl, texturas, .bin) se resuelven entre los que el usuario ha seleccionado
function makeManager(files) {
  const urls = new Map();
  for (const f of files) urls.set(f.name.toLowerCase(), URL.createObjectURL(f));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (/^(blob|data):/.test(url)) return url;
    const name = decodeURIComponent(url).split(/[\\/]/).pop().toLowerCase();
    return urls.get(name) ?? url;
  });
  return { manager, revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}

let rhinoLoader;

/**
 * Carga un archivo de malla/CAD con Three.js.
 * @returns {{object: THREE.Object3D, unitScale?: number, layers?: any[], skipped?: object, revoke: Function}}
 */
export async function loadThreeFile(file, siblings, { lightTheme }) {
  const ext = extOf(file.name);
  const { manager, revoke } = makeManager(siblings);
  const buf = () => file.arrayBuffer();
  const txt = () => file.text();
  let object, extra = {};

  switch (ext) {
    case "dxf": {
      const r = parseDXF(await txt(), { lightTheme });
      object = r.object;
      extra = { unitScale: r.unitScale, layers: r.layers, skipped: r.skipped };
      break;
    }
    case "stl": {
      const g = new STLLoader().parse(await buf());
      if (!g.attributes.normal) g.computeVertexNormals();
      const mat = g.hasColors
        ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })
        : new THREE.MeshStandardMaterial({ color: 0xb9c4c9, roughness: 0.55, metalness: 0.05 });
      object = new THREE.Mesh(g, mat);
      object.name = file.name;
      break;
    }
    case "obj": {
      const loader = new OBJLoader(manager);
      const mtlFile = siblings.find((f) => extOf(f.name) === "mtl");
      if (mtlFile) {
        const mtl = new MTLLoader(manager).parse(await mtlFile.text(), "");
        mtl.preload();
        loader.setMaterials(mtl);
      }
      object = loader.parse(await txt());
      break;
    }
    case "3ds":
      object = new TDSLoader(manager).parse(await buf(), "");
      break;
    case "fbx":
      object = new FBXLoader(manager).parse(await buf(), "");
      break;
    case "glb":
    case "gltf": {
      const data = ext === "glb" ? await buf() : await txt();
      object = await new Promise((ok, ko) => new GLTFLoader(manager).parse(data, "", (g) => ok(g.scene), ko));
      break;
    }
    case "dae":
      object = new ColladaLoader(manager).parse(await txt(), "").scene;
      break;
    case "kmz":
      object = new KMZLoader(manager).parse(await buf()).scene;
      break;
    case "ply": {
      const g = new PLYLoader().parse(await buf());
      const colors = !!g.attributes.color;
      if (g.index) { // con caras → malla; sin caras → nube de puntos
        if (!g.attributes.normal) g.computeVertexNormals();
        object = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colors ? 0xffffff : 0xb9c4c9, vertexColors: colors }));
      } else {
        object = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: colors, color: colors ? 0xffffff : 0x447788 }));
      }
      break;
    }
    case "3mf":
      object = new ThreeMFLoader(manager).parse(await buf());
      break;
    case "wrl":
      object = new VRMLLoader(manager).parse(await txt(), "");
      break;
    case "usdz":
      object = new USDZLoader(manager).parse(await buf());
      break;
    case "3dm": {
      if (!rhinoLoader) {
        rhinoLoader = new Rhino3dmLoader();
        rhinoLoader.setLibraryPath(ROOT + "rhino3dm/");
      }
      const data = await buf();
      object = await new Promise((ok, ko) => rhinoLoader.parse(data, ok, ko));
      // Las capas de Rhino vienen en userData; las convertimos en grupos para poder ocultarlas
      const layerNames = object.userData?.layers?.map((l) => l.name) ?? [];
      if (layerNames.length) {
        const groups = new Map();
        for (const child of [...object.children]) {
          const name = layerNames[child.userData?.attributes?.layerIndex] ?? "Sin capa";
          if (!groups.has(name)) groups.set(name, Object.assign(new THREE.Group(), { name }));
          groups.get(name).add(child);
        }
        groups.forEach((g) => object.add(g));
      }
      break;
    }
    default:
      revoke();
      throw new Error("Formato no soportado: ." + ext);
  }

  // Caras por las dos lados: los exportadores (sobre todo SketchUp) a veces dejan caras giradas
  object.traverse((o) => {
    if (o.isMesh) {
      for (const m of [].concat(o.material)) if (m) m.side = THREE.DoubleSide;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    }
  });

  return { object, revoke, ...extra };
}

// Capas/objetos que mostramos en el panel para poder ocultarlos
export function groupsFor(object, dxfLayers) {
  if (dxfLayers) return dxfLayers;
  let level = object;
  while (level.children.length === 1 && level.children[0].children.length) level = level.children[0];
  const kids = level.children.filter((c) => c.isMesh || c.isGroup || c.isObject3D);
  if (kids.length < 2 || kids.length > 400) return null;
  return kids.map((c, i) => {
    let tris = 0;
    c.traverse((o) => { if (o.isMesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
    const mat = c.isMesh ? [].concat(c.material)[0] : null;
    return { name: c.name || `Objeto ${i + 1}`, color: mat?.color?.getHex(), count: Math.round(tris), object: c, unit: "tri" };
  });
}
