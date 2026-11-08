# JOM Design System

Estilo propio de Jesús Ortiz Muñoz: **arquitectura + software**. Papel azul hielo, tinta azul noche, un solo acento **rojo Ferrari**, serif editorial para titulares y grotesca para leer. Limpio como un plano, preciso como código, con movimiento que explica.

Versión 1.0 · 2 de noviembre de 2026 · Fuente de verdad en código: [`tokens.css`](tokens.css). Guía visual viva: [`index.html`](index.html).

---

## 1. Principios

1. **El trabajo manda.** La interfaz se retira; la obra, el diagrama o la herramienta lideran.
2. **Una sola cosa memorable.** Un momento de movimiento no pedido (la carátula), el resto responde a la acción.
3. **Exacto y útil.** Poco texto, ningún elemento vacío. Si no informa, se quita.
4. **Línea antes que imagen.** Las herramientas se representan con diagramas de línea (wireframes), nunca con capturas.
5. **Honesto.** Nada de cifras, citas, clientes o demos inventados. Si algo no existe, no se promete.
6. **Bilingüe, accesible y rápido.** ES/EN, teclado, `prefers-reduced-motion`, sin dependencias externas de fuentes.

## 2. Reglas duras (lo que NUNCA se hace)

| No | En su lugar |
|---|---|
| Marcos, marcas de corte o bordes decorativos en imágenes | La imagen sola, a sangre |
| Ampliar/escalar/mover nada al pasar el ratón | Cambio de tono de fondo; el feedback va en el contenedor |
| Capturas de pantalla como miniatura de una herramienta | Diagrama de línea animado |
| Sombras en reposo, degradados, cristal decorativo | Tono, espacio |
| Eyebrows, etiquetas en versalitas con tracking, numeración 01/02 (salvo secuencia real) | El titular habla solo |
| Emojis o flechas pegadas a enlaces; puntos medios en cadenas | Texto o SVG propio |
| Líneas decorativas (filetes) | Espacio y escala. Línea solo en tablas reales y campos |
| `transition: all`, animar width/height/top/left, `ease-in` en interfaz | Propiedades nombradas; transform y opacity |
| Colores, fuentes o espacios sueltos fuera de los tokens | `var(--…)` |
| Texto inventado: métricas, premios, clientes, demos | Solo lo real; si falta, se avisa |
| Azul/cian como acento (fue el primero; el acento es rojo) | `--color-accent` |

## 3. Color

Neutros en OKLCH; el acento y el foco en hex canónico (los mismos que usan las herramientas, la imagen OG y el favicon). Un acento; el resto es neutro azulado.

| Token | Valor | Hex ≈ | Uso |
|---|---|---|---|
| `--color-paper` | oklch(97.2% .006 215) | #f1f7f8 | Fondo base |
| `--color-paper-2` | oklch(94% .009 215) | #e5edef | Bandas, paneles, contenedores de diagrama |
| `--color-paper-3` | oklch(90.5% .011 215) | #d8e2e4 | Hover de superficies |
| `--color-paper-hi` | oklch(99% .004 215) | #f9fcfd | Panel elevado |
| `--color-ink` | oklch(16% .032 250) | #030e1a | Texto, trazo, fondos oscuros |
| `--color-ink-2` | oklch(34% .022 245) | #2f3943 | Texto secundario |
| `--color-muted` | oklch(41% .02 240) | #414c54 | Metadatos |
| `--color-rule` | oklch(84% .01 225) | #c4cccf | Borde de controles |
| `--color-accent` | hex canónico | **#ff2800** | Rojo Ferrari: acción principal, trazo clave, estado activo |
| `--color-accent-ink` | = ink | #030e1a | Texto sobre el acento (4,9:1) |
| `--color-focus` | hex canónico | #b31b00 | Foco y texto rojo sobre papel (6,5:1) |

Reglas: el acento ocupa **menos del 5 %** de una pantalla. Texto sobre rojo = tinta, nunca blanco (3,8:1 no pasa). Las herramientas embebidas conservan `#0a1522` como tinta (casi idéntica). Texto rojo sobre papel = `--color-focus`, nunca `--color-accent`. Fondos oscuros (carátula, visores) = `--color-ink`/`--color-mask` con texto `--color-paper`. Un solo tema claro (sin modo oscuro automático).

## 4. Tipografía

