'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product, Category, Setting, Quote, QuoteItem, AuditLogEntry } from '@/types';

// Helper for audit logging with graceful fallback if table does not exist
async function logAuditAction(entry: Omit<AuditLogEntry, 'id' | 'created_at'> | Array<Omit<AuditLogEntry, 'id' | 'created_at'>>) {
  try {
    const { error } = await supabase.from('inventory_audit_log').insert(entry as any);
    if (error) {
      console.warn('Audit log notice (table may need creation via SQL script):', error.message);
    }
  } catch (err) {
    console.warn('Audit log error:', err);
  }
}

// ========== Products ==========
const PRODUCT_LIST_SELECT =
  'id, code, name, category_id, brand_id, cost, price_usd, image_url, stock, min_stock, is_active, is_wholesale, created_at, updated_at, categories(id, name, section), brands(id, name, logo_url), kit_items(kit_id)';

function toListProduct(row: any): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category_id: row.category_id ?? null,
    brand_id: row.brand_id ?? null,
    cost: row.cost ?? 0,
    price_usd: row.price_usd ?? 0,
    image_url: row.image_url,
    stock: row.stock,
    min_stock: row.min_stock,
    is_active: row.is_active,
    is_wholesale: row.is_wholesale,
    created_at: row.created_at,
    updated_at: row.updated_at,
    categories: row.categories,
    brands: row.brands,
    kit_items: row.kit_items,
  };
}

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ['products'],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const allProducts: Product[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_LIST_SELECT)
          .order('code', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allProducts.push(...(data as unknown as Product[]));
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allProducts;
    },
  });
}

export function useProductById(productId?: string | null, enabled = true) {
  return useQuery<Product>({
    queryKey: ['product_detail', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(*), brands(*), kit_items(kit_id)')
        .eq('id', productId!)
        .single();
      if (error) throw error;
      return data as Product;
    },
    enabled: Boolean(enabled && productId),
    staleTime: 0,
  });
}

