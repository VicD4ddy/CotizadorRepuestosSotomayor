import { NextResponse } from 'next/server';
import { generateWithFallback } from '@/lib/ai-client';

export async function POST(req: Request) {
  try {
    const { name, code } = await req.json();

    if (!name || !code) {
      return NextResponse.json({ error: 'Faltan datos (nombre o código)' }, { status: 400 });
    }

    const prompt = `Actúa como un redactor técnico especializado en repuestos de mecánica automotriz. 
Tu tarea es redactar una "Descripción Técnica" concisa y profesional para el siguiente repuesto:
- Nombre del repuesto: ${name}
- Código / SKU: ${code}

Instrucciones:
- No escribas introducciones ni saludos.
- La descripción debe ser breve (2-3 oraciones como máximo).
- Destaca beneficios genéricos de alta calidad (durabilidad, ajuste exacto, confiabilidad).
- Si identificas el tipo de repuesto, incluye su función principal.

Responde ÚNICAMENTE con el texto de la descripción, sin comillas ni formato markdown.`;

    const description = await generateWithFallback(prompt);
    return NextResponse.json({ description });
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || 'Error desconocido';
    console.error('Error generating description:', errorMsg);
    
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Límite de Gemma alcanzado (15/min). Espera un momento.' },
        { status: 429 }
      );
    }
    
    if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE')) {
      return NextResponse.json(
        { error: 'El servicio Gemma está temporalmente saturado. Intente en unos minutos.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: `Error Gemma: ${errorMsg}` }, { status: 500 });
  }
}