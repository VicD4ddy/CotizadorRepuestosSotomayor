import { useMemo } from 'react';
import { useQuotes, useUpdateQuote } from '@/hooks/use-supabase';
import { Quote } from '@/types';
import { formatUSD, formatBs } from '@/lib/utils';
import { toast } from 'sonner';
import {
  TrendingUp,
  DollarSign,
  Calendar as CalendarIcon,
  ShoppingBag,
  Ban,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function SalesDashboard() {
  const { data: quotes = [], isLoading } = useQuotes();
  const updateQuote = useUpdateQuote();

  const {
    approvedSales,
    salesTodayUSD,
    salesTodayBs,
    salesThisMonthUSD,
    salesThisMonthBs,
    recentSales,
  } = useMemo(() => {
    const approved = quotes.filter((q) => q.status?.toLowerCase() === 'aprobada');

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

    let salesTodayUSD = 0;
    let salesTodayBs = 0;
    let salesThisMonthUSD = 0;
    let salesThisMonthBs = 0;

    approved.forEach((sale) => {
      const saleDate = new Date(sale.created_at || '').getTime();
      const totalUsd = sale.total_usd || 0;
      const bcvRate = sale.bcv_rate || 36.5;
      const totalBs = totalUsd * bcvRate;

      if (saleDate >= startOfToday) {
        salesTodayUSD += totalUsd;
        salesTodayBs += totalBs;
      }

      if (saleDate >= startOfMonth) {
        salesThisMonthUSD += totalUsd;
        salesThisMonthBs += totalBs;
      }
    });

    // Recent 10 sales
    const recentSales = approved.slice(0, 10);

    return {
      approvedSales: approved,
      salesTodayUSD,
      salesTodayBs,
      salesThisMonthUSD,
      salesThisMonthBs,
      recentSales,
    };
  }, [quotes]);

  const handleVoidSale = async (e: React.MouseEvent, quote: Quote) => {
    e.stopPropagation();
    if (confirm(`¿Estás seguro de que deseas anular esta venta por ${formatUSD(quote.total_usd || 0)}?`)) {
      try {
        await updateQuote.mutateAsync({ id: quote.id, status: 'Anulada' });
        toast.success('Venta anulada exitosamente');
      } catch (error: any) {
        toast.error('Error al anular la venta', { description: error.message });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Calculando estadísticas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 space-y-6 max-w-6xl mx-auto w-full pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Módulo de Ventas</h2>
          <p className="text-sm text-slate-500 mt-1">Resumen financiero basado en cotizaciones aprobadas.</p>
        </div>
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-3 py-1 text-[11px] uppercase tracking-widest font-bold">
          {approvedSales.length} Ventas Totales
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ventas del Día</p>
            <h3 className="text-2xl font-black text-slate-900">{formatUSD(salesTodayUSD)}</h3>
            <p className="text-[13px] text-slate-500 font-medium mt-1">
              Bs {salesTodayBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ventas del Mes</p>
            <h3 className="text-2xl font-black text-slate-900">{formatUSD(salesThisMonthUSD)}</h3>
            <p className="text-[13px] text-slate-500 font-medium mt-1">
              Bs {salesThisMonthBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">Promedio por Venta (Mes)</p>
            <h3 className="text-2xl font-black text-slate-900">
              {formatUSD(salesThisMonthUSD / (approvedSales.filter(s => new Date(s.created_at || '').getTime() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()).length || 1))}
            </h3>
            <p className="text-[13px] text-slate-500 font-medium mt-1">
              Ticket promedio
            </p>
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[300px]">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-slate-800" />
            <h3 className="text-[15px] font-bold text-slate-900">Últimas Ventas Aprobadas</h3>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Fecha</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Cliente</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Tasa BCV</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Total USD</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSales.map((sale) => {
                const date = new Date(sale.created_at || '');
                return (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-[13px] text-slate-600">
                      {date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[13px] text-slate-900">{sale.client_name || 'Sin nombre'}</p>
                      {sale.client_phone && <p className="text-[11px] text-slate-500">{sale.client_phone}</p>}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] text-slate-600">
                      Bs {sale.bcv_rate?.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-bold text-[14px] text-slate-900">{formatUSD(sale.total_usd || 0)}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={(e) => handleVoidSale(e, sale)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Anular Venta"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {recentSales.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingBag className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm text-slate-600">No hay ventas aprobadas aún</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
