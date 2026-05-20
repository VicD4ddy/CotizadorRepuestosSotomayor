import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Kit } from '@/types';
import { useCreateKit, useUpdateKit, useVehicleBrands, useUploadKitImage } from '@/hooks/use-supabase';
import { toast } from 'sonner';
import { X, Save, Upload, Loader2 } from 'lucide-react';

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
  
  const createKit = useCreateKit();
  const updateKit = useUpdateKit();
  const uploadImage = useUploadKitImage();
  const { data: vehicleBrands = [] } = useVehicleBrands();

  const isEditing = !!kit;

  useEffect(() => {
    if (open) {
      if (kit) {
        setName(kit.name);
        setDescription(kit.description || '');
        setVehicleBrandId(kit.vehicle_brand_id || '');
        setImageUrls(kit.image_urls || []);
      } else {
        setName('');
        setDescription('');
        setVehicleBrandId('');
        setImageUrls([]);
      }
    }
  }, [open, kit]);

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
      if (isEditing) {
        await updateKit.mutateAsync({
          id: kit.id,
          name,
          description,
          category: kit.category,
          vehicle_brand_id: vehicleBrandId || null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        });
        toast.success('Combo actualizado');
      } else {
        await createKit.mutateAsync({
          name,
          description,
          category,
          vehicle_brand_id: vehicleBrandId || null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        });
        toast.success('Combo creado exitosamente');
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error al guardar', { description: error.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
            {kit ? `Editar Cotizador de ${category}` : `Nuevo Cotizador de ${category}`}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {isEditing 
              ? 'Modifica los datos generales de este combo.' 
              : `Crea una plantilla de repuestos para la sección ${category}.`}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Nombre del Combo *
            </label>
            <Input
              placeholder="Ej. Kit Motor Ford 300"
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

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Descripción Corta (Opcional)
            </label>
            <Textarea
              placeholder="Aplica para modelos 2005-2010..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500 min-h-[80px]"
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

          <div className="pt-4 flex justify-end gap-3">
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
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
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
