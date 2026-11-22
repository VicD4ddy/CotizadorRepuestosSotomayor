'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useBcvMultiplier } from '@/hooks/use-supabase';
import { formatUSD } from '@/lib/utils';
import { ShoppingCart, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuoteCart } from './quote-cart';

type SheetState = 'collapsed' | 'half' | 'full';

interface MobileQuoteSheetProps {
  /** Force sheet open from external trigger (e.g. bottom nav cart button) */
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
}

export function MobileQuoteSheet({ forceOpen, onForceOpenHandled }: MobileQuoteSheetProps) {
  const [state, setState] = useState<SheetState>('collapsed');
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragActiveRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragLastYRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const dragStartStateRef = useRef<SheetState>('collapsed');
  const suppressClickRef = useRef(false);

  // Abrir directo a vista completa cuando lo dispara el botón del nav
  useEffect(() => {
    if (forceOpen) {
      setState('full');
      onForceOpenHandled?.();
    }
  }, [forceOpen, onForceOpenHandled]);

  // Bloquear scroll del fondo mientras el sheet esté desplegado
  useEffect(() => {
    if (state === 'collapsed') return;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehaviorY;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'contain';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehaviorY = prevOverscroll;
    };
  }, [state]);

  const handleBackdropClick = useCallback(() => {
    setState('collapsed');
  }, []);

  const resetSheetTransform = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
  }, []);

  const beginTouchDrag = useCallback(
    (clientY: number) => {
      dragActiveRef.current = true;
      dragStartYRef.current = clientY;
      dragLastYRef.current = clientY;
      dragStartTimeRef.current = Date.now();
      dragStartStateRef.current = state;

      if (sheetRef.current) {
        sheetRef.current.style.transition = 'none';
      }
    },
    [state]
  );

  const handleHeaderTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      beginTouchDrag(e.touches[0].clientY);
    },
    [beginTouchDrag]
  );

  const handleSheetAreaTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || state === 'collapsed') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, textarea, select, a, [data-cart-scroll]')) {
        return;
      }
      beginTouchDrag(e.touches[0].clientY);
    },
    [state, beginTouchDrag]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragActiveRef.current || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    dragLastYRef.current = currentY;
    const deltaY = currentY - dragStartYRef.current;
    const el = sheetRef.current;
    if (!el) return;

    if (dragStartStateRef.current === 'collapsed') {
      // Arrastre hacia arriba desde la barra colapsada (con 4px de margen muerto para taps)
      if (deltaY < -4) {
        const pullUp = Math.max(-80, (deltaY + 4) * 0.65);
        el.style.transform = `translateY(${pullUp}px)`;
      } else {
        el.style.transform = 'translateY(0px)';
      }
    } else {
      // Arrastre hacia abajo para cerrar el sheet abierto (sigue el dedo 1:1)
      const pullDown = deltaY > 4 ? deltaY - 4 : 0;
      el.style.transform = `translateY(${pullDown}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;

    const deltaY = dragLastYRef.current - dragStartYRef.current;
    const elapsedMs = Math.max(1, Date.now() - dragStartTimeRef.current);
    const velocity = deltaY / elapsedMs; // px por ms

    resetSheetTransform();

    if (dragStartStateRef.current === 'collapsed') {
      if (deltaY < -35 || (deltaY < -12 && velocity < -0.35)) {
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
        setState('full');
      }
    } else {
      if (deltaY > 90 || (deltaY > 25 && velocity > 0.45)) {
        setState('collapsed');
      }
    }
  }, [resetSheetTransform]);

  if (items.length === 0 && state === 'collapsed') return null;

  const subtotal = getSubtotal(bcvMultiplier);
  const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <>
      {/* Backdrop */}
      {state !== 'collapsed' && (
        <div
          className="lg:hidden fixed inset-0 bg-black/45 z-40 animate-in fade-in duration-200 touch-none"
          onClick={handleBackdropClick}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleSheetAreaTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={cn(
          'lg:hidden fixed left-0 right-0 bg-white transition-all duration-300 ease-out overscroll-contain',
          'rounded-t-md shadow-2xl border-t border-slate-200 flex flex-col',
          state === 'collapsed' && 'bottom-[68px] z-30 touch-none',
          state === 'half' && 'bottom-0 h-[62vh] z-40',
          state === 'full' && 'bottom-0 h-[88vh] z-40'
        )}
        style={
          state === 'collapsed'
            ? {
                height: '58px',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }
            : {
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }
        }
      >
        {state === 'collapsed' ? (
          /* ---- COLLAPSED: Toda la barra soporta arrastre arriba o tap ---- */
          <div
            className="w-full h-full flex flex-col justify-between touch-none"
            onTouchStart={handleHeaderTouchStart}
          >
            <div className="flex items-center justify-center pt-1.5 pb-0.5 pointer-events-none">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <button
              type="button"
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                setState('full');
              }}
              className="w-full flex items-center justify-between px-4 pb-2 active:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white font-mono tabular-nums font-bold text-[9px] min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-0.5">
                    {items.length}
                  </span>
                </div>
                <span className="text-[12.5px] font-bold font-mono tabular-nums text-slate-900 truncate">
                  {items.length} ítem{items.length !== 1 ? 's' : ''} · {totalUnits} ud{totalUnits !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[15.5px] font-black font-mono tabular-nums text-slate-900">
                  {formatUSD(subtotal)}
                </span>
                <ChevronUp className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </div>
        ) : (
          /* ---- OPEN: Zona táctil amplia de arrastre + QuoteCart sin doble cabecera ---- */
          <>
            <div
              className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none shrink-0 bg-white rounded-t-md border-b border-slate-100"
              onTouchStart={handleHeaderTouchStart}
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <QuoteCart onCollapse={() => setState('collapsed')} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
