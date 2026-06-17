'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart-store';
import { Product, Kit } from '@/types';
import { formatUSD } from '@/lib/utils';
import { Package, ShoppingCart, Check, SlidersHorizontal, Info } from 'lucide-react';
import { toast } from 'sonner';

interface LoadComboDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: Kit;
  kitItems: any[];
  bcvRate: number;
  bcvMultiplier: number;
}

export function LoadComboDialog({
  open,
  onOpenChange,
  kit,
  kitItems,
  bcvRate,
  bcvMultiplier,
}: LoadComboDialogProps) {
  const { addItem } = useCartStore();
  const [comboName, setComboName] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Group kit items by category
  const categoriesWithProducts = useMemo(() => {
    const map: Record<string, { categoryName: string; items: any[] }> = {};
    kitItems.forEach((ki) => {
      const p = ki.products;
      if (!p) return;
      const catName = p.categories?.name || 'Sin Categoría';
      if (!map[catName]) {
        map[catName] = { categoryName: catName, items: [] };
      }
      map[catName].items.push(ki);
    });
    return Object.values(map).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [kitItems]);

  // Extract unique brand names available in the kit
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    kitItems.forEach((ki) => {
      const brandName = ki.products?.brands?.name;
      if (brandName) {
        brandsSet.add(brandName);
      }
    });
    return Array.from(brandsSet).sort();
  }, [kitItems]);

  // Initialize selections when dialog opens
  useEffect(() => {
    if (open) {
      const initialProductIds: Record<string, string> = {};
      const initialQuantities: Record<string, number> = {};
      categoriesWithProducts.forEach((cat) => {
        if (cat.items.length > 0) {
          // Select the first product by default
          initialProductIds[cat.categoryName] = cat.items[0].products.id;
          initialQuantities[cat.categoryName] = cat.items[0].quantity || 1;
        }
      });
      setSelectedProductIds(initialProductIds);
      setQuantities(initialQuantities);
      setComboName('');
    }
  }, [open, categoriesWithProducts]);

  // Apply a brand preset (e.g. "Combo Moog")
  const handleApplyBrandPreset = (brandName: string) => {
    const updatedIds = { ...selectedProductIds };
    const updatedQuantities = { ...quantities };

    categoriesWithProducts.forEach((cat) => {
      // Find item matching the selected brand
      const matchingItem = cat.items.find(
        (ki) => ki.products?.brands?.name?.toLowerCase() === brandName.toLowerCase()
      );
      if (matchingItem) {
        updatedIds[cat.categoryName] = matchingItem.products.id;
        updatedQuantities[cat.categoryName] = matchingItem.quantity || 1;
      }
    });

    setSelectedProductIds(updatedIds);
    setQuantities(updatedQuantities);
    setComboName(`Combo ${brandName}`);
    toast.success(`Filtro de marca "${brandName}" aplicado a las categorías.`);
  };

  // Calculate total price of current selection
  const selectionTotal = useMemo(() => {
    let total = 0;
    categoriesWithProducts.forEach((cat) => {
      const selectedId = selectedProductIds[cat.categoryName];
      if (selectedId && selectedId !== 'none') {
        const item = cat.items.find((ki) => ki.products.id === selectedId);
        if (item && item.products) {
          const qty = quantities[cat.categoryName] || 1;
          total += (item.products.price_usd || 0) * qty;
        }
      }
    });
    return total;
  }, [categoriesWithProducts, selectedProductIds, quantities]);

  const handleLoadCombo = () => {
    const itemsToAdd: { product: Product; quantity: number }[] = [];
    categoriesWithProducts.forEach((cat) => {
      const selectedId = selectedProductIds[cat.categoryName];
      if (selectedId && selectedId !== 'none') {
        const item = cat.items.find((ki) => ki.products.id === selectedId);
        if (item && item.products) {
          itemsToAdd.push({
            product: item.products,
            quantity: quantities[cat.categoryName] || 1,
          });
        }
      }
    });

    if (itemsToAdd.length === 0) {
      toast.error('Selecciona al menos un repuesto para cargar al carrito');
      return;
    }

    // Add all items to the cart
    itemsToAdd.forEach((item) => {
      addItem({
        product_id: item.product.id,
        product_name: item.product.name,
        product_code: item.product.code,
        quantity: item.quantity,
        unit_price_usd: item.product.price_usd || 0,
        image_url: item.product.image_url,
        brand_name: item.product.brands?.name,
        brand_logo_url: item.product.brands?.logo_url,
        stock: item.product.stock,
      });
    });

    toast.success(`Combo "${comboName || 'Personalizado'}" cargado con éxito`, {
      description: `Se añadieron ${itemsToAdd.length} repuestos al carrito de cotización.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] p-0 overflow-hidden bg-slate-50 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
            Configurar y Cargar Combo
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Arma tu combo personalizado eligiendo qué repuesto deseas para cada categoría del cotizador de {kit.name}.
          </p>
        </DialogHeader>

        {/* Scrollable Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Brand Selectors */}
          {availableBrands.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-500" />
                Preseleccionar Combo por Marca
              </h4>
              <div className="flex flex-wrap gap-2">
                {availableBrands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => handleApplyBrandPreset(brand)}
                    className="h-8 px-3.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-full transition-all active:scale-95 flex items-center gap-1"
                  >
                    <span>{brand}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Combo Name Input */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Nombre del Combo (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Combo Moog, Combo Premium..."
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              className="w-full px-3.5 h-[38px] rounded-lg bg-white border border-slate-200 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all font-medium"
            />
          </div>

          {/* Categories list */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Selección de Repuestos
            </h4>
            {categoriesWithProducts.map((cat) => {
              const currentSelectedId = selectedProductIds[cat.categoryName] || 'none';
              const currentQty = quantities[cat.categoryName] || 1;

              return (
                <div
                  key={cat.categoryName}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  {/* Category Name & Indicator */}
                  <div className="md:w-[150px] shrink-0">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide leading-tight">
                      {cat.categoryName}
                    </span>
                  </div>

                  {/* Dropdown Selector */}
                  <div className="flex-1">
                    <select
                      value={currentSelectedId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedProductIds((prev) => ({ ...prev, [cat.categoryName]: val }));
                        // Update default quantity if a product is selected
                        if (val !== 'none') {
                          const item = cat.items.find((ki) => ki.products.id === val);
                          if (item) {
                            setQuantities((prev) => ({ ...prev, [cat.categoryName]: item.quantity || 1 }));
                          }
                        }
                      }}
                      className={`w-full px-3 h-[38px] rounded-lg border text-xs font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all ${
                        currentSelectedId === 'none'
                          ? 'bg-slate-50 border-slate-200 text-slate-400'
                          : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                      }`}
                    >
                      <option value="none">-- No incluir en este combo --</option>
                      {cat.items.map((item) => {
                        const p = item.products;
                        const brandText = p.brands?.name ? `[${p.brands.name}] ` : '';
                        const sizeText = p.name.includes('(') ? ` (${p.name.substring(p.name.indexOf('('))})` : '';
                        return (
                          <option key={p.id} value={p.id}>
                            {brandText}
                            {p.name.replace(/\(.*?\)/g, '').trim()} 
                            {` — ${formatUSD(p.price_usd)}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Quantity and Details */}
                  {currentSelectedId !== 'none' && (
                    <div className="flex items-center gap-3 shrink-0 justify-end">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantities((prev) => ({
                              ...prev,
                              [cat.categoryName]: Math.max(1, currentQty - 1),
                            }))
                          }
                          className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-500 hover:bg-slate-200 rounded transition-all active:scale-95"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={currentQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1) {
                              setQuantities((prev) => ({ ...prev, [cat.categoryName]: val }));
                            }
                          }}
                          className="w-9 text-center bg-transparent border-none text-xs font-bold focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setQuantities((prev) => ({
                              ...prev,
                              [cat.categoryName]: currentQty + 1,
                            }))
                          }
                          className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-500 hover:bg-slate-200 rounded transition-all active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with totals */}
        <div className="p-6 border-t border-slate-200 bg-white shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Estimado del Combo
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {formatUSD(selectionTotal)}
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {formatUSD(selectionTotal * bcvMultiplier)} BCV
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Equivalente aproximado en Bolívares: Bs {(selectionTotal * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-300 text-slate-700 font-semibold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLoadCombo}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 shadow-md shadow-emerald-500/10 px-6"
            >
              <ShoppingCart className="w-4 h-4" />
              Cargar Combo al Carrito
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