**Dos familias, funciones distintas.** Alojadas en local (`assets/fonts`, WOFF2, `font-display: swap`).

- **Hedvig Letters Serif 400** (única) → titulares, nombres, números de pasos, wordmark. Tracking negativo, interlineado cerrado.
- **Highland Gothic 300/400/700** (la tipografía de texto elegida por Jesús, archivos .ttf originales) → todo lo demás: cuerpo 400, botones/menú/etiquetas 700, ligero 300. No existe 500/600: el navegador usa 400 y 700. Sus cifras 1/I y 0/O se parecen: en tablas y códigos numéricos, usar tamaño ≥ 15 px.

| Rol | Tamaño | Interlineado | Tracking | Familia/peso |
|---|---|---|---|---|
| Hero (nombre) | `--text-hero` 52–116 px | .92 | −.035em | Hedvig 400 |
| H1 de página | `--text-page` 56–128 px | .92 | −.04em | Hedvig 400 |
| H2 sección | `--text-section` 40–76 px | 1 | −.03em | Hedvig 400 |
| H3 / título de ficha | `--text-title` 24–32 px | 1.1–1.2 | −.02em | Hedvig 400 |
| Titular de herramienta | clamp(1.75rem, 1.6vw+1rem, 2.5rem) | 1.05 | −.03em | Hedvig 400 |
| Lead | `--text-lead` 20–28 px | 1.4 | −.012em | Highland 400 |
| Cuerpo | `--text-md` 17 px | 1.6 | 0 | Highland 400 |
| Pie, tabla, botón | `--text-sm` 15 px | 1.5 | 0 | Highland 400–700 |
| Metadato mínimo | `--text-xs` 13 px | 1.4 | 0 | Highland 400 |

Reglas: cuanto más grande, más tracking negativo y menos interlineado; por debajo de 32 px, interlineado ≥ 1.15. Línea de lectura 45–75 caracteres (`ch`). `text-wrap: balance` en titulares, `pretty` en párrafos. Números en `tabular-nums`. Titular ≤ 2 líneas a cualquier ancho. Nada por debajo de 13 px.

## 5. Espacio y rejilla

- **Escala de 4 px:** 2 · 4 · 8 · 12 · 16 · 24 · 40 · 64 · 96 · 144 (`--space-3xs…4xl`).
- **Contenedor** 1440 px centrado; **gutter** 64 / 24 / 16 px; **12 columnas** con `--gap-columns` 32/16 px.
- **Secciones:** `--section-gap-s/-/-l` = 120/144/176 px (80/96/120 y 56/72/96 en móvil).
- **Cabecera** 72 px (60 móvil), pegajosa, translúcida (`blur(20px) saturate(180%)`, 72 % papel; sólida con `prefers-reduced-transparency`).
- **Objetivo táctil mínimo 44 px**. Márgenes iguales a ambos lados; ningún tramo vacío mayor que media pantalla.
- Radios: controles 2 px, contenedores 3 px. Sin sombras.
- Breakpoints: `60rem` (tableta) y `40rem` (móvil); 34 rem para una columna de rejilla de herramientas.

## 6. Movimiento

**Filosofía:** pocas piezas, de verdad memorables. Movimiento no pedido solo en la carátula; el resto responde a la acción y explica un cambio.

### Curvas y tiempos
| Token | Valor | Uso |
|---|---|---|
| `--ease-out` | cubic-bezier(.23, 1, .32, 1) | Por defecto: entradas, salidas, color |
| `--ease-in-out` | cubic-bezier(.77, 0, .175, 1) | Cambios de posición en pantalla |
| `--dur-press` | 90 ms | Pulsar |
| `--dur-micro` | 100 ms | Feedback |
| `--dur-short` | 180 ms | Hover, color, desplegables pequeños |
| `--dur-long` | 360 ms | Paneles |
| `--spring` / `--spring-d` | linear(…) ζ 1.0, resp. .40 s / 620 ms | **Muelle crítico, sin rebote**: por defecto en todo lo táctil |
| `--spring-b` / `--spring-bd` | linear(…) ζ .8, resp. .45 s / 750 ms | Rebote leve, solo donde hay inercia (paneles, guía) |
| `--stagger` | 70 ms (30–90) | Entre elementos de un grupo |

Nunca `ease-in` en interfaz. Animar solo `transform`, `opacity`, `clip-path`, `stroke-dashoffset` y `filter` ligero. Las interfaces cortas (<300 ms) se sienten rápidas.