export function useProductsWithoutDescription(enabled: boolean) {
  return useQuery<Product[]>({
    queryKey: ['products_without_description'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, cost, price_usd, stock, min_stock, description')
        .or('description.is.null,description.eq.');
      if (error) throw error;
      return ((data || []) as Product[]).filter(
        (p) => !p.description || p.description.trim().length < 5
      );
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: Partial<Product> & { id: string, compatible_kits?: string[] }) => {
      const { id, categories, created_at, compatible_kits, brands, kit_items, ...updateData } = product as any;
      let { data, error } = await supabase
        .from('products')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, categories(*), brands(*), kit_items(kit_id)')
        .single();

      if (error && error.code === '42703' && error.message?.includes('min_stock')) {
        const { min_stock, ...restUpdate } = updateData;
        const fallback = await supabase
          .from('products')
          .update({ ...restUpdate, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*, categories(*), brands(*), kit_items(kit_id)')
          .single();
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      } else if (error) {
        throw error;
      }

      if (compatible_kits) {
        // Track previous kit items for audit logging
        let prevKitItems: any[] = [];
        try {
          const { data: currentItems } = await supabase
            .from('kit_items')
            .select('kit_id, kits(id, name, category)')
            .eq('product_id', id);
          prevKitItems = currentItems || [];
        } catch (e) {
          console.warn('Error reading prev kit items:', e);
        }

        const prevKitIds = prevKitItems.map((k: any) => k.kit_id);
        const newKitIds = Array.from(new Set<string>(compatible_kits as string[]));

        const removedKitIds = prevKitIds.filter((kId: string) => !newKitIds.includes(kId));
        const addedKitIds = newKitIds.filter((kId: string) => !prevKitIds.includes(kId));

        // Sync kits safely via diff: delete only removed links and insert only newly added links
        if (removedKitIds.length > 0) {
          const { error: delKitError } = await supabase
            .from('kit_items')
            .delete()
            .eq('product_id', id)
            .in('kit_id', removedKitIds);
          if (delKitError) throw delKitError;
        }
        if (addedKitIds.length > 0) {
          const insertData = addedKitIds.map((kitId: string) => ({
            kit_id: kitId,
            product_id: id,
            quantity: 1,
          }));
          const { error: insKitError } = await supabase.from('kit_items').insert(insertData);
          if (insKitError) throw insKitError;
        }
        data = {
          ...data,
          kit_items: newKitIds.map((kit_id) => ({ kit_id })),
        };

        // Audit removed kit connections
        if (removedKitIds.length > 0) {
          const auditRemovals = removedKitIds.map((kId: string) => {
            const prev = prevKitItems.find((k: any) => k.kit_id === kId);
            return {
              action_type: 'kit_disconnected' as const,
              entity_type: 'kit_item' as const,
              entity_id: id,
              entity_code: data?.code || (product as any).code || '',
              entity_name: data?.name || (product as any).name || '',
              details: {
                kit_id: kId,
                kit_name: prev?.kits?.name || 'Cotizador',
                kit_category: prev?.kits?.category || '',
                product_id: id,
                product_code: data?.code || (product as any).code || '',
                product_name: data?.name || (product as any).name || '',
                quantity: 1,
              },
              is_reverted: false,
            };
          });
          await logAuditAction(auditRemovals);
        }

        // Audit added kit connections
        if (addedKitIds.length > 0) {
          const { data: addedKitsData } = await supabase
            .from('kits')
            .select('id, name, category')
            .in('id', addedKitIds);

          const auditAdditions = addedKitIds.map((kId: string) => {
            const kitInfo = addedKitsData?.find((k: any) => k.id === kId);
            return {
              action_type: 'kit_connected' as const,
              entity_type: 'kit_item' as const,
              entity_id: id,
              entity_code: data?.code || (product as any).code || '',
              entity_name: data?.name || (product as any).name || '',
              details: {
                kit_id: kId,
                kit_name: kitInfo?.name || 'Cotizador',
                kit_category: kitInfo?.category || '',
                product_id: id,
                product_code: data?.code || (product as any).code || '',
                product_name: data?.name || (product as any).name || '',
                quantity: 1,
              },
              is_reverted: false,
            };
          });
          await logAuditAction(auditAdditions);
        }
      }

      return data;
    },
    onSuccess: (updatedProduct, variables) => {
      queryClient.setQueryData<Product[]>(['products'], (prev) =>
        prev
          ? prev.map((p) =>
              p.id === updatedProduct.id ? { ...p, ...toListProduct(updatedProduct) } : p
            )
          : prev
      );
      queryClient.setQueryData<Product>(['product_detail', updatedProduct.id], updatedProduct as Product);
      if (variables.description !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['products_without_description'] });
      }
      if (variables.compatible_kits !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['kits'] });
        queryClient.invalidateQueries({ queryKey: ['audit_history'] });
      }
      queryClient.invalidateQueries({ queryKey: ['kit_items'] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'categories' | 'brands' | 'kit_items'>, compatible_kits?: string[] }) => {
      let { data, error } = await supabase
        .from('products')
        .insert(payload.product)
        .select('*, categories(*), brands(*)')
        .single();

      if (error && error.code === '42703' && error.message?.includes('min_stock')) {
        const { min_stock, ...restProduct } = payload.product as any;
        const fallback = await supabase
          .from('products')
          .insert(restProduct)
          .select('*, categories(*), brands(*)')
          .single();
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      } else if (error) {
        throw error;
      }

      if (payload.compatible_kits && payload.compatible_kits.length > 0) {
        const uniqueKitIds = Array.from(new Set<string>(payload.compatible_kits as string[]));
        const insertData = uniqueKitIds.map((kitId: string) => ({
          kit_id: kitId,
          product_id: data.id,
          quantity: 1,
        }));
        await supabase.from('kit_items').insert(insertData);
        data = {
          ...data,
          kit_items: uniqueKitIds.map((kit_id) => ({ kit_id })),
        };

        // Fetch kit names for audit logging
        try {
          const { data: kitsData } = await supabase
            .from('kits')
            .select('id, name, category')
            .in('id', uniqueKitIds);

          const auditAdditions = uniqueKitIds.map((kitId: string) => {
            const kitInfo = kitsData?.find((k: any) => k.id === kitId);
            return {
              action_type: 'kit_connected' as const,
              entity_type: 'kit_item' as const,
              entity_id: data.id,
              entity_code: data.code,
              entity_name: data.name,
              details: {
                kit_id: kitId,
                kit_name: kitInfo?.name || 'Cotizador',
                kit_category: kitInfo?.category || '',
                product_id: data.id,
                product_code: data.code,
                product_name: data.name,
                quantity: 1,
              },
              is_reverted: false,
            };
          });
          await logAuditAction(auditAdditions);
        } catch (e) {
          console.warn('Error auditing kit additions on product create:', e);
        }
      } else {
        data = { ...data, kit_items: [] };
      }

      return data;
    },
    onSuccess: (createdProduct, variables) => {
      queryClient.setQueryData<Product[]>(['products'], (prev) =>
        prev ? [...prev, toListProduct(createdProduct)] : prev
      );
      queryClient.invalidateQueries({ queryKey: ['products_without_description'] });
      if (variables.compatible_kits && variables.compatible_kits.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['kits'] });
        queryClient.invalidateQueries({ queryKey: ['kit_items'] });
        queryClient.invalidateQueries({ queryKey: ['audit_history'] });
      }
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Capture snapshot of product and kit associations before deletion
      try {
        const { data: prod } = await supabase
          .from('products')
          .select('*, kit_items(kit_id, quantity, kits(id, name, category))')
          .eq('id', id)
          .maybeSingle();

        if (prod) {
          const { kit_items, categories, brands, ...rawProduct } = prod;
          await logAuditAction({
            action_type: 'product_deleted',
            entity_type: 'product',
            entity_id: prod.id,
            entity_code: prod.code,
            entity_name: prod.name,
            details: {
              product_snapshot: rawProduct,
              kit_associations: (kit_items || []).map((k: any) => ({
                kit_id: k.kit_id,
                kit_name: k.kits?.name || 'Cotizador',
                category: k.kits?.category || '',
                quantity: k.quantity || 1,
              })),
            },
            is_reverted: false,
          });
        }
      } catch (e) {
        console.warn('Error capturing product snapshot for audit:', e);
      }

      // 2. Perform deletion
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Product[]>(['products'], (prev) =>
        prev ? prev.filter((p) => p.id !== deletedId) : prev
      );
      queryClient.removeQueries({ queryKey: ['product_detail', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['products_without_description'] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      queryClient.invalidateQueries({ queryKey: ['kit_items'] });
      queryClient.invalidateQueries({ queryKey: ['audit_history'] });
    },
  });
}

