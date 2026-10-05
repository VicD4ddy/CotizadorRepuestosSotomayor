-- ============================================================
-- AGREGAR STOCK MÍNIMO POR PRODUCTO Y ALERTAS AL SISTEMA
-- Ejecuta este script en el Editor SQL de Supabase
-- ============================================================

-- 1. Agregar columna min_stock a la tabla products si no existe (por defecto 0 = sin alerta de mínimo)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;

-- 2. Asegurar que los productos existentes tengan 0 si el valor es nulo
UPDATE products 
SET min_stock = 0 
WHERE min_stock IS NULL;

-- 3. Crear índice para optimizar consultas de inventario y alertas
CREATE INDEX IF NOT EXISTS idx_products_min_stock ON products(min_stock);
