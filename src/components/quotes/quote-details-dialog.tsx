import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Quote, QuoteItem } from '@/types';
import { useUpdateQuote, useBcvMultiplier, useBcvRate } from '@/hooks/use-supabase';
import { formatUSD, formatBs, calculateBcvPrice, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Calendar, User, Phone, ShoppingCart, Download, Check, Trash2, MessageCircle, XCircle, Ban } from 'lucide-react';
import { getRandomWhatsAppPhrase } from '@/lib/whatsapp-phrases';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { generateQuotePDF } from '@/lib/generate-quote-pdf';
import { copyQuoteToClipboard } from '@/lib/capture-quote';
import { useCartStore } from '@/store/cart-store';
import { sortQuoteItems } from '@/lib/tren-delantero';

export interface QuoteStatusMeta {
  key: string;
  label: string;
  mobileLabel: string;
  badgeClass: string;
}

const QUOTE_STATUS_META: Record<string, QuoteStatusMeta> = {
  cotizada: {
    key: 'cotizada',
    label: 'cotizada',
    mobileLabel: 'Cotizada',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  'enviada por whatsapp': {
    key: 'enviada por whatsapp',
    label: 'enviada por whatsapp',
    mobileLabel: 'WhatsApp',
    badgeClass: 'bg-[#25D366]/15 text-[#128C7E]',
  },
  aprobada: {
    key: 'aprobada',
    label: 'aprobada',
    mobileLabel: 'Aprobada',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  rechazada: {
    key: 'rechazada',
    label: 'rechazada',
    mobileLabel: 'Rechazada',
    badgeClass: 'bg-red-100 text-red-700',
  },
  anulada: {
    key: 'anulada',
    label: 'anulada',
    mobileLabel: 'Anulada',
    badgeClass: 'bg-slate-200 text-slate-700',
  },
};

export function normalizeQuoteStatus(status?: string): string {
  return (status || 'cotizada').trim().toLowerCase();
}

export function getQuoteStatusMeta(status?: string): QuoteStatusMeta {
  const key = normalizeQuoteStatus(status);
  return (
    QUOTE_STATUS_META[key] || {
      key,
      label: key,
      mobileLabel: status?.trim() || 'Cotizada',
      badgeClass: 'bg-slate-100 text-slate-700',
    }
  );
}

export function getDocBadgeClass(docBadge: string): string {
  if (docBadge === 'Nota de Entrega') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (docBadge === 'Orden de Despacho') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (docBadge === 'Presupuesto') return 'bg-slate-100 text-slate-700 border-slate-300';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export function parseQuoteClientInfo(quote: Pick<Quote, 'client_name' | 'document_type'>) {
  const rawName = quote.client_name || '';
  const match = rawName.match(/^\[(.*?)\]\s*(.*)$/);
  const docBadge = match ? match[1] : quote.document_type || null;
  const displayName = (match ? match[2] : rawName).trim() || 'Sin nombre';
  return { docBadge, displayName };
}

function getQuoteBaseSubtotal(quote: Quote): number {
  const itemsSum = quote.quote_items?.reduce(
    (sum, item) => sum + (item.unit_price_usd || 0) * (item.quantity || 1),
    0
  );
  return itemsSum !== undefined && itemsSum > 0 ? itemsSum : quote.total_usd || 0;
}

interface QuoteDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  onDelete?: (quote: Quote) => void;
}

export function QuoteDetailsDialog({ open, onOpenChange, quote, onDelete }: QuoteDetailsDialogProps) {
  const updateQuote = useUpdateQuote();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const { data: currentBcvRate = 36.5 } = useBcvRate();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { clearCart, setClientName, setClientPhone, addItem } = useCartStore();

  if (!quote) return null;

  const dateObj = quote.created_at ? new Date(quote.created_at) : null;
  const date =
    dateObj && !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('es-VE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Sin fecha';

  const { docBadge, displayName } = parseQuoteClientInfo(quote);
  const statusMeta = getQuoteStatusMeta(quote.status);
  const status = statusMeta.key;
  const sortedItems = sortQuoteItems(quote.quote_items || []);

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await updateQuote.mutateAsync({ id: quote.id, status: newStatus });
      toast.success(`Cotización marcada como ${newStatus}`);
      onOpenChange(false);
    } catch {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleWhatsApp = async () => {
    if (!quote) return;

    let phone = quote.client_phone?.replace(/[^0-9]/g, '') || '';
    if (phone.length === 11 && phone.startsWith('0')) {
      phone = '58' + phone.substring(1);
    }
    if (!phone) {
      toast.error('Esta cotización no tiene número de teléfono');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const randomPhrase = getRandomWhatsAppPhrase();
      const bcvRate = quote.bcv_rate || currentBcvRate;

      // Generate and download PDF first
      const resolvedDocType = docBadge || 'Cotización';
      const { blob, fileName } = await generateQuotePDF({
        quote,
        currency: 'both',
        bcvMultiplier,
        returnBlob: true,
        bcvRate,
        randomPhrase,
        documentType: resolvedDocType,
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Copiar imagen al portapapeles
      try {
        await copyQuoteToClipboard(quote, bcvMultiplier, bcvRate, randomPhrase);
        toast.success('Imagen copiada. Presiona "Pegar" (Ctrl+V) en el chat de WhatsApp.', { duration: 5000 });
      } catch (err) {
        console.error('Failed to copy image to clipboard', err);
      }

      const baseSubtotal = getQuoteBaseSubtotal(quote);
      const subtotalBcv =
        quote.quote_items?.reduce(
          (sum, item) =>
            sum + calculateBcvPrice(item.unit_price_usd || 0, bcvMultiplier, item.product_name) * (item.quantity || 1),
          0
        ) || baseSubtotal * bcvMultiplier;
      const totalBs = subtotalBcv * bcvRate;
      let msg = `*REPUESTOS SOTOMAYOR*\n_Cotización en *DIVISAS Y BOLÍVARES*_\n\n`;
      if (quote.client_name) msg += `*Cliente:* ${quote.client_name}\n`;
      msg += `*Fecha:* ${date}\n\n`;
      msg += `*Detalle:*\n`;
      quote.quote_items?.forEach((item) => {
        const priceUSD = item.unit_price_usd || 0;
        const priceUsdBcv = calculateBcvPrice(priceUSD, bcvMultiplier, item.product_name);
        const priceBs = priceUsdBcv * bcvRate;
        const brandSuffix = item.brand_name ? ` (${item.brand_name})` : '';
        msg += `- ${item.quantity}x ${item.product_name}${brandSuffix}\n  USD: ${formatUSD(priceUSD)} | Bs: ${formatBs(priceBs)}\n`;
      });
      msg += `\n*Total USD:* ${formatUSD(baseSubtotal)}\n`;
      msg += `*Total Bs:* ${formatBs(totalBs)}\n`;
      msg += `\n_${randomPhrase}_`;

      const encoded = encodeURIComponent(msg);
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');

      if (!quote.status || quote.status.toLowerCase() === 'cotizada') {
        handleUpdateStatus('Enviada por WhatsApp');
      }

      toast.success('PDF descargado. Adjunta el archivo en el chat de WhatsApp.');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error('Error al enviar por WhatsApp');
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadPDF = async (currency: 'usd' | 'bcv' | 'both') => {
    if (!quote) return;
    setIsGeneratingPDF(true);

    try {
      const randomPhrase = getRandomWhatsAppPhrase();

      try {
        await copyQuoteToClipboard(quote, bcvMultiplier, currentBcvRate, randomPhrase, currency);
      } catch (err) {
        console.error('Failed to copy image to clipboard', err);
      }

      const resolvedDocType = docBadge || 'Cotización';
      await generateQuotePDF({
        quote,
        currency,
        bcvMultiplier,
        randomPhrase,
        bcvRate: currentBcvRate,
        documentType: resolvedDocType,
      });
      toast.success(
        `📄 PDF y Captura en ${
          currency === 'both' ? 'ambos precios' : currency === 'bcv' ? 'Bolívares (Bs)' : 'Divisas (USD)'
        } generados`
      );
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSendToCart = () => {
    if (!quote) return;
    clearCart();
    if (quote.client_name) setClientName(quote.client_name);
    if (quote.client_phone) setClientPhone(quote.client_phone);

    quote.quote_items?.forEach((item) => {
      addItem({
        product_id: item.product_id || item.id || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product_name: item.product_name,
        product_code: item.product_code || '',
        quantity: item.quantity,
        unit_price_usd: item.unit_price_usd,
        brand_name: item.brand_name || undefined,
        brand_logo_url: item.brand_logo_url || undefined,
      });
    });

    toast.success('Cotización enviada al carrito actual');
    onOpenChange(false);
  };

  const baseSubtotal = getQuoteBaseSubtotal(quote);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] sm:max-w-[800px] p-0 gap-0 overflow-hidden bg-slate-50 max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-md">
        <DialogHeader className="px-4 py-3.5 pr-10 sm:p-6 sm:pb-4 border-b border-slate-200 bg-white shrink-0 text-left">
          <DialogTitle className="text-base sm:text-xl font-bold text-slate-900 flex flex-wrap items-center gap-2">
            <span>Detalle de {docBadge || 'Cotización'}</span>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest border-none px-2 py-0.5 rounded-sm',
                statusMeta.badgeClass
              )}
            >
              {statusMeta.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="px-3.5 py-3.5 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 p-3 sm:p-4 bg-white border border-slate-200 rounded-md shadow-sm">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-start gap-2 text-[13px] text-slate-600">
                <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {quote.client_name?.startsWith('[') && docBadge && (
                    <span
                      className={cn(
                        'text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border shrink-0',
                        getDocBadgeClass(docBadge)
                      )}
                    >
                      {docBadge}
                    </span>
                  )}
                  <span className="font-semibold text-slate-900 break-words">
                    {quote.client_name ? displayName : 'Sin especificar'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono tabular-nums text-slate-700">
                  {quote.client_phone || 'Sin teléfono'}
                </span>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <div className="flex items-center gap-2 text-[12.5px] sm:text-[13px] text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono tabular-nums">{date}</span>
              </div>
              <div className="flex items-center gap-2 text-[12.5px] sm:text-[13px] text-slate-600">
                <span className="text-slate-400 font-semibold">Tasa BCV:</span>
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  Bs {quote.bcv_rate?.toFixed(2) ?? '0.00'}
                </span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <h4 className="text-[11px] sm:text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                Productos Cotizados
              </h4>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {sortedItems.length} {sortedItems.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            {/* Mobile Items List */}
            <div className="sm:hidden bg-white border border-slate-200 rounded-md divide-y divide-slate-100 overflow-hidden">
              {sortedItems.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-400">
                  Sin productos registrados en esta cotización
                </div>
              ) : (
                sortedItems.map((item: QuoteItem, idx) => {
                  const unitPrice = item.unit_price_usd || 0;
                  const qty = item.quantity || 1;
                  return (
                    <div key={item.id || `${item.product_code}-${idx}`} className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-slate-900 leading-snug break-words">
                          {item.product_name}
                        </span>
                        <span className="font-mono tabular-nums text-[12.5px] font-bold text-slate-900 shrink-0">
                          {formatUSD(unitPrice * qty)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                        <span className="truncate">
                          {item.product_code || 'SIN CÓDIGO'}
                          {item.brand_name ? ` · ${item.brand_name}` : ''}
                        </span>
                        <span className="shrink-0">
                          {qty} × {formatUSD(unitPrice)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="bg-slate-50 px-3 py-2.5 flex items-center justify-between border-t border-slate-200">
                <span className="text-[12.5px] font-bold text-slate-600">Total Cotizado:</span>
                <span className="text-[15px] font-bold font-mono tabular-nums text-slate-900">
                  {formatUSD(baseSubtotal)}
                </span>
              </div>
            </div>

            {/* Desktop Items Table */}
            <div className="hidden sm:block bg-white border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-bold text-slate-600 w-[110px]">CÓDIGO</th>
                    <th className="px-4 py-2 text-left text-[11px] font-bold text-slate-600">PRODUCTO</th>
                    <th className="px-4 py-2 text-right text-[11px] font-bold text-slate-600 w-[64px]">CANT.</th>
                    <th className="px-4 py-2 text-right text-[11px] font-bold text-slate-600 w-[96px]">P. UNIT.</th>
                    <th className="px-4 py-2 text-right text-[11px] font-bold text-slate-600 w-[96px]">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedItems.map((item: QuoteItem, idx) => (
                    <tr key={item.id || `${item.product_code}-${idx}`}>
                      <td className="px-4 py-2 font-mono tabular-nums text-[11px] text-slate-500 truncate">
                        {item.product_code}
                      </td>
                      <td className="px-4 py-2 text-[12px] font-medium text-slate-900 truncate">{item.product_name}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-[12px] text-slate-600">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-[12px] text-slate-600">
                        {formatUSD(item.unit_price_usd || 0)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-[12px] font-bold text-slate-900">
                        {formatUSD((item.unit_price_usd || 0) * (item.quantity || 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-[13px] font-bold text-slate-600">
                      Total Cotizado:
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[15px] font-bold text-slate-900">
                      {formatUSD(baseSubtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Sticky Actions Footer */}
        <div className="px-3.5 py-3 sm:px-6 sm:py-4 border-t border-slate-200 bg-white shrink-0">
          {/* Mobile Actions Layout */}
          <div className="sm:hidden space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={handleWhatsApp}
                disabled={isGeneratingPDF}
                className="bg-[#25D366] text-white hover:bg-[#128C7E] h-9 text-xs gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {isGeneratingPDF ? '...' : 'WhatsApp'}
              </Button>
              <Button
                type="button"
                onClick={handleSendToCart}
                className="bg-blue-600 text-white hover:bg-blue-700 h-9 text-xs gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Al Carrito
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Button
                type="button"
                onClick={() => handleDownloadPDF('usd')}
                disabled={isGeneratingPDF}
                className="bg-emerald-700 text-white hover:bg-emerald-800 h-9 text-[11px] px-2 gap-1"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                {isGeneratingPDF ? '...' : 'PDF USD'}
              </Button>
              <Button
                type="button"
                onClick={() => handleDownloadPDF('bcv')}
                disabled={isGeneratingPDF}
                className="bg-blue-700 text-white hover:bg-blue-800 h-9 text-[11px] px-2 gap-1"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                {isGeneratingPDF ? '...' : 'PDF Bs'}
              </Button>
              <Button
                type="button"
                onClick={() => handleDownloadPDF('both')}
                disabled={isGeneratingPDF}
                className="bg-slate-700 text-white hover:bg-slate-800 h-9 text-[11px] px-2 gap-1"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                {isGeneratingPDF ? '...' : 'Ambos PDF'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                {status !== 'aprobada' && status !== 'anulada' && (
                  <Button
                    type="button"
                    onClick={() => handleUpdateStatus('Aprobada')}
                    disabled={updateQuote.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs px-2.5 gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aprobar
                  </Button>
                )}
                {status !== 'rechazada' && status !== 'anulada' && (
                  <Button
                    type="button"
                    onClick={() => handleUpdateStatus('Rechazada')}
                    disabled={updateQuote.isPending}
                    className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none h-8 text-xs px-2.5 gap-1"
                    variant="outline"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Rechazar
                  </Button>
                )}
                {status !== 'anulada' && status !== 'rechazada' && (
                  <Button
                    type="button"
                    onClick={() => handleUpdateStatus('Anulada')}
                    disabled={updateQuote.isPending}
                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700 border-none h-8 text-xs px-2.5 gap-1"
                    variant="outline"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Anular
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    onClick={() => onDelete(quote)}
                    variant="outline"
                    className="text-red-600 border-red-200/80 hover:bg-red-50 hover:text-red-700 h-8 text-xs px-2 gap-1"
                    title="Eliminar cotización"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-white border-slate-200 hover:bg-slate-50 text-slate-600 h-8 text-xs px-3 shrink-0"
              >
                Cerrar
              </Button>
            </div>
          </div>

          {/* Desktop Actions Layout */}
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-white border-slate-200 hover:bg-slate-50 text-slate-600 shrink-0"
            >
              Cerrar
            </Button>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                onClick={handleSendToCart}
                className="bg-blue-600 text-white hover:bg-blue-700 gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Al Carrito
              </Button>
              <Button
                type="button"
                onClick={() => handleDownloadPDF('usd')}
                disabled={isGeneratingPDF}
                className="bg-emerald-700 text-white hover:bg-emerald-800 gap-2"
              >
                <Download className="w-4 h-4" />
                {isGeneratingPDF ? '...' : 'PDF USD'}
              </Button>
              <Button
                type="button"
                onClick={() => handleDownloadPDF('bcv')}
                disabled={isGeneratingPDF}
                className="bg-blue-700 text-white hover:bg-blue-800 gap-2"
              >
                <Download className="w-4 h-4" />
                {isGeneratingPDF ? '...' : 'PDF Bs'}
              </Button>
              <Button
                type="button"
                onClick={() => handleDownloadPDF('both')}
                disabled={isGeneratingPDF}
                className="bg-slate-700 text-white hover:bg-slate-800 gap-2"
              >
                <Download className="w-4 h-4" />
                {isGeneratingPDF ? '...' : 'Ambos PDF'}
              </Button>
              <Button
                type="button"
                onClick={handleWhatsApp}
                disabled={isGeneratingPDF}
                className="bg-[#25D366] text-white hover:bg-[#128C7E] gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                {isGeneratingPDF ? '...' : 'WhatsApp'}
              </Button>
              <div className="w-px h-6 bg-slate-200 mx-1" />

              {status !== 'anulada' && status !== 'rechazada' && (
                <Button
                  type="button"
                  onClick={() => handleUpdateStatus('Anulada')}
                  disabled={updateQuote.isPending}
                  className="bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700 border-none gap-2"
                  variant="outline"
                >
                  <Ban className="w-4 h-4" />
                  Anular
                </Button>
              )}
              {status !== 'rechazada' && status !== 'anulada' && (
                <Button
                  type="button"
                  onClick={() => handleUpdateStatus('Rechazada')}
                  disabled={updateQuote.isPending}
                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none gap-2"
                  variant="outline"
                >
                  <XCircle className="w-4 h-4" />
                  Rechazar
                </Button>
              )}
              {status !== 'aprobada' && status !== 'anulada' && (
                <Button
                  type="button"
                  onClick={() => handleUpdateStatus('Aprobada')}
                  disabled={updateQuote.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <Check className="w-4 h-4" />
                  Aprobar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
