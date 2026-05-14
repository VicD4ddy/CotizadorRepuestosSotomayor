'use client';

import { useState, useCallback } from 'react';
import { Bot, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AiProgressState {
  isProcessing: boolean;
  current: number;
  total: number;
  productName: string;
  step: string; // 'estandarizando' | 'generando descripción'
  processed: number;
  errors: number;
  isDone: boolean;
}

interface AiProgressBannerProps {
  productIds: string[];
  onComplete?: () => void;
  onClose?: () => void;
}

export function AiProgressBanner({ productIds, onComplete, onClose }: AiProgressBannerProps) {
  const [state, setState] = useState<AiProgressState>({
    isProcessing: false,
    current: 0,
    total: productIds.length,
    productName: '',
    step: '',
    processed: 0,
    errors: 0,
    isDone: false,
  });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const startProcessing = useCallback(async () => {
    const controller = new AbortController();
    setAbortController(controller);

    setState((s) => ({ ...s, isProcessing: true, isDone: false, processed: 0, errors: 0 }));

    try {
      const res = await fetch('/api/process-ai-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setState((s) => ({ ...s, isProcessing: false, isDone: true, errors: 1 }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, '').trim();
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine);

            if (event.type === 'progress') {
              setState((s) => ({
                ...s,
                current: event.current,
                total: event.total,
                productName: event.productName,
                step: event.step,
              }));
            } else if (event.type === 'done-item') {
              setState((s) => ({
                ...s,
                current: event.current,
                processed: event.current,
                productName: event.productName,
              }));
            } else if (event.type === 'error' || event.type === 'warning') {
              if (event.type === 'error') {
                setState((s) => ({ ...s, errors: s.errors + 1 }));
              }
            } else if (event.type === 'complete') {
              setState((s) => ({
                ...s,
                isProcessing: false,
                isDone: true,
                processed: event.processed,
                errors: event.errors,
              }));
              onComplete?.();
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setState((s) => ({ ...s, isProcessing: false, isDone: true }));
      }
    }
  }, [productIds, onComplete]);

  const handleCancel = () => {
    abortController?.abort();
    setState((s) => ({ ...s, isProcessing: false, isDone: true }));
  };

  const handleClose = () => {
    onClose?.();
  };

  const pct = state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;

  // Not started yet — show the launch button
  if (!state.isProcessing && !state.isDone) {
    return (
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-lg p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-violet-900">
              Procesar con Gemma 4
            </p>
            <p className="text-[11px] text-violet-600">
              Estandarizar nombres y generar descripciones para {productIds.length} producto{productIds.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={startProcessing}
          className="bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold px-4 gap-2"
          size="sm"
        >
          <Bot className="w-4 h-4" />
          Procesar con IA
        </Button>
      </div>
    );
  }

  // Processing
  if (state.isProcessing) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span className="text-[13px] font-bold text-blue-900">Procesando con Gemma 4...</span>
          </div>
          <button onClick={handleCancel} className="text-blue-400 hover:text-blue-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[12px] text-blue-700 mb-2 truncate">
          <span className="capitalize">{state.step}</span>: <span className="font-medium">{state.productName}</span>
          <span className="text-blue-400 ml-2">({state.current}/{state.total})</span>
        </p>

        <div className="w-full bg-blue-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-blue-400 mt-1 text-right">{pct}%</p>
      </div>
    );
  }

  // Done
  return (
    <div className={`border rounded-lg p-4 flex items-center justify-between ${
      state.errors > 0
        ? 'bg-amber-50 border-amber-200'
        : 'bg-emerald-50 border-emerald-200'
    }`}>
      <div className="flex items-center gap-3">
        {state.errors > 0 ? (
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        )}
        <div>
          <p className="text-[13px] font-bold text-slate-900">
            Procesamiento completado
          </p>
          <p className="text-[11px] text-slate-500">
            {state.processed} procesados
            {state.errors > 0 && <span className="text-amber-600 ml-1">• {state.errors} errores</span>}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleClose} className="text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
