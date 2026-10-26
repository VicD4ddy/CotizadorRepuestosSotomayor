import { useState, useMemo, useEffect } from 'react';
import { useKits, useDeleteKit, useUpdateKit } from '@/hooks/use-supabase';
import { Kit } from '@/types';
import UseAnimations from 'react-useanimations';
import plusCircle from 'react-useanimations/lib/plusCircle';
import edit from 'react-useanimations/lib/edit';
import trash2 from 'react-useanimations/lib/trash2';
import { Search, Package, ShoppingCart, X, ChevronLeft, ChevronRight, CheckCircle2, Circle, Disc3, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KitFormDialog } from './kit-form-dialog';
import { cn } from '@/lib/utils';
import { parseKitDescription } from '@/lib/kit-associations';

interface KitTableProps {
  category: string;
  onSelectKit: (kit: Kit) => void;
}

export function KitTable({ category, onSelectKit }: KitTableProps) {
  const { data: kits = [], isLoading } = useKits(category);
  const deleteKit = useDeleteKit();
  const updateKit = useUpdateKit();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedKitForEdit, setSelectedKitForEdit] = useState<Kit | null>(null);

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [initialGalleryIndex, setInitialGalleryIndex] = useState(0);

  const availableBrands = useMemo(() => {
    const brandsMap = new Map<string, { id: string; name: string }>();
    kits.forEach((k) => {
      if (k.vehicle_brands) {
        brandsMap.set(k.vehicle_brands.id, { id: k.vehicle_brands.id, name: k.vehicle_brands.name });
      }
    });
    return Array.from(brandsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [kits]);

  const filteredKits = useMemo(() => {
    const result = kits.filter((k) => {
      if (selectedBrandId !== 'all' && k.vehicle_brand_id !== selectedBrandId) {
        return false;
      }
      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase().trim();
      const { associatedMotors, cleanDescription } = parseKitDescription(k.description);
      
      const matchName = k.name.toLowerCase().includes(search);
      const matchDesc = cleanDescription.toLowerCase().includes(search);
      const matchMotors = associatedMotors.some((m) => m.toLowerCase().includes(search));

      return matchName || matchDesc || matchMotors;
    });
    
    return result.sort((a, b) => {
      const brandA = (a.vehicle_brands?.name || 'zzz').trim().toLowerCase();
      const brandB = (b.vehicle_brands?.name || 'zzz').trim().toLowerCase();
      if (brandA !== brandB) return brandA.localeCompare(brandB);
      return a.name.trim().localeCompare(b.name.trim());
    });
  }, [kits, searchQuery, selectedBrandId]);

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
          <UseAnimations animation={plusCircle} size={18} strokeColor="currentColor" />
          Nuevo Cotizador
        </Button>
      </div>

      {/* Search and Brand Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            placeholder={`Buscar en ${category.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-[42px] rounded-lg bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>

        {availableBrands.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedBrandId('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm shrink-0",
                selectedBrandId === 'all'
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              Todas las marcas ({kits.length})
            </button>
            {availableBrands.map((b) => {
              const count = kits.filter((k) => k.vehicle_brand_id === b.id).length;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrandId(b.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm shrink-0 flex items-center gap-1",
                    selectedBrandId === b.id
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  <span>{b.name}</span>
                  <span className={cn(
                    "text-[10px] px-1 py-0.2 rounded-full",
                    selectedBrandId === b.id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of Kits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 min-w-0">
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
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-bold">
                  {category === 'Clutch' && <Disc3 className="w-3.5 h-3.5 text-emerald-600" />}
                  {kit.vehicle_brands?.name || category}
                </div>
              )}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => openEdit(e, kit)}
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center"
                  title="Editar"
                >
                  <UseAnimations animation={edit} size={18} strokeColor="currentColor" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, kit)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded flex items-center justify-center"
                  title="Eliminar"
                >
                  <UseAnimations animation={trash2} size={18} strokeColor="currentColor" />
                </button>
              </div>
            </div>
            
            {(() => {
              const { associatedMotors, cleanDescription } = parseKitDescription(kit.description);
              return (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[15px] font-bold text-slate-900">{kit.name}</h3>
                    {category === 'Clutch' && (
                      <span className="text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Clutch
                      </span>
                    )}
                  </div>

                  {/* Opción A: Etiqueta de Motores Asociados */}
                  {category === 'Clutch' && (
                    <div className="mb-2.5">
                      {associatedMotors.length > 0 ? (
                        <div className="p-2 bg-amber-50/70 border border-amber-200/80 rounded-lg flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                            <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{associatedMotors.length === 1 ? 'Motor Asociado:' : 'Motores Asociados:'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {associatedMotors.map((m, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center text-[11px] font-semibold bg-white text-slate-800 border border-amber-200 px-1.5 py-0.5 rounded shadow-2xs"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic flex items-center gap-1 py-0.5">
                          <span>⚙️ Sin motor asignado</span>
                        </div>
                      )}
                    </div>
                  )}

                  {cleanDescription ? (
                    <div className="mb-4 flex-1">
                      {category === 'Clutch' && cleanDescription.includes('|') ? (
                        <div className="space-y-1 my-1">
                          {cleanDescription.split('|').map((part: string, idx: number) => {
                            const trimmed = part.trim();
                            if (!trimmed) return null;
                            const isPlato = /plato/i.test(trimmed);
                            const isDisco = /disco/i.test(trimmed);
                            const isCollarin = /collarin/i.test(trimmed);
                            return (
                              <div 
                                key={idx} 
                                className={cn(
                                  "text-[11px] font-semibold px-2 py-1 rounded border flex items-center justify-between",
                                  isPlato ? "bg-blue-50 text-blue-800 border-blue-200" :
                                  isDisco ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                                  isCollarin ? "bg-purple-50 text-purple-800 border-purple-200" :
                                  "bg-slate-50 text-slate-700 border-slate-200"
                                )}
                              >
                                <span>{trimmed}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[12px] text-slate-500 line-clamp-2">
                          {cleanDescription}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400 italic mb-4 flex-1">Sin códigos de referencia</p>
                  )}
                </>
              );
            })()}

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
            <UseAnimations animation={plusCircle} size={18} strokeColor="currentColor" className="mr-2" />
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
