-- ============================================
-- Repuestos Sotomayor - Database Schema
-- ============================================

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  cost DECIMAL(12,2) DEFAULT 0,
  price_usd DECIMAL(12,2) DEFAULT 0,
  image_url TEXT DEFAULT '',
  image_urls TEXT[] DEFAULT '{}',
  location TEXT DEFAULT '',
  fitment JSONB DEFAULT '[]'::jsonb,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- COMANDOS PARA ACTUALIZAR TABLA EXISTENTE:
-- Ejecuta esto en Supabase SQL Editor si ya creaste la tabla antes:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS fitment JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;
-- ==========================================

-- Settings (key-value for BCV rate etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value DECIMAL(12,4) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
  ('bcv_rate', 36.50),
  ('margin_percentage', 40.00),
  ('bcv_multiplier', 1.40)
ON CONFLICT (key) DO NOTHING;

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  total_usd DECIMAL(12,2) DEFAULT 0,
  bcv_rate DECIMAL(12,4) DEFAULT 0,
  status TEXT DEFAULT 'borrador',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quote Items
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT DEFAULT '',
  product_code TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  unit_price_usd DECIMAL(12,2) DEFAULT 0,
  brand_name TEXT DEFAULT '',
  brand_logo_url TEXT DEFAULT ''
);

-- Si la tabla ya existe, ejecuta:
-- ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT '';
-- ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS brand_logo_url TEXT DEFAULT '';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

-- Enable Row Level Security (optional, can be adjusted)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for anon key during dev)
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quotes" ON quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quote_items" ON quote_items FOR ALL USING (true) WITH CHECK (true);

-- Seed some categories
INSERT INTO categories (name, section) VALUES
  ('Filtros', 'Motor'),
  ('Bombas', 'Motor'),
  ('Correas', 'Motor'),
  ('Bujías', 'Motor'),
  ('Embragues', 'Transmisión'),
  ('Pastillas de Freno', 'Tren Delantero'),
  ('Discos de Freno', 'Tren Delantero'),
  ('Amortiguadores', 'Suspensión'),
  ('Terminales', 'Dirección'),
  ('Radiadores', 'Refrigeración')
ON CONFLICT DO NOTHING;

-- Seed some sample products
INSERT INTO products (code, name, description, category_id, cost, price_usd, image_url)
SELECT
  data.code, data.name, data.description, c.id, data.cost, data.price_usd, ''
FROM (
  VALUES
    ('WP-TY-4589', 'Bomba de Agua AISIN', 'Toyota Hilux 2.7L 05-15', 'Bombas', 32.00, 45.00),
    ('BP-FR-1022', 'Pastillas de Freno Delanteras Cerámica', 'Ford Explorer 11-19', 'Pastillas de Freno', 24.00, 32.50),
    ('OF-MZ-901', 'Filtro de Aceite Original', 'Mazda 3 / CX-5 2.0L', 'Filtros', 5.50, 8.00),
    ('CR-HN-305', 'Correa de Distribución Gates', 'Honda Civic 1.8L 06-15', 'Correas', 18.00, 25.00),
    ('AM-TY-770', 'Amortiguador Delantero KYB', 'Toyota Corolla 14-19', 'Amortiguadores', 35.00, 49.00),
    ('BJ-NS-442', 'Bujía Iridium NGK', 'Nissan Sentra 2.0L', 'Bujías', 4.50, 7.00),
    ('RD-CH-118', 'Radiador Completo', 'Chevrolet Cruze 1.8L 11-16', 'Radiadores', 65.00, 89.00),
    ('DF-TY-990', 'Disco de Freno Delantero Ventilado', 'Toyota RAV4 13-18', 'Discos de Freno', 28.00, 38.00),
    ('EM-HY-556', 'Kit de Embrague Completo', 'Hyundai Accent 12-17', 'Embragues', 55.00, 75.00),
    ('TR-FD-887', 'Terminal de Dirección', 'Ford F-150 09-14', 'Terminales', 12.00, 18.00)
) AS data(code, name, description, category_name, cost, price_usd)
LEFT JOIN categories c ON c.name = data.category_name
ON CONFLICT (code) DO NOTHING;

-- Kits (Combos/Templates)
CREATE TABLE IF NOT EXISTS kits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g. 'Motor' or 'Tren Delantero'
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kit Items (Products inside a kit)
CREATE TABLE IF NOT EXISTS kit_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  CONSTRAINT unique_kit_product UNIQUE (kit_id, product_id)
);

ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on kits" ON kits;
CREATE POLICY "Allow all on kits" ON kits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on kit_items" ON kit_items;
CREATE POLICY "Allow all on kit_items" ON kit_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- BRANDS AND PRICE HISTORY
-- ============================================

-- Brands
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add brand_id to products if it doesn't exist
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Add logo_url to brands if it doesn't exist
-- ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- Price History (Permanente)
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  old_cost DECIMAL(12,2),
  new_cost DECIMAL(12,2),
  old_price_usd DECIMAL(12,2),
  new_price_usd DECIMAL(12,2),
  old_name TEXT,
  new_name TEXT,
  old_description TEXT,
  new_description TEXT,
  change_type TEXT DEFAULT 'price',
  changed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on brands" ON brands;
CREATE POLICY "Allow all on brands" ON brands FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on product_price_history" ON product_price_history;
CREATE POLICY "Allow all on product_price_history" ON product_price_history FOR ALL USING (true) WITH CHECK (true);

-- Trigger function to track price, name and description changes
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

-- Create Trigger on products
DROP TRIGGER IF EXISTS trigger_record_price_change ON products;
CREATE TRIGGER trigger_record_price_change
AFTER INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION record_price_change();

-- ============================================================
-- Inventory Audit Log (Auditoría reversible para eliminaciones y kits)
-- ============================================================
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

-- ============================================================
-- Limpieza automática de historial cada 30 días
-- NOTA: product_price_history (precios, nombres, descripciones) PERDURA PARA SIEMPRE.
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_history_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM inventory_audit_log WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;


