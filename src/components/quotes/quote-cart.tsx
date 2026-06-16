'use client';

import { useCartStore } from '@/store/cart-store';
import { useBcvRate, useCreateQuote, useBcvMultiplier } from '@/hooks/use-supabase';
import { formatUSD, formatBs } from '@/lib/utils';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  FileText,
  MessageCircle,
  CheckCircle,
  X,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { QuoteSaveDialog } from './quote-save-dialog';
import { Input } from '@/components/ui/input';
import { User, Phone } from 'lucide-react';
import { generateQuotePDF } from '@/lib/generate-quote-pdf';
import { Quote } from '@/types';

export function QuoteCart() {
  const {
    items,
    clientName,
    clientPhone,
    paymentMethod,
    setClientName,
    setClientPhone,
    setPaymentMethod,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
  } = useCartStore();
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const createQuote = useCreateQuote();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const subtotal = getSubtotal(bcvMultiplier);
  const total = subtotal;
  const totalBs = paymentMethod === 'bs' ? total * bcvRate : 0;

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  const handleOpenSaveDialog = () => {
    if (items.length === 0) {
      toast.error('Agrega productos a la cotización');
      return;
    }
    setIsSaveDialogOpen(true);
  };

  // Build a temporary Quote object from cart state for PDF layout
  const buildTempQuote = (): Quote => ({
    id: `TEMP-${Date.now().toString(36).toUpperCase()}`,
    client_name: clientName || 'Cliente Mostrador',
    client_phone: clientPhone || '',
    total_usd: subtotal,
    bcv_rate: bcvRate,
    status: 'Cotizada',
    created_at: new Date().toISOString(),
    quote_items: items.map((item, i) => ({
      id: `item-${i}`,
      quote_id: '',
      product_id: item.product_id,
      product_name: item.product_name,
      product_code: item.product_code,
      quantity: item.quantity,
      unit_price_usd: item.unit_price_usd,
      brand_name: item.brand_name,
      brand_logo_url: item.brand_logo_url,
    })),
  });

  const handleExportPdf = async () => {
    if (items.length === 0) {
      toast.error('Agrega productos a la cotización');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const tempQuote = buildTempQuote();
      const currency = paymentMethod === 'bs' ? 'bcv' : 'usd';
      await generateQuotePDF({ quote: tempQuote, currency, bcvMultiplier });
      toast.success('PDF generado exitosamente');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleWhatsApp = async () => {
    if (items.length === 0) {
      toast.error('Agrega productos a la cotización');
      return;
    }

    const phone = clientPhone?.replace(/[^0-9]/g, '') || '';
    if (!phone) {
      toast.error('Ingresa el número de teléfono del cliente');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const tempQuote = buildTempQuote();
      const currency = paymentMethod === 'bs' ? 'bcv' : 'usd';
      const { blob, fileName } = await generateQuotePDF({ quote: tempQuote, currency, bcvMultiplier, returnBlob: true });

      // Download the PDF first
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Build WhatsApp message
      const currencyLabel = paymentMethod === 'bs' ? '💵 Cotización en *BOLÍVARES*' : '💵 Cotización en *DIVISAS (USD)*';
      let msg = `*REPUESTOS SOTOMAYOR*\n_${currencyLabel}_\n\n`;
      if (clientName) msg += `*Cliente:* ${clientName}\n`;
      msg += `*Fecha:* ${new Date().toLocaleDateString('es-VE')}\n\n`;
      msg += `*Detalle:*\n`;
      items.forEach((item) => {
        const itemPrice = paymentMethod === 'bs' ? item.unit_price_usd * bcvMultiplier : item.unit_price_usd;
        const brandSuffix = item.brand_name ? ` (${item.brand_name})` : '';
        msg += `- ${item.quantity}x ${item.product_name}${brandSuffix} — ${formatUSD(itemPrice)}\n`;
      });
      msg += `\n*Total USD:* ${formatUSD(total)}\n`;
      if (paymentMethod === 'bs') {
        msg += `*Total Bs:* ${formatBs(totalBs)}\n`;
      }
      msg += `\n_📎 El PDF fue descargado. Adjúntalo a este chat._`;

      const encoded = encodeURIComponent(msg);
      // Open WhatsApp directly with the client's phone number
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
      toast.success('PDF descargado. Adjunta el archivo en el chat de WhatsApp.');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error('Error al enviar por WhatsApp');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex flex-col px-5 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-slate-800" />
            <h3 className="font-bold text-[14px] text-slate-900">Cotización Actual</h3>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>
        
        {/* Payment Method Switch */}
        <div className="flex p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setPaymentMethod('divisas')}
            className={cn(
              "flex-1 py-1.5 text-[12px] font-medium rounded-md transition-all",
              paymentMethod === 'divisas' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Pago en Divisas
          </button>
          <button
            onClick={() => setPaymentMethod('bs')}
            className={cn(
              "flex-1 py-1.5 text-[12px] font-medium rounded-md transition-all",
              paymentMethod === 'bs' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Pago en Bs
          </button>
        </div>

        {/* Client Info Inputs */}
        <div className="mt-4 space-y-2">
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Nombre del Cliente"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="pl-8 h-8 text-[12px] bg-white border-slate-200 focus-visible:ring-emerald-500"
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Teléfono (Opcional)"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="pl-8 h-8 text-[12px] bg-white border-slate-200 focus-visible:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-[13px] text-slate-600">Sin productos</p>
            <p className="text-[11px]">Usa el botón + en la tabla</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {items.map((item) => {
              const itemPrice = paymentMethod === 'bs' ? item.unit_price_usd * bcvMultiplier : item.unit_price_usd;
              const itemBs = itemPrice * bcvRate;
              return (
                <div key={item.product_id} className="p-3 bg-white border border-slate-200 shadow-sm">
                  {/* Top row: name + price */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[12px] font-bold text-slate-900 leading-tight">
                        {item.product_name}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.product_code);
                          toast.success(`Código copiado: ${item.product_code}`);
                        }}
                        className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wide hover:text-emerald-600 cursor-pointer transition-colors"
                        title="Clic para copiar código"
                      >
                        {item.product_code}
                      </button>
                      <div className="mt-1">
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          (item.stock ?? 0) === 0 
                            ? "bg-red-50 text-red-600" 
                            : item.quantity > (item.stock ?? 0)
                            ? "bg-amber-50 text-amber-700 font-bold"
                            : "bg-slate-100 text-slate-600"
                        )}>
                          Disp: {item.stock ?? 0}
                        </span>
                        {item.quantity > (item.stock ?? 0) && (item.stock ?? 0) > 0 && (
                          <span className="text-[9px] text-amber-600 font-medium ml-1.5">Excede stock</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-slate-900">{formatUSD(itemPrice)}</p>
                      {paymentMethod === 'bs' && (
                        <p className="text-[10px] text-slate-500">
                          Bs {(itemBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom row: quantity + total */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-[12px] font-bold text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[12px] font-bold text-slate-900">
                      Total: {formatUSD(itemPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totals */}
      {items.length > 0 && (
        <div className="border-t border-slate-200 p-5 bg-[#f8fafc]">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-[12px] font-medium">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-slate-900">{formatUSD(subtotal)}</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 mb-2">
            <div className="flex justify-between items-baseline">
              <span className="text-[15px] font-bold text-slate-900">Total USD</span>
              <span className="text-[20px] font-bold text-slate-900">{formatUSD(total)}</span>
            </div>
            {paymentMethod === 'bs' && (
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-slate-500 font-medium">Total Bs (Tasa: {bcvRate.toFixed(2)})</span>
                <span className="text-[12px] font-bold text-slate-600">Bs {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={handleOpenSaveDialog}
              className="flex-1 h-[42px] rounded border border-slate-900 bg-[#0f172a] hover:bg-[#1e293b] text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Guardar Cotización
            </button>
            <button
              onClick={handleWhatsApp}
              title="Enviar por WhatsApp"
              className="w-[42px] h-[42px] rounded border border-slate-200 bg-[#25D366] hover:bg-[#20b858] text-white flex items-center justify-center transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              title="Exportar PDF"
              className="w-[42px] h-[42px] rounded border border-slate-200 bg-white flex items-center justify-center text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <QuoteSaveDialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen} />
    </div>
  );
}
