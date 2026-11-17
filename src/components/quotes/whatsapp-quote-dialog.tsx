'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Fuse from 'fuse.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useProducts } from '@/hooks/use-supabase';
import { useCartStore } from '@/store/cart-store';
import { Product } from '@/types';
import { cn, formatUSD } from '@/lib/utils';
import { toast } from 'sonner';
import {
  MessageSquareText,
  ImagePlus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  Trash2,
  Search,
  CopyPlus,
  ArrowLeft,
  User,
  Phone,
  X,
  Loader2,
} from 'lucide-react';

export interface ParsedWhatsAppItem {
  raw_request: string;
  part_name: string;
  vehicle: string;
  spec: string;
  sku_hint: string;
  search_terms: string[];
  quantity: number;
}

interface ReviewCandidate {
  product: Product;
  score: number;
}

type MatchStatus = 'in_stock' | 'out_of_stock' | 'not_found';

interface ReviewRow {
  rowId: string;
  groupId: string;
  parsed: ParsedWhatsAppItem;
  candidates: ReviewCandidate[];
  selectedProduct: Product | null;
  status: MatchStatus;
  quantity: number;
  selected: boolean;
}

interface WhatsAppQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STOP_WORDS = new Set([
  'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'UN', 'UNA', 'UNOS', 'UNAS',
  'PARA', 'POR', 'CON', 'SIN', 'EN', 'AL', 'Y', 'O', 'A', 'X',
]);

const SYNONYMS: Record<string, string[]> = {
  CHEVROLET: ['CHEV'],
  CHEV: ['CHEVROLET'],
  INFERIOR: ['INF'],
  INF: ['INFERIOR'],
  SUPERIOR: ['SUP'],
  SUP: ['SUPERIOR'],
  DELANTERO: ['DEL', 'DELANTERA'],
  DELANTERA: ['DEL', 'DELANTERO'],
  DEL: ['DELANTERO', 'DELANTERA'],
  TRASERO: ['TRAS', 'TRASERA'],
  TRASERA: ['TRAS', 'TRASERO'],
  TRAS: ['TRASERO', 'TRASERA'],
  DERECHO: ['DER', 'DERECHA', 'RH'],
  DERECHA: ['DER', 'DERECHO', 'RH'],
  DER: ['DERECHO', 'DERECHA', 'RH'],
  RH: ['DERECHO', 'DER'],
  IZQUIERDO: ['IZQ', 'IZQUIERDA', 'LH'],
  IZQUIERDA: ['IZQ', 'IZQUIERDO', 'LH'],
  IZQ: ['IZQUIERDO', 'IZQUIERDA', 'LH'],
  LH: ['IZQUIERDO', 'IZQ'],
  EMPACADURA: ['EMP', 'EMPAQUE'],
  EMP: ['EMPACADURA'],
  EMPAQUE: ['EMPACADURA'],
  AMORTIGUADOR: ['AMORT', 'AMORTIGUADORES'],
  AMORTIGUADORES: ['AMORTIGUADOR', 'AMORT'],
  AMORT: ['AMORTIGUADOR'],
  MUNON: ['MUNONES'],
  MUNONES: ['MUNON'],
  PISTON: ['PISTONES'],
  PISTONES: ['PISTON'],
  ANILLO: ['ANILLOS'],
  ANILLOS: ['ANILLO'],
  BUJE: ['BUJES'],
  BUJES: ['BUJE'],
  TERMINAL: ['TERMINALES'],
  TERMINALES: ['TERMINAL'],
  MESETA: ['MESETAS'],
  MESETAS: ['MESETA'],
  CONCHA: ['CONCHAS'],
  CONCHAS: ['CONCHA'],
  PASTILLA: ['PASTILLAS'],
  PASTILLAS: ['PASTILLA'],
  ROTULA: ['ROTULAS'],
  ROTULAS: ['ROTULA'],
  ESTANDAR: ['STD'],
  STD: ['ESTANDAR'],
  ESTOPERA: ['ESTOPERAS', 'RETEN'],
  ESTOPERAS: ['ESTOPERA'],
  CROCHE: ['CLUTCH'],
  CLUTCH: ['CROCHE'],
  VOLKSWAGEN: ['VW'],
  VW: ['VOLKSWAGEN'],
  MITSUBISHI: ['MIT'],
  TOYOTA: ['TOY'],
};

