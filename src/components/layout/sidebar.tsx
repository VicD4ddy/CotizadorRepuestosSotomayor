'use client';

import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  FilePlus2,
  ShoppingCart,
  Settings,
  Cog,
  Wrench,
  History,
  Droplets,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { useProducts, useDefaultMinStock } from '@/hooks/use-supabase';

const navItems = [
  { icon: LayoutDashboard, label: 'Inventario', id: 'inventory' },
  { icon: FolderOpen, label: 'Clasificaciones', id: 'categories' },
  { icon: FileText, label: 'Cotizaciones', id: 'quotes' },
  { icon: FilePlus2, label: 'Cotiz. Manual', id: 'manual_quote' },
  { icon: ShoppingCart, label: 'Ventas', id: 'sales' },
  { icon: Cog, label: 'Motor', id: 'motor_kits' },
  { icon: Wrench, label: 'T. Delantero', id: 'tren_delantero_kits' },
  { icon: Droplets, label: 'Misceláneos', id: 'miscellaneous' },
  { icon: AlertTriangle, label: 'Alerta Stock', id: 'min_stock_alert' },
  { icon: History, label: 'Historial', id: 'history' },
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
        <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-[#0f172a] font-bold text-[13px] shadow-sm mb-1">
          S
        </div>
        <span className="text-[9px] font-bold text-white tracking-wide">
          Sotomayor
        </span>
        <span className="text-[7px] text-slate-400">
          Admin Panel
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col items-center gap-1.5 flex-1 w-full px-2 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={cn(
                'group flex flex-col items-center justify-center w-full h-[50px] rounded-lg transition-all duration-200 relative shrink-0',
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
              <item.icon className={cn('w-[17px] h-[17px] mb-0.5')} />
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
            'flex flex-col items-center justify-center w-full h-[54px] rounded-lg transition-all duration-200',
            activeItem === 'settings'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          )}
        >
          <Settings className="w-[18px] h-[18px] mb-1" />
          <span className="text-[8px] font-medium tracking-wide">
            Configuración
          </span>
        </button>
      </div>
    </aside>
  );
}
