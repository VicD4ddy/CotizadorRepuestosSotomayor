'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, ImageOff, FileText, DollarSign, Tag, AlertTriangle, X, ChevronRight, ArrowLeft, Unlink, Sparkles } from 'lucide-react';
import { useProducts, useKits } from '@/hooks/use-supabase';
import { Product, Kit } from '@/types';

interface NotificationItem {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  severity: 'critical' | 'warning' | 'info';
  products: Product[];
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<NotificationItem | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: products = [] } = useProducts();
  const { data: kits = [] } = useKits();

  // Find products that have suggested kits that have not been selected
  const suggestedNotSelected = useMemo(() => {
    if (products.length === 0 || kits.length === 0) return [];

    return products.filter((p) => {
      if (!p.name || p.name.trim().length < 3) return false;
      const prodLower = p.name.toLowerCase();
      
      // Get the set of currently selected kit IDs for this product
      const selectedKitIds = new Set(p.kit_items?.map((item) => item.kit_id) || []);

      // Check if there is any kit that is suggested but NOT in selectedKitIds
      return kits.some((kit: Kit) => {
        // If already selected, skip
        if (selectedKitIds.has(kit.id)) return false;

        const kitLower = kit.name.toLowerCase();
        
        // 1. Direct inclusion
        if (prodLower.includes(kitLower)) {
          return true;
        }

        // 2. Splitting and matching brand + key number/model
        const words = kitLower.replace(/[()]/g, ' ').split(/[\s/-]+/).filter(Boolean);
        if (words.length === 0) return false;

        const brand = words[0];
        let brandMatches = prodLower.includes(brand);
        if (brand === 'chevrolet' && !brandMatches) {
          brandMatches = prodLower.includes('chevy');
        }

        const hasSpecificModel = words.some((w: string) => ['spark', 'aveo', 'optra', 'dmax'].includes(w));
        const modelMatches = hasSpecificModel && words.some((w: string) => ['spark', 'aveo', 'optra', 'dmax'].includes(w) && prodLower.includes(w));

        if (!brandMatches && !modelMatches) return false;

        const identifiers = words.slice(1).filter((w: string) => {
          if (/\d/.test(w)) return true;
          if (['spark', 'aveo', 'optra', 'dmax', 'explorer', 'bronco', 'f150', 'blazer', 'grand cherokee'].includes(w)) return true;
          return false;
        });

        if (identifiers.length === 0) return false;

        const hasIdMatch = identifiers.some((id: string) => {
          const cleanId = id.replace(/l$/, '');
          return prodLower.includes(id) || prodLower.includes(cleanId);
        });

        return hasIdMatch;
      });
    });
  }, [products, kits]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedAlert(null);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Analyze products for issues
  const noImage = products.filter(p => !p.image_url && (!p.image_urls || p.image_urls.length === 0));
  const noDescription = products.filter(p => !p.description || p.description.trim().length < 5);
  const zeroCost = products.filter(p => !p.cost || p.cost === 0);
  const zeroPrice = products.filter(p => !p.price_usd || p.price_usd === 0);
  const noCategory = products.filter(p => !p.category_id);
  const noKit = products.filter(p => !p.kit_items || p.kit_items.length === 0);
  const costEqualsPrice = products.filter(p => p.cost > 0 && p.price_usd > 0 && p.cost === p.price_usd);
  const costGreaterThanPrice = products.filter(p => p.cost > 0 && p.price_usd > 0 && p.cost > p.price_usd);

  const notifications: NotificationItem[] = [];

  if (zeroCost.length > 0) {
    notifications.push({
      icon: <DollarSign className="w-4 h-4" />,
      label: 'Costo en $0',
      count: zeroCost.length,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      severity: 'critical',
      products: zeroCost,
    });
  }

  if (zeroPrice.length > 0) {
    notifications.push({
      icon: <DollarSign className="w-4 h-4" />,
      label: 'Precio de venta en $0',
      count: zeroPrice.length,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      severity: 'critical',
      products: zeroPrice,
    });
  }

  if (costGreaterThanPrice.length > 0) {
    notifications.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      label: 'Margen negativo (Costo > Precio)',
      count: costGreaterThanPrice.length,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      severity: 'critical',
      products: costGreaterThanPrice,
    });
  }

  if (costEqualsPrice.length > 0) {
    notifications.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      label: 'Costo igual al precio (Sin margen)',
      count: costEqualsPrice.length,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      severity: 'warning',
      products: costEqualsPrice,
    });
  }

  if (noImage.length > 0) {
    notifications.push({
      icon: <ImageOff className="w-4 h-4" />,
      label: 'Productos sin imagen',
      count: noImage.length,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      severity: 'warning',
      products: noImage,
    });
  }

  if (noDescription.length > 0) {
    notifications.push({
      icon: <FileText className="w-4 h-4" />,
      label: 'Sin descripción',
      count: noDescription.length,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      severity: 'info',
      products: noDescription,
    });
  }

  if (noCategory.length > 0) {
    notifications.push({
      icon: <Tag className="w-4 h-4" />,
      label: 'Sin categoría asignada',
      count: noCategory.length,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      severity: 'info',
      products: noCategory,
    });
  }

  if (noKit.length > 0) {
    notifications.push({
      icon: <Unlink className="w-4 h-4" />,
      label: 'Sin motor/tren asignado',
      count: noKit.length,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      severity: 'info',
      products: noKit,
    });
  }

  if (suggestedNotSelected.length > 0) {
    notifications.push({
      icon: <Sparkles className="w-4 h-4" />,
      label: 'Sugeridos sin seleccionar',
      count: suggestedNotSelected.length,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      severity: 'info',
      products: suggestedNotSelected,
    });
  }

  const totalAlerts = notifications.reduce((sum, n) => sum + n.count, 0);
  const criticalCount = notifications.filter(n => n.severity === 'critical').reduce((sum, n) => sum + n.count, 0);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setExpandedAlert(null);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
      >
        <Bell className="w-[15px] h-[15px]" />
        {totalAlerts > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1 ${
            criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          }`}>
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-[42px] w-[380px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

          {/* === DETAIL VIEW: product list for selected alert === */}
          {expandedAlert ? (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                <button
                  onClick={() => setExpandedAlert(null)}
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-500"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className={`w-6 h-6 rounded flex items-center justify-center ${expandedAlert.bgColor} ${expandedAlert.color}`}>
                  {expandedAlert.icon}
                </div>
                <span className="text-[13px] font-bold text-slate-800">{expandedAlert.label}</span>
                <span className={`ml-auto text-[11px] font-bold ${expandedAlert.color}`}>{expandedAlert.count}</span>
              </div>

              <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                {expandedAlert.products.slice(0, 50).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      // Navigate to inventory tab first, then open product
                      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'inventory' } }));
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('open-product', { detail: { productId: p.id } }));
                      }, 100);
                      setIsOpen(false);
                      setExpandedAlert(null);
                    }}
                    className="w-full px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left group"
                  >
                    <p className="text-[12px] font-semibold text-slate-800 truncate group-hover:text-emerald-700">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded">{p.code}</span>
                      {p.cost !== undefined && p.cost > 0 && (
                        <span className="text-[10px] text-slate-400">Costo: ${p.cost.toFixed(2)}</span>
                      )}
                      {p.price_usd !== undefined && p.price_usd > 0 && (
                        <span className="text-[10px] text-slate-400">| Venta: ${p.price_usd.toFixed(2)}</span>
                      )}
                    </div>
                  </button>
                ))}
                {expandedAlert.products.length > 50 && (
                  <div className="px-4 py-3 text-center text-[11px] text-slate-400 italic">
                    ...y {expandedAlert.products.length - 50} productos más
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* === MAIN VIEW: alert list === */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-[13px] font-bold text-slate-800">Alertas del Inventario</span>
                </div>
                <button onClick={() => { setIsOpen(false); setExpandedAlert(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Bell className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-[13px] font-medium text-slate-700">¡Todo en orden!</p>
                  <p className="text-[11px] text-slate-400">No hay alertas pendientes.</p>
                </div>
              ) : (
                <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100">
                  {notifications.map((notif, i) => (
                    <button
                      key={i}
                      onClick={() => setExpandedAlert(notif)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${notif.bgColor} ${notif.color} shrink-0`}>
                        {notif.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800">{notif.label}</p>
                        <p className="text-[10px] text-slate-400">
                          {notif.count} producto{notif.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[13px] font-bold ${notif.color}`}>{notif.count}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                  <p className="text-[10px] text-slate-400 text-center">
                    {totalAlerts.toLocaleString()} alerta{totalAlerts !== 1 ? 's' : ''} en {products.length.toLocaleString()} productos
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
