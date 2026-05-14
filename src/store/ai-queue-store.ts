import { create } from 'zustand';

export interface AiQueueItem {
  productId: string;
  productName: string;
  productCode: string;
  tasks: ('standardize' | 'description')[];
}

export interface AiQueueState {
  queue: AiQueueItem[];
  currentItem: AiQueueItem | null;
  currentStep: string; // 'estandarizando' | 'generando descripción' | ''
  isProcessing: boolean;
  processed: number;
  errors: number;

  addToQueue: (item: AiQueueItem) => void;
  startProcessing: () => void;
  _processNext: () => void;
  _setCurrentStep: (step: string) => void;
  _markDone: (success: boolean) => void;
  _finish: () => void;
  clearQueue: () => void;
}

export const useAiQueueStore = create<AiQueueState>((set, get) => ({
  queue: [],
  currentItem: null,
  currentStep: '',
  isProcessing: false,
  processed: 0,
  errors: 0,

  addToQueue: (item) => {
    const state = get();
    // Don't add duplicates
    const exists = state.queue.some(q => q.productId === item.productId) ||
                   state.currentItem?.productId === item.productId;
    if (exists) return;

    set((s) => ({ queue: [...s.queue, item] }));

    // Auto-start if not already processing
    if (!state.isProcessing) {
      // Start on next tick so state updates first
      setTimeout(() => get().startProcessing(), 50);
    }
  },

  startProcessing: () => {
    set({ isProcessing: true, processed: 0, errors: 0 });
    get()._processNext();
  },

  _processNext: async () => {
    const state = get();
    if (state.queue.length === 0) {
      get()._finish();
      return;
    }

    const [next, ...rest] = state.queue;
    set({ currentItem: next, queue: rest, currentStep: '' });

    try {
      for (const task of next.tasks) {
        if (task === 'standardize') {
          set({ currentStep: 'estandarizando' });
          const res = await fetch('/api/standardize-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: next.productName,
              code: next.productCode,
              brandName: '',
              fitmentText: '',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.standardizedName) {
              next.productName = data.standardizedName; // Use for description
              // Save to DB
              await fetch('/api/save-ai-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: next.productId,
                  name: data.standardizedName,
                }),
              });
            }
          }
        }

        if (task === 'description') {
          set({ currentStep: 'generando descripción' });
          const res = await fetch('/api/generate-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: next.productName,
              code: next.productCode,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.description) {
              await fetch('/api/save-ai-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: next.productId,
                  description: data.description,
                }),
              });
            }
          }
        }

        // Delay between tasks to respect rate limits
        await new Promise((r) => setTimeout(r, 1500));
      }

      get()._markDone(true);
    } catch {
      get()._markDone(false);
    }
  },

  _markDone: (success) => {
    set((s) => ({
      processed: s.processed + (success ? 1 : 0),
      errors: s.errors + (success ? 0 : 1),
      currentItem: null,
      currentStep: '',
    }));
    // Process next after a delay
    setTimeout(() => get()._processNext(), 1000);
  },

  _finish: () => {
    set({ isProcessing: false, currentItem: null, currentStep: '' });
  },

  clearQueue: () => {
    set({ queue: [], currentItem: null, currentStep: '', isProcessing: false, processed: 0, errors: 0 });
  },
}));
