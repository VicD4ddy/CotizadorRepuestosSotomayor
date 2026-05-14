'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ImageGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function ImageGalleryDialog({ open, onOpenChange, product }: ImageGalleryDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Extract all available images
  const images = product?.image_urls?.length 
    ? product.image_urls 
    : (product?.image_url ? [product.image_url] : []);

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open]);

  if (!product || images.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] w-[95vw] p-0 overflow-hidden bg-slate-950 border-slate-800">
        <DialogHeader className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none">
          <DialogTitle className="text-white text-[16px] font-bold drop-shadow-md">
            {product.name}
          </DialogTitle>
          <p className="text-slate-300 text-[12px] font-mono">
            {product.code}
          </p>
        </DialogHeader>

        {/* Close Button Override */}
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Main Image Viewer */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] flex items-center justify-center bg-slate-950 mt-12">
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
              }}
              className="absolute left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <img 
            src={images[currentIndex]} 
            alt={`Image ${currentIndex + 1} of ${product.name}`} 
            className="w-full h-full object-contain pointer-events-none"
          />

          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Counter Badge */}
          {images.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 overflow-x-auto custom-scrollbar flex items-center gap-3 justify-center">
            {images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                  currentIndex === idx 
                    ? 'border-emerald-500 opacity-100 scale-105' 
                    : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover bg-white" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
