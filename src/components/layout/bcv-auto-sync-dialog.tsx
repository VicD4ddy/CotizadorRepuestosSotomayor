'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, ArrowRight, DollarSign, Calendar, Landmark, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateBcvRate } from '@/hooks/use-supabase';

export interface BcvApiResult {
  rate: number;
  rawRate?: number;
  date?: string;
  source?: string;
}

interface BcvAutoSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRate: number;
  apiResult: BcvApiResult | null;
}

export function BcvAutoSyncDialog({
  open,
  onOpenChange,
  currentRate,
  apiResult,
}: BcvAutoSyncDialogProps) {
  const updateBcv = useUpdateBcvRate();
  const [adjustedRate, setAdjustedRate] = useState<string>('');

  if (!apiResult) return null;

  const targetRate = adjustedRate ? parseFloat(adjustedRate) || apiResult.rate : apiResult.rate;
  const diff = targetRate - currentRate;
  const hasChanged = Math.abs(diff) >= 0.001;

  const handleConfirm = () => {
    if (isNaN(targetRate) || targetRate <= 0) {
      toast.error('La tasa ingresada no es válida');
      return;
    }

    updateBcv.mutate(targetRate, {
      onSuccess: () => {
        const today = new Date().toLocaleDateString('en-CA');
        localStorage.setItem('daily_bcv_prompt_date', today);
        toast.success(`✅ Tasa BCV actualizada a Bs. ${targetRate.toFixed(2)}`);
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast.error('Error al actualizar la tasa: ' + err.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] w-[95vw] p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Tasa Oficial BCV</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/40">
                  API OFICIAL
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                {apiResult.source || 'Banco Central de Venezuela'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 bg-slate-50/60">
          {/* Comparison Cards */}
          <div className="grid grid-cols-2 gap-3 items-center">
            {/* Current */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                Tasa Actual
              </div>
              <div className="text-lg font-bold font-mono text-slate-700">
                Bs. {currentRate.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                En el sistema
              </div>
            </div>

            {/* New from API */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 shadow-2xs relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Nueva Tasa
                </span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold font-mono text-emerald-700">
                Bs. {apiResult.rate.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-1">
                {hasChanged ? (
                  diff > 0 ? `▲ +${diff.toFixed(2)} Bs.` : `▼ ${diff.toFixed(2)} Bs.`
                ) : (
                  'Mismo valor actual'
                )}
              </div>
            </div>
          </div>

          {/* Details callout */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Valor exacto reportado:</span>
              <span className="font-mono font-bold text-slate-800">
                {apiResult.rawRate !== undefined ? apiResult.rawRate : apiResult.rate} Bs.
              </span>
            </div>
            {apiResult.date && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Fecha de la tasa:</span>
                <span className="text-slate-700 font-medium">
                  {new Date(apiResult.date).toLocaleDateString('es-VE', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          <p className="text-[11.5px] text-slate-500 text-center">
            ¿Deseas aplicar esta tasa a todos los precios y cálculos del cotizador de inmediato?
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9 px-4 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={updateBcv.isPending}
              className="text-xs h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
            >
              {updateBcv.isPending ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar y Aplicar Tasa</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