### Piezas firma
1. **Carátula** (inicio): pantalla completa oscura con anillos rojos que se dibujan (1,1 s, `power2.inOut`, stagger .08), nombre que sube con máscara, pista "Desliza o pulsa para entrar". Se abre como telón (`y: −100 %`, 0,95 s `power4.inOut`), **al pulsar, deslizar (rueda, flechas, gesto 1:1 con el dedo) y vuelve cada vez que se regresa arriba** (cae en 0,8 s `power3.out`; pausa de 0,8 s anti-rebote). Con `prefers-reduced-motion` no aparece.
2. **Portada** (tras abrir): nombre letra a letra (stagger 28 ms), texto y botones escalonados (100 ms), imagen que se revela de abajo arriba con zoom 1,18→1, siete anillos rojos que se dibujan y se desvanecen, tres ondas en el campo de puntos.
3. **Diagramas de línea** (herramientas): se trazan al entrar en pantalla y entran en bucle (ver §8).
4. **Pantalla completa de herramienta:** el recuadro se expande desde la posición de la ficha (`clip-path`, 0,8 s `power4.out`) y se cierra de vuelta (0,5 s `power3.inOut`).

### Microinteracciones
- **Pulsar:** `scale(.97)`, 90 ms al bajar; al soltar vuelve con `--spring`.
- **Hover (solo `@media (hover: hover) and (pointer: fine)`):** cambio de tono de fondo; el color cambia en 180 ms. **Nunca escala ni desplaza.**
- **Aparecer:** `clip-path`/opacity con `--ease-out`; nada entra desde `scale(0)` (mínimo .95 + opacity).
- Cabecera que se oculta al bajar y reaparece al subir (250 ms). Barra de progreso de lectura (2 px, acento).
- Interruptibles: transiciones CSS (se re-dirigen desde el valor actual), muelles para lo táctil; nunca bloquear la entrada durante una animación.
- **Sin animación** en acciones de teclado frecuentes (p. ej. cambiar de herramienta con flechas).

### Accesibilidad del movimiento
`prefers-reduced-motion`: duraciones a ~0, bucles ocultos, carátula omitida, contenido siempre visible sin JS. `prefers-reduced-transparency`: cabecera sólida.

## 7. Componentes

- **Botón** (`.btn`): alto 44 px, borde 1 px tinta, radio 2 px, 600. Primario = fondo `--color-accent` + texto tinta. Estados: hover (tono), `:active` scale .97, foco 2 px `--color-focus`, `:disabled` opacidad .45 + `not-allowed`.
- **Pestaña/filtro** (`.tab`): igual que botón, alto 44; activa = acento.
- **Enlace:** subrayado de 1 px en `--color-rule` (offset .16em); al pasar el ratón el subrayado pasa a `--color-accent`.
- **Cabecera:** wordmark Hedvig 24 px a la izquierda, enlaces 600 al centro, `EN` a la derecha. Móvil: botón "Menú" → hoja a pantalla completa con enlaces en Hedvig 44 px.
- **Ficha de herramienta** (`.tool-tile`): diagrama en contenedor `--color-paper-2` 16:10 + nombre Hedvig `--text-title`. Hover = tono. Pulsar = abre la herramienta a pantalla completa con guía lateral ("Para qué sirve / Cómo se usa", 1 frase + 3 pasos cortos).
- **Caso de proyecto:** H1 de página + lead + datos en línea (`dt` 600 muted, `dd` normal) + lámina a ancho completo + rejilla de 2 columnas + navegación anterior/siguiente en Hedvig.
- **Visor de láminas:** `<dialog>`; clic = zoom 2,4× con arrastre y rueda (1–5×); ←/→; difuminado 4 px al cambiar de imagen.
- **Carátula:** ver §6.
- **Interfaz de herramienta embebida:** mismo skin (papel, tinta, acento rojo, Hedvig en títulos, Highland Gothic en controles, 2 px de radio, sin sombras); barra superior `Herramientas / Nombre` que se oculta al embeber.

## 8. Diagramas de línea (wireframes en movimiento)

Cada herramienta tiene uno. Son SVG `viewBox="0 0 480 300"`, `fill: none`, trazos redondeados.

