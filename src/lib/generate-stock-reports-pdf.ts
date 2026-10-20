import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product } from '@/types';

interface GenerateStockReportOptions {
  products: Product[];
  filterTitle?: string;
  getEffectiveMinStock: (product: Product) => { min: number; isGlobal: boolean };
}

// Convert hex color to RGB array
function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// Load image as base64
async function loadImageAsBase64(url: string, maxWidth?: number, maxHeight?: number): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
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
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * REPORTE 1: Verificación y Conteo de Stock Físico (Auditoría en Almacén)
 * Diseñado para imprimir y contar a mano con lápiz en estanterías.
 */
export async function generatePhysicalAuditReportPDF({
  products,
  filterTitle = 'Todos en Alerta',
  getEffectiveMinStock,
}: GenerateStockReportOptions): Promise<{ fileName: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 35;
  const contentWidth = pageWidth - margin * 2;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const logoBase64 = await loadImageAsBase64('/LogoRepuestosSotomayor.png', 240, 80);

  // Table Data
  const tableHead = [
    [
      '#',
      'SKU / CÓDIGO',
      'DESCRIPCIÓN / APLICACIÓN',
      'MARCA',
      'SISTEMA',
      'MÍNIMO',
      'CONTEO FÍSICO',
      'ESTADO',
    ],
  ];

  const tableBody = products.map((p, index) => {
    const { min: minStock } = getEffectiveMinStock(p);
    const stockVal = p.stock ?? 0;
    const brandName = p.brands?.name || 'GENÉRICO';
    return [
      String(index + 1),
      p.code || 'S/C',
      p.name || 'Sin nombre',
      brandName,
      String(stockVal),
      String(minStock > 0 ? minStock : '—'),
      '[   ___   ]', // Box for writing physical count
      '[ ] OK  [ ] DIF',
    ];
  });

  autoTable(doc, {
    startY: 110,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin, top: 90, bottom: 65 },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' }, // #
      1: { cellWidth: 78, font: 'courier', fontStyle: 'bold' }, // SKU
      2: { cellWidth: 165 }, // Descripción
      3: { cellWidth: 60, halign: 'center', fontSize: 7.5 }, // Marca
      4: { cellWidth: 46, halign: 'center', fontStyle: 'bold' }, // Sistema
      5: { cellWidth: 44, halign: 'center', textColor: [180, 83, 9] }, // Mínimo
      6: { cellWidth: 60, halign: 'center', font: 'courier', fontStyle: 'bold', textColor: [15, 23, 42] }, // Conteo
      7: { cellWidth: 50, halign: 'center', fontSize: 7 }, // Estado
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Header top bar
      doc.setFillColor(...hexToRGB('#0f172a'));
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFillColor(...hexToRGB('#0284c7')); // Blue accent
      doc.rect(margin, 0, 100, 4, 'F');

      // Logo or text brand
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', margin, 12, 110, 36, undefined, 'FAST');
        } catch {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text('REPUESTOS SOTOMAYOR', margin, 32);
        }
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('REPUESTOS SOTOMAYOR', margin, 32);
      }

      // Title & Subtitle
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('REPORTE DE VERIFICACIÓN Y CONTEO FÍSICO', pageWidth - margin, 24, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(2, 132, 199); // Blue
      doc.text('AUDITORÍA DE STOCK MÍNIMO Y ALMACÉN', pageWidth - margin, 38, { align: 'right' });

      // Info metadata row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const metaText = `Fecha: ${dateFormatted} ${timeFormatted}   |   Filtro: ${filterTitle}   |   Total Ítems: ${products.length}`;
      doc.text(metaText, pageWidth - margin, 52, { align: 'right' });

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(margin, 60, pageWidth - margin, 60);

      // Footer
      const footerY = pageHeight - 24;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Sotomayor Repuestos - Documento de Control Interno para Auditoría de Inventario', margin, footerY);
    },
  });

  // Signoff Box on the final page
  const finalY = (doc as any).lastAutoTable?.finalY || 600;
  let signY = finalY + 25;

  // If not enough space on current page for sign box (need at least 70pt), add a page
  if (signY + 65 > pageHeight - 50) {
    doc.addPage();
    signY = 80;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, signY, contentWidth, 55, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('CONSTANCIA DE CONTEO FÍSICO:', margin + 12, signY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);

  // Signature lines
  const col1X = margin + 12;
  const col2X = margin + contentWidth * 0.4;
  const col3X = margin + contentWidth * 0.72;
  const lineY = signY + 40;

  doc.text('Responsable del Conteo: _______________________', col1X, lineY);
  doc.text('Firma: ___________________', col2X, lineY);
  doc.text('Fecha Realizado: ____/____/2026', col3X, lineY);

  // Numeración exacta de páginas y aseguramiento de pie de página (Pase 2)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 24;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Sotomayor Repuestos - Documento de Control Interno para Auditoría de Inventario', margin, footerY);

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  const cleanFilterName = filterTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Reporte_Conteo_Fisico_${cleanFilterName}_${dateFormatted.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);

  return { fileName };
}

