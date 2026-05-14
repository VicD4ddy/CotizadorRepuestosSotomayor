import { useState, useMemo, useEffect, useCallback } from 'react';
import { Kit, Product, CartItem } from '@/types';
import { useKitItems, useDeleteKitItem, useProducts, useBcvRate, useBcvMultiplier } from '@/hooks/use-supabase';
import { useCartStore } from '@/store/cart-store';
import { formatUSD } from '@/lib/utils';
import { ArrowLeft, Plus, Search, Trash2, Package, ShoppingCart, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ImageGalleryDialog } from '@/components/inventory/image-gallery-dialog';

interface KitBuilderProps {
  kit: Kit;
  onBack: () => void;
}

export function KitBuilder({ kit, onBack }: KitBuilderProps) {
  const { data: kitItems = [], isLoading } = useKitItems(kit.id);
  const deleteKitItem = useDeleteKitItem();
  const { addItem } = useCartStore();
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();


  const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [measureFilter, setMeasureFilter] = useState('all');

  // Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !galleryProduct) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, galleryProduct]);

  const MEASURE_OPTIONS = [
    { value: 'all', label: 'Todas las Medidas' },
    { value: 'STD', label: '(STD)' },
    { value: '.010', label: '(.010)' },
    { value: '.020', label: '(.020)' },
    { value: '.030', label: '(.030)' },
    { value: '.040', label: '(.040)' },
    { value: '.060', label: '(.060)' },
  ];

  // Filter items by query and measurement
  const filteredItems = useMemo(() => {
    return kitItems.filter((item) => {
      const product = item.products;
      if (!product) return false;

      // Text filter
      if (filterQuery) {
        const lowerQuery = filterQuery.toLowerCase();
        if (!product.name.toLowerCase().includes(lowerQuery) && !product.code.toLowerCase().includes(lowerQuery)) {
          return false;
        }
      }

      // Measurement filter
      if (measureFilter !== 'all') {
        const name = product.name.toUpperCase();
        const code = product.code.toUpperCase();
        const measure = measureFilter.toUpperCase();
        if (!name.includes(`(${measure})`) && !name.includes(measure) && !code.includes(measure.replace('.', ''))) {
          return false;
        }
      }

      return true;
    });
  }, [kitItems, filterQuery, measureFilter]);

  // Group items by subcategory (category.name)
  const CATEGORY_ORDER = [
    'pistones', 'anillos', 'bielas', 'bancadas', 'empacaduras',
    'bombas de aceite', 'bombas de gasolina', 'bombas de agua', 'taquetes',
  ];

  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredItems.forEach((item) => {
      const product = item.products;
      if (!product) return;
      const categoryName = product.categories?.name || 'Sin Categoría';
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(item);
    });

    // Sort groups by custom order
    const sorted: Record<string, any[]> = {};
    const keys = Object.keys(groups);
    keys.sort((a, b) => {
      const aIdx = CATEGORY_ORDER.findIndex(c => a.toLowerCase().includes(c));
      const bIdx = CATEGORY_ORDER.findIndex(c => b.toLowerCase().includes(c));
      const aOrder = aIdx === -1 ? 999 : aIdx;
      const bOrder = bIdx === -1 ? 999 : bIdx;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });
    keys.forEach(k => { sorted[k] = groups[k]; });
    return sorted;
  }, [filteredItems]);

  const handleRemoveItem = async (itemId: string, productName: string) => {
    if (confirm(`¿Quitar ${productName} de este cotizador?`)) {
      try {
        await deleteKitItem.mutateAsync({ id: itemId, kitId: kit.id });
        toast.success(`${productName} removido`);
      } catch (error: any) {
        toast.error('Error al remover repuesto', { description: error.message });
      }
    }
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    addItem({
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      quantity: quantity || 1,
      unit_price_usd: product.price_usd || 0,
      image_url: product.image_url,
    });
    toast.success('Añadido al carrito');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('SKU copiado al portapapeles', { duration: 2000 });
  };

  const handleAddAllToCart = () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast.error('No hay repuestos para añadir');
      return;
    }
    let addedCount = 0;
    filteredItems.forEach((item) => {
      if (item.products) {
        const product = item.products;
        addItem({
          product_id: product.id,
          product_name: product.name,
          product_code: product.code,
          quantity: item.quantity || 1,
          unit_price_usd: product.price_usd || 0,
          image_url: product.image_url,
        });
        addedCount++;
      }
    });
    toast.success(`${addedCount} repuestos añadidos al carrito`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Cargando cotizador...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-emerald-600" />
              {kit.name}
            </h1>
            <p className="text-sm text-slate-500">{kit.description || `Cotizador para ${kit.category}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en el motor..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-[220px] pl-9 pr-3 h-[36px] rounded bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
            />
          </div>
          <div className="relative">
            <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={measureFilter}
              onChange={(e) => setMeasureFilter(e.target.value)}
              className={`pl-9 pr-8 h-[36px] rounded border text-[13px] font-medium appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all ${
                measureFilter !== 'all'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {MEASURE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Button 
            onClick={handleAddAllToCart}
            disabled={filteredItems.length === 0}
            className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            Cargar Todo al Carrito
          </Button>
        </div>
      </div>

      {/* Body: Groups */}
      <div className="flex-1 overflow-auto p-6">
        {kitItems.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-2">Este cotizador está vacío</h3>
            <p className="text-[13px] text-slate-500 mb-6">
              Vincula repuestos a este motor desde el formulario de cada producto en el inventario.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-8">
            {Object.entries(groupedItems).map(([categoryName, items]) => (
              <div key={categoryName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-[14px] text-slate-800 uppercase tracking-wider">
                    {categoryName}
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {items.length} ÍTEMS
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {(() => {
                    // Sub-group items by brand within this category
                    const brandGroups: Record<string, typeof items> = {};
                    items.forEach((item: any) => {
                      const brandName = item.products?.brands?.name || 'Sin Marca';
                      if (!brandGroups[brandName]) brandGroups[brandName] = [];
                      brandGroups[brandName].push(item);
                    });
                    const brandEntries = Object.entries(brandGroups).sort((a, b) => a[0].localeCompare(b[0]));
                    const hasManyBrands = brandEntries.length > 1;

                    return brandEntries.map(([brandName, brandItems]) => (
                      <div key={brandName}>
                        {hasManyBrands && (
                          <div className="flex items-center gap-2 px-5 py-2 bg-slate-50/80 border-b border-slate-100">
                            {brandItems[0]?.products?.brands?.logo_url && (
                              <img 
                                src={brandItems[0].products.brands.logo_url} 
                                alt={brandName} 
                                className="h-5 max-w-[50px] object-contain"
                              />
                            )}
                            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                              {brandName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({brandItems.length})
                            </span>
                          </div>
                        )}
                        <div className="divide-y divide-slate-100">
                          {brandItems.map((item: any) => {
                            const product = item.products;
                            return (
                              <div key={item.id} className="p-4 flex items-center hover:bg-slate-50 transition-colors group gap-4">
                                <div className="relative shrink-0">
                                  <div 
                                    className={`w-12 h-12 rounded border border-slate-200 bg-white overflow-hidden flex items-center justify-center transition-colors ${product?.image_url ? 'cursor-pointer hover:border-emerald-500' : ''}`}
                                    onClick={(e) => {
                                      if (product?.image_url) {
                                        e.stopPropagation();
                                        setGalleryProduct(product as Product);
                                      }
                                    }}
                                  >
                                    {product?.image_url ? (
                                      <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
                                    ) : (
                                      <Package className="w-5 h-5 text-slate-300" />
                                    )}
                                  </div>
                                  {product?.brands?.logo_url && (
                                    <img 
                                      src={product.brands.logo_url} 
                                      alt={product.brands.name} 
                                      className="absolute -bottom-2 -right-2 h-6 max-w-[40px] object-contain bg-white rounded border border-slate-200 p-0.5 shadow-sm"
                                    />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="text-[14px] font-bold text-slate-900 truncate">
                                    {product?.name || 'Producto no encontrado'}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span 
                                      onClick={() => product?.code && copyToClipboard(product.code)}
                                      className="text-[11px] font-mono text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer px-1.5 py-0.5 rounded transition-colors"
                                      title="Copiar SKU"
                                    >
                                      {product?.code || '---'}
                                    </span>
                                    {product?.brands?.name && (
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {product.brands.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-6">
                                  <div className="text-right">
                                    <p className="text-[11px] text-slate-500 font-medium mb-0.5">PRECIO</p>
                                    <p className="text-[15px] font-bold text-slate-900">
                                      {formatUSD(product?.price_usd || 0)}
                                    </p>
                                    <p className="text-[11px] text-emerald-600 font-semibold">
                                      {formatUSD((product?.price_usd || 0) * bcvMultiplier)} BCV
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      onClick={() => handleAddToCart(product, item.quantity)}
                                      size="sm"
                                      className="h-8 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                                    >
                                      <Plus className="w-3 h-3 mr-1" /> AÑADIR
                                    </Button>
                                    <button
                                      onClick={() => handleRemoveItem(item.id, product?.name)}
                                      className="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                      title="Desvincular de este motor"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ImageGalleryDialog
        open={!!galleryProduct}
        onOpenChange={(open) => !open && setGalleryProduct(null)}
        product={galleryProduct}
      />
    </div>
  );
}
