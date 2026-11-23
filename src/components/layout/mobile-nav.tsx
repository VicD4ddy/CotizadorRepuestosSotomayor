'use client';

import { Settings, Wrench, FileText, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onCartPress: () => void;
  cartItemsCount: number;
}

export function MobileNav({
  activeTab,
  onNavigate,
  onCartPress,
  cartItemsCount,
}: MobileNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[35] lg:hidden',
        'bg-[#0f172a] border-t border-slate-700/50'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-[68px] px-2">
        {/* Motor */}
        <TabButton
          icon={<Settings size={22} strokeWidth={1.8} />}
          label="Motor"
          isActive={activeTab === 'motor_kits'}
          onPress={() => onNavigate('motor_kits')}
        />

        {/* Tren Delantero */}
        <TabButton
          icon={<Wrench size={22} strokeWidth={1.8} />}
          label="T. Delantero"
          isActive={activeTab === 'tren_delantero_kits'}
          onPress={() => onNavigate('tren_delantero_kits')}
        />

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
      type="button"
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
