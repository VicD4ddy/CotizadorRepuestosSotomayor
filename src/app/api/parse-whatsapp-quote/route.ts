import { NextRequest, NextResponse } from 'next/server';
import { generateMultimodalWithFallback } from '@/lib/ai-client';

interface RawParsedItem {
  raw_request?: unknown;
  part_name?: unknown;
  vehicle?: unknown;
  spec?: unknown;
  sku_hint?: unknown;
  search_terms?: unknown;
  quantity?: unknown;
}

function buildWhatsAppParsePrompt(text: string): string {
  return `Eres un experto analista de repuestos automotrices en Venezuela (Repuestos Sotomayor).
Analiza el siguiente mensaje de WhatsApp y/o la captura de pantalla adjunta y extrae únicamente los datos del cliente (si aparecen) y la lista estructurada de repuestos solicitados.

${text ? `TEXTO ADICIONAL DEL MENSAJE:\n"""\n${text}\n"""\n` : ''}
REGLAS ESTRICTAS DE EXTRACCIÓN:
1. Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones antes o después).
2. Si es una captura de pantalla de WhatsApp:
   - Si en la cabecera del chat o en el mensaje aparece el nombre del cliente, colócalo en "client_name" (ignora textos genéricos como "WhatsApp", "En línea", "Escribiendo...", "Repuestos Sotomayor").
   - Si aparece un número telefónico venezolano o internacional (ej. 0414..., 0412..., 0424..., 0416..., +58...), colócalo en "client_phone".
   - Ignora marcas de hora (ej. "10:45 a. m."), ticks de lectura, saludos o conversaciones sin repuestos.
3. Por cada repuesto pedido por el cliente crea un objeto en "items":
   - "raw_request": texto literal o resumido tal como lo pidió el cliente.
   - "part_name": nombre normalizado del repuesto en MAYÚSCULAS y sin acentos innecesarios si ayuda a coincidir (ej. "MUÑON INFERIOR", "EMPACADURA CAMARA", "ANILLOS", "CONCHA BIELA", "CONCHA BANCADA", "BUJE MESETA", "AMORTIGUADOR", "PASTILLAS FRENO", "TERMINAL DIRECCION", "ESTOPERA CIGUEÑAL", "BOMBA AGUA", "KIT CLUTCH").
   - "vehicle": marca, modelo, motor o año en MAYÚSCULAS (ej. "BLAZER 4X2", "CHEV 250", "CORSA 1.6", "MALIBU", "SILVERADO 5.3", "F150 302"). Vacío si no se menciona.
   - "spec": medida, posición o especificación en MAYÚSCULAS (ej. "STD", "010", "020", "030", "040", "DERECHO", "IZQUIERDO", "DELANTERO", "TRASERO", "SUPERIOR", "INFERIOR", "4X2", "4X4"). Vacío si no aplica.
   - "sku_hint": código o número de parte si el cliente lo escribió (ej. "K6145", "40514", "12369"). Vacío si no hay código.
   - "search_terms": arreglo de palabras clave importantes en MAYÚSCULAS combinando pieza, vehículo, medida y sinónimos cortos (ej. ["MUÑON", "INFERIOR", "BLAZER", "4X2"]).
   - "quantity": número entero positivo (si dice "par" o "ambos lados" y no es un juego único, usa 2; si dice "juego"/"kit", usa 1; si no se indica, usa 1).
4. Si en una misma línea el cliente pide 2 piezas distintas (ej. "concha de biela y bancada 010 corsa"), divídelo en ítems separados dentro de "items".

FORMATO JSON EXACTO REQUERIDO:
{
  "client_name": "",
  "client_phone": "",
  "items": [
    {
      "raw_request": "",
      "part_name": "",
      "vehicle": "",
      "spec": "",
      "sku_hint": "",
      "search_terms": [],
      "quantity": 1
    }
  ]
}`;
}

function extractJsonPayload(rawText: string): {
  client_name: string;
  client_phone: string;
  items: Array<{
    raw_request: string;
    part_name: string;
    vehicle: string;
    spec: string;
    sku_hint: string;
    search_terms: string[];
    quantity: number;
  }>;
} {
  let cleaned = rawText.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(cleaned);
  const rawItems: RawParsedItem[] = Array.isArray(parsed?.items) ? parsed.items : [];

  const items = rawItems
    .map((item) => {
      const qtyNum = Number(item.quantity);
      const quantity = Number.isFinite(qtyNum) && qtyNum > 0 ? Math.round(qtyNum) : 1;
      const searchTerms = Array.isArray(item.search_terms)
        ? item.search_terms.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
        : [];

      return {
        raw_request: String(item.raw_request || item.part_name || '').trim(),
        part_name: String(item.part_name || '').trim().toUpperCase(),
        vehicle: String(item.vehicle || '').trim().toUpperCase(),
        spec: String(item.spec || '').trim().toUpperCase(),
        sku_hint: String(item.sku_hint || '').trim().toUpperCase(),
        search_terms: searchTerms,
        quantity,
      };
    })
    .filter((item) => item.raw_request.length > 0 || item.part_name.length > 0 || item.sku_hint.length > 0);

  return {
    client_name: typeof parsed?.client_name === 'string' ? parsed.client_name.trim() : '',
    client_phone: typeof parsed?.client_phone === 'string' ? parsed.client_phone.trim() : '',
    items,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
    let rawImageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    let mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim() : '';

    if (!rawText && !rawImageBase64) {
      return NextResponse.json(
        { error: 'Debes pegar un mensaje de WhatsApp o adjuntar una captura de pantalla.' },
        { status: 400 }
      );
    }

    if (rawImageBase64) {
      const dataUrlMatch = rawImageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUrlMatch) {
        mimeType = mimeType || dataUrlMatch[1];
        rawImageBase64 = dataUrlMatch[2];
      }
      if (!mimeType) {
        mimeType = 'image/png';
      }
    }

    const prompt = buildWhatsAppParsePrompt(rawText);
    const aiText = await generateMultimodalWithFallback(
      prompt,
      rawImageBase64 ? { base64Data: rawImageBase64, mimeType } : undefined,
      { temperature: 0.1, maxOutputTokens: 4000 }
    );

    const structured = extractJsonPayload(aiText);

    return NextResponse.json(structured);
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || 'Error desconocido';
    console.error('Error in parse-whatsapp-quote:', errorMsg);

    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Límite de peticiones de IA alcanzado (15/min). Espera unos segundos e intenta de nuevo.' },
        { status: 429 }
      );
    }

    if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE')) {
      return NextResponse.json(
        { error: 'El servicio de IA está temporalmente saturado. Intenta nuevamente en un momento.' },
        { status: 503 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'La IA no pudo estructurar el mensaje en formato de lista. Intenta con un texto o captura más nítida.' },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: `Error analizando cotización con IA: ${errorMsg}` },
      { status: 500 }
    );
  }
}
