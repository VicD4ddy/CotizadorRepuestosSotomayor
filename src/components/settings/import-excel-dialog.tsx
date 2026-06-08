'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, AlertCircle, Pencil, X, RotateCcw } from 'lucide-react';
import { useBulkInsertProducts, useProducts, useCategories, useBrands } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { AiProgressBanner } from '@/components/inventory/ai-progress-banner';

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function ImportExcelDialog({ open, onOpenChange, onImportComplete }: ImportExcelDialogProps) {
  const bulkInsert = useBulkInsertProducts();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  // Group categories by section
  const categoryGroups = categories.reduce<Record<string, typeof categories>>((acc, c) => {
    if (!acc[c.section]) acc[c.section] = [];
    acc[c.section].push(c);
    return acc;
  }, {});

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<{ code: string; name: string; cost: number }[]>([]);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ total: number; created: number; updated: number; errors: string[] }>({ total: 0, created: 0, updated: 0, errors: [] });
  const [importedProductIds, setImportedProductIds] = useState<string[]>([]);
  const [showAiBanner, setShowAiBanner] = useState(true);
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');

  // Reset all state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep('upload');
      setFileName('');
      setRawRows([]);
      setExistingCodes(new Set());
      setImportResult({ total: 0, created: 0, updated: 0, errors: [] });
      setImportedProductIds([]);
      setShowAiBanner(true);
      setExcludedIndexes(new Set());
      setSelectedCategoryId('');
      setSelectedBrandId('');
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

        const parsed: { code: string; name: string; cost: number }[] = [];
        for (let i = 1; i < aoa.length; i++) {
          const row = aoa[i];
          const code = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          const costRaw = String(row[2] || '').replace(/[^0-9.,]/g, '').replace(',', '.');
          const cost = parseFloat(costRaw);

          if (!code && !name) continue;
          if (!code || !name) continue;

          parsed.push({
            code,
            name,
            cost: isNaN(cost) ? 0 : cost,
          });
        }

        if (parsed.length === 0) {
          toast.error('No se encontraron filas con datos válidos (Codigo + Nombre).');
          return;
        }

        // Check which codes already exist in the database
        const codes = parsed.map(p => p.code);
        const { data: existingProducts } = await supabase
          .from('products')
          .select('code')
          .in('code', codes);

        const existingSet = new Set((existingProducts || []).map(p => p.code));
        setExistingCodes(existingSet);

        setRawRows(parsed);
        setStep('preview');
      } catch {
        toast.error('Error al leer el archivo. Verifica que sea un Excel o CSV válido.');
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

  // Counts (excluding discarded)
  const activeRows = rawRows.filter((_, i) => !excludedIndexes.has(i));
  const newCount = activeRows.filter(r => !existingCodes.has(r.code)).length;
  const updateCount = activeRows.filter(r => existingCodes.has(r.code)).length;

  // ===== IMPORT =====
  const handleImport = async () => {
    setStep('importing');

    const products = rawRows
      .filter((_, i) => !excludedIndexes.has(i))
      .map((row) => ({
        code: row.code,
        name: row.name,
        cost: row.cost,
        price_usd: 0,
        ...(selectedCategoryId ? { category_id: selectedCategoryId } : {}),
        ...(selectedBrandId ? { brand_id: selectedBrandId } : {}),
      }));

    try {
      const batchSize = 50;
      const allInsertedIds: string[] = [];
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        const result = await bulkInsert.mutateAsync(batch);
        if (result && Array.isArray(result)) {
          allInsertedIds.push(...result.map((p: any) => p.id));
        }
      }

      setImportedProductIds(allInsertedIds);
      setImportResult({
        total: products.length,
        created: newCount,
        updated: updateCount,
        errors: [],
      });
      setStep('done');
    } catch (err: any) {
      toast.error(`Error durante la importación: ${err.message}`);
      setImportResult({ total: 0, created: 0, updated: 0, errors: [err.message] });
      setStep('done');
    }
  };

  const handleReviewProducts = () => {
    handleOpenChange(false);
    onImportComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Importar Inventario desde Excel
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {step === 'upload' && 'Tu archivo debe tener 3 columnas: Codigo | Nombre | Costo'}
            {step === 'preview' && 'Verifica los datos antes de importar.'}
            {step === 'importing' && 'Importando productos...'}
            {step === 'done' && 'Importación finalizada.'}
          </p>
        </DialogHeader>

        <div className="p-6">
          {/* ===== STEP: UPLOAD ===== */}
          {step === 'upload' && (
            <div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5">
                <p className="text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-2">Formato Requerido</p>
                <div className="overflow-hidden rounded border border-slate-200">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="px-3 py-1.5 text-left font-bold">A: Codigo</th>
                        <th className="px-3 py-1.5 text-left font-bold">B: Nombre</th>
                        <th className="px-3 py-1.5 text-left font-bold">C: Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white">
                        <td className="px-3 py-1 text-slate-600 border-t border-slate-100">4916 010-SEALP</td>
                        <td className="px-3 py-1 text-slate-600 border-t border-slate-100">CONCHA BIELA FORD 300...</td>
                        <td className="px-3 py-1 text-slate-600 border-t border-slate-100">49.88</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer group"
                onClick={() => document.getElementById('excel-file-input')?.click()}
              >
                <Upload className="w-10 h-10 text-slate-300 group-hover:text-emerald-500 mx-auto mb-3 transition-colors" />
                <p className="text-[14px] font-semibold text-slate-700 mb-1">
                  Arrastra tu archivo aquí o haz clic
                </p>
                <p className="text-[12px] text-slate-400">
                  .xlsx, .xls o .csv
                </p>
                <input
                  id="excel-file-input"
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
              {/* File info card */}
              <div className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{fileName}</p>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-bold text-emerald-600">{rawRows.length}</span> productos detectados
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {newCount > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">{newCount} nuevos</span>
                  )}
                  {updateCount > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">{updateCount} existentes</span>
                  )}
                </div>
              </div>

              {/* Duplicate warning */}
              {updateCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-700">
                    Los <strong>{updateCount}</strong> productos existentes se actualizarán con los datos del Excel.
                  </p>
                </div>
              )}

              {/* Assign Brand & Category */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Asignar a todos los productos</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 text-[12px] rounded-lg bg-white border border-slate-200 text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all appearance-none font-medium"
                    >
                      <option value="">— Clasificación —</option>
                      {Object.entries(categoryGroups).map(([section, cats]) => (
                        <optgroup key={section} label={section}>
                          {cats.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 text-[12px] rounded-lg bg-white border border-slate-200 text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all appearance-none font-medium"
                    >
                      <option value="">— Marca —</option>
                      {brands.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                {(selectedCategoryId || selectedBrandId) && (
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    {selectedCategoryId && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        📂 {categories.find(c => c.id === selectedCategoryId)?.name}
                        <button onClick={() => setSelectedCategoryId('')} className="ml-0.5 hover:text-red-500 transition-colors">×</button>
                      </span>
                    )}
                    {selectedBrandId && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                        🏷️ {(brands as any[]).find(b => b.id === selectedBrandId)?.name}
                        <button onClick={() => setSelectedBrandId('')} className="ml-0.5 hover:text-red-500 transition-colors">×</button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Products table */}
              <div className="overflow-y-auto overflow-x-hidden max-h-[220px] border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-white/70 uppercase tracking-wider w-8">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-white/70 uppercase tracking-wider">Código</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-white/70 uppercase tracking-wider">Nombre</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-white/70 uppercase tracking-wider">Costo</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-white/70 uppercase tracking-wider w-16">Estado</th>
                      <th className="px-3 py-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.map((row, i) => {
                      const isExisting = existingCodes.has(row.code);
                      const isExcluded = excludedIndexes.has(i);
                      return (
                        <tr key={i} className={`border-b border-slate-100 transition-colors ${
                          isExcluded ? 'opacity-40 bg-slate-50' : isExisting ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                        }`}>
                          <td className="px-3 py-1.5 text-slate-400 text-[11px]">{i + 1}</td>
                          <td className={`px-3 py-1.5 text-slate-600 font-mono text-[11px] ${isExcluded ? 'line-through' : ''}`}>{row.code}</td>
                          <td className={`px-3 py-1.5 text-slate-800 font-medium max-w-[220px] truncate ${isExcluded ? 'line-through' : ''}`}>{row.name}</td>
                          <td className={`px-3 py-1.5 text-slate-700 text-right tabular-nums ${isExcluded ? 'line-through' : ''}`}>${row.cost.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-center">
                            {isExcluded ? (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">EXCLUIDO</span>
                            ) : isExisting ? (
                              <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">EXISTE</span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">NUEVO</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {isExcluded ? (
                              <button
                                onClick={() => {
                                  const next = new Set(excludedIndexes);
                                  next.delete(i);
                                  setExcludedIndexes(next);
                                }}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-colors"
                                title="Restaurar producto"
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
                                title="Descartar producto"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  </tbody>
                </table>
              </div>

              {/* Footer actions */}
              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={() => { setStep('upload'); setRawRows([]); setExistingCodes(new Set()); }} className="gap-2 text-[13px] h-9 rounded-lg">
                  <ArrowLeft className="w-4 h-4" /> Cambiar Archivo
                </Button>
                <Button
                  onClick={handleImport}
                  className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] h-10 px-5 rounded-lg shadow-sm shadow-emerald-200"
                >
                  <Upload className="w-4 h-4" />
                  Importar {activeRows.length} Producto{activeRows.length !== 1 ? 's' : ''}
                  {excludedIndexes.size > 0 && (
                    <span className="text-emerald-200 text-[10px]">({excludedIndexes.size} excluido{excludedIndexes.size !== 1 ? 's' : ''})</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ===== STEP: IMPORTING ===== */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
              <p className="text-[15px] font-semibold text-slate-700">Importando productos...</p>
              <p className="text-[13px] text-slate-400 mt-1">No cierres esta ventana.</p>
            </div>
          )}

          {/* ===== STEP: DONE ===== */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-8">
              {importResult.total > 0 ? (
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-4" />
              ) : (
                <AlertTriangle className="w-14 h-14 text-amber-500 mb-4" />
              )}
              <p className="text-[18px] font-bold text-slate-900 mb-3">
                {importResult.total > 0 ? '¡Importación Exitosa!' : 'Importación con Errores'}
              </p>

              {importResult.total > 0 && (
                <div className="w-full max-w-[320px] bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 space-y-2">
                  {importResult.created > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-600">Productos nuevos</span>
                      <span className="text-[13px] font-bold text-emerald-600">{importResult.created}</span>
                    </div>
                  )}
                  {importResult.updated > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-600">Productos actualizados</span>
                      <span className="text-[13px] font-bold text-amber-600">{importResult.updated}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <span className="text-[13px] font-bold text-slate-700">Total procesados</span>
                    <span className="text-[13px] font-bold text-slate-900">{importResult.total}</span>
                  </div>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 max-h-[100px] overflow-auto mb-4">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-red-600">{err}</p>
                  ))}
                </div>
              )}

              {/* AI Processing Banner */}
              {importResult.total > 0 && importedProductIds.length > 0 && showAiBanner && (
                <div className="w-full max-w-[450px] mb-4">
                  <AiProgressBanner
                    productIds={importedProductIds}
                    onComplete={() => {
                      // Refresh products list
                      onImportComplete?.();
                    }}
                    onClose={() => setShowAiBanner(false)}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => handleOpenChange(false)} className="text-[13px]">
                  Cerrar
                </Button>
                {importResult.total > 0 && (
                  <Button onClick={handleReviewProducts} className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px]">
                    <Pencil className="w-4 h-4" /> Revisar Productos
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
