export const WHATSAPP_PHRASES = [
  'La pasión por servirte es el motor que nunca se apaga.',
  'Tu confianza es el combustible; nuestra vocación, el motor.',
  'Encendemos cada jornada con la meta de darte el mejor rendimiento.',
  'Más que piezas de recambio, entregamos la potencia de un servicio comprometido.',
  'Aceleramos soluciones para que tus proyectos nunca se detengan.',
  'Alineamos cada detalle de nuestra atención a la altura de tu camino.',
  'La tracción que necesitas para avanzar con total seguridad.',
  'Calidad en cada repuesto, dirección firme en cada asesoría.',
  'Sincronizamos nuestra dedicación para mantener tu marcha perfecta.',
  'Atención precisa y repuestos firmes: el engranaje de tu tranquilidad.',
  'Tu satisfacción es la fuerza que mueve cada uno de nuestros engranajes.',
  'Ajustamos cada solución con la precisión que tu trabajo merece.',
] as const;

export function getRandomWhatsAppPhrase(): string {
  return WHATSAPP_PHRASES[Math.floor(Math.random() * WHATSAPP_PHRASES.length)];
}

export interface WhatsAppMessageOptions {
  clientName?: string | null;
  documentType?: string | null;
  phrase?: string;
}

/**
 * Builds a concise WhatsApp caption containing only greeting, document type,
 * and closing phrase, leaving full line items and pricing for the attached image/PDF.
 */
export function buildWhatsAppQuoteMessage({
  clientName,
  documentType,
  phrase,
}: WhatsAppMessageOptions = {}): string {
  const rawName = clientName?.trim() || '';
  const bracketMatch = rawName.match(/^\[(.*?)\]\s*(.*)$/);
  const cleanName = (bracketMatch ? bracketMatch[2] : rawName).trim();
  const resolvedDoc = (documentType || bracketMatch?.[1] || 'cotización').trim().toLowerCase();

  const greeting = cleanName ? `Hola *${cleanName}*,` : 'Hola,';
  const closingPhrase = phrase || getRandomWhatsAppPhrase();

  return `${greeting} adjunto tu ${resolvedDoc} de *Repuestos Sotomayor*.\n\n_${closingPhrase}_`;
}
