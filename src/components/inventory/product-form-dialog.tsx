'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Product } from '@/types';
import { productSchema, ProductFormValues } from '@/lib/schemas';
import {
  useUpdateProduct,
  useCreateProduct,
  useUploadImage,
  useCategories,
  useBrands,
  useKits,
  useBcvRate,
  useMarginPercentage,
  useBcvMultiplier,
  useDeleteProduct,
} from '@/hooks/use-supabase';
import { calculateMargin, formatUSD } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, X, Plus, Image as ImageIcon, Save, RefreshCw, Sparkles, Search as SearchIcon, ListPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAiQueueStore } from '@/store/ai-queue-store';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  initialCompatibleKitId?: string;
}

export function ProductFormDialog({ open, onOpenChange, product, initialCompatibleKitId }: ProductFormDialogProps) {
  const isEditing = !!product;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const uploadImage = useUploadImage();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: kits = [] } = useKits();
  const { data: bcvRate = 36.5 } = useBcvRate();
  const { data: marginPercentage = 40 } = useMarginPercentage();
  const { data: bcvMultiplier = 1.4 } = useBcvMultiplier();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isStandardizing, setIsStandardizing] = useState(false);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<string[]>([]);
  const [customImageQuery, setCustomImageQuery] = useState('');

  // Temporary state for the fitment inputs before adding to array
  const [fitmentInput, setFitmentInput] = useState({ make: '', model: '', year: '' });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      category_id: '',
      brand_id: '',
      cost: 0,
      price_usd: 0,
      image_url: '',
      location: '',
      fitment: [],
      compatible_kits: [],
    },
  });

  const { fields: fitmentFields, append: appendFitment, remove: removeFitment } = useFieldArray({
    control,
    name: "fitment",
  });

  const watchCost = watch('cost');
  const watchPriceUsd = watch('price_usd');

  const priceUsdBcv = watchPriceUsd ? (watchPriceUsd * bcvMultiplier).toFixed(2) : '0.00';
  const priceBcv = watchPriceUsd ? (watchPriceUsd * bcvMultiplier * bcvRate).toFixed(2) : '0.00';

  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          code: product.code,
          name: product.name,
          description: product.description,
          category_id: product.category_id || '',
          brand_id: product.brand_id || '',
          cost: product.cost,
          price_usd: product.price_usd,
          image_url: product.image_url,
          image_urls: product.image_urls || (product.image_url ? [product.image_url] : []),
          location: product.location || '',
          fitment: product.fitment || [],
          compatible_kits: product.kit_items?.map(k => k.kit_id) || [],
        });
        setPreviewUrl(product.image_url || '');
      } else {
        reset({
          code: '',
          name: '',
          description: '',
          category_id: '',
          brand_id: '',
          cost: 0,
          price_usd: 0,
          image_url: '',
          image_urls: [],
          location: '',
          fitment: [],
          compatible_kits: initialCompatibleKitId ? [initialCompatibleKitId] : [],
        });
        setPreviewUrl('');
      }
      setFitmentInput({ make: '', model: '', year: '' });
      setImageSearchResults([]);
      setIsStandardizing(false);
      setIsGeneratingDesc(false);
      setIsSearchingImages(false);
    }
  }, [open, product, reset, initialCompatibleKitId]);

  const handleApplyMargin = () => {
    const cost = watchCost || 0;
    const suggested = calculateMargin(cost, marginPercentage / 100);
    setValue('price_usd', suggested, { shouldDirty: true });
    toast.info(`Precio Divisas calculado: ${formatUSD(suggested)} (Costo × ${1 + (marginPercentage / 100)})`);
  };

  const handlePriceBcvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      const newUsd = Number((val / (bcvRate * bcvMultiplier)).toFixed(2));
      setValue('price_usd', newUsd, { shouldDirty: true });
    }
  };

  const handleAddFitment = () => {
    if (!fitmentInput.make || !fitmentInput.model || !fitmentInput.year) {
      toast.error('Complete todos los campos del vehículo');
      return;
    }
    appendFitment(fitmentInput);
    setFitmentInput({ make: '', model: '', year: '' });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 2MB');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    const tempCode = watch('code') || 'NEW';
    try {
      setIsUploading(true);
      const publicUrl = await uploadImage.mutateAsync({ file, productCode: tempCode });
      setValue('image_url', publicUrl, { shouldDirty: true });
      toast.success('Imagen subida temporalmente. Se guardará al crear el producto.');
    } catch (err) {
      toast.error('Error al subir la imagen');
      setPreviewUrl('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateDescription = async () => {
    const currentName = watch('name');
    const currentCode = watch('code');

    if (!currentName || !currentCode) {
      toast.error('Ingrese el nombre y SKU para generar la descripción.');
      return;
    }

    // If AI queue is busy, auto-enqueue
    const queueState = useAiQueueStore.getState();
    if (queueState.isProcessing && isEditing && product) {
      queueState.addToQueue({
        productId: product.id,
        productName: currentName,
        productCode: currentCode,
        tasks: ['description'],
      });
      toast.success('Encolado — se generará automáticamente', { duration: 3000 });
      return;
    }

    setIsGeneratingDesc(true);
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentName, code: currentCode }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error('429');
        if (res.status === 503) throw new Error('503');
        throw new Error(errData.error || 'Error en la API');
      }

      const data = await res.json();
      if (data.description) {
        setValue('description', data.description, { shouldDirty: true });
        // Auto-save to DB
        if (isEditing && product) {
          await fetch('/api/save-ai-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: product.id, description: data.description }),
          });
        }
        toast.success('Descripción generada y guardada');
      } else {
        throw new Error('Sin descripción');
      }
    } catch (error: any) {
      if (error.message === '429') {
        if (isEditing && product) {
          useAiQueueStore.getState().addToQueue({
            productId: product.id,
            productName: currentName,
            productCode: currentCode,
            tasks: ['description'],
          });
          toast.info('Límite alcanzado — encolado para procesamiento automático', { duration: 4000 });
        } else {
          toast.error('Límite de Gemma 4 alcanzado (15/min). Espera un momento.', { duration: 5000 });
        }
      } else if (error.message === '503') {
        toast.error('El servicio Gemma está temporalmente saturado.', { duration: 5000 });
      } else {
        toast.error(`Error de conexión con Gemma: ${error.message || 'Verifique su API Key.'}`);
      }
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleStandardizeName = async () => {
    const currentName = watch('name');
    const currentCode = watch('code');
    const brandId = watch('brand_id');
    const currentFitment = watch('fitment') || [];
    
    if (!currentName) {
      toast.error('Ingrese al menos el nombre actual para estandarizar.');
      return;
    }

    // If AI queue is busy, auto-enqueue instead of waiting
    const queueState = useAiQueueStore.getState();
    if (queueState.isProcessing && isEditing && product) {
      queueState.addToQueue({
        productId: product.id,
        productName: currentName,
        productCode: currentCode || '',
        tasks: ['standardize'],
      });
      toast.success('Encolado — se estandarizará automáticamente', { duration: 3000 });
      return;
    }

    const brandName = brands.find(b => b.id === brandId)?.name || '';
    const fitmentText = currentFitment.map(f => `${f.make} ${f.model}`).join(', ');

    setIsStandardizing(true);
    try {
      const res = await fetch('/api/standardize-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentName, code: currentCode, brandName, fitmentText }),
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error('429');
        if (res.status === 503) throw new Error('503');
        throw new Error('Error en la API');
      }

      const data = await res.json();
      if (data.standardizedName) {
        setValue('name', data.standardizedName, { shouldDirty: true });
        // Auto-save to DB
        if (isEditing && product) {
          await fetch('/api/save-ai-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: product.id, name: data.standardizedName }),
          });
        }
        toast.success('Nombre estandarizado y guardado');
      } else {
        throw new Error('Sin nombre');
      }
    } catch (error: any) {
      if (error.message === '429') {
        // Rate limited — auto-enqueue if editing
        if (isEditing && product) {
          useAiQueueStore.getState().addToQueue({
            productId: product.id,
            productName: currentName,
            productCode: currentCode || '',
            tasks: ['standardize'],
          });
          toast.info('Límite alcanzado — encolado para procesamiento automático', { duration: 4000 });
        } else {
          toast.error('Límite de Gemma 4 alcanzado (15/min). Espera un momento.', { duration: 5000 });
        }
      } else if (error.message === '503') {
        toast.error('El servicio Gemma está temporalmente saturado.', { duration: 5000 });
      } else {
        toast.error(`Error de conexión con Gemma: ${error.message || 'Verifique su API Key.'}`);
      }
    } finally {
      setIsStandardizing(false);
    }
  };

  const handleSearchImages = async (customQuery?: string) => {
    const searchText = customQuery?.trim();
    const currentName = watch('name');
    const currentCode = watch('code');
    const brandId = watch('brand_id');
    
    if (!searchText && !currentName) {
      toast.error('Ingrese un término de búsqueda o el nombre del repuesto.');
      return;
    }

    const brandName = brands.find(b => b.id === brandId)?.name || '';
    const query = searchText || `${brandName} ${currentName} ${currentCode}`.trim();

    setIsSearchingImages(true);
    setImageSearchResults([]);
    try {
      const res = await fetch('/api/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error('Error en la API');

      const data = await res.json();
      if (data.images && data.images.length > 0) {
        setImageSearchResults(data.images);
      } else {
        toast.error('No se encontraron imágenes.');
      }
    } catch (error) {
      toast.error('Error al buscar imágenes.');
    } finally {
      setIsSearchingImages(false);
    }
  };

  const onSubmit = async (data: ProductFormValues) => {
    try {
      const { compatible_kits, ...productData } = data;
      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, ...productData, compatible_kits });
        toast.success('Producto actualizado exitosamente');
      } else {
        await createProduct.mutateAsync({ product: productData, compatible_kits });
        toast.success('Producto creado exitosamente');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error('Error al guardar el producto. Verifique que el SKU sea único.');
    }
  };

  const isLoading = createProduct.isPending || updateProduct.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[1200px] w-[95vw] md:w-[95vw] w-[calc(100%-1rem)] h-[95vh] md:h-[90vh] p-0 overflow-hidden flex flex-col bg-slate-50 border-slate-200"
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        
        {/* Header (Sticky) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white border-b border-slate-200 shrink-0 z-10 shadow-sm gap-2">
          <div>
            <DialogTitle className="text-[18px] md:text-[22px] font-bold text-slate-900">
              {isEditing ? 'Editar Producto' : 'Añadir Nuevo Producto'}
            </DialogTitle>
            <p className="text-[12px] md:text-[13px] text-slate-500 mt-0.5">
              Ingrese los detalles técnicos y de inventario para el repuesto.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {isEditing && product && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (window.confirm('¿Está seguro de que desea eliminar este repuesto de forma permanente?')) {
                    deleteProduct.mutate(product.id, {
                      onSuccess: () => {
                        toast.success('Producto eliminado exitosamente');
                        onOpenChange(false);
                      },
                      onError: () => toast.error('Error al eliminar el producto')
                    });
                  }
                }}
                disabled={deleteProduct.isPending || isLoading}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-medium px-3 text-[12px]"
              >
                {deleteProduct.isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-slate-300 text-slate-700 font-medium px-3 text-[12px]">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 gap-1.5 text-[12px]">
              <Save className="w-3.5 h-3.5" />
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 md:gap-6 items-start">
            
            {/* Left Column */}
            <div className="space-y-6">
              
              {/* Información Principal */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-[15px] text-slate-900">Información Principal</h3>
                </div>
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                          Nombre del Producto *
                        </label>
                        <button
                          type="button"
                          onClick={handleStandardizeName}
                          disabled={isStandardizing}
                          className="text-[10px] text-amber-600 font-bold hover:text-amber-700 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                          title="Estandarizar nombre con IA"
                        >
                          <Sparkles className="w-3 h-3" />
                          {isStandardizing ? '...' : 'Estandarizar'}
                        </button>
                      </div>
                      <Input
                        {...register('name')}
                        placeholder="Ej. Amortiguador Delantero Gas"
                        className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 text-[14px]"
                      />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
                        SKU / Código de Pieza *
                      </label>
                      <Input
                        {...register('code')}
                        placeholder="EJ. KYB-343290"
                        className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 font-mono text-[14px] uppercase"
                        style={{ textTransform: 'uppercase' }}
                      />
                      {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
                        Categoría y Subcategoría
                      </label>
                      <select
                        {...register('category_id')}
                        className="flex h-[36px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 text-[14px]"
                      >
                        <option value="">Seleccionar categoría...</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.section} — {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
                        Marca del Repuesto
                      </label>
                      <select
                        {...register('brand_id')}
                        className="flex h-[36px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 text-[14px]"
                      >
                        <option value="">Seleccionar marca...</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
                        Ubicación Fila/Estante
                      </label>
                      <Input
                        {...register('location')}
                        placeholder="Ej. A-12-04"
                        className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 text-[14px]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Descripción Técnica
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateDescription}
                        disabled={isGeneratingDesc}
                        className="text-[10px] text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                        title="Generar descripción con IA usando el nombre y código"
                      >
                        <Sparkles className="w-3 h-3" />
                        {isGeneratingDesc ? 'Generando...' : 'Generar con IA'}
                      </button>
                    </div>
                    <Textarea
                      {...register('description')}
                      placeholder="Detalles adicionales, especificaciones, notas de compatibilidad..."
                      className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 min-h-[100px] text-[14px] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Compatibilidad con Cotizadores (Kits) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-[15px] text-slate-900">Cotizadores (Motores / T. Delantero)</h3>
                </div>
                <div className="p-5 space-y-5">
                  <p className="text-[12px] text-slate-500">
                    Selecciona a qué cotizadores pre-armados pertenece este repuesto.
                  </p>

                  {/* Motores */}
                  {kits.filter(k => k.category === 'Motor').length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Motores</p>
                      <div className="grid grid-cols-2 gap-2">
                        {kits.filter(k => k.category === 'Motor').map((kit) => (
                          <label key={kit.id} className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              value={kit.id}
                              {...register('compatible_kits')}
                              className="mt-1 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{kit.name}</p>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tren Delantero */}
                  {kits.filter(k => k.category === 'Tren Delantero').length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tren Delantero</p>
                      <div className="grid grid-cols-2 gap-2">
                        {kits.filter(k => k.category === 'Tren Delantero').map((kit) => (
                          <label key={kit.id} className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              value={kit.id}
                              {...register('compatible_kits')}
                              className="mt-1 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{kit.name}</p>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {kits.length === 0 && (
                    <p className="text-[12px] text-slate-400 text-center py-4">No hay cotizadores creados.</p>
                  )}
                </div>
              </div>

              {/* Compatibilidad (Fitment) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-[15px] text-slate-900">Compatibilidad (Fitment)</h3>
                  <Button variant="ghost" size="sm" onClick={handleAddFitment} className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs font-medium px-3">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Añadir Vehículo
                  </Button>
                </div>
                <div className="p-5 space-y-5">
                  {/* Vehículos Añadidos */}
                  {fitmentFields.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {fitmentFields.map((field, index) => (
                        <Badge key={field.id} variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-2">
                          {field.make} {field.model} ({field.year})
                          <button type="button" onClick={() => removeFitment(index)} className="hover:text-red-500 transition-colors focus:outline-none">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Formulario para añadir */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Marca</label>
                      <Input 
                        placeholder="Ej. Toyota" 
                        value={fitmentInput.make}
                        onChange={e => setFitmentInput(s => ({...s, make: e.target.value}))}
                        className="bg-slate-50 border-slate-200 text-[13px]" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Modelo</label>
                      <Input 
                        placeholder="Ej. Corolla" 
                        value={fitmentInput.model}
                        onChange={e => setFitmentInput(s => ({...s, model: e.target.value}))}
                        className="bg-slate-50 border-slate-200 text-[13px]" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Año Rango</label>
                      <Input 
                        placeholder="Ej. 2009-2014" 
                        value={fitmentInput.year}
                        onChange={e => setFitmentInput(s => ({...s, year: e.target.value}))}
                        className="bg-slate-50 border-slate-200 text-[13px]" 
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Precios e Inventario */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-[15px] text-slate-900">Precios (Sin Stock)</h3>
                </div>
                <div className="p-5 space-y-5">
                  <div className="grid gap-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Costo (USD)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const currentCost = watchCost || 0;
                            if (currentCost > 0) {
                              const sinIva = Number((currentCost / 1.16).toFixed(2));
                              setValue('cost', sinIva, { shouldDirty: true });
                              toast.info(`IVA descontado: ${formatUSD(currentCost)} → ${formatUSD(sinIva)}`);
                            }
                          }}
                          className="text-[10px] text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full"
                          title="Dividir el costo entre 1.16 para quitar el IVA"
                        >
                          Descontar IVA
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                        <Input
                          {...register('cost')}
                          type="number"
                          step="0.01"
                          className="pl-7 bg-slate-50 border-slate-200 text-[14px] font-mono text-slate-900"
                        />
                      </div>
                      {errors.cost && <p className="text-xs text-red-500 mt-1">{errors.cost.message}</p>}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Precio Divisas (USD)
                        </label>
                        <button
                          type="button"
                          onClick={handleApplyMargin}
                          className="text-[10px] text-emerald-600 font-bold hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full"
                          title="Calcular usando el margen de configuración"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Margen ({marginPercentage}%)
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                        <Input
                          {...register('price_usd')}
                          type="number"
                          step="0.01"
                          className="pl-7 bg-slate-50 border-slate-200 text-[14px] font-mono font-semibold text-slate-900"
                        />
                      </div>
                      {errors.price_usd && <p className="text-xs text-red-500 mt-1">{errors.price_usd.message}</p>}
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Precio Calculado (VES)</span>
                        <span className="text-[10px] font-medium text-slate-500">Tasa: Bs {bcvRate.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-[11px] text-slate-500 font-medium mt-1">Multiplicador x{bcvMultiplier}</span>
                        <span className="text-[18px] font-bold text-slate-900">Bs {priceBcv}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-200/60">
                        <span>USD Equivalente:</span>
                        <span className="font-mono text-slate-500">${priceUsdBcv}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fotografía */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-[15px] text-slate-900">Fotografías</h3>
                  <span className="text-[11px] text-slate-500 font-medium">{(watch('image_urls') || []).length} de 5 max</span>
                </div>
                <div className="p-5">
                  {/* Selected Images Gallery */}
                  {(watch('image_urls') || []).length > 0 && (
                    <div className="grid grid-cols-5 gap-2 mb-4">
                      {(watch('image_urls') || []).map((url, idx) => (
                        <div key={idx} className={`relative aspect-square rounded-lg overflow-hidden border-2 ${idx === 0 ? 'border-emerald-500' : 'border-slate-200'} group`}>
                          <img src={url} alt={`Sel ${idx}`} className="w-full h-full object-contain bg-white" />
                          {idx === 0 && (
                            <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[9px] font-bold px-1.5 rounded-br">Principal</div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = watch('image_urls') || [];
                              const newImages = current.filter((_, i) => i !== idx);
                              setValue('image_urls', newImages, { shouldDirty: true });
                              if (idx === 0) {
                                const newMain = newImages[0] || '';
                                setValue('image_url', newMain, { shouldDirty: true });
                                setPreviewUrl(newMain);
                              }
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Main Image Dropzone (optional if less than 5) */}
                  {(watch('image_urls') || []).length < 5 && (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`
                        border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all duration-200
                        ${isUploading ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}
                      `}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center justify-center">
                          <Upload className="w-6 h-6 text-emerald-500 animate-bounce mb-2" />
                          <span className="text-xs font-medium text-slate-600">Subiendo...</span>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          </div>
                          <h4 className="text-[13px] font-semibold text-slate-700 mb-1">Subir imagen manual</h4>
                          <p className="text-[11px] text-slate-500">Max: 2MB</p>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('La imagen no debe superar los 2MB');
                            return;
                          }
                          const tempCode = watch('code') || 'NEW';
                          try {
                            setIsUploading(true);
                            const publicUrl = await uploadImage.mutateAsync({ file, productCode: tempCode });
                            const current = watch('image_urls') || [];
                            const newImages = [...current, publicUrl];
                            setValue('image_urls', newImages, { shouldDirty: true });
                            if (newImages.length === 1) {
                              setValue('image_url', publicUrl, { shouldDirty: true });
                              setPreviewUrl(publicUrl);
                            }
                            toast.success('Imagen subida temporalmente.');
                          } catch (err) {
                            toast.error('Error al subir la imagen');
                          } finally {
                            setIsUploading(false);
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Paste image URL */}
                  {(watch('image_urls') || []).length < 5 && (
                    <div className="flex gap-1.5 mt-3">
                      <Input
                        placeholder="Pegar URL de imagen..."
                        id="paste-image-url"
                        className="bg-white border-slate-200 text-[12px] h-8 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.currentTarget;
                            const url = input.value.trim();
                            if (!url || !url.startsWith('http')) {
                              toast.error('Pega una URL válida que empiece con http');
                              return;
                            }
                            const current = watch('image_urls') || [];
                            if (current.length >= 5) {
                              toast.error('Máximo 5 imágenes');
                              return;
                            }
                            const newImages = [...current, url];
                            setValue('image_urls', newImages, { shouldDirty: true });
                            if (newImages.length === 1) {
                              setValue('image_url', url, { shouldDirty: true });
                              setPreviewUrl(url);
                            }
                            input.value = '';
                            toast.success('Imagen añadida desde URL');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('paste-image-url') as HTMLInputElement;
                          const url = input?.value?.trim();
                          if (!url || !url.startsWith('http')) {
                            toast.error('Pega una URL válida que empiece con http');
                            return;
                          }
                          const current = watch('image_urls') || [];
                          if (current.length >= 5) {
                            toast.error('Máximo 5 imágenes');
                            return;
                          }
                          const newImages = [...current, url];
                          setValue('image_urls', newImages, { shouldDirty: true });
                          if (newImages.length === 1) {
                            setValue('image_url', url, { shouldDirty: true });
                            setPreviewUrl(url);
                          }
                          input.value = '';
                          toast.success('Imagen añadida desde URL');
                        }}
                        className="text-[10px] text-white font-bold bg-slate-600 hover:bg-slate-700 px-3 rounded-md transition-colors shrink-0 h-8"
                      >
                        + Añadir
                      </button>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Buscador con IA
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSearchImages()}
                        disabled={isSearchingImages || (watch('image_urls') || []).length >= 5}
                        className="text-[10px] text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                      >
                        <SearchIcon className="w-3 h-3" />
                        {isSearchingImages ? 'Buscando...' : 'Buscar Imágenes IA'}
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Buscar imágenes... ej: pistones ford 300"
                        value={customImageQuery}
                        onChange={(e) => setCustomImageQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchImages(customImageQuery);
                          }
                        }}
                        className="bg-white border-slate-200 text-[12px] h-8 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleSearchImages(customImageQuery)}
                        disabled={isSearchingImages || !customImageQuery.trim()}
                        className="text-[10px] text-white font-bold bg-blue-500 hover:bg-blue-600 px-3 rounded-md transition-colors disabled:opacity-50 shrink-0 h-8"
                      >
                        <SearchIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Image Search Results Gallery */}
                    {imageSearchResults.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Haz clic en hasta 5 imágenes:</p>
                          <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {(watch('image_urls') || []).length}/5
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                          {imageSearchResults.map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const current = watch('image_urls') || [];
                                if (current.length >= 5) {
                                  toast.error('Ya has seleccionado el máximo de 5 imágenes.');
                                  return;
                                }
                                if (current.includes(url)) {
                                  toast.error('Ya seleccionaste esta imagen.');
                                  return;
                                }
                                const newImages = [...current, url];
                                setValue('image_urls', newImages, { shouldDirty: true });
                                if (newImages.length === 1) {
                                  setValue('image_url', url, { shouldDirty: true });
                                  setPreviewUrl(url);
                                }
                                toast.success('Imagen añadida a la selección');
                              }}
                              className={`aspect-video relative rounded overflow-hidden border-2 transition-all bg-white group ${(watch('image_urls') || []).includes(url) ? 'border-emerald-500 opacity-50 cursor-not-allowed' : 'border-transparent hover:border-blue-500'}`}
                            >
                              <img src={url} alt={`Option ${idx + 1}`} className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                              {!(watch('image_urls') || []).includes(url) && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white text-[10px] font-bold px-2 py-1 bg-blue-600 rounded flex items-center gap-1"><Plus className="w-3 h-3"/> Añadir</span>
                                </div>
                              )}
                              {(watch('image_urls') || []).includes(url) && (
                                <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                  <span className="text-emerald-700 bg-white/90 text-[10px] font-bold px-2 py-1 rounded">Añadida</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
