-- ============================================================
-- ACTUALIZACIÓN COMPLETA - REPUESTOS SOTOMAYOR
-- Ejecuta este script en el Editor SQL de Supabase (SQL Editor)
-- Es 100% seguro (idempotente) y no borra ningún producto existente.
-- ============================================================

-- 1. COLUMNA DE STOCK MÍNIMO EN PRODUCTOS
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;

UPDATE products 
SET min_stock = 0 
WHERE min_stock IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_min_stock ON products(min_stock);


-- 2. TABLA DE AUDITORÍA REVERSIBLE (ELIMINACIONES Y KITS CON RETENCIÓN DE 30 DÍAS)
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

ALTER TABLE inventory_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on inventory_audit_log" ON inventory_audit_log;
CREATE POLICY "Allow all on inventory_audit_log" ON inventory_audit_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON inventory_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON inventory_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_is_reverted ON inventory_audit_log(is_reverted);


-- 3. HISTORIAL PERMANENTE DE PRECIOS, NOMBRES Y DESCRIPCIONES (NUNCA SE BORRA)
ALTER TABLE product_price_history 
ADD COLUMN IF NOT EXISTS old_name TEXT,
ADD COLUMN IF NOT EXISTS new_name TEXT,
ADD COLUMN IF NOT EXISTS old_description TEXT,
ADD COLUMN IF NOT EXISTS new_description TEXT,
ADD COLUMN IF NOT EXISTS change_type TEXT DEFAULT 'price';

-- Trigger inteligente para detectar cambios de precio, nombre o descripción
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
DECLARE
  v_change_type TEXT;
  v_price_changed BOOLEAN;
  v_name_changed BOOLEAN;
  v_desc_changed BOOLEAN;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    v_price_changed := (OLD.cost IS DISTINCT FROM NEW.cost) OR (OLD.price_usd IS DISTINCT FROM NEW.price_usd);
    v_name_changed := (OLD.name IS DISTINCT FROM NEW.name);
    v_desc_changed := (OLD.description IS DISTINCT FROM NEW.description);

    IF v_price_changed OR v_name_changed OR v_desc_changed THEN
      IF v_name_changed AND NOT v_price_changed AND NOT v_desc_changed THEN
        v_change_type := 'name';
      ELSIF v_desc_changed AND NOT v_price_changed AND NOT v_name_changed THEN
        v_change_type := 'description';
      ELSIF v_price_changed AND NOT v_name_changed AND NOT v_desc_changed THEN
        v_change_type := 'price';
      ELSE
        v_change_type := 'multiple';
      END IF;

      INSERT INTO product_price_history (
        product_id,
        old_cost, new_cost,
        old_price_usd, new_price_usd,
        old_name, new_name,
        old_description, new_description,
        change_type
      ) VALUES (
        NEW.id,
        OLD.cost, NEW.cost,
        OLD.price_usd, NEW.price_usd,
        OLD.name, NEW.name,
        OLD.description, NEW.description,
        v_change_type
      );
    END IF;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO product_price_history (
      product_id,
      old_cost, new_cost,
      old_price_usd, new_price_usd,
      old_name, new_name,
      old_description, new_description,
      change_type
    ) VALUES (
      NEW.id,
      0, NEW.cost,
      0, NEW.price_usd,
      '', NEW.name,
      '', NEW.description,
      'create'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_price_change ON products;
CREATE TRIGGER trigger_record_price_change
AFTER INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION record_price_change();


-- 4. FUNCIÓN Y TAREA DE LIMPIEZA DE 30 DÍAS (SOLO PARA RESPALDOS TEMPORALES)
CREATE OR REPLACE FUNCTION cleanup_old_history_logs()
RETURNS void AS $$
BEGIN
  -- Eliminar únicamente respaldos temporales (eliminaciones y kits) con más de 30 días
  -- product_price_history NO se toca (es permanente para siempre)
  DELETE FROM inventory_audit_log
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Programar cron nativo si pg_cron está activo (si no está disponible, la app web hace la limpieza en segundo plano automáticamente)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule('cleanup-history-every-30-days');
  PERFORM cron.schedule('cleanup-history-every-30-days', '0 0 * * *', 'SELECT cleanup_old_history_logs()');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
