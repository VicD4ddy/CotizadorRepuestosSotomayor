import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { categorySchema, CategoryFormValues } from '@/lib/schemas';
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-supabase';
import { Category } from '@/types';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || '',
      section: category?.section || '',
    },
    values: {
      name: category?.name || '',
      section: category?.section || '',
    },
  });

  const onSubmit = async (data: CategoryFormValues) => {
    setIsSubmitting(true);
    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, ...data });
        toast.success('Categoría actualizada exitosamente');
      } else {
        await createCategory.mutateAsync(data);
        toast.success('Categoría creada exitosamente');
      }
      onOpenChange(false);
      reset();
    } catch (error: any) {
      toast.error('Error al guardar la categoría', {
        description: error.message || 'Ocurrió un error inesperado',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
            {category ? 'Editar Categoría' : 'Añadir Nueva Categoría'}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {category ? 'Modifica los detalles de esta categoría.' : 'Ingresa los datos para una nueva categoría de inventario.'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Nombre de la Categoría *
            </label>
            <Input
              placeholder="Ej. Pastillas de Freno"
              {...register('name')}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500"
            />
            {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Sección Principal *
            </label>
            <Input
              placeholder="Ej. Frenos"
              {...register('section')}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500"
            />
            {errors.section && <p className="text-[11px] text-red-500 mt-1">{errors.section.message}</p>}
            <p className="text-[11px] text-slate-500 mt-1">
              Las categorías se agruparán por sección en los filtros.
            </p>
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
              disabled={isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Categoría'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
