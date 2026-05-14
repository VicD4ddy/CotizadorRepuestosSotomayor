'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import Fuse from 'fuse.js';
import { Product } from '@/types';
import { useProducts, useBcvRate, useCategories, useBcvMultiplier } from '@/hooks/use-supabase';
import { useCartStore } from '@/store/cart-store';
import { Badge } from '@/components/ui/badge';
import { formatUSD } from '@/lib/utils';
import { Search, SlidersHorizontal, Plus, Image as ImageIcon, ArrowUpDown, Pencil, History, Clock } from 'lucide-react';
import { ProductFormDialog } from './product-form-dialog';
import { ProductHistoryDialog } from './product-history-dialog';
import { ImageGalleryDialog } from './image-gallery-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const columnHelper = createColumnHelper<Product>();

interface ProductTableProps {
  showRecentsOnMount?: boolean;
}

export function ProductTable({ showRecentsOnMount }: ProductTableProps) {
  const { data: products = [], isLoading } = useProducts();
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const { data: categories = [] } = useCategories();
  const addItem = useCartStore((s) => s.addItem);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [recentsOnly, setRecentsOnly] = useState(!!showRecentsOnMount);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(!!showRecentsOnMount);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [productForHistory, setProductForHistory] = useState<Product | null>(null);
  const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);

  // Listen for open-product events from notification panel
  useEffect(() => {
    const handler = (e: Event) => {
      const productId = (e as CustomEvent).detail?.productId;
      if (productId) {
        const found = products.find((p) => p.id === productId);
        if (found) {
          setSelectedProduct(found);
          setIsDialogOpen(true);
        }
      }
    };
    window.addEventListener('open-product', handler);
    return () => window.removeEventListener('open-product', handler);
  }, [products]);

  // Fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(products, {
        keys: ['code', 'name', 'description'],
        threshold: 0.3,
        includeScore: true,
      }),
    [products]
  );

  const filteredProducts = useMemo(() => {
    let result = searchQuery
      ? fuse.search(searchQuery).map((r) => r.item)
      : products;

    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category_id === categoryFilter);
    }

    if (recentsOnly) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      result = result.filter((p) => p.created_at && p.created_at >= oneDayAgo);
      result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }

    return result;
  }, [products, searchQuery, categoryFilter, recentsOnly, fuse]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'image',
        header: 'IMG',
        size: 48,
        cell: ({ row }) => {
          const hasImage = row.original.image_url || (row.original.image_urls && row.original.image_urls.length > 0);
          return (
            <div 
              className={`w-8 h-8 rounded bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 transition-colors ${hasImage ? 'cursor-pointer hover:border-emerald-500' : ''}`}
              onClick={(e) => {
                if (hasImage) {
                  e.stopPropagation();
                  setGalleryProduct(row.original);
                }
              }}
            >
              {row.original.image_url ? (
                <img src={row.original.image_url} alt={row.original.name} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-4 h-4 text-slate-400" />
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('code', {
        header: 'SKU',
        size: 80,
        cell: (info) => (
          <span 
            className="font-mono text-[11px] text-slate-500 leading-tight block cursor-copy hover:text-blue-600 hover:font-bold transition-all"
            title="Clic para copiar SKU"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(info.getValue());
              toast.success(`SKU copiado: ${info.getValue()}`);
            }}
          >
            {info.getValue().split('-').map((part, i) => (
              <span key={i}>
                {part}
                {i < info.getValue().split('-').length - 1 && <>{'-'}<br /></>}
              </span>
            ))}
          </span>
        ),
      }),
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <button className="flex items-center gap-1 hover:text-slate-900 transition-colors" onClick={() => column.toggleSorting()}>
            DESCRIPCIÓN / APLICACIÓN
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 280,
        cell: ({ row }) => (
          <p className="font-semibold text-[13px] text-slate-900 leading-tight">{row.original.name}</p>
        ),
      }),
      columnHelper.display({
        id: 'brand',
        header: 'MARCA',
        size: 80,
        cell: ({ row }) => {
          const brand = row.original.brands;
          if (!brand?.name) return <span className="text-slate-300">—</span>;
          return brand.logo_url ? (
            <img 
              src={brand.logo_url} 
              alt={brand.name} 
              className="h-5 object-contain max-w-[70px]" 
              title={brand.name}
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
                el.parentElement!.innerHTML = `<span class="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">${brand.name}</span>`;
              }}
            />
          ) : (
            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
              {brand.name}
            </span>
          );
        },
      }),
      columnHelper.accessor('cost', {
        header: 'COSTO',
        size: 75,
        cell: (info) => <span className="text-[13px] text-slate-500 font-medium">{formatUSD(info.getValue())}</span>,
      }),
      columnHelper.accessor('price_usd', {
        header: ({ column }) => (
          <button className="flex items-center gap-1 hover:text-slate-900 transition-colors" onClick={() => column.toggleSorting()}>
            PRECIO USD
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 85,
        cell: (info) => <span className="text-[13px] font-bold text-slate-900">{formatUSD(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'price_usd_bcv',
        header: () => (
          <span className="text-center block">
            PRECIO USD<br />(BCV)
          </span>
        ),
        size: 90,
        cell: ({ row }) => {
          const priceUsdBcv = row.original.price_usd * bcvMultiplier;
          return (
            <span className="text-[13px] text-slate-900 font-bold text-center block">
              {formatUSD(priceUsdBcv)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'price_bs',
        header: () => (
          <span className="text-right block">
            PRECIO<br />BS
          </span>
        ),
        size: 100,
        cell: ({ row }) => {
          const priceBs = row.original.price_usd * bcvMultiplier * bcvRate;
          return (
            <div className="text-right">
              <span className="text-[10px] text-slate-900 font-bold">Bs</span><br/>
              <span className="text-[13px] font-bold text-slate-900">
                {priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'ACCIÓN',
        size: 80,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
              title="Ver Historial de Precios"
              onClick={(e) => {
                e.stopPropagation();
                setProductForHistory(row.original);
                setIsHistoryOpen(true);
              }}
            >
              <History className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-white hover:bg-slate-700 transition-all active:scale-95"
              title="Añadir al Carrito"
              onClick={(e) => {
                e.stopPropagation();
                const p = row.original;
                addItem({
                  product_id: p.id,
                  product_name: p.name,
                  product_code: p.code,
                  quantity: 1,
                  unit_price_usd: p.price_usd,
                  image_url: p.image_url,
                });
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [bcvRate, bcvMultiplier, addItem]
  );

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Group categories by section
  const categoryGroups = useMemo(() => {
    const groups: Record<string, typeof categories> = {};
    categories.forEach((c) => {
      if (!groups[c.section]) groups[c.section] = [];
      groups[c.section].push(c);
    });
    return groups;
  }, [categories]);

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando inventario...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Title Bar - like reference */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-bold text-slate-900">
            {categoryFilter !== 'all'
              ? categories.find((c) => c.id === categoryFilter)?.name || 'Lista de Repuestos'
              : 'Catálogo de Repuestos'}
          </h2>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px] font-bold uppercase tracking-widest border-none px-3 py-1 rounded-md hidden sm:block">
            {filteredProducts.length} ÍTEMS
          </Badge>
        </div>
        <Button onClick={handleAddProduct} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 h-[36px] text-[13px] px-4 rounded-md">
          <Plus className="w-4 h-4" />
          Añadir Producto
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
                placeholder="Buscar por SKU, Nombre o Aplicación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-[36px] rounded bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
            />
            </div>
            <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 h-[36px] px-4 rounded border text-[13px] font-medium transition-all ${
                showFilters
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            </button>
            <button
              onClick={() => setRecentsOnly(!recentsOnly)}
              className={`flex items-center gap-1.5 h-[36px] px-3 rounded border text-[13px] font-medium transition-all ${
                recentsOnly
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Últimos Subidos
            </button>
        </div>
        <span className="text-[13px] text-slate-500 font-medium">
          {filteredProducts.length.toLocaleString()} resultados
        </span>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="flex items-center gap-4 p-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-600 font-medium">Categoría:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-2 text-[12px] rounded-md bg-white border border-slate-200 text-slate-700"
            >
              <option value="all">Todas</option>
              {Object.entries(categoryGroups).map(([section, cats]) => (
                <optgroup key={section} label={section}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setCategoryFilter('all'); setSearchQuery(''); setRecentsOnly(false); }}
            className="text-[12px] text-slate-500 hover:text-slate-900 transition-colors ml-auto font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 align-bottom"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => handleEditProduct(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white">
            <Search className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm text-slate-600">No se encontraron productos</p>
            <p className="text-[12px]">Intenta con otro término de búsqueda</p>
          </div>
        )}
      </div>

      {/* Product Edit Dialog */}
      <ProductFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        product={selectedProduct} 
      />

      <ProductHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        product={productForHistory}
      />

      <ImageGalleryDialog
        open={!!galleryProduct}
        onOpenChange={(open) => !open && setGalleryProduct(null)}
        product={galleryProduct}
      />
    </div>
  );
}
