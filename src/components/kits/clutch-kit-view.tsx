'use client';

import { useState, useMemo } from 'react';
import { Kit, Product } from '@/types';
import { useKitItems, useCreateKitItem, useDeleteKitItem, useProducts, useBcvRate, useBcvMultiplier } from '@/hooks/use-supabase';
import { useCartStore } from '@/store/cart-store';
import { formatUSD, formatBs, calculateBcvPrice, cn } from '@/lib/utils';
import { 
  Disc3, 
  Plus, 
  Search, 
  Trash2, 
  ShoppingCart, 
  Package, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ExternalLink,
  Layers,
  Wrench,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ClutchKitViewProps {
  kit: Kit;
  readOnly?: boolean;
}

interface ParsedClutchSpecs {
  platos: string[];
  discos: string[];
  collarines: string[];
  bombines: string[];
}

export function ClutchKitView({ kit, readOnly = false }: ClutchKitViewProps) {
  const { data: kitItems = [], isLoading } = useKitItems(kit.id);
  const deleteKitItem = useDeleteKitItem();
  const createKitItem = useCreateKitItem();
  const { data: products = [] } = useProducts();
  const { addItem } = useCartStore();
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();

  const [activeFilter, setActiveFilter] = useState<'all' | 'plato' | 'disco' | 'collarin' | 'bombin' | 'kit_completo'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  // 1. Extraer códigos especificados en la descripción (ej: "PLATO: 1930 o 1770 | DISCO: 768 | COLLARIN: 1054 HV")
  const parsedSpecs = useMemo<ParsedClutchSpecs>(() => {
    const desc = kit.description || '';
    const specs: ParsedClutchSpecs = {
      platos: [],
      discos: [],
      collarines: [],
      bombines: [],
    };

    if (!desc) return specs;

    const parts = desc.split('|');
    parts.forEach((part) => {
      const lower = part.toLowerCase().trim();
      if (lower.includes('plato')) {
        const clean = part.replace(/plato\s*:?/i, '').trim();
        specs.platos = clean.split(/\s+o\s+|\s*-\s*|\s*,\s*/i).map(s => s.trim()).filter(Boolean);
      } else if (lower.includes('disco')) {
        const clean = part.replace(/disco\s*:?/i, '').trim();
        specs.discos = clean.split(/\s+o\s+|\s*-\s*|\s*,\s*/i).map(s => s.trim()).filter(Boolean);
      } else if (lower.includes('collarin') || lower.includes('collarín')) {
        const clean = part.replace(/collar[ií]n\s*:?/i, '').trim();
        specs.collarines = clean.split(/\s+o\s+|\s*-\s*|\s*,\s*/i).map(s => s.trim()).filter(Boolean);
      } else if (lower.includes('bombin') || lower.includes('bombín')) {
        const clean = part.replace(/bomb[ií]n\s*:?/i, '').trim();
        specs.bombines = clean.split(/\s+o\s+|\s*-\s*|\s*,\s*/i).map(s => s.trim()).filter(Boolean);
      }
    });

    return specs;
  }, [kit.description]);

  // Clasificar un producto individual en su categoría de clutch
  const classifyProduct = (product: Product): 'plato' | 'disco' | 'collarin' | 'bombin' | 'kit_completo' | 'otro' => {
    const text = `${product.name} ${product.code} ${product.categories?.name || ''}`.toUpperCase();
    if (/KIT\s*(CROCHE|CLUTCH)/i.test(text)) return 'kit_completo';
    if (/PLATO|PRENSA/i.test(text)) return 'plato';
    if (/DISCO/i.test(text)) return 'disco';
    if (/COLLAR[IÍ]N|ROLINERA\s*COLLAR[IÍ]N|\bCT24|\bCB\d|\bCB-/i.test(text)) return 'collarin';
    if (/BOMB[IÍ]N|CILINDRO\s*(ESCLAVO|MAESTRO)|BOMBA\s*(CLUTCH|CROCHE)/i.test(text)) return 'bombin';
    return 'otro';
  };

  // Filtrar los items vinculados al kit
  const filteredKitItems = useMemo(() => {
    return kitItems.filter((item) => {
      const product = item.products;
      if (!product) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesText = 
          product.name.toLowerCase().includes(q) ||
          product.code.toLowerCase().includes(q) ||
          product.brands?.name?.toLowerCase().includes(q);
        if (!matchesText) return false;
      }

      if (activeFilter !== 'all') {
        const type = classifyProduct(product);
        if (type !== activeFilter) return false;
      }

      return true;
    });
  }, [kitItems, searchQuery, activeFilter]);

  // Agrupar items vinculados por tipo
  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {
      plato: [],
      disco: [],
      collarin: [],
      bombin: [],
      kit_completo: [],
      otro: [],
    };

    filteredKitItems.forEach((item) => {
      if (!item.products) return;
      const type = classifyProduct(item.products);
      groups[type].push(item);
    });

    return groups;
  }, [filteredKitItems]);

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    addItem({
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      quantity,
      unit_price_usd: product.price_usd || 0,
      image_url: product.image_url,
      brand_name: product.brands?.name,
      brand_logo_url: product.brands?.logo_url,
      stock: product.stock,
    });
    toast.success(`${product.name} añadido al carrito`);
  };

  const handleAddFullKitToCart = () => {
    // Buscar el mejor plato, disco y collarín con stock > 0 (o el primero disponible)
    const bestPlato = groupedItems.plato.find((it: any) => (it.products?.stock ?? 0) > 0) || groupedItems.plato[0];
    const bestDisco = groupedItems.disco.find((it: any) => (it.products?.stock ?? 0) > 0) || groupedItems.disco[0];
    const bestCollarin = groupedItems.collarin.find((it: any) => (it.products?.stock ?? 0) > 0) || groupedItems.collarin[0];

    let addedCount = 0;
    if (bestPlato?.products) {
      handleAddToCart(bestPlato.products, 1);
      addedCount++;
    }
    if (bestDisco?.products) {
      handleAddToCart(bestDisco.products, 1);
      addedCount++;
    }
    if (bestCollarin?.products) {
      handleAddToCart(bestCollarin.products, 1);
      addedCount++;
    }

    if (addedCount > 0) {
      toast.success(`Kit de croche añadido (${addedCount} piezas)`, {
        description: 'Plato, Disco y Collarín cargados al cotizador'
      });
    } else {
      toast.warning('No hay platos, discos o collarines vinculados para armar el kit completo.');
    }
  };

  const handleRemoveItem = async (itemId: string, productName: string) => {
    if (confirm(`¿Desvincular "${productName}" de este kit de clutch?`)) {
      try {
        await deleteKitItem.mutateAsync({ id: itemId, kitId: kit.id });
        toast.success(`"${productName}" desvinculado`);
      } catch (error: any) {
        toast.error('Error al desvincular', { description: error.message });
      }
    }
  };

  const handleLinkProduct = async (product: Product) => {
    try {
      await createKitItem.mutateAsync({
        kit_id: kit.id,
        product_id: product.id,
        quantity: 1,
      });
      toast.success(`${product.name} vinculado al kit de clutch`);
      setIsLinkDialogOpen(false);
    } catch (error: any) {
      toast.error('Error al vincular repuesto', { description: error.message });
    }
  };

  const openLinkDialogForCode = (code: string) => {
    setLinkSearchQuery(code);
    setIsLinkDialogOpen(true);
  };

  // Buscar repuestos disponibles en el inventario para vincular
  const existingProductIds = useMemo(() => new Set(kitItems.map((i: any) => i.product_id)), [kitItems]);
  const availableToLink = useMemo(() => {
    if (!linkSearchQuery || linkSearchQuery.length < 2) return [];
    const q = linkSearchQuery.toLowerCase().trim();
    return products
      .filter((p) => {
        if (existingProductIds.has(p.id)) return false;
        return (
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brands?.name?.toLowerCase().includes(q)
        );
      })
      .slice(0, 15);
  }, [products, linkSearchQuery, existingProductIds]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Código copiado al portapapeles');
  };

  // Cálculos de resumen
  const platoCount = groupedItems.plato.length;
  const discoCount = groupedItems.disco.length;
  const collarinCount = groupedItems.collarin.length;
  const bombinCount = groupedItems.bombin.length;
  const kitBoxCount = groupedItems.kit_completo.length;

  const platoStock = groupedItems.plato.reduce((acc, it) => acc + (it.products?.stock ?? 0), 0);
  const discoStock = groupedItems.disco.reduce((acc, it) => acc + (it.products?.stock ?? 0), 0);
  const collarinStock = groupedItems.collarin.reduce((acc, it) => acc + (it.products?.stock ?? 0), 0);

  const hasFullKitInStock = platoStock > 0 && discoStock > 0 && collarinStock > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando componentes de clutch...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen Superior del Kit de Clutch */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{kit.name}</h2>
                {hasFullKitInStock ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Kit Completo Disponible
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Piezas Incompletas
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {kit.description || 'Configuración de plato, disco, collarín y complementos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleAddFullKitToCart}
              disabled={platoCount === 0 || discoCount === 0 || collarinCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 gap-1.5 shadow-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              Cotizar Kit Completo (3 Piezas)
            </Button>
            {!readOnly && (
              <Button
                onClick={() => {
                  setLinkSearchQuery('');
                  setIsLinkDialogOpen(true);
                }}
                variant="outline"
                className="font-semibold text-xs h-9 gap-1.5 border-slate-300"
              >
                <Plus className="w-4 h-4" />
                Vincular Repuesto
              </Button>
            )}
          </div>
        </div>

        {/* Tarjetas resumen de existencias */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Platos de Presión</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-black text-blue-950">{platoCount} opciones</span>
              <span className={cn("text-xs font-bold", platoStock > 0 ? "text-emerald-700" : "text-rose-600")}>
                {platoStock} en stock
              </span>
            </div>
            {parsedSpecs.platos.length > 0 && (
              <p className="text-[11px] text-blue-600 font-medium mt-1 truncate">
                Ref: {parsedSpecs.platos.join(', ')}
              </p>
            )}
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Discos de Clutch</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-black text-emerald-950">{discoCount} opciones</span>
              <span className={cn("text-xs font-bold", discoStock > 0 ? "text-emerald-700" : "text-rose-600")}>
                {discoStock} en stock
              </span>
            </div>
            {parsedSpecs.discos.length > 0 && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1 truncate">
                Ref: {parsedSpecs.discos.join(', ')}
              </p>
            )}
          </div>

          <div className="bg-purple-50/60 border border-purple-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Collarines</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-black text-purple-950">{collarinCount} opciones</span>
              <span className={cn("text-xs font-bold", collarinStock > 0 ? "text-emerald-700" : "text-rose-600")}>
                {collarinStock} en stock
              </span>
            </div>
            {parsedSpecs.collarines.length > 0 && (
              <p className="text-[11px] text-purple-600 font-medium mt-1 truncate">
                Ref: {parsedSpecs.collarines.join(', ')}
              </p>
            )}
          </div>

          <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Bombines / Cajas</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-black text-amber-950">{bombinCount + kitBoxCount} vinculados</span>
              <span className="text-xs text-amber-800 font-medium">Hidráulicos</span>
            </div>
            <p className="text-[11px] text-amber-600 font-medium mt-1">
              Superior / Inferior
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0",
              activeFilter === 'all'
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            )}
          >
            Todos ({filteredKitItems.length})
          </button>
          <button
            onClick={() => setActiveFilter('plato')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5",
              activeFilter === 'plato'
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-700 hover:bg-blue-50 border border-blue-200"
            )}
          >
            Platos ({platoCount})
          </button>
          <button
            onClick={() => setActiveFilter('disco')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5",
              activeFilter === 'disco'
                ? "bg-emerald-600 text-white"
                : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
            )}
          >
            Discos ({discoCount})
          </button>
          <button
            onClick={() => setActiveFilter('collarin')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5",
              activeFilter === 'collarin'
                ? "bg-purple-600 text-white"
                : "bg-white text-purple-700 hover:bg-purple-50 border border-purple-200"
            )}
          >
            Collarines ({collarinCount})
          </button>
          <button
            onClick={() => setActiveFilter('bombin')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5",
              activeFilter === 'bombin'
                ? "bg-amber-600 text-white"
                : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200"
            )}
          >
            Bombines ({bombinCount})
          </button>
          {kitBoxCount > 0 && (
            <button
              onClick={() => setActiveFilter('kit_completo')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5",
                activeFilter === 'kit_completo'
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
              )}
            >
              Kits en Caja ({kitBoxCount})
            </button>
          )}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-[38px] rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Secciones de Componentes */}
      <div className="space-y-6">
        {/* 1. SECCIÓN: PLATOS DE PRESIÓN */}
        {(activeFilter === 'all' || activeFilter === 'plato') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-blue-50/70 px-5 py-3 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <h3 className="font-bold text-[13px] text-blue-900 uppercase tracking-wider">
                  Platos de Presión
                </h3>
                {parsedSpecs.platos.length > 0 && (
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    Códigos: {parsedSpecs.platos.join(' / ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {parsedSpecs.platos.map((code) => (
                  <Button
                    key={code}
                    onClick={() => openLinkDialogForCode(code)}
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] font-bold text-blue-700 hover:bg-blue-100 px-2 gap-1"
                  >
                    <Plus className="w-3 h-3" /> Vincular {code}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {groupedItems.plato.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No hay platos vinculados a esta aplicación</p>
                  {parsedSpecs.platos.length > 0 && (
                    <div className="mt-3 flex justify-center gap-2 flex-wrap">
                      {parsedSpecs.platos.map((code) => (
                        <Button
                          key={code}
                          size="sm"
                          onClick={() => openLinkDialogForCode(code)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Vincular Plato {code}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedItems.plato.map((item) => renderProductCard(item.products, item.id))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. SECCIÓN: DISCOS DE CLUTCH */}
        {(activeFilter === 'all' || activeFilter === 'disco') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-emerald-50/70 px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <h3 className="font-bold text-[13px] text-emerald-900 uppercase tracking-wider">
                  Discos de Clutch
                </h3>
                {parsedSpecs.discos.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    Códigos: {parsedSpecs.discos.join(' / ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {parsedSpecs.discos.map((code) => (
                  <Button
                    key={code}
                    onClick={() => openLinkDialogForCode(code)}
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 px-2 gap-1"
                  >
                    <Plus className="w-3 h-3" /> Vincular {code}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {groupedItems.disco.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No hay discos de clutch vinculados</p>
                  {parsedSpecs.discos.length > 0 && (
                    <div className="mt-3 flex justify-center gap-2 flex-wrap">
                      {parsedSpecs.discos.map((code) => (
                        <Button
                          key={code}
                          size="sm"
                          onClick={() => openLinkDialogForCode(code)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Vincular Disco {code}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedItems.disco.map((item) => renderProductCard(item.products, item.id))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. SECCIÓN: COLLARINES DE EMPUJE */}
        {(activeFilter === 'all' || activeFilter === 'collarin') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-purple-50/70 px-5 py-3 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                <h3 className="font-bold text-[13px] text-purple-900 uppercase tracking-wider">
                  Collarines de Empuje
                </h3>
                {parsedSpecs.collarines.length > 0 && (
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                    Códigos: {parsedSpecs.collarines.join(' / ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {parsedSpecs.collarines.map((code) => (
                  <Button
                    key={code}
                    onClick={() => openLinkDialogForCode(code)}
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] font-bold text-purple-700 hover:bg-purple-100 px-2 gap-1"
                  >
                    <Plus className="w-3 h-3" /> Vincular {code}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {groupedItems.collarin.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No hay collarines vinculados a esta aplicación</p>
                  {parsedSpecs.collarines.length > 0 && (
                    <div className="mt-3 flex justify-center gap-2 flex-wrap">
                      {parsedSpecs.collarines.map((code) => (
                        <Button
                          key={code}
                          size="sm"
                          onClick={() => openLinkDialogForCode(code)}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Vincular Collarín {code}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedItems.collarin.map((item) => renderProductCard(item.products, item.id))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. SECCIÓN: BOMBINES / CILINDROS */}
        {(activeFilter === 'all' || activeFilter === 'bombin') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-amber-50/70 px-5 py-3 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <h3 className="font-bold text-[13px] text-amber-900 uppercase tracking-wider">
                  Bombines / Cilindros Hidráulicos
                </h3>
              </div>
              <Button
                onClick={() => openLinkDialogForCode('bombin')}
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] font-bold text-amber-700 hover:bg-amber-100 px-2 gap-1"
              >
                <Plus className="w-3 h-3" /> Vincular Bombín
              </Button>
            </div>

            <div className="p-4">
              {groupedItems.bombin.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <p className="text-xs text-slate-500">Sin bombines registrados (Superior / Inferior)</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openLinkDialogForCode('bombin')}
                    className="mt-2 text-xs font-semibold h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Buscar Bombines
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedItems.bombin.map((item) => renderProductCard(item.products, item.id))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. SECCIÓN: KITS COMPLETOS EN CAJA (ej. FK-1930) */}
        {(activeFilter === 'all' || activeFilter === 'kit_completo') && groupedItems.kit_completo.length > 0 && (
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
            <div className="bg-indigo-50/70 px-5 py-3 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <h3 className="font-bold text-[13px] text-indigo-900 uppercase tracking-wider">
                  Kits Completos en Caja (Juegos Armados)
                </h3>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groupedItems.kit_completo.map((item) => renderProductCard(item.products, item.id))}
            </div>
          </div>
        )}

        {/* 6. OTROS REPUESTOS */}
        {groupedItems.otro.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
              <h3 className="font-bold text-[13px] text-slate-700 uppercase tracking-wider">
                Otros Accesorios y Repuestos Vinculados
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groupedItems.otro.map((item) => renderProductCard(item.products, item.id))}
            </div>
          </div>
        )}
      </div>

      {/* DIÁLOGO PARA VINCULAR REPUESTOS */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-5 border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Disc3 className="w-5 h-5 text-emerald-600" />
              Vincular Repuestos al Kit de Clutch
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            {/* Accesos rápidos de búsqueda por códigos del kit */}
            {kit.description && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Filtros rápidos según especificación:
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {[...parsedSpecs.platos, ...parsedSpecs.discos, ...parsedSpecs.collarines].map((c) => (
                    <button
                      key={c}
                      onClick={() => setLinkSearchQuery(c)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-bold transition-all border",
                        linkSearchQuery.toUpperCase() === c.toUpperCase()
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                      )}
                    >
                      🔍 {c}
                    </button>
                  ))}
                  <button
                    onClick={() => setLinkSearchQuery('bombin')}
                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                  >
                    Bombines
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Escribe el código o nombre del repuesto (ej: 1930, 811, CT24H)..."
                value={linkSearchQuery}
                onChange={(e) => setLinkSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 h-10 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2 mt-4">
              {availableToLink.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">
                  {linkSearchQuery.length < 2
                    ? 'Escribe al menos 2 caracteres o selecciona un código rápido para buscar'
                    : 'No se encontraron repuestos con ese criterio'}
                </p>
              ) : (
                availableToLink.map((p) => {
                  const roundedUsdBcv = calculateBcvPrice(p.price_usd || 0, bcvMultiplier);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all bg-white"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.code}
                          </span>
                          {p.brands?.name && (
                            <span className="text-[11px] font-bold text-slate-500">
                              {p.brands.name}
                            </span>
                          )}
                          <span className={cn(
                            "text-[10px] font-extrabold px-1.5 py-0.2 rounded-full",
                            (p.stock ?? 0) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
                          )}>
                            Stock: {p.stock ?? 0}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 truncate mt-1">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Divisas: <strong className="text-slate-900">{formatUSD(p.price_usd || 0)}</strong></span>
                          <span>Tasa BCV: <strong className="text-emerald-700">{formatUSD(roundedUsdBcv)} ({formatBs(roundedUsdBcv * bcvRate)})</strong></span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleLinkProduct(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shrink-0 gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Vincular
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Renderizador unificado de cada tarjeta de producto
  function renderProductCard(product: Product, kitItemId: string) {
    if (!product) return null;
    const priceUsd = product.price_usd || 0;
    const roundedUsdBcv = calculateBcvPrice(priceUsd, bcvMultiplier);
    const priceBs = roundedUsdBcv * bcvRate;
    const isOut = (product.stock ?? 0) <= 0;

    return (
      <div 
        key={kitItemId}
        className={cn(
          "rounded-lg border p-3 flex flex-col justify-between transition-all group bg-white shadow-xs",
          isOut ? "border-slate-200 opacity-80" : "border-slate-200 hover:border-emerald-400"
        )}
      >
        <div>
          {/* Header de la tarjeta */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span 
                onClick={() => copyToClipboard(product.code)}
                className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0"
                title="Copiar código"
              >
                {product.code}
              </span>
              {product.brands?.name && (
                <span className="text-[10px] font-bold text-slate-500 truncate uppercase">
                  {product.brands.name}
                </span>
              )}
            </div>
            
            <span className={cn(
              "text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0",
              isOut ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            )}>
              Stock: {product.stock ?? 0}
            </span>
          </div>

          {/* Nombre */}
          <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug mb-2" title={product.name}>
            {product.name}
          </h4>
        </div>

        <div>
          {/* Precios con Redondeo BCV */}
          <div className="pt-2 border-t border-slate-100 mb-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Divisas:</span>
              <span className="text-xs font-black text-slate-900">{formatUSD(priceUsd)}</span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-[10px] text-emerald-700 font-bold">Tasa BCV:</span>
              <div className="text-right">
                <span className="text-xs font-extrabold text-emerald-700 mr-1">{formatUSD(roundedUsdBcv)}</span>
                <span className="text-[10px] text-slate-400 font-medium">({formatBs(priceBs)})</span>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => handleAddToCart(product, 1)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-7 gap-1 shadow-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Cotizar
            </Button>
            {!readOnly && (
              <button
                onClick={() => handleRemoveItem(kitItemId, product.name)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Desvincular de este kit"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
