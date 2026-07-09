'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, AlertCircle, X, RotateCcw } from 'lucide-react';
import { useBulkUpdateStock } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface ImportStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

interface ParsedStockRow {
  code: string;
  stock: number;
  currentStock?: number;
  isChanged: boolean;
  excelName?: string;
  dbName?: string;
  exists: boolean;
}

export function ImportStockDialog({ open, onOpenChange, onImportComplete }: ImportStockDialogProps) {
  const bulkUpdateStock = useBulkUpdateStock();

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedStockRow[]>([]);
  const [importResult, setImportResult] = useState<{ total: number; updated: number; ignored: number; errors: string[] }>({ total: 0, updated: 0, ignored: 0, errors: [] });
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState(0);

  // Reset all state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep('upload');
      setFileName('');
      setParsedRows([]);
      setImportResult({ total: 0, updated: 0, ignored: 0, errors: [] });
      setExcludedIndexes(new Set());
      setImportProgress(0);
    }
    onOpenChange(newOpen);
  };

  // ===== FILE UPLOAD & PARSE =====
  const handleFile = useCallback(async (file: File) => {
    const validExts = ['.xlsx', '.xls', '.csv'];
    if (!validExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast.error('Formato inválido. Solo se aceptan archivos .xlsx, .xls o .csv');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, defval: '' });

        if (aoa.length < 2) {
          toast.error('El archivo está vacío o solo tiene encabezados.');
          return;
        }

        const headers = (aoa[0] || []).map(h => String(h || '').trim());
        let codeIndex = 0;
        let nameIndex = 1;
        let stockIndex = 3; // Fallback index from typical Sotomayor Excel template

        // Find index matching Code, Name and Stock / Existencia in header titles
        headers.forEach((h, idx) => {
          const lowerH = String(h || '').toLowerCase().trim();
          if (
            lowerH === 'código' ||
            lowerH === 'codigo' ||
            lowerH === 'code' ||
            lowerH === 'sku' ||
            lowerH === 'cod' ||
            ((lowerH.includes('código') || lowerH.includes('codigo') || lowerH.includes('sku')) && !lowerH.includes('barras') && !lowerH.includes('fabricante'))
          ) {
            codeIndex = idx;
          }
          if (
            lowerH === 'nombre' ||
            lowerH === 'descripción' ||
            lowerH === 'descripcion' ||
            lowerH === 'producto'
          ) {
            nameIndex = idx;
          }
          if (
            lowerH === 'existencia' ||
            lowerH === 'stock' ||
            lowerH === 'cantidad' ||
            lowerH === 'cant' ||
            lowerH === 'existencia actual' ||
            ((lowerH.includes('existencia') || lowerH.includes('stock') || lowerH.includes('cantidad') || lowerH.includes('cant')) && !lowerH.includes('caja') && !lowerH.includes('min') && !lowerH.includes('max') && !lowerH.includes('barras'))
          ) {
            stockIndex = idx;
          }
        });

        // Fetch all existing product codes and names from database with pagination (overcoming 1000 limit)
        // Fetch all existing product codes, names and current stock from database with pagination (overcoming 1000 limit)
        const existingProducts: { code: string; name: string; stock: number }[] = [];
        const pageSize = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error: dbError } = await supabase
            .from('products')
            .select('code, name, stock')
            .range(from, from + pageSize - 1);

          if (dbError) throw dbError;
          if (data && data.length > 0) {
            existingProducts.push(...data);
            from += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Build a case-insensitive lookup: uppercase code -> { dbCode, name, currentStock }
        const existingMap = new Map(
          existingProducts.map(p => [String(p.code || '').trim().toUpperCase(), { dbCode: p.code, name: p.name, currentStock: p.stock ?? 0 }])
        );
        const parsedMap = new Map<string, ParsedStockRow>();

        for (let i = 1; i < aoa.length; i++) {
          const row = aoa[i];
          if (!row || row.length === 0) continue;

          const code = String(row[codeIndex] || '').trim();
          const name = String(row[nameIndex] || row[1] || '').trim();
          
          if (!code) continue;

          // Parse Stock quantity de forma segura evitando códigos de barras gigantes o desbordamiento de enteros (overflow) en PostgreSQL
          let stock = 0;
          const rawVal = row[stockIndex];
          if (typeof rawVal === 'number') {
            stock = Math.max(0, Math.round(rawVal));
          } else if (rawVal !== undefined && rawVal !== null) {
            const cleanStr = String(rawVal).replace(',', '.').trim();
            const parsedNum = parseFloat(cleanStr);
            if (!isNaN(parsedNum) && parsedNum >= 0 && cleanStr.length <= 10) {
              stock = Math.round(parsedNum);
            } else {
              const stockRaw = String(rawVal || '').replace(/[^0-9]/g, '');
              if (stockRaw.length <= 7 && stockRaw.length > 0) {
                stock = parseInt(stockRaw, 10);
              }
            }
          }
          
          let validStock = isNaN(stock) || stock < 0 ? 0 : stock;
          if (validStock > 999999) {
            validStock = 0;
          }

          const upperCode = code.toUpperCase();
          const match = existingMap.get(upperCode);
          const currentStock = match ? match.currentStock : undefined;
          const isChanged = match ? (validStock !== match.currentStock) : false;

          if (parsedMap.has(upperCode)) {
            // Si hay un código duplicado en el Excel, actualizamos con la existencia más reciente leída
            const existing = parsedMap.get(upperCode)!;
            existing.stock = validStock;
            existing.isChanged = match ? (validStock !== match.currentStock) : false;
            if (!existing.excelName && name) existing.excelName = name;
          } else {
            parsedMap.set(upperCode, {
              code: match ? match.dbCode : code, // Use the exact DB code for upsert
              stock: validStock,
              currentStock,
              isChanged,
              excelName: name,
              dbName: match?.name,
              exists: !!match
            });
          }
        }

        const parsed = Array.from(parsedMap.values());

        if (parsed.length === 0) {
          toast.error('No se encontraron filas con códigos válidos en el archivo.');
          return;
        }

        // Ordenar: primero los que existen en el catálogo y realmente CAMBIAN su stock (isChanged), luego los que existen pero no cambian, luego los no encontrados
        parsed.sort((a, b) => {
          if (a.exists !== b.exists) {
            return a.exists ? -1 : 1;
          }
          if (a.isChanged !== b.isChanged) {
            return a.isChanged ? -1 : 1;
          }
          return a.code.localeCompare(b.code);
        });

        setParsedRows(parsed);
        setStep('preview');
      } catch (err: any) {
        console.error(err);
        toast.error(`Error al leer el archivo: ${err.message || 'Verifica que sea un Excel o CSV válido.'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Counts: solo actualizar los repuestos cuya existencia realmente cambia
  const activeRows = parsedRows.filter((row, i) => row.exists && row.isChanged && !excludedIndexes.has(i));
  const unchangedCount = parsedRows.filter(row => row.exists && !row.isChanged).length;
  const ignoredCount = parsedRows.filter(row => !row.exists).length;

  // ===== IMPORT =====
  const handleImport = async () => {
    setStep('importing');
    setImportProgress(0);

    const updates = activeRows.map((row) => ({
      code: row.code,
      name: row.dbName || row.excelName || '',
      stock: row.stock,
    }));

    let actualUpdatedCount = 0;

    try {
      const batchSize = 100;
      const totalRows = updates.length;
      
      if (totalRows === 0) {
        setImportResult({
          total: 0,
          updated: 0,
          ignored: ignoredCount + excludedIndexes.size,
          errors: ['No hay registros válidos seleccionados para actualizar.']
        });
        setStep('done');
        return;
      }

      for (let i = 0; i < totalRows; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const res = await bulkUpdateStock.mutateAsync(batch);
        if (Array.isArray(res)) {
          actualUpdatedCount += res.length;
        } else {
          actualUpdatedCount += batch.length;
        }
        
        const progress = Math.min(Math.round(((i + batch.length) / totalRows) * 100), 100);
        setImportProgress(progress);
      }

      setImportResult({
        total: parsedRows.length,
        updated: actualUpdatedCount,
        ignored: ignoredCount + excludedIndexes.size,
        errors: [],
      });
      setStep('done');
      onImportComplete?.();
    } catch (err: any) {
      toast.error(`Error durante la actualización: ${err.message}`);
      setImportResult({ total: parsedRows.length, updated: actualUpdatedCount, ignored: ignoredCount, errors: [err.message] });
      setStep('done');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Cargar Existencias desde Excel
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {step === 'upload' && 'Sube tu planilla de inventario para actualizar las cantidades disponibles de tus repuestos.'}
            {step === 'preview' && 'Verifica la correspondencia de códigos y cantidades antes de proceder.'}
            {step === 'importing' && 'Actualizando base de datos...'}
            {step === 'done' && 'Actualización de existencias completada.'}
          </p>
        </DialogHeader>

        <div className="p-6">
          {/* ===== STEP: UPLOAD ===== */}
          {step === 'upload' && (
            <div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5">
                <p className="text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-2">Formato Admitido</p>
                <p className="text-[12.5px] text-slate-600 mb-2">
                  El sistema buscará automáticamente las columnas por nombre de cabecera. Asegúrate de incluir columnas llamadas:
                </p>
                <ul className="list-disc pl-5 text-[12px] text-slate-500 space-y-1 mb-3">
                  <li><strong>Código / SKU:</strong> Código del producto en el catálogo (Ej. <code>WP-TY-4589</code>).</li>
                  <li><strong>Existencia / Stock:</strong> Cantidad física en inventario (Ej. <code>12</code>).</li>
                </ul>
                <div className="overflow-hidden rounded border border-slate-200">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="px-3 py-1.5 text-left font-bold">A: Código</th>
                        <th className="px-3 py-1.5 text-left font-bold">B: Nombre</th>
                        <th className="px-3 py-1.5 text-left font-bold">C: Costo</th>
                        <th className="px-3 py-1.5 text-left font-bold">D: Existencia Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white">
                        <td className="px-3 py-1 text-slate-600 border-t border-slate-100 font-mono">162</td>
                        <td className="px-3 py-1 text-slate-600 border-t border-slate-100">CORREA TIEMPO OPTRA...</td>
                        <td className="px-3 py-1 text-slate-600 border-t border-slate-100">$13.00</td>
                        <td className="px-3 py-1 text-slate-600 border-t border-slate-100 font-bold">2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer group"
                onClick={() => document.getElementById('stock-file-input')?.click()}
              >
                <Upload className="w-10 h-10 text-slate-300 group-hover:text-emerald-500 mx-auto mb-3 transition-colors" />
                <p className="text-[14px] font-semibold text-slate-700 mb-1">
                  Arrastra tu planilla aquí o haz clic
                </p>
                <p className="text-[12px] text-slate-400">
                  Soporta archivos .xlsx, .xls o .csv
                </p>
                <input
                  id="stock-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* ===== STEP: PREVIEW ===== */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* File Info Summary */}
              <div className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{fileName}</p>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-bold text-emerald-600">{parsedRows.length}</span> registros leídos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {activeRows.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">{activeRows.length} para actualizar</span>
                  )}
                  {unchangedCount > 0 && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">{unchangedCount} sin cambios (ya actualizados)</span>
                  )}
                  {ignoredCount > 0 && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{ignoredCount} no en catálogo (omitidos)</span>
                  )}
                </div>
              </div>

              {/* Warning Alert if some codes don't exist */}
              {ignoredCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-700">
                    Hay <strong>{ignoredCount}</strong> códigos en el Excel que no existen en el catálogo actual de repuestos. Estos se ignorarán para prevenir errores.
                  </p>
                </div>
              )}

              {/* Products Table */}
              <div className="overflow-y-auto overflow-x-hidden max-h-[280px] border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-white/70 uppercase tracking-wider w-8">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-white/70 uppercase tracking-wider">Código</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-white/70 uppercase tracking-wider">Nombre en Catálogo</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-white/70 uppercase tracking-wider w-24">Stock Actual</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-white/70 uppercase tracking-wider w-24">Nueva Existencia</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-white/70 uppercase tracking-wider w-24">Estado</th>
                      <th className="px-3 py-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => {
                      const isExcluded = excludedIndexes.has(i);
                      return (
                        <tr key={i} className={`border-b border-slate-100 transition-colors ${
                          isExcluded || !row.exists ? 'opacity-40 bg-slate-50' : !row.isChanged ? 'bg-slate-50/50' : 'hover:bg-slate-50'
                        }`}>
                          <td className="px-3 py-1.5 text-slate-400 text-[11px]">{i + 1}</td>
                          <td className={`px-3 py-1.5 text-slate-600 font-mono text-[11px] ${isExcluded ? 'line-through' : ''}`}>{row.code}</td>
                          <td className={`px-3 py-1.5 text-slate-800 font-medium max-w-[280px] truncate ${isExcluded ? 'line-through' : ''}`} title={row.dbName || row.excelName}>
                            {row.exists ? row.dbName : <span className="text-slate-400 italic">No encontrado ({row.excelName || 'Sin nombre'})</span>}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500 font-medium text-right tabular-nums">{row.exists ? (row.currentStock ?? 0) : '-'}</td>
                          <td className={`px-3 py-1.5 text-slate-900 font-bold text-right tabular-nums ${isExcluded ? 'line-through' : ''}`}>{row.stock}</td>
                          <td className="px-3 py-1.5 text-center">
                            {isExcluded ? (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">DESCARTADO</span>
                            ) : !row.exists ? (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">NO EN CATÁLOGO</span>
                            ) : row.isChanged ? (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">ACTUALIZA</span>
                            ) : (
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">SIN CAMBIOS</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {row.exists && (
                              isExcluded ? (
                                <button
                                  onClick={() => {
                                    const next = new Set(excludedIndexes);
                                    next.delete(i);
                                    setExcludedIndexes(next);
                                  }}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-colors"
                                  title="Restaurar actualización"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    const next = new Set(excludedIndexes);
                                    next.add(i);
                                    setExcludedIndexes(next);
                                  }}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="Descartar actualización"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={() => { setStep('upload'); setParsedRows([]); }} className="gap-2 text-[13px] h-9 rounded-lg">
                  <ArrowLeft className="w-4 h-4" /> Cambiar Archivo
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={activeRows.length === 0}
                  className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] h-10 px-5 rounded-lg shadow-sm shadow-emerald-200"
                >
                  <Upload className="w-4 h-4" />
                  Actualizar {activeRows.length} existencias
                </Button>
              </div>
            </div>
          )}

          {/* ===== STEP: IMPORTING ===== */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
              <p className="text-[15px] font-semibold text-slate-700">Actualizando existencias...</p>
              <div className="w-64 bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-[12px] text-slate-400 mt-2">{importProgress}% completado</p>
            </div>
          )}

          {/* ===== STEP: DONE ===== */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-4" />
              <p className="text-[18px] font-bold text-slate-900 mb-3">
                ¡Existencias Actualizadas!
              </p>

              <div className="w-full max-w-[320px] bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-600">Productos actualizados</span>
                  <span className="text-[13px] font-bold text-emerald-600">{importResult.updated}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-600">Registros ignorados / omitidos</span>
                  <span className="text-[13px] font-bold text-slate-500">{importResult.ignored}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-[13px] font-bold text-slate-700">Total leídos en Excel</span>
                  <span className="text-[13px] font-bold text-slate-900">{importResult.total}</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 max-h-[100px] overflow-auto mb-4">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-red-600">{err}</p>
                  ))}
                </div>
              )}

              <Button onClick={() => handleOpenChange(false)} className="text-[13px] bg-slate-900 hover:bg-slate-800 text-white">
                Cerrar Ventana
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