export function useBulkDeleteProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      // 1. Capture snapshots before deletion
      try {
        const { data: prods } = await supabase
          .from('products')
          .select('*, kit_items(kit_id, quantity, kits(id, name, category))')
          .in('id', ids);

        if (prods && prods.length > 0) {
          const auditEntries = prods.map((prod: any) => {
            const { kit_items, categories, brands, ...rawProduct } = prod;
            return {
              action_type: 'product_deleted' as const,
              entity_type: 'product' as const,
              entity_id: prod.id,
              entity_code: prod.code,
              entity_name: prod.name,
              details: {
                product_snapshot: rawProduct,
                kit_associations: (kit_items || []).map((k: any) => ({
                  kit_id: k.kit_id,
                  kit_name: k.kits?.name || 'Cotizador',
                  category: k.kits?.category || '',
                  quantity: k.quantity || 1,
                })),
              },
              is_reverted: false,
            };
          });
          await logAuditAction(auditEntries);
        }
      } catch (e) {
        console.warn('Error capturing bulk product snapshot for audit:', e);
      }

      // 2. Perform deletion
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (deletedIds) => {
      const deletedSet = new Set(deletedIds);
      queryClient.setQueryData<Product[]>(['products'], (prev) =>
        prev ? prev.filter((p) => !deletedSet.has(p.id)) : prev
      );
      deletedIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: ['product_detail', id] });
      });
      queryClient.invalidateQueries({ queryKey: ['products_without_description'] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      queryClient.invalidateQueries({ queryKey: ['kit_items'] });
      queryClient.invalidateQueries({ queryKey: ['audit_history'] });
    },
  });
}