/**
 * REPORTE 2: Orden de Reposición y Lista de Pedido
 * Genera la lista limpia para compras/proveedores SIN costos ni precios.
 */
export async function generatePurchaseOrderReportPDF({
  products,
  filterTitle = 'Todos en Alerta',
  getEffectiveMinStock,
}: GenerateStockReportOptions): Promise<{ fileName: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 35;
  const contentWidth = pageWidth - margin * 2;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const logoBase64 = await loadImageAsBase64('/LogoRepuestosSotomayor.png', 240, 80);

  // Table Data
  const tableHead = [
    [
      '#',
      'SKU / CÓDIGO',
      'DESCRIPCIÓN DEL PRODUCTO',
      'MARCA',
      'EXISTENCIA',
      'STOCK MÍN.',
      'CANT. A PEDIR',
      'OBSERVACIONES / PROVEEDOR',
    ],
  ];

  const tableBody = products.map((p, index) => {
    const { min: minStock } = getEffectiveMinStock(p);
    const stockVal = p.stock ?? 0;
    const brandName = p.brands?.name || 'GENÉRICO';
    return [
      String(index + 1),
      p.code || 'S/C',
      p.name || 'Sin nombre',
      brandName,
      String(stockVal),
      String(minStock > 0 ? minStock : '—'),
      '[    ____    ]', // Field for buyer/supplier to annotate the quantity to order
      '', // Blank note line
    ];
  });

  autoTable(doc, {
    startY: 110,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin, top: 90, bottom: 65 },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [180, 83, 9], // Amber 700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' }, // #
      1: { cellWidth: 78, font: 'courier', fontStyle: 'bold' }, // SKU
      2: { cellWidth: 175 }, // Descripción
      3: { cellWidth: 60, halign: 'center', fontSize: 7.5 }, // Marca
      4: { cellWidth: 50, halign: 'center', fontStyle: 'bold' }, // Existencia
      5: { cellWidth: 50, halign: 'center', textColor: [180, 83, 9] }, // Mínimo
      6: { cellWidth: 55, halign: 'center', font: 'courier', fontStyle: 'bold', textColor: [15, 23, 42] }, // Cantidad a Pedir
      7: { cellWidth: 35, halign: 'left' }, // Observaciones
    },
    alternateRowStyles: {
      fillColor: [254, 252, 248], // Warm subtle alternate
    },
    didDrawPage: (data) => {
      // Header top bar
      doc.setFillColor(...hexToRGB('#b45309')); // Amber
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFillColor(...hexToRGB('#0f172a'));
      doc.rect(margin, 0, 100, 4, 'F');

      // Logo or text brand
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', margin, 12, 110, 36, undefined, 'FAST');
        } catch {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text('REPUESTOS SOTOMAYOR', margin, 32);
        }
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('REPUESTOS SOTOMAYOR', margin, 32);
      }

      // Title & Subtitle
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(180, 83, 9); // Amber
      doc.text('ORDEN DE REPOSICIÓN Y PEDIDO', pageWidth - margin, 24, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('REQUERIMIENTO DE COMPRA POR STOCK MÍNIMO', pageWidth - margin, 38, { align: 'right' });

      // Info metadata row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const metaText = `Fecha: ${dateFormatted} ${timeFormatted}   |   Filtro: ${filterTitle}   |   Total Requeridos: ${products.length}`;
      doc.text(metaText, pageWidth - margin, 52, { align: 'right' });

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(margin, 60, pageWidth - margin, 60);

      // Footer
      const footerY = pageHeight - 24;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Sotomayor Repuestos - Documento de Solicitud de Pedido y Reposición de Almacén', margin, footerY);
    },
  });

  // Signoff Box on the final page
  const finalY = (doc as any).lastAutoTable?.finalY || 600;
  let signY = finalY + 25;

  if (signY + 65 > pageHeight - 50) {
    doc.addPage();
    signY = 80;
  }

  doc.setFillColor(254, 252, 248);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, signY, contentWidth, 55, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text('AUTORIZACIÓN Y APROBACIÓN DE PEDIDO:', margin + 12, signY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);

  const col1X = margin + 12;
  const col2X = margin + contentWidth * 0.4;
  const col3X = margin + contentWidth * 0.72;
  const lineY = signY + 40;

  doc.text('Solicitado por: _______________________', col1X, lineY);
  doc.text('Aprobado por: _______________________', col2X, lineY);
  doc.text('Fecha Envío a Proveedor: ____/____/2026', col3X, lineY);

  // Numeración exacta de páginas y aseguramiento de pie de página (Pase 2)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 24;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Sotomayor Repuestos - Documento de Solicitud de Pedido y Reposición de Almacén', margin, footerY);

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  const cleanFilterName = filterTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Orden_Pedido_${cleanFilterName}_${dateFormatted.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);

  return { fileName };
}
