# Jesús Ortiz Muñoz · Arquitectura · Obra · Software

Portfolio publicado en **https://ortizmozjesus.github.io/JOM/**

Último curso de Arquitectura en la Universidad de Sevilla. Además de los proyectos, la web enseña las herramientas que me programo para proyectar, medir y presupuestar. Todas las demos funcionan en el navegador, sin servidor y sin datos reales de clientes.

## Estructura

```
index.html, style.css, script.js   portada (ES/EN)
proyectos/
  shared/            estilos comunes y bc3.js (escritura y lectura FIEBDC-3)
  ifc-bc3/           visor IFC con That Open Engine → mediciones → BC3
  bc3/               lector de BC3 y conversor de tablas a BC3
  dxf/               planta paramétrica escrita en DXF R12
  forja/             motor de plantillas de Forja (imágenes con IA por lotes)
  facturas/          validación por cuadres y cruce de albaranes
  arquiviz/          simulación web del add-on de Blender ArquiViz
  boveda/            servidor doméstico (panel con datos privados retirados)
  ciudad-acuatica/   Proyectos 9: campo de niveles y estanque de piedras
  taller7-lora/      Taller 7: ondas, demoliciones y ortofotos históricas
  cerezales/         Dibujo 4: panel A1 y modelos de viento, sonido y relieve
```

## Tecnología

- **IFC → BC3**: [That Open Engine](https://github.com/ThatOpen) 3.6 (Fragments) para el visor y `web-ifc` 0.0.77 para leer los conjuntos de cantidades (Qto) y Pset. El modelo de ejemplo `casa-taller.ifc` está generado con IfcOpenShell.
- **BC3**: escritor y lector propios en `proyectos/shared/bc3.js`, con codificación Windows-1252 y fin de línea CRLF como espera Presto 8.8.
- **DXF**: escritor DXF R12 propio, validado con ezdxf.
- Librerías por CDN (jsDelivr) y mapa de importación; nada que compilar.

## Licencia

Código bajo licencia MIT (ver `LICENSE.txt`). Proyectos, dibujos y renders: © Jesús Ortiz Muñoz. Ortofotos servidas en directo por el IGN y la REDIAM (Junta de Andalucía). Entorno de ArquiViz: datos © colaboradores de OpenStreetMap.
