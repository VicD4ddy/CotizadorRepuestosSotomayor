import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Kit } from '@/types';
import { useCreateKit, useUpdateKit } from '@/hooks/use-supabase';
import { toast } from 'sonner';
import { X, Save } from 'lucide-react';

interface KitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: Kit | null;
  category: string;
}

export function KitFormDialog({ open, onOpenChange, kit, category }: KitFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createKit = useCreateKit();
  const updateKit = useUpdateKit();

  const isEditing = !!kit;

  useEffect(() => {
    if (open) {
      if (kit) {
        setName(kit.name);
        setDescription(kit.description || '');
      } else {
        setName('');
        setDescription('');
      }
    }
  }, [open, kit]);

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
        });
        toast.success('Combo actualizado');
      } else {
        await createKit.mutateAsync({
          name,
          description,
          category,
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
              Descripción Corta (Opcional)
            </label>
            <Textarea
              placeholder="Aplica para modelos 2005-2010..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500 min-h-[80px]"
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
