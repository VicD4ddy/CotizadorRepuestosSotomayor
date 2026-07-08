import { useState, useMemo, useEffect, useCallback } from 'react';
import { Kit, Product, CartItem } from '@/types';
import { useKitItems, useCreateKitItem, useDeleteKitItem, useDeleteProduct, useUpdateProduct, useProducts, useBcvRate, useBcvMultiplier } from '@/hooks/use-supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@/store/cart-store';
import { formatUSD } from '@/lib/utils';
import { ArrowLeft, Plus, Search, Trash2, Package, ShoppingCart, Ruler, Pencil, Unlink, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ImageGalleryDialog } from '@/components/inventory/image-gallery-dialog';
import { ProductFormDialog } from '@/components/inventory/product-form-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface KitBuilderProps {
  kit: Kit;
  onBack: () => void;
}

export function KitBuilder({ kit, onBack }: KitBuilderProps) {
  const { data: kitItems = [], isLoading } = useKitItems(kit.id);
  const deleteKitItem = useDeleteKitItem();
  const createKitItem = useCreateKitItem();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();
  const { data: products = [] } = useProducts();
  const { addItem } = useCartStore();
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const queryClient = useQueryClient();

  const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [measureFilter, setMeasureFilter] = useState('all');
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  // Bulk price editing state
  const [bulkPriceTarget, setBulkPriceTarget] = useState<{ category: string; brand: string; items: any[] } | null>(null);
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkPriceCostValue, setBulkPriceCostValue] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Search results for linking existing products
  const linkSearchResults = useMemo(() => {
    if (!linkSearchQuery || linkSearchQuery.length < 2) return [];
    const lowerQuery = linkSearchQuery.toLowerCase();
    
    // Filter out products already in the kit
    const existingProductIds = new Set(kitItems.map((item) => item.product_id));
    
    return products
      .filter((p) => !existingProductIds.has(p.id))
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.code.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 15); // Show max 15 results
  }, [linkSearchQuery, products, kitItems]);

  const handleLinkProduct = async (product: Product) => {
    try {
      await createKitItem.mutateAsync({
        kit_id: kit.id,
        product_id: product.id,
        quantity: 1,
      });
      toast.success(`${product.name} vinculado al cotizador`);
    } catch (error: any) {
      toast.error('Error al vincular repuesto', { description: error.message });
    }
  };

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

  // Reset search query when closing the dialog
  useEffect(() => {
    if (!isLinkDialogOpen) {
      setLinkSearchQuery('');
    }
  }, [isLinkDialogOpen]);

  const MEASURE_OPTIONS = [
    { value: 'all', label: 'Todas las Medidas' },
    { value: 'STD', label: '(STD)' },
    { value: '.010', label: '(.010)' },
    { value: '.020', label: '(.020)' },
    { value: '.030', label: '(.030)' },
    { value: '.040', label: '(.040)' },
    { value: '.060', label: '(.060)' },
  ];

  // Filter items by query, measurement, and stock
  const filteredItems = useMemo(() => {
    return kitItems.filter((item) => {
      const product = item.products;
      if (!product) return false;

      // Zero stock filter
      if (hideZeroStock && (product.stock ?? 0) <= 0) {
        return false;
      }

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
  }, [kitItems, filterQuery, measureFilter, hideZeroStock]);

  // Group items by subcategory (category.name)
  const CATEGORY_ORDER = [
    'pistones', 'anillos', 'bielas', 'bancadas', 'empacaduras',
    'bombas de aceite', 'bombas de gasolina', 'bombas de agua', 'taquetes',
  ];

  // Categories that should be sorted by measurement size
  const MEASURE_SORTED_CATEGORIES = ['anillos', 'bielas', 'bancadas', 'pistones'];

  // Extract numeric measurement value from product name/code for sorting
  // STD = 0, .010 = 10, .020 = 20, .030 = 30, etc.
  const getMeasureOrder = (productName: string, productCode: string): number => {
    const upper = productName.toUpperCase();
    const code = productCode.toUpperCase();

    // Check name for (STD) or code ending with -STD
    if (upper.includes('(STD)') || upper.includes(' STD ') || upper.endsWith(' STD') || code.includes('-STD') || code.endsWith('STD')) return 0;

    // Check name for measurement in parentheses: (.010), (.020), (010), (020)
    const matchParen = upper.match(/\(\.?(\d{2,3})\)/);
    if (matchParen) return parseInt(matchParen[1], 10);

    // Check product code for measurement: 5085-010, 5085-020, 592-060-HAST
    const matchCode = code.match(/[-](\d{2,3})(?:[-\s]|$)/);
    if (matchCode) return parseInt(matchCode[1], 10);

    // Check name for trailing number without parentheses: "...BLAZER 262 010"
    // Look for a standalone 2-3 digit number at the end that looks like a measure
    const matchTrailing = upper.match(/\s(\d{3})(?:\s|$)/g);
    if (matchTrailing) {
      // Take the last standalone 3-digit number that could be a measure (010-060 range)
      for (let i = matchTrailing.length - 1; i >= 0; i--) {
        const val = parseInt(matchTrailing[i].trim(), 10);
        if (val >= 10 && val <= 100) return val;
      }
    }

    return 9999;
  };

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
    if (confirm(`¿Desvincular "${productName}" de este cotizador?\n\n(El repuesto seguirá existiendo en tu inventario general).`)) {
      try {
        await deleteKitItem.mutateAsync({ id: itemId, kitId: kit.id });
        toast.success(`"${productName}" desvinculado del cotizador`);
      } catch (error: any) {
        toast.error('Error al desvincular repuesto', { description: error.message });
      }
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (confirm(`⚠️ ¡ATENCIÓN! ¿Estás seguro de ELIMINAR COMPLETAMENTE el repuesto "${product.name}" del sistema y del inventario general?\n\nEsta acción es irreversible y no se podrá deshacer.`)) {
      try {
        await deleteProduct.mutateAsync(product.id);
        queryClient.invalidateQueries({ queryKey: ['kit-items', kit.id] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        toast.success(`"${product.name}" eliminado del sistema exitosamente`);
      } catch (error: any) {
        toast.error('Error al eliminar repuesto del sistema', { description: error.message });
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
      brand_name: product.brands?.name,
      brand_logo_url: product.brands?.logo_url,
      stock: product.stock,
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
          brand_name: product.brands?.name,
          brand_logo_url: product.brands?.logo_url,
          stock: product.stock,
        });
        addedCount++;
      }
    });
    toast.success(`${addedCount} repuestos añadidos al carrito`);
  };

  // Categories that support bulk price editing
  const BULK_PRICE_CATEGORIES = ['bielas', 'bancadas', 'anillos'];

  const handleBulkPriceUpdate = async () => {
    if (!bulkPriceTarget) return;
    const items = bulkPriceTarget.items;
    if (!items || items.length === 0) return;

    const newPrice = parseFloat(bulkPriceValue);
    const newCost = bulkPriceCostValue ? parseFloat(bulkPriceCostValue) : undefined;

    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Ingresa un precio válido');
      return;
    }
    if (newCost !== undefined && (isNaN(newCost) || newCost < 0)) {
      toast.error('Ingresa un costo válido');
      return;
    }

    setIsBulkUpdating(true);
    try {
      let updatedCount = 0;
      for (const item of items) {
        const product = item.products;
        if (!product) continue;
        const updateData: any = { id: product.id, price_usd: newPrice };
        if (newCost !== undefined) updateData.cost = newCost;
        await updateProduct.mutateAsync(updateData);
        updatedCount++;
      }
      queryClient.invalidateQueries({ queryKey: ['kit_items', kit.id] });
      toast.success(`Precio actualizado en ${updatedCount} repuestos de ${bulkPriceTarget.brand}`);
      setBulkPriceTarget(null);
      setBulkPriceValue('');
      setBulkPriceCostValue('');
    } catch (error: any) {
      toast.error('Error al actualizar precios', { description: error.message });
    } finally {
      setIsBulkUpdating(false);
    }
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
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 shrink-0 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
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
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en el motor..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-[200px] pl-9 pr-3 h-[36px] rounded bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
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
          <button
            onClick={() => setHideZeroStock(!hideZeroStock)}
            className={`flex items-center gap-2 px-3 h-[36px] rounded border text-[13px] font-medium transition-all shrink-0 select-none cursor-pointer ${
              hideZeroStock
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Ocultar los repuestos que tengan stock igual a cero"
          >
            <div className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
              hideZeroStock ? 'bg-emerald-500' : 'bg-slate-300'
            }`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                hideZeroStock ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
            <span>Ocultar los repuestos con stock 0</span>
          </button>
          <Button 
            onClick={() => setIsLinkDialogOpen(true)}
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700 font-semibold h-[36px]"
          >
            <Plus className="w-4 h-4" />
            Vincular Repuesto
          </Button>
          <Button 
            onClick={handleAddAllToCart}
            disabled={filteredItems.length === 0}
            className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm h-[36px]"
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
              Vincula repuestos a este cotizador desde el formulario de cada producto en el inventario o agrégalos directamente ahora.
            </p>
            <div className="flex justify-center gap-3">
              <Button 
                onClick={() => setIsLinkDialogOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Vincular Repuesto
              </Button>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-2">No se encontraron repuestos</h3>
            <p className="text-[13px] text-slate-500 mb-6">
              {hideZeroStock ? 'Todos los repuestos coinciden con stock 0 o no cumplen con los filtros de medida/búsqueda.' : 'No hay repuestos que coincidan con la búsqueda o la medida seleccionada.'}
            </p>
            <Button 
              onClick={() => {
                setFilterQuery('');
                setMeasureFilter('all');
                setHideZeroStock(false);
              }}
              variant="outline"
              className="font-semibold"
            >
              Limpiar Filtros
            </Button>
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

                    // Sort items by measurement for relevant categories
                    const shouldSortByMeasure = MEASURE_SORTED_CATEGORIES.some(c => categoryName.toLowerCase().includes(c));
                    if (shouldSortByMeasure) {
                      brandEntries.forEach(([, bItems]) => {
                        bItems.sort((a: any, b: any) => {
                          const aOrder = getMeasureOrder(a.products?.name || '', a.products?.code || '');
                          const bOrder = getMeasureOrder(b.products?.name || '', b.products?.code || '');
                          return aOrder - bOrder;
                        });
                      });
                    }

                    return brandEntries.map(([brandName, brandItems]) => (
                      <div key={brandName}>
                        {hasManyBrands && (
                          <div className="flex items-center justify-between px-5 py-2 bg-slate-50/80 border-b border-slate-100">
                            <div className="flex items-center gap-2">
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
                            {BULK_PRICE_CATEGORIES.some(c => categoryName.toLowerCase().includes(c)) && (
                              <button
                                onClick={() => {
                                  // Pre-fill with the most common price in the brand group
                                  const prices = brandItems.map((it: any) => it.products?.price_usd || 0).filter((p: number) => p > 0);
                                  if (prices.length > 0) {
                                    const mostCommon = prices.sort((a: number, b: number) =>
                                      prices.filter((v: number) => v === a).length - prices.filter((v: number) => v === b).length
                                    ).pop();
                                    setBulkPriceValue(String(mostCommon || ''));
                                  } else {
                                    setBulkPriceValue('');
                                  }
                                  const costs = brandItems.map((it: any) => it.products?.cost || 0).filter((c: number) => c > 0);
                                  if (costs.length > 0) {
                                    const mostCommonCost = costs.sort((a: number, b: number) =>
                                      costs.filter((v: number) => v === a).length - costs.filter((v: number) => v === b).length
                                    ).pop();
                                    setBulkPriceCostValue(String(mostCommonCost || ''));
                                  } else {
                                    setBulkPriceCostValue('');
                                  }
                                  setBulkPriceTarget({ category: categoryName, brand: brandName, items: brandItems });
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                title={`Editar precio de todos los ${brandName} en ${categoryName}`}
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Editar Precio
                              </button>
                            )}
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
                                  <p 
                                    className="text-[14px] font-bold text-slate-900 truncate cursor-pointer hover:text-emerald-700 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (product) setEditProduct(product as Product);
                                    }}
                                    title="Editar producto"
                                  >
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
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                      (product?.stock ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                    }`}>
                                      Stock: {product?.stock ?? 0}
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
                                      onClick={() => product && setEditProduct(product as Product)}
                                      className="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                      title="Editar repuesto"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveItem(item.id, product?.name)}
                                      className="w-8 h-8 flex items-center justify-center rounded text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                      title="Desvincular repuesto de esta cotización (se mantiene en el inventario)"
                                    >
                                      <Unlink className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => product && handleDeleteProduct(product as Product)}
                                      className="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                      title="Eliminar repuesto definitivamente del sistema"
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

      <ProductFormDialog
        open={!!editProduct}
        onOpenChange={(open) => {
          if (!open) {
            setEditProduct(null);
            // Refresh kit items to reflect any changes
            queryClient.invalidateQueries({ queryKey: ['kit_items', kit.id] });
          }
        }}
        product={editProduct}
      />

      {/* Dialog for linking existing products or creating and linking a new one */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-slate-50">
          <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Vincular Repuesto a {kit.name}
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Busca un repuesto existente en el inventario o crea uno nuevo para vincularlo a este cotizador.
            </p>
          </DialogHeader>

          <div className="p-6 space-y-4 w-full overflow-hidden">
            <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o SKU..."
                  value={linkSearchQuery}
                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 h-[40px] rounded-lg bg-white border border-slate-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <Button
                onClick={() => {
                  setIsLinkDialogOpen(false);
                  setIsCreateDialogOpen(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-[40px] shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Crear Nuevo
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden space-y-2 pr-1 w-full">
              {linkSearchQuery.length >= 2 && linkSearchResults.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-xs">No se encontraron productos para vincular.</p>
                </div>
              )}

              {linkSearchResults.length > 0 ? (
                <div className="space-y-2 w-full">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Resultados de Búsqueda ({linkSearchResults.length})
                  </p>
                  {linkSearchResults.map((product) => (
                    <div 
                      key={product.id}
                      className="w-full bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-500 hover:shadow-sm transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {product.code}
                          </span>
                          <span className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                            (product.stock ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                          }`}>
                            Stock: {product.stock ?? 0}
                          </span>
                          {product.brands?.name && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {product.brands.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-slate-700">
                          {formatUSD(product.price_usd)}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleLinkProduct(product)}
                          className="h-7 text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        >
                          Vincular
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !linkSearchQuery ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-xs">Escribe al menos 2 letras para buscar repuestos...</p>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog to create a brand new product and automatically pre-link to current kit */}
      <ProductFormDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            // Refresh kit items to reflect the new creation
            queryClient.invalidateQueries({ queryKey: ['kit_items', kit.id] });
          }
        }}
        product={null}
        initialCompatibleKitId={kit.id}
      />

      {/* Bulk Price Edit Dialog */}
      <Dialog open={!!bulkPriceTarget} onOpenChange={(open) => { if (!open) { setBulkPriceTarget(null); setBulkPriceValue(''); setBulkPriceCostValue(''); } }}>
        <DialogContent
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          className="sm:max-w-[540px] w-[95vw] p-0 bg-white overflow-hidden shadow-2xl rounded-xl border border-slate-200"
        >
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 bg-slate-50/50">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="truncate">Editar Precio — {bulkPriceTarget?.brand}</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              El nuevo precio y costo se aplicarán a <strong className="text-slate-700">los {bulkPriceTarget?.items?.length || 0} repuestos</strong> de <strong className="text-slate-700">{bulkPriceTarget?.brand}</strong> en {bulkPriceTarget?.category}.
            </p>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                  Costo (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkPriceCostValue}
                    onChange={(e) => setBulkPriceCostValue(e.target.value)}
                    placeholder="Opcional"
                    className="w-full pl-8 pr-3 h-[42px] rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Vacío = no modificar.</p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                  Precio Venta (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkPriceValue}
                    onChange={(e) => setBulkPriceValue(e.target.value)}
                    placeholder="Ej: 35.00"
                    className="w-full pl-8 pr-3 h-[42px] rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    autoFocus
                  />
                </div>
                {bulkPriceValue && !isNaN(parseFloat(bulkPriceValue)) ? (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    BCV: {formatUSD(parseFloat(bulkPriceValue) * bcvMultiplier)}
                  </p>
                ) : (
                  <p className="text-[11px] text-transparent mt-1">&nbsp;</p>
                )}
              </div>
            </div>

            {/* Preview of affected products */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3.5 max-h-[180px] overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Repuestos afectados ({bulkPriceTarget?.items?.length || 0}):
              </p>
              <div className="space-y-1.5 divide-y divide-slate-100">
                {(bulkPriceTarget?.items || []).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-xs pt-1.5 first:pt-0 gap-3">
                    <span className="text-slate-700 truncate flex-1 font-medium">{item.products?.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                      <span className="text-slate-400">{formatUSD(item.products?.price_usd || 0)}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-emerald-700 font-bold">{bulkPriceValue ? formatUSD(parseFloat(bulkPriceValue)) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => { setBulkPriceTarget(null); setBulkPriceValue(''); setBulkPriceCostValue(''); }}
                className="flex-1 h-[42px] text-sm font-semibold"
                disabled={isBulkUpdating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkPriceUpdate}
                disabled={!bulkPriceValue || isBulkUpdating}
                className="flex-1 h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold gap-2 shadow-sm"
              >
                {isBulkUpdating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Actualizando...</>
                ) : (
                  <><DollarSign className="w-4 h-4" /> Aplicar a Todos</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
