import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote } from '@/types';
import { formatUSD, calculateBcvPrice } from '@/lib/utils';
import { sortQuoteItems } from '@/lib/tren-delantero';

interface GenerateQuotePDFOptions {
  quote: Quote;
  currency: 'usd' | 'bcv' | 'both';
  bcvMultiplier?: number;
  returnBlob?: boolean;
  randomPhrase?: string;
  bcvRate?: number;
}

// Helper to convert hex color to RGB array
function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// Load image as base64 and resize using Canvas
async function loadImageAsBase64(
  url: string,
  maxWidth?: number,
  maxHeight?: number
): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // If no dimensions are given, convert directly to base64
    if (!maxWidth && !maxHeight) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        
        let width = img.width;
        let height = img.height;
        
        if (maxWidth && width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (maxHeight && height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        // Use PNG to preserve transparency
        const base64 = canvas.toDataURL('image/png');
        resolve(base64);
      };
      img.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

function formatBsVal(val: number): string {
  return `Bs ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Draw a rounded rectangle
function roundedRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number, r: number,
  style: 'S' | 'F' | 'FD' = 'F'
) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

export async function generateQuotePDF({ quote, currency, bcvMultiplier = 1, returnBlob = false, randomPhrase, bcvRate }: GenerateQuotePDFOptions): Promise<{ fileName: string; blob?: Blob }> {
  const isBcv = currency === 'bcv';
  const isBoth = currency === 'both';
  const rate = bcvRate || quote.bcv_rate || 1;
  const mult = (isBcv || isBoth) ? bcvMultiplier : 1;
  const quoteNumber = quote.id.substring(0, 8).toUpperCase();

  const date = new Date(quote.created_at || '').toLocaleDateString('es-VE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Calculations
  const subtotalUsd = quote.quote_items?.reduce(
    (sum, item) => sum + (item.unit_price_usd || 0) * (item.quantity || 1), 0
  ) || 0;
  const subtotalUsdBcv = (isBcv || isBoth)
    ? (quote.quote_items?.reduce(
        (sum, item) => sum + calculateBcvPrice(item.unit_price_usd || 0, mult) * (item.quantity || 1), 0
      ) || 0)
    : subtotalUsd;
  const subtotalBs = subtotalUsdBcv * rate;

  // Colors
  const accentColor = isBoth ? '#0f172a' : (isBcv ? '#2563eb' : '#10b981');
  const accentLight = isBoth ? '#38bdf8' : (isBcv ? '#3b82f6' : '#34d399');
  const darkBg: [number, number, number] = [15, 23, 42]; // #0f172a

  // Page dimensions (pt) — Letter-like
  const pageWidth = 595; // ~A4 width in pt
  const pageHeight = 842; // ~A4 height in pt
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // We'll calculate height dynamically, start with a temp doc
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  let y = 0;

  // ============================================================
  // ACCENT BAR TOP
  // ============================================================
  doc.setFillColor(...hexToRGB(accentColor));
  doc.rect(0, y, pageWidth, 5, 'F');
  // Overlay dark sides
  doc.setFillColor(...darkBg);
  doc.rect(0, y, pageWidth * 0.2, 5, 'F');
  doc.rect(pageWidth * 0.8, y, pageWidth * 0.2, 5, 'F');
  y += 5;

  // ============================================================
  // HEADER
  // ============================================================
  const headerY = y;
  y += 28;

  // Try to load logo (larger, no text)
  const logoBase64 = await loadImageAsBase64('/LogoRepuestosSotomayor.png', 320, 120);
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin + 15, y - 4, 160, 52, undefined, 'FAST');
    } catch {
      // Logo failed to load, skip
    }
  }

  // Right side — Badges
  const badgeY = y;

  // "COTIZACIÓN" badge
  const cotBadgeW = 90;
  const cotBadgeH = 22;
  const cotBadgeX = pageWidth - margin - cotBadgeW;
  doc.setFillColor(...darkBg);
  roundedRect(doc, cotBadgeX - 110, badgeY, cotBadgeW, cotBadgeH, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('COTIZACIÓN', cotBadgeX - 110 + cotBadgeW / 2, badgeY + 15, { align: 'center' });

  // Currency badge
  const currLabel = isBoth ? 'DIVISAS Y BOLÍVARES' : (isBcv ? 'BOLÍVARES (BCV)' : 'DÓLARES (USD)');
  const currBadgeW = isBoth ? 120 : 100;
  const currBadgeX = pageWidth - margin - currBadgeW;
  const currBadgeBg = isBoth ? hexToRGB('#e2e8f0') : (isBcv ? hexToRGB('#dbeafe') : hexToRGB('#d1fae5'));
  const currBadgeText = isBoth ? hexToRGB('#1e293b') : (isBcv ? hexToRGB('#1d4ed8') : hexToRGB('#047857'));
  doc.setFillColor(...currBadgeBg);
  roundedRect(doc, currBadgeX, badgeY, currBadgeW, cotBadgeH, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...currBadgeText);
  doc.text(currLabel, currBadgeX + currBadgeW / 2, badgeY + 14, { align: 'center' });

  // Quote number and date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`N° ${quoteNumber}`, pageWidth - margin, badgeY + 36, { align: 'right' });
  doc.text(date, pageWidth - margin, badgeY + 48, { align: 'right' });

  y = headerY + 80;

  // Header bottom line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // ============================================================
  // CLIENT INFO
  // ============================================================
  const clientBoxH = 62;
  const clientBoxW = (isBcv || isBoth) ? contentWidth - 195 : contentWidth;
  
  // Client box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  roundedRect(doc, margin, y, clientBoxW, clientBoxH, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DATOS DEL CLIENTE', margin + 16, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(quote.client_name || 'Cliente Mostrador', margin + 16, y + 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tel: ${quote.client_phone || 'No especificado'}`, margin + 16, y + 49);

  // BCV rate box (only for BCV / Both)
  if (isBcv || isBoth) {
    const bcvBoxX = margin + clientBoxW + 12;
    const bcvBoxW = contentWidth - clientBoxW - 12;
    doc.setFillColor(240, 247, 255);
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.5);
    roundedRect(doc, bcvBoxX, y, bcvBoxW, clientBoxH, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(29, 78, 216);
    doc.text('TASA OFICIAL BCV', bcvBoxX + 14, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text(`Bs ${rate.toFixed(2)}`, bcvBoxX + 14, y + 37);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(59, 130, 246);
    doc.text('Vigencia: 24h · Tasa oficial del día', bcvBoxX + 14, y + 50);
  }

  y += clientBoxH + 18;

  // ============================================================
  // ITEMS TABLE
  // ============================================================
  const items = sortQuoteItems(quote.quote_items || []);

  // Pre-load brand logos
  const brandLogoCache: Record<string, string | null> = {};
  const uniqueLogoUrls = [...new Set(items.map(i => i.brand_logo_url).filter(Boolean))] as string[];
  await Promise.all(
    uniqueLogoUrls.map(async (url) => {
      brandLogoCache[url] = await loadImageAsBase64(url, 100, 50);
    })
  );

  // Prepare table data (5 columns)
  const tableHead = isBoth
    ? [['DESCRIPCIÓN', 'MARCA', 'CANT.', 'TOTAL DIVISAS ($)', 'TOTAL EN DÓLARES BCV']]
    : isBcv
    ? [['DESCRIPCIÓN', 'MARCA', 'CANT.', 'TOTAL EN DÓLARES BCV', 'TOTAL EN VES']]
    : [['DESCRIPCIÓN', 'MARCA', 'CANT.', 'P. UNITARIO ($)', 'TOTAL DIVISAS ($)']];

  const tableBody = items.map((item) => {
    const unitDivisas = item.unit_price_usd || 0;
    const totalDivisas = unitDivisas * (item.quantity || 1);
    const unitUsdBcv = (isBcv || isBoth)
      ? calculateBcvPrice(unitDivisas, mult)
      : unitDivisas;
    const totalUsdBcv = unitUsdBcv * (item.quantity || 1);
    const totalBs = totalUsdBcv * rate;
    const brand = item.brand_name || '—';

    if (isBoth) {
      return [
        item.product_name || '',
        brand,
        String(item.quantity || 1),
        formatUSD(totalDivisas),
        formatUSD(totalUsdBcv),
      ];
    } else if (isBcv) {
      return [
        item.product_name || '',
        brand,
        String(item.quantity || 1),
        formatUSD(totalUsdBcv),
        formatBsVal(totalBs),
      ];
    } else {
      return [
        item.product_name || '',
        brand,
        String(item.quantity || 1),
        formatUSD(unitDivisas),
        formatUSD(totalDivisas),
      ];
    }
  });

  const colStyles: Record<number, Partial<{ cellWidth: number; halign: 'left' | 'center' | 'right' }>> = isBoth
    ? {
        0: { halign: 'left' },
        1: { cellWidth: 70, halign: 'center' },
        2: { cellWidth: 42, halign: 'center' },
        3: { cellWidth: 95, halign: 'center' },
        4: { cellWidth: 105, halign: 'center' },
      }
    : isBcv
    ? {
        0: { halign: 'left' },
        1: { cellWidth: 70, halign: 'center' },
        2: { cellWidth: 42, halign: 'center' },
        3: { cellWidth: 100, halign: 'center' },
        4: { cellWidth: 100, halign: 'center' },
      }
    : {
        0: { halign: 'left' },
        1: { cellWidth: 80, halign: 'center' },
        2: { cellWidth: 44, halign: 'center' },
        3: { cellWidth: 90, halign: 'center' },
        4: { cellWidth: 90, halign: 'center' },
      };

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 6, right: 6 },
      textColor: [30, 41, 59],
      lineWidth: 0,
      halign: 'center',
    },
    headStyles: {
      fillColor: darkBg,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 9, bottom: 9, left: 6, right: 6 },
      halign: 'center',
    },
    columnStyles: colStyles,
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawCell: (data) => {
      // Draw bottom border for body rows
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
      // Draw brand logo in brand column
      if (data.section === 'body' && data.column.index === 1) {
        const item = items[data.row.index];
        const logoUrl = item?.brand_logo_url;
        if (logoUrl && brandLogoCache[logoUrl]) {
          try {
            const maxW = 56;
            const maxH = 22;
            
            const props = doc.getImageProperties(brandLogoCache[logoUrl]!);
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
            
            doc.addImage(brandLogoCache[logoUrl]!, 'PNG', imgX, imgY, finalW, finalH, undefined, 'FAST');
          } catch {
            // Fallback: text already rendered
          }
        }
      }
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.textColor = [255, 255, 255]; // Crisp pure white header
        data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
      }

      if (data.section === 'body') {
        data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
        if (isBoth) {
          if (data.column.index === 3) {
            data.cell.styles.textColor = hexToRGB('#059669'); // emerald
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 4) {
            data.cell.styles.textColor = hexToRGB('#0f172a'); // dark slate
            data.cell.styles.fontStyle = 'bold';
          }
        } else if (isBcv) {
          if (data.column.index === 3) {
            data.cell.styles.textColor = hexToRGB('#059669');
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 4) {
            data.cell.styles.textColor = hexToRGB('#2563eb');
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }

      // Brand column styling — hide text if logo available, show as fallback
      if (data.section === 'body' && data.column.index === 1) {
        const item = items[data.row.index];
        const logoUrl = item?.brand_logo_url;
        if (logoUrl && brandLogoCache[logoUrl]) {
          // Hide text, logo will be drawn in didDrawCell
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontSize = 1;
        } else {
          data.cell.styles.fontSize = 7;
          data.cell.styles.textColor = [100, 116, 139];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Bold the total column for USD mode
      if (!isBoth && !isBcv && data.section === 'body' && data.column.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

  // Get Y position after table
  y = (doc as any).lastAutoTable.finalY + 16;

  // ============================================================
  // TOTALS BOX
  // ============================================================
  const neededHeight = isBoth ? 130 : 90;
  if (y + neededHeight > pageHeight - 80) {
    doc.addPage();
    y = margin + 20;
  }

  const totalsBoxW = 280;
  const totalsX = pageWidth - margin - totalsBoxW;

  if (isBoth) {
    // Card 1: Opción Pago en Divisas
    const card1H = 46;
    doc.setFillColor(240, 253, 244); // soft emerald
    doc.setDrawColor(187, 247, 208); // border emerald-200
    doc.setLineWidth(0.75);
    roundedRect(doc, totalsX, y, totalsBoxW, card1H, 6, 'FD');

    // Left indicator bar
    doc.setFillColor(5, 150, 105);
    doc.rect(totalsX, y, 4, card1H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(4, 120, 87);
    doc.text('OPCIÓN 1: PAGO EN DIVISAS (EFECTIVO / ZELLE)', totalsX + 14, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Total neto en divisas:', totalsX + 14, y + 33);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(4, 120, 87);
    doc.text(formatUSD(subtotalUsd), totalsX + totalsBoxW - 14, y + 32, { align: 'right' });

    // Card 2: Opción Pago en Bolívares (Tasa BCV)
    const card2Y = y + card1H + 10;
    const card2H = 58;

    doc.setFillColor(...darkBg); // Dark navy
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.75);
    roundedRect(doc, totalsX, card2Y, totalsBoxW, card2H, 6, 'FD');

    // Left indicator bar
    doc.setFillColor(59, 130, 246);
    doc.rect(totalsX, card2Y, 4, card2H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text('OPCIÓN 2: PAGO EN BOLÍVARES (TASA BCV)', totalsX + 14, card2Y + 15);

    // High contrast Ref Badge Box
    const badgeW = totalsBoxW - 28;
    const badgeH = 17;
    const badgeY = card2Y + 20;
    doc.setFillColor(30, 41, 59); // slate-800
    doc.setDrawColor(51, 65, 85); // slate-700
    doc.setLineWidth(0.5);
    roundedRect(doc, totalsX + 14, badgeY, badgeW, badgeH, 3, 'FD');

    // Ref text inside badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255); // pure white
    doc.text('Ref:', totalsX + 20, badgeY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(52, 211, 153); // bright emerald #34d399
    doc.text(formatUSD(subtotalUsdBcv), totalsX + 44, badgeY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(147, 197, 253); // sky-300
    doc.text(`Tasa: Bs ${rate.toFixed(2)}`, totalsX + totalsBoxW - 20, badgeY + 12, { align: 'right' });

    // Total VES bottom line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text('TOTAL EN VES:', totalsX + 14, card2Y + 50);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(formatBsVal(subtotalBs), totalsX + totalsBoxW - 14, card2Y + 50, { align: 'right' });

    y = card2Y + card2H + 20;
  } else if (isBcv) {
    const rowH = 32;
    const cardH = rowH + 42;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    roundedRect(doc, totalsX, y, totalsBoxW, cardH, 6, 'FD');

    // Ref. USD BCV - larger & higher contrast
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // dark navy/slate
    doc.text(`Ref. Total en USD al BCV:`, totalsX + 14, y + 20);
    doc.setFontSize(12);
    doc.setTextColor(5, 150, 105);
    doc.text(formatUSD(subtotalUsdBcv), totalsX + totalsBoxW - 14, y + 20, { align: 'right' });

    // Total dark bar
    const totalBarY = y + rowH;
    const totalBarH = 42;
    doc.setFillColor(...darkBg);
    roundedRect(doc, totalsX, totalBarY, totalsBoxW, totalBarH, 6, 'F');
    doc.rect(totalsX, totalBarY, totalsBoxW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL EN VES:', totalsX + 14, totalBarY + 26);
    doc.setFontSize(15);
    doc.setTextColor(...hexToRGB(accentLight));
    doc.text(formatBsVal(subtotalBs), totalsX + totalsBoxW - 14, totalBarY + 26, { align: 'right' });

    y = totalBarY + totalBarH + 20;
  } else {
    // USD mode
    const rowH = 28;
    const cardH = rowH + 42;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    roundedRect(doc, totalsX, y, totalsBoxW, cardH, 6, 'FD');

    // Subtotal
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal Divisas:', totalsX + 14, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(formatUSD(subtotalUsd), totalsX + totalsBoxW - 14, y + 18, { align: 'right' });

    // Total dark bar
    const totalBarY = y + rowH;
    const totalBarH = 42;
    doc.setFillColor(...darkBg);
    roundedRect(doc, totalsX, totalBarY, totalsBoxW, totalBarH, 6, 'F');
    doc.rect(totalsX, totalBarY, totalsBoxW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL DIVISAS ($):', totalsX + 14, totalBarY + 26);
    doc.setFontSize(15);
    doc.setTextColor(...hexToRGB(accentLight));
    doc.text(formatUSD(subtotalUsd), totalsX + totalsBoxW - 14, totalBarY + 26, { align: 'right' });

    y = totalBarY + totalBarH + 20;
  }

  // ============================================================
  // FOOTER & MULTI-PAGE NUMBERING
  // ============================================================
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  const WHATSAPP_PHRASES = [
    "La pasión por servirte es el motor que nunca se apaga.",
    "Tu confianza es el combustible; nuestra vocación, el motor.",
    "Encendemos cada jornada con la meta de darte el mejor rendimiento.",
    "Más que piezas de recambio, entregamos la potencia de un servicio comprometido.",
    "Aceleramos soluciones para que tus proyectos nunca se detengan.",
    "Alineamos cada detalle de nuestra atención a la altura de tu camino.",
    "La tracción que necesitas para avanzar con total seguridad.",
    "Calidad en cada repuesto, dirección firme en cada asesoría.",
    "Sincronizamos nuestra dedicación para mantener tu marcha perfecta.",
    "Atención precisa y repuestos firmes: el engranaje de tu tranquilidad.",
    "Tu satisfacción es la fuerza que mueve cada uno de nuestros engranajes.",
    "Ajustamos cada solución con la precisión que tu trabajo merece."
  ];
  const footerPhrase = randomPhrase || WHATSAPP_PHRASES[Math.floor(Math.random() * WHATSAPP_PHRASES.length)];

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`"${footerPhrase}"`, pageWidth / 2, y + 4, { align: 'center' });

  // Store information trust line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Repuestos Sotomayor · Especialistas en Repuestos Automotrices · Cotización emitida por sistema', pageWidth / 2, y + 16, { align: 'center' });

  // Number all pages at standard bottom position
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Bottom Accent Bar on every page
    doc.setFillColor(...hexToRGB(accentColor));
    doc.rect(0, 836, pageWidth, 4, 'F');
    doc.setFillColor(...darkBg);
    doc.rect(0, 836, pageWidth * 0.2, 4, 'F');
    doc.rect(pageWidth * 0.8, 836, pageWidth * 0.2, 4, 'F');

    // Page badge
    doc.setFillColor(241, 245, 249);
    const pageBadgeW = 70;
    const pageBadgeH = 16;
    const pageBadgeX = pageWidth - margin - pageBadgeW;
    roundedRect(doc, pageBadgeX, 814, pageBadgeW, pageBadgeH, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${i} de ${totalPages}`, pageBadgeX + pageBadgeW / 2, 825, { align: 'center' });
  }

  const suffix = isBoth ? '_USD_Bs' : (currency === 'bcv' ? '_Bs' : '_USD');
  const fileName = `Cotizacion${suffix}_${quote.client_name?.replace(/\s+/g, '_') || 'Mostrador'}_${quote.id.substring(0, 6)}.pdf`;
  
  if (returnBlob) {
    const blob = doc.output('blob');
    return { fileName, blob };
  }
  
  doc.save(fileName);
  return { fileName };
}
