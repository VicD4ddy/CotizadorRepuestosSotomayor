import { useState, useMemo } from 'react';
import { useKits, useDeleteKit } from '@/hooks/use-supabase';
import { Kit } from '@/types';
import { Search, Plus, Trash2, Edit, Package, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KitFormDialog } from './kit-form-dialog';

interface KitTableProps {
  category: string;
  onSelectKit: (kit: Kit) => void;
}

export function KitTable({ category, onSelectKit }: KitTableProps) {
  const { data: kits = [], isLoading } = useKits(category);
  const deleteKit = useDeleteKit();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedKitForEdit, setSelectedKitForEdit] = useState<Kit | null>(null);

  const filteredKits = useMemo(() => {
    const result = kits.filter((k) => {
      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      return (
        k.name.toLowerCase().includes(search) ||
        k.description?.toLowerCase().includes(search)
      );
    });
    
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [kits, searchQuery]);

  const handleDelete = async (e: React.MouseEvent, kit: Kit) => {
    e.stopPropagation();
    if (confirm(`¿Estás seguro de que quieres eliminar el cotizador "${kit.name}"?`)) {
      try {
        await deleteKit.mutateAsync(kit.id);
        toast.success('Cotizador eliminado exitosamente');
      } catch (error: any) {
        toast.error('Error al eliminar', { description: error.message });
      }
    }
  };

  const openEdit = (e: React.MouseEvent, kit: Kit) => {
    e.stopPropagation();
    setSelectedKitForEdit(kit);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando cotizadores...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cotizadores de {category}</h2>
          <p className="text-sm text-slate-500 mt-1">Gestiona las plantillas de repuestos para agilizar cotizaciones.</p>
        </div>
        <Button 
          onClick={() => {
            setSelectedKitForEdit(null);
            setIsFormOpen(true);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cotizador
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          placeholder="Buscar cotizador..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 h-[42px] rounded-lg bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
        />
      </div>

      {/* Grid of Kits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredKits.map((kit) => (
          <div 
            key={kit.id}
            onClick={() => onSelectKit(kit)}
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-slate-50 text-slate-700 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                <Package className="w-6 h-6" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => openEdit(e, kit)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, kit)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <h3 className="text-[15px] font-bold text-slate-900 mb-1">{kit.name}</h3>
            <p className="text-[12px] text-slate-500 line-clamp-2 mb-4 flex-1">
              {kit.description || 'Sin descripción'}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                {kit.kit_items?.length || 0} REPUESTOS
              </span>
              
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectKit(kit);
                }}
                variant="ghost" 
                size="sm" 
                className="h-8 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                ENTRAR <ShoppingCart className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredKits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl border-dashed">
          <Package className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-[15px] font-bold text-slate-700 mb-1">No hay cotizadores de {category}</h3>
          <p className="text-[13px] text-slate-500 mb-4 text-center max-w-sm">
            Crea tu primer cotizador (ej. "Motor Ford 300") para empezar a agilizar tus procesos.
          </p>
          <Button 
            onClick={() => {
              setSelectedKitForEdit(null);
              setIsFormOpen(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Cotizador
          </Button>
        </div>
      )}

      <KitFormDialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        kit={selectedKitForEdit} 
        category={category} 
      />
    </div>
  );
}
