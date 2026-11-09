import { NextResponse } from 'next/server';
import https from 'https';

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

function fetchBcvHtmlDirect(timeoutMs = 7000): Promise<string> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.get(
      'https://www.bcv.org.ve/',
      {
        agent,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
          reject(new Error(`BCV HTTP status ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout consultando bcv.org.ve'));
    });

    req.on('error', (err) => reject(err));
  });
}

async function fetchBcvRate(): Promise<{
  rate: number;
  rawRate: number;
  rawRateString?: string;
  fechaValor?: string;
  source: string;
  date: string;
} | null> {
  // 1. Fuente Primaria #1: Portal Oficial del BCV (https://www.bcv.org.ve/)
  // Publica desde la tarde la tasa oficial con Fecha Valor del día siguiente hábil.
  try {
    const html = await fetchBcvHtmlDirect(7000);
    const dolarMatch = html.match(
      /id="dolar"[\s\S]{0,800}?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i
    );
    if (dolarMatch?.[1]) {
      const rawStr = dolarMatch[1].trim();
      const normalized = rawStr.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(normalized);

      if (!isNaN(parsed) && parsed > 0) {
        const fechaMatch = html.match(
          /class="date-display-single"[^>]*content="([^"]+)"[^>]*>([^<]+)<\/span>/i
        );
        const isoDate = fechaMatch?.[1]?.trim() || new Date().toISOString();
        const fechaValorLabel = fechaMatch?.[2]?.replace(/\s+/g, ' ').trim();

        return {
          rate: Number(parsed.toFixed(2)),
          rawRate: parsed,
          rawRateString: rawStr,
          fechaValor: fechaValorLabel,
          source: 'Portal Oficial BCV (bcv.org.ve)',
          date: isoDate,
        };
      }
    }
  } catch {
    // Si bcv.org.ve no responde, continuar a los respaldos
  }

  // 2. Respaldo #1: DolarApi oficial
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CotizadorSotomayor/1.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: DolarApiResponse = await res.json();
      if (typeof data.promedio === 'number' && data.promedio > 0) {
        return {
          rate: Number(data.promedio.toFixed(2)),
          rawRate: data.promedio,
          source: 'Banco Central de Venezuela (DolarApi)',
          date: data.fechaActualizacion || new Date().toISOString(),
        };
      }
    }
  } catch {
    // Continuar al siguiente fallback
  }

  // 3. Respaldo #2: PyDolarVenezuela
  try {
    const fallbackController = new AbortController();
    const fallbackTimeout = setTimeout(() => fallbackController.abort(), 6000);

    const fallbackRes = await fetch(
      'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv',
      {
        headers: { Accept: 'application/json' },
        signal: fallbackController.signal,
        cache: 'no-store',
      }
    );

    clearTimeout(fallbackTimeout);

    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const price = fbData?.monitors?.usd?.price;
      if (typeof price === 'number' && price > 0) {
        return {
          rate: Number(price.toFixed(2)),
          rawRate: price,
          source: 'Banco Central de Venezuela (PyDolar)',
          date: fbData?.datetime?.date || new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fallo total en BCV
  }

  return null;
}

async function fetchBinanceRate(): Promise<{
  binanceRate: number;
  rawBinanceRate: number;
  binanceSource: string;
  binanceDate: string;
} | null> {
  // 1. Intentar directamente con API oficial de Binance P2P (USDT/VES en tiempo real)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'CotizadorSotomayor/1.0',
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'VES',
        merchantCheck: false,
        page: 1,
        payTypes: [],
        publisherType: null,
        rows: 10,
        tradeType: 'BUY',
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const ads: any[] = Array.isArray(json?.data) ? json.data : [];
      const prices = ads
        .map((item) => parseFloat(item?.adv?.price))
        .filter((val) => !isNaN(val) && val > 0);

      if (prices.length > 0) {
        const sample = prices.length >= 4 ? prices.slice(1, 6) : prices;
        const avg = sample.reduce((acc, p) => acc + p, 0) / sample.length;
        return {
          binanceRate: Number(avg.toFixed(2)),
          rawBinanceRate: avg,
          binanceSource: 'Binance P2P (USDT/VES en tiempo real)',
          binanceDate: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Continuar al fallback
  }

  // 2. Fallback con DolarApi Paralelo / USDT
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CotizadorSotomayor/1.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: DolarApiResponse = await res.json();
      if (typeof data.promedio === 'number' && data.promedio > 0) {
        return {
          binanceRate: Number(data.promedio.toFixed(2)),
          rawBinanceRate: data.promedio,
          binanceSource: 'Monitor USDT / Paralelo (DolarApi)',
          binanceDate: data.fechaActualizacion || new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fallo total en Binance
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const only = searchParams.get('only');

    if (only === 'binance') {
      const binanceResult = await fetchBinanceRate();
      if (!binanceResult) {
        return NextResponse.json(
          { success: false, error: 'No se pudo obtener la tasa de Binance P2P' },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        binanceRate: binanceResult.binanceRate,
        rawBinanceRate: binanceResult.rawBinanceRate,
        binanceSource: binanceResult.binanceSource,
        binanceDate: binanceResult.binanceDate,
      });
    }

    if (only === 'bcv') {
      const bcvResult = await fetchBcvRate();
      if (!bcvResult) {
        return NextResponse.json(
          { success: false, error: 'No se pudo obtener la tasa oficial del BCV' },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        rate: bcvResult.rate,
        rawRate: bcvResult.rawRate,
        rawRateString: bcvResult.rawRateString ?? null,
        fechaValor: bcvResult.fechaValor ?? null,
        source: bcvResult.source,
        date: bcvResult.date,
      });
    }

    const [bcvResult, binanceResult] = await Promise.all([
      fetchBcvRate(),
      fetchBinanceRate(),
    ]);

    if (!bcvResult && !binanceResult) {
      return NextResponse.json(
        { success: false, error: 'No se pudieron obtener las tasas de los servicios externos' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      rate: bcvResult?.rate ?? null,
      rawRate: bcvResult?.rawRate ?? null,
      rawRateString: bcvResult?.rawRateString ?? null,
      fechaValor: bcvResult?.fechaValor ?? null,
      source: bcvResult?.source ?? 'Banco Central de Venezuela (BCV)',
      date: bcvResult?.date ?? new Date().toISOString(),
      binanceRate: binanceResult?.binanceRate ?? null,
      rawBinanceRate: binanceResult?.rawBinanceRate ?? null,
      binanceSource: binanceResult?.binanceSource ?? 'Binance P2P (USDT/VES)',
      binanceDate: binanceResult?.binanceDate ?? new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error de conexión al consultar tasas' },
      { status: 500 }
    );
  }
}