const CONFLICT_GROUPS: string[][] = [
  ['INFERIOR', 'SUPERIOR'],
  ['DELANTERO', 'TRASERO'],
  ['DERECHO', 'IZQUIERDO'],
  ['BIELA', 'BANCADA'],
];

const MEASURE_SPECS = ['STD', '010', '020', '030', '040', '050', '060', '075', '100', '150'];

function normalizeAutoText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/0\.(\d{2,3})\b/g, '$1')
    .replace(/\.(\d{2,3})\b/g, '$1')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeWithSynonyms(input: string): string[] {
  const norm = normalizeAutoText(input);
  if (!norm) return [];
  const rawTokens = norm.split(' ').filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  const expanded = new Set<string>();
  for (const tok of rawTokens) {
    expanded.add(tok);
    if (SYNONYMS[tok]) {
      SYNONYMS[tok].forEach((s) => expanded.add(s));
    }
  }
  return Array.from(expanded);
}

function canonicalToken(tok: string): string {
  if (tok === 'INF') return 'INFERIOR';
  if (tok === 'SUP') return 'SUPERIOR';
  if (tok === 'DEL' || tok === 'DELANTERA') return 'DELANTERO';
  if (tok === 'TRAS' || tok === 'TRASERA') return 'TRASERO';
  if (tok === 'DER' || tok === 'DERECHA' || tok === 'RH') return 'DERECHO';
  if (tok === 'IZQ' || tok === 'IZQUIERDA' || tok === 'LH') return 'IZQUIERDO';
  return tok;
}

function getCanonicalSet(tokens: string[]): Set<string> {
  return new Set(tokens.map(canonicalToken));
}

function buildSearchableText(product: Product): string {
  const fitmentText = Array.isArray(product.fitment)
    ? product.fitment.map((f) => `${f.make || ''} ${f.model || ''} ${f.year || ''}`).join(' ')
    : '';
  return normalizeAutoText(
    `${product.code || ''} ${product.name || ''} ${product.brands?.name || ''} ${product.categories?.name || ''} ${fitmentText}`
  );
}

function hasDirectionalOrMeasureConflict(queryCanon: Set<string>, productCanon: Set<string>): boolean {
  for (const [a, b] of CONFLICT_GROUPS) {
    if (queryCanon.has(a) && !queryCanon.has(b) && productCanon.has(b) && !productCanon.has(a)) {
      return true;
    }
    if (queryCanon.has(b) && !queryCanon.has(a) && productCanon.has(a) && !productCanon.has(b)) {
      return true;
    }
  }

  const queryMeasures = MEASURE_SPECS.filter((m) => queryCanon.has(m));
  if (queryMeasures.length > 0) {
    const productMeasures = MEASURE_SPECS.filter((m) => productCanon.has(m));
    if (productMeasures.length > 0 && !queryMeasures.some((m) => productCanon.has(m))) {
      return true;
    }
  }
  return false;
}

function resolveStatusAndPick(candidates: ReviewCandidate[]): {
  selectedProduct: Product | null;
  status: MatchStatus;
} {
  if (candidates.length === 0) {
    return { selectedProduct: null, status: 'not_found' };
  }
  const topScore = candidates[0].score;
  const inStockCandidate = candidates.find(
    (c) => (c.product.stock ?? 0) > 0 && c.score >= Math.max(32, topScore - 22)
  );
  if (inStockCandidate) {
    return { selectedProduct: inStockCandidate.product, status: 'in_stock' };
  }
  const anyInStock = candidates.find((c) => (c.product.stock ?? 0) > 0);
  if (anyInStock) {
    return { selectedProduct: anyInStock.product, status: 'in_stock' };
  }
  return { selectedProduct: candidates[0].product, status: 'out_of_stock' };
}

