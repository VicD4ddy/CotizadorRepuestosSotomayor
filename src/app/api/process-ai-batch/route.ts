import { NextRequest } from 'next/server';
import { generateWithFallback } from '@/lib/ai-client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { productIds } = await req.json();

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No product IDs provided' }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let processed = 0;
      let errors = 0;

      for (const productId of productIds) {
        try {
          // Fetch product data
          const { data: product, error: fetchErr } = await supabase
            .from('products')
            .select('id, name, code, description, brand_id, fitment, brands(name)')
            .eq('id', productId)
            .single();

          if (fetchErr || !product) {
            errors++;
            sendEvent({ type: 'error', productId, message: 'Producto no encontrado' });
            continue;
          }

          const brandName = (product as any).brands?.name || '';
          const fitmentText = Array.isArray(product.fitment)
            ? product.fitment.map((f: any) => `${f.make} ${f.model} ${f.year}`).join(', ')
            : '';

          // Step 1: Standardize name
          sendEvent({
            type: 'progress',
            current: processed + 1,
            total: productIds.length,
            productName: product.name,
            step: 'estandarizando',
          });

          let standardizedName = product.name;
          try {
            const stdPrompt = buildStandardizePrompt(product.name, product.code, brandName, fitmentText);
            standardizedName = await generateWithFallback(stdPrompt, { temperature: 0.2 });
            // Clean AI response
            standardizedName = standardizedName.replace(/^["'`]+|["'`]+$/g, '').trim();
            if (!standardizedName || standardizedName.length < 3) {
              standardizedName = product.name;
            }
          } catch (e: any) {
            sendEvent({ type: 'warning', productId, step: 'estandarizando', message: e.message?.substring(0, 80) });
          }

          // Step 2: Generate description
          sendEvent({
            type: 'progress',
            current: processed + 1,
            total: productIds.length,
            productName: standardizedName,
            step: 'generando descripción',
          });

          let description = product.description || '';
          try {
            const descPrompt = buildDescriptionPrompt(standardizedName, product.code);
            description = await generateWithFallback(descPrompt);
            description = description.replace(/^["'`]+|["'`]+$/g, '').trim();
          } catch (e: any) {
            sendEvent({ type: 'warning', productId, step: 'descripción', message: e.message?.substring(0, 80) });
          }

          // Step 3: Update product in DB
          const { error: updateErr } = await supabase
            .from('products')
            .update({
              name: standardizedName,
              description,
              updated_at: new Date().toISOString(),
            })
            .eq('id', productId);

          if (updateErr) {
            errors++;
            sendEvent({ type: 'error', productId, message: updateErr.message });
          } else {
            processed++;
            sendEvent({
              type: 'done-item',
              current: processed,
              total: productIds.length,
              productName: standardizedName,
            });
          }

          // Delay between products to respect rate limits (15 RPM = ~4s per request, 2 requests per product)
          if (processed < productIds.length) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        } catch (err: any) {
          errors++;
          sendEvent({ type: 'error', productId, message: err.message?.substring(0, 100) });
        }
      }

      sendEvent({
        type: 'complete',
        processed,
        errors,
        total: productIds.length,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function buildStandardizePrompt(name: string, code: string, brandName: string, fitmentText: string): string {
  return `
Eres un catalogador experto de repuestos automotrices para un inventario profesional.
Tu única tarea es tomar los datos provistos y devolver el nombre estandarizado en una sola línea, siguiendo ESTRICTAMENTE este formato:

[PIEZA] [MARCA VEHICULO] [MOTOR] [APLICACIONES] [AÑOS] [SPECS] ([MEDIDA]) [MARCA REPUESTO]

REGLAS ABSOLUTAS:
1. TODO EN MAYÚSCULAS. Sin comillas.
2. NUNCA incluyas códigos del SKU en el nombre.
3. NO INVENTES PALABRAS que no existan en los datos originales.
4. PLURALIZACIÓN: "PISTON" → "PISTONES". "ANILLO" → "ANILLOS". "CONCHA" se mantiene singular.
5. Busca la medida en el nombre Y en el SKU/Código. Patrones: números aislados (010, 020, 030, 050, 075, 100, 150) → (.010), (.050), etc. "STD" → (STD).
6. LITROS: "LTS", "Lts" → "L". Sin espacio antes de la L.
7. APLICACIONES: Une modelos con barra: F150/F250/F350.
8. AÑOS: Rangos con guion: "80-87".
9. MARCA REPUESTO: Siempre va de ÚLTIMO.
10. Elimina espacios dobles, caracteres basura, y palabras repetidas.

DATOS:
Nombre Original: ${name}
SKU/Código: ${code || 'No provisto'}
Marca del Repuesto: ${brandName || 'No provista'}
Aplicaciones: ${fitmentText || 'No provista'}

Devuelve ÚNICAMENTE el texto estandarizado final:
`;
}

function buildDescriptionPrompt(name: string, code: string): string {
  return `Actúa como un redactor técnico especializado en repuestos de mecánica automotriz. 
Tu tarea es redactar una "Descripción Técnica" concisa y profesional para el siguiente repuesto:
- Nombre del repuesto: ${name}
- Código / SKU: ${code}

Instrucciones:
- No escribas introducciones ni saludos.
- La descripción debe ser breve (2-3 oraciones como máximo).
- Destaca beneficios genéricos de alta calidad (durabilidad, ajuste exacto, confiabilidad).
- Si identificas el tipo de repuesto, incluye su función principal.

Responde ÚNICAMENTE con el texto de la descripción, sin comillas ni formato markdown.`;
}
