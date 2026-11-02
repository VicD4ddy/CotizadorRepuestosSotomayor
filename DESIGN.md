# Guía de Diseño UI/UX - Cotizador Sotomayor
**Arquetipo Activo:** Swiss Precision Dark (POS, Dashboards, Sistemas & Cotizador)

---

## 1. Fundamentos Visuales y Cromáticos
- **Modo Primario:** Dark / Slate Industrial
- **Fondos de Interfaz:** `#09090B` (Canvas oscuro), `#0F172A` (Sidebar / Cabeceras oscuras), `#121215` (Contenedores elevados), y `#F8FAFC` (Canvas claro actual adaptativo).
- **Líneas y Grillas Expuestas:** Bordes nítidos de `1px` utilizando `border-slate-200` (modo claro) o `border-zinc-800` / `border-slate-800` (modo oscuro).
- **Radio de Esquinas:** `rounded-sm` a `rounded-md` (máximo `6px`), evitando redondeos exagerados tipo burbuja (`rounded-2xl` / `rounded-3xl`).
- **Acento Industrial Principal:** Esmeralda Técnico / Motor `#10B981` (Hover: `#059669`, Badge bg: `#ECFDF5`).
- **Acento Secundario (BCV / Financiero):** Azul Técnico `#2563EB` (BCV rate: `#1D4ED8`, Background: `#EFF6FF`).

---

## 2. Tipografía y Datos Numéricos (Regla Anti-Slop)
- **Tipografía de Interfaz:** `Inter` / `Space Grotesk` para jerarquías y títulos de módulo.
- **Tipografía Numérica Obligatoria:** Todo precio, tasa de cambio BCV, cantidad, métrica, ID, C.I./RIF o fecha DEBE utilizar fuente monoespaciada (`font-mono`) y la clase `tabular-nums`.
- **Contrastes:** Alto contraste entre etiquetas descriptivas (`text-slate-500` / `text-slate-400` en `text-xs`) y valores principales (`text-slate-900` / `text-white` en `font-bold`).

---

## 3. Componentes Interactivos y Micro-animaciones
- **Micro-interacciones:** Uso de `react-useanimations` en botones principales, acciones de fila y disparadores de diálogo con interacción `hover-replay`.
- **Estados de Interacción:** Todo botón o enlace interactivo debe implementar explícitamente:
  - `:hover` con cambio de fondo sutil o elevación de contraste.
  - `:focus-visible` con anillo accesible (`focus-visible:ring-2 focus-visible:ring-emerald-500`).
  - `:active` con feedback físico táctil.
  - Skeletons de carga y estados vacíos diseñados contextualmente.

---

## 4. Reglas Estrictas del Proyecto
- **PROHIBIDO:** Gradientes decorativos morados/azules/rosas (`from-indigo-500 via-purple-500 to-pink-500`).
- **PROHIBIDO:** Layouts genéricos de marketing AI con 3 tarjetas simétricas y sombras difusas excesivas.
- **PROHIBIDO:** Eliminar consistencia en documentos impresos/PDF; deben respetar los márgenes milimétricos y la paleta industrial corporativa de Repuestos Sotomayor.

