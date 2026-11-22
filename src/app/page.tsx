'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useCartStore } from '@/store/cart-store';
import { ShoppingCart, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ProductTable } from '@/components/inventory/product-table';
import { QuoteCart } from '@/components/quotes/quote-cart';
import { AiQueueBanner } from '@/components/inventory/ai-queue-banner';
import { MobileNav } from '@/components/layout/mobile-nav';
import { MobileQuoteSheet } from '@/components/quotes/mobile-quote-sheet';
import { Kit } from '@/types';

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

const ClasificacionesContainer = dynamic(
  () => import('@/components/categories/clasificaciones-container').then((m) => m.ClasificacionesContainer),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);
const QuoteTable = dynamic(
  () => import('@/components/quotes/quote-table').then((m) => m.QuoteTable),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);
const KitTable = dynamic(
  () => import('@/components/kits/kit-table').then((m) => m.KitTable),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);
const KitBuilder = dynamic(
  () => import('@/components/kits/kit-builder').then((m) => m.KitBuilder),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);
const ManualQuoteBuilder = dynamic(
  () => import('@/components/quotes/manual-quote-builder').then((m) => m.ManualQuoteBuilder),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);
const ChangeHistoryPage = dynamic(
  () => import('@/components/inventory/change-history-page').then((m) => m.ChangeHistoryPage),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);
const SettingsDialog = dynamic(
  () => import('@/components/layout/settings-dialog').then((m) => m.SettingsDialog),
  { ssr: false }
);

interface DragGuideVisual {
  right: number;
  top: number;
  label: string;
  isCollapse: boolean;
}

function getCartSnapMetrics(rawWidth: number) {
  const minOpen = 320;
  const maxAllowed = Math.min(800, Math.max(minOpen, window.innerWidth - 160));
  const isCollapse = rawWidth < 200;
  const finalOpenWidth = Math.min(Math.max(Math.round(rawWidth), minOpen), maxAllowed);
  const guideRight = isCollapse ? Math.max(4, Math.round(rawWidth)) : finalOpenWidth;
  const label = isCollapse ? 'Soltar para ocultar' : `${finalOpenWidth} px`;
  return { isCollapse, finalOpenWidth, guideRight, label };
}

function applyCartGuideVisual(
  guideEl: HTMLDivElement | null,
  badgeEl: HTMLDivElement | null,
  visual: DragGuideVisual
) {
  if (guideEl) {
    guideEl.style.right = `${visual.right}px`;
    guideEl.style.backgroundColor = visual.isCollapse ? '#f59e0b' : '#10b981';
    guideEl.style.boxShadow = visual.isCollapse
      ? '0 0 8px rgba(245, 158, 11, 0.55)'
      : '0 0 8px rgba(16, 185, 129, 0.5)';
  }
  if (badgeEl) {
    badgeEl.style.right = `${visual.right + 10}px`;
    badgeEl.style.top = `${visual.top}px`;
    badgeEl.textContent = visual.label;
    badgeEl.style.backgroundColor = visual.isCollapse ? '#451a03' : '#0f172a';
    badgeEl.style.color = visual.isCollapse ? '#fde68a' : '#ffffff';
    badgeEl.style.borderColor = visual.isCollapse ? '#f59e0b' : 'rgba(16, 185, 129, 0.7)';
  }
}

