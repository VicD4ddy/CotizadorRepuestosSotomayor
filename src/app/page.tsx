'use client';

import { useState, useEffect } from 'react';
import { useCartStore } from '@/store/cart-store';
import { ShoppingCart, X, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ProductTable } from '@/components/inventory/product-table';
import { ClasificacionesContainer } from '@/components/categories/clasificaciones-container';
import { QuoteTable } from '@/components/quotes/quote-table';
import { SalesDashboard } from '@/components/sales/sales-dashboard';
import { QuoteCart } from '@/components/quotes/quote-cart';
import { SettingsDialog } from '@/components/layout/settings-dialog';
import { KitTable } from '@/components/kits/kit-table';
import { KitBuilder } from '@/components/kits/kit-builder';
import { ManualQuoteBuilder } from '@/components/quotes/manual-quote-builder';
import { ChangeHistoryPage } from '@/components/inventory/change-history-page';
import { AiQueueBanner } from '@/components/inventory/ai-queue-banner';
import { Kit } from '@/types';

export default function HomePage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [showRecentImports, setShowRecentImports] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [cartWidth, setCartWidth] = useState(320);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleCartDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.pageX;
    const startWidth = cartWidth;
    let currentWidth = startWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = startX - moveEvent.pageX;
      const rawWidth = startWidth + diff;
      currentWidth = rawWidth;

      // Under collapse threshold (200px), allow dragging towards 0 to give visual feedback
      if (rawWidth < 200) {
        setCartWidth(Math.max(0, rawWidth));
      } else {
        setCartWidth(Math.min(Math.max(rawWidth, 320), 800));
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
      setIsDragging(false);

      if (currentWidth < 200) {
        // Snap to collapse
        setIsCartCollapsed(true);
        const validWidth = Math.min(Math.max(startWidth, 320), 800);
        setCartWidth(validWidth);
        try {
          localStorage.setItem('cotizador_cart_collapsed', 'true');
        } catch {}
      } else {
        // Snap to valid range
        const finalWidth = Math.min(Math.max(currentWidth, 320), 800);
        setCartWidth(finalWidth);
        setIsCartCollapsed(false);
        try {
          localStorage.setItem('cotizador_cart_width', String(finalWidth));
          localStorage.setItem('cotizador_cart_collapsed', 'false');
        } catch {}
      }
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleExpandDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = window.innerWidth;
    let targetWidth = 0;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = startX - moveEvent.pageX;
      targetWidth = diff;
      if (diff > 30) {
        setIsCartCollapsed(false);
        setCartWidth(Math.min(Math.max(diff, 50), 800));
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
      setIsDragging(false);

      if (targetWidth >= 200) {
        const finalWidth = Math.min(Math.max(targetWidth, 320), 800);
        setCartWidth(finalWidth);
        setIsCartCollapsed(false);
        try {
          localStorage.setItem('cotizador_cart_width', String(finalWidth));
          localStorage.setItem('cotizador_cart_collapsed', 'false');
        } catch {}
      } else {
        setIsCartCollapsed(true);
        const restoredWidth = cartWidth >= 320 ? cartWidth : 320;
        setCartWidth(restoredWidth);
        try {
          localStorage.setItem('cotizador_cart_collapsed', 'true');
        } catch {}
      }
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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
          <main className="flex-1 overflow-auto p-3 md:p-5 bg-slate-50 min-w-0">
            {activeTab === 'inventory' && <ProductTable key={showRecentImports ? 'recents' : 'normal'} showRecentsOnMount={showRecentImports} />}
            {activeTab === 'miscellaneous' && <ProductTable key="miscellaneous" isMiscellaneous={true} />}
            {activeTab === 'min_stock_alert' && <ProductTable key="min_stock_alert" isMinStockAlert={true} />}
            {activeTab === 'categories' && <ClasificacionesContainer />}
            {activeTab === 'quotes' && <QuoteTable />}
            {activeTab === 'manual_quote' && <ManualQuoteBuilder />}
            {activeTab === 'sales' && <SalesDashboard />}
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
            "hidden lg:block shrink-0 bg-white z-10 overflow-hidden relative",
            isCartCollapsed ? "border-l-0" : "border-l border-slate-200",
            isDragging ? "transition-none select-none" : "transition-[width] duration-300 ease-in-out"
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
              onMouseDown={handleCartDragStart}
              onDoubleClick={() => toggleCartCollapse(true)}
              title="Arrastra para redimensionar u ocultar (Doble clic para ocultar)"
            >
              <div 
                className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors",
                  cartWidth < 200 ? "bg-amber-500 shadow-sm" : "bg-slate-300 group-hover:bg-emerald-600"
                )} 
              />
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
            onMouseDown={handleExpandDragStart}
            onClick={() => toggleCartCollapse(false)}
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

      {/* Mobile / Tablet Floating Cart Button */}
      <div className="lg:hidden fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-[#0f172a] text-white rounded-full shadow-lg hover:bg-[#1e293b] transition-all active:scale-95 border border-slate-700"
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                {cartItemsCount}
              </span>
            )}
          </div>
          <span className="text-[13px] font-bold">Cotización</span>
        </button>
      </div>

      {/* Mobile / Tablet Cart Slide-over */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/50 animate-in fade-in">
          <div className="w-full max-w-[340px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right relative">
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1 overflow-hidden">
              <QuoteCart />
            </div>
          </div>
        </div>
      )}

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} onImportComplete={() => {
        setActiveTab('inventory');
        setShowRecentImports(true);
        setTimeout(() => setShowRecentImports(false), 500);
      }} />
      <AiQueueBanner />
    </div>
  );
}
