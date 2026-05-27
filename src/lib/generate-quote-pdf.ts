import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote } from '@/types';
import { formatUSD } from '@/lib/utils';

interface GenerateQuotePDFOptions {
  quote: Quote;
  currency: 'usd' | 'bcv';
  bcvMultiplier?: number;
  returnBlob?: boolean;
}

// Helper to convert hex color to RGB array
function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// Load image as base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
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

export async function generateQuotePDF({ quote, currency, bcvMultiplier = 1, returnBlob = false }: GenerateQuotePDFOptions): Promise<{ fileName: string; blob?: Blob }> {
  const isBcv = currency === 'bcv';
  const rate = quote.bcv_rate || 1;
  const mult = isBcv ? bcvMultiplier : 1;
  const quoteNumber = quote.id.substring(0, 8).toUpperCase();

  const date = new Date(quote.created_at || '').toLocaleDateString('es-VE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Calculations
  const subtotalUsd = quote.quote_items?.reduce(
    (sum, item) => sum + (item.unit_price_usd || 0) * (item.quantity || 1), 0
  ) || 0;
  const subtotalUsdBcv = subtotalUsd * mult;
  const subtotalBs = subtotalUsdBcv * rate;

  // Colors
  const accentColor = isBcv ? '#2563eb' : '#10b981';
  const accentLight = isBcv ? '#3b82f6' : '#34d399';
  const darkBg: [number, number, number] = [15, 23, 42]; // #0f172a

  // Page dimensions (pt) — Letter-like
  const pageWidth = 595; // ~A4 width in pt
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // We'll calculate height dynamically, start with a temp doc
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
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
  const logoBase64 = await loadImageAsBase64('/LogoRepuestosSotomayor.png');
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin + 15, y - 4, 160, 52);
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
  const currLabel = isBcv ? 'BOLÍVARES (BCV)' : 'DÓLARES (USD)';
  const currBadgeW = 100;
  const currBadgeX = pageWidth - margin - currBadgeW;
  const currBadgeBg = isBcv ? hexToRGB('#dbeafe') : hexToRGB('#d1fae5');
  const currBadgeText = isBcv ? hexToRGB('#1d4ed8') : hexToRGB('#047857');
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
  const clientBoxH = 65;
  // Client box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  const clientBoxW = isBcv ? contentWidth - 200 : contentWidth;
  roundedRect(doc, margin, y, clientBoxW, clientBoxH, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('CLIENTE', margin + 16, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(quote.client_name || 'Cliente Mostrador', margin + 16, y + 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tel: ${quote.client_phone || 'No especificado'}`, margin + 16, y + 48);

  // BCV rate box (only for BCV)
  if (isBcv) {
    const bcvBoxX = margin + clientBoxW + 12;
    const bcvBoxW = contentWidth - clientBoxW - 12;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    roundedRect(doc, bcvBoxX, y, bcvBoxW, clientBoxH, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.text('TASA BCV', bcvBoxX + 16, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(29, 78, 216);
    doc.text(`Bs ${rate.toFixed(2)}`, bcvBoxX + 16, y + 36);
  }

  y += clientBoxH + 20;

  // ============================================================
  // ITEMS TABLE
  // ============================================================
  const items = quote.quote_items || [];

  // Pre-load brand logos
  const brandLogoCache: Record<string, string | null> = {};
  const uniqueLogoUrls = [...new Set(items.map(i => i.brand_logo_url).filter(Boolean))] as string[];
  await Promise.all(
    uniqueLogoUrls.map(async (url) => {
      brandLogoCache[url] = await loadImageAsBase64(url);
    })
  );

  // Prepare table data
  const tableHead = isBcv
    ? [['DESCRIPCIÓN', 'MARCA', 'CANT.', 'USD BCV', 'P. UNIT.', 'TOTAL']]
    : [['DESCRIPCIÓN', 'MARCA', 'CANT.', 'P. UNIT.', 'TOTAL']];

  const tableBody = items.map((item) => {
    const unitUsdBcv = (item.unit_price_usd || 0) * mult;
    const unitBs = unitUsdBcv * rate;
    const totalBs = unitBs * (item.quantity || 1);
    const totalUsd = (item.unit_price_usd || 0) * (item.quantity || 1);
    const brand = item.brand_name || '—';

    if (isBcv) {
      return [
        item.product_name || '',
        brand,
        String(item.quantity || 1),
        formatUSD(unitUsdBcv),
        formatBsVal(unitBs),
        formatBsVal(totalBs),
      ];
    } else {
      return [
        item.product_name || '',
        brand,
        String(item.quantity || 1),
        formatUSD(item.unit_price_usd || 0),
        formatUSD(totalUsd),
      ];
    }
  });

  const colStyles: Record<number, Partial<{ cellWidth: number; halign: 'left' | 'center' | 'right' }>> = isBcv
    ? {
        0: { halign: 'left' },
        1: { cellWidth: 80, halign: 'center' },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 60, halign: 'right' },
        4: { cellWidth: 70, halign: 'right' },
        5: { cellWidth: 70, halign: 'right' },
      }
    : {
        0: { halign: 'left' },
        1: { cellWidth: 80, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 75, halign: 'right' },
        4: { cellWidth: 75, halign: 'right' },
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
      cellPadding: { top: 8, bottom: 8, left: 10, right: 10 },
      textColor: [30, 41, 59],
      lineWidth: 0,
    },
    headStyles: {
      fillColor: darkBg,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 10, bottom: 10, left: 10, right: 10 },
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
            const imgW = 44;
            const imgH = 22;
            const imgX = data.cell.x + (data.cell.width - imgW) / 2;
            const imgY = data.cell.y + (data.cell.height - imgH) / 2;
            doc.addImage(brandLogoCache[logoUrl]!, 'PNG', imgX, imgY, imgW, imgH);
          } catch {
            // Fallback: text already rendered
          }
        }
      }
    },
    didParseCell: (data) => {
      // Make USD BCV column green in body
      if (isBcv && data.section === 'body' && data.column.index === 3) {
        data.cell.styles.textColor = hexToRGB('#10b981');
        data.cell.styles.fontStyle = 'bold';
      }
      // Make USD BCV header green
      if (isBcv && data.section === 'head' && data.column.index === 3) {
        data.cell.styles.textColor = hexToRGB('#34d399');
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
      // Bold the total column
      const totalColIdx = isBcv ? 5 : 4;
      if (data.section === 'body' && data.column.index === totalColIdx) {
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
  const totalsBoxW = 240;
  const totalsX = pageWidth - margin - totalsBoxW;

  if (isBcv) {
    // Subtotal Bs row
    const rowH = 28;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    roundedRect(doc, totalsX, y, totalsBoxW, rowH * 2 + 38, 6, 'FD');

    // Subtotal Bs
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal Bs:', totalsX + 14, y + 19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(formatBsVal(subtotalBs), totalsX + totalsBoxW - 14, y + 19, { align: 'right' });
    doc.setDrawColor(241, 245, 249);
    doc.line(totalsX + 8, y + rowH, totalsX + totalsBoxW - 8, y + rowH);

    // Ref. USD BCV
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Ref. USD BCV:', totalsX + 14, y + rowH + 19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRGB('#10b981'));
    doc.text(formatUSD(subtotalUsdBcv), totalsX + totalsBoxW - 14, y + rowH + 19, { align: 'right' });

    // Total dark bar
    const totalBarY = y + rowH * 2 + 2;
    const totalBarH = 36;
    // Draw dark rounded bottom
    doc.setFillColor(...darkBg);
    doc.rect(totalsX, totalBarY, totalsBoxW, totalBarH, 'F');
    // Round bottom corners
    doc.setFillColor(...darkBg);
    roundedRect(doc, totalsX, totalBarY, totalsBoxW, totalBarH, 6, 'F');
    // Cover top corners (they should be straight)
    doc.rect(totalsX, totalBarY, totalsBoxW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Total Bs:', totalsX + 14, totalBarY + 23);
    doc.setFontSize(15);
    doc.setTextColor(...hexToRGB(accentLight));
    doc.text(formatBsVal(subtotalBs), totalsX + totalsBoxW - 14, totalBarY + 23, { align: 'right' });

    y = totalBarY + totalBarH + 20;
  } else {
    // USD mode — simpler
    const rowH = 28;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    roundedRect(doc, totalsX, y, totalsBoxW, rowH + 38, 6, 'FD');

    // Subtotal
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', totalsX + 14, y + 19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(formatUSD(subtotalUsd), totalsX + totalsBoxW - 14, y + 19, { align: 'right' });

    // Total dark bar
    const totalBarY = y + rowH + 2;
    const totalBarH = 36;
    doc.setFillColor(...darkBg);
    roundedRect(doc, totalsX, totalBarY, totalsBoxW, totalBarH, 6, 'F');
    doc.rect(totalsX, totalBarY, totalsBoxW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Total USD:', totalsX + 14, totalBarY + 23);
    doc.setFontSize(15);
    doc.setTextColor(...hexToRGB(accentLight));
    doc.text(formatUSD(subtotalUsd), totalsX + totalsBoxW - 14, totalBarY + 23, { align: 'right' });

    y = totalBarY + totalBarH + 20;
  }

  // ============================================================
  // FOOTER
  // ============================================================
  // Footer separator line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('* Los precios están sujetos a cambio sin previo aviso. Cotización válida por 24 horas.', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.text('Gracias por preferir a Repuestos Sotomayor.', margin, y);

  // Page badge
  doc.setFillColor(241, 245, 249);
  const pageBadgeW = 70;
  const pageBadgeH = 18;
  const pageBadgeX = pageWidth - margin - pageBadgeW;
  roundedRect(doc, pageBadgeX, y - 12, pageBadgeW, pageBadgeH, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Página 1 de 1', pageBadgeX + pageBadgeW / 2, y + 1, { align: 'center' });
  y += 20;

  // ============================================================
  // ACCENT BAR BOTTOM
  // ============================================================
  doc.setFillColor(...hexToRGB(accentColor));
  doc.rect(0, y, pageWidth, 4, 'F');
  doc.setFillColor(...darkBg);
  doc.rect(0, y, pageWidth * 0.2, 4, 'F');
  doc.rect(pageWidth * 0.8, y, pageWidth * 0.2, 4, 'F');

  const suffix = currency === 'bcv' ? '_Bs' : '_USD';
  const fileName = `Cotizacion${suffix}_${quote.client_name?.replace(/\s+/g, '_') || 'Mostrador'}_${quote.id.substring(0, 6)}.pdf`;
  
  if (returnBlob) {
    const blob = doc.output('blob');
    return { fileName, blob };
  }
  
  doc.save(fileName);
  return { fileName };
}
