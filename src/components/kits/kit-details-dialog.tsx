import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Kit, Product, CartItem } from '@/types';
import { useKitItems, useCreateKitItem, useDeleteKitItem, useProducts } from '@/hooks/use-supabase';
import { toast } from 'sonner';
import { X, Search, Plus, Trash2, ShoppingCart, Package } from 'lucide-react';
import { formatUSD } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';

interface KitDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: Kit | null;
}

export function KitDetailsDialog({ open, onOpenChange, kit }: KitDetailsDialogProps) {
  const { data: kitItems = [], isLoading: isLoadingItems } = useKitItems(kit?.id || '');
  const { data: products = [] } = useProducts();
  const createKitItem = useCreateKitItem();
  const deleteKitItem = useDeleteKitItem();
  const { addItem } = useCartStore();

  const [searchQuery, setSearchQuery] = useState('');

  // Search logic for adding new products
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const lowerQuery = searchQuery.toLowerCase();
    
    // Filter out products already in the kit
    const existingProductIds = new Set(kitItems.map((item) => item.product_id));
    
    return products
      .filter((p) => !existingProductIds.has(p.id))
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.code.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5); // Show max 5 results
  }, [searchQuery, products, kitItems]);

  const handleAddProduct = async (product: Product) => {
    if (!kit) return;
    try {
      await createKitItem.mutateAsync({
        kit_id: kit.id,
        product_id: product.id,
        quantity: 1,
      });
      setSearchQuery('');
      toast.success(`${product.name} añadido al combo`);
    } catch (error: any) {
      if (error.message?.includes('vinculado')) {
        toast.warning('Repuesto duplicado', { description: error.message });
      } else {
        toast.error('Error al añadir repuesto', { description: error.message });
      }
    }
  };

  const handleRemoveItem = async (itemId: string, productName: string) => {
    if (!kit) return;
    try {
      await deleteKitItem.mutateAsync({ id: itemId, kitId: kit.id });
      toast.success(`${productName} removido del combo`);
    } catch (error: any) {
      toast.error('Error al remover repuesto', { description: error.message });
    }
  };

  const handleAddToCart = () => {
    if (!kitItems || kitItems.length === 0) {
      toast.error('El combo está vacío');
      return;
    }

    let addedCount = 0;
    kitItems.forEach((item) => {
      if (item.products) {
        const product = item.products;
        const cartItem: CartItem = {
          product_id: product.id,
          product_name: product.name,
          product_code: product.code,
          quantity: item.quantity || 1, // Using the quantity defined in the kit
          unit_price_usd: product.price_usd || 0,
          image_url: product.image_url,
          brand_name: product.brands?.name,
          brand_logo_url: product.brands?.logo_url,
          stock: product.stock,
        };
        addItem(cartItem);
        addedCount++;
      }
    });

    toast.success(`${addedCount} repuestos añadidos al carrito`, {
      description: `Los productos de ${kit?.name} se cargaron exitosamente.`,
    });
    onOpenChange(false);
  };

  if (!kit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-emerald-600" />
              <div className="flex items-center gap-2.5">
                <span>{kit.name}</span>
                {kit.description && (
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {kit.description}
                  </span>
                )}
              </div>
            </div>
            </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona los repuestos de esta plantilla y cárgalos al carrito.
          </p>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-[500px]">
          {/* Left Side: Current Items */}
          <div className="flex-1 border-r border-slate-200 bg-white flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-[13px] text-slate-700 uppercase tracking-wider">
                Contenido del Combo ({kitItems.length})
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingItems ? (
                <div className="flex justify-center p-8">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : kitItems.length === 0 ? (
                <div className="text-center p-8 text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-[13px]">Este combo no tiene repuestos asignados todavía.</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {kitItems.map((item) => {
                    const product = item.products;
                    return (
                      <li key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors group">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-[13px] font-bold text-slate-900 truncate">
                            {product?.name || 'Producto no encontrado'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 rounded">
                              {product?.code || '---'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {formatUSD(product?.price_usd || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[12px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            x{item.quantity}
                          </span>
                          <button
                            onClick={() => handleRemoveItem(item.id, product?.name || '')}
                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remover del combo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Bottom Add to Cart Button */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <Button
                onClick={handleAddToCart}
                disabled={kitItems.length === 0}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                size="lg"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Cargar al Carrito
              </Button>
            </div>
          </div>

          {/* Right Side: Search and Add */}
          <div className="w-[280px] bg-slate-50 flex flex-col min-h-0">
            <div className="p-4">
              <label className="text-[11px] font-bold text-slate-500 mb-2 block uppercase tracking-wider">
                Añadir Repuesto al Combo
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 h-[40px] rounded-lg bg-white border border-slate-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-[12px] text-slate-500 text-center mt-4">
                  No se encontraron resultados.
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Resultados de Búsqueda
                  </p>
                  {searchResults.map((product) => (
                    <div 
                      key={product.id}
                      className="bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-500 hover:shadow-sm transition-all"
                    >
                      <p className="text-[12px] font-bold text-slate-900 leading-tight mb-1">
                        {product.name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 mb-2">
                        {product.code}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-slate-700">
                          {formatUSD(product.price_usd)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddProduct(product)}
                          className="h-7 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Añadir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {!searchQuery && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 opacity-60">
                  <Search className="w-8 h-8 mb-2" />
                  <p className="text-[12px] text-center max-w-[200px]">
                    Busca productos en tu inventario para armar la plantilla de este combo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
