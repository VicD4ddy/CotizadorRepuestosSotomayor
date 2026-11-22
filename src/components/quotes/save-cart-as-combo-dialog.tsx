'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/store/cart-store';
import {
  useProducts,
  useKits,
  useKitCombos,
  useCreateKitCombo,
  useUpdateKitCombo,
  useSaveComboItems,
  useCreateKitItem,
} from '@/hooks/use-supabase';
import { sortQuoteItems } from '@/lib/tren-delantero';
import { cn, formatUSD } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Layers,
  Search,
  Check,
  AlertTriangle,
  Plus,
  Minus,
  Link2,
  Loader2,
  Package,
} from 'lucide-react';

interface SaveCartAsComboDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ComboDraftRow {
  productId: string;
  name: string;
  code: string;
  brandName?: string;
  unitPriceUsd: number;
  quantity: number;
  included: boolean;
}

type KitCategoryFilter = 'all' | 'Motor' | 'Clutch' | 'Tren Delantero';

const KIT_CATEGORY_TABS: { id: KitCategoryFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'Motor', label: 'Motor' },
  { id: 'Clutch', label: 'Clutch' },
  { id: 'Tren Delantero', label: 'T. Delantero' },
];

export function SaveCartAsComboDialog({ open, onOpenChange }: SaveCartAsComboDialogProps) {
  const { items: cartItems } = useCartStore();
  const { data: products = [] } = useProducts();
  const { data: kits = [], isLoading: isLoadingKits } = useKits();

  const [categoryFilter, setCategoryFilter] = useState<KitCategoryFilter>('all');
  const [kitSearch, setKitSearch] = useState('');
  const [selectedKitId, setSelectedKitId] = useState<string>('');
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');
  const [selectedComboId, setSelectedComboId] = useState<string>('');
  const [comboName, setComboName] = useState('');
  const [draftRows, setDraftRows] = useState<ComboDraftRow[]>([]);
  const [excludedManualNames, setExcludedManualNames] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const wasOpenRef = useRef(false);

  const { data: kitCombos = [], isLoading: isLoadingCombos } = useKitCombos(selectedKitId);
  const createKitCombo = useCreateKitCombo();
  const updateKitCombo = useUpdateKitCombo();
  const saveComboItems = useSaveComboItems();
  const createKitItem = useCreateKitItem();

  // Inicializar estado editable una sola vez al abrir el modal sin modificar el carrito
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const productMap = new Map(products.map((p) => [p.id, p]));
    const sorted = sortQuoteItems(cartItems);
    const seenIds = new Set<string>();
    const valid: ComboDraftRow[] = [];
    const manual: string[] = [];

    for (const item of sorted) {
      const dbProd = item.product_id ? productMap.get(item.product_id) : undefined;
      if (!dbProd) {
        manual.push(item.product_name || 'Ítem manual');
        continue;
      }
      if (seenIds.has(dbProd.id)) continue;
      seenIds.add(dbProd.id);

      valid.push({
        productId: dbProd.id,
        name: dbProd.name || item.product_name,
        code: dbProd.code || item.product_code || '',
        brandName: dbProd.brands?.name || item.brand_name,
        unitPriceUsd: item.unit_price_usd ?? dbProd.price_usd ?? 0,
        quantity: Math.max(1, item.quantity || 1),
        included: true,
      });
    }

    setDraftRows(valid);
    setExcludedManualNames(manual);
    setKitSearch('');
    setCategoryFilter('all');
    setSaveMode('new');
    setSelectedComboId('');
    setComboName('');
    setSelectedKitId('');
  }, [open, cartItems, products]);

  // Auto-seleccionar el kit con mayor coincidencia una vez cargados los kits
  useEffect(() => {
    if (!open || selectedKitId || kits.length === 0) return;

    const validIds = new Set(draftRows.map((v) => v.productId));
    let bestKitId = '';
    let bestMatches = 0;

    for (const kit of kits) {
      const kitProdIds = new Set((kit.kit_items || []).map((ki: any) => ki.product_id));
      let matches = 0;
      validIds.forEach((pid) => {
        if (kitProdIds.has(pid)) matches++;
      });
      if (matches > bestMatches) {
        bestMatches = matches;
        bestKitId = kit.id;
      }
    }

    setSelectedKitId(bestKitId || kits[0].id);
  }, [open, selectedKitId, kits, draftRows]);

  // Sincronizar modo existente si el kit destino no tiene combos o al seleccionar otro
  useEffect(() => {
    if (kitCombos.length === 0) {
      if (saveMode === 'existing') {
        setSaveMode('new');
      }
      setSelectedComboId('');
      return;
    }

    if (saveMode === 'existing') {
      const currentExists = kitCombos.some((c: any) => c.id === selectedComboId);
      if (!currentExists) {
        setSelectedComboId(kitCombos[0].id);
        setComboName(kitCombos[0].name || '');
      }
    }
  }, [kitCombos, saveMode, selectedComboId]);

  const validProductIdSet = useMemo(
    () => new Set(draftRows.map((r) => r.productId)),
    [draftRows]
  );

  // Ordenar kits: primero los que coinciden con productos del carrito, luego alfabético
  const filteredKits = useMemo(() => {
    const search = kitSearch.trim().toLowerCase();
    return kits
      .map((kit) => {
        const kitItemIds = new Set((kit.kit_items || []).map((ki: any) => ki.product_id));
        let matchCount = 0;
        validProductIdSet.forEach((pid) => {
          if (kitItemIds.has(pid)) matchCount++;
        });
        return { kit, matchCount, kitItemIds };
      })
      .filter(({ kit }) => {
        if (categoryFilter !== 'all' && kit.category !== categoryFilter) return false;
        if (!search) return true;
        return (
          kit.name?.toLowerCase().includes(search) ||
          kit.category?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        return (a.kit.name || '').localeCompare(b.kit.name || '');
      });
  }, [kits, categoryFilter, kitSearch, validProductIdSet]);

  const selectedKit = useMemo(
    () => kits.find((k) => k.id === selectedKitId) || null,
    [kits, selectedKitId]
  );

  const selectedKitProductIds = useMemo(
    () => new Set<string>((selectedKit?.kit_items || []).map((ki: any) => ki.product_id)),
    [selectedKit]
  );

  const includedRows = useMemo(
    () => draftRows.filter((r) => r.included && r.quantity > 0),
    [draftRows]
  );

  const unlinkedCount = useMemo(() => {
    if (!selectedKit) return 0;
    return includedRows.filter((r) => !selectedKitProductIds.has(r.productId)).length;
  }, [includedRows, selectedKit, selectedKitProductIds]);

  const totalComboUsd = useMemo(
    () => includedRows.reduce((sum, r) => sum + r.unitPriceUsd * r.quantity, 0),
    [includedRows]
  );

  const toggleAllRows = (checked: boolean) => {
    setDraftRows((prev) => prev.map((r) => ({ ...r, included: checked })));
  };

  const updateRow = (productId: string, updater: (r: ComboDraftRow) => ComboDraftRow) => {
    setDraftRows((prev) => prev.map((r) => (r.productId === productId ? updater(r) : r)));
  };

  const handleSelectExistingCombo = (comboId: string) => {
    setSelectedComboId(comboId);
    const found = kitCombos.find((c: any) => c.id === comboId);
    if (found) {
      setComboName(found.name || '');
    }
  };

  const handleSave = async () => {
    if (!selectedKitId) {
      toast.error('Selecciona el cotizador / kit donde guardar el combo');
      return;
    }
    if (includedRows.length === 0) {
      toast.error('Selecciona al menos un producto válido para el combo');
      return;
    }

    const trimmedName = comboName.trim();
    if (!trimmedName) {
      toast.error('Ingresa un nombre para el combo');
      return;
    }
    if (saveMode === 'existing' && !selectedComboId) {
      toast.error('Selecciona el combo existente que deseas actualizar');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Vincular al kit destino los repuestos seleccionados que aún no pertenecen a kit_items
      const toLink = includedRows.filter((r) => !selectedKitProductIds.has(r.productId));
      let newlyLinkedCount = 0;

      for (const row of toLink) {
        try {
          await createKitItem.mutateAsync({
            kit_id: selectedKitId,
            product_id: row.productId,
            quantity: 1,
          });
          newlyLinkedCount++;
        } catch (err: any) {
          if (!err?.message?.includes('vinculado')) {
            throw err;
          }
        }
      }

      // 2. Crear combo nuevo o actualizar el combo existente
      let targetComboId = selectedComboId;
      if (saveMode === 'new') {
        const created = await createKitCombo.mutateAsync({
          kit_id: selectedKitId,
          name: trimmedName,
        });
        targetComboId = created.id;
      } else {
        const existingCombo = kitCombos.find((c: any) => c.id === selectedComboId);
        if (existingCombo && existingCombo.name !== trimmedName) {
          await updateKitCombo.mutateAsync({
            id: selectedComboId,
            name: trimmedName,
            kitId: selectedKitId,
          });
        }
      }

      // 3. Guardar items y cantidades del combo
      await saveComboItems.mutateAsync({
        comboId: targetComboId,
        items: includedRows.map((r) => ({
          product_id: r.productId,
          quantity: r.quantity,
        })),
      });

      const linkedNote =
        newlyLinkedCount > 0
          ? ` (${newlyLinkedCount} repuesto${newlyLinkedCount > 1 ? 's' : ''} vinculado${newlyLinkedCount > 1 ? 's' : ''} al kit)`
          : '';
      toast.success(
        saveMode === 'new'
          ? `Combo "${trimmedName}" guardado en ${selectedKit?.name}${linkedNote}`
          : `Combo "${trimmedName}" actualizado en ${selectedKit?.name}${linkedNote}`
      );
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving cart as combo:', err);
      toast.error('Error al guardar el combo', { description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  const allIncluded = draftRows.length > 0 && draftRows.every((r) => r.included);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] w-[95vw] p-0 overflow-hidden bg-white rounded-md border border-slate-200 shadow-2xl gap-0 [&>button]:text-slate-300 [&>button]:hover:text-white">
        {/* Cabecera Industrial */}
        <DialogHeader className="px-5 py-4 bg-[#0F172A] text-white border-b border-slate-800">
          <div className="flex items-center gap-3 pr-7">
            <div className="w-9 h-9 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-[15px] font-bold text-white tracking-tight">
                Guardar Carrito como Combo
              </DialogTitle>
              <DialogDescription className="text-[11.5px] text-slate-400 mt-0.5">
                Guarda los repuestos seleccionados en un cotizador sin limpiar tu carrito actual.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido scrollable */}
        <div className="max-h-[74vh] overflow-y-auto p-5 bg-[#F8FAFC] space-y-4">
          {/* Alerta por ítems manuales excluidos */}
          {excludedManualNames.length > 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-[12px]">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {excludedManualNames.length} ítem{excludedManualNames.length > 1 ? 's' : ''} manual{excludedManualNames.length > 1 ? 'es' : ''} excluido{excludedManualNames.length > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  No existen en el catálogo de inventario y no pueden incluirse en un combo:{' '}
                  <span className="font-semibold">{excludedManualNames.join(', ')}</span>
                </p>
              </div>
            </div>
          )}

          {draftRows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-md p-8 text-center">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-[13px] font-semibold text-slate-700">
                No hay productos de inventario en el carrito
              </p>
              <p className="text-[11.5px] text-slate-500 mt-1">
                Agrega repuestos del catálogo al carrito para poder guardarlos como combo.
              </p>
            </div>
          ) : (
            <>
              {/* Sección 1: Selección de Kit Destino */}
              <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    1. Cotizador / Kit Destino
                  </label>
                  <div className="flex items-center gap-1 flex-wrap">
                    {KIT_CATEGORY_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryFilter(tab.id)}
                        className={cn(
                          'px-2 py-1 text-[11px] font-semibold rounded-sm border transition-colors cursor-pointer',
                          categoryFilter === tab.id
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    value={kitSearch}
                    onChange={(e) => setKitSearch(e.target.value)}
                    placeholder="Buscar motor, clutch o tren delantero..."
                    className="pl-8 h-8 text-[12px] bg-white border-slate-200 rounded-sm focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-sm bg-white">
                  {isLoadingKits ? (
                    <div className="p-4 text-center text-[12px] text-slate-500">
                      Cargando cotizadores...
                    </div>
                  ) : filteredKits.length === 0 ? (
                    <div className="p-4 text-center text-[12px] text-slate-500">
                      No se encontraron kits con ese filtro.
                    </div>
                  ) : (
                    filteredKits.map(({ kit, matchCount }) => {
                      const isSelected = selectedKitId === kit.id;
                      return (
                        <button
                          key={kit.id}
                          type="button"
                          onClick={() => setSelectedKitId(kit.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer',
                            isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                'w-4 h-4 rounded-sm border flex items-center justify-center shrink-0',
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 bg-white'
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </span>
                            <span className="text-[12.5px] font-bold text-slate-900 truncate">
                              {kit.name}
                            </span>
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {kit.category}
                            </span>
                          </div>

                          {matchCount > 0 && (
                            <span className="text-[10.5px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                              {matchCount}/{draftRows.length} en kit
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sección 2: Modo y Nombre del Combo */}
              <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    2. Configuración del Combo
                  </label>
                  <div className="flex p-0.5 bg-slate-100 border border-slate-200 rounded-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setSaveMode('new');
                        setComboName('');
                      }}
                      className={cn(
                        'px-2.5 py-1 text-[11px] font-bold rounded-sm transition-colors cursor-pointer',
                        saveMode === 'new'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      Crear nuevo
                    </button>
                    <button
                      type="button"
                      disabled={kitCombos.length === 0}
                      onClick={() => {
                        setSaveMode('existing');
                        if (kitCombos[0]) {
                          setSelectedComboId(kitCombos[0].id);
                          setComboName(kitCombos[0].name || '');
                        }
                      }}
                      className={cn(
                        'px-2.5 py-1 text-[11px] font-bold rounded-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                        saveMode === 'existing'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      Actualizar existente ({isLoadingCombos ? '...' : kitCombos.length})
                    </button>
                  </div>
                </div>

                {saveMode === 'existing' && kitCombos.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 block">
                      Combo a sobrescribir
                    </label>
                    <select
                      value={selectedComboId}
                      onChange={(e) => handleSelectExistingCombo(e.target.value)}
                      className="w-full h-9 px-2.5 text-[12px] font-medium bg-white border border-slate-200 rounded-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {kitCombos.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {`${c.name} (${c.kit_combo_items?.length || 0} repuestos actuales)`}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10.5px] text-amber-700">
                      Al guardar se reemplazarán los ítems actuales de este combo por los seleccionados abajo.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    Nombre del Combo *
                  </label>
                  <Input
                    value={comboName}
                    onChange={(e) => setComboName(e.target.value)}
                    placeholder="Ej. Tren Delantero MOOG Completo / Kit Anillado STD"
                    className="h-9 text-[12.5px] bg-white border-slate-200 rounded-sm focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Sección 3: Lista de Productos del Carrito */}
              <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[11.5px] font-bold text-slate-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allIncluded}
                      onChange={(e) => toggleAllRows(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      3. Productos a incluir ({includedRows.length}/{draftRows.length})
                    </span>
                  </label>
                  {unlinkedCount > 0 && selectedKit && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm">
                      <Link2 className="w-3 h-3" />
                      {unlinkedCount} se vinculará{unlinkedCount > 1 ? 'n' : ''} a {selectedKit.name}
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {draftRows.map((row) => {
                    const willAutoLink = selectedKit && !selectedKitProductIds.has(row.productId);
                    return (
                      <div
                        key={row.productId}
                        className={cn(
                          'px-4 py-2.5 flex items-center justify-between gap-3 transition-colors',
                          !row.included && 'opacity-50 bg-slate-50/60'
                        )}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={row.included}
                            onChange={(e) =>
                              updateRow(row.productId, (r) => ({ ...r, included: e.target.checked }))
                            }
                            className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold text-slate-900 leading-snug truncate">
                              {row.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10.5px] font-mono text-slate-500">
                                {row.code || '—'}
                              </span>
                              {row.brandName && (
                                <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-sm border border-slate-200">
                                  {row.brandName}
                                </span>
                              )}
                              {willAutoLink && row.included && (
                                <span className="text-[9.5px] font-semibold text-blue-700 bg-blue-50 px-1.5 rounded-sm border border-blue-200">
                                  + Vincular al kit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controles de cantidad y subtotal */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(row.productId, (r) => ({
                                  ...r,
                                  quantity: Math.max(1, r.quantity - 1),
                                }))
                              }
                              className="w-6 h-6 rounded-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                              title="Disminuir cantidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center text-[12px] font-bold font-mono tabular-nums text-slate-900">
                              {row.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(row.productId, (r) => ({
                                  ...r,
                                  quantity: r.quantity + 1,
                                }))
                              }
                              className="w-6 h-6 rounded-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                              title="Aumentar cantidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="w-16 text-right">
                            <span className="text-[12px] font-bold font-mono tabular-nums text-slate-900">
                              {formatUSD(row.unitPriceUsd * row.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-slate-600">
            Total del combo:{' '}
            <span className="font-bold font-mono tabular-nums text-emerald-700">
              {formatUSD(totalComboUsd)}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-9 px-3.5 text-[12px] rounded-sm border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || includedRows.length === 0 || !selectedKitId || !comboName.trim()}
              className="h-9 px-4 text-[12px] font-bold rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  {saveMode === 'new' ? 'Guardar Combo' : 'Actualizar Combo'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
