'use client';

import { useState, useEffect } from 'react';
import { ImportExcelDialog } from '@/components/settings/import-excel-dialog';
import { ImportStockDialog } from '@/components/settings/import-stock-dialog';
import { FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useBcvRate, useUpdateBcvRate, useMarginPercentage, useUpdateMarginPercentage, useBcvMultiplier, useUpdateBcvMultiplier } from '@/hooks/use-supabase';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function SettingsDialog({ open, onOpenChange, onImportComplete }: SettingsDialogProps) {
  const { data: bcvRate = 0 } = useBcvRate();
  const updateBcvRate = useUpdateBcvRate();
  const { data: marginPercentage = 0 } = useMarginPercentage();
  const updateMargin = useUpdateMarginPercentage();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const updateBcvMultiplier = useUpdateBcvMultiplier();

  const [localBcv, setLocalBcv] = useState('');
  const [localMargin, setLocalMargin] = useState('');
  const [localMultiplier, setLocalMultiplier] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportStockOpen, setIsImportStockOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (bcvRate) setLocalBcv(bcvRate.toString());
      if (marginPercentage) setLocalMargin(marginPercentage.toString());
      if (bcvMultiplier) setLocalMultiplier(bcvMultiplier.toString());
    }
  }, [open, bcvRate, marginPercentage, bcvMultiplier]);

  const handleSave = async () => {
    try {
      const parsedBcv = parseFloat(localBcv);
      const parsedMargin = parseFloat(localMargin);
      const parsedMultiplier = parseFloat(localMultiplier);

      if (isNaN(parsedBcv) || parsedBcv <= 0) {
        toast.error('La tasa BCV debe ser mayor a 0');
        return;
      }
      if (isNaN(parsedMargin) || parsedMargin < 0) {
        toast.error('El margen debe ser un número válido');
        return;
      }
      if (isNaN(parsedMultiplier) || parsedMultiplier < 1) {
        toast.error('El multiplicador debe ser mayor o igual a 1');
        return;
      }

      await Promise.all([
        updateBcvRate.mutateAsync(parsedBcv),
        updateMargin.mutateAsync(parsedMargin),
        updateBcvMultiplier.mutateAsync(parsedMultiplier)
      ]);

      toast.success('Configuraciones guardadas exitosamente');
      onOpenChange(false);
    } catch (err) {
      toast.error('Error al guardar las configuraciones');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configuraciones Generales</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Tasa BCV Actual</label>
            <Input
              type="number"
              step="0.01"
              value={localBcv}
              onChange={(e) => setLocalBcv(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Margen Divisas (%)</label>
            <Input
              type="number"
              step="0.1"
              value={localMargin}
              onChange={(e) => setLocalMargin(e.target.value)}
              className="col-span-3"
            />
            <p className="text-xs text-slate-500">
              Se usa para calcular el Precio Divisas a partir del Costo.
            </p>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Multiplicador Pago en Bs</label>
            <Input
              type="number"
              step="0.01"
              value={localMultiplier}
              onChange={(e) => setLocalMultiplier(e.target.value)}
              className="col-span-3"
            />
            <p className="text-xs text-slate-500">
              Multiplicador estándar (ej. 1.4) que se aplica al Precio Divisas para pagos en Bolívares.
            </p>
          </div>

          {/* Separator */}
          <div className="border-t border-slate-200 pt-4 mt-2">
            <label className="text-sm font-medium text-slate-700 mb-2.5 block">Gestión de Datos</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsImportOpen(true)}
                className="gap-2 border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 justify-center h-10 text-[13px]"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Importar Productos
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsImportStockOpen(true)}
                className="gap-2 border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 justify-center h-10 text-[13px]"
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                Subir Existencias
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const XLSXStyle = require('xlsx-js-style');
                  const headers = ['Codigo', 'Nombre', 'Costo'];
                  const rows = [
                    ['SKU-001', 'CONCHA BIELA FORD 300 (.010) SEALED POWER', 20],
                    ['SKU-002', 'FILTRO ACEITE TOYOTA HILUX', 5.5],
                  ];

                  const wsData = [headers, ...rows];
                  const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

                  // Column widths
                  ws['!cols'] = [{ wch: 18 }, { wch: 50 }, { wch: 14 }];

                  // Style header cells: bold white text on dark green background
                  const headerStyle = {
                    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
                    fill: { fgColor: { rgb: '0F172A' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                      bottom: { style: 'thin', color: { rgb: '10B981' } },
                    },
                  };
                  headers.forEach((_, i) => {
                    const cellRef = XLSXStyle.utils.encode_cell({ r: 0, c: i });
                    if (ws[cellRef]) ws[cellRef].s = headerStyle;
                  });

                  // Style data cells: light alternating background
                  rows.forEach((row, ri) => {
                    const bgColor = ri % 2 === 0 ? 'F1F5F9' : 'FFFFFF';
                    row.forEach((_, ci) => {
                      const cellRef = XLSXStyle.utils.encode_cell({ r: ri + 1, c: ci });
                      if (ws[cellRef]) {
                        ws[cellRef].s = {
                          fill: { fgColor: { rgb: bgColor } },
                          font: { sz: 10 },
                        };
                      }
                    });
                  });

                  const wb = XLSXStyle.utils.book_new();
                  XLSXStyle.utils.book_append_sheet(wb, ws, 'Plantilla');
                  XLSXStyle.writeFile(wb, 'Plantilla_Inventario_Sotomayor.xlsx');
                  toast.success('Plantilla descargada');
                }}
                className="col-span-2 gap-2 border-slate-300 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 h-10 text-[13px] justify-center"
              >
                <Download className="w-4 h-4 text-blue-600" />
                Descargar Plantilla de Productos
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Carga masiva de catálogo de productos o actualización rápida de existencias.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateBcvRate.isPending || updateMargin.isPending || updateBcvMultiplier.isPending}>
            Guardar Cambios
          </Button>
        </div>

        <ImportExcelDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImportComplete={() => {
          setIsImportOpen(false);
          onOpenChange(false);
          onImportComplete?.();
        }} />

        <ImportStockDialog open={isImportStockOpen} onOpenChange={setIsImportStockOpen} onImportComplete={() => {
          setIsImportStockOpen(false);
          onOpenChange(false);
          onImportComplete?.();
        }} />
      </DialogContent>
    </Dialog>
  );
}
