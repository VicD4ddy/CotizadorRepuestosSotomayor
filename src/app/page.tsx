'use client';

import { useState, useEffect } from 'react';
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
import { ChangeHistoryPage } from '@/components/inventory/change-history-page';
import { AiQueueBanner } from '@/components/inventory/ai-queue-banner';
import { Kit } from '@/types';

export default function HomePage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [showRecentImports, setShowRecentImports] = useState(false);

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
      <div className="flex flex-1 ml-[96px]">
        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 overflow-auto p-5 bg-slate-50">
            {activeTab === 'inventory' && <ProductTable key={showRecentImports ? 'recents' : 'normal'} showRecentsOnMount={showRecentImports} />}
            {activeTab === 'categories' && <ClasificacionesContainer />}
            {activeTab === 'quotes' && <QuoteTable />}
            {activeTab === 'sales' && <SalesDashboard />}
            {activeTab === 'motor_kits' && (
              selectedKit ? (
                <KitBuilder kit={selectedKit} onBack={() => setSelectedKit(null)} />
              ) : (
                <KitTable category="Motor" onSelectKit={setSelectedKit} />
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

        {/* Quote Cart - Fixed Right Panel */}
        <div className="w-[340px] min-w-[340px] border-l border-slate-200 bg-white">
          <QuoteCart />
        </div>
      </div>
      
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} onImportComplete={() => {
        setActiveTab('inventory');
        setShowRecentImports(true);
        setTimeout(() => setShowRecentImports(false), 500);
      }} />
      <AiQueueBanner />
    </div>
  );
}
