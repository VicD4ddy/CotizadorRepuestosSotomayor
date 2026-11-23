'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Quote, QuoteItem } from '@/types';

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
