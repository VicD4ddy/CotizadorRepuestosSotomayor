import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatBs(value: number): string {
  return `Bs ${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}


export function calculateMargin(cost: number, multiplier: number = 0.4): number {
  const raw = cost * (1 + multiplier);
  return Math.ceil(raw / 5) * 5;
}

/**
 * Determina si un producto o categoría corresponde a "Taquetes".
 */
export function isTaqueteCategoryOrName(categoryOrName?: string | null): boolean {
  if (!categoryOrName) return false;
  return /taquete/i.test(categoryOrName);
}

/**
 * Calcula el precio final en USD BCV aplicando las reglas de redondeo comerciales de Sotomayor:
 * - Taquetes: Redondeo hacia arriba al siguiente múltiplo de 0.5 (de 0.5 en 0.5) para cualquier precio.
 *   (ej: 4.10 -> 4.50, 4.45 -> 4.50, 4.51 -> 5.00, 5.20 -> 5.50).
 * - Resto de repuestos:
 *   - Si el resultado es mayor a 15: redondea hacia arriba al siguiente múltiplo de 5 (ej: 16 -> 20, 18 -> 20, 21 -> 25).
 *   - Si el resultado es menor o igual a 15: redondea hacia arriba al número entero más cercano si tiene decimales (ej: 12.40 -> 13.00, 6.00 -> 6.00).
 */
export function calculateBcvPrice(
  priceUsd: number, 
  bcvMultiplier: number = 1,
  categoryOrName?: string | null
): number {
  if (!priceUsd || priceUsd <= 0) return 0;
  const mult = (bcvMultiplier && bcvMultiplier > 0) ? bcvMultiplier : 1;
  const raw = priceUsd * mult;

  // Regla especial para Taquetes (aplica para cualquier precio de 0.5 en 0.5 hacia arriba)
  if (isTaqueteCategoryOrName(categoryOrName)) {
    const roundedRaw = Math.round(raw * 1000) / 1000;
    return Math.ceil(roundedRaw * 2) / 2;
  }

  // Regla comercial general Sotomayor
  if (raw > 15) {
    return Math.ceil(raw / 5) * 5;
  }
  return Math.ceil(raw);
}

