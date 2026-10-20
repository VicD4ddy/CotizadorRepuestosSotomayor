import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DolarApiResponse {
  moneda?: string;
  fuente?: string;
  nombre?: string;
  compra?: number | null;
  venta?: number | null;
  promedio?: number;
  fechaActualizacion?: string;
}

export async function GET() {
  try {
    // 1. Intentar con DolarApi oficial
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CotizadorSotomayor/1.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: DolarApiResponse = await res.json();
      if (typeof data.promedio === 'number' && data.promedio > 0) {
        return NextResponse.json({
          success: true,
          rate: Number(data.promedio.toFixed(2)),
          rawRate: data.promedio,
          source: 'Banco Central de Venezuela (BCV)',
          date: data.fechaActualizacion || new Date().toISOString(),
        });
      }
    }

    // 2. Si DolarApi no responde, intentar con fallback PyDolarVenezuela
    const fallbackController = new AbortController();
    const fallbackTimeout = setTimeout(() => fallbackController.abort(), 6000);

    const fallbackRes = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv', {
      headers: { 'Accept': 'application/json' },
      signal: fallbackController.signal,
      cache: 'no-store',
    });

    clearTimeout(fallbackTimeout);

    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const price = fbData?.monitors?.usd?.price;
      if (typeof price === 'number' && price > 0) {
        return NextResponse.json({
          success: true,
          rate: Number(price.toFixed(2)),
          rawRate: price,
          source: 'Banco Central de Venezuela (BCV - PyDolar)',
          date: fbData?.datetime?.date || new Date().toISOString(),
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'No se pudo obtener la tasa oficial de los servicios del BCV' },
      { status: 502 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error de conexión con la API del BCV' },
      { status: 500 }
    );
  }
}
