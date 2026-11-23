'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