export function useBulkUpdateProductsActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      is_active,
    }: {
      ids: string[];
      is_active: boolean;
      kitId?: string;
    }) => {
      if (ids.length === 0) return [];
      const { error } = await supabase
        .from('products')
        .update({ is_active, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (updatedIds, variables) => {
      const idSet = new Set(updatedIds);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<Product[]>(['products'], (prev) =>
        prev
          ? prev.map((p) =>
              idSet.has(p.id)
                ? { ...p, is_active: variables.is_active, updated_at: nowIso }
                : p
            )
          : prev
      );
      updatedIds.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: ['product_detail', id] });
      });
      if (variables.kitId) {
        queryClient.invalidateQueries({ queryKey: ['kit_items', variables.kitId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['kit_items'] });
      }
    },
  });
}

export function useBulkInsertProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (products: any[]) => {
      // Using upsert to handle existing SKUs gracefully
      const { data, error } = await supabase
        .from('products')
        .upsert(products, { onConflict: 'code' })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useBulkUpdateStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { code: string; name: string; stock: number }[]) => {
      const { data, error } = await supabase
        .from('products')
        .upsert(updates, { onConflict: 'code' })
        .select('id, code, stock');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ========== Categories ==========
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('section', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Omit<Category, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('categories')
        .insert(category)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<Category> & { id: string }) => {
      const { id, created_at, ...updateData } = category as any;
      const { data, error } = await supabase
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Products might need updated category names
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refetch products to show unassigned categories
    },
  });
}

// ========== Settings (Unified Single Query + Selector Hooks) ==========
export const APP_SETTINGS_QUERY_KEY = ['app_settings'] as const;

async function fetchAppSettingsMap(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value');
  if (error) throw error;

  const map: Record<string, number> = {};
  for (const row of data || []) {
    if (row.key) {
      const parsed = Number(row.value);
      if (!Number.isNaN(parsed)) {
        map[row.key] = parsed;
      }
    }
  }

  // Si aún no existe binance_rate en settings, consultar en tiempo real desde la API y persistir
  if (!map.binance_rate || map.binance_rate <= 0) {
    try {
      const res = await fetch('/api/bcv-rate?only=binance', { cache: 'no-store' });
      const apiData = await res.json();
      if (apiData?.success && typeof apiData.binanceRate === 'number' && apiData.binanceRate > 0) {
        await supabase
          .from('settings')
          .upsert({ key: 'binance_rate', value: apiData.binanceRate, updated_at: new Date().toISOString() });
        map.binance_rate = Number(apiData.binanceRate);
      }
    } catch {
      // Ignorar fallo de red inicial
    }
  }

  return map;
}

export function useAppSettings() {
  return useQuery<Record<string, number>>({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettingsMap,
    staleTime: 60 * 1000,
  });
}

export function useBcvRate() {
  return useQuery<Record<string, number>, Error, number>({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettingsMap,
    staleTime: 60 * 1000,
    select: (map) => map.bcv_rate ?? 0,
  });
}

export function useUpdateBcvRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newRate: number) => {
      const { error } = await supabase
        .from('settings')
        .update({ value: newRate, updated_at: new Date().toISOString() })
        .eq('key', 'bcv_rate');
      if (error) throw error;
      return newRate;
    },
    onSuccess: (newRate) => {
      queryClient.setQueryData<Record<string, number>>(APP_SETTINGS_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        bcv_rate: newRate,
      }));
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
    },
  });
}

