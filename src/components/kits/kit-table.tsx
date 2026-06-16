import { useState, useMemo, useEffect } from 'react';
import { useKits, useDeleteKit, useUpdateKit } from '@/hooks/use-supabase';
import { Kit } from '@/types';
import { Search, Plus, Trash2, Edit, Package, ShoppingCart, X, ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
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
  const updateKit = useUpdateKit();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedKitForEdit, setSelectedKitForEdit] = useState<Kit | null>(null);

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [initialGalleryIndex, setInitialGalleryIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (galleryImages.length === 0) return;
      if (e.key === 'Escape') {
        setGalleryImages([]);
      } else if (e.key === 'ArrowLeft') {
        setInitialGalleryIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setInitialGalleryIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryImages]);

  const filteredKits = useMemo(() => {
    const result = kits.filter((k) => {
      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      return (
        k.name.toLowerCase().includes(search) ||
        k.description?.toLowerCase().includes(search)
      );
    });
    
    return result.sort((a, b) => {
      const brandA = (a.vehicle_brands?.name || 'zzz').trim().toLowerCase();
      const brandB = (b.vehicle_brands?.name || 'zzz').trim().toLowerCase();
      if (brandA !== brandB) return brandA.localeCompare(brandB);
      return a.name.trim().localeCompare(b.name.trim());
    });
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

  const handleToggleVerified = async (e: React.MouseEvent, kit: Kit) => {
    e.stopPropagation();
    const newValue = !kit.price_verified;
    try {
      await updateKit.mutateAsync({
        id: kit.id,
        price_verified: newValue,
        price_verified_at: newValue ? new Date().toISOString() : null,
      });
      toast.success(newValue ? 'Precios verificados ✓' : 'Verificación removida');
    } catch (error: any) {
      toast.error('Error al actualizar', { description: error.message });
    }
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
              {kit.vehicle_brands?.logo_url ? (
                <div className="p-2 bg-slate-50 text-slate-700 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors h-11 min-w-[44px] max-w-[120px] flex items-center justify-center shrink-0">
                  <img src={kit.vehicle_brands.logo_url} alt={kit.vehicle_brands.name} className="max-w-full h-full object-contain mix-blend-multiply" />
                </div>
              ) : (
                <div />
              )}
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

            {kit.image_urls && kit.image_urls.length > 0 && (
              <div className="flex gap-2 mb-4">
                {kit.image_urls.map((url: string, i: number) => (
                  <div 
                    key={i} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGalleryImages(kit.image_urls || []);
                      setInitialGalleryIndex(i);
                    }}
                    className="w-16 h-12 rounded border border-slate-200 overflow-hidden bg-slate-50 shrink-0 hover:border-emerald-500 transition-colors"
                  >
                    <img src={url} alt={`Ref ${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto mb-3">
              <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                {kit.kit_items?.length || 0} REPUESTOS
              </span>
              <button
                onClick={(e) => handleToggleVerified(e, kit)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                  kit.price_verified
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                    : 'text-slate-400 bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                }`}
                title={kit.price_verified
                  ? `Verificado el ${kit.price_verified_at ? new Date(kit.price_verified_at).toLocaleDateString('es-VE') : '—'}`
                  : 'Marcar precios como verificados'
                }
              >
                {kit.price_verified ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
                {kit.price_verified ? 'Verificado' : 'Verificar'}
              </button>
            </div>
            
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onSelectKit(kit);
              }}
              variant="outline" 
              size="sm" 
              className="w-full h-9 text-[11px] font-bold text-emerald-600 border-emerald-100 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all rounded-lg flex items-center justify-center gap-1.5"
            >
              ENTRAR <ShoppingCart className="w-3.5 h-3.5" />
            </Button>
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

      {/* Gallery Modal */}
      {galleryImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setGalleryImages([])}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setGalleryImages([]);
            }}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div 
            className="relative w-full max-w-4xl flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {galleryImages.length > 1 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setInitialGalleryIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
                }}
                className="absolute left-2 md:-left-12 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            
            <img 
              src={galleryImages[initialGalleryIndex]} 
              alt={`Gallery image ${initialGalleryIndex + 1}`} 
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            
            {galleryImages.length > 1 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setInitialGalleryIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-2 md:-right-12 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {galleryImages.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setInitialGalleryIndex(i);
                }}
                className={`w-2 h-2 rounded-full transition-all ${i === initialGalleryIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
