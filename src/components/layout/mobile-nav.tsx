'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Package, Wrench, FileText, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onCartPress: () => void;
  cartItemsCount: number;
}

const KITS_TAB_IDS = ['motor_kits', 'clutch_kits', 'tren_delantero_kits'] as const;

const kitsSubMenu = [
  { label: 'Motor', id: 'motor_kits' },
  { label: 'Clutch', id: 'clutch_kits' },
  { label: 'T. Delantero', id: 'tren_delantero_kits' },
] as const;

export function MobileNav({
  activeTab,
  onNavigate,
  onCartPress,
  cartItemsCount,
}: MobileNavProps) {
  const [kitsOpen, setKitsOpen] = useState(false);
  const kitsRef = useRef<HTMLDivElement>(null);

  const isKitsActive = KITS_TAB_IDS.includes(activeTab as (typeof KITS_TAB_IDS)[number]);

  // Close popover on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (kitsRef.current && !kitsRef.current.contains(e.target as Node)) {
      setKitsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (kitsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [kitsOpen, handleOutsideClick]);

  const handleKitsToggle = () => {
    setKitsOpen((prev) => !prev);
  };

  const handleKitsSelect = (id: string) => {
    setKitsOpen(false);
    onNavigate(id);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-[#0f172a] border-t border-slate-700/50'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-[68px] px-2">
        {/* Catálogo */}
        <TabButton
          icon={<Package size={22} strokeWidth={1.8} />}
          label="Catálogo"
          isActive={activeTab === 'inventory'}
          onPress={() => onNavigate('inventory')}
        />

        {/* Kits — with popover */}
        <div ref={kitsRef} className="relative flex items-center justify-center">
          {/* Sub-menu popover */}
          {kitsOpen && (
            <div
              className={cn(
                'absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2',
                'bg-[#1e293b] rounded-md shadow-2xl border border-slate-700',
                'min-w-[140px] py-1',
                'animate-in fade-in slide-in-from-bottom-2 duration-200'
              )}
            >
              {kitsSubMenu.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleKitsSelect(item.id)}
                  className={cn(
                    'w-full text-left px-3.5 py-2 text-[13px] font-medium',
                    'transition-colors duration-150',
                    activeTab === item.id
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50',
                    'active:scale-95'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <TabButton
            icon={<Wrench size={22} strokeWidth={1.8} />}
            label="Kits"
            isActive={isKitsActive}
            onPress={handleKitsToggle}
          />
        </div>

        {/* Cotizaciones */}
        <TabButton
          icon={<FileText size={22} strokeWidth={1.8} />}
          label="Cotizaciones"
          isActive={activeTab === 'quotes'}
          onPress={() => onNavigate('quotes')}
        />

        {/* Cotización (Cart) */}
        <TabButton
          icon={
            <span className="relative">
              <ShoppingCart size={22} strokeWidth={1.8} />
              {cartItemsCount > 0 && (
                <span
                  className={cn(
                    'absolute -top-1.5 -right-1.5',
                    'bg-emerald-500 text-white',
                    'font-mono tabular-nums font-bold text-[9px]',
                    'min-w-[16px] h-[16px] rounded-full',
                    'flex items-center justify-center px-0.5',
                    'shadow-sm'
                  )}
                >
                  {cartItemsCount > 99 ? '99+' : cartItemsCount}
                </span>
              )}
            </span>
          }
          label="Cotización"
          isActive={false}
          onPress={onCartPress}
        />
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal tab button                                                */
/* ------------------------------------------------------------------ */

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ icon, label, isActive, onPress }: TabButtonProps) {
  return (
    <button
      onClick={onPress}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5',
        'min-w-[60px] py-1.5 rounded-md',
        'transition-colors duration-200 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]',
        isActive ? 'text-emerald-400' : 'text-slate-500'
      )}
    >
      {icon}
      {/* Active indicator dot */}
      {isActive && (
        <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
      )}
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </button>
  );
}