export function matchItemsWithInventory(
  parsedItems: ParsedWhatsAppItem[],
  products: Product[]
): ReviewRow[] {
  const indexed = products.map((product) => {
    const searchable = buildSearchableText(product);
    const codeNorm = normalizeAutoText(product.code || '').replace(/\s+/g, '');
    const tokens = tokenizeWithSynonyms(searchable);
    return {
      product,
      searchable,
      codeNorm,
      tokenSet: new Set(tokens),
      canonSet: getCanonicalSet(tokens),
    };
  });

  const fuse = new Fuse(indexed, {
    keys: [
      { name: 'codeNorm', weight: 0.35 },
      { name: 'searchable', weight: 0.65 },
    ],
    threshold: 0.52,
    includeScore: true,
    ignoreLocation: true,
  });

  return parsedItems.map((parsed, idx) => {
    const skuNorm = normalizeAutoText(parsed.sku_hint || '').replace(/\s+/g, '');
    const partWords = normalizeAutoText(parsed.part_name || '')
      .split(' ')
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
    const queryWords = normalizeAutoText(
      `${parsed.part_name} ${parsed.vehicle} ${parsed.spec} ${(parsed.search_terms || []).join(' ')}`
    )
      .split(' ')
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

    const uniqueQueryWords = Array.from(new Set(queryWords));
    const queryCanon = getCanonicalSet(tokenizeWithSynonyms(uniqueQueryWords.join(' ')));

    const fuseQuery = [parsed.sku_hint, parsed.part_name, parsed.vehicle, parsed.spec]
      .filter(Boolean)
      .join(' ')
      .trim();
    const fuseScores = new Map<string, number>();
    if (fuseQuery) {
      for (const res of fuse.search(normalizeAutoText(fuseQuery), { limit: 40 })) {
        fuseScores.set(res.item.product.id, 1 - (res.score ?? 1));
      }
    }

    const candidates: ReviewCandidate[] = [];

    for (const entry of indexed) {
      let score = 0;

      // 1. SKU match
      if (skuNorm.length >= 3) {
        if (entry.codeNorm === skuNorm) {
          score += 90;
        } else if (entry.codeNorm.includes(skuNorm) || skuNorm.includes(entry.codeNorm)) {
          score += 58;
        }
      }

      // 2. Primary part word matches
      let partMatchedCount = 0;
      for (const pw of partWords) {
        const syns = [pw, ...(SYNONYMS[pw] || [])];
        if (syns.some((s) => entry.tokenSet.has(s) || entry.searchable.includes(s))) {
          partMatchedCount++;
        }
      }
      if (partWords.length > 0) {
        score += (partMatchedCount / partWords.length) * 45;
      }

      // 3. Full query token overlap (part + vehicle + spec + search_terms)
      let totalMatchedCount = 0;
      for (const qw of uniqueQueryWords) {
        const syns = [qw, ...(SYNONYMS[qw] || [])];
        if (syns.some((s) => entry.tokenSet.has(s) || entry.searchable.includes(s))) {
          totalMatchedCount++;
        }
      }
      if (uniqueQueryWords.length > 0) {
        score += (totalMatchedCount / uniqueQueryWords.length) * 35;
      }

      // 4. Fuse similarity boost
      const fuseSim = fuseScores.get(entry.product.id) ?? 0;
      score += fuseSim * 28;

      // 5. Conflict penalty (e.g. SUPERIOR when INFERIOR requested)
      if (hasDirectionalOrMeasureConflict(queryCanon, entry.canonSet)) {
        score -= 26;
      }

      const hasMinimalSignal =
        (skuNorm.length >= 3 && entry.codeNorm.includes(skuNorm)) ||
        partMatchedCount > 0 ||
        totalMatchedCount >= 2;

      if (hasMinimalSignal && score >= 32) {
        candidates.push({ product: entry.product, score });
      }
    }

    candidates.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 8) return scoreDiff;
      const aInStock = (a.product.stock ?? 0) > 0 ? 1 : 0;
      const bInStock = (b.product.stock ?? 0) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock;
      return scoreDiff;
    });

    const topCandidates = candidates.slice(0, 12);
    const { selectedProduct, status } = resolveStatusAndPick(topCandidates);

    return {
      rowId: `wa-row-${idx}-${Date.now()}`,
      groupId: `group-${idx}`,
      parsed,
      candidates: topCandidates,
      selectedProduct,
      status,
      quantity: parsed.quantity || 1,
      selected: status === 'in_stock',
    };
  });
}