export function useBinanceRate() {
  return useQuery<Record<string, number>, Error, number>({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettingsMap,
    staleTime: 60 * 1000,
    select: (map) => map.binance_rate ?? 0,
  });
}

export function useUpdateBinanceRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newRate: number) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'binance_rate', value: newRate, updated_at: new Date().toISOString() });
      if (error) throw error;
      return newRate;
    },
    onSuccess: (newRate) => {
      queryClient.setQueryData<Record<string, number>>(APP_SETTINGS_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        binance_rate: newRate,
      }));
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
    },
  });
}

export function useMarginPercentage() {
  return useQuery<Record<string, number>, Error, number>({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettingsMap,
    staleTime: 60 * 1000,
    select: (map) => map.margin_percentage ?? 40,
  });
}

export function useUpdateMarginPercentage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newMargin: number) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'margin_percentage', value: newMargin, updated_at: new Date().toISOString() });
      if (error) throw error;
      return newMargin;
    },
    onSuccess: (newMargin) => {
      queryClient.setQueryData<Record<string, number>>(APP_SETTINGS_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        margin_percentage: newMargin,
      }));
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
    },
  });
}

export function useBcvMultiplier() {
  return useQuery<Record<string, number>, Error, number>({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettingsMap,
    staleTime: 60 * 1000,
    select: (map) => map.bcv_multiplier ?? 1.40,
  });
}

export function useUpdateBcvMultiplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newMultiplier: number) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'bcv_multiplier', value: newMultiplier, updated_at: new Date().toISOString() });
      if (error) throw error;
      return newMultiplier;
    },
    onSuccess: (newMultiplier) => {
      queryClient.setQueryData<Record<string, number>>(APP_SETTINGS_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        bcv_multiplier: newMultiplier,
      }));
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
    },
  });
}

export function useDefaultMinStock() {
  return useQuery<Record<string, number>, Error, number>({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettingsMap,
    staleTime: 60 * 1000,
    select: (map) => map.default_min_stock ?? 0,
  });
}

export function useUpdateDefaultMinStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newValue: number) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'default_min_stock', value: newValue, updated_at: new Date().toISOString() });
      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      queryClient.setQueryData<Record<string, number>>(APP_SETTINGS_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        default_min_stock: newValue,
      }));
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useBulkUpdateMinStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      minStock,
      filterType,
      filterValue,
      onlyWithoutRule,
    }: {
      minStock: number;
      filterType: 'all' | 'category' | 'brand';
      filterValue?: string;
      onlyWithoutRule?: boolean;
    }) => {
      let query = supabase.from('products').update({ min_stock: minStock, updated_at: new Date().toISOString() });

      // Solo aplicar a productos que tienen precio asignado (> 0)
      query = query.gt('price_usd', 0);

      if (filterType === 'category' && filterValue) {
        query = query.eq('category_id', filterValue);
      } else if (filterType === 'brand' && filterValue) {
        query = query.eq('brand_id', filterValue);
      }

      if (onlyWithoutRule) {
        query = query.or('min_stock.is.null,min_stock.eq.0');
      }

      const { data, error } = await query.select('id');
      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ========== Quotes ==========
export function useQuotes() {
  return useQuery<Quote[]>({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quote,
      items,
    }: {
      quote: Omit<Quote, 'id' | 'created_at'>;
      items: Omit<QuoteItem, 'id' | 'quote_id'>[];
    }) => {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert(quote)
        .select()
        .single();
      if (quoteError) throw quoteError;

      const quoteItems = items.map((item) => ({
        ...item,
        quote_id: quoteData.id,
      }));
      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems);
      if (itemsError) throw itemsError;

      return quoteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

// ========== Image Upload ==========
export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ file, productCode }: { file: File; productCode: string }) => {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const sanitizedCode = (productCode || 'PROD').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${sanitizedCode}-${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    },
  });
}

