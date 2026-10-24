/**
 * Utilidades para ordenamiento y categorización de Tren Delantero y Repuestos
 */

// Categorías oficiales de Tren Delantero en orden estricto (1 al 13)
export const TREN_DELANTERO_CATEGORIES_ORDER = [
  'Meseta Superior',
  'Meseta Inferior',
  'Muñón Superior',
  'Muñón Inferior',
  'Bujes Superior',
  'Bujes Inferior',
  'Terminales',
  'Rotulas',
  'Brazo Loco',
  'Brazo Pitman',
  'Lápiz de Barra Estabilizadora',
  'Goma de Barra Estabilizadora',
  'Amortiguadores',
] as const;

// Marcas priorizadas de mayor a menor calidad/gama
export const BRAND_PRIORITY_ORDER = ['moog', 'elgin', 'tva'] as const;

/**
 * Normaliza un texto removiendo acentos y pasando a minúsculas
 */
export function normalizeText(text: string = ''): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Determina si el texto contiene indicadores de "Superior"
 */
function isSuperior(text: string): boolean {
  return /\b(SUP|SUPERIOR|SUPERIORES)\b/i.test(text);
}

/**
 * Determina si el texto contiene indicadores de "Inferior"
 */
function isInferior(text: string): boolean {
  return /\b(INF|INFERIOR|INFERIORES)\b/i.test(text);
}

/**
 * Resuelve y subdivide la categoría para Tren Delantero.
 * Si la categoría ya es específica (ej. "Meseta Superior"), la respeta.
 * Si es genérica ("Mesetas", "Muñones", "Bujes"), analiza el nombre del repuesto y su SKU
 * para separarlo automáticamente en Superior o Inferior.
 * Si no tiene categoría asignada, infiere la categoría adecuada por el nombre del repuesto.
 */
