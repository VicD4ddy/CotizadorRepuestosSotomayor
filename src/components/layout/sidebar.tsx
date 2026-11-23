'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useProducts, useDefaultMinStock } from '@/hooks/use-supabase';
import {
  LayoutGrid,
  Folder,
  FileText,
  FilePlus,
  Settings,
  Disc3,
  Wrench,
  Droplet,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

const navItems = [
  { Icon: LayoutGrid, label: 'Inventario', id: 'inventory' },
  { Icon: Folder, label: 'Clasificaciones', id: 'categories' },
  { Icon: FileText, label: 'Cotizaciones', id: 'quotes' },
  { Icon: FilePlus, label: 'Cotiz. Manual', id: 'manual_quote' },
  { Icon: Settings, label: 'Motor', id: 'motor_kits' },
  { Icon: Disc3, label: 'Clutch', id: 'clutch_kits' },
  { Icon: Wrench, label: 'T. Delantero', id: 'tren_delantero_kits' },
  { Icon: Droplet, label: 'Misceláneos', id: 'miscellaneous' },
  { Icon: AlertTriangle, label: 'Alerta Stock', id: 'min_stock_alert' },
  { Icon: RotateCcw, label: 'Historial', id: 'history' },
];

interface SidebarProps {
  activeItem?: string;
  onNavigate?: (id: string) => void;
}

export function Sidebar({ activeItem: controlledActive, onNavigate }: SidebarProps) {
  const [internalActive, setInternalActive] = useState('inventory');
  const activeItem = controlledActive ?? internalActive;
  const { data: products = [] } = useProducts();
  const { data: defaultMinStock = 0 } = useDefaultMinStock();

  const lowStockCount = products.filter((p) => {
    if (!p.price_usd || p.price_usd <= 0) return false;
    const min = (p.min_stock !== undefined && p.min_stock !== null && p.min_stock > 0)
      ? p.min_stock
      : (defaultMinStock || 0);
    return min > 0 && (p.stock ?? 0) <= min;
  }).length;

  const handleClick = (id: string) => {
    setInternalActive(id);
    onNavigate?.(id);
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-[96px] flex-col items-center bg-[#0f172a] py-3">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center mb-3">
        <img
          src="/logo-sotomayor-icon.png"
          alt="Repuestos Sotomayor"
          className="w-14 h-14 object-contain drop-shadow-sm mb-1 select-none"
        />
        <span className="text-[10px] font-bold text-white tracking-wide leading-tight">
          Cotizador
        </span>
        <span className="text-[7.5px] font-medium text-slate-400 tracking-wide">
          Admin Panel
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col items-center gap-1.5 flex-1 w-full px-2 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={cn(
                'group flex flex-col items-center justify-center w-full h-[50px] rounded-lg transition-all duration-200 relative shrink-0 cursor-pointer',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-emerald-400 rounded-r-full" />
              )}
              {item.id === 'min_stock_alert' && lowStockCount > 0 && (
                <span className="absolute top-1 right-2 min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-sm">
                  {lowStockCount > 99 ? '99+' : lowStockCount}
                </span>
              )}
              <Icon className="w-[18px] h-[18px] mb-1 transition-transform duration-150 group-hover:scale-110" />
              <span className="text-[8px] font-medium tracking-wide">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="w-full px-2 mb-2">
        <button
          onClick={() => handleClick('settings')}
          className={cn(
            'group flex flex-col items-center justify-center w-full h-[54px] rounded-lg transition-all duration-200 cursor-pointer',
            activeItem === 'settings'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          )}
        >
          <SlidersHorizontal className="w-5 h-5 mb-1 transition-transform duration-150 group-hover:scale-110" />
          <span className="text-[8px] font-medium tracking-wide">
            Configuración
          </span>
        </button>
      </div>
    </aside>
  );
}
