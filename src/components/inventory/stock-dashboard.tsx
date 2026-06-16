'use client';

import { useState, useMemo } from 'react';
import { useProducts, useUpdateProduct, useBrands } from '@/hooks/use-supabase';
import { Product } from '@/types';
import { formatUSD } from '@/lib/utils';
import { 
  Boxes, 
  Search 
} from 'lucide-react';
import { toast } from 'sonner';

export function StockDashboard() {
  const { data: products = [], isLoading } = useProducts();
  const updateProduct = useUpdateProduct();
  const { data: brands = [] } = useBrands();

  const [searchQuery, setSearchQuery] = useState('');
  const [quickAdjustId, setQuickAdjustId] = useState<string | null>(null);
  const [adjustVal, setAdjustVal] = useState('');

  // ===== FILTERED OUT-OF-STOCK PRODUCTS =====
  const outOfStockProducts = useMemo(() => {
    const missing = products.filter((p) => (p.stock || 0) === 0);
    if (!searchQuery) return missing;
    const search = searchQuery.toLowerCase();
    return missing.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search) ||
        (p.brands?.name || '').toLowerCase().includes(search)
    );
  }, [products, searchQuery]);

  // ===== ACTIONS =====
  const handleQuickAdd = async (product: Product, amount: number) => {
    try {
      const currentStock = product.stock || 0;
      const newStock = Math.max(0, currentStock + amount);
      await updateProduct.mutateAsync({
        id: product.id,
        stock: newStock
      });
      toast.success(`Stock de ${product.code} actualizado a ${newStock}`);
    } catch (error: any) {
      toast.error('Error al actualizar el stock', { description: error.message });
    }
  };

  const handleCustomAdjust = async (product: Product) => {
    const parsedVal = parseInt(adjustVal, 10);
    if (isNaN(parsedVal) || parsedVal < 0) {
      toast.error('Ingresa una cantidad válida mayor o igual a 0');
      return;
    }
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        stock: parsedVal
      });
      toast.success(`Existencia de ${product.code} establecida en ${parsedVal}`);
      setQuickAdjustId(null);
      setAdjustVal('');
    } catch (error: any) {
      toast.error('Error al actualizar', { description: error.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando control de stock...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Control de Stock y Alertas</h2>
        <p className="text-sm text-slate-500 mt-1">Supervisa y gestiona las alertas de productos agotados en tiempo real.</p>
      </div>

      <div className="w-full">
        {/* Missing Products Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[16px] text-slate-900">Alerta de Faltantes / Quiebres de Stock</h3>
              <p className="text-xs text-slate-500 mt-0.5">Muestra los productos con 0 unidades en inventario.</p>
            </div>
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Buscar faltantes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-[32px] rounded bg-white border border-slate-200 text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Código</th>
                  <th className="px-5 py-3 text-left">Descripción / Repuesto</th>
                  <th className="px-5 py-3 text-left">Marca</th>
                  <th className="px-5 py-3 text-right">Costo</th>
                  <th className="px-5 py-3 text-left">Ubicación</th>
                  <th className="px-5 py-3 text-center w-[185px] min-w-[185px]">Existencias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {outOfStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-semibold">¡No hay productos agotados!</p>
                      <p className="text-[11px]">Tu inventario está completamente abastecido.</p>
                    </td>
                  </tr>
                ) : (
                  outOfStockProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-[11.5px] text-slate-500">{p.code}</td>
                      <td className="px-5 py-3 font-bold text-[13px] text-slate-900 max-w-[240px] truncate" title={p.name}>
                        {p.name}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
                          {p.brands?.name || '---'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-500">{formatUSD(p.cost)}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{p.location || '---'}</td>
                      <td className="px-5 py-3 text-center w-[185px] min-w-[185px] whitespace-nowrap">
                        {quickAdjustId === p.id ? (
                          <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              placeholder="Cant"
                              value={adjustVal}
                              onChange={(e) => setAdjustVal(e.target.value)}
                              className="w-16 h-7 text-center text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                              autoFocus
                            />
                            <button
                              onClick={() => handleCustomAdjust(p)}
                              className="h-7 px-2 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shrink-0"
                            >
                              Fijar
                            </button>
                            <button
                              onClick={() => { setQuickAdjustId(null); setAdjustVal(''); }}
                              className="h-7 px-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors shrink-0"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[12px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                              0
                            </span>
                            <button
                              onClick={() => handleQuickAdd(p, 5)}
                              className="h-7 w-7 text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 rounded flex items-center justify-center transition-all active:scale-95 shrink-0"
                              title="+5 Unidades"
                            >
                              +5
                            </button>
                            <button
                              onClick={() => setQuickAdjustId(p.id)}
                              className="h-7 px-2.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent rounded transition-colors shrink-0"
                              title="Establecer cantidad específica"
                            >
                              Editar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
