'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Product } from '@/types';
import { usePriceHistory } from '@/hooks/use-supabase';
import { formatUSD } from '@/lib/utils';
import { History, TrendingUp, TrendingDown, Minus, DollarSign, Type, FileText } from 'lucide-react';

interface ProductHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

type TabKey = 'prices' | 'names' | 'descriptions';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'prices', label: 'Precios', icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: 'names', label: 'Nombres', icon: <Type className="w-3.5 h-3.5" /> },
  { key: 'descriptions', label: 'Descripciones', icon: <FileText className="w-3.5 h-3.5" /> },
];

export function ProductHistoryDialog({ open, onOpenChange, product }: ProductHistoryDialogProps) {
  const { data: history = [], isLoading } = usePriceHistory(product?.id || '');
  const [activeTab, setActiveTab] = useState<TabKey>('prices');

  if (!product) return null;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  // Filter records per tab
  const priceRecords = history.filter(
    (r) => r.old_cost !== r.new_cost || r.old_price_usd !== r.new_price_usd
  );
  const nameRecords = history.filter(
    (r) => r.old_name && r.new_name && r.old_name !== r.new_name
  );
  const descRecords = history.filter(
    (r) => r.old_description !== undefined && r.new_description !== undefined && r.old_description !== r.new_description
  );

  const activeRecords = activeTab === 'prices' ? priceRecords : activeTab === 'names' ? nameRecords : descRecords;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
            <History className="w-5 h-5 text-slate-400" />
            Historial de Cambios
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {product.name} <span className="font-mono text-xs bg-slate-100 px-1 rounded ml-1">{product.code}</span>
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {TABS.map((tab) => {
              const count = tab.key === 'prices' ? priceRecords.length : tab.key === 'names' ? nameRecords.length : descRecords.length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-semibold transition-all ${
                    activeTab === tab.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 pt-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeRecords.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">
                {activeTab === 'prices' && 'No hay cambios de precio registrados.'}
                {activeTab === 'names' && 'No hay cambios de nombre registrados.'}
                {activeTab === 'descriptions' && 'No hay cambios de descripción registrados.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {/* === PRICES TAB === */}
              {activeTab === 'prices' && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider">Costo Ant.</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider">Costo Nvo.</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider">Precio Ant.</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider">Precio Nvo.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {priceRecords.map((record) => {
                      const costDiff = record.new_cost - record.old_cost;
                      const priceDiff = record.new_price_usd - record.old_price_usd;
                      return (
                        <tr key={record.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{formatDate(record.changed_at)}</td>
                          <td className="px-4 py-3 text-right text-[12px] text-slate-500">{formatUSD(record.old_cost)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {costDiff > 0 ? <TrendingUp className="w-3 h-3 text-red-500" /> : costDiff < 0 ? <TrendingDown className="w-3 h-3 text-emerald-500" /> : <Minus className="w-3 h-3 text-slate-300" />}
                              <span className="text-[13px] font-medium text-slate-900">{formatUSD(record.new_cost)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-[12px] text-slate-500">{formatUSD(record.old_price_usd)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {priceDiff > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : priceDiff < 0 ? <TrendingDown className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-slate-300" />}
                              <span className="text-[13px] font-bold text-slate-900">{formatUSD(record.new_price_usd)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* === NAMES TAB === */}
              {activeTab === 'names' && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nombre Anterior</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nombre Nuevo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nameRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{formatDate(record.changed_at)}</td>
                        <td className="px-4 py-3 text-[12px] text-slate-500 line-through max-w-[200px] truncate">{record.old_name}</td>
                        <td className="px-4 py-3 text-[13px] font-medium text-emerald-700 max-w-[200px] truncate">{record.new_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* === DESCRIPTIONS TAB === */}
              {activeTab === 'descriptions' && (
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                  {descRecords.map((record) => (
                    <div key={record.id} className="p-4 hover:bg-slate-50">
                      <p className="text-[11px] text-slate-400 mb-2">{formatDate(record.changed_at)}</p>
                      {record.old_description && (
                        <div className="mb-2">
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Anterior:</span>
                          <p className="text-[12px] text-slate-500 line-through mt-0.5">{record.old_description}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Nuevo:</span>
                        <p className="text-[12px] text-slate-800 mt-0.5">{record.new_description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
