import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Quote, QuoteItem } from '@/types';
import { useUpdateQuote, useBcvMultiplier } from '@/hooks/use-supabase';
import { formatUSD } from '@/lib/utils';
import { toast } from 'sonner';
import { Calendar, User, Phone, CheckCircle, XCircle, FileText, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { generateQuotePDF } from '@/lib/generate-quote-pdf';

interface QuoteDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
}

export function QuoteDetailsDialog({ open, onOpenChange, quote }: QuoteDetailsDialogProps) {
  const updateQuote = useUpdateQuote();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  if (!quote) return null;

  const date = new Date(quote.created_at || '').toLocaleDateString('es-VE', { 
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const handleUpdateStatus = async (status: string) => {
    try {
      await updateQuote.mutateAsync({ id: quote.id, status });
      toast.success(`Cotización marcada como ${status}`);
      onOpenChange(false);
    } catch {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleWhatsApp = async () => {
    if (!quote) return;
    setIsGeneratingPDF(true);
    
    try {
      const { blob, fileName } = await generateQuotePDF({ quote, currency: 'usd', bcvMultiplier, returnBlob: true });

      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          toast.success('PDF compartido exitosamente');
          return;
        }
      }

      // Fallback: download PDF and open WhatsApp with text
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      let message = `*COTIZACIÓN - Repuestos Sotomayor*\n`;
      message += `💵 Cotización en *DIVISAS (USD)*\n`;
      message += `*Cliente:* ${quote.client_name || 'Mostrador'}\n`;
      message += `*Fecha:* ${date}\n\n`;
      message += `*Detalle:*\n`;
      quote.quote_items?.forEach((item) => {
        const brandSuffix = item.brand_name ? ` (${item.brand_name})` : '';
        message += `- ${item.quantity}x ${item.product_name}${brandSuffix} — $${(item.unit_price_usd || 0).toFixed(2)}\n`;
      });
      message += `\n*TOTAL USD:* $${quote.total_usd.toFixed(2)}\n`;
      message += `*TOTAL BS:* Bs ${(quote.total_usd * quote.bcv_rate).toFixed(2)}\n\n`;
      message += `_📎 El PDF fue descargado. Adjúntalo a este chat._`;

      const encodedMessage = encodeURIComponent(message);
      let whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
      if (quote.client_phone) {
        const cleanPhone = quote.client_phone.replace(/\D/g, '');
        if (cleanPhone) {
          whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
        }
      }
      window.open(whatsappUrl, '_blank');
      toast.success('PDF descargado. Adjúntalo en WhatsApp.');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error('Error al compartir');
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadPDF = async (currency: 'usd' | 'bcv') => {
    if (!quote) return;
    setIsGeneratingPDF(true);
    
    try {
      await generateQuotePDF({ quote, currency, bcvMultiplier });
      toast.success(`PDF en ${currency === 'bcv' ? 'Bolívares' : 'USD'} generado`);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const status = quote.status?.toLowerCase() || 'cotizada';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-slate-50 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              Detalle de Cotización
              <Badge 
                variant="secondary" 
                className={`
                  text-[10px] font-bold uppercase tracking-widest border-none px-2 py-1 rounded
                  ${status === 'cotizada' ? 'bg-blue-100 text-blue-700' : ''}
                  ${status === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : ''}
                  ${status === 'rechazada' ? 'bg-red-100 text-red-700' : ''}
                  ${status === 'anulada' ? 'bg-slate-200 text-slate-700' : ''}
                `}
              >
                {status}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <User className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-slate-900">{quote.client_name || 'Sin especificar'}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{quote.client_phone || 'Sin teléfono'}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{date}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <span className="text-slate-400 font-bold">Tasa BCV:</span>
                <span>Bs {quote.bcv_rate?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              Productos Cotizados
            </h4>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-bold text-slate-600 w-[100px]">CÓDIGO</th>
                    <th className="px-4 py-2 text-left text-[11px] font-bold text-slate-600">PRODUCTO</th>
                    <th className="px-4 py-2 text-right text-[11px] font-bold text-slate-600 w-[60px]">CANT.</th>
                    <th className="px-4 py-2 text-right text-[11px] font-bold text-slate-600 w-[90px]">P. UNIT.</th>
                    <th className="px-4 py-2 text-right text-[11px] font-bold text-slate-600 w-[90px]">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.quote_items?.map((item: QuoteItem) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-500 truncate">{item.product_code}</td>
                      <td className="px-4 py-2 text-[12px] font-medium text-slate-900 truncate">{item.product_name}</td>
                      <td className="px-4 py-2 text-right text-[12px] text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-2 text-right text-[12px] text-slate-600">
                        {formatUSD(item.unit_price_usd || 0)}
                      </td>
                      <td className="px-4 py-2 text-right text-[12px] font-bold text-slate-900">
                        {formatUSD((item.unit_price_usd || 0) * (item.quantity || 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-[13px] font-bold text-slate-600">Total Cotizado:</td>
                    <td className="px-4 py-3 text-right text-[15px] font-bold text-slate-900">
                      {formatUSD(quote.total_usd || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex justify-between gap-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              Cerrar
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => handleDownloadPDF('usd')}
                disabled={isGeneratingPDF}
                className="bg-emerald-700 text-white hover:bg-emerald-800 gap-2"
              >
                <FileText className="w-4 h-4" />
                {isGeneratingPDF ? '...' : 'PDF USD'}
              </Button>
              <Button
                type="button"
                onClick={() => handleDownloadPDF('bcv')}
                disabled={isGeneratingPDF}
                className="bg-blue-700 text-white hover:bg-blue-800 gap-2"
              >
                <FileText className="w-4 h-4" />
                {isGeneratingPDF ? '...' : 'PDF Bs'}
              </Button>
              <Button
                type="button"
                onClick={handleWhatsApp}
                className="bg-[#25D366] text-white hover:bg-[#128C7E] gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
              <div className="w-px h-full bg-slate-200 mx-1"></div>
              
              {status !== 'anulada' && status !== 'rechazada' && (
                <Button
                  type="button"
                  onClick={() => handleUpdateStatus('Anulada')}
                  className="bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700 border-none gap-2"
                  variant="outline"
                >
                  <XCircle className="w-4 h-4" />
                  Anular
                </Button>
              )}
              {status !== 'rechazada' && status !== 'anulada' && (
                <Button
                  type="button"
                  onClick={() => handleUpdateStatus('Rechazada')}
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprobar Venta
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
