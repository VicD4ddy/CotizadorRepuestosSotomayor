import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Kit, Product } from '@/types';
import { formatUSD, calculateBcvPrice } from '@/lib/utils';
import {
  resolveTrenDelanteroCategory,
  getTrenDelanteroCategoryRank,
  getBrandRank,
} from '@/lib/tren-delantero';

interface KitCatalogItem {
  id: string;
  kit_id: string;
  product_id: string;
  quantity?: number;
  products?: Product | null;
}

interface GenerateKitCatalogPDFOptions {
  kit: Kit;
  items: KitCatalogItem[];
  bcvRate: number;
  bcvMultiplier?: number;
}

// Convert hex color to RGB array
function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// Format Bs with Spanish locale
function formatBsVal(val: number): string {
  return `Bs ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Load image as base64 with timeout and resizing
async function loadImageAsBase64(
  url: string,
  maxWidth: number = 100,
  maxHeight: number = 100,
  timeoutMs: number = 3500
): Promise<string | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const blob = await response.blob();

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

// Concurrency pool helper to load images without overwhelming browser memory
async function loadImagesInPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 6
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const cur = index++;
      try {
        results[cur] = await fn(items[cur]);
      } catch {
        results[cur] = null as any;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const MOTOR_CATEGORY_ORDER = [
  'pistones',
  'anillos',
  'bielas',
  'bancadas',
  'empacaduras',
  'bombas de aceite',
  'bombas de gasolina',
  'bombas de agua',
  'taquetes',
  'valvulas',
  'camisas',
];

const MEASURE_SORTED_CATEGORIES = ['anillo', 'biela', 'bancada', 'piston', 'concha'];

function getMeasureOrder(productName: string, productCode: string): number {
  const code = (productCode || '').toUpperCase().trim();
  const upper = (productName || '').toUpperCase().trim();

  if (/\bSTD\b|[\s\-_]STD[\s\-_]|[\s\-_]STD$|^STD[\s\-_]/.test(code) || code.endsWith('STD') || code === 'STD' || code.includes('-STD') || code.includes(' STD')) {
    return 0;
  }

  const matchCodeMeasure = code.match(/(?:^|[\s\-_/.])(010|020|030|040|050|060|070|075|080|090|100|\.010|\.020|\.030|\.040|\.050|\.060)(?:[\s\-_/.]|$|[A-Z])/);
  if (matchCodeMeasure) {
    const numStr = matchCodeMeasure[1].replace('.', '');
    return parseInt(numStr, 10);
  }

  if (upper.includes('(STD)') || upper.includes(' STD ') || upper.endsWith(' STD') || upper === 'STD') {
    return 0;
  }

  const matchParen = upper.match(/\(\.?(\d{2,3})\)/);
  if (matchParen) return parseInt(matchParen[1], 10);

  const matchTrailing = upper.match(/\s(\d{3})(?:\s|$)/g);
  if (matchTrailing) {
    for (let i = matchTrailing.length - 1; i >= 0; i--) {
      const val = parseInt(matchTrailing[i].trim(), 10);
      if (val >= 10 && val <= 100) return val;
    }
  }

  return 9999;
}

export async function generateKitCatalogPDF({
  kit,
  items,
  bcvRate,
  bcvMultiplier = 1.4,
}: GenerateKitCatalogPDFOptions): Promise<{ fileName: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 32;
  const contentWidth = pageWidth - margin * 2; // ~531.28 pt

  const isTrenDelantero = kit.category?.toLowerCase() === 'tren delantero';
  const isMotor = kit.category?.toLowerCase() === 'motor';

  // Helper to get effective product image
  const getProductImage = (p?: Product | null): string | null => {
    if (!p) return null;
    if (p.image_url && p.image_url.trim()) return p.image_url.trim();
    if (p.image_urls && p.image_urls.length > 0 && p.image_urls[0]?.trim()) {
      return p.image_urls[0].trim();
    }
    return null;
  };

  // Filter items: ONLY products that have an associated image
  const validItems = items.filter((it) => {
    const p = it.products;
    return !!p && !!getProductImage(p);
  });

  if (validItems.length === 0) {
    throw new Error('NO_IMAGES');
  }

  // Group items by resolved category
  const groups: Record<string, KitCatalogItem[]> = {};
  validItems.forEach((it) => {
    const p = it.products!;
    const rawCat = p.categories?.name;
    const catName = isTrenDelantero
      ? resolveTrenDelanteroCategory(rawCat, p.name, p.code)
      : (rawCat || 'Repuestos y Accesorios');

    if (!groups[catName]) groups[catName] = [];
    groups[catName].push(it);
  });

  // Sort categories
  const sortedCategoryNames = Object.keys(groups).sort((a, b) => {
    if (isTrenDelantero) {
      const aRank = getTrenDelanteroCategoryRank(a);
      const bRank = getTrenDelanteroCategoryRank(b);
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b);
    }
    if (isMotor) {
      const aIdx = MOTOR_CATEGORY_ORDER.findIndex((c) => a.toLowerCase().includes(c));
      const bIdx = MOTOR_CATEGORY_ORDER.findIndex((c) => b.toLowerCase().includes(c));
      const aOrder = aIdx === -1 ? 999 : aIdx;
      const bOrder = bIdx === -1 ? 999 : bIdx;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    }
    return a.localeCompare(b);
  });

  // Sort items inside each category
  sortedCategoryNames.forEach((catName) => {
    const catItems = groups[catName];
    const shouldSortByMeasure = MEASURE_SORTED_CATEGORIES.some((c) => catName.toLowerCase().includes(c));

    catItems.sort((a, b) => {
      const pA = a.products!;
      const pB = b.products!;

      if (isTrenDelantero) {
        const brandA = pA.brands?.name || '';
        const brandB = pB.brands?.name || '';
        const aBrandRank = getBrandRank(brandA);
        const bBrandRank = getBrandRank(brandB);
        if (aBrandRank !== bBrandRank) return aBrandRank - bBrandRank;
      }

      if (shouldSortByMeasure) {
        const orderA = getMeasureOrder(pA.name, pA.code);
        const orderB = getMeasureOrder(pB.name, pB.code);
        if (orderA !== orderB) return orderA - orderB;
      }

      return (pA.name || '').localeCompare(pB.name || '');
    });
  });

  // Flatten items in final order to load images
  const orderedItems: KitCatalogItem[] = [];
  sortedCategoryNames.forEach((cat) => {
    orderedItems.push(...groups[cat]);
  });

  // Pre-load images concurrently with pool
  const [logoSotomayorBase64, vehicleBrandLogoBase64, ...productImagesBase64] = await Promise.all([
    loadImageAsBase64('/LogoRepuestosSotomayor.png', 240, 80),
    kit.vehicle_brands?.logo_url ? loadImageAsBase64(kit.vehicle_brands.logo_url, 120, 60) : Promise.resolve(null),
    ...await loadImagesInPool(
      orderedItems,
      async (it) => {
        const p = it.products;
        const imgUrl = getProductImage(p);
        if (!imgUrl) return null;
        return loadImageAsBase64(imgUrl, 80, 80);
      },
      6
    ),
  ]);

  // Image lookup map
  const itemImageMap = new Map<string, string | null>();
  orderedItems.forEach((it, idx) => {
    itemImageMap.set(it.id, productImagesBase64[idx] || null);
  });

  // Build Table Body with category separator headers
  const tableBody: any[] = [];
  const imageIndexByRow = new Map<number, string>();

  let availableCount = 0;
  let outOfStockCount = 0;

  sortedCategoryNames.forEach((catName) => {
    const catItems = groups[catName];
    if (!catItems || catItems.length === 0) return;

    // Category Header Banner Row
    const catRowIndex = tableBody.length;
    tableBody.push([
      {
        content: `  ${catName.toUpperCase()}  (${catItems.length} OPCI${catItems.length === 1 ? 'ÓN' : 'ONES'})`,
        colSpan: 7,
        styles: {
          fillColor: [15, 23, 42], // Slate 900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
          cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
        },
      },
    ]);

    catItems.forEach((it) => {
      const p = it.products!;
      const stock = p.stock ?? 0;
      if (stock > 0) availableCount++;
      else outOfStockCount++;

      const priceUsd = p.price_usd || 0;
      const priceUsdBcv = calculateBcvPrice(priceUsd, bcvMultiplier, p.categories?.name || p.name);

      const rowIndex = tableBody.length;
      const base64Img = itemImageMap.get(it.id);
      if (base64Img) {
        imageIndexByRow.set(rowIndex, base64Img);
      }

      tableBody.push([
        '', // Column 0: Image (rendered in didDrawCell)
        p.code || '—',
        p.name || 'Sin descripción',
        p.brands?.name || 'GENÉRICO',
        stock > 0 ? `DISPONIBLE\n(${stock})` : 'AGOTADO',
        formatUSD(priceUsd),
        `${formatUSD(priceUsdBcv)} BCV`,
      ]);
    });
  });

  // Draw Top Accent Stripe
  let y = 0;
  doc.setFillColor(...hexToRGB('#0f172a'));
  doc.rect(0, y, pageWidth, 5, 'F');
  doc.setFillColor(...hexToRGB('#10b981')); // Emerald highlight
  doc.rect(pageWidth * 0.25, y, pageWidth * 0.5, 5, 'F');
  y += 5;

  // Header Section
  y += 20;
  if (logoSotomayorBase64) {
    try {
      doc.addImage(logoSotomayorBase64, 'PNG', margin, y, 140, 44, undefined, 'FAST');
    } catch {
      // Fallback: Logo text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text('REPUESTOS SOTOMAYOR', margin, y + 20);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('REPUESTOS SOTOMAYOR', margin, y + 20);
  }

  // Right Header: Document Type Badge & Date
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const headerRightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('CATÁLOGO DE PRODUCTOS', headerRightX, y + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha: ${dateFormatted}`, headerRightX, y + 28, { align: 'right' });
  doc.text(`Tasa Referencial BCV: ${bcvRate.toFixed(2)}`, headerRightX, y + 40, { align: 'right' });

  y += 54;

  // Vehicle / Engine Title Box
  const boxX = margin;
  const boxY = y;
  const boxW = contentWidth;
  const boxH = 50;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(1);
  doc.roundedRect(boxX, boxY, boxW, boxH, 6, 6, 'FD');

  // Left Green Indicator Bar
  doc.setFillColor(...hexToRGB('#10b981'));
  doc.roundedRect(boxX, boxY, 4, boxH, 2, 2, 'F');

  // Vehicle Name & Category
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(kit.name.toUpperCase(), boxX + 14, boxY + 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const subtitle = [
    `Categoría: ${kit.category || 'General'}`,
    kit.description ? kit.description : null,
    `Total: ${validItems.length} repuestos (${availableCount} disponibles, ${outOfStockCount} agotados)`,
  ].filter(Boolean).join('  •  ');
  doc.text(subtitle, boxX + 14, boxY + 34);

  // Vehicle Brand Logo on the right side of the box
  if (vehicleBrandLogoBase64) {
    try {
      doc.addImage(vehicleBrandLogoBase64, 'PNG', boxX + boxW - 75, boxY + 8, 64, 34, undefined, 'FAST');
    } catch {
      // Skip if fails
    }
  }

  y += boxH + 12;

  // Table Columns Widths (Total: 531 pt)
  // 0: Foto (42)
  // 1: SKU / Código (74)
  // 2: Descripción (176)
  // 3: Marca (60)
  // 4: Estado (55)
  // 5: Divisas $ (60)
  // 6: BCV USD (64)

  autoTable(doc, {
    startY: y,
    head: [
      [
        'FOTO',
        'SKU / CÓDIGO',
        'DESCRIPCIÓN DEL REPUESTO',
        'MARCA',
        'ESTADO',
        'PRECIO ($)',
        'PRECIO BCV ($)',
      ],
    ],
    body: tableBody,
    margin: { left: margin, right: margin, top: 50, bottom: 45 },
    showHead: 'everyPage',
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      textColor: [30, 41, 59],
      lineWidth: 0,
      valign: 'middle',
      minCellHeight: 34,
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      minCellHeight: 24,
      cellPadding: { top: 7, bottom: 7, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 42, halign: 'center' },
      1: { cellWidth: 74, font: 'courier', fontStyle: 'bold', fontSize: 7.5, textColor: [71, 85, 105] },
      2: { cellWidth: 176, halign: 'left', fontStyle: 'bold' },
      3: { cellWidth: 60, halign: 'center', fontSize: 7.5, textColor: [100, 116, 139] },
      4: { cellWidth: 55, halign: 'center' },
      5: { cellWidth: 60, halign: 'right', fontStyle: 'bold', fontSize: 8.5 },
      6: { cellWidth: 64, halign: 'right', fontSize: 8, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawCell: (data) => {
      // 1. Skip completely on Category Header Banner Rows
      const isCategoryBanner = !!(data.row.raw as any)[0]?.colSpan;
      if (isCategoryBanner) return;

      // 2. Draw subtle bottom border on data rows
      if (data.section === 'body') {
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.5);
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }

      // 3. Draw product image in column 0 ONLY for actual product rows
      if (data.section === 'body' && data.column.index === 0) {
        const base64 = imageIndexByRow.get(data.row.index);
        if (base64) {
          try {
            const maxW = 30;
            const maxH = 26;
            const props = doc.getImageProperties(base64);
            const imgRatio = props.width / props.height;
            const boxRatio = maxW / maxH;

            let finalW = maxW;
            let finalH = maxH;
            if (imgRatio > boxRatio) {
              finalH = maxW / imgRatio;
            } else {
              finalW = maxH * imgRatio;
            }

            const imgX = data.cell.x + (data.cell.width - finalW) / 2;
            const imgY = data.cell.y + (data.cell.height - finalH) / 2;
            doc.addImage(base64, 'PNG', imgX, imgY, finalW, finalH, undefined, 'FAST');
          } catch {
            // Draw clean placeholder
          }
        } else {
          // Clean subtle rounded placeholder without ugly S/F text
          const boxSize = 20;
          const boxX = data.cell.x + (data.cell.width - boxSize) / 2;
          const boxY = data.cell.y + (data.cell.height - boxSize) / 2;
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.5);
          doc.roundedRect(boxX, boxY, boxSize, boxSize, 3, 3, 'FD');

          // Subtle minimalist image icon outline
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.6);
          doc.roundedRect(boxX + 3.5, boxY + 3.5, boxSize - 7, boxSize - 7, 1.5, 1.5, 'S');
          doc.setFillColor(203, 213, 225);
          doc.circle(boxX + 7.5, boxY + 7.5, 1, 'F');
        }
      }
    },
    didParseCell: (data) => {
      // Style headers
      if (data.section === 'head') {
        data.cell.styles.textColor = [255, 255, 255];
        if (data.column.index === 2) data.cell.styles.halign = 'left';
        if (data.column.index === 5 || data.column.index === 6) data.cell.styles.halign = 'right';
      }

      // Format Stock & Price cells
      if (data.section === 'body') {
        const isCategoryBanner = !!(data.row.raw as any)[0]?.colSpan;
        if (isCategoryBanner) return;

        // Stock / Status badge styling
        if (data.column.index === 4) {
          const text = String(data.cell.raw || '');
          if (text.includes('DISPONIBLE')) {
            data.cell.styles.textColor = [5, 150, 105]; // Emerald 600
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 7;
          } else if (text.includes('AGOTADO')) {
            data.cell.styles.textColor = [220, 38, 38]; // Red 600
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 7;
          }
        }

        // Divisa price styling
        if (data.column.index === 5) {
          data.cell.styles.textColor = [15, 23, 42]; // Slate 900
          data.cell.styles.fontStyle = 'bold';
        }

        // BCV Price styling
        if (data.column.index === 6) {
          data.cell.styles.textColor = [37, 99, 235]; // Blue 600
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Footer & Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom border line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 20,
      { align: 'right' }
    );
  }

  // Sanitize file name
  const cleanKitName = kit.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const fileName = `Catalogo-${cleanKitName}-${now.toISOString().slice(0, 10)}.pdf`;

  doc.save(fileName);
  return { fileName };
}