export function resolveTrenDelanteroCategory(
  rawCategoryName?: string | null,
  productName: string = '',
  productCode: string = ''
): string {
  const normCat = normalizeText(rawCategoryName || '');
  const combined = `${productName} ${productCode}`.toUpperCase();

  // 1. Si la categoría ya especifica Superior o Inferior
  if (normCat.includes('meseta') && (normCat.includes('sup') || normCat.includes('superior'))) {
    return 'Meseta Superior';
  }
  if (normCat.includes('meseta') && (normCat.includes('inf') || normCat.includes('inferior'))) {
    return 'Meseta Inferior';
  }
  if ((normCat.includes('munon') || normCat.includes('muñon')) && (normCat.includes('sup') || normCat.includes('superior'))) {
    return 'Muñón Superior';
  }
  if ((normCat.includes('munon') || normCat.includes('muñon')) && (normCat.includes('inf') || normCat.includes('inferior'))) {
    return 'Muñón Inferior';
  }
  if (normCat.includes('buje') && (normCat.includes('sup') || normCat.includes('superior'))) {
    return 'Bujes Superior';
  }
  if (normCat.includes('buje') && (normCat.includes('inf') || normCat.includes('inferior'))) {
    return 'Bujes Inferior';
  }

  // 2. Si la categoría es genérica (Mesetas, Muñones, Bujes), subdividir por nombre / código
  if (normCat.includes('meseta')) {
    if (isSuperior(combined)) return 'Meseta Superior';
    if (isInferior(combined)) return 'Meseta Inferior';
    return 'Mesetas';
  }

  if (normCat.includes('munon') || normCat.includes('muñon')) {
    if (isSuperior(combined)) return 'Muñón Superior';
    if (isInferior(combined)) return 'Muñón Inferior';
    return 'Muñones';
  }

  if (normCat.includes('buje')) {
    if (isSuperior(combined)) return 'Bujes Superior';
    if (isInferior(combined)) return 'Bujes Inferior';
    return 'Bujes';
  }

  // 3. Estandarización de nombres de categorías existentes
  if (normCat.includes('terminal')) {
    return 'Terminales';
  }
  if (normCat.includes('rotula')) {
    return 'Rotulas';
  }
  if (normCat.includes('brazo loco') || (normCat.includes('brazo') && normCat.includes('loco'))) {
    return 'Brazo Loco';
  }
  if (normCat.includes('pitman')) {
    return 'Brazo Pitman';
  }
  if (normCat.includes('lapiz') || (normCat.includes('barra') && normCat.includes('estabilizadora') && !normCat.includes('goma'))) {
    return 'Lápiz de Barra Estabilizadora';
  }
  if (normCat.includes('goma') && (normCat.includes('barra') || normCat.includes('estabilizadora') || normCat.includes('tensora'))) {
    return 'Goma de Barra Estabilizadora';
  }
  if (normCat.includes('amortiguador')) {
    return 'Amortiguadores';
  }

  // 4. Si viene con una categoría asignada que no es de las 13 anteriores (ej. "Pastillas de Freno", "Discos de Freno", "Rodamientos")
  if (rawCategoryName && rawCategoryName.trim() && rawCategoryName !== 'Sin Categoría') {
    return rawCategoryName.trim();
  }

  // 5. Inferencia por nombre del producto si no tenía categoría
  const normName = normalizeText(combined);
  if (normName.includes('meseta')) {
    if (isSuperior(combined)) return 'Meseta Superior';
    if (isInferior(combined)) return 'Meseta Inferior';
    return 'Mesetas';
  }
  if (normName.includes('munon') || normName.includes('muñon')) {
    if (isSuperior(combined)) return 'Muñón Superior';
    if (isInferior(combined)) return 'Muñón Inferior';
    return 'Muñones';
  }
  if (normName.includes('buje')) {
    if (isSuperior(combined)) return 'Bujes Superior';
    if (isInferior(combined)) return 'Bujes Inferior';
    return 'Bujes';
  }
  if (normName.includes('terminal')) return 'Terminales';
  if (normName.includes('rotula')) return 'Rotulas';
  if (normName.includes('brazo loco') || (normName.includes('brazo') && normName.includes('loco'))) return 'Brazo Loco';
  if (normName.includes('pitman')) return 'Brazo Pitman';
  if (normName.includes('lapiz') || (normName.includes('barra') && normName.includes('estabilizadora') && !normName.includes('goma'))) {
    return 'Lápiz de Barra Estabilizadora';
  }
  if (normName.includes('goma') && (normName.includes('barra') || normName.includes('estabilizadora') || normName.includes('tensora'))) {
    return 'Goma de Barra Estabilizadora';
  }
  if (normName.includes('amortiguador')) return 'Amortiguadores';

  return rawCategoryName || 'Otras Piezas';
}

/**
 * Obtiene el rango numérico (1 al 13) para ordenar las categorías de Tren Delantero.
 * Cualquier categoría no listada recibe 999 para posicionarse al final en orden alfabético.
 */
export function getTrenDelanteroCategoryRank(categoryName: string): number {
  const norm = normalizeText(categoryName);

  // 1. Meseta superior
  if (norm.includes('meseta') && (norm.includes('sup') || norm.includes('superior'))) return 1;
  // 2. Meseta inferior
  if (norm.includes('meseta') && (norm.includes('inf') || norm.includes('inferior'))) return 2;
  if (norm.includes('meseta')) return 2.5;

  // 3. Muñón superior
  if ((norm.includes('munon') || norm.includes('muñon')) && (norm.includes('sup') || norm.includes('superior'))) return 3;
  // 4. Muñón inferior
  if ((norm.includes('munon') || norm.includes('muñon')) && (norm.includes('inf') || norm.includes('inferior'))) return 4;
  if (norm.includes('munon') || norm.includes('muñon')) return 4.5;

  // 5. Bujes superior
  if (norm.includes('buje') && (norm.includes('sup') || norm.includes('superior'))) return 5;
  // 6. Bujes inferior
  if (norm.includes('buje') && (norm.includes('inf') || norm.includes('inferior'))) return 6;
  if (norm.includes('buje')) return 6.5;

  // 7. Terminales
  if (norm.includes('terminal')) return 7;

  // 8. Rotulas
  if (norm.includes('rotula')) return 8;

  // 9. Brazo loco
  if (norm.includes('brazo loco') || (norm.includes('brazo') && norm.includes('loco'))) return 9;

  // 10. Brazo Pitman
  if (norm.includes('pitman')) return 10;

  // 11. Lápiz de barra estabilizadora
  if (norm.includes('lapiz') || (norm.includes('barra') && norm.includes('estabilizadora') && !norm.includes('goma'))) return 11;

  // 12. Goma de barra estabilizadora
  if (norm.includes('goma') && (norm.includes('barra') || norm.includes('estabilizadora') || norm.includes('tensora'))) return 12;

  // 13. Amortiguadores
  if (norm.includes('amortiguador')) return 13;

  return 999;
}