async function compressImageToBase64(fileOrBlob: Blob): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        URL.revokeObjectURL(objectUrl);
        resolve({
          base64: dataUrl,
          mimeType: 'image/jpeg',
          previewUrl: dataUrl,
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Archivo de imagen inválido'));
    };
    img.src = objectUrl;
  });
}

function getProductStatusBadge(product: Product | null, status: MatchStatus) {
  if (!product || status === 'not_found') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3 shrink-0" />
        No encontrado
      </span>
    );
  }
  const stock = product.stock ?? 0;
  if (stock <= 0 || status === 'out_of_stock') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono tabular-nums uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        Agotado (Stock: 0)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono tabular-nums uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      Disp: {stock}
    </span>
  );
}

export function WhatsAppQuoteDialog({ open, onOpenChange }: WhatsAppQuoteDialogProps) {
  const { data: products = [] } = useProducts();
  const { addItem, clientName: cartClientName, clientPhone: cartClientPhone, setClientName, setClientPhone } = useCartStore();

  const [step, setStep] = useState<'input' | 'review'>('input');
  const [messageText, setMessageText] = useState('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [detectedName, setDetectedName] = useState('');
  const [detectedPhone, setDetectedPhone] = useState('');
  const [applyClientInfo, setApplyClientInfo] = useState(true);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [manualSearchRowId, setManualSearchRowId] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback(async (file: Blob) => {
    try {
      const processed = await compressImageToBase64(file);
      setImageBase64(processed.base64);
      setImageMimeType(processed.mimeType);
      setImagePreview(processed.previewUrl);
      toast.success('Captura cargada para analizar');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cargar la imagen');
    }
  }, []);

  // Allow Ctrl+V image paste anywhere inside modal during input step
  useEffect(() => {
    if (!open || step !== 'input') return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handleImageFile(blob);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [open, step, handleImageFile]);

  const handleAnalyze = async () => {
    if (!messageText.trim() && !imageBase64) {
      toast.error('Pega un mensaje de WhatsApp o sube una captura de pantalla');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/parse-whatsapp-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: messageText.trim(),
          imageBase64: imageBase64 || undefined,
          mimeType: imageMimeType || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Error analizando el mensaje con IA');
      }

      const parsedItems: ParsedWhatsAppItem[] = Array.isArray(data.items) ? data.items : [];
      if (parsedItems.length === 0) {
        toast.error('No se detectaron repuestos en el mensaje o imagen');
        return;
      }

      const aiName = typeof data.client_name === 'string' ? data.client_name.trim() : '';
      const aiPhone = typeof data.client_phone === 'string' ? data.client_phone.trim() : '';
      setDetectedName(aiName || cartClientName || '');
      setDetectedPhone(aiPhone || cartClientPhone || '');
      setApplyClientInfo(Boolean(aiName || aiPhone));

      const matched = matchItemsWithInventory(parsedItems, products);
      setRows(matched);
      setManualSearchRowId(null);
      setManualQuery('');
      setStep('review');
    } catch (err: any) {
      toast.error(err?.message || 'Error al analizar con IA');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const searchableProducts = useMemo(
    () => products.map((p) => ({ product: p, text: buildSearchableText(p) })),
    [products]
  );

  const manualSearchResults = useMemo(() => {
    const q = normalizeAutoText(manualQuery);
    if (!q) return products.slice(0, 15);
    const terms = q.split(' ').filter(Boolean);
    return searchableProducts
      .filter(({ text }) => terms.every((t) => text.includes(t)))
      .map(({ product }) => product)
      .sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
      .slice(0, 20);
  }, [manualQuery, products, searchableProducts]);

  const updateRow = (rowId: string, updater: (r: ReviewRow) => ReviewRow) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? updater(r) : r)));
  };

  const handleSelectCandidate = (rowId: string, productId: string) => {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    const candidate = row.candidates.find((c) => c.product.id === productId);
    const product = candidate?.product || products.find((p) => p.id === productId) || null;
    if (!product) return;

    const inStock = (product.stock ?? 0) > 0;
    updateRow(rowId, (r) => ({
      ...r,
      selectedProduct: product,
      status: inStock ? 'in_stock' : 'out_of_stock',
      selected: inStock,
    }));
  };

  const handleAssignManualProduct = (rowId: string, product: Product) => {
    const inStock = (product.stock ?? 0) > 0;
    updateRow(rowId, (r) => {
      const alreadyExists = r.candidates.some((c) => c.product.id === product.id);
      const candidates = alreadyExists
        ? r.candidates
        : [{ product, score: 100 }, ...r.candidates];
      return {
        ...r,
        candidates,
        selectedProduct: product,
        status: inStock ? 'in_stock' : 'out_of_stock',
        selected: true,
      };
    });
    setManualSearchRowId(null);
    setManualQuery('');
  };

  const handleDuplicateWithNextBrand = (row: ReviewRow) => {
    const usedInGroup = new Set(
      rows.filter((r) => r.groupId === row.groupId && r.selectedProduct).map((r) => r.selectedProduct!.id)
    );
    const nextCandidate = row.candidates.find((c) => !usedInGroup.has(c.product.id));
    const picked = nextCandidate?.product || row.selectedProduct;
    if (!picked) return;

    const inStock = (picked.stock ?? 0) > 0;
    const clone: ReviewRow = {
      ...row,
      rowId: `wa-row-clone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      selectedProduct: picked,
      status: inStock ? 'in_stock' : 'out_of_stock',
      selected: inStock,
    };

    setRows((prev) => {
      const idx = prev.findIndex((r) => r.rowId === row.rowId);
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => r.selected && r.selectedProduct),
    [rows]
  );

  const estimatedTotalUsd = useMemo(
    () =>
      selectedRows.reduce(
        (sum, r) => sum + (r.selectedProduct?.price_usd || 0) * (r.quantity || 1),
        0
      ),
    [selectedRows]
  );

  const alertCounts = useMemo(() => {
    let outOfStock = 0;
    let notFound = 0;
    for (const r of rows) {
      if (r.status === 'out_of_stock') outOfStock++;
      else if (r.status === 'not_found') notFound++;
    }
    return { outOfStock, notFound };
  }, [rows]);

  const handleAddAllToCart = () => {
    if (selectedRows.length === 0) {
      toast.error('Selecciona al menos un producto válido para agregar al carrito');
      return;
    }

    if (applyClientInfo) {
      if (detectedName.trim()) setClientName(detectedName.trim());
      if (detectedPhone.trim()) setClientPhone(detectedPhone.trim());
    }

    selectedRows.forEach((row) => {
      const p = row.selectedProduct!;
      addItem({
        product_id: p.id,
        product_name: p.name,
        product_code: p.code,
        quantity: row.quantity || 1,
        unit_price_usd: p.price_usd || 0,
        image_url: p.image_url,
        brand_name: p.brands?.name,
        brand_logo_url: p.brands?.logo_url,
        stock: p.stock,
      });
    });

    toast.success(`${selectedRows.length} producto${selectedRows.length !== 1 ? 's' : ''} agregado${selectedRows.length !== 1 ? 's' : ''} a la cotización`);
    setStep('input');
    setMessageText('');
    setImageBase64('');
    setImageMimeType('');
    setImagePreview('');
    setRows([]);
    onOpenChange(false);
  };

  const clearImage = () => {
    setImageBase64('');
    setImageMimeType('');
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-md border border-slate-200 bg-white gap-0">
        {/* Top Industrial Dark Header */}
        <DialogHeader className="px-5 py-4 bg-[#0F172A] text-white border-b border-slate-800">
          <div className="flex items-center justify-between pr-7">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <MessageSquareText className="w-4 h-4" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-[15px] font-bold text-white leading-tight">
                  Cotización Automática desde WhatsApp (IA)
                </DialogTitle>
                <DialogDescription className="text-[11.5px] text-slate-400 mt-0.5">
                  {step === 'input'
                    ? 'Pega el texto o sube una captura de pantalla del chat para armar la cotización al instante.'
                    : 'Revisa los repuestos detectados, cambia o compara marcas en stock y ajusta las cantidades.'}
                </DialogDescription>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-sm bg-slate-800 border border-slate-700 text-emerald-400">
              <Sparkles className="w-3 h-3" />
              Paso {step === 'input' ? '1/2' : '2/2'}
            </span>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5 bg-[#F8FAFC]">
          {step === 'input' ? (
            <div className="space-y-4">
              {isAnalyzing ? (
                <div className="space-y-3 py-6 px-4 bg-white border border-slate-200 rounded-md">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">
                        Analizando pedido de WhatsApp con IA...
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Extrayendo piezas, vehículos, medidas y buscando opciones por marca en tu inventario.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-10 bg-slate-100 rounded-sm animate-pulse" />
                    <div className="h-10 bg-slate-100 rounded-sm animate-pulse" />
                    <div className="h-10 bg-slate-100 rounded-sm animate-pulse w-4/5" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Text input */}
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <label className="block text-[12px] font-bold text-slate-800 mb-1.5">
                      1. Mensaje de WhatsApp del cliente (opcional si subes captura)
                    </label>
                    <Textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={"Ejemplo:\nBuenos días, necesito precio por favor:\n- 2 muñones inferiores de Blazer 4x2\n- 1 juego de conchas de biela a 010 para Corsa 1.6\n- 1 bomba de gasolina"}
                      className="min-h-[120px] text-[13px] bg-white border-slate-200 focus-visible:ring-emerald-500 rounded-sm"
                    />
                  </div>

                  {/* Screenshot dropzone */}
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[12px] font-bold text-slate-800">
                        2. Captura de pantalla o foto de lista (opcional si pegas texto)
                      </label>
                      <span className="text-[10.5px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                        Soporta Ctrl+V directo
                      </span>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFile(file);
                      }}
                    />

                    {imagePreview ? (
                      <div className="relative border border-slate-200 rounded-md bg-slate-50 p-3 flex items-center gap-4">
                        <img
                          src={imagePreview}
                          alt="Captura WhatsApp"
                          className="h-28 w-auto max-w-[200px] object-contain rounded-sm border border-slate-200 bg-white"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-bold text-slate-800">
                            Captura lista para analizar
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            La IA leerá los repuestos, cantidades y datos del cliente en la imagen.
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-sm border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                              Cambiar imagen
                            </button>
                            <button
                              type="button"
                              onClick={clearImage}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-sm border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                              <X className="w-3.5 h-3.5" />
                              Quitar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            handleImageFile(file);
                          } else {
                            toast.error('Sube un archivo de imagen válido');
                          }
                        }}
                        className={cn(
                          'border border-dashed rounded-md p-6 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                          isDragging
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/40'
                        )}
                      >
                        <ImagePlus className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                        <p className="text-[12.5px] font-semibold text-slate-700">
                          Haz clic para subir captura, arrastra aquí o presiona{' '}
                          <kbd className="font-mono text-[11px] bg-white border border-slate-300 px-1.5 py-0.5 rounded-sm">
                            Ctrl+V
                          </kbd>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Acepta capturas de WhatsApp, fotos de listas escritas a mano o capturas de PC/móvil
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Client Info Bar */}
              <div className="bg-white border border-slate-200 rounded-md p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-700">
                    Datos del Cliente
                  </span>
                  <label className="flex items-center gap-2 text-[11.5px] font-medium text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyClientInfo}
                      onChange={(e) => setApplyClientInfo(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Aplicar al carrito actual
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={detectedName}
                      onChange={(e) => setDetectedName(e.target.value)}
                      placeholder="Nombre del cliente detectado (opcional)"
                      className="pl-8 h-8 text-[12px] rounded-sm border-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={detectedPhone}
                      onChange={(e) => setDetectedPhone(e.target.value)}
                      placeholder="Teléfono detectado (opcional)"
                      className="pl-8 h-8 text-[12px] font-mono tabular-nums rounded-sm border-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Alerts summary */}
              {(alertCounts.outOfStock > 0 || alertCounts.notFound > 0) && (
                <div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-3.5 py-2.5 text-[12px]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">Atención:</span>
                  {alertCounts.outOfStock > 0 && (
                    <span className="font-mono tabular-nums">
                      {alertCounts.outOfStock} ítem{alertCounts.outOfStock > 1 ? 's' : ''} sin stock disponible
                    </span>
                  )}
                  {alertCounts.outOfStock > 0 && alertCounts.notFound > 0 && <span>·</span>}
                  {alertCounts.notFound > 0 && (
                    <span className="font-mono tabular-nums text-red-700 font-semibold">
                      {alertCounts.notFound} ítem{alertCounts.notFound > 1 ? 's' : ''} no encontrado{alertCounts.notFound > 1 ? 's' : ''} en inventario
                    </span>
                  )}
                  <span className="text-amber-700 text-[11px]">
                    (Puedes buscarlos manualmente o excluirlos).
                  </span>
                </div>
              )}

              {/* Interactive Review Rows */}
              <div className="space-y-2.5">
                {rows.map((row) => {
                  const p = row.selectedProduct;
                  const lineTotal = (p?.price_usd || 0) * (row.quantity || 1);
                  const isSearchingManual = manualSearchRowId === row.rowId;

                  return (
                    <div
                      key={row.rowId}
                      className={cn(
                        'bg-white border rounded-md p-3.5 transition-colors',
                        row.status === 'not_found'
                          ? 'border-red-200 bg-red-50/20'
                          : row.status === 'out_of_stock'
                          ? 'border-amber-200 bg-amber-50/20'
                          : row.selected
                          ? 'border-emerald-300 shadow-sm'
                          : 'border-slate-200 opacity-75'
                      )}
                    >
                      <div className="flex flex-col md:flex-row md:items-start gap-3">
                        {/* Left: Checkbox + WhatsApp request */}
                        <div className="flex items-start gap-2.5 md:w-[32%] shrink-0">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={!p}
                            onChange={(e) =>
                              updateRow(row.rowId, (r) => ({ ...r, selected: e.target.checked }))
                            }
                            className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Pedido WhatsApp
                            </p>
                            <p className="text-[12.5px] font-semibold text-slate-900 leading-snug break-words">
                              &ldquo;{row.parsed.raw_request}&rdquo;
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {row.parsed.part_name && (
                                <span className="text-[9.5px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm border border-slate-200">
                                  {row.parsed.part_name}
                                </span>
                              )}
                              {row.parsed.vehicle && (
                                <span className="text-[9.5px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-sm border border-blue-200">
                                  {row.parsed.vehicle}
                                </span>
                              )}
                              {row.parsed.spec && (
                                <span className="text-[9.5px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-sm border border-slate-200">
                                  {row.parsed.spec}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Middle: Brand/Option selector + Manual search */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {getProductStatusBadge(p, row.status)}
                            <div className="flex items-center gap-1.5">
                              {row.candidates.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateWithNextBrand(row)}
                                  title="Agregar fila adicional con otra marca disponible para comparar"
                                  className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-sm border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer active:scale-[0.98]"
                                >
                                  <CopyPlus className="w-3 h-3" />
                                  Otra marca
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSearchingManual) {
                                    setManualSearchRowId(null);
                                  } else {
                                    setManualSearchRowId(row.rowId);
                                    setManualQuery(row.parsed.part_name || row.parsed.vehicle || '');
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                              >
                                <Search className="w-3 h-3" />
                                {isSearchingManual ? 'Cerrar búsqueda' : 'Buscar manual'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(row.rowId)}
                                title="Quitar fila"
                                className="p-1 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {row.candidates.length > 0 ? (
                            <select
                              value={p?.id || ''}
                              onChange={(e) => handleSelectCandidate(row.rowId, e.target.value)}
                              className="w-full h-9 px-2.5 text-[12px] font-medium bg-white border border-slate-200 rounded-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              {row.candidates.map((cand) => {
                                const prod = cand.product;
                                const brandLabel = prod.brands?.name ? `[${prod.brands.name}] ` : '';
                                const stockLabel = (prod.stock ?? 0) > 0 ? `Disp: ${prod.stock}` : 'AGOTADO';
                                return (
                                  <option key={prod.id} value={prod.id}>
                                    {`${brandLabel}${prod.name} (${prod.code}) — ${formatUSD(prod.price_usd || 0)} — ${stockLabel}`}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <div className="h-9 px-3 flex items-center justify-between text-[12px] bg-red-50/60 border border-red-200 rounded-sm text-red-700">
                              <span>Sin coincidencia automática en inventario</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualSearchRowId(row.rowId);
                                  setManualQuery(row.parsed.part_name || '');
                                }}
                                className="font-bold underline hover:text-red-900 cursor-pointer"
                              >
                                Asignar manualmente
                              </button>
                            </div>
                          )}

                          {/* Inline Manual Search Panel */}
                          {isSearchingManual && (
                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-sm space-y-2">
                              <Input
                                autoFocus
                                value={manualQuery}
                                onChange={(e) => setManualQuery(e.target.value)}
                                placeholder="Buscar por nombre, código SKU, marca o vehículo..."
                                className="h-8 text-[12px] bg-white border-slate-200 rounded-sm focus-visible:ring-emerald-500"
                              />
                              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-sm">
                                {manualSearchResults.length === 0 ? (
                                  <p className="p-2.5 text-[11.5px] text-slate-500 text-center">
                                    No hay productos que coincidan con &ldquo;{manualQuery}&rdquo;
                                  </p>
                                ) : (
                                  manualSearchResults.map((prod) => (
                                    <button
                                      key={prod.id}
                                      type="button"
                                      onClick={() => handleAssignManualProduct(row.rowId, prod)}
                                      className="w-full text-left px-2.5 py-2 hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-[11.5px] font-semibold text-slate-900 truncate">
                                          {prod.brands?.name ? `[${prod.brands.name}] ` : ''}
                                          {prod.name}
                                        </p>
                                        <p className="text-[10px] font-mono text-slate-500">
                                          {prod.code} · Disp: {prod.stock ?? 0}
                                        </p>
                                      </div>
                                      <span className="text-[11.5px] font-bold font-mono tabular-nums text-emerald-700 shrink-0">
                                        {formatUSD(prod.price_usd || 0)}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right: Quantity & Price */}
                        <div className="flex md:flex-col items-center md:items-end justify-between gap-2 md:w-[140px] shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(row.rowId, (r) => ({
                                  ...r,
                                  quantity: Math.max(1, r.quantity - 1),
                                }))
                              }
                              className="w-7 h-7 rounded-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                              title="Disminuir cantidad"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-[12.5px] font-bold font-mono tabular-nums text-slate-900">
                              {row.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(row.rowId, (r) => ({
                                  ...r,
                                  quantity: r.quantity + 1,
                                }))
                              }
                              className="w-7 h-7 rounded-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                              title="Aumentar cantidad"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-[10px] font-mono tabular-nums text-slate-500">
                              Unit: {p ? formatUSD(p.price_usd || 0) : '—'}
                            </p>
                            <p className="text-[13.5px] font-bold font-mono tabular-nums text-slate-900">
                              {p ? formatUSD(lineTotal) : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {step === 'input' ? (
            <>
              <p className="text-[11px] text-slate-500">
                Podrás revisar marcas disponibles, precios y stock antes de cargarlos al carrito.
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={isAnalyzing}
                  className="h-9 px-3.5 rounded-sm border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (!messageText.trim() && !imageBase64)}
                  className="h-9 px-4 rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-bold flex items-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analizar con IA
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="h-9 px-3 rounded-sm border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver / Nuevo análisis
                </button>
                <div className="text-[12px] text-slate-600">
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {selectedRows.length}
                  </span>{' '}
                  seleccionado{selectedRows.length !== 1 ? 's' : ''} · Estimado:{' '}
                  <span className="font-mono tabular-nums font-bold text-emerald-700">
                    {formatUSD(estimatedTotalUsd)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddAllToCart}
                disabled={selectedRows.length === 0}
                className="h-9 px-4 rounded-sm bg-[#0F172A] hover:bg-slate-800 text-white text-[12.5px] font-bold flex items-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ml-auto"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Agregar a la Cotización
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
