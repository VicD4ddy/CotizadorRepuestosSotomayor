'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AuditLogEntry } from '@/types';

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

        const { categories, brands, kit_items, created_at, updated_at, ...cleanProduct } = snapshot as any;

        const { error: prodError } = await supabase
          .from('products')
          .upsert(cleanProduct, { onConflict: 'id' });

        if (prodError) throw prodError;

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
        const kitId = entry.details?.kit_id;
        const productId = entry.details?.product_id;
        if (!kitId || !productId) {
          throw new Error('Faltan datos del cotizador o repuesto para reconectar.');
        }

        const { data: prodCheck } = await supabase
          .from('products')
          .select('id')
          .eq('id', productId)
          .maybeSingle();

        if (!prodCheck) {
          throw new Error('No se puede reconectar porque el producto no existe en el catálogo.');
        }

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
