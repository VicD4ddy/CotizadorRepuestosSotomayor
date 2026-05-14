import { NextResponse } from 'next/server';
import { generateWithFallback } from '@/lib/ai-client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, code, brandName, fitmentText } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es obligatorio.' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API Key de Gemini no configurada.' },
        { status: 500 }
      );
    }

    const prompt = `
Eres un catalogador experto de repuestos automotrices para un inventario profesional.
Tu única tarea es tomar los datos provistos y devolver el nombre estandarizado en una sola línea, siguiendo ESTRICTAMENTE este formato:

[PIEZA] [MARCA VEHICULO] [MOTOR] [APLICACIONES] [AÑOS] [SPECS] ([MEDIDA]) [MARCA REPUESTO]

REGLAS ABSOLUTAS:
1. TODO EN MAYÚSCULAS. Sin comillas.
2. NUNCA incluyas códigos del SKU en el nombre (ej. "EPV-1842", "592", "E229X" NO van en el nombre). El SKU SOLO sirve para extraer la MEDIDA.
3. NO INVENTES PALABRAS que no existan en los datos originales. No agregues "MOTOR" a menos que el usuario la escribió.
4. PLURALIZACIÓN:
   - "PISTON" → "PISTONES". "KIT PISTON" → "KIT PISTONES". 
   - "ANILLO" → "ANILLOS".
   - "CONCHA" se mantiene singular.
5. **EXTRACCIÓN DE MEDIDA (CRÍTICO):**
   - SIEMPRE busca la medida en el nombre Y en el SKU/Código.
   - Patrones en SKU de ANILLOS/CONCHAS: "592-STD" → (STD). "592 030-HAST" → (.030). "E229X 020-SEALP" → (.020).
   - Patrones en SKU de PISTONES: "EPV-1842 150-NATSU" → (.150). "EPV-1842-050 NAT" → (.050). "EPV1842 075-NATSU" → (.075). "EPV-1842 STD-NAT" → (STD).
   - Cualquier número de 2-3 dígitos aislado (010, 020, 030, 040, 050, 060, 075, 100, 150) → es medida con punto: (.010), (.050), (.075), (.150).
   - "STD" en el SKU o nombre → (STD).
   - La medida SIEMPRE va entre paréntesis, justo ANTES de la marca del repuesto.
   - Si NO hay medida en ningún lado, omítela. Pero si hay en el SKU, DEBES incluirla.
6. LITROS: "LTS", "Lts", "LITROS" → "L". Ejemplo: "4.9 LTS" → "4.9L". Sin espacio antes de la L.
7. APLICACIONES: Une modelos con barra: F150/F250/F350. No repitas la marca del vehículo.
8. AÑOS: Estandariza rangos de años con guion: "80-87", NO "80/87".
9. ESPECIFICACIONES: Info como "GRUESO-GRUESO", "4 PULGADAS" va limpia ANTES de la medida.
10. MARCA REPUESTO: Siempre va de ÚLTIMO. No la dupliques. Abreviaturas del SKU: "NATSU"/"NAT" = NATSU, "SEALP" = SEALED POWER, "HAST" = HASTINGS.
11. LIMPIEZA: Elimina espacios dobles, caracteres basura, y palabras repetidas.

DATOS:
Nombre Original: ${name}
SKU/Código: ${code || 'No provisto'}
Marca del Repuesto (va al final): ${brandName || 'No provista'}
Aplicaciones: ${fitmentText || 'No provista'}

EJEMPLOS (fíjate cómo SIEMPRE se extrae la medida del SKU):
- SKU "EPV-1842 150-NATSU", nombre "PISTON FORD 300 BRONCO 4.9L 80-87" → PISTONES FORD 300 BRONCO 4.9L 80-87 (.150) NATSU
- SKU "EPV-1842 STD-NAT", nombre "KIT PISTON FORD 300 BRONCO 80-87" → KIT PISTONES FORD 300 BRONCO 4.9L 80-87 (STD) NATSU
- SKU "EPV-1842-050 NAT", nombre "PISTON FORD 300 BRONCO 4.9L 80-87" → PISTONES FORD 300 BRONCO 4.9L 80-87 (.050) NATSU
- SKU "E229X 060-SEALP" → ANILLOS FORD 300 4.9L (.060) SEALED POWER
- SKU "592-STD HAST" → ANILLOS FORD 300 CHEV BLAZER 4.3L TBI 4 PULGADAS (GRUESO-GRUESO) (STD) HASTINGS
- CONCHA BIELA FORD 300 F150/F250/F350 (.010) SEALED POWER
- CONCHA BANCADA FORD 250/300 (STD) SEALED POWER

Devuelve ÚNICAMENTE el texto estandarizado final:
`;

    const standardizedName = await generateWithFallback(prompt, { temperature: 0.2 });
    return NextResponse.json({ standardizedName });
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || 'Error desconocido';
    console.error('Error estandarizando nombre:', errorMsg);
    
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
    
    return NextResponse.json(
      { error: `Error Gemma: ${errorMsg}` },
      { status: 500 }
    );
  }
}
