'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { logAuditAction } from './audit-helper';

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
    mutationFn: async (product: Partial<Product> & { id: string; compatible_kits?: string[] }) => {
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
    mutationFn: async (payload: {
      product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'categories' | 'brands' | 'kit_items'>;
      compatible_kits?: string[];
    }) => {
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
