'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  useProducts,
  useCategories,
  useBrands,
  useDefaultMinStock,
  useUpdateDefaultMinStock,
  useBulkUpdateMinStock,
} from '@/hooks/use-supabase';
import {
  Zap,
  Layers,
  CheckCircle2,
  Loader2,
  Tags,
  SlidersHorizontal,
  Package,
} from 'lucide-react';

interface BulkMinStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkMinStockDialog({ open, onOpenChange }: BulkMinStockDialogProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'bulk'>('global');

  // Hooks
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: defaultMinStock = 0 } = useDefaultMinStock();
  const updateDefaultMinStock = useUpdateDefaultMinStock();
  const bulkUpdateMinStock = useBulkUpdateMinStock();

  // Tab 1 state: Global Default
  const [globalValue, setGlobalValue] = useState('2');

  // Tab 2 state: Bulk by Category or Brand
  const [targetType, setTargetType] = useState<'category' | 'brand' | 'all'>('category');
  const [selectedId, setSelectedId] = useState('');
  const [bulkValue, setBulkValue] = useState('3');
  const [onlyWithoutRule, setOnlyWithoutRule] = useState(true);

  useEffect(() => {
    if (open) {
      setGlobalValue(defaultMinStock > 0 ? defaultMinStock.toString() : '2');
      if (categories.length > 0 && !selectedId) {
        setSelectedId(categories[0].id);
      }
    }
  }, [open, defaultMinStock, categories]);

  // Handle Tab 1: Save Global Default
  const handleSaveGlobal = async (applyToDbDirectly = false) => {
    const val = parseInt(globalValue, 10);
    if (isNaN(val) || val < 0) {
      toast.error('Ingresa un número entero válido mayor o igual a 0');
      return;
    }

    try {
      await updateDefaultMinStock.mutateAsync(val);

      if (applyToDbDirectly) {
        const count = await bulkUpdateMinStock.mutateAsync({
          minStock: val,
          filterType: 'all',
          onlyWithoutRule: true,
        });
        toast.success(`Regla global guardada y aplicada a ${count} repuestos en el catálogo`);
      } else {
        toast.success(`Stock mínimo global configurado en ${val} unidades`);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    }
  };

  // Solo consideramos productos que tienen precio asignado (> 0) para no manchar con productos sin depurar
  const pricedProducts = useMemo(() => products.filter((p) => (p.price_usd ?? 0) > 0), [products]);

  // Compute product counts for dropdowns (solo productos con precio)
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    pricedProducts.forEach((p) => {
      if (p.category_id) {
        map.set(p.category_id, (map.get(p.category_id) || 0) + 1);
      }
    });
    return map;
  }, [pricedProducts]);

  const brandCounts = useMemo(() => {
    const map = new Map<string, number>();
    pricedProducts.forEach((p) => {
      if (p.brand_id) {
        map.set(p.brand_id, (map.get(p.brand_id) || 0) + 1);
      }
    });
    return map;
  }, [pricedProducts]);

  // Selected target products count estimate (solo productos con precio)
  const affectedCount = useMemo(() => {
    let list = pricedProducts;
    if (targetType === 'category') {
      list = list.filter((p) => p.category_id === selectedId);
    } else if (targetType === 'brand') {
      list = list.filter((p) => p.brand_id === selectedId);
    }

    if (onlyWithoutRule) {
      list = list.filter((p) => !p.min_stock || p.min_stock === 0);
    }

    return list.length;
  }, [pricedProducts, targetType, selectedId, onlyWithoutRule]);

  // Handle Tab 2: Apply Bulk Min Stock
  const handleApplyBulk = async () => {
    const val = parseInt(bulkValue, 10);
    if (isNaN(val) || val < 0) {
      toast.error('Ingresa un número válido para el stock mínimo');
      return;
    }

    if (targetType !== 'all' && !selectedId) {
      toast.error('Selecciona una opción de la lista');
      return;
    }

    try {
      const updatedCount = await bulkUpdateMinStock.mutateAsync({
        minStock: val,
        filterType: targetType,
        filterValue: targetType === 'all' ? undefined : selectedId,
        onlyWithoutRule,
      });

      toast.success(`Se asignó stock mínimo de ${val} unidades a ${updatedCount} repuestos.`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Error durante la asignación masiva: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
            Asignación de Stock Mínimo
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Configura reglas automáticas para alimentar el sistema de alertas de existencias bajas.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'global'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            1. Valor Global por Defecto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'bulk'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            2. Por Categoría / Marca
          </button>
        </div>

        {/* Tab 1 Content: Global Default */}
        {activeTab === 'global' && (
          <div className="space-y-4 py-3">
            <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-800">
                <Zap className="w-4 h-4 text-amber-600" /> ¿Cómo funciona el valor global?
              </span>
              <p className="leading-relaxed text-slate-700">
                Aplica como regla base para <strong>todos los repuestos con precio asignado</strong> que no tengan un stock mínimo individual. Los repuestos pendientes por depurar (sin precio o en $0) se omiten automáticamente para no manchar tus alertas.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Stock Mínimo Global por Defecto (unidades):
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={globalValue}
                onChange={(e) => setGlobalValue(e.target.value)}
                placeholder="Ej: 2"
                className="font-bold text-base h-11"
              />
              <p className="text-[11px] text-slate-400">
                Recomendado: <strong>2 o 3 unidades</strong> para tiendas de repuestos automotrices.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={updateDefaultMinStock.isPending || bulkUpdateMinStock.isPending}
                onClick={() => handleSaveGlobal(false)}
                className="flex-1 text-xs font-semibold cursor-pointer"
              >
                Guardar Regla Global
              </Button>
              <Button
                type="button"
                disabled={updateDefaultMinStock.isPending || bulkUpdateMinStock.isPending}
                onClick={() => handleSaveGlobal(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                {updateDefaultMinStock.isPending || bulkUpdateMinStock.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Guardar y Aplicar a BD
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2 Content: Bulk by Category or Brand */}
        {activeTab === 'bulk' && (
          <div className="space-y-4 py-3">
            {/* Criteria Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Criterio de Asignación:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType('category');
                    if (categories[0]) setSelectedId(categories[0].id);
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                    targetType === 'category'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 inline mr-1" />
                  Por Categoría
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetType('brand');
                    if (brands[0]) setSelectedId(brands[0].id);
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                    targetType === 'brand'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Tags className="w-3.5 h-3.5 inline mr-1" />
                  Por Marca
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('all')}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                    targetType === 'all'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 inline mr-1" />
                  Todo el Catálogo
                </button>
              </div>
            </div>

            {/* Target Select Dropdown */}
            {targetType === 'category' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Selecciona la Categoría:</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  {categories.map((c) => {
                    const count = categoryCounts.get(c.id) || 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({count} repuestos)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {targetType === 'brand' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Selecciona la Marca:</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  {brands.map((b) => {
                    const count = brandCounts.get(b.id) || 0;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} ({count} repuestos)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Value input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Stock Mínimo a Asignar (unidades):
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="Ej: 3"
                className="font-bold text-base h-11"
              />
            </div>

            {/* Checkbox: only without rule */}
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={onlyWithoutRule}
                onChange={(e) => setOnlyWithoutRule(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-0"
              />
              <span className="font-medium">
                Solo aplicar a repuestos que <strong>no tienen stock mínimo asignado</strong> (evita sobrescribir reglas personalizadas)
              </span>
            </label>

            {/* Live Estimation Box */}
            <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-lg text-xs text-blue-900 flex items-center justify-between">
              <div>
                <span className="font-bold block">Repuestos a actualizar:</span>
                <span className="text-[10px] text-blue-600 block">Solo incluye repuestos con precio asignado (&gt; $0)</span>
              </div>
              <span className="font-black text-sm bg-white px-2 py-0.5 rounded border border-blue-200">
                {affectedCount} repuestos
              </span>
            </div>

            {/* Apply Button */}
            <Button
              type="button"
              disabled={bulkUpdateMinStock.isPending || affectedCount === 0}
              onClick={handleApplyBulk}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 cursor-pointer"
            >
              {bulkUpdateMinStock.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Actualizando repuestos...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Aplicar Stock Mínimo a {affectedCount} Repuestos
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
