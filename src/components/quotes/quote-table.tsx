import { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { Quote } from '@/types';
import { useQuotes, useDeleteQuote } from '@/hooks/use-supabase';
import { Badge } from '@/components/ui/badge';
import { formatUSD, cn } from '@/lib/utils';
import { Search, ArrowUpDown, Calendar, Eye, Trash2, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  QuoteDetailsDialog,
  getQuoteStatusMeta,
  getDocBadgeClass,
  parseQuoteClientInfo,
  normalizeQuoteStatus,
} from './quote-details-dialog';

const columnHelper = createColumnHelper<Quote>();

const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'Todas' },
  { key: 'cotizada', label: 'Cotizada' },
  { key: 'enviada por whatsapp', label: 'WhatsApp' },
  { key: 'aprobada', label: 'Aprobada' },
  { key: 'rechazada', label: 'Rechazada' },
  { key: 'anulada', label: 'Anulada' },
] as const;

function formatCompactDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date
    .toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\./g, '');
}

export function QuoteTable() {
  const { data: quotes = [], isLoading } = useQuotes();
  const deleteQuote = useDeleteQuote();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const searchFilteredQuotes = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return quotes;
    return quotes.filter(
      (q) =>
        q.client_name?.toLowerCase().includes(trimmed) ||
        q.client_phone?.toLowerCase().includes(trimmed)
    );
  }, [quotes, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: searchFilteredQuotes.length };
    for (const q of searchFilteredQuotes) {
      const key = normalizeQuoteStatus(q.status);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [searchFilteredQuotes]);

  const filteredQuotes = useMemo(() => {
    if (statusFilter === 'all') return searchFilteredQuotes;
    return searchFilteredQuotes.filter((q) => normalizeQuoteStatus(q.status) === statusFilter);
  }, [searchFilteredQuotes, statusFilter]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent | undefined, quote: Quote) => {
      e?.stopPropagation();
      const { displayName } = parseQuoteClientInfo(quote);
      if (confirm(`¿Estás seguro de que quieres eliminar la cotización de "${displayName}"?`)) {
        try {
          await deleteQuote.mutateAsync(quote.id);
          setSelectedQuote((prev) => (prev?.id === quote.id ? null : prev));
          toast.success('Cotización eliminada exitosamente');
        } catch (error: any) {
          toast.error('Error al eliminar', { description: error.message });
        }
      }
    },
    [deleteQuote]
  );

  const isSortedByTotal = sorting[0]?.id === 'total_usd';
  const toggleMobileSort = () => {
    setSorting(
      isSortedByTotal
        ? [{ id: 'created_at', desc: true }]
        : [{ id: 'total_usd', desc: true }]
    );
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('created_at', {
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-sm"
            onClick={() => column.toggleSorting()}
          >
            FECHA
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 150,
        cell: (info) => (
          <div className="flex items-center gap-2 text-[13px] text-slate-600 font-mono tabular-nums whitespace-nowrap">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            {formatCompactDate(info.getValue())}
          </div>
        ),
      }),
      columnHelper.accessor('client_name', {
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-sm"
            onClick={() => column.toggleSorting()}
          >
            CLIENTE
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 250,
        cell: ({ row }) => {
          const { docBadge, displayName } = parseQuoteClientInfo(row.original);
          return (
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {docBadge && (
                  <span
                    className={cn(
                      'text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border',
                      getDocBadgeClass(docBadge)
                    )}
                  >
                    {docBadge}
                  </span>
                )}
                <span className="font-semibold text-[13px] text-slate-900 leading-tight">
                  {displayName}
                </span>
              </div>
              {row.original.client_phone && (
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                  {row.original.client_phone}
                </p>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('total_usd', {
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-sm"
            onClick={() => column.toggleSorting()}
          >
            TOTAL (USD)
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 150,
        cell: (info) => (
          <span className="text-[13px] font-bold font-mono tabular-nums text-slate-900">
            {formatUSD(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'ESTADO',
        size: 150,
        cell: (info) => {
          const statusMeta = getQuoteStatusMeta(info.getValue());
          return (
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest border-none px-2 py-1 rounded-sm',
                statusMeta.badgeClass
              )}
            >
              {statusMeta.label}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'ACCIONES',
        size: 100,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1 rounded-sm text-slate-400 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedQuote(row.original);
              }}
              title="Ver detalles"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={(e) => handleDelete(e, row.original)}
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [handleDelete]
  );

  const table = useReactTable({
    data: filteredQuotes,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== 'all';

  const renderEmptyState = (compact = false) => (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-slate-400 bg-white text-center px-4',
        compact ? 'py-14' : 'py-16'
      )}
    >
      <Search className={cn('mb-2.5 opacity-25', compact ? 'w-9 h-9' : 'w-10 h-10 mb-3 opacity-20')} />
      <p className={cn('text-sm text-slate-600', compact && 'font-medium')}>No se encontraron cotizaciones</p>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
          className="mt-3 px-3 py-1.5 rounded-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white rounded-md md:rounded-lg border border-slate-200 shadow-sm min-w-0 overflow-hidden">
        <div className="px-3 py-3 md:p-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="h-5 w-44 bg-slate-100 rounded-sm animate-pulse" />
          <div className="h-5 w-20 bg-slate-100 rounded-sm animate-pulse" />
        </div>
        <div className="p-3 md:p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="p-3 border border-slate-100 rounded-sm space-y-2 animate-pulse">
              <div className="flex items-center justify-between gap-4">
                <div className="h-4 w-40 bg-slate-100 rounded-sm" />
                <div className="h-4 w-16 bg-slate-100 rounded-sm" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="h-3 w-32 bg-slate-100 rounded-sm" />
                <div className="h-4 w-16 bg-slate-100 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-md md:rounded-lg border border-slate-200 shadow-sm min-w-0 overflow-hidden">
      {/* Title Bar */}
      <div className="px-3 py-3 md:p-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <h2 className="text-[15px] md:text-[18px] font-bold text-slate-900 truncate">
          Historial de Cotizaciones
        </h2>
        <Badge
          variant="secondary"
          className="font-mono tabular-nums shrink-0 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-widest border-none px-2.5 md:px-3 py-1 rounded-sm"
        >
          {filteredQuotes.length} {filteredQuotes.length === 1 ? 'REGISTRO' : 'REGISTROS'}
        </Badge>
      </div>

      {/* Search, Mobile Sort & Status Filter Chips */}
      <div className="px-3 py-2.5 md:p-4 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              placeholder="Buscar por cliente o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 h-9 rounded-sm bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={toggleMobileSort}
            className="md:hidden inline-flex items-center gap-1.5 h-9 px-2.5 rounded-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] text-[11px] font-semibold text-slate-700 shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Cambiar orden"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>{isSortedByTotal ? 'Mayor $' : 'Recientes'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {STATUS_FILTER_OPTIONS.filter(
            (opt) => opt.key === 'all' || (statusCounts[opt.key] || 0) > 0 || statusFilter === opt.key
          ).map((opt) => {
            const count = statusCounts[opt.key] || 0;
            const isSelected = statusFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-semibold shrink-0 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                  isSelected
                    ? opt.key === 'all'
                      ? 'bg-slate-900 text-white border border-slate-900'
                      : 'bg-emerald-600 text-white border border-emerald-600'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                )}
              >
                <span>{opt.label}</span>
                <span
                  className={cn(
                    'text-[10px] font-mono tabular-nums px-1 py-0.5 rounded-sm',
                    isSelected
                      ? opt.key === 'all'
                        ? 'bg-slate-700 text-slate-100'
                        : 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Compact List */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white pb-16">
        {rows.map((row) => {
          const quote = row.original;
          const { docBadge, displayName } = parseQuoteClientInfo(quote);
          const statusMeta = getQuoteStatusMeta(quote.status);
          const itemsCount = quote.quote_items?.length ?? 0;

          return (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedQuote(quote)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedQuote(quote);
                }
              }}
              className="px-3 py-2.5 hover:bg-slate-50/80 active:bg-emerald-50/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            >
              {/* Top line: doc badge + client name (left), total USD (right) */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                  {docBadge && (
                    <span
                      className={cn(
                        'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border shrink-0',
                        getDocBadgeClass(docBadge)
                      )}
                    >
                      {docBadge}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-slate-900 leading-snug truncate">
                    {displayName}
                  </span>
                </div>
                <span className="shrink-0 text-right text-[14px] font-bold font-mono tabular-nums text-slate-900">
                  {formatUSD(quote.total_usd)}
                </span>
              </div>

              {/* Bottom line: date + phone + items count (left), status + chevron (right) */}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-slate-500 font-mono tabular-nums">
                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="whitespace-nowrap">{formatCompactDate(quote.created_at)}</span>
                  {quote.client_phone && <span className="truncate">• {quote.client_phone}</span>}
                  {itemsCount > 0 && (
                    <span className="shrink-0 text-slate-400">• {itemsCount} ít.</span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border-none',
                      statusMeta.badgeClass
                    )}
                  >
                    {statusMeta.mobileLabel}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </div>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && renderEmptyState(true)}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 align-bottom"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setSelectedQuote(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && renderEmptyState(false)}
      </div>

      {/* Details Dialog */}
      <QuoteDetailsDialog
        open={!!selectedQuote}
        onOpenChange={(open) => !open && setSelectedQuote(null)}
        quote={selectedQuote}
        onDelete={(q) => handleDelete(undefined, q)}
      />
    </div>
  );
}
