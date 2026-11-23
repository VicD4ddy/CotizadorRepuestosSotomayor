'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAuditAction } from './audit-helper';

export function useUploadKitImage() {
  return useMutation({
    mutationFn: async ({ file, kitId }: { file: File; kitId: string }) => {
      const fileExt = file.name.split('.').pop() || 'jpg';
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
      if (kitItem.kit_id && kitItem.product_id) {
        const { data: existing } = await supabase
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
      const { error: deleteError } = await supabase.from('kit_combo_items').delete().eq('combo_id', comboId);
      if (deleteError) throw deleteError;

      if (items.length > 0) {
        const rows = items.map((item) => ({
          combo_id: comboId,
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        const { error: insertError } = await supabase.from('kit_combo_items').insert(rows);
        if (insertError) throw insertError;
      }
      return comboId;
    },
    onSuccess: () => {
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
