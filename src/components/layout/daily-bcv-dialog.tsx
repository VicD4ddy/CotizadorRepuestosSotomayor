'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useBcvRate, useUpdateBcvRate } from '@/hooks/use-supabase';
import { DollarSign, Calendar, RefreshCw, Sparkles } from 'lucide-react';

export function DailyBcvDialog() {
  const { data: bcvRate, isLoading } = useBcvRate();
  const updateBcv = useUpdateBcvRate();
  const [open, setOpen] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [isFetchingBcv, setIsFetchingBcv] = useState(false);
  const [apiFetchedInfo, setApiFetchedInfo] = useState<{ rate: number; date?: string; source?: string } | null>(null);

  useEffect(() => {
    if (isLoading || bcvRate === undefined) return;

    // Obtener la fecha de hoy en formato YYYY-MM-DD local
    const today = new Date().toLocaleDateString('en-CA');
    const lastPromptDate = localStorage.getItem('daily_bcv_prompt_date');

    if (lastPromptDate !== today) {
      setRateInput(bcvRate.toFixed(2));
      setOpen(true);

      // Precargar automáticamente la tasa oficial del BCV
      fetch('/api/bcv-rate')
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && typeof data.rate === 'number') {
            setRateInput(data.rate.toFixed(2));
            setApiFetchedInfo({
              rate: data.rate,
              date: data.date,
              source: data.source,
            });
          }
        })
        .catch(() => {
          // Si no hay conexión o falla, mantiene la tasa actual del sistema
        });
    }
  }, [bcvRate, isLoading]);

  const handleFetchAutoBcv = async () => {
    setIsFetchingBcv(true);
    try {
      const res = await fetch('/api/bcv-rate');
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'No se pudo obtener la tasa oficial');
      }
      setRateInput(data.rate.toFixed(2));
      setApiFetchedInfo({
        rate: data.rate,
        date: data.date,
        source: data.source,
      });
      toast.success(`Tasa oficial del BCV obtenida: Bs. ${data.rate.toFixed(2)}`);
    } catch (err: any) {
      toast.error('Error al consultar la API del BCV: ' + err.message);
    } finally {
      setIsFetchingBcv(false);
    }
  };

  const handleKeepRate = () => {
    const today = new Date().toLocaleDateString('en-CA');
    localStorage.setItem('daily_bcv_prompt_date', today);
    setOpen(false);
    toast.success(`Se mantiene la tasa BCV actual: Bs ${bcvRate?.toFixed(2)}`);
  };

  const handleUpdateRate = () => {
    const newRate = parseFloat(rateInput);
    if (isNaN(newRate) || newRate <= 0) {
      toast.error('Por favor, ingresa una tasa válida mayor a 0');
      return;
    }

    updateBcv.mutate(newRate, {
      onSuccess: () => {
        const today = new Date().toLocaleDateString('en-CA');
        localStorage.setItem('daily_bcv_prompt_date', today);
        setOpen(false);
        toast.success(`✅ Tasa BCV del día actualizada a Bs ${newRate.toFixed(2)}`);
      },
      onError: () => {
        toast.error('Error al actualizar la tasa en la base de datos');
      },
    });
  };

  if (!open) return null;

  const todayFormatted = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        handleKeepRate();
      }
    }}>
      <DialogContent className="sm:max-w-[440px] p-6 bg-white rounded-2xl shadow-2xl border border-slate-100">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1">
            <DollarSign className="w-6 h-6 stroke-[2.5]" />
          </div>
          <DialogTitle className="text-center text-xl font-extrabold text-slate-900 tracking-tight">
            Actualización Diaria Tasa BCV
          </DialogTitle>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100/80 py-1.5 px-3 rounded-full w-fit mx-auto capitalize">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{todayFormatted}</span>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4 text-center">
          <p className="text-sm text-slate-600 leading-relaxed">
            ¡Buenos días! Al ingresar por primera vez hoy, verifica si deseas actualizar o mantener la tasa del Banco Central de Venezuela (<strong className="text-slate-800">BCV</strong>) para el cálculo de cotizaciones e inventario.
          </p>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Tasa Oficial para Hoy (Bs/$)
            </label>
            <div className="relative max-w-[190px] mx-auto">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Bs.</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateRate()}
                className="pl-9 pr-3 text-center text-lg font-mono font-extrabold text-emerald-600 bg-white border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 h-11"
                autoFocus
              />
            </div>

            {/* Botón para actualizar tasa automáticamente desde la API */}
            <button
              type="button"
              onClick={handleFetchAutoBcv}
              disabled={isFetchingBcv}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg border border-emerald-300/80 bg-white hover:bg-emerald-50/80 text-emerald-700 hover:text-emerald-800 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Consultar y rellenar automáticamente con la tasa oficial del BCV"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isFetchingBcv ? 'animate-spin' : ''}`} />
              <span>Actualizar tasa automáticamente</span>
            </button>

            {apiFetchedInfo ? (
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-100/60 border border-emerald-200 py-1 px-2.5 rounded-lg w-fit mx-auto">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>API Oficial BCV: <strong>Bs. {apiFetchedInfo.rate.toFixed(2)}</strong></span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 block text-center">
                Tasa anterior en sistema: <strong className="text-slate-600">Bs. {bcvRate?.toFixed(2)}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleKeepRate}
            className="flex-1 font-semibold text-slate-700 border-slate-300 hover:bg-slate-50 h-11"
          >
            Mantener Bs. {bcvRate?.toFixed(2)}
          </Button>
          <Button
            type="button"
            onClick={handleUpdateRate}
            disabled={updateBcv.isPending || !rateInput || parseFloat(rateInput) <= 0}
            className="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 h-11"
          >
            {updateBcv.isPending ? 'Actualizando...' : 'Actualizar Tasa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
