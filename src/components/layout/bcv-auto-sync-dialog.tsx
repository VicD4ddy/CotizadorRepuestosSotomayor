'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Landmark, Sparkles, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateBcvRate } from '@/hooks/use-supabase';

export interface BcvApiResult {
  rate: number;
  rawRate?: number;
  rawRateString?: string | null;
  fechaValor?: string | null;
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

  if (!apiResult) return null;

  const targetRate = apiResult.rate || currentRate;
  const diffBcv = targetRate - currentRate;
  const hasChangedBcv = Math.abs(diffBcv) >= 0.001;

  const formattedFechaValor =
    apiResult.fechaValor ||
    (apiResult.date
      ? new Date(apiResult.date).toLocaleDateString('es-VE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : null);

  const handleConfirm = async () => {
    if (isNaN(targetRate) || targetRate <= 0) {
      toast.error('La tasa BCV no es válida');
      return;
    }

    try {
      await updateBcv.mutateAsync(targetRate);
      const today = new Date().toLocaleDateString('en-CA');
      localStorage.setItem('daily_bcv_prompt_date', today);

      toast.success(`✅ Tasa BCV actualizada a Bs. ${targetRate.toFixed(2)}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Error al actualizar la tasa BCV: ' + (err?.message || 'Error desconocido'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] w-[95vw] p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl rounded-xl">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Tasa Oficial BCV</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                  OFICIAL BCV
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {apiResult.source || 'Portal Oficial BCV (bcv.org.ve)'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 bg-slate-50/70">
          {/* Fecha Valor & Raw Rate Callout */}
          <div className="p-3 rounded-lg bg-emerald-950/5 border border-emerald-200/90 flex flex-col gap-1.5 text-xs">
            {formattedFechaValor && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Fecha Valor BCV:</span>
                </span>
                <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300/70 capitalize">
                  {formattedFechaValor}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Valor oficial publicado (8 decimales):</span>
              <span className="font-mono tabular-nums font-bold text-slate-800">
                Bs.{' '}
                {apiResult.rawRateString ||
                  (apiResult.rawRate !== undefined
                    ? apiResult.rawRate.toFixed(8)
                    : apiResult.rate.toFixed(2))}
              </span>
            </div>
          </div>

          {/* BCV Comparison */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="p-3.5 rounded-lg bg-white border border-slate-200">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                Tasa Actual en Sistema
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-700">
                Bs. {currentRate.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Vigente en cotizador
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-emerald-50/90 border border-emerald-300 relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  Nueva Tasa BCV
                </span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700">
                Bs. {targetRate.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-700 font-mono tabular-nums font-medium mt-1">
                {hasChangedBcv ? (
                  diffBcv > 0
                    ? `▲ +${diffBcv.toFixed(2)} Bs.`
                    : `▼ ${diffBcv.toFixed(2)} Bs.`
                ) : (
                  'Mismo valor actual'
                )}
              </div>
            </div>
          </div>

          <p className="text-[11.5px] text-slate-500 text-center">
            ¿Deseas aplicar esta tasa <strong className="text-slate-700">BCV (Bs. {targetRate.toFixed(2)})</strong> a todos los precios y cálculos del cotizador de inmediato?
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9 px-4 rounded-md"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={updateBcv.isPending}
              className="text-xs h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs cursor-pointer"
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
