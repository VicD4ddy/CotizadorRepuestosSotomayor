'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Download, SlidersHorizontal, FileText, Save, Lock, Unlock, X } from 'lucide-react';

const IMPORT_PRODUCTS_PIN = '1234';

const ImportExcelDialog = dynamic(
  () => import('@/components/settings/import-excel-dialog').then((m) => m.ImportExcelDialog),
  { ssr: false }
);
const ImportStockDialog = dynamic(
  () => import('@/components/settings/import-stock-dialog').then((m) => m.ImportStockDialog),
  { ssr: false }
);
const BulkMinStockDialog = dynamic(
  () => import('@/components/inventory/bulk-min-stock-dialog').then((m) => m.BulkMinStockDialog),
  { ssr: false }
);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  useBcvRate,
  useUpdateBcvRate,
  useMarginPercentage,
  useUpdateMarginPercentage,
  useBcvMultiplier,
  useUpdateBcvMultiplier,
  useDefaultMinStock,
  useUpdateDefaultMinStock,
} from '@/hooks/use-supabase';

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
  const { data: defaultMinStock = 0 } = useDefaultMinStock();
  const updateDefaultMinStock = useUpdateDefaultMinStock();

  const [localBcv, setLocalBcv] = useState('');
  const [localMargin, setLocalMargin] = useState('');
  const [localMultiplier, setLocalMultiplier] = useState('');
  const [localMinStock, setLocalMinStock] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isUnlockingImport, setIsUnlockingImport] = useState(false);
  const [importPin, setImportPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isImportStockOpen, setIsImportStockOpen] = useState(false);
  const [isBulkMinStockOpen, setIsBulkMinStockOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (bcvRate) setLocalBcv(bcvRate.toString());
      if (marginPercentage) setLocalMargin(marginPercentage.toString());
      if (bcvMultiplier) setLocalMultiplier(bcvMultiplier.toString());
      setLocalMinStock(defaultMinStock > 0 ? defaultMinStock.toString() : '2');
    }
    setIsUnlockingImport(false);
    setImportPin('');
    setPinError(false);
  }, [open, bcvRate, marginPercentage, bcvMultiplier, defaultMinStock]);

  const handleUnlockImport = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (importPin.trim() === IMPORT_PRODUCTS_PIN) {
      setImportPin('');
      setPinError(false);
      setIsUnlockingImport(false);
      setIsImportOpen(true);
    } else {
      setPinError(true);
      setImportPin('');
      toast.error('Clave incorrecta');
    }
  };

  const handleSave = async () => {
    try {
      const parsedBcv = parseFloat(localBcv);
      const parsedMargin = parseFloat(localMargin);
      const parsedMultiplier = parseFloat(localMultiplier);
      const parsedMinStock = parseInt(localMinStock, 10);

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
      if (isNaN(parsedMinStock) || parsedMinStock < 0) {
        toast.error('El stock mínimo debe ser un número entero mayor o igual a 0');
        return;
      }

      await Promise.all([
        updateBcvRate.mutateAsync(parsedBcv),
        updateMargin.mutateAsync(parsedMargin),
        updateBcvMultiplier.mutateAsync(parsedMultiplier),
        updateDefaultMinStock.mutateAsync(parsedMinStock),
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

          {/* Stock Mínimo Global y Asignación Masiva */}
          <div className="grid gap-2 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Stock Mínimo por Defecto (Global)</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsBulkMinStockOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-7 px-2 font-bold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                Asignación Masiva
              </Button>
            </div>
            <Input
              type="number"
              min="0"
              step="1"
              value={localMinStock}
              onChange={(e) => setLocalMinStock(e.target.value)}
              className="col-span-3 font-semibold"
            />
            <p className="text-xs text-slate-500">
              Valor base aplicado a los productos que no tienen stock mínimo individual configurado.
            </p>
          </div>

          {/* Separator */}
          <div className="border-t border-slate-200 pt-3">
            <label className="text-sm font-medium text-slate-700 mb-2.5 block">Gestión de Datos</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsUnlockingImport((prev) => !prev);
                  setImportPin('');
                  setPinError(false);
                }}
                title="Bloqueado para evitar importaciones accidentales. Haz clic para desbloquear con clave."
                className="gap-1.5 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.98] justify-center h-10 text-[13px] cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Importar Productos
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsImportStockOpen(true)}
                className="gap-2 border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 justify-center h-10 text-[13px]"
              >
                <FileText className="w-4 h-4 text-teal-600" />
                Subir Existencias
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const mod: any = await import('xlsx-js-style');
                    const XLSXStyle = mod.default ?? mod;
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
                  } catch {
                    toast.error('Error al generar la plantilla');
                  }
                }}
                className="col-span-2 gap-2 border-slate-300 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 h-10 text-[13px] justify-center"
              >
                <Download className="w-4 h-4 text-blue-600" />
                Descargar Plantilla de Productos
              </Button>
            </div>
            {isUnlockingImport && (
              <div className="mt-2.5 p-2.5 rounded-sm border border-amber-200 bg-amber-50/70 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-900">
                    <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Clave requerida para Importar Productos</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnlockingImport(false);
                      setImportPin('');
                      setPinError(false);
                    }}
                    className="p-0.5 rounded-sm text-amber-700 hover:text-amber-900 hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer transition-colors"
                    title="Cancelar desbloqueo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <form onSubmit={handleUnlockImport} className="flex items-center gap-1.5">
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    placeholder="Clave..."
                    value={importPin}
                    onChange={(e) => {
                      setImportPin(e.target.value);
                      if (pinError) setPinError(false);
                    }}
                    className={`h-8 text-[12.5px] font-mono tabular-nums tracking-widest bg-white rounded-sm ${
                      pinError
                        ? 'border-red-400 focus-visible:ring-red-500'
                        : 'border-amber-300 focus-visible:ring-emerald-500'
                    }`}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 px-3 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-sm text-[12px] font-semibold shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.98] transition-all"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Abrir
                  </Button>
                </form>
                {pinError && (
                  <p className="text-[11px] text-red-600 font-medium">
                    Clave incorrecta. Intenta nuevamente.
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1.5">
              Carga masiva de catálogo de productos o actualización rápida de existencias.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateBcvRate.isPending || updateMargin.isPending || updateBcvMultiplier.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            Guardar Cambios
          </Button>
        </div>

        {isImportOpen && (
          <ImportExcelDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImportComplete={() => {
            setIsImportOpen(false);
            onOpenChange(false);
            onImportComplete?.();
          }} />
        )}

        {isImportStockOpen && (
          <ImportStockDialog open={isImportStockOpen} onOpenChange={setIsImportStockOpen} onImportComplete={() => {
            setIsImportStockOpen(false);
            onOpenChange(false);
            onImportComplete?.();
          }} />
        )}

        {isBulkMinStockOpen && (
          <BulkMinStockDialog open={isBulkMinStockOpen} onOpenChange={setIsBulkMinStockOpen} />
        )}
      </DialogContent>
    </Dialog>
  );
}
