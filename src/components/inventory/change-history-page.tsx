'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuditHistory, useRevertAuditLog, usePurgeOldHistory } from '@/hooks/use-supabase';
import { AuditLogEntry } from '@/types';
import {
  History,
  DollarSign,
  Type,
  FileText,
  ChevronDown,
  Trash2,
  Link2,
  Unlink,
  RotateCcw,
  CheckCircle2,
  Search,
  Wrench,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { formatUSD } from '@/lib/utils';
import { toast } from 'sonner';

type MainTab = 'all' | 'price' | 'name' | 'description' | 'deleted' | 'kits';

interface UnifiedHistoryItem {
  id: string;
  source: 'price_history' | 'audit_log';
  category: 'price' | 'name' | 'description' | 'multiple' | 'deleted' | 'kit_connected' | 'kit_disconnected';
  timestamp: string;
  raw: any;
}

// Helper to determine exact category of a price_history record
function classifyPriceHistoryRecord(record: any): 'price' | 'name' | 'description' | 'multiple' {
  const hasNameChange = Boolean(record.old_name && record.new_name && record.old_name !== record.new_name);
  const hasDescChange = Boolean(
    (record.new_description !== undefined && record.old_description !== undefined && record.old_description !== record.new_description) ||
    (record.new_description && !record.old_description)
  );
  const hasPriceChange = Boolean(
    (record.old_cost !== undefined && record.new_cost !== undefined && Number(record.old_cost) !== Number(record.new_cost)) ||
    (record.old_price_usd !== undefined && record.new_price_usd !== undefined && Number(record.old_price_usd) !== Number(record.new_price_usd))
  );

  // If Supabase trigger explicitly set change_type
  if (record.change_type === 'name' && !hasPriceChange && !hasDescChange) return 'name';
  if (record.change_type === 'description' && !hasPriceChange && !hasNameChange) return 'description';
  if (record.change_type === 'price' && !hasNameChange && !hasDescChange) return 'price';

  const count = (hasNameChange ? 1 : 0) + (hasDescChange ? 1 : 0) + (hasPriceChange ? 1 : 0);
  if (count > 1 || record.change_type === 'all') return 'multiple';
  if (hasNameChange) return 'name';
  if (hasDescChange) return 'description';
  if (hasPriceChange) return 'price';

  return 'price';
}

export function ChangeHistoryPage() {
  const [currentTab, setCurrentTab] = useState<MainTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);
  const [limit, setLimit] = useState(80);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  // 1. Fetch Price/Name/Description History (PERMANENTE - NO se elimina a los 30 días)
  const { data: priceHistory = [], isLoading: isLoadingPrice } = useQuery<any[]>({
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

  // 2. Fetch Audit Log (Eliminaciones y Kits - Respaldos de 30 días con auto-limpieza)
  const { data: auditLog = [], isLoading: isLoadingAudit } = useAuditHistory(limit);
  const revertAuditLog = useRevertAuditLog();
  const purgeOldHistory = usePurgeOldHistory();

  const handleManualPurge = async () => {
    try {
      await purgeOldHistory.mutateAsync();
      toast.success('Respaldos temporales (eliminaciones y kits) con más de 30 días depurados con éxito.');
    } catch (err: any) {
      toast.error(`Error al depurar respaldos: ${err.message}`);
    }
  };

  const handleRevert = async (entry: AuditLogEntry) => {
    try {
      setRevertingId(entry.id);
      await revertAuditLog.mutateAsync(entry);
      if (entry.action_type === 'product_deleted') {
        toast.success(`Producto "${entry.entity_name || entry.entity_code}" restaurado exitosamente al catálogo con sus kits asociados`);
      } else if (entry.action_type === 'kit_connected') {
        toast.success(`Vínculo de "${entry.entity_name}" con "${entry.details?.kit_name}" desvinculado exitosamente`);
      } else if (entry.action_type === 'kit_disconnected') {
        toast.success(`Vínculo de "${entry.entity_name}" con "${entry.details?.kit_name}" reconectado exitosamente`);
      }
    } catch (err: any) {
      toast.error(`Error al revertir: ${err.message}`);
    } finally {
      setRevertingId(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // Process and categorize records
  const classifiedPriceHistory = useMemo(() => {
    return priceHistory.map((rec) => ({
      raw: rec,
      category: classifyPriceHistoryRecord(rec),
    }));
  }, [priceHistory]);

  // Unified items filtered by tab and search
  const unifiedItems = useMemo(() => {
    const list: UnifiedHistoryItem[] = [];

    // Add classified price history items
    classifiedPriceHistory.forEach(({ raw, category }) => {
      // Tab filtering
      if (currentTab === 'price' && category !== 'price' && category !== 'multiple') return;
      if (currentTab === 'name' && category !== 'name' && category !== 'multiple') return;
      if (currentTab === 'description' && category !== 'description' && category !== 'multiple') return;
      if (currentTab === 'deleted' || currentTab === 'kits') return;

      list.push({
        id: `price_${raw.id}`,
        source: 'price_history',
        category,
        timestamp: raw.changed_at,
        raw,
      });
    });

    // Add audit log items
    if (currentTab === 'all' || currentTab === 'deleted' || currentTab === 'kits') {
      auditLog.forEach((item) => {
        if (currentTab === 'deleted' && item.action_type !== 'product_deleted') return;
        if (currentTab === 'kits' && item.action_type !== 'kit_connected' && item.action_type !== 'kit_disconnected') return;
        if (filterPendingOnly && item.is_reverted) return;

        list.push({
          id: `audit_${item.id}`,
          source: 'audit_log',
          category: item.action_type as any,
          timestamp: item.created_at,
          raw: item,
        });
      });
    }

    // Sort descending by timestamp
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Search query filter
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => {
      if (item.source === 'price_history') {
        const prodName = item.raw.products?.name?.toLowerCase() || '';
        const prodCode = item.raw.products?.code?.toLowerCase() || '';
        const oldName = item.raw.old_name?.toLowerCase() || '';
        const newName = item.raw.new_name?.toLowerCase() || '';
        return prodName.includes(q) || prodCode.includes(q) || oldName.includes(q) || newName.includes(q);
      } else {
        const entry = item.raw as AuditLogEntry;
        const code = (entry.entity_code || '').toLowerCase();
        const name = (entry.entity_name || '').toLowerCase();
        const kitName = (entry.details?.kit_name || '').toLowerCase();
        return code.includes(q) || name.includes(q) || kitName.includes(q);
      }
    });
  }, [classifiedPriceHistory, auditLog, currentTab, filterPendingOnly, searchQuery]);

  // Detailed statistics
  const stats = useMemo(() => {
    let priceCount = 0;
    let nameCount = 0;
    let descCount = 0;

    classifiedPriceHistory.forEach(({ category }) => {
      if (category === 'price') priceCount++;
      else if (category === 'name') nameCount++;
      else if (category === 'description') descCount++;
      else if (category === 'multiple') {
        priceCount++;
        nameCount++;
        descCount++;
      }
    });

    const totalDeleted = auditLog.filter((a) => a.action_type === 'product_deleted');
    const pendingDeleted = totalDeleted.filter((a) => !a.is_reverted);
    const totalKits = auditLog.filter((a) => a.action_type === 'kit_connected' || a.action_type === 'kit_disconnected');
    const pendingKits = totalKits.filter((a) => !a.is_reverted);

    return {
      priceHistoryTotal: priceHistory.length,
      priceCount,
      nameCount,
      descCount,
      deletedTotal: totalDeleted.length,
      deletedPending: pendingDeleted.length,
      kitsTotal: totalKits.length,
      kitsPending: pendingKits.length,
      totalEvents: priceHistory.length + auditLog.length,
    };
  }, [classifiedPriceHistory, priceHistory, auditLog]);

  const isLoading = isLoadingPrice || isLoadingAudit;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            Historial y Auditoría de Cambios
          </h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Registro claro de modificaciones de nombres, descripciones y precios (permanentes), y respaldos de eliminaciones y kits (30 días).
          </p>
        </div>

        {/* Retention Policy Information Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs font-semibold text-emerald-800 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Precios, Nombres y Descripciones: <strong>Permanente</strong></span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Respaldos (Eliminaciones/Kits): <strong>30 días</strong></span>
          </div>

          <button
            onClick={handleManualPurge}
            disabled={purgeOldHistory.isPending}
            title="Depurar inmediatamente respaldos temporales con más de 30 días"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {purgeOldHistory.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>Depurar &gt; 30d</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Clear Separation of Events */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</span>
            <History className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900">{stats.totalEvents}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">En el sistema</div>
        </div>

        {/* Precios */}
        <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Precios</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-700">{stats.priceCount}</div>
          <div className="text-[10px] text-emerald-600/80 font-medium mt-0.5">Permanente</div>
        </div>

        {/* Nombres */}
        <div className="bg-white border border-violet-100 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-violet-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Nombres</span>
            <Type className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-xl font-black text-violet-700">{stats.nameCount}</div>
          <div className="text-[10px] text-violet-600/80 font-medium mt-0.5">Permanente</div>
        </div>

        {/* Descripciones */}
        <div className="bg-white border border-sky-100 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-sky-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Descripciones</span>
            <FileText className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black text-sky-700">{stats.descCount}</div>
          <div className="text-[10px] text-sky-600/80 font-medium mt-0.5">Permanente</div>
        </div>

        {/* Eliminaciones */}
        <div className="bg-white border border-rose-100 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Eliminados</span>
            <Trash2 className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-rose-600">{stats.deletedTotal}</span>
            {stats.deletedPending > 0 && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1 rounded">
                {stats.deletedPending} rest.
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Respaldos 30d</div>
        </div>

        {/* Kits */}
        <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Kits</span>
            <Wrench className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-blue-600">{stats.kitsTotal}</span>
            {stats.kitsPending > 0 && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded">
                {stats.kitsPending} rev.
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Respaldos 30d</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        {/* Navigation Tabs with Exact Counts */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCurrentTab('all')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
              currentTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({stats.totalEvents})
          </button>

          <button
            onClick={() => setCurrentTab('price')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'price'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Precios ({stats.priceCount})
          </button>

          <button
            onClick={() => setCurrentTab('name')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'name'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-violet-700'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Nombres ({stats.nameCount})
          </button>

          <button
            onClick={() => setCurrentTab('description')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'description'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-sky-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Descripciones ({stats.descCount})
          </button>

          <button
            onClick={() => setCurrentTab('deleted')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'deleted'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminaciones ({stats.deletedTotal})
          </button>

          <button
            onClick={() => setCurrentTab('kits')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'kits'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-blue-700'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Kits ({stats.kitsTotal})
          </button>
        </div>

        {/* Search & Pending Checkbox */}
        <div className="flex items-center gap-2">
          {(currentTab === 'deleted' || currentTab === 'kits' || currentTab === 'all') && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              <input
                type="checkbox"
                checked={filterPendingOnly}
                onChange={(e) => setFilterPendingOnly(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-0"
              />
              <span className="font-medium">Solo pendientes de revertir</span>
            </label>
          )}

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, repuesto, kit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Cargando historial...</p>
        </div>
      ) : unifiedItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 text-slate-400 p-6">
          <History className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <h3 className="text-base font-semibold text-slate-700">No hay registros en esta sección</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No se encontraron resultados para "${searchQuery}".`
              : 'Las modificaciones de inventario aparecerán aquí organizadas según su tipo.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {unifiedItems.map((item) => {
            if (item.source === 'price_history') {
              const record = item.raw;
              const cat = item.category;
              const productName = record.products?.name || record.old_name || record.new_name || 'Producto sin nombre';
              const productCode = record.products?.code || '';

              const isName = cat === 'name';
              const isDesc = cat === 'description';
              const isPrice = cat === 'price';
              const isMultiple = cat === 'multiple';

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-4 transition-all duration-150 shadow-xs hover:shadow-md ${
                    isName
                      ? 'border-violet-200 hover:border-violet-300'
                      : isDesc
                      ? 'border-sky-200 hover:border-sky-300'
                      : isPrice
                      ? 'border-emerald-200 hover:border-emerald-300'
                      : 'border-indigo-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Icon */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isName
                            ? 'bg-violet-100 text-violet-700'
                            : isDesc
                            ? 'bg-sky-100 text-sky-700'
                            : isPrice
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {isName && <Type className="w-4 h-4" />}
                        {isDesc && <FileText className="w-4 h-4" />}
                        {isPrice && <DollarSign className="w-4 h-4" />}
                        {isMultiple && <SlidersHorizontal className="w-4 h-4" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              isName
                                ? 'bg-violet-100 text-violet-800 border-violet-200'
                                : isDesc
                                ? 'bg-sky-100 text-sky-800 border-sky-200'
                                : isPrice
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}
                          >
                            {isName && '✏️ CAMBIO DE NOMBRE'}
                            {isDesc && '📝 CAMBIO DE DESCRIPCIÓN'}
                            {isPrice && '💵 CAMBIO DE PRECIO / COSTO'}
                            {isMultiple && '🔄 MODIFICACIÓN MÚLTIPLE'}
                          </span>

                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDate(record.changed_at)}
                          </span>
                        </div>

                        {/* Product Title & Code */}
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-slate-900 truncate">{productName}</p>
                          {productCode && (
                            <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {productCode}
                            </span>
                          )}
                        </div>

                        {/* 1. VISTA DE CAMBIO DE NOMBRE */}
                        {(isName || isMultiple) && record.old_name && record.new_name && record.old_name !== record.new_name && (
                          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="bg-rose-50/70 border border-rose-200 p-2.5 rounded-lg">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block mb-0.5">
                                Nombre Anterior:
                              </span>
                              <p className="text-slate-600 line-through font-medium truncate">{record.old_name}</p>
                            </div>
                            <div className="bg-violet-50/80 border border-violet-200 p-2.5 rounded-lg">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 block mb-0.5">
                                Nuevo Nombre Actualizado:
                              </span>
                              <p className="text-violet-950 font-bold truncate">{record.new_name}</p>
                            </div>
                          </div>
                        )}

                        {/* 2. VISTA DE CAMBIO DE DESCRIPCIÓN */}
                        {(isDesc || isMultiple) && record.new_description && (
                          <div className="mt-2.5 space-y-2 text-xs">
                            {record.old_description ? (
                              <div className="bg-rose-50/70 border border-rose-200 p-2.5 rounded-lg">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block mb-0.5">
                                  Descripción Anterior:
                                </span>
                                <p className="text-slate-600 line-through text-[11px] leading-relaxed">
                                  {record.old_description}
                                </p>
                              </div>
                            ) : null}
                            <div className="bg-sky-50/80 border border-sky-200 p-2.5 rounded-lg">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block mb-0.5">
                                {record.old_description ? 'Nueva Descripción Actualizada:' : 'Descripción Asignada:'}
                              </span>
                              <p className="text-slate-800 font-medium text-[11px] leading-relaxed">
                                {record.new_description}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 3. VISTA DE CAMBIO DE PRECIO / COSTO */}
                        {(isPrice || isMultiple) && (
                          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {/* Costo Proveedor */}
                            <div
                              className={`p-2.5 rounded-lg border ${
                                record.old_cost !== record.new_cost
                                  ? 'bg-amber-50/80 border-amber-200'
                                  : 'bg-slate-50 border-slate-200 opacity-75'
                              }`}
                            >
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                                Costo Proveedor {record.old_cost !== record.new_cost ? '• Modificado' : '• Sin cambios'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-slate-500 font-medium ${record.old_cost !== record.new_cost ? 'line-through' : ''}`}>
                                  {formatUSD(record.old_cost)}
                                </span>
                                {record.old_cost !== record.new_cost && (
                                  <>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="font-bold text-slate-900">{formatUSD(record.new_cost)}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Precio de Venta USD */}
                            <div
                              className={`p-2.5 rounded-lg border ${
                                record.old_price_usd !== record.new_price_usd
                                  ? 'bg-emerald-50/90 border-emerald-200'
                                  : 'bg-slate-50 border-slate-200 opacity-75'
                              }`}
                            >
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                                Precio Venta (USD) {record.old_price_usd !== record.new_price_usd ? '• Actualizado' : '• Sin cambios'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-slate-500 font-medium ${record.old_price_usd !== record.new_price_usd ? 'line-through' : ''}`}>
                                  {formatUSD(record.old_price_usd)}
                                </span>
                                {record.old_price_usd !== record.new_price_usd && (
                                  <>
                                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="font-black text-emerald-800 text-sm">
                                      {formatUSD(record.new_price_usd)}
                                    </span>
                                    {record.new_price_usd > record.old_price_usd ? (
                                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                                        +{formatUSD(record.new_price_usd - record.old_price_usd)} ↗
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                        -{formatUSD(record.old_price_usd - record.new_price_usd)} ↘
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side Notice: PERMANENT & NOT REVERSIBLE */}
                    <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg select-none">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Historial Permanente</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Audit Log Entry (Deleted or Kit Action - Reversible)
              const entry = item.raw as AuditLogEntry;
              const isDeleted = entry.action_type === 'product_deleted';
              const isKitConnected = entry.action_type === 'kit_connected';
              const isKitDisconnected = entry.action_type === 'kit_disconnected';

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-4 transition-all duration-150 ${
                    entry.is_reverted
                      ? 'border-slate-200 opacity-75'
                      : isDeleted
                      ? 'border-rose-200 shadow-xs hover:border-rose-300'
                      : isKitConnected
                      ? 'border-blue-200 shadow-xs hover:border-blue-300'
                      : 'border-amber-200 shadow-xs hover:border-amber-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Action Icon */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isDeleted
                            ? 'bg-rose-100 text-rose-700'
                            : isKitConnected
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isDeleted && <Trash2 className="w-4 h-4" />}
                        {isKitConnected && <Link2 className="w-4 h-4" />}
                        {isKitDisconnected && <Unlink className="w-4 h-4" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              isDeleted
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : isKitConnected
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isDeleted && '🗑️ PRODUCTO ELIMINADO'}
                            {isKitConnected && '🔗 REPUESTO ASOCIADO A COTIZADOR'}
                            {isKitDisconnected && '⚠️ REPUESTO DESVINCULADO DE COTIZADOR'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDate(entry.created_at)}
                          </span>
                        </div>

                        {/* Title & Code */}
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-slate-900 truncate">
                            {entry.entity_name || entry.details?.product_name || 'Repuesto'}
                          </p>
                          {(entry.entity_code || entry.details?.product_code) && (
                            <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {entry.entity_code || entry.details?.product_code}
                            </span>
                          )}
                        </div>

                        {/* Details for Product Deleted */}
                        {isDeleted && entry.details?.product_snapshot && (
                          <div className="mt-2.5 text-xs text-slate-600 space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <div className="flex flex-wrap items-center gap-3">
                              <span>
                                Costo:{' '}
                                <strong className="text-slate-800">
                                  {formatUSD(entry.details.product_snapshot.cost || 0)}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                Precio:{' '}
                                <strong className="text-emerald-700 font-bold">
                                  {formatUSD(entry.details.product_snapshot.price_usd || 0)}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                Stock previo:{' '}
                                <strong className="text-slate-800 font-bold">
                                  {entry.details.product_snapshot.stock ?? 0}
                                </strong>
                              </span>
                            </div>

                            {entry.details.kit_associations && entry.details.kit_associations.length > 0 && (
                              <div className="pt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 font-medium">Cotizadores vinculados:</span>
                                {entry.details.kit_associations.map((k: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md"
                                  >
                                    {k.kit_name || 'Cotizador'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Details for Kit Association / Disconnection */}
                        {(isKitConnected || isKitDisconnected) && (
                          <div className="mt-2.5 text-xs flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-500 font-medium">
                              {isKitConnected ? 'Vinculado a:' : 'Desconectado de:'}
                            </span>
                            <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {entry.details?.kit_name || 'Cotizador de Motor / Tren'}
                            </span>
                            {entry.details?.kit_category && (
                              <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                                {entry.details.kit_category === 'motor' ? 'Motor' : entry.details.kit_category === 'tren_delantero' ? 'Tren Delantero' : entry.details.kit_category}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Revert Button for Audited Backups */}
                    <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                      {entry.is_reverted ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>
                            {isDeleted ? 'Restaurado' : 'Revertido'}{' '}
                            {entry.reverted_at && (
                              <span className="font-normal text-[11px] text-emerald-600/80">
                                ({formatDate(entry.reverted_at)})
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRevert(entry)}
                          disabled={revertingId === entry.id}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer ${
                            isDeleted
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : isKitConnected
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          {revertingId === entry.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Revirtiendo...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>
                                {isDeleted && 'Restaurar Producto'}
                                {isKitConnected && 'Desvincular del Cotizador'}
                                {isKitDisconnected && 'Reconectar al Cotizador'}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          })}

          {/* Load More Button */}
          {unifiedItems.length >= limit && (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="w-full py-3 text-center text-[12px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs mt-4 cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
              Cargar más eventos del historial
            </button>
          )}
        </div>
      )}
    </div>
  );
}
