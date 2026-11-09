'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useBcvRate, useBcvMultiplier } from '@/hooks/use-supabase';
import { formatUSD } from '@/lib/utils';
import { ShoppingCart, ChevronUp, ChevronDown, X } from 'lucide-react';
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
  const dragStartY = useRef(0);
  const dragStartState = useRef<SheetState>('collapsed');

  // Handle external force-open
  useEffect(() => {
    if (forceOpen) {
      setState(items.length > 0 ? 'half' : 'full');
      onForceOpenHandled?.();
    }
  }, [forceOpen, items.length, onForceOpenHandled]);

  // Close sheet when clicking backdrop (half/full state)
  const handleBackdropClick = useCallback(() => {
    setState('collapsed');
  }, []);

  // Touch gesture handling for swipe up/down
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartState.current = state;
  }, [state]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const endY = e.changedTouches[0].clientY;
    const diff = dragStartY.current - endY;
    const threshold = 60;

    if (Math.abs(diff) < threshold) return;

    if (diff > 0) {
      // Swiped UP
      if (dragStartState.current === 'collapsed') setState('half');
      else if (dragStartState.current === 'half') setState('full');
    } else {
      // Swiped DOWN
      if (dragStartState.current === 'full') setState('half');
      else if (dragStartState.current === 'half') setState('collapsed');
    }
  }, []);

  // Don't render anything if cart is empty and collapsed
  if (items.length === 0 && state === 'collapsed') return null;

  const subtotal = getSubtotal(bcvMultiplier);

  return (
    <>
      {/* Backdrop */}
      {state !== 'collapsed' && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
          onClick={handleBackdropClick}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'lg:hidden fixed left-0 right-0 z-50 bg-white transition-all duration-300 ease-out',
          'rounded-t-xl shadow-2xl border-t border-slate-200',
          state === 'collapsed' && 'bottom-[68px]',
          state === 'half' && 'bottom-0 h-[55vh]',
          state === 'full' && 'bottom-0 h-[calc(100vh-48px)]',
        )}
        style={state === 'collapsed' ? { 
          height: '60px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        } : state === 'half' ? {
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        } : undefined}
      >
        {/* Drag Handle Bar */}
        <div 
          className="flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {state === 'collapsed' ? (
          /* ---- COLLAPSED: Mini summary bar ---- */
          <button
            onClick={() => setState('half')}
            className="w-full flex items-center justify-between px-4 pb-2 active:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white font-mono tabular-nums font-bold text-[9px] min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-0.5">
                  {items.length}
                </span>
              </div>
              <span className="text-[13px] font-bold text-slate-900">
                {items.length} producto{items.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-black font-mono tabular-nums text-slate-900">
                {formatUSD(subtotal)}
              </span>
              <ChevronUp className="w-4 h-4 text-slate-400" />
            </div>
          </button>
        ) : (
          /* ---- HALF / FULL: Full QuoteCart content ---- */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header with controls */}
            <div className="flex items-center justify-between px-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <span className="text-[14px] font-bold text-slate-900">
                  Cotización ({items.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                {state === 'half' && (
                  <button
                    onClick={() => setState('full')}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Expandir"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                )}
                {state === 'full' && (
                  <button
                    onClick={() => setState('half')}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Minimizar"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setState('collapsed')}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* QuoteCart content (reusing existing component) */}
            <div className="flex-1 overflow-hidden">
              <QuoteCart />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

