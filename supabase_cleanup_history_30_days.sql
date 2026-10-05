-- ============================================================
-- LIMPIEZA AUTOMÁTICA DE HISTORIAL CADA 30 DÍAS
-- Ejecuta este script en el Editor SQL de Supabase
-- ============================================================

-- 1. Función para depurar únicamente respaldos temporales (eliminaciones y kits) mayores a 30 días
-- IMPORTANTE: El historial de precios, nombres y descripciones (product_price_history) PERDURA PARA SIEMPRE.
CREATE OR REPLACE FUNCTION cleanup_old_history_logs()
RETURNS void AS $$
BEGIN
  -- Eliminar únicamente respaldos temporales de auditoría (eliminaciones y kits) con más de 30 días
  DELETE FROM inventory_audit_log
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 2. Habilitar extensión pg_cron (nativa en Supabase) para programar la limpieza
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Desprogramar cualquier cron anterior con el mismo nombre si existía
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-history-every-30-days');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Programar la limpieza automática todos los días a la medianoche (00:00 UTC)
SELECT cron.schedule(
  'cleanup-history-every-30-days',
  '0 0 * * *',
  $$SELECT cleanup_old_history_logs()$$
);