- **Trazo base:** `--color-ink`, 1,5 px, `vector-effect: non-scaling-stroke`. **Trazo clave:** `.ac` en `--color-accent`, 2,25 px (uno o dos por diagrama como máximo).
- **Dibujo de entrada:** `pathLength="1"`, `stroke-dasharray: 1`, `dashoffset 1→0`, 1100 ms `--ease-out`, retraso `calc(var(--i) × 70ms)`. Se dispara al entrar en pantalla (IntersectionObserver, ≥ 25 %), con escalón de 110 ms entre fichas.
- **Bucles** (`.lp`, solo con la ficha en pantalla y el dibujo terminado):
  - `flow` — línea discontinua que corre (1,8 s `linear`).
  - `breathe` — escala 1→1,07 alterna (3,2 s `--ease-in-out`).
  - `ping` — anillo que sale y se desvanece (3,6 s `--ease-out`, desfase 700 ms).
  - `blink` — relleno rojo que se enciende en secuencia (3 s, desfase 160 ms).
- Los bucles se pausan fuera de pantalla y se ocultan con `prefers-reduced-motion`.
- Vocabulario: ondas/anillos (ecos, estanque), líneas de flujo (viento), curvas de nivel (elipses), cauce + puntos (pueblos), cubo isométrico (modelo 3D), documento→tabla (datos), plantilla→rejilla (lotes).

## 9. Imagen

- Solo imágenes reales del autor, WebP. Se muestran **sin marco**, a sangre, `object-fit: cover` donde haga falta.
- Láminas: subir a 3000–4000 px cuando se pueda y permitir zoom. Alt descriptivo y traducido (`data-alt-es/en`).
- Nunca capturas de herramientas: diagramas de línea.

## 10. Texto y voz

- Primera persona, verbos de acción, **una idea por frase**. Concreto antes que abstracto.
- Sin muletillas ("apasionado", "método de construcción e ideación"). Sin repetir una misma frase en dos páginas.
- Titulares ≤ 2 líneas. Descripciones de herramienta: una frase corta; guía: 1 frase + 3 pasos de ≤ 10 palabras.
- Botones = verbo + objeto ("Probar Forja"). Sin pronombres inferidos del nombre: neutro.
- Bilingüe: `data-es` / `data-en` (también `data-alt-*` y `data-aria-*`). Nunca una promesa que la web no cumpla.

## 11. Accesibilidad (mínimos)

Contraste texto ≥ 4,5:1 · foco visible 2 px · "Saltar al contenido" · objetivos ≥ 44 px · `lang` correcto · `prefers-reduced-motion` y `-transparency` · sin scroll horizontal a 390 px · HTML válido (encabezado dentro de botón, nunca al revés) · carátula con `role="dialog"` y teclado.

## 12. Archivos y flujo

```
assets/css/fonts.css     @font-face locales
assets/css/studio.css    base: tokens, tipografía, rejilla, componentes
assets/css/motion.css    movimiento, carátula, herramientas, casos, muelles
assets/js/site.js        idioma ES/EN, filtro, visor de láminas
assets/js/motion.js      carátula, portada, menú móvil, galería de herramientas, zoom
assets/js/vendor/        GSAP + ScrollTrigger (local)
design-system/           este sistema: tokens.css, DESIGN.md, index.html
```

Orden de trabajo: tokens → composición sin animación → texto real → movimiento → comprobar (390/768/1440, consola, scroll horizontal, `sloplint`, inspector). Herramientas de apoyo: Hallmark (suelo anti-IA), taste-skill, Impeccable, UI UX Pro Max, Emil Kowalski y Apple Design (movimiento), GSAP.

## 13. Lista de comprobación antes de publicar

- [ ] Solo tokens; ningún color/fuente/espacio suelto.
- [ ] Sin marcos, sin zoom al pasar el ratón, sin capturas, sin sombras/degradados/líneas decorativas.
- [ ] Un acento rojo, texto sobre rojo en tinta.
- [ ] Titular ≤ 2 líneas, cuerpo ≥ 17 px, nada < 13 px.
- [ ] Objetivos ≥ 44 px, foco visible, `prefers-reduced-motion` probado.
- [ ] Movimiento: curvas del sistema, < 300 ms en interfaz, hover bajo `(hover:hover)`, solo transform/opacity.
- [ ] Texto corto y verdadero, ES y EN.
- [ ] 390 / 768 / 1440 sin scroll horizontal ni errores de consola.
