'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useProducts, useDefaultMinStock } from '@/hooks/use-supabase';
import UseAnimations from 'react-useanimations';
import grid from 'react-useanimations/lib/grid';
import folder from 'react-useanimations/lib/folder';
import fileText from 'react-useanimations/lib/fileText';
import filePlus from 'react-useanimations/lib/filePlus';
import shoppingCart from 'react-useanimations/lib/shoppingCart';
import settings from 'react-useanimations/lib/settings';
import disc from 'react-useanimations/lib/disc';
import tool from 'react-useanimations/lib/tool';
import droplet from 'react-useanimations/lib/droplet';
import alertTriangle from 'react-useanimations/lib/alertTriangle';
import rotateCcw from 'react-useanimations/lib/rotateCcw';
import settings2 from 'react-useanimations/lib/settings2';

const navItems = [
  { animation: grid, label: 'Inventario', id: 'inventory' },
  { animation: folder, label: 'Clasificaciones', id: 'categories' },
  { animation: fileText, label: 'Cotizaciones', id: 'quotes' },
  { animation: filePlus, label: 'Cotiz. Manual', id: 'manual_quote' },
  { animation: shoppingCart, label: 'Ventas', id: 'sales' },
  { animation: settings, label: 'Motor', id: 'motor_kits' },
  { animation: disc, label: 'Clutch', id: 'clutch_kits' },
  { animation: tool, label: 'T. Delantero', id: 'tren_delantero_kits' },
  { animation: droplet, label: 'Misceláneos', id: 'miscellaneous' },
  { animation: alertTriangle, label: 'Alerta Stock', id: 'min_stock_alert' },
  { animation: rotateCcw, label: 'Historial', id: 'history' },
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
            <UseAnimations
              key={item.id}
              animation={item.animation}
              size={20}
              strokeColor="currentColor"
              interaction="hover-replay"
              render={(eventProps, animationProps) => (
                <button
                  {...eventProps}
                  onClick={(e) => {
                    eventProps.onClick(e);
                    handleClick(item.id);
                  }}
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
                  <span {...animationProps} className="mb-0.5 flex items-center justify-center" />
                  <span className="text-[8px] font-medium tracking-wide">
                    {item.label}
                  </span>
                </button>
              )}
            />
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="w-full px-2 mb-2">
        <UseAnimations
          animation={settings2}
          size={22}
          strokeColor="currentColor"
          interaction="hover-replay"
          render={(eventProps, animationProps) => (
            <button
              {...eventProps}
              onClick={(e) => {
                eventProps.onClick(e);
                handleClick('settings');
              }}
              className={cn(
                'group flex flex-col items-center justify-center w-full h-[54px] rounded-lg transition-all duration-200 cursor-pointer',
                activeItem === 'settings'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              <span {...animationProps} className="mb-0.5 flex items-center justify-center" />
              <span className="text-[8px] font-medium tracking-wide">
                Configuración
              </span>
            </button>
          )}
        />
      </div>
    </aside>
  );
}
