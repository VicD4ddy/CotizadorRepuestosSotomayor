'use client';

import { Search, RefreshCw, Check, Landmark, Coins, TrendingUp, Calendar } from 'lucide-react';
import UseAnimations from 'react-useanimations';
import refresh from 'react-useanimations/lib/refresh';
import user from 'react-useanimations/lib/user';
import { NotificationPanel } from './notification-panel';
import { DailyBcvDialog } from './daily-bcv-dialog';
import { ProfileDialog } from './profile-dialog';
import { BcvAutoSyncDialog, type BcvApiResult } from './bcv-auto-sync-dialog';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useBcvRate,
  useUpdateBcvRate,
  useBinanceRate,
  useUpdateBinanceRate,
} from '@/hooks/use-supabase';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function Header() {
  const { data: bcvRate, isLoading } = useBcvRate();
  const updateBcv = useUpdateBcvRate();

  const { data: binanceRate, isLoading: isLoadingBinance } = useBinanceRate();
  const updateBinance = useUpdateBinanceRate();

  const [rateInput, setRateInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [binanceInput, setBinanceInput] = useState('');
  const [isEditingBinance, setIsEditingBinance] = useState(false);
  const [isRefreshingBinance, setIsRefreshingBinance] = useState(false);
  const manualBinanceOverrideRef = useRef(false);

  // Estado para el modal táctil de tasas en Mobile ('bcv' | 'binance' | null)
  const [mobileRateModal, setMobileRateModal] = useState<'bcv' | 'binance' | null>(null);
  const [mobileInputVal, setMobileInputVal] = useState('');
  const [mobileFechaValor, setMobileFechaValor] = useState<string | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Auto BCV API sync state
  const [isSyncingBcv, setIsSyncingBcv] = useState(false);
  const [bcvApiResult, setBcvApiResult] = useState<BcvApiResult | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

  useEffect(() => {
    if (bcvRate) {
      setRateInput(bcvRate.toFixed(2));
    }
  }, [bcvRate]);

  useEffect(() => {
    if (binanceRate && binanceRate > 0) {
      setBinanceInput(binanceRate.toFixed(2));
    }
  }, [binanceRate]);

  // Sincronización automática periódica en tiempo real para USDT/VES (cada 90 segundos)
  useEffect(() => {
    let isMounted = true;

    const syncLiveBinance = async () => {
      if (manualBinanceOverrideRef.current || isEditingBinance) return;
      try {
        const res = await fetch('/api/bcv-rate?only=binance', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (
          isMounted &&
          data?.success &&
          typeof data.binanceRate === 'number' &&
          data.binanceRate > 0
        ) {
          const currentVal = binanceRate || 0;
          if (Math.abs(data.binanceRate - currentVal) >= 0.05) {
            updateBinance.mutate(data.binanceRate);
          }
        }
      } catch {
        // Silencioso en segundo plano
      }
    };

    const initialTimer = setTimeout(syncLiveBinance, 2500);
    const intervalId = setInterval(syncLiveBinance, 90000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [binanceRate, isEditingBinance]);

  const handleRateSubmit = () => {
    const newRate = parseFloat(rateInput);
    if (isNaN(newRate) || newRate <= 0) {
      toast.error('Tasa BCV inválida');
      setIsEditing(false);
      if (bcvRate) setRateInput(bcvRate.toFixed(2));
      return;
    }
    updateBcv.mutate(newRate, {
      onSuccess: () => {
        toast.success(`Tasa BCV actualizada a Bs. ${newRate.toFixed(2)}`);
        setIsEditing(false);
      },
      onError: () => toast.error('Error al actualizar la tasa BCV'),
    });
  };

  const handleBinanceSubmit = () => {
    const newRate = parseFloat(binanceInput);
    if (isNaN(newRate) || newRate <= 0) {
      toast.error('Tasa Binance inválida');
      setIsEditingBinance(false);
      if (binanceRate && binanceRate > 0) setBinanceInput(binanceRate.toFixed(2));
      return;
    }
    manualBinanceOverrideRef.current = true;
    updateBinance.mutate(newRate, {
      onSuccess: () => {
        toast.success(`Tasa Binance actualizada manualmente a Bs. ${newRate.toFixed(2)}`);
        setIsEditingBinance(false);
      },
      onError: () => toast.error('Error al actualizar la tasa Binance'),
    });
  };

  const handleRefreshBinance = async () => {
    setIsRefreshingBinance(true);
    try {
      const res = await fetch('/api/bcv-rate?only=binance', { cache: 'no-store' });
      const data = await res.json();
      if (!data.success || typeof data.binanceRate !== 'number' || data.binanceRate <= 0) {
        throw new Error(data.error || 'No se pudo obtener la cotización de Binance P2P');
      }
      manualBinanceOverrideRef.current = false;
      await updateBinance.mutateAsync(data.binanceRate);
      setMobileInputVal(data.binanceRate.toFixed(2));
      toast.success(`🔄 Tasa Binance actualizada: Bs. ${data.binanceRate.toFixed(2)}`);
    } catch (err: any) {
      toast.error('Error al refrescar Binance: ' + (err?.message || 'Error de red'));
    } finally {
      setIsRefreshingBinance(false);
    }
  };

  const handleSyncBcv = async () => {
    setIsSyncingBcv(true);
    try {
      const res = await fetch('/api/bcv-rate?only=bcv', { cache: 'no-store' });
      const data = await res.json();
      if (!data.success || typeof data.rate !== 'number') {
        throw new Error(data.error || 'No se pudo obtener la tasa oficial del BCV');
      }
      setBcvApiResult({
        rate: data.rate,
        rawRate: data.rawRate,
        rawRateString: data.rawRateString,
        fechaValor: data.fechaValor,
        date: data.date,
        source: data.source,
      });
      setIsSyncDialogOpen(true);
    } catch (err: any) {
      toast.error('Error al consultar la tasa del BCV: ' + err.message);
    } finally {
      setIsSyncingBcv(false);
    }
  };

  // Refresco rápido desde el modal móvil de BCV
  const handleMobileRefreshBcv = async () => {
    setIsSyncingBcv(true);
    try {
      const res = await fetch('/api/bcv-rate?only=bcv', { cache: 'no-store' });
      const data = await res.json();
      if (!data.success || typeof data.rate !== 'number') {
        throw new Error(data.error || 'No se pudo obtener la tasa oficial del BCV');
      }
      setMobileInputVal(data.rate.toFixed(2));
      if (data.fechaValor) setMobileFechaValor(data.fechaValor);
      await updateBcv.mutateAsync(data.rate);
      const today = new Date().toLocaleDateString('en-CA');
      localStorage.setItem('daily_bcv_prompt_date', today);
      toast.success(`✅ Tasa BCV sincronizada: Bs. ${data.rate.toFixed(2)}`);
    } catch (err: any) {
      toast.error('Error al consultar BCV: ' + (err?.message || 'Error de red'));
    } finally {
      setIsSyncingBcv(false);
    }
  };

  const handleMobileModalSave = () => {
    const val = parseFloat(mobileInputVal);
    if (isNaN(val) || val <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }
    if (mobileRateModal === 'bcv') {
      updateBcv.mutate(val, {
        onSuccess: () => {
          toast.success(`✅ Tasa BCV guardada: Bs. ${val.toFixed(2)}`);
          setMobileRateModal(null);
        },
        onError: () => toast.error('Error al guardar tasa BCV'),
      });
    } else if (mobileRateModal === 'binance') {
      manualBinanceOverrideRef.current = true;
      updateBinance.mutate(val, {
        onSuccess: () => {
          toast.success(`✅ Tasa Binance guardada: Bs. ${val.toFixed(2)}`);
          setMobileRateModal(null);
        },
        onError: () => toast.error('Error al guardar tasa Binance'),
      });
    }
  };

  const openRateControl = (type: 'bcv' | 'binance') => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileFechaValor(null);
      if (type === 'bcv') {
        setMobileInputVal(bcvRate ? bcvRate.toFixed(2) : '');
      } else {
        setMobileInputVal(binanceRate && binanceRate > 0 ? binanceRate.toFixed(2) : '');
      }
      setMobileRateModal(type);
      return;
    }

    if (type === 'bcv') {
      setIsEditing(true);
    } else {
      setBinanceInput(binanceRate && binanceRate > 0 ? binanceRate.toFixed(2) : '');
      setIsEditingBinance(true);
    }
  };

  // Cálculo del diferencial cambiario (Opción A: ((Binance - BCV) / BCV) * 100 con 2 decimales)
  const hasValidRates =
    !isLoading &&
    !isLoadingBinance &&
    typeof bcvRate === 'number' &&
    bcvRate > 0 &&
    typeof binanceRate === 'number' &&
    binanceRate > 0;

  const diffPercent = hasValidRates
    ? ((binanceRate - bcvRate) / bcvRate) * 100
    : null;

  return (
    <header className="h-[48px] md:h-[52px] border-b border-slate-200 bg-white flex items-center justify-between px-2.5 md:px-5 sticky top-0 z-30 min-w-0">
      {/* Left: Title + Search */}
      <div className="flex items-center gap-1.5 md:gap-5 min-w-0">
        <div className="flex items-center shrink-0">
          <img
            src="/LogoRepuestosSotomayor.png"
            alt="Repuestos Sotomayor"
            className="h-5 md:h-7 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <h1 className="hidden lg:block text-[12px] md:text-[13px] font-bold tracking-wider uppercase text-slate-900 whitespace-nowrap ml-2">
            Repuestos Sotomayor
          </h1>
        </div>
        <div className="relative hidden md:block shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const input = form.elements.namedItem('globalSearch') as HTMLInputElement;
              const val = input.value.trim();
              if (val) {
                window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'inventory' } }));
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('global-search', { detail: { query: val } }));
                }, 50);
                input.value = '';
                input.blur();
              }
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              name="globalSearch"
              placeholder="Búsqueda global..."
              className="pl-9 pr-3 w-[160px] lg:w-[220px] h-[32px] rounded-md bg-slate-100 border-none text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
          </form>
        </div>
      </div>

      {/* Right: BCV Rate + Binance Rate + Differential + Actions */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* 1. BCV Rate */}
        {isEditing ? (
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[11px] text-slate-500 font-medium">BCV:</span>
            <input
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRateSubmit();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  if (bcvRate) setRateInput(bcvRate.toFixed(2));
                }
              }}
              onBlur={handleRateSubmit}
              className="w-[74px] h-[28px] px-2 text-[13px] text-emerald-600 font-mono tabular-nums font-bold bg-emerald-50 border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => openRateControl('bcv')}
            className="flex items-center gap-1 px-1.5 md:px-2.5 h-[26px] md:h-[28px] rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer active:scale-95"
            title="Tasa BCV (Toca para actualizar o editar)"
          >
            <span className="text-[10px] md:text-[11px] text-emerald-700 font-semibold">BCV:</span>
            <span className="text-[11.5px] md:text-[13.5px] font-mono tabular-nums font-bold text-emerald-600">
              {isLoading ? '...' : bcvRate?.toFixed(2)}
            </span>
          </button>
        )}

        {/* 2. Binance Rate (USDT/VES) */}
        {isEditingBinance ? (
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[11px] text-amber-700 font-medium">Binance:</span>
            <input
              value={binanceInput}
              onChange={(e) => setBinanceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBinanceSubmit();
                if (e.key === 'Escape') {
                  setIsEditingBinance(false);
                  if (binanceRate && binanceRate > 0) setBinanceInput(binanceRate.toFixed(2));
                }
              }}
              onBlur={handleBinanceSubmit}
              className="w-[78px] h-[28px] px-2 text-[13px] text-amber-700 font-mono tabular-nums font-bold bg-amber-50 border border-amber-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => openRateControl('binance')}
            className="flex items-center gap-1 px-1.5 md:px-2.5 h-[26px] md:h-[28px] rounded-md bg-amber-50 hover:bg-amber-100/90 border border-amber-200/90 transition-colors cursor-pointer active:scale-95"
            title="Tasa Binance P2P (Toca para refrescar o editar)"
          >
            <span className="text-[10px] md:text-[11px] text-amber-800 font-semibold">Binance:</span>
            <span className="text-[11.5px] md:text-[13.5px] font-mono tabular-nums font-bold text-amber-700">
              {isLoadingBinance ? '...' : binanceRate && binanceRate > 0 ? binanceRate.toFixed(2) : '--'}
            </span>
          </button>
        )}

        {/* Botón cuadrado compacto para refrescar exclusivamente Binance (Solo Desktop >= md) */}
        <button
          type="button"
          onClick={handleRefreshBinance}
          disabled={isRefreshingBinance}
          className="hidden md:flex w-[28px] h-[28px] items-center justify-center rounded-md border border-amber-300/90 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 text-amber-700 hover:text-amber-800 transition-all shadow-2xs disabled:opacity-50 active:scale-95 cursor-pointer shrink-0"
          title="Refrescar exclusivamente la tasa Binance (USDT/VES en tiempo real)"
        >
          <UseAnimations
            animation={refresh}
            size={15}
            strokeColor="#b45309"
            interaction="hover-replay"
            className={isRefreshingBinance ? 'animate-spin' : ''}
          />
        </button>

        {/* 3. Diferencial Cambiario (%) — Visible tanto en Mobile como en Desktop */}
        <div
          className="flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2.5 h-[26px] md:h-[28px] rounded-md bg-slate-100 border border-slate-200/90 text-slate-700 select-none"
          title={
            hasValidRates
              ? `Diferencial cambiario entre Binance (Bs. ${binanceRate!.toFixed(2)}) y BCV (Bs. ${bcvRate!.toFixed(2)}): Bs. ${(binanceRate! - bcvRate!).toFixed(2)}`
              : 'Esperando carga de tasa Binance para calcular el diferencial'
          }
        >
          <span className="hidden sm:inline text-[11px] text-slate-500 font-semibold">Dif:</span>
          <span className="text-[11px] md:text-[13px] font-mono tabular-nums font-bold text-slate-800">
            {diffPercent !== null
              ? `${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(2)}%`
              : '--%'}
          </span>
        </div>

        {/* 4. Botón de sincronización automática con API BCV (Solo Desktop >= md) */}
        <button
          onClick={handleSyncBcv}
          disabled={isSyncingBcv}
          className="hidden md:flex items-center gap-1.5 h-[28px] px-2.5 rounded-md border border-emerald-300/90 bg-emerald-50/60 hover:bg-emerald-100 hover:border-emerald-400 text-emerald-700 hover:text-emerald-800 text-[11.5px] font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          title="Consultar y actualizar tasa oficial desde el BCV"
        >
          <UseAnimations
            animation={refresh}
            size={15}
            strokeColor="#059669"
            interaction="hover-replay"
            className={isSyncingBcv ? 'animate-spin' : ''}
          />
          <span className="hidden xl:inline">Actualizar BCV</span>
          <span className="xl:hidden">Auto BCV</span>
        </button>

        <div className="w-px h-5 bg-slate-200 hidden md:block" />

        <NotificationPanel />
        <button
          onClick={() => setIsProfileOpen(true)}
          className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center transition-all cursor-pointer ring-2 ring-transparent hover:ring-emerald-500/60 shadow-xs text-white shrink-0"
          title="Perfil y Actualizaciones del Sistema"
        >
          <UseAnimations animation={user} size={16} strokeColor="#ffffff" interaction="hover-replay" />
        </button>
      </div>

      {/* Modal Táctil Rápido para Mobile al tocar BCV o Binance */}
      <Dialog
        open={mobileRateModal !== null}
        onOpenChange={(open) => {
          if (!open) setMobileRateModal(null);
        }}
      >
        <DialogContent className="w-[92vw] max-w-[380px] p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl rounded-xl">
          <div
            className={
              mobileRateModal === 'bcv'
                ? 'bg-slate-900 p-4 text-white border-b border-slate-800'
                : 'bg-slate-900 p-4 text-white border-b border-slate-800'
            }
          >
            <div className="flex items-center gap-2.5">
              <div
                className={
                  mobileRateModal === 'bcv'
                    ? 'w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0'
                    : 'w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0'
                }
              >
                {mobileRateModal === 'bcv' ? (
                  <Landmark className="w-4 h-4" />
                ) : (
                  <Coins className="w-4 h-4" />
                )}
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-white">
                  {mobileRateModal === 'bcv'
                    ? 'Tasa Oficial BCV'
                    : 'Tasa Binance P2P (USDT)'}
                </DialogTitle>
                <p className="text-[11px] text-slate-400">
                  {mobileRateModal === 'bcv'
                    ? 'Sincroniza desde bcv.org.ve o edita manualmente'
                    : 'Sincroniza USDT/VES en vivo o edita manualmente'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3.5 bg-slate-50/70">
            {/* Botón grande de Refrescar por API */}
            <button
              type="button"
              onClick={
                mobileRateModal === 'bcv'
                  ? handleMobileRefreshBcv
                  : handleRefreshBinance
              }
              disabled={isSyncingBcv || isRefreshingBinance}
              className={
                mobileRateModal === 'bcv'
                  ? 'w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50'
                  : 'w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50'
              }
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isSyncingBcv || isRefreshingBinance ? 'animate-spin' : ''
                }`}
              />
              <span>
                {isSyncingBcv || isRefreshingBinance
                  ? 'Consultando tasa en tiempo real...'
                  : mobileRateModal === 'bcv'
                  ? 'Refrescar Tasa Oficial BCV'
                  : 'Refrescar Tasa Binance en Vivo'}
              </span>
            </button>

            {mobileRateModal === 'bcv' && mobileFechaValor && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Fecha Valor:
                </span>
                <span className="font-bold capitalize">{mobileFechaValor}</span>
              </div>
            )}

            {/* Input de edición manual */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                Valor de la Tasa (Bs / $)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={mobileInputVal}
                  onChange={(e) => setMobileInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMobileModalSave()}
                  className="flex-1 h-10 px-3 rounded-md border border-slate-300 font-mono tabular-nums font-extrabold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <Button
                  type="button"
                  onClick={handleMobileModalSave}
                  disabled={updateBcv.isPending || updateBinance.isPending}
                  className="h-10 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar</span>
                </Button>
              </div>
            </div>

            {/* Resumen de Diferencial */}
            <div className="px-3 py-2 rounded-lg bg-slate-900 text-white flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Diferencial USDT vs BCV:</span>
              </span>
              <span className="font-mono tabular-nums font-bold text-amber-300">
                {diffPercent !== null
                  ? `${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(2)}%`
                  : '--%'}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DailyBcvDialog />
      <ProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
      <BcvAutoSyncDialog
        open={isSyncDialogOpen}
        onOpenChange={setIsSyncDialogOpen}
        currentRate={bcvRate || 0}
        apiResult={bcvApiResult}
      />
    </header>
  );
}
