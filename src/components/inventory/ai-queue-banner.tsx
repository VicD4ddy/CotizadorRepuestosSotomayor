'use client';

import { useAiQueueStore } from '@/store/ai-queue-store';
import { Bot, Loader2, X, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

export function AiQueueBanner() {
  const { isProcessing, currentItem, currentStep, queue, processed, errors, clearQueue } = useAiQueueStore();
  const queryClient = useQueryClient();
  const lastProcessed = useRef(processed);

  // Refresh products list when items finish processing
  useEffect(() => {
    if (processed > lastProcessed.current) {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
    lastProcessed.current = processed;
  }, [processed, queryClient]);

  // Nothing to show
  if (!isProcessing && processed === 0 && errors === 0) return null;

  const totalInPipeline = queue.length + (currentItem ? 1 : 0) + processed + errors;
  const pct = totalInPipeline > 0 ? Math.round(((processed + errors) / totalInPipeline) * 100) : 0;

  // Completed
  if (!isProcessing && (processed > 0 || errors > 0)) {
    return (
      <div className="fixed bottom-4 right-[360px] z-50 w-[340px] bg-white border border-emerald-200 rounded-xl shadow-lg p-3 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] font-bold text-slate-800">Cola IA completada</p>
            <p className="text-[10px] text-slate-500">
              {processed} procesado{processed !== 1 ? 's' : ''}
              {errors > 0 && <span className="text-red-500"> • {errors} error{errors !== 1 ? 'es' : ''}</span>}
            </p>
          </div>
          <button onClick={clearQueue} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Processing
  if (!isProcessing || !currentItem) return null;

  return (
    <div className="fixed bottom-4 right-[360px] z-50 w-[340px] bg-white border border-blue-200 rounded-xl shadow-lg p-3 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-600" />
          <span className="text-[12px] font-bold text-blue-900">Cola IA</span>
          <span className="text-[10px] text-blue-400">{queue.length + 1} pendiente{queue.length !== 0 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
        <p className="text-[11px] text-blue-700 truncate">
          <span className="capitalize">{currentStep}</span>: <span className="font-medium">{currentItem.productName}</span>
        </p>
      </div>

      <div className="w-full bg-blue-100 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Queue preview */}
      {queue.length > 0 && (
        <div className="mt-2 pt-2 border-t border-blue-100">
          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider mb-1">En cola:</p>
          {queue.slice(0, 3).map((item) => (
            <p key={item.productId} className="text-[10px] text-slate-500 truncate">• {item.productName}</p>
          ))}
          {queue.length > 3 && (
            <p className="text-[10px] text-slate-400 italic">...y {queue.length - 3} más</p>
          )}
        </div>
      )}
    </div>
  );
}
