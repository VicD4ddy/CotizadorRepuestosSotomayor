'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';

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
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
