import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VehicleBrand } from '@/types';
import { useCreateVehicleBrand, useUpdateVehicleBrand } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Save, Upload, Loader2, X } from 'lucide-react';

interface VehicleBrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: VehicleBrand | null;
}

export function VehicleBrandFormDialog({ open, onOpenChange, brand }: VehicleBrandFormDialogProps) {
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const createVehicleBrand = useCreateVehicleBrand();
  const updateVehicleBrand = useUpdateVehicleBrand();

  const isEditing = !!brand;

  useEffect(() => {
    if (open) {
      if (brand) {
        setName(brand.name);
        setLogoUrl(brand.logo_url || '');
      } else {
        setName('');
        setLogoUrl('');
      }
    }
  }, [open, brand]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes PNG, JPG, WebP o SVG');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `vehicle-brand-${Date.now()}.${fileExt}`;
      const filePath = `vehicle-brands/${fileName}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setLogoUrl(data.publicUrl);
      toast.success('Logo subido exitosamente');
    } catch (err: any) {
      toast.error('Error al subir el logo: ' + err.message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre de la marca es obligatorio');
      return;
    }

    try {
      if (isEditing) {
        await updateVehicleBrand.mutateAsync({
          id: brand.id,
          name: name.toUpperCase(),
          logo_url: logoUrl,
        });
        toast.success('Marca de Vehículo actualizada');
      } else {
        await createVehicleBrand.mutateAsync({
          name: name.toUpperCase(),
          logo_url: logoUrl,
        });
        toast.success('Marca de Vehículo creada exitosamente');
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
            {isEditing ? 'Editar Marca de Vehículo' : 'Nueva Marca de Vehículo'}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {isEditing 
              ? 'Modifica el nombre de la marca.' 
              : 'Añade una nueva marca a tu catálogo.'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Nombre de la Marca de Vehículo *
            </label>
            <Input
              placeholder="Ej. FORD, CHEVROLET, JEEP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500 uppercase"
              style={{ textTransform: 'uppercase' }}
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Logo (Opcional)
            </label>

            {/* Logo preview or upload area */}
            {logoUrl ? (
              <div className="relative border border-slate-200 rounded-lg bg-white p-4 flex items-center justify-center">
                <img 
                  src={logoUrl} 
                  alt="Logo Preview" 
                  className="h-12 object-contain max-w-full" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                />
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="absolute top-2 right-2 p-1 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                  title="Quitar logo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer group"
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mb-2" />
                    <p className="text-[12px] text-slate-500">Subiendo...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 mb-2 transition-colors" />
                    <p className="text-[12px] font-medium text-slate-600">Haz clic para subir logo</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP o SVG • Máx. 2MB</p>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* URL input as secondary option */}
            <div className="mt-2">
              <Input
                placeholder="O pega una URL: https://ejemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="bg-white border-slate-200 focus-visible:ring-emerald-500 text-[12px] h-8"
              />
            </div>
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
              disabled={createVehicleBrand.isPending || updateVehicleBrand.isPending || uploading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
            >
              <Save className="w-4 h-4" />
              {createVehicleBrand.isPending || updateVehicleBrand.isPending ? 'Guardando...' : 'Guardar Marca de Vehículo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
