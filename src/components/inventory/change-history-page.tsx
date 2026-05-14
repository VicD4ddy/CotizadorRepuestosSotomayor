'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { History, DollarSign, Type, FileText, Filter, ChevronDown } from 'lucide-react';
import { formatUSD } from '@/lib/utils';

type ChangeFilter = 'all' | 'price' | 'name' | 'description';

export function ChangeHistoryPage() {
  const [filter, setFilter] = useState<ChangeFilter>('all');
  const [limit, setLimit] = useState(50);

  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ['global_history', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_price_history')
        .select('*, products(name, code)')
        .order('changed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = filter === 'all'
    ? history
    : history.filter((r) => {
        if (filter === 'price') return r.change_type === 'price' || (r.old_cost !== r.new_cost || r.old_price_usd !== r.new_price_usd);
        if (filter === 'name') return r.change_type === 'name' || r.change_type === 'all' || (r.old_name && r.new_name && r.old_name !== r.new_name);
        if (filter === 'description') return r.change_type === 'description' || r.change_type === 'all' || (r.old_description !== undefined && r.new_description !== undefined && r.old_description !== r.new_description);
        return true;
      });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const getChangeType = (record: any): { type: string; icon: React.ReactNode; color: string; bgColor: string } => {
    // Use the change_type from trigger when available
    if (record.change_type === 'name') return { type: 'Nombre', icon: <Type className="w-3.5 h-3.5" />, color: 'text-violet-600', bgColor: 'bg-violet-50' };
    if (record.change_type === 'description') return { type: 'Descripción', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (record.change_type === 'price') return { type: 'Precio', icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50' };

    // For 'all' or missing change_type, detect from data
    const hasNameChange = record.old_name && record.new_name && record.old_name !== record.new_name;
    const hasDescChange = record.old_description !== undefined && record.new_description !== undefined && record.old_description !== record.new_description;
    const hasPriceChange = record.old_cost !== record.new_cost || record.old_price_usd !== record.new_price_usd;

    if (record.change_type === 'all') {
      // Show both name and description in the card
      return { type: 'Nombre + Desc', icon: <Type className="w-3.5 h-3.5" />, color: 'text-indigo-600', bgColor: 'bg-indigo-50' };
    }

    if (hasNameChange) return { type: 'Nombre', icon: <Type className="w-3.5 h-3.5" />, color: 'text-violet-600', bgColor: 'bg-violet-50' };
    if (hasDescChange) return { type: 'Descripción', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (hasPriceChange) return { type: 'Precio', icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    return { type: 'Otro', icon: <History className="w-3.5 h-3.5" />, color: 'text-slate-600', bgColor: 'bg-slate-50' };
  };

  const FILTERS: { key: ChangeFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'price', label: 'Precios' },
    { key: 'name', label: 'Nombres' },
    { key: 'description', label: 'Descripciones' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-bold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-slate-400" />
            Historial de Cambios
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Registro completo de modificaciones en el inventario
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-slate-400" />
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
                filter === f.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <History className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="text-[14px] font-medium">No hay cambios registrados</p>
          <p className="text-[12px] mt-1">Los cambios en productos aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => {
            const change = getChangeType(record);
            const productName = record.products?.name || 'Producto eliminado';
            const productCode = record.products?.code || '';

            return (
              <div
                key={record.id}
                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  {/* Change Type Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${change.bgColor} ${change.color}`}>
                    {change.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${change.bgColor} ${change.color}`}>
                        {change.type}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDate(record.changed_at)}</span>
                    </div>

                    <p className="text-[13px] font-semibold text-slate-800 truncate">
                      {productName}
                      {productCode && (
                        <span className="font-mono text-[10px] text-slate-400 ml-2 bg-slate-100 px-1 rounded">{productCode}</span>
                      )}
                    </p>

                    {/* Detail based on type */}
                    {change.type === 'Precio' && (
                      <div className="flex gap-4 mt-1.5 text-[12px]">
                        <span className="text-slate-500">
                          Costo: <span className="line-through">{formatUSD(record.old_cost)}</span> → <span className="font-medium text-slate-800">{formatUSD(record.new_cost)}</span>
                        </span>
                        <span className="text-slate-500">
                          Precio: <span className="line-through">{formatUSD(record.old_price_usd)}</span> → <span className="font-bold text-emerald-700">{formatUSD(record.new_price_usd)}</span>
                        </span>
                      </div>
                    )}

                    {(change.type === 'Nombre' || change.type === 'Nombre + Desc') && record.old_name && record.new_name && record.old_name !== record.new_name && (
                      <div className="mt-1.5 text-[12px]">
                        <span className="text-slate-500 line-through">{record.old_name}</span>
                        <span className="text-slate-400 mx-1.5">→</span>
                        <span className="font-medium text-violet-700">{record.new_name}</span>
                      </div>
                    )}

                    {(change.type === 'Descripción' || change.type === 'Nombre + Desc') && record.new_description && (
                      <div className="mt-1.5 text-[11px] space-y-1">
                        {record.old_description && (
                          <p className="text-slate-400 line-through truncate">{record.old_description}</p>
                        )}
                        <p className="text-blue-700 truncate">{record.new_description}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load More */}
          {filtered.length >= limit && (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="w-full py-3 text-center text-[12px] font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
            >
              <ChevronDown className="w-4 h-4" />
              Cargar más registros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