export default function HomePage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [showRecentImports, setShowRecentImports] = useState(false);
  const [mobileSheetForceOpen, setMobileSheetForceOpen] = useState(false);
  const [cartWidth, setCartWidth] = useState(320);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const suppressExpandClickRef = useRef(false);
  const dragGuideRef = useRef<HTMLDivElement>(null);
  const dragBadgeRef = useRef<HTMLDivElement>(null);
  const dragInitialVisualRef = useRef<DragGuideVisual>({
    right: 320,
    top: 200,
    label: '320 px',
    isCollapse: false,
  });
  const cartItemsCount = useCartStore((s) => s.items.length);

  // Restore cart configuration from localStorage on mount
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('cotizador_cart_width');
      const savedCollapsed = localStorage.getItem('cotizador_cart_collapsed');
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 320 && parsed <= 800) {
          setCartWidth(parsed);
        }
      }
      if (savedCollapsed !== null) {
        setIsCartCollapsed(savedCollapsed === 'true');
      }
    } catch (e) {
      console.error('Error reading cart state from localStorage', e);
    }
  }, []);

  const toggleCartCollapse = (collapsed?: boolean) => {
    const nextState = collapsed !== undefined ? collapsed : !isCartCollapsed;
    setIsCartCollapsed(nextState);
    try {
      localStorage.setItem('cotizador_cart_collapsed', String(nextState));
    } catch {}
  };

  useLayoutEffect(() => {
    if (isDragging) {
      applyCartGuideVisual(dragGuideRef.current, dragBadgeRef.current, dragInitialVisualRef.current);
    }
  }, [isDragging]);

  const startCartResize = (e: React.MouseEvent, mode: 'resize' | 'expand') => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = mode === 'expand' ? 0 : cartWidth;
    let latestRawWidth = startWidth;
    let didDrag = false;

    const updateGuideDOM = (rawWidth: number, clientY: number) => {
      const { isCollapse, guideRight, label } = getCartSnapMetrics(rawWidth);
      const clampedTop = Math.min(Math.max(clientY - 14, 60), window.innerHeight - 60);
      const visual = { right: guideRight, top: clampedTop, label, isCollapse };

      dragInitialVisualRef.current = visual;
      applyCartGuideVisual(dragGuideRef.current, dragBadgeRef.current, visual);
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      latestRawWidth = startWidth + deltaX;

      if (!didDrag && Math.abs(deltaX) > 4) {
        didDrag = true;
        updateGuideDOM(latestRawWidth, moveEvent.clientY);
        setIsDragging(true);
      } else if (didDrag) {
        updateGuideDOM(latestRawWidth, moveEvent.clientY);
      }
    };

    const finishDrag = (commitChange: boolean) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onWindowBlur);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
      setIsDragging(false);

      if (!didDrag || !commitChange) return;

      if (mode === 'expand') {
        suppressExpandClickRef.current = true;
        setTimeout(() => {
          suppressExpandClickRef.current = false;
        }, 100);
      }

      const { isCollapse, finalOpenWidth } = getCartSnapMetrics(latestRawWidth);
      if (isCollapse) {
        setIsCartCollapsed(true);
        const restoredWidth = Math.min(Math.max(startWidth || cartWidth, 320), 800);
        setCartWidth(restoredWidth);
        try {
          localStorage.setItem('cotizador_cart_collapsed', 'true');
        } catch {}
      } else {
        setCartWidth(finalOpenWidth);
        setIsCartCollapsed(false);
        try {
          localStorage.setItem('cotizador_cart_width', String(finalOpenWidth));
          localStorage.setItem('cotizador_cart_collapsed', 'false');
        } catch {}
      }
    };

    const onMouseUp = () => finishDrag(true);
    const onWindowBlur = () => finishDrag(false);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onWindowBlur);
  };

  // Listen for navigate-tab events from notification panel
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab) {
        setActiveTab(tab);
        setSelectedKit(null);
      }
    };
    window.addEventListener('navigate-tab', handler);
    return () => window.removeEventListener('navigate-tab', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <Sidebar 
        activeItem={activeTab}
        onNavigate={(id) => {
          if (id === 'settings') {
            setIsSettingsOpen(true);
          } else {
            setActiveTab(id);
            setSelectedKit(null); // Reset when navigating
          }
        }} 
      />

      {/* Main Area */}
      <div className="flex flex-1 md:ml-[96px] min-w-0 overflow-hidden">
        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-3 md:p-5 bg-slate-50 min-w-0 pb-[80px] lg:pb-5">
            {activeTab === 'inventory' && <ProductTable key={showRecentImports ? 'recents' : 'normal'} showRecentsOnMount={showRecentImports} />}
            {activeTab === 'miscellaneous' && <ProductTable key="miscellaneous" isMiscellaneous={true} />}
            {activeTab === 'min_stock_alert' && <ProductTable key="min_stock_alert" isMinStockAlert={true} />}
            {activeTab === 'categories' && <ClasificacionesContainer />}
            {activeTab === 'quotes' && <QuoteTable />}
            {activeTab === 'manual_quote' && <ManualQuoteBuilder />}
            {activeTab === 'motor_kits' && (
              selectedKit ? (
                <KitBuilder kit={selectedKit} onBack={() => setSelectedKit(null)} />
              ) : (
                <KitTable category="Motor" onSelectKit={setSelectedKit} />
              )
            )}
            {activeTab === 'clutch_kits' && (
              selectedKit ? (
                <KitBuilder kit={selectedKit} onBack={() => setSelectedKit(null)} />
              ) : (
                <KitTable category="Clutch" onSelectKit={setSelectedKit} />
              )
            )}
            {activeTab === 'tren_delantero_kits' && (
              selectedKit ? (
                <KitBuilder kit={selectedKit} onBack={() => setSelectedKit(null)} />
              ) : (
                <KitTable category="Tren Delantero" onSelectKit={setSelectedKit} />
              )
            )}
            {activeTab === 'history' && <ChangeHistoryPage />}
          </main>
        </div>

        {/* Quote Cart - Fixed Right Panel (Desktop only) */}
        <div 
          className={cn(
            "hidden lg:block shrink-0 bg-white z-10 overflow-hidden relative transition-[width] duration-300 ease-in-out",
            isCartCollapsed ? "border-l-0" : "border-l border-slate-200",
            isDragging && "select-none"
          )}
          style={{ 
            width: isCartCollapsed ? '0px' : `${cartWidth}px`, 
            minWidth: isCartCollapsed ? '0px' : undefined, 
            maxWidth: '800px' 
          }}
        >
          {/* Drag Handle */}
          {!isCartCollapsed && (
            <div 
              className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-500 transition-colors z-20 group"
              onMouseDown={(e) => startCartResize(e, 'resize')}
              onDoubleClick={() => toggleCartCollapse(true)}
              title="Arrastra para redimensionar u ocultar (Doble clic para ocultar)"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-slate-300 group-hover:bg-emerald-600 transition-colors" />
            </div>
          )}

          {/* Inner fixed-width container to prevent layout reflow during slide */}
          <div 
            className="h-full"
            style={{ width: `${Math.max(cartWidth, 320)}px` }}
          >
            <QuoteCart onCollapse={() => toggleCartCollapse(true)} />
          </div>
        </div>
      </div>

      {/* Desktop Floating Cart Tab & Drag Strip (when collapsed) */}
      {isCartCollapsed && (
        <>
          {/* Right Edge Drag Strip (Option B) */}
          <div
            className="hidden lg:block fixed right-0 top-0 bottom-0 w-2.5 hover:w-3.5 z-40 cursor-col-resize hover:bg-emerald-500/30 active:bg-emerald-500 transition-all group"
            title="Arrastra hacia la izquierda para abrir el carrito (o haz clic)"
            onMouseDown={(e) => startCartResize(e, 'expand')}
            onClick={() => {
              if (suppressExpandClickRef.current) {
                suppressExpandClickRef.current = false;
                return;
              }
              toggleCartCollapse(false);
            }}
          >
            <div className="absolute top-1/2 right-0.5 -translate-y-1/2 w-1 h-12 bg-slate-300/80 rounded-full group-hover:bg-emerald-500 transition-colors" />
          </div>

          {/* Floating Tab Button (Option A) */}
          <button
            onClick={() => toggleCartCollapse(false)}
            className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 items-center gap-2 pl-3.5 pr-2.5 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-l-xl shadow-2xl border-y border-l border-slate-700/80 cursor-pointer group transition-all duration-200 animate-in fade-in slide-in-from-right-4"
            title="Abrir cotización (o arrastra el borde hacia la izquierda)"
          >
            <ChevronLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
            <div className="relative flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-slate-200" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-white font-mono tabular-nums font-bold text-[10px] min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow">
                  {cartItemsCount}
                </span>
              )}
            </div>
            <span className="text-[12px] font-semibold tracking-wide text-slate-200 select-none pr-1">
              Cotización
            </span>
          </button>
        </>
      )}

      {/* Mobile Bottom Sheet Quote Cart */}
      <MobileQuoteSheet 
        forceOpen={mobileSheetForceOpen} 
        onForceOpenHandled={() => setMobileSheetForceOpen(false)} 
      />

      {/* Mobile Bottom Tab Bar Navigation */}
      <MobileNav
        activeTab={activeTab}
        onNavigate={(id) => {
          if (id === 'settings') {
            setIsSettingsOpen(true);
          } else {
            setActiveTab(id);
            setSelectedKit(null);
          }
        }}
        onCartPress={() => setMobileSheetForceOpen(true)}
        cartItemsCount={cartItemsCount}
      />

      {isSettingsOpen && (
        <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} onImportComplete={() => {
          setActiveTab('inventory');
          setShowRecentImports(true);
          setTimeout(() => setShowRecentImports(false), 500);
        }} />
      )}
      <AiQueueBanner />

      {/* Deferred Resize Drag Guide Overlay (updates cart width only on mouseup) */}
      {isDragging && (
        <div className="hidden lg:block fixed inset-0 z-50 cursor-col-resize select-none">
          <div ref={dragGuideRef} className="fixed top-0 bottom-0 w-[2px] pointer-events-none" />
          <div
            ref={dragBadgeRef}
            className="fixed pointer-events-none px-2 py-1 rounded-sm border font-mono tabular-nums text-[11px] font-bold shadow-md whitespace-nowrap"
          />
        </div>
      )}
    </div>
  );
}
