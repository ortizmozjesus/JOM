// Copia a /public los archivos que las librerías cargan en tiempo de ejecución,
// para que la app funcione sin internet.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/wasm", { recursive: true });
mkdirSync("public/rhino3dm", { recursive: true });

cpSync("node_modules/web-ifc/web-ifc.wasm", "public/wasm/web-ifc.wasm");
cpSync("node_modules/web-ifc/web-ifc-mt.wasm", "public/wasm/web-ifc-mt.wasm");
cpSync("node_modules/@thatopen/fragments/dist/Worker/worker.mjs", "public/fragments-worker.mjs");
cpSync("node_modules/rhino3dm/rhino3dm.js", "public/rhino3dm/rhino3dm.js");
cpSync("node_modules/rhino3dm/rhino3dm.wasm", "public/rhino3dm/rhino3dm.wasm");

console.log("Assets copiados a /public");