export function useUploadKitImage() {
  return useMutation({
    mutationFn: async ({ file, kitId }: { file: File; kitId: string }) => {
      const fileExt = file.name.split('.').pop() || 'jpg';
      // Use a random string if kitId is not available yet (creating new kit)
      const prefix = (kitId || Math.random().toString(36).substring(7)).replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `kit-${prefix}-${Date.now()}.${fileExt}`;
      const filePath = `kits/${fileName}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    },
  });
}

// ========== Kits ==========
export function useKits(category?: string, options?: { enabled?: boolean }) {
  return useQuery<any[]>({
    queryKey: ['kits', category],
    queryFn: async () => {
      let query = supabase.from('kits').select('*, kit_items(*), vehicle_brands(*)').order('name', { ascending: true });
      if (category) {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCreateKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kit: any) => {
      const { data, error } = await supabase.from('kits').insert(kit).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}

export function useUpdateKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kit: any) => {
      const { id, ...updateData } = kit;
      const { data, error } = await supabase.from('kits').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}

export function useDeleteKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kits').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}

export function useKitItems(kitId: string) {
  return useQuery<any[]>({
    queryKey: ['kit_items', kitId],
    queryFn: async () => {
      if (!kitId) return [];
      const { data, error } = await supabase
        .from('kit_items')
        .select('*, products(*, categories(*), brands(*), kit_items(kit_id))')
        .eq('kit_id', kitId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!kitId,
  });
}

export function useCreateKitItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kitItem: any) => {
      // 1. Verificar en base de datos si el repuesto ya está en este cotizador
      if (kitItem.kit_id && kitItem.product_id) {
        const { data: existing, error: checkError } = await supabase
          .from('kit_items')
          .select('id')
          .eq('kit_id', kitItem.kit_id)
          .eq('product_id', kitItem.product_id)
          .maybeSingle();

        if (existing) {
          throw new Error('Este repuesto ya se encuentra vinculado en este cotizador.');
        }
      }

      const { data, error } = await supabase.from('kit_items').insert(kitItem).select().single();
      if (error) throw error;

      // Log in audit table
      try {
        const [{ data: kitData }, { data: prodData }] = await Promise.all([
          supabase.from('kits').select('id, name, category').eq('id', kitItem.kit_id).maybeSingle(),
          supabase.from('products').select('id, code, name').eq('id', kitItem.product_id).maybeSingle(),
        ]);

        await logAuditAction({
          action_type: 'kit_connected',
          entity_type: 'kit_item',
          entity_id: data.id,
          entity_code: prodData?.code || '',
          entity_name: prodData?.name || '',
          details: {
            kit_id: kitItem.kit_id,
            kit_name: kitData?.name || 'Cotizador',
            kit_category: kitData?.category || '',
            product_id: kitItem.product_id,
            product_code: prodData?.code || '',
            product_name: prodData?.name || '',
            quantity: kitItem.quantity || 1,
          },
          is_reverted: false,
        });
      } catch (err) {
        console.warn('Error auditing kit_connected in useCreateKitItem:', err);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      queryClient.invalidateQueries({ queryKey: ['kit_items', variables.kit_id] });
      queryClient.invalidateQueries({ queryKey: ['audit_history'] });
    },
  });
}

export function useDeleteKitItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kitId }: { id: string; kitId: string }) => {
      // 1. Fetch info before deletion for audit log
      try {
        const { data: itemData } = await supabase
          .from('kit_items')
          .select('id, kit_id, product_id, quantity, kits(id, name, category), products(id, code, name)')
          .eq('id', id)
          .maybeSingle();

        if (itemData) {
          const kitInfo = itemData.kits as any;
          const prodInfo = itemData.products as any;
          await logAuditAction({
            action_type: 'kit_disconnected',
            entity_type: 'kit_item',
            entity_id: id,
            entity_code: prodInfo?.code || '',
            entity_name: prodInfo?.name || '',
            details: {
              kit_id: itemData.kit_id,
              kit_name: kitInfo?.name || 'Cotizador',
              kit_category: kitInfo?.category || '',
              product_id: itemData.product_id,
              product_code: prodInfo?.code || '',
              product_name: prodInfo?.name || '',
              quantity: itemData.quantity || 1,
            },
            is_reverted: false,
          });
        }
      } catch (err) {
        console.warn('Error auditing kit_disconnected in useDeleteKitItem:', err);
      }

      const { error } = await supabase.from('kit_items').delete().eq('id', id);
      if (error) throw error;
      return { id, kitId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      queryClient.invalidateQueries({ queryKey: ['kit_items', variables.kitId] });
      queryClient.invalidateQueries({ queryKey: ['audit_history'] });
    },
  });
}

// ========== Kit Combos ==========
export function useKitCombos(kitId: string) {
  return useQuery<any[]>({
    queryKey: ['kit_combos', kitId],
    queryFn: async () => {
      if (!kitId) return [];
      const { data, error } = await supabase
        .from('kit_combos')
        .select('*, kit_combo_items(*, products(*, brands(*), categories(*)))')
        .eq('kit_id', kitId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!kitId,
  });
}

export function useCreateKitCombo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (combo: { kit_id: string; name: string }) => {
      const { data, error } = await supabase.from('kit_combos').insert(combo).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kit_combos', variables.kit_id] });
    },
  });
}

export function useUpdateKitCombo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, kitId }: { id: string; name: string; kitId: string }) => {
      const { data, error } = await supabase.from('kit_combos').update({ name }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kit_combos', variables.kitId] });
    },
  });
}

export function useDeleteKitCombo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kitId }: { id: string; kitId: string }) => {
      const { error } = await supabase.from('kit_combos').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kit_combos', variables.kitId] });
    },
  });
}

export function useSaveComboItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ comboId, items }: { comboId: string; items: { product_id: string; quantity: number }[] }) => {
      // First, delete all existing items for this combo
      const { error: deleteError } = await supabase.from('kit_combo_items').delete().eq('combo_id', comboId);
      if (deleteError) throw deleteError;

      // Then insert the new ones if any
      if (items.length > 0) {
        const rows = items.map(item => ({
          combo_id: comboId,
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        const { error: insertError } = await supabase.from('kit_combo_items').insert(rows);
        if (insertError) throw insertError;
      }
      return comboId;
    },
    onSuccess: (_, variables) => {
      // Invalidate the kit_combos query so it refetches the items
      queryClient.invalidateQueries({ queryKey: ['kit_combos'] });
    },
  });
}

export function useDeleteKitComboItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('kit_combo_items').delete().eq('id', itemId);
      if (error) throw error;
      return itemId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kit_combos'] });
    },
  });
}

export function useUpdateKitComboItemQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { data, error } = await supabase.from('kit_combo_items').update({ quantity }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kit_combos'] });
    },
  });
}
// ========== Brands ==========
export function useBrands() {
  return useQuery<any[]>({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await supabase.from('brands').select('*').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brand: any) => {
      const { data, error } = await supabase.from('brands').insert(brand).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brand: any) => {
      const { id, ...updateData } = brand;
      const { data, error } = await supabase.from('brands').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ========== Vehicle Brands ==========
export function useVehicleBrands() {
  return useQuery<any[]>({
    queryKey: ['vehicle_brands'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicle_brands').select('*').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateVehicleBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brand: any) => {
      const { data, error } = await supabase.from('vehicle_brands').insert(brand).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle_brands'] });
    },
  });
}

export function useUpdateVehicleBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brand: any) => {
      const { id, ...updateData } = brand;
      const { data, error } = await supabase.from('vehicle_brands').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle_brands'] });
    },
  });
}

export function useDeleteVehicleBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicle_brands').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle_brands'] });
    },
  });
}

// ========== Price History (Permanente) ==========
export function usePriceHistory(productId: string) {
  return useQuery<any[]>({
    queryKey: ['price_history', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('product_id', productId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });
}

// ========== Audit Log & Reversion ==========
export function useAuditHistory(limit = 100) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['audit_history', limit],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      const { data, error } = await supabase
        .from('inventory_audit_log')
        .select('*')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        // Table might not exist yet if user hasn't run the migration
        if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('inventory_audit_log table does not exist yet. Please run supabase_add_audit_log.sql in Supabase.');
          return [];
        }
        throw error;
      }
      return (data || []) as AuditLogEntry[];
    },
  });
}

export function useRevertAuditLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: AuditLogEntry) => {
      if (entry.is_reverted) {
        throw new Error('Esta acción ya ha sido revertida.');
      }

      if (entry.action_type === 'product_deleted') {
        const snapshot = entry.details?.product_snapshot;
        if (!snapshot) {
          throw new Error('No se encontró el respaldo de información del producto para restaurar.');
        }

        // Strip joined relation fields and timestamp generated columns
        const { categories, brands, kit_items, created_at, updated_at, ...cleanProduct } = snapshot as any;

        // 1. Re-insert product preserving its original ID
        const { error: prodError } = await supabase
          .from('products')
          .upsert(cleanProduct, { onConflict: 'id' });

        if (prodError) throw prodError;

        // 2. Re-insert kit associations if any existed
        const kitAssocs = entry.details?.kit_associations || [];
        if (kitAssocs.length > 0) {
          const kitItemsToInsert = kitAssocs.map((k: any) => ({
            kit_id: k.kit_id,
            product_id: entry.entity_id || cleanProduct.id,
            quantity: k.quantity || 1,
          }));
          await supabase.from('kit_items').insert(kitItemsToInsert);
        }
      } else if (entry.action_type === 'kit_connected') {
        // Reverting kit_connected means disconnecting the product from the kit
        const kitId = entry.details?.kit_id;
        const productId = entry.details?.product_id;
        if (!kitId || !productId) {
          throw new Error('Faltan datos del cotizador o repuesto para revertir la vinculación.');
        }

        const { error: delError } = await supabase
          .from('kit_items')
          .delete()
          .eq('kit_id', kitId)
          .eq('product_id', productId);

        if (delError) throw delError;
      } else if (entry.action_type === 'kit_disconnected') {
        // Reverting kit_disconnected means re-connecting the product to the kit
        const kitId = entry.details?.kit_id;
        const productId = entry.details?.product_id;
        if (!kitId || !productId) {
          throw new Error('Faltan datos del cotizador o repuesto para reconectar.');
        }

        // Verify if product still exists
        const { data: prodCheck } = await supabase
          .from('products')
          .select('id')
          .eq('id', productId)
          .maybeSingle();

        if (!prodCheck) {
          throw new Error('No se puede reconectar porque el producto no existe en el catálogo.');
        }

        // Avoid duplicate insertion
        const { data: alreadyConnected } = await supabase
          .from('kit_items')
          .select('id')
          .eq('kit_id', kitId)
          .eq('product_id', productId)
          .maybeSingle();

        if (!alreadyConnected) {
          const { error: insertError } = await supabase
            .from('kit_items')
            .insert({
              kit_id: kitId,
              product_id: productId,
              quantity: entry.details?.quantity || 1,
            });

          if (insertError) throw insertError;
        }
      }

      // Mark audit entry as reverted
      const { error: markError } = await supabase
        .from('inventory_audit_log')
        .update({
          is_reverted: true,
          reverted_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (markError) throw markError;

      return entry.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      queryClient.invalidateQueries({ queryKey: ['kit_items'] });
      queryClient.invalidateQueries({ queryKey: ['audit_history'] });
      queryClient.invalidateQueries({ queryKey: ['global_history'] });
    },
  });
}

export function usePurgeOldHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      // Only purge temporary audit backups (deletions and kits)
      // product_price_history is permanent and never purged
      const { error } = await supabase
        .from('inventory_audit_log')
        .delete()
        .lt('created_at', cutoff);

      if (error && !error.message?.includes('does not exist')) {
        console.warn('Audit purge warning:', error);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_history'] });
    },
  });
}