/**
 * Obtiene el rango de la marca:
 * 1° Moog -> 0
 * 2° Elgin -> 1
 * 3° TVA -> 2
 * Otras marcas -> 999
 */
export function getBrandRank(brandName?: string | null): number {
  if (!brandName) return 999;
  const norm = normalizeText(brandName);
  if (norm.includes('moog')) return 0;
  if (norm.includes('elgin')) return 1;
  if (norm.includes('tva')) return 2;
  return 999;
}

/**
 * Identifica la jerarquía de categorías para cotizaciones mixtas (Tren Delantero y Motor)
 */
export function getGeneralCategoryRank(categoryNameOrProductName: string): number {
  const trenRank = getTrenDelanteroCategoryRank(categoryNameOrProductName);
  if (trenRank < 999) return trenRank;

  // Orden para categorías de motor
  const norm = normalizeText(categoryNameOrProductName);
  const MOTOR_CATEGORIES = [
    'piston',
    'anillo',
    'biela',
    'bancada',
    'empacadura',
    'bomba de aceite',
    'bomba de gasolina',
    'bomba de agua',
    'taquete',
    'valvula',
  ];

  for (let i = 0; i < MOTOR_CATEGORIES.length; i++) {
    if (norm.includes(MOTOR_CATEGORIES[i])) {
      return 100 + i;
    }
  }

  return 999;
}

/**
 * Ordena una lista plana de ítems (para Cotizaciones, PDF y Capturas)
 * respetando el orden de categorías y la prioridad de marcas (Moog > Elgin > TVA).
 */
export function sortQuoteItems<T extends { product_name: string; product_code?: string; brand_name?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    // 1. Obtener la categoría resuelta de cada ítem
    const catA = resolveTrenDelanteroCategory(undefined, a.product_name, a.product_code);
    const catB = resolveTrenDelanteroCategory(undefined, b.product_name, b.product_code);

    const rankA = getGeneralCategoryRank(catA);
    const rankB = getGeneralCategoryRank(catB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Si ambas están fuera de la lista principal (rank 999), ordenar alfabéticamente por categoría
    if (rankA === 999 && catA !== catB) {
      const catCmp = catA.localeCompare(catB);
      if (catCmp !== 0) return catCmp;
    }

    // 2. Jerarquía de marca: Moog > Elgin > TVA > otras
    const brandRankA = getBrandRank(a.brand_name);
    const brandRankB = getBrandRank(b.brand_name);
    if (brandRankA !== brandRankB) {
      return brandRankA - brandRankB;
    }

    // Si ambas marcas tienen el mismo rango, ordenar alfabéticamente por marca
    const brandNameA = a.brand_name || '';
    const brandNameB = b.brand_name || '';
    const brandCmp = brandNameA.localeCompare(brandNameB);
    if (brandCmp !== 0) return brandCmp;

    // 3. Por nombre de producto
    return (a.product_name || '').localeCompare(b.product_name || '');
  });
}
