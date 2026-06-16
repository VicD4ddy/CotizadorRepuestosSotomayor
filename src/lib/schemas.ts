import { z } from 'zod';

export const productSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().default(''),
  category_id: z.string().nullable().default(null),
  brand_id: z.string().nullable().default(null),
  cost: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  price_usd: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  image_url: z.string().optional(),
  image_urls: z.array(z.string()).max(5, 'Máximo 5 imágenes').optional().default([]),
  location: z.string().optional(),
  fitment: z.array(
    z.object({
      make: z.string().min(1, 'Requerido'),
      model: z.string().min(1, 'Requerido'),
      year: z.string().min(1, 'Requerido'),
    })
  ).default([]),
  compatible_kits: z.array(z.string()).default([]),
  stock: z.coerce.number().int('La existencia debe ser un número entero').min(0, 'La existencia no puede ser negativa').default(0),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const settingsSchema = z.object({
  bcv_rate: z.coerce.number().min(0.01, 'La tasa debe ser mayor a 0'),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export const quoteSchema = z.object({
  client_name: z.string().min(1, 'El nombre del cliente es requerido'),
  client_phone: z.string().default(''),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  section: z.string().min(1, 'La sección es requerida'),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
