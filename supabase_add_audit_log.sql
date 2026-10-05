-- ============================================================
-- TABLA DE AUDITORÍA Y HISTORIAL CON CAPACIDAD DE REVERSIÓN
-- Ejecuta este script en el Editor SQL de Supabase
-- ============================================================

-- 1. Crear tabla para auditoría de acciones reversibles (eliminaciones y kits)
CREATE TABLE IF NOT EXISTS inventory_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL, -- 'product_deleted', 'kit_connected', 'kit_disconnected'
  entity_type TEXT NOT NULL, -- 'product', 'kit_item'
  entity_id UUID,
  entity_code TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  is_reverted BOOLEAN DEFAULT false,
  reverted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar Row Level Security y política de acceso
ALTER TABLE inventory_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on inventory_audit_log" ON inventory_audit_log;
CREATE POLICY "Allow all on inventory_audit_log" ON inventory_audit_log FOR ALL USING (true) WITH CHECK (true);

-- 3. Índices para consultas ultra-rápidas
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON inventory_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON inventory_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_is_reverted ON inventory_audit_log(is_reverted);
