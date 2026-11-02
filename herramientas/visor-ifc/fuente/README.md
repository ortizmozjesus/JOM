# Visor 3D multiformato (That Open Engine)

Visor web para abrir modelos de arquitectura y CAD arrastrándolos al navegador.
Usa **That Open Components / Fragments 3.6** para IFC y FRAG, y **Three.js** para el resto.

## Formatos

| Abre directamente | Notas |
|---|---|
| `.ifc` | Se convierte a Fragments en el navegador. Con ⬇ lo guardas como `.frag` (carga mucho más rápida). |
| `.frag` | Formato de That Open. |
| `.dxf` | Capas con su color, polilíneas con arcos, círculos, elipses, splines, bloques, cotas, 3DFACE y mallas. Los textos y sombreados no se dibujan. |
| `.stl` `.obj` (+`.mtl` y texturas) `.3ds` `.fbx` `.glb` `.gltf` `.dae` `.kmz` `.ply` `.3mf` `.3dm` (Rhino) `.wrl` `.usdz` | |
| `.zip` | Con cualquiera de los anteriores dentro. |

**No se pueden abrir** (formatos cerrados, sin lector web):
- **SketchUp `.skp`** → Archivo › Exportar › Modelo 3D › `.dae`, `.obj`, `.3ds`, `.fbx`, `.stl` o `.ifc`.
- **AutoCAD `.dwg`** → GUARDARCOMO › DXF (o ODA File Converter, gratis).
- **Revit / Archicad** → exportar a IFC.

Si abres un OBJ, selecciona a la vez el `.obj`, el `.mtl` y las texturas.

## Herramientas

- Lista de modelos: mostrar/ocultar, encuadrar, girar eje (Z↑/Y↑), descargar `.frag`, quitar.
- Al seleccionar un modelo: capas del DXF/Rhino, objetos de la malla o categorías IFC para ocultarlas.
- Clic en un elemento: propiedades IFC (atributos y psets) o datos de la malla.
- Vistas 3D / planta / alzado, ortogonal, aristas, alambre, medir distancias, sección horizontal, captura PNG.
- Unidades: automático (lee `$INSUNITS` del DXF o lo deduce por el tamaño) o mm/cm/m/pulgadas/pies.
- Teclas: **F** encuadrar · **Esc** quitar selección.

## Arrancar

Doble clic en `iniciar.bat`, o:

```bash
npm install
npm run dev
```

`npm install` copia a `public/` los archivos que las librerías necesitan (wasm de web-ifc, worker de fragments, rhino3dm), así que funciona sin internet.

## Publicar en GitHub / en tu web

- **Repositorio propio con GitHub Pages:** sube esta carpeta tal cual (sin `node_modules` ni `dist`, ya están en `.gitignore`). En el repo: Settings › Pages › Source: **GitHub Actions**. El flujo `.github/workflows/pages.yml` compila y publica solo en cada push a `main`.
- **Dentro de otra web:** copia el contenido de `dist/` a una subcarpeta (por ejemplo `visor/`). Funciona en cualquier ruta. Para incrustarlo en una página:

```html
<iframe src="visor/index.html" style="width:100%;height:80vh;border:0" allow="clipboard-write"></iframe>
```

Todo se procesa en el navegador de quien lo usa: los archivos no se suben a ningún servidor.

## Licencia

Código abierto con licencia [MIT](LICENSE). Las librerías incluidas y sus licencias están en [THIRD_PARTY.md](THIRD_PARTY.md).

> Las versiones están fijadas: Fragments 3.6.0 requiere exactamente **web-ifc 0.0.77**. Si actualizas una, actualiza la otra.
