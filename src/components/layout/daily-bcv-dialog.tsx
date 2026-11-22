'use client';

import { useState, useEffect, useRef } from 'react';
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
import { DollarSign, Calendar, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BcvFetchedInfo {
  rate: number;
  date?: string;
  source?: string;
  fechaValor?: string;
}

async function fetchBcvRateFromApi(): Promise<BcvFetchedInfo> {
  const res = await fetch('/api/bcv-rate', { cache: 'no-store' });
  const data = await res.json();
  if (!data?.success || typeof data.rate !== 'number') {
    throw new Error(data?.error || 'No se pudo obtener la tasa oficial');
  }
  return {
    rate: data.rate,
    date: data.date,
    source: data.source,
    fechaValor: data.fechaValor,
  };
}

export function DailyBcvDialog() {
  const { data: bcvRate, isLoading } = useBcvRate();
  const updateBcv = useUpdateBcvRate();
  const [open, setOpen] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [isFetchingBcv, setIsFetchingBcv] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [apiFetchedInfo, setApiFetchedInfo] = useState<BcvFetchedInfo | null>(null);
  const hasCheckedTodayRef = useRef(false);

  // Abrir una vez al día si aún no se ha confirmado la tasa hoy
  useEffect(() => {
    if (isLoading || bcvRate === undefined || hasCheckedTodayRef.current) return;

    const today = new Date().toLocaleDateString('en-CA');
    const lastPromptDate = localStorage.getItem('daily_bcv_prompt_date');

    if (lastPromptDate !== today) {
      hasCheckedTodayRef.current = true;
      setRateInput(bcvRate.toFixed(2));
      setOpen(true);
    }
  }, [bcvRate, isLoading]);

  // Precargar automáticamente la tasa oficial BCV cuando el modal se abre
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsFetchingBcv(true);
    setFetchFailed(false);

    fetchBcvRateFromApi()
      .then((info) => {
        if (cancelled) return;
        setRateInput(info.rate.toFixed(2));
        setApiFetchedInfo(info);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchFailed(true);
      })
      .finally(() => {
        if (!cancelled) {
          setIsFetchingBcv(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleFetchAutoBcv = async () => {
    setIsFetchingBcv(true);
    setFetchFailed(false);
    try {
      const info = await fetchBcvRateFromApi();
      setRateInput(info.rate.toFixed(2));
      setApiFetchedInfo(info);
      toast.success(`Tasa oficial del BCV obtenida: Bs. ${info.rate.toFixed(2)}`);
    } catch (err: any) {
      setFetchFailed(true);
      toast.error('Error al consultar la API del BCV: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsFetchingBcv(false);
    }
  };

  const handleKeepRate = () => {
    const today = new Date().toLocaleDateString('en-CA');
    localStorage.setItem('daily_bcv_prompt_date', today);
    setOpen(false);
    toast.success(`Se mantiene la tasa BCV actual: Bs ${(bcvRate ?? 0).toFixed(2)}`);
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

  const currentRate = bcvRate ?? 0;
  const parsedNewRate = parseFloat(rateInput);
  const isValidNewRate = !isNaN(parsedNewRate) && parsedNewRate > 0;
  const diffRate = isValidNewRate ? parsedNewRate - currentRate : 0;
  const hasChanged = isValidNewRate && Math.abs(diffRate) >= 0.005;

  const todayFormatted = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          handleKeepRate();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px] w-[95vw] p-0 overflow-hidden bg-white rounded-md border border-slate-200 shadow-2xl gap-0 [&>button]:text-slate-300 [&>button]:hover:text-white">
        {/* Cabecera Industrial Oscura */}
        <DialogHeader className="px-5 py-4 bg-[#0F172A] text-white border-b border-slate-800">
          <div className="flex items-center gap-3 pr-7">
            <div className="w-10 h-10 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-[16px] font-bold text-white tracking-tight">
                Actualización Diaria Tasa BCV
              </DialogTitle>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-1 capitalize">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{todayFormatted}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Cuerpo Comparativo */}
        <div className="p-5 space-y-4 bg-[#F8FAFC]">
          <p className="text-[12.5px] text-slate-600 leading-relaxed">
            Verifica la tasa del Banco Central de Venezuela (<strong className="text-slate-900">BCV</strong>) antes de iniciar tus cotizaciones de hoy.
          </p>

          {/* Tarjetas: Tasa Actual vs Nueva Tasa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch relative">
            {/* Izquierda: Tasa Actual */}
            <div className="bg-white border border-slate-200 rounded-md p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tasa Actual
                </span>
                <div className="text-[22px] font-extrabold font-mono tabular-nums text-slate-800 mt-1.5 leading-tight">
                  Bs. {currentRate.toFixed(2)}
                </div>
              </div>
              <span className="text-[11px] text-slate-400 mt-2 block">
                Vigente en el sistema
              </span>
            </div>

            {/* Indicador central de dirección en desktop */}
            <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center text-slate-400 z-10 pointer-events-none">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>

            {/* Derecha: Nueva Tasa a Actualizar */}
            <div className="bg-emerald-50/80 border border-emerald-300 rounded-md p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Nueva Tasa a Actualizar
                  </span>
                  {isFetchingBcv && (
                    <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin shrink-0" />
                  )}
                </div>

                <div className="relative mt-1.5">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-emerald-700/80 text-xs pointer-events-none">
                    Bs.
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateRate()}
                    className="pl-9 pr-2 text-lg font-mono tabular-nums font-extrabold text-emerald-700 bg-white border-emerald-300 focus-visible:ring-emerald-500 h-10 rounded-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div className="mt-2 text-[11px] font-mono tabular-nums font-semibold">
                {isFetchingBcv ? (
                  <span className="text-slate-500 font-sans">Consultando portal BCV...</span>
                ) : !isValidNewRate ? (
                  <span className="text-red-600 font-sans">Ingresa una tasa válida</span>
                ) : hasChanged ? (
                  <span className={cn(diffRate > 0 ? 'text-emerald-700' : 'text-amber-700')}>
                    {diffRate > 0 ? `▲ +${diffRate.toFixed(2)} Bs.` : `▼ ${diffRate.toFixed(2)} Bs.`}
                  </span>
                ) : (
                  <span className="text-slate-600 font-sans">Misma tasa actual</span>
                )}
              </div>
            </div>
          </div>

          {/* Consulta automática + badge del portal */}
          <div className="bg-white border border-slate-200 rounded-md p-3 space-y-2.5">
            <button
              type="button"
              onClick={handleFetchAutoBcv}
              disabled={isFetchingBcv}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-sm border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 transition-colors active:scale-[0.99] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Consultar y rellenar automáticamente con la tasa oficial del BCV"
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5 text-emerald-600', isFetchingBcv && 'animate-spin')}
              />
              <span>{isFetchingBcv ? 'Consultando tasa oficial BCV...' : 'Consultar tasa oficial BCV'}</span>
            </button>

            {apiFetchedInfo && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 py-1.5 px-2.5 rounded-sm">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Portal Oficial BCV:{' '}
                    <strong className="font-mono tabular-nums">
                      Bs. {apiFetchedInfo.rate.toFixed(2)}
                    </strong>
                  </span>
                </div>
                {apiFetchedInfo.fechaValor && (
                  <span className="text-[10.5px] font-mono tabular-nums font-semibold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                    Fecha Valor: {apiFetchedInfo.fechaValor}
                  </span>
                )}
              </div>
            )}

            {fetchFailed && !isFetchingBcv && !apiFetchedInfo && (
              <p className="text-[11px] text-amber-700 text-center">
                No se pudo conectar al portal BCV. Puedes ingresar la tasa manualmente o mantener la actual.
              </p>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleKeepRate}
              className="flex-1 font-semibold font-mono tabular-nums text-slate-700 bg-white border-slate-300 hover:bg-slate-100 h-10 rounded-sm cursor-pointer"
            >
              Mantener Bs. {currentRate.toFixed(2)}
            </Button>
            <Button
              type="button"
              onClick={handleUpdateRate}
              disabled={updateBcv.isPending || !isValidNewRate}
              className="flex-1 font-bold font-mono tabular-nums bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-10 rounded-sm cursor-pointer active:scale-[0.98]"
            >
              {updateBcv.isPending
                ? 'Actualizando...'
                : isValidNewRate
                ? `Actualizar a Bs. ${parsedNewRate.toFixed(2)}`
                : 'Actualizar Tasa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
