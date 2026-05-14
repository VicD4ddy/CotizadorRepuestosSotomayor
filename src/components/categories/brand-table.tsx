import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import Fuse from 'fuse.js';
import { Brand } from '@/types';
import { useBrands, useDeleteBrand } from '@/hooks/use-supabase';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandFormDialog } from './brand-form-dialog';
import { toast } from 'sonner';

const columnHelper = createColumnHelper<Brand>();

export function BrandTable() {
  const { data: brands = [], isLoading } = useBrands();
  const deleteBrand = useDeleteBrand();

  const [searchQuery, setSearchQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(brands, {
        keys: ['name'],
        threshold: 0.3,
      }),
    [brands]
  );

  const filteredBrands = useMemo(() => {
    return searchQuery
      ? fuse.search(searchQuery).map((r) => r.item)
      : brands;
  }, [brands, searchQuery, fuse]);

  const handleDelete = async (e: React.MouseEvent, brand: Brand) => {
    e.stopPropagation();
    if (confirm(`¿Estás seguro de que quieres eliminar la marca "${brand.name}"?`)) {
      try {
        await deleteBrand.mutateAsync(brand.id);
        toast.success('Marca eliminada exitosamente');
      } catch (error: any) {
        toast.error('Error al eliminar', { description: error.message });
      }
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <button className="flex items-center gap-1 hover:text-slate-900 transition-colors" onClick={() => column.toggleSorting()}>
            NOMBRE DE MARCA
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 500,
        cell: (info) => {
          const brand = info.row.original;
          return (
            <div className="flex items-center gap-3">
              {brand.logo_url && (
                <img 
                  src={brand.logo_url} 
                  alt={brand.name} 
                  className="h-6 object-contain max-w-[80px]" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <span className="font-semibold text-[14px] text-slate-900 uppercase">{info.getValue()}</span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'ACCIONES',
        size: 100,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedBrand(row.original);
                setIsDialogOpen(true);
              }}
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={(e) => handleDelete(e, row.original)}
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredBrands,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleAddBrand = () => {
    setSelectedBrand(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando marcas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm max-w-4xl mx-auto w-full">
      {/* Title Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-bold text-slate-900">Gestor de Marcas</h2>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-widest border-none px-3 py-1 rounded-md">
            {filteredBrands.length} MARCAS
          </Badge>
        </div>
        <Button onClick={handleAddBrand} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 h-[36px] text-[13px] px-4 rounded-md">
          <Plus className="w-4 h-4" />
          Añadir Marca
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center p-4 border-b border-slate-200 bg-white">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-[36px] rounded bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
          />
        </div>
      </div>

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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
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

        {filteredBrands.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white">
            <Search className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm text-slate-600">No se encontraron marcas</p>
          </div>
        )}
      </div>

      {/* Dialog */}
      <BrandFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        brand={selectedBrand} 
      />
    </div>
  );
}
