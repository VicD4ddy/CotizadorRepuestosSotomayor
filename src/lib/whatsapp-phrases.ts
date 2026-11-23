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
