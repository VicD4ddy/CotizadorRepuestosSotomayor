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
 * Calcula el precio final en USD BCV aplicando las reglas de redondeo comerciales de Sotomayor:
 * - Si el resultado es mayor a 15: redondea hacia arriba al siguiente múltiplo de 5 (ej: 16 -> 20, 18 -> 20, 21 -> 25).
 * - Si el resultado es menor o igual a 15: redondea hacia arriba al número entero más cercano si tiene decimales (ej: 12.40 -> 13.00, 6.00 -> 6.00).
 */
export function calculateBcvPrice(priceUsd: number, bcvMultiplier: number = 1): number {
  if (!priceUsd || priceUsd <= 0) return 0;
  const mult = (bcvMultiplier && bcvMultiplier > 0) ? bcvMultiplier : 1;
  const raw = priceUsd * mult;
  if (raw > 15) {
    return Math.ceil(raw / 5) * 5;
  }
  return Math.ceil(raw);
}

