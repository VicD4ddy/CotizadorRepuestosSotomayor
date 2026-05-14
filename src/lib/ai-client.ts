import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: 'v1beta'
});

// Cadena de modelos Gemma 4 exclusivamente
const MODEL_CHAIN = [
  'gemma-4-26b-a4b-it',  // Principal: MoE eficiente
  'gemma-4-31b-it',      // Respaldo: alta calidad
];

export async function generateWithFallback(
  prompt: string, 
  config?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  let lastError: any = null;

  // Valores por defecto basados en los ajustes del usuario en AI Studio
  const finalConfig = {
    temperature: config?.temperature ?? 0.4,
    maxOutputTokens: config?.maxOutputTokens ?? 5000,
  };

  for (const model of MODEL_CHAIN) {
    try {
      console.log(`[AI] Intentando con: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: finalConfig,
      });
      
      const text = response.text?.trim();
      if (text) {
        console.log(`[AI] Éxito con: ${model}`);
        return text;
      }
    } catch (error: any) {
      const msg = error?.message || '';
      console.warn(`[AI] Fallo en ${model}: ${msg.substring(0, 150)}`);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('No se pudo conectar con los modelos Gemma.');
}
