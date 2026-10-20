export type UpdateType = 'feature' | 'fix' | 'improvement' | 'report' | 'design';

export interface SystemUpdateItem {
  id: string;
  title: string;
  description: string;
  type: UpdateType;
  tag?: string;
  module?: 'Inventario' | 'PDF & Reportes' | 'Clutch' | 'Cotizador Motor' | 'Cotización Manual' | 'Carrito' | 'General';
}

export interface DailyUpdateGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // "20 de Octubre de 2026"
  isToday?: boolean;
  badge?: string;
  summary?: string;
  items: SystemUpdateItem[];
}

export const SYSTEM_UPDATES_DATA: DailyUpdateGroup[] = [
  {
    date: '2026-10-20',
    displayDate: 'Hoy - 20 de Octubre de 2026',
    isToday: true,
    badge: 'HOY',
    summary: 'Reportes de auditoría en almacén, mejoras de PDF y limpieza de cotizadores.',
    items: [
      {
        id: 'upd-2026-10-20-1',
        title: 'Línea de conteo físico ubicada al fondo de la casilla',
        description: 'La línea de escritura en la columna Conteo Físico del PDF ahora se dibuja en la base de la celda (con corchetes [ _____ ]), dejando el espacio superior despejado para anotar números a mano con lápiz o bolígrafo.',
        type: 'improvement',
        tag: 'PDF Auditoría',
        module: 'PDF & Reportes',
      },
      {
        id: 'upd-2026-10-20-2',
        title: 'Limpieza de botones: Se mantiene solo "Generar Reporte"',
        description: 'Se eliminó el botón "Generar Pedido" de la barra superior de Alerta de Stock para evitar sobrecargar la interfaz, dejando exclusivamente el reporte de conteo físico para almacén.',
        type: 'improvement',
        tag: 'Interfaz',
        module: 'Inventario',
      },
      {
        id: 'upd-2026-10-20-3',
        title: 'Eliminación del campo "Huella" en constancia de PDF',
        description: 'El recuadro de firma al final del reporte PDF se simplificó dejando únicamente "Firma: _______________", sin el texto de huella dactilar.',
        type: 'fix',
        tag: 'Formato',
        module: 'PDF & Reportes',
      },
      {
        id: 'upd-2026-10-20-4',
        title: 'Corrección de numeración total de páginas en PDF',
        description: 'Se resolvió el error que mostraba el texto literal "{totalPages}" en el pie de página, mostrando ahora la numeración real exacta en cada hoja (ej. "Página 1 de 7").',
        type: 'fix',
        tag: 'Paginación',
        module: 'PDF & Reportes',
      },
      {
        id: 'upd-2026-10-20-5',
        title: 'Generación de Reporte PDF para Conteo Físico',
        description: 'Nuevo botón "Generar Reporte" en Alerta de Stock que descarga un PDF profesional de control interno con SKU, descripción, marca, stock del sistema y casillas de verificación [ ] OK  [ ] DIF.',
        type: 'feature',
        tag: 'Reportes',
        module: 'PDF & Reportes',
      },
      {
        id: 'upd-2026-10-20-6',
        title: 'Eliminación del botón "Cargar Todo" en cotizadores',
        description: 'Se removió el botón masivo "Cargar Todo" en los cotizadores de Motor y Tren Delantero para prevenir cargas accidentales al carrito y priorizar la selección precisa de componentes.',
        type: 'improvement',
        tag: 'Cotizador',
        module: 'Cotizador Motor',
      },
    ],
  },
  {
    date: '2026-10-11',
    displayDate: '11 de Octubre de 2026',
    badge: 'Hace 9 días',
    summary: 'Lanzamiento del módulo de Clutch y vinculación inteligente a motores.',
    items: [
      {
        id: 'upd-2026-10-11-1',
        title: 'Nueva Sección y Cotizador de Clutch (Croche)',
        description: 'Sección especializada accesible desde la barra lateral con tarjetas de embrague, platos, discos, collarines y bombines.',
        type: 'feature',
        tag: 'Nuevo Módulo',
        module: 'Clutch',
      },
      {
        id: 'upd-2026-10-11-2',
        title: 'Vinculación bidireccional Clutch ↔ Motor',
        description: 'Permite asociar un clutch a uno o múltiples motores compatibles y viceversa. Al entrar a un motor se visualiza su clutch recomendado.',
        type: 'feature',
        tag: 'Asociaciones',
        module: 'Clutch',
      },
      {
        id: 'upd-2026-10-11-3',
        title: 'Buscador Inteligente en sección Clutch',
        description: 'El buscador de clutch ahora filtra también por el nombre del motor vinculado (ej. buscar "350" o "Ford 300" encuentra sus clutches asignados aunque el título sea genérico).',
        type: 'feature',
        tag: 'Búsqueda',
        module: 'Clutch',
      },
    ],
  },
  {
    date: '2026-10-05',
    displayDate: '05 de Octubre de 2026',
    summary: 'Módulo de Alerta de Stock Mínimo y redondeo comercial.',
    items: [
      {
        id: 'upd-2026-10-05-1',
        title: 'Vista especializada de Alerta de Stock Mínimo',
        description: 'Filtro en inventario con métricas en tiempo real de repuestos agotados (stock 0) y por debajo del umbral mínimo configurado.',
        type: 'feature',
        tag: 'Stock',
        module: 'Inventario',
      },
      {
        id: 'upd-2026-10-05-2',
        title: 'Configurador Masivo e Individual de Stock Mínimo',
        description: 'Modal para establecer el mínimo global predeterminado o aplicar reglas por lote con filtro de precios activos.',
        type: 'feature',
        tag: 'Configuración',
        module: 'Inventario',
      },
      {
        id: 'upd-2026-10-05-3',
        title: 'Redondeo Comercial en Bolívares BCV',
        description: 'Cálculo optimizado de precios con redondeo limpio a múltiplos comerciales para evitar centavos incómodos en caja.',
        type: 'improvement',
        tag: 'Precios BCV',
        module: 'General',
      },
    ],
  },
  {
    date: '2026-08-27',
    displayDate: '27 de Agosto de 2026',
    summary: 'Cotización Manual con visor PDF en vivo y módulo de Misceláneos.',
    items: [
      {
        id: 'upd-2026-08-27-1',
        title: 'Sección de Cotización Manual',
        description: 'Creador de presupuestos personalizados con vista previa de PDF interactiva en tiempo real y notas internas protegidas.',
        type: 'feature',
        tag: 'Cotizador',
        module: 'Cotización Manual',
      },
      {
        id: 'upd-2026-08-27-2',
        title: 'Sección Misceláneos (Aceites y Lubricantes)',
        description: 'Acceso directo en barra lateral e inventario filtrado por aceites, grasas y lubricantes con tarjetas de producto expandidas.',
        type: 'feature',
        tag: 'Catálogo',
        module: 'Inventario',
      },
    ],
  },
  {
    date: '2026-08-23',
    displayDate: '23 de Agosto de 2026',
    summary: 'Combos agrupados en cotizador y persistencia de carrito.',
    items: [
      {
        id: 'upd-2026-08-23-1',
        title: 'Combos y paquetes agrupados',
        description: 'Guardado de cantidades personalizadas de repuestos y empaquetado de combos en cotizadores de motor.',
        type: 'feature',
        tag: 'Combos',
        module: 'Cotizador Motor',
      },
      {
        id: 'upd-2026-08-23-2',
        title: 'Búsqueda global con Fuse.js',
        description: 'Integración de motor de búsqueda con tolerancia a errores tipográficos y coincidencias por SKU, nombre y marca.',
        type: 'improvement',
        tag: 'Buscador',
        module: 'General',
      },
    ],
  },
  {
    date: '2026-08-07',
    displayDate: '07 de Agosto de 2026',
    summary: 'Carrito redimensionable y logotipos de marcas.',
    items: [
      {
        id: 'upd-2026-08-07-1',
        title: 'Carrito de compras con ancho ajustable',
        description: 'Panel lateral del carrito con control de arrastre para cambiar el ancho según la resolución de pantalla del usuario.',
        type: 'improvement',
        tag: 'Carrito',
        module: 'Carrito',
      },
      {
        id: 'upd-2026-08-07-2',
        title: 'Logotipos de marcas en presupuesto',
        description: 'Inclusión de los logos oficiales de marcas de repuestos en el desglose de cotización y en el carrito.',
        type: 'design',
        tag: 'Logos',
        module: 'Carrito',
      },
    ],
  },
  {
    date: '2026-07-20',
    displayDate: '20 de Julio de 2026',
    summary: 'Formato combinado de PDF y desglose dual Divisas / BCV.',
    items: [
      {
        id: 'upd-2026-07-20-1',
        title: 'Cotización PDF combinada (USD y Bs)',
        description: 'Generación de documentos PDF con columnas simultáneas de "Precio en Divisas" y "Precio en Dólares BCV", con recuadro de totales en 3 niveles.',
        type: 'feature',
        tag: 'PDF',
        module: 'PDF & Reportes',
      },
    ],
  },
  {
    date: '2026-07-10',
    displayDate: '10 de Julio de 2026',
    summary: 'Autodetección inteligente de marcas y jerarquía de medidas.',
    items: [
      {
        id: 'upd-2026-07-10-1',
        title: 'Ordenamiento de medidas STD > 010 > 020 > 030',
        description: 'Priorización automática de medidas estándar y sobremedidas en la lista de kits de motor según el código SKU.',
        type: 'improvement',
        tag: 'Ordenamiento',
        module: 'Cotizador Motor',
      },
      {
        id: 'upd-2026-07-10-2',
        title: 'Sugerencia automática de marcas por SKU',
        description: 'Detección inteligente de marcas (Sealed Power, Moog, TVA, Elgin, etc.) mediante sufijos y prefijos del código.',
        type: 'feature',
        tag: 'Inteligencia SKU',
        module: 'Inventario',
      },
    ],
  },
  {
    date: '2026-06-16',
    displayDate: '16 de Junio de 2026',
    summary: 'Sincronización de existencias con archivos Excel.',
    items: [
      {
        id: 'upd-2026-06-16-1',
        title: 'Importación diferencial de existencias Excel',
        description: 'Carga de archivos Existencia.xls con comparación en tiempo real y actualización selectiva de stock.',
        type: 'feature',
        tag: 'Excel',
        module: 'Inventario',
      },
      {
        id: 'upd-2026-06-16-2',
        title: 'Visualización de stock en cotizadores',
        description: 'Etiqueta con la cantidad en stock disponible dentro de cada tarjeta de componente en motores.',
        type: 'feature',
        tag: 'Stock',
        module: 'Cotizador Motor',
      },
    ],
  },
];
