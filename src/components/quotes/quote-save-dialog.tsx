import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/store/cart-store';
import { useBcvRate, useCreateQuote, useBcvMultiplier } from '@/hooks/use-supabase';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';

interface QuoteSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteSaveDialog({ open, onOpenChange }: QuoteSaveDialogProps) {
  const { items, paymentMethod, clientName, clientPhone, setClientName, setClientPhone, getSubtotal, clearCart } = useCartStore();
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const createQuote = useCreateQuote();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = getSubtotal(bcvMultiplier);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Agrega productos a la cotización');
      return;
    }

    if (!clientName.trim()) {
      toast.error('El nombre del cliente es obligatorio para guardar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createQuote.mutateAsync({
        quote: {
          client_name: clientName,
          client_phone: clientPhone,
          total_usd: total,
          bcv_rate: bcvRate,
          status: 'Cotizada', // Default status for saved quotes
        },
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price_usd: item.unit_price_usd,
        })),
      });
      toast.success('Cotización guardada exitosamente en el historial');
      clearCart();
      onOpenChange(false);
    } catch {
      toast.error('Error al guardar la cotización');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Guardar Cotización
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Ingresa los datos del cliente para archivar esta cotización en el historial.
          </p>
        </DialogHeader>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Nombre del Cliente *
            </label>
            <Input
              placeholder="Ej. Juan Pérez"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Teléfono (Opcional)
            </label>
            <Input
              placeholder="Ej. 0414-1234567"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-emerald-500"
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
              disabled={isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Cotización'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
