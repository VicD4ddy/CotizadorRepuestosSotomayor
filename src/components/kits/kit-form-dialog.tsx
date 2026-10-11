import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Kit } from '@/types';
import { useCreateKit, useUpdateKit, useVehicleBrands, useUploadKitImage, useKits } from '@/hooks/use-supabase';
import { useQueryClient } from '@tanstack/react-query';
import { parseKitDescription, formatKitDescription, isMotorAssociatedWithClutch } from '@/lib/kit-associations';
import { toast } from 'sonner';
import { X, Save, Upload, Loader2, Wrench, Disc3, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: Kit | null;
  category: string;
}

export function KitFormDialog({ open, onOpenChange, kit, category }: KitFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vehicleBrandId, setVehicleBrandId] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clutch & Motor Associations State
  const [associatedMotors, setAssociatedMotors] = useState<string[]>([]);
  const [customMotorInput, setCustomMotorInput] = useState('');
  const [motorSearchFilter, setMotorSearchFilter] = useState('');
  const [selectedClutchKitIds, setSelectedClutchKitIds] = useState<string[]>([]);
  
  const createKit = useCreateKit();
  const updateKit = useUpdateKit();
  const uploadImage = useUploadKitImage();
  const queryClient = useQueryClient();
  const { data: vehicleBrands = [] } = useVehicleBrands();

  // Queries for bidirectional linking
  const { data: allMotorKits = [] } = useKits('Motor');
  const { data: allClutchKits = [] } = useKits('Clutch');

  const isEditing = !!kit;

  useEffect(() => {
    if (open) {
      if (kit) {
        setName(kit.name);
        setVehicleBrandId(kit.vehicle_brand_id || '');
        setImageUrls(kit.image_urls || []);

        if (kit.category === 'Clutch') {
          const { cleanDescription, associatedMotors: parsedMotors } = parseKitDescription(kit.description);
          setDescription(cleanDescription);
          setAssociatedMotors(parsedMotors);
        } else {
          setDescription(kit.description || '');
          setAssociatedMotors([]);
        }

        if (kit.category === 'Motor') {
          // Detect which clutch kits currently associate with this motor
          const linkedClutches = allClutchKits
            .filter((ck) => isMotorAssociatedWithClutch(ck.description, kit.name))
            .map((ck) => ck.id);
          setSelectedClutchKitIds(linkedClutches);
        } else {
          setSelectedClutchKitIds([]);
        }
      } else {
        setName('');
        setDescription('');
        setVehicleBrandId('');
        setImageUrls([]);
        setAssociatedMotors([]);
        setSelectedClutchKitIds([]);
      }
      setCustomMotorInput('');
      setMotorSearchFilter('');
    }
  }, [open, kit, allClutchKits]);

  // Filter available motor kits for Clutch dialog
  const filteredMotorKits = useMemo(() => {
    if (category !== 'Clutch') return [];
    if (!motorSearchFilter) return allMotorKits;
    const q = motorSearchFilter.toLowerCase().trim();
    return allMotorKits.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q)
    );
  }, [category, allMotorKits, motorSearchFilter]);

  const handleToggleMotor = (motorName: string) => {
    const trimmed = motorName.trim();
    if (!trimmed) return;
    setAssociatedMotors((prev) => {
      const exists = prev.some((m) => m.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        return prev.filter((m) => m.toLowerCase() !== trimmed.toLowerCase());
      } else {
        return [...prev, trimmed];
      }
    });
  };

  const handleAddCustomMotor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customMotorInput.trim();
    if (!trimmed) return;
    const exists = associatedMotors.some((m) => m.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.info(`"${trimmed}" ya está en la lista de motores`);
    } else {
      setAssociatedMotors((prev) => [...prev, trimmed]);
      toast.success(`Motor "${trimmed}" añadido`);
    }
    setCustomMotorInput('');
  };

  const handleToggleClutchKit = (clutchId: string) => {
    setSelectedClutchKitIds((prev) =>
      prev.includes(clutchId) ? prev.filter((id) => id !== clutchId) : [...prev, clutchId]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (imageUrls.length + files.length > 3) {
      toast.error('Máximo 3 imágenes permitidas.');
      return;
    }

    setUploading(true);
    const newUrls = [...imageUrls];

    try {
      for (const file of files) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          toast.error(`Formato inválido: ${file.name}`);
          continue;
        }

        if (file.size > 2 * 1024 * 1024) {
          toast.error(`Archivo muy grande (max 2MB): ${file.name}`);
          continue;
        }

        const url = await uploadImage.mutateAsync({ file, kitId: kit?.id || '' });
        newUrls.push(url);
      }
      setImageUrls(newUrls);
      toast.success('Imágenes subidas');
    } catch (err: any) {
      toast.error('Error al subir: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre del combo es obligatorio');
      return;
    }

    try {
      const activeCategory = kit ? kit.category : category;
      let finalDescription = description.trim();

      // If category is Clutch, pack the associated motors tag into description
      if (activeCategory === 'Clutch') {
        finalDescription = formatKitDescription(description, associatedMotors);
      }

      let savedKitId = kit?.id;

      if (isEditing) {
        await updateKit.mutateAsync({
          id: kit.id,
          name: name.trim(),
          description: finalDescription,
          category: activeCategory,
          vehicle_brand_id: vehicleBrandId || null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        });
        toast.success('Cotizador actualizado');
      } else {
        const created = await createKit.mutateAsync({
          name: name.trim(),
          description: finalDescription,
          category: activeCategory,
          vehicle_brand_id: vehicleBrandId || null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        });
        savedKitId = created?.id;
        toast.success('Cotizador creado exitosamente');
      }

      // If category is Motor, synchronize associated clutch kits
      if (activeCategory === 'Motor') {
        const oldMotorName = kit?.name || name.trim();
        const newMotorName = name.trim();

        for (const ck of allClutchKits) {
          const wasLinked = isMotorAssociatedWithClutch(ck.description, oldMotorName);
          const isNowLinked = selectedClutchKitIds.includes(ck.id);

          if (wasLinked !== isNowLinked || (isNowLinked && oldMotorName !== newMotorName)) {
            const { cleanDescription: ckClean, associatedMotors: ckMotors } = parseKitDescription(ck.description);
            let updatedMotors: string[];
            if (isNowLinked) {
              updatedMotors = Array.from(new Set([...ckMotors.filter((m) => m !== oldMotorName), newMotorName]));
            } else {
              updatedMotors = ckMotors.filter((m) => m !== oldMotorName && m !== newMotorName);
            }

            await updateKit.mutateAsync({
              id: ck.id,
              description: formatKitDescription(ckClean, updatedMotors),
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['kits'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error al guardar', { description: error.message });
    }
  };

  const isClutchCategory = (kit ? kit.category : category) === 'Clutch';
  const isMotorCategory = (kit ? kit.category : category) === 'Motor';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
            {kit ? `Editar Cotizador de ${category}` : `Nuevo Cotizador de ${category}`}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {isEditing
              ? 'Modifica los datos generales y asociaciones de este combo.'
              : `Crea una plantilla de repuestos para la sección ${category}.`}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Nombre del Combo / Aplicación *
            </label>
            <Input
              placeholder={isClutchCategory ? "Ej. C-30 - C-10" : "Ej. Kit Motor Ford 300"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Marca del Vehículo (Opcional)
            </label>
            <select
              value={vehicleBrandId}
              onChange={(e) => setVehicleBrandId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <option value="">Ninguna / Genérico</option>
              {vehicleBrands.map((brand: any) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* CLUTCH SPECIFIC: Motores Asociados */}
          {isClutchCategory && (
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-700" />
                <label className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Motores Asociados al Clutch
                </label>
              </div>
              <p className="text-[11.5px] text-amber-800/80 leading-relaxed">
                Selecciona los motores que utilizan este clutch. Aparecerán en la tarjeta y permitirán buscar este kit escribiendo el nombre del motor (ej: 350 o Ford 300).
              </p>

              {/* Tags de motores seleccionados */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-white rounded-lg border border-amber-200/60 items-center">
                {associatedMotors.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">
                    Sin motores vinculados aún. Selecciona de la lista o escribe abajo.
                  </span>
                ) : (
                  associatedMotors.map((m, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100/80 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs"
                    >
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleMotor(m)}
                        className="text-amber-700 hover:text-red-600 rounded p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Buscador rápido de motores existentes */}
              <div className="space-y-1.5 pt-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Filtrar motores registrados (ej: 350, Vortec, 300)..."
                    value={motorSearchFilter}
                    onChange={(e) => setMotorSearchFilter(e.target.value)}
                    className="h-8 pl-8 text-xs bg-white border-slate-200"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-lg p-2">
                  {filteredMotorKits.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-2">
                      No se encontraron motores con esa búsqueda.
                    </p>
                  ) : (
                    filteredMotorKits.map((motor) => {
                      const isSelected = associatedMotors.some(
                        (m) => m.toLowerCase() === motor.name.toLowerCase()
                      );
                      return (
                        <div
                          key={motor.id}
                          onClick={() => handleToggleMotor(motor.name)}
                          className={cn(
                            "flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors",
                            isSelected
                              ? "bg-amber-50 text-amber-950 font-bold border border-amber-200"
                              : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by row click
                              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span>{motor.name}</span>
                          </div>
                          {motor.vehicle_brands?.name && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {motor.vehicle_brands.name}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Agregar motor manualmente (si aún no existe el kit) */}
              <div className="pt-1">
                <label className="text-[10.5px] font-bold text-amber-900 block mb-1">
                  ¿El motor aún no está creado? Escríbelo manualmente:
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej. Chevrolet 400 o Ford 300..."
                    value={customMotorInput}
                    onChange={(e) => setCustomMotorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomMotor();
                      }
                    }}
                    className="h-8 text-xs bg-white border-slate-200"
                  />
                  <Button
                    type="button"
                    onClick={() => handleAddCustomMotor()}
                    variant="outline"
                    className="h-8 px-3 text-xs bg-white border-amber-300 hover:bg-amber-100 text-amber-900 font-bold shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Añadir
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MOTOR SPECIFIC: Vincular Clutch Compatible */}
          {isMotorCategory && (
            <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-emerald-700" />
                <label className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  Clutch / Embrague Compatible
                </label>
              </div>
              <p className="text-[11.5px] text-emerald-800/80 leading-relaxed">
                Selecciona los kits de clutch que aplican para este motor. Quedarán vinculados en ambas secciones automáticamente.
              </p>

              <div className="max-h-40 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-lg p-2">
                {allClutchKits.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">
                    No hay kits de clutch registrados aún.
                  </p>
                ) : (
                  allClutchKits.map((ck) => {
                    const isSelected = selectedClutchKitIds.includes(ck.id);
                    return (
                      <div
                        key={ck.id}
                        onClick={() => handleToggleClutchKit(ck.id)}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors",
                          isSelected
                            ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-200"
                            : "hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{ck.name}</span>
                        </div>
                        {ck.vehicle_brands?.name && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {ck.vehicle_brands.name}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              {isClutchCategory
                ? "Códigos de Referencia (Plato | Disco | Collarín)"
                : "Descripción Corta (Opcional)"}
            </label>
            <Textarea
              placeholder={
                isClutchCategory
                  ? "Ej: PLATO: 1930 | DISCO: 811 | COLLARIN: CT24H"
                  : "Aplica para modelos 2005-2010..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500 min-h-[70px]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between uppercase tracking-wider">
              <span>Galería de Vehículo (Max 3)</span>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">{imageUrls.length}/3</span>
            </label>

            <div className="grid grid-cols-3 gap-2 mb-2">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative aspect-video rounded-md border border-slate-200 overflow-hidden bg-slate-50 group">
                  <img src={url} alt={`Imagen ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-white/90 text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {imageUrls.length < 3 && (
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`aspect-video rounded-md border-2 border-dashed border-slate-300 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    uploading ? 'bg-slate-50' : 'hover:border-emerald-400 hover:bg-emerald-50/50'
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-[10px] text-slate-500 font-medium">Subir foto</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createKit.isPending || updateKit.isPending}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 font-semibold shadow-sm"
            >
              <Save className="w-4 h-4" />
              {createKit.isPending || updateKit.isPending ? 'Guardando...' : 'Guardar Combo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
