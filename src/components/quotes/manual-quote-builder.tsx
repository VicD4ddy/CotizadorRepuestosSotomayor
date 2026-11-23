'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileText,
  Plus,
  Minus,
  Trash2,
  Download,
  Save,
  Send,
  RefreshCw,
  User,
  Phone,
  FileEdit,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  Building2,
  RotateCcw,
  Copy,
  ArrowUp,
  ArrowDown,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBcvRate, useBcvMultiplier, useBrands, useCreateQuote } from '@/hooks/use-supabase';
import { generateQuotePDF } from '@/lib/generate-quote-pdf';
import { copyQuoteToClipboard } from '@/lib/capture-quote';
import { cn, formatUSD, calculateBcvPrice } from '@/lib/utils';
import { getRandomWhatsAppPhrase } from '@/lib/whatsapp-phrases';
import { toast } from 'sonner';
import { Quote, DocumentType } from '@/types';

interface ManualItem {
  id: string;
  name: string;
  brand: string;
  quantity: number;
  price_usd: number;
}

const DRAFT_STORAGE_KEY = 'sotomayor_manual_quote_draft_v1';

function createItemId(): string {
  return `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createEmptyManualItem(): ManualItem {
  return { id: createItemId(), name: '', brand: '', quantity: 1, price_usd: 0 };
}

function createDefaultItems(): ManualItem[] {
  return [createEmptyManualItem(), createEmptyManualItem()];
}

function pickRandomPhrase(): string {
  return getRandomWhatsAppPhrase();
}

function normalizeVePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `58${digits.slice(1)}`;
  }
  return digits;
}

function formatStoredClientName(docType: DocumentType, clientName: string, clientIdNumber: string): string {
  const baseName = clientName.trim() || 'Cliente General';
  const idSuffix = clientIdNumber.trim() ? ` (C.I./RIF: ${clientIdNumber.trim()})` : '';
  return docType !== 'Cotización' ? `[${docType}] ${baseName}${idSuffix}` : `${baseName}${idSuffix}`;
}

export function ManualQuoteBuilder() {
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();
  const { data: brands = [] } = useBrands();
  const createQuote = useCreateQuote();

  // Form states
  const [documentType, setDocumentType] = useState<DocumentType>('Cotización');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientIdNumber, setClientIdNumber] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState<'both' | 'usd' | 'bcv'>('both');
  const [items, setItems] = useState<ManualItem[]>(() => createDefaultItems());

  // Layout & UX states
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [showDesktopPreview, setShowDesktopPreview] = useState(true);
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');
  const [isXlViewport, setIsXlViewport] = useState(true);
  const [draftSaved, setDraftSaved] = useState(false);

  // PDF preview & submission states
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const previousUrlRef = useRef<string | null>(null);
  const hasHydratedRef = useRef(false);

  // Detectar si estamos en escritorio XL (>= 1280px) para evitar generar PDF oculto innecesariamente
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const sync = () => setIsXlViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Hidratar borrador guardado en localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.documentType) setDocumentType(parsed.documentType);
        if (typeof parsed.clientName === 'string') setClientName(parsed.clientName);
        if (typeof parsed.clientPhone === 'string') setClientPhone(parsed.clientPhone);
        if (typeof parsed.clientIdNumber === 'string') setClientIdNumber(parsed.clientIdNumber);
        if (typeof parsed.clientAddress === 'string') setClientAddress(parsed.clientAddress);
        if (typeof parsed.notes === 'string') setNotes(parsed.notes);
        if (parsed.currency === 'both' || parsed.currency === 'usd' || parsed.currency === 'bcv') {
          setCurrency(parsed.currency);
        }
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          setItems(
            parsed.items.map((it: any) => ({
              id: typeof it.id === 'string' ? it.id : createItemId(),
              name: typeof it.name === 'string' ? it.name : '',
              brand: typeof it.brand === 'string' ? it.brand : '',
              quantity: Math.max(0, Number(it.quantity) || 1),
              price_usd: Math.max(0, Number(it.price_usd) || 0),
            }))
          );
        }
        const shouldOpenExtra =
          Boolean(parsed.clientIdNumber?.trim()) ||
          Boolean(parsed.clientAddress?.trim()) ||
          Boolean(parsed.notes?.trim()) ||
          parsed.documentType === 'Nota de Entrega' ||
          parsed.documentType === 'Orden de Despacho';
        if (shouldOpenExtra) {
          setShowExtraFields(true);
        }
        setDraftSaved(true);
      }
    } catch (err) {
      console.warn('Error leyendo borrador de cotización manual:', err);
    } finally {
      hasHydratedRef.current = true;
    }
  }, []);

  // Persistir borrador automáticamente tras hidratar
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    const hasContent =
      clientName.trim() !== '' ||
      clientPhone.trim() !== '' ||
      clientIdNumber.trim() !== '' ||
      clientAddress.trim() !== '' ||
      notes.trim() !== '' ||
      items.some((it) => it.name.trim() !== '' || it.brand.trim() !== '' || it.price_usd > 0);

    try {
      if (!hasContent) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraftSaved(false);
        return;
      }
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          documentType,
          clientName,
          clientPhone,
          clientIdNumber,
          clientAddress,
          notes,
          currency,
          items,
        })
      );
      setDraftSaved(true);
    } catch {
      // Silenciar si localStorage está lleno o restringido
    }
  }, [documentType, clientName, clientPhone, clientIdNumber, clientAddress, notes, currency, items]);

  // Limpiar blob URL al desmontar
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, []);

  // Abrir automáticamente datos adicionales cuando el documento suele requerir C.I./RIF o dirección
  const handleDocumentTypeChange = (nextType: DocumentType) => {
    setDocumentType(nextType);
    if (nextType === 'Nota de Entrega' || nextType === 'Orden de Despacho') {
      setShowExtraFields(true);
    }
  };

  // Totales calculados
  const subtotalUsd = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price_usd) || 0), 0),
    [items]
  );

  const totalUsdBcv = useMemo(() => {
    if (currency === 'usd') return subtotalUsd;
    return items.reduce((sum, item) => {
      const unit = calculateBcvPrice(Number(item.price_usd) || 0, bcvMultiplier, item.name);
      return sum + (Number(item.quantity) || 0) * unit;
    }, 0);
  }, [items, subtotalUsd, currency, bcvMultiplier]);

  const totalBs = useMemo(() => totalUsdBcv * bcvRate, [totalUsdBcv, bcvRate]);

  const extraFieldsCount = useMemo(
    () => [clientIdNumber, clientAddress, notes].filter((v) => v.trim() !== '').length,
    [clientIdNumber, clientAddress, notes]
  );

  const validFilledItems = useMemo(
    () => items.filter((it) => it.name.trim() !== ''),
    [items]
  );

  // Construye los items formateados para PDF, captura o guardado en BD
  const buildQuoteItemsPayload = useCallback(
    (sourceItems: ManualItem[]) =>
      sourceItems.map((it, idx) => {
        const foundBrand = brands.find(
          (b) => b.name.toLowerCase() === it.brand.trim().toLowerCase()
        );
        return {
          id: it.id,
          product_id: null,
          product_name: it.name.trim() || `Repuesto #${idx + 1}`,
          product_code: `MAN-${idx + 1}`,
          quantity: Math.max(1, Number(it.quantity) || 1),
          unit_price_usd: Number(it.price_usd) || 0,
          brand_name: it.brand.trim(),
          brand_logo_url: foundBrand?.logo_url || '',
        };
      }),
    [brands]
  );

  // Objeto Quote actual para PDF y portapapeles
  const currentQuoteObj: Quote = useMemo(() => {
    const activeItems = items.filter((it) => it.name.trim() !== '' || it.price_usd > 0);
    const quoteItems =
      activeItems.length > 0
        ? buildQuoteItemsPayload(activeItems)
        : [
            {
              id: 'preview',
              product_id: null,
              product_name: 'Ejemplo: Repuesto Proveedor',
              product_code: 'MAN-01',
              quantity: 1,
              unit_price_usd: 0,
              brand_name: 'Original',
              brand_logo_url: '',
            },
          ];

    return {
      id: 'MAN-' + Date.now().toString(36).toUpperCase().slice(-6),
      client_name: clientName.trim() || 'Cliente General',
      client_phone: clientPhone.trim() || '',
      client_id_number: clientIdNumber.trim(),
      client_address: clientAddress.trim(),
      document_type: documentType,
      total_usd: subtotalUsd,
      bcv_rate: bcvRate,
      status: 'borrador',
      notes: notes.trim(),
      created_at: new Date().toISOString(),
      quote_items: quoteItems,
    };
  }, [
    clientName,
    clientPhone,
    clientIdNumber,
    clientAddress,
    documentType,
    notes,
    items,
    subtotalUsd,
    bcvRate,
    buildQuoteItemsPayload,
  ]);

  const isPreviewVisible = isXlViewport ? showDesktopPreview : mobileView === 'preview';

  // Generar vista previa PDF en vivo únicamente cuando el panel preview está visible
  useEffect(() => {
    if (!isPreviewVisible) return;

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsGeneratingPdf(true);
      try {
        const res = await generateQuotePDF({
          quote: currentQuoteObj,
          currency,
          bcvMultiplier,
          bcvRate,
          documentType,
          returnBlob: true,
        });

        if (!isCancelled && res.blob) {
          const newUrl = URL.createObjectURL(res.blob);
          if (previousUrlRef.current) {
            URL.revokeObjectURL(previousUrlRef.current);
          }
          previousUrlRef.current = newUrl;
          setPdfBlobUrl(newUrl);
        }
      } catch (err) {
        console.error('Error generating preview PDF:', err);
      } finally {
        if (!isCancelled) {
          setIsGeneratingPdf(false);
        }
      }
    }, 450);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isPreviewVisible, currentQuoteObj, currency, bcvMultiplier, bcvRate, documentType]);

  // Enfocar descripción visible por ID de fila (compatible móvil/escritorio)
  const focusItemDescription = (targetId: string) => {
    requestAnimationFrame(() => {
      const candidates = document.querySelectorAll<HTMLInputElement>(
        `[data-manual-desc="${targetId}"]`
      );
      candidates.forEach((input) => {
        if (input.offsetParent !== null) {
          input.focus();
        }
      });
    });
  };

  // Acciones sobre líneas de repuestos
  const handleAddItem = (autoFocus = false) => {
    const nextItem = createEmptyManualItem();
    setItems((prev) => [...prev, nextItem]);
    if (autoFocus) {
      focusItemDescription(nextItem.id);
    }
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setItems([createEmptyManualItem()]);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDuplicateItem = (index: number) => {
    setItems((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const clone: ManualItem = { ...source, id: createItemId() };
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
  };

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleUpdateItem = (id: string, field: keyof ManualItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (index === items.length - 1) {
      handleAddItem(true);
    } else {
      const nextItem = items[index + 1];
      if (nextItem) focusItemDescription(nextItem.id);
    }
  };

  const clearDraftStorage = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setDraftSaved(false);
  };

  const handleClear = () => {
    clearDraftStorage();
    setDocumentType('Cotización');
    setClientName('');
    setClientPhone('');
    setClientIdNumber('');
    setClientAddress('');
    setNotes('');
    setCurrency('both');
    setShowExtraFields(false);
    setItems(createDefaultItems());
    toast.info('Formulario limpiado');
  };

  const triggerPdfBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Descargar PDF + copiar imagen PNG al portapapeles
  const handleDownloadPDF = async () => {
    if (validFilledItems.length === 0) {
      toast.error('Agrega al menos un repuesto con descripción antes de exportar el PDF');
      return;
    }

    setIsExporting(true);
    const randomPhrase = pickRandomPhrase();
    try {
      try {
        await copyQuoteToClipboard(currentQuoteObj, bcvMultiplier, bcvRate, randomPhrase, currency);
      } catch (clipErr) {
        console.warn('No se pudo copiar la imagen al portapapeles:', clipErr);
      }

      await generateQuotePDF({
        quote: currentQuoteObj,
        currency,
        bcvMultiplier,
        bcvRate,
        documentType,
        randomPhrase,
      });

      toast.success('PDF descargado e imagen copiada al portapapeles');
    } catch (err: any) {
      toast.error('Error al generar PDF', { description: err?.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Guardar en Base de Datos y limpiar borrador
  const handleSaveToDatabase = async () => {
    if (validFilledItems.length === 0) {
      toast.error('Agrega al menos un repuesto para guardar la cotización');
      return;
    }

    setIsSaving(true);
    try {
      const formattedClientName = formatStoredClientName(documentType, clientName, clientIdNumber);
      const quoteItemsPayload = buildQuoteItemsPayload(validFilledItems).map(({ id: _id, ...rest }) => rest);

      await createQuote.mutateAsync({
        quote: {
          client_name: formattedClientName,
          client_phone: clientPhone.trim() || '',
          total_usd: subtotalUsd,
          bcv_rate: bcvRate,
          status: 'Cotizada',
        },
        items: quoteItemsPayload,
      });

      clearDraftStorage();
      toast.success(`¡${documentType} guardada en el historial!`);
    } catch (err: any) {
      toast.error('Error al guardar cotización', { description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Flujo unificado WhatsApp: Copiar PNG -> Descargar PDF -> Abrir WhatsApp (58...) -> Registrar en historial
  const handleSendWhatsApp = async () => {
    if (validFilledItems.length === 0) {
      toast.error('Agrega repuestos antes de enviar por WhatsApp');
      return;
    }

    setIsExporting(true);
    const randomPhrase = pickRandomPhrase();

    try {
      // 1. Copiar imagen al portapapeles primero mientras el documento tiene foco
      let imageCopied = false;
      try {
        await copyQuoteToClipboard(currentQuoteObj, bcvMultiplier, bcvRate, randomPhrase, currency);
        imageCopied = true;
      } catch (clipErr) {
        console.warn('No se pudo copiar imagen al portapapeles:', clipErr);
      }

      // 2. Generar y descargar el PDF
      const { blob, fileName } = await generateQuotePDF({
        quote: currentQuoteObj,
        currency,
        bcvMultiplier,
        bcvRate,
        documentType,
        randomPhrase,
        returnBlob: true,
      });
      if (blob) {
        triggerPdfBlobDownload(blob, fileName);
      }

      // 3. Armar texto de WhatsApp respetando la modalidad seleccionada
      const modeLabel =
        currency === 'usd'
          ? 'DIVISAS (USD)'
          : currency === 'bcv'
          ? 'BOLÍVARES (TASA BCV)'
          : 'DIVISAS Y BOLÍVARES';

      let text = `*REPUESTOS SOTOMAYOR*\n_${documentType} en *${modeLabel}*_\n\n`;
      if (clientName.trim()) text += `*Cliente:* ${clientName.trim()}\n`;
      if (clientIdNumber.trim()) text += `*C.I./RIF:* ${clientIdNumber.trim()}\n`;
      if (clientPhone.trim()) text += `*Teléfono:* ${clientPhone.trim()}\n`;
      if (clientAddress.trim()) text += `*Dirección:* ${clientAddress.trim()}\n`;
      text += `*Fecha:* ${new Date().toLocaleDateString('es-VE')}\n\n`;
      text += `*Detalle:*\n`;

      validFilledItems.forEach((it) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitUsd = Number(it.price_usd) || 0;
        const unitBcv = calculateBcvPrice(unitUsd, bcvMultiplier, it.name);
        const lineUsd = unitUsd * qty;
        const lineBs = unitBcv * qty * bcvRate;
        const brandSuffix = it.brand.trim() ? ` (${it.brand.trim().toUpperCase()})` : '';

        if (currency === 'usd') {
          text += `- ${qty}x ${it.name.trim().toUpperCase()}${brandSuffix}\n  Unit: ${formatUSD(unitUsd)} | Total: ${formatUSD(lineUsd)}\n`;
        } else if (currency === 'bcv') {
          text += `- ${qty}x ${it.name.trim().toUpperCase()}${brandSuffix}\n  Ref BCV: ${formatUSD(unitBcv * qty)} | Bs: Bs ${lineBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        } else {
          text += `- ${qty}x ${it.name.trim().toUpperCase()}${brandSuffix}\n  Divisas: ${formatUSD(lineUsd)} | Bs: Bs ${lineBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }
      });

      if (currency !== 'bcv') {
        text += `\n*Total Divisas ($):* ${formatUSD(subtotalUsd)}`;
      }
      if (currency !== 'usd') {
        text += `\n*Ref. USD BCV:* ${formatUSD(totalUsdBcv)}`;
        text += `\n*Total Bs:* Bs ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        text += `\n*Tasa BCV:* Bs ${bcvRate.toFixed(2)}`;
      }
      text += `\n\n_${randomPhrase}_`;

      const normalizedPhone = normalizeVePhone(clientPhone);
      const waUrl = normalizedPhone
        ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;

      window.open(waUrl, '_blank');

      // 4. Registrar en historial
      const formattedClientName = formatStoredClientName(documentType, clientName, clientIdNumber);
      const quoteItemsPayload = buildQuoteItemsPayload(validFilledItems).map(({ id: _id, ...rest }) => rest);

      await createQuote.mutateAsync({
        quote: {
          client_name: formattedClientName,
          client_phone: clientPhone.trim() || '',
          total_usd: subtotalUsd,
          bcv_rate: bcvRate,
          status: 'Enviada por WhatsApp',
        },
        items: quoteItemsPayload,
      });

      toast.success(
        imageCopied
          ? 'Imagen copiada, PDF descargado y cotización registrada. Pega la imagen (Ctrl+V) en WhatsApp.'
          : 'PDF descargado y cotización registrada en el historial.'
      );
    } catch (err: any) {
      toast.error('Error al enviar por WhatsApp', { description: err?.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 min-w-0">
      {/* Top Action & Document Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 md:px-4 md:py-3 bg-white border-b border-slate-200 rounded-t-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-sm bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 shrink-0">
            <FileEdit className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[14px] md:text-[15px] font-bold text-slate-900 leading-tight">
                Cotiz. Manual
              </h1>
              <div className="relative inline-flex items-center">
                <select
                  value={documentType}
                  onChange={(e) => handleDocumentTypeChange(e.target.value as DocumentType)}
                  className="h-7 pl-2.5 pr-7 text-[11.5px] font-bold bg-[#0F172A] text-white rounded-sm border border-slate-700 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none transition-colors"
                >
                  <option value="Cotización">Cotización</option>
                  <option value="Nota de Entrega">Nota de Entrega</option>
                  <option value="Presupuesto">Presupuesto</option>
                  <option value="Orden de Despacho">Orden de Despacho</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 text-slate-400 pointer-events-none" />
              </div>
              {draftSaved && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono tabular-nums font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Borrador guardado
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block mt-0.5">
              Cotizaciones personalizadas fuera de catálogo · Autoguardado local activado
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDesktopPreview((v) => !v)}
            className="hidden xl:inline-flex h-8 px-2.5 text-[11.5px] text-slate-700 border-slate-200 hover:bg-slate-100 rounded-sm"
            title={showDesktopPreview ? 'Ocultar vista previa PDF para ampliar formulario' : 'Mostrar vista previa PDF'}
          >
            {showDesktopPreview ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Ocultar PDF
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Mostrar PDF
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="h-8 px-2.5 text-[11.5px] text-slate-600 hover:text-slate-900 border-slate-200 rounded-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Limpiar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSendWhatsApp}
            disabled={isExporting}
            className="h-8 px-2.5 text-[11.5px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 font-bold rounded-sm"
          >
            <Send className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            WhatsApp
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="h-8 px-3 bg-[#0F172A] hover:bg-slate-800 text-white text-[11.5px] font-semibold rounded-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            PDF
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-bold rounded-sm"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Mobile/Tablet View Mode Switch (< xl) */}
      <div className="xl:hidden px-3 pt-2.5 pb-1 bg-slate-50 border-b border-slate-200/70 shrink-0">
        <div className="flex p-0.5 bg-slate-200/70 rounded-sm border border-slate-200">
          <button
            type="button"
            onClick={() => setMobileView('form')}
            className={cn(
              'flex-1 py-1.5 text-[11.5px] font-bold rounded-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
              mobileView === 'form' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            )}
          >
            <FileEdit className="w-3.5 h-3.5" />
            Formulario ({validFilledItems.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileView('preview')}
            className={cn(
              'flex-1 py-1.5 text-[11.5px] font-bold rounded-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
              mobileView === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            )}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            Vista Previa PDF
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 p-3 md:p-4 overflow-auto min-w-0 pb-[140px] lg:pb-4">
        {/* Left: Form Builder */}
        <div
          className={cn(
            'flex flex-col gap-3 min-w-0',
            showDesktopPreview ? 'xl:col-span-7' : 'xl:col-span-12',
            mobileView === 'preview' && 'hidden xl:flex'
          )}
        >
          {/* Compact Client & Currency Card */}
          <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[11.5px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                Cliente y Moneda
              </h2>

              <button
                type="button"
                onClick={() => setShowExtraFields((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-sm transition-colors cursor-pointer"
              >
                {showExtraFields ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Datos adicionales / Notas</span>
                {extraFieldsCount > 0 && (
                  <span className="font-mono tabular-nums text-[10px] font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-800">
                    {extraFieldsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Always visible compact 2-col row: Nombre & Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre del Cliente (Ej. Taller Hermanos)"
                  className="w-full h-8 pl-8 pr-2.5 text-[12px] bg-slate-50 border border-slate-200 rounded-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>

              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Teléfono / WhatsApp (Ej. 04141234567)"
                  className="w-full h-8 pl-8 pr-2.5 text-[12px] font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Collapsible Extra Fields: C.I./RIF, Dirección & Notas Internas */}
            {showExtraFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-100">
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={clientIdNumber}
                    onChange={(e) => setClientIdNumber(e.target.value)}
                    placeholder="C.I. / RIF (Ej. V-12345678 / J-12345678-0)"
                    className="w-full h-8 pl-8 pr-2.5 text-[12px] font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Dirección (Opcional)"
                    className="w-full h-8 pl-8 pr-2.5 text-[12px] bg-slate-50 border border-slate-200 rounded-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-500" />
                      Notas Internas del Vendedor
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                      <EyeOff className="w-3 h-3 text-amber-600" />
                      No sale en el PDF
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Proveedor: El Trébol (0412-1234567) | Costo: $18 | Entrega 48h..."
                    rows={2}
                    className="w-full p-2 text-[12px] bg-slate-50 border border-slate-200 rounded-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium resize-none"
                  />
                </div>
              </div>
            )}

            {/* Currency Format & Rate Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-600">Formato PDF:</span>
                <div className="flex rounded-sm bg-slate-100 p-0.5 border border-slate-200">
                  {(
                    [
                      { id: 'both', label: 'Combinado ($ y Bs)' },
                      { id: 'usd', label: 'Solo USD ($)' },
                      { id: 'bcv', label: 'Solo BCV (Bs)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCurrency(opt.id)}
                      className={cn(
                        'px-2 py-1 text-[11px] font-bold rounded-sm transition-colors cursor-pointer',
                        currency === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11.5px]">
                <span className="text-slate-500 font-medium">Tasa BCV:</span>
                <span className="font-bold font-mono tabular-nums text-slate-900 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                  Bs {bcvRate.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Items Builder Card */}
          <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                <h2 className="text-[12px] font-bold text-slate-800 uppercase tracking-wider">
                  Repuestos a Cotizar
                </h2>
                <span className="text-[10.5px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                  {items.length}
                </span>
              </div>

              <Button
                type="button"
                onClick={() => handleAddItem(true)}
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-bold px-3 rounded-sm shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Añadir Repuesto
              </Button>
            </div>

            {/* Mobile Stacked Cards (< md) */}
            <div className="md:hidden space-y-2">
              {items.map((item, index) => {
                const rowTotal = (Number(item.quantity) || 0) * (Number(item.price_usd) || 0);
                return (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-sm space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono tabular-nums font-bold text-slate-500">
                        #{index + 1}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveItem(index, -1)}
                          disabled={index === 0}
                          className="w-6 h-6 rounded-sm border border-slate-200 bg-white flex items-center justify-center text-slate-500 disabled:opacity-30"
                          title="Subir fila"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveItem(index, 1)}
                          disabled={index === items.length - 1}
                          className="w-6 h-6 rounded-sm border border-slate-200 bg-white flex items-center justify-center text-slate-500 disabled:opacity-30"
                          title="Bajar fila"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(index)}
                          className="w-6 h-6 rounded-sm border border-slate-200 bg-white flex items-center justify-center text-slate-600"
                          title="Duplicar fila"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-6 h-6 rounded-sm border border-red-200 bg-red-50 flex items-center justify-center text-red-600"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      data-manual-desc={item.id}
                      value={item.name}
                      onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                      placeholder="Descripción del repuesto (Ej. Correa de tiempo)"
                      className="w-full h-8 px-2.5 text-[12px] font-medium text-slate-900 border border-slate-200 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />

                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          list="brands-list"
                          value={item.brand}
                          onChange={(e) => handleUpdateItem(item.id, 'brand', e.target.value)}
                          placeholder="Marca"
                          className="w-full h-8 px-2 text-[11.5px] font-medium text-slate-800 border border-slate-200 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="col-span-3 flex items-center border border-slate-200 bg-white rounded-sm overflow-hidden h-8">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateItem(item.id, 'quantity', Math.max(1, (item.quantity || 1) - 1))
                          }
                          className="w-6 h-full flex items-center justify-center text-slate-600 active:bg-slate-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                          }
                          className="w-full text-center text-[11.5px] font-bold font-mono tabular-nums text-slate-900 focus:outline-none bg-transparent"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateItem(item.id, 'quantity', (item.quantity || 0) + 1)
                          }
                          className="w-6 h-full flex items-center justify-center text-slate-600 active:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="col-span-4 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-mono font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price_usd === 0 ? '' : item.price_usd}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'price_usd', parseFloat(e.target.value) || 0)
                          }
                          onKeyDown={(e) => handlePriceKeyDown(e, index)}
                          placeholder="0.00"
                          className="w-full h-8 pl-5 pr-1.5 text-right text-[12px] font-bold font-mono tabular-nums text-slate-900 border border-slate-200 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end text-[11px] font-mono tabular-nums font-bold text-slate-700 pt-0.5">
                      Total línea: <span className="text-slate-900 ml-1">{formatUSD(rowTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Wide Table (md+) */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2 px-2 w-8 text-center">#</th>
                    <th className="py-2 px-2 w-16 text-center">Cant.</th>
                    <th className="py-2 px-2">Descripción del Repuesto</th>
                    <th className="py-2 px-2 w-28">Marca</th>
                    <th className="py-2 px-2 w-24 text-right">Precio ($)</th>
                    <th className="py-2 px-2 w-20 text-right">Total ($)</th>
                    <th className="py-2 px-2 w-[92px] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, index) => {
                    const rowTotal = (Number(item.quantity) || 0) * (Number(item.price_usd) || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="py-1.5 px-2 text-center text-slate-400 font-mono tabular-nums font-bold text-[11px]">
                          {index + 1}
                        </td>

                        <td className="py-1.5 px-1.5">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                            }
                            className="w-full h-8 text-center text-xs font-bold font-mono tabular-nums border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
                          />
                        </td>

                        <td className="py-1.5 px-1.5">
                          <input
                            type="text"
                            data-manual-desc={item.id}
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            placeholder="Ej. Correa de Tiempo / Amortiguador Delantero"
                            className="w-full h-8 px-2.5 text-xs font-medium text-slate-900 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 placeholder:text-slate-400"
                          />
                        </td>

                        <td className="py-1.5 px-1.5">
                          <input
                            type="text"
                            list="brands-list"
                            value={item.brand}
                            onChange={(e) => handleUpdateItem(item.id, 'brand', e.target.value)}
                            placeholder="Marca"
                            className="w-full h-8 px-2 text-xs font-medium text-slate-800 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 placeholder:text-slate-400"
                          />
                        </td>

                        <td className="py-1.5 px-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-mono font-bold">
                              $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price_usd === 0 ? '' : item.price_usd}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'price_usd', parseFloat(e.target.value) || 0)
                              }
                              onKeyDown={(e) => handlePriceKeyDown(e, index)}
                              placeholder="0.00"
                              title="Presiona Enter para pasar a la siguiente línea"
                              className="w-full h-8 pl-5 pr-2 text-right text-xs font-bold font-mono tabular-nums text-slate-900 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
                            />
                          </div>
                        </td>

                        <td className="py-1.5 px-2 text-right font-extrabold font-mono tabular-nums text-slate-900 text-xs">
                          {formatUSD(rowTotal)}
                        </td>

                        <td className="py-1.5 px-1.5 text-center">
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveItem(index, -1)}
                              disabled={index === 0}
                              className="w-6 h-7 inline-flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                              title="Subir"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(index, 1)}
                              disabled={index === items.length - 1}
                              className="w-6 h-7 inline-flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                              title="Bajar"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateItem(index)}
                              className="w-6 h-7 inline-flex items-center justify-center rounded-sm text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                              title="Duplicar línea"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="w-6 h-7 inline-flex items-center justify-center rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Autocompletado de marcas */}
            <datalist id="brands-list">
              {brands.map((b) => (
                <option key={b.id} value={b.name} />
              ))}
            </datalist>

            {/* Quick add button + keyboard hint */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddItem(true)}
                className="flex-1 py-2 border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-sm text-slate-600 hover:text-emerald-700 text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir otra línea (o presiona <kbd className="font-mono text-[10px] bg-slate-100 border border-slate-200 px-1 rounded-sm">Enter</kbd> en Precio)
              </button>
            </div>

            {/* Totals Summary Banner */}
            <div className="mt-4 p-3.5 bg-[#0F172A] text-white rounded-md border border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="text-center sm:text-left border-b sm:border-b-0 sm:border-r border-slate-800 pb-2 sm:pb-0 sm:pr-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Subtotal Divisas ($)
                  </span>
                  <span className="text-lg md:text-xl font-extrabold font-mono tabular-nums text-white">
                    {formatUSD(subtotalUsd)}
                  </span>
                </div>

                <div className="text-center sm:text-left border-b sm:border-b-0 sm:border-r border-slate-800 pb-2 sm:pb-0 sm:pr-3">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider font-mono tabular-nums">
                    Total USD (BCV × {bcvMultiplier})
                  </span>
                  <span className="text-lg md:text-xl font-extrabold font-mono tabular-nums text-emerald-400">
                    {formatUSD(totalUsdBcv)}
                  </span>
                </div>

                <div className="text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">
                    Total en Bolívares
                  </span>
                  <span className="text-lg md:text-xl font-extrabold font-mono tabular-nums text-sky-400">
                    Bs {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live PDF Preview (collapsible on XL, tab-switched on < XL) */}
        {(showDesktopPreview || mobileView === 'preview') && (
          <div
            className={cn(
              'xl:col-span-5 flex flex-col bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden min-h-[560px] min-w-0',
              !showDesktopPreview && 'xl:hidden',
              mobileView === 'form' && 'hidden xl:flex'
            )}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#0F172A] text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-[11.5px] font-bold tracking-wide uppercase">
                  Vista Previa del PDF en Vivo
                </span>
              </div>

              {isGeneratingPdf ? (
                <span className="inline-flex items-center gap-1.5 text-[10.5px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-sm border border-emerald-800/60 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Actualizando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Al día
                </span>
              )}
            </div>

            <div className="flex-1 bg-slate-800 relative flex items-center justify-center p-2 min-h-[500px]">
              {pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  title="Vista previa de Cotización"
                  className="w-full h-full min-h-[560px] rounded-sm border border-slate-700 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-8 text-center">
                  <RefreshCw className="w-7 h-7 animate-spin text-emerald-500 opacity-60" />
                  <p className="text-xs font-semibold text-slate-300">
                    Generando documento...
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-[220px]">
                    Escribe los datos del cliente y los repuestos para visualizar el PDF
                  </p>
                </div>
              )}
            </div>

            <div className="px-3.5 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px]">Formato institucional A4</span>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar este PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
