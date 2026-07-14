-- ============================================================
-- CONFIGURACIÓN DE ACTIVACIÓN/DESACTIVACIÓN DE PRODUCTOS
-- Ejecuta todo este script en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna is_active a la tabla products si no existe (por defecto false/desactivado)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

ALTER TABLE products
ALTER COLUMN is_active SET DEFAULT false;

-- 2. Asegurar que todos los repuestos pasen a estar desactivados (false) por defecto en la web
UPDATE products
SET is_active = false;

-- 3. Crear índice para búsquedas ultra-rápidas por estado activo/inactivo
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- 4. Habilitar extensiones necesarias por si no estaban habilitadas
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 5. Actualizar la función search_products (para SmartSearchBar) incluyendo filtro is_active
DROP FUNCTION IF EXISTS search_products(text, integer);
CREATE OR REPLACE FUNCTION search_products(
  search_term text,
  result_limit int DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  name text,
  price numeric,
  image_url text,
  code_1 text,
  code_2 text,
  brand_name text,
  brand_image_url text,
  category_name text,
  relevance real
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_term text;
BEGIN
  normalized_term := lower(unaccent(search_term));

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.price,
    p.image_url,
    p.code_1,
    p.code_2,
    b.name AS brand_name,
    b.image_url AS brand_image_url,
    c.name AS category_name,
    GREATEST(
      similarity(lower(unaccent(p.name)), normalized_term),
      similarity(lower(unaccent(COALESCE(p.code_1, ''))), normalized_term),
      similarity(lower(unaccent(COALESCE(p.code_2, ''))), normalized_term),
      similarity(lower(unaccent(COALESCE(b.name, ''))), normalized_term),
      CASE
        WHEN lower(unaccent(p.name)) ILIKE '%' || normalized_term || '%' THEN 0.9
        WHEN lower(unaccent(COALESCE(p.code_1, ''))) ILIKE '%' || normalized_term || '%' THEN 0.85
        WHEN lower(unaccent(COALESCE(p.code_2, ''))) ILIKE '%' || normalized_term || '%' THEN 0.85
        WHEN lower(unaccent(COALESCE(b.name, ''))) ILIKE '%' || normalized_term || '%' THEN 0.8
        ELSE 0
      END
    ) AS relevance
  FROM products p
  LEFT JOIN brands b ON p.brand_id = b.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE
    (p.is_active IS TRUE OR p.is_active IS NULL)
    AND (
      lower(unaccent(p.name)) ILIKE '%' || normalized_term || '%'
      OR lower(unaccent(COALESCE(p.description, ''))) ILIKE '%' || normalized_term || '%'
      OR lower(unaccent(COALESCE(p.code_1, ''))) ILIKE '%' || normalized_term || '%'
      OR lower(unaccent(COALESCE(p.code_2, ''))) ILIKE '%' || normalized_term || '%'
      OR lower(unaccent(COALESCE(b.name, ''))) ILIKE '%' || normalized_term || '%'
      OR similarity(lower(unaccent(p.name)), normalized_term) > 0.2
    )
  ORDER BY relevance DESC
  LIMIT result_limit;
END;
$$;

-- 6. Actualizar la función catalog_search (para el Catálogo) incluyendo filtro is_active y specifications
DROP FUNCTION IF EXISTS catalog_search(text,text,text,text,integer,integer);
CREATE OR REPLACE FUNCTION catalog_search(
  search_term text DEFAULT '',
  category_filter text DEFAULT NULL,
  brand_filter text DEFAULT NULL,
  sort_by text DEFAULT 'relevance',
  page_num int DEFAULT 1,
  page_size int DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  image_url text,
  image_2 text,
  code_1 text,
  code_2 text,
  brand_name text,
  brand_image_url text,
  category_name text,
  created_at timestamptz,
  specifications jsonb,
  total_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_term text;
  offset_val int;
BEGIN
  normalized_term := lower(unaccent(COALESCE(NULLIF(search_term, ''), '')));
  offset_val := (page_num - 1) * page_size;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id,
      p.name,
      p.description,
      p.price,
      p.image_url,
      p.image_2,
      p.code_1,
      p.code_2,
      b.name AS brand_name,
      b.image_url AS brand_image_url,
      c.name AS category_name,
      p.created_at,
      p.specifications,
      CASE
        WHEN normalized_term = '' THEN 1.0::real
        ELSE GREATEST(
          similarity(lower(unaccent(p.name)), normalized_term),
          CASE
            WHEN lower(unaccent(p.name)) ILIKE '%' || normalized_term || '%' THEN 0.9
            ELSE 0
          END
        )
      END AS relevance
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE
      (p.is_active IS TRUE OR p.is_active IS NULL)
      AND (category_filter IS NULL OR c.name = category_filter)
      AND (brand_filter IS NULL OR b.name = brand_filter)
      AND (
        normalized_term = ''
        OR lower(unaccent(p.name)) ILIKE '%' || normalized_term || '%'
        OR lower(unaccent(COALESCE(p.description, ''))) ILIKE '%' || normalized_term || '%'
        OR lower(unaccent(COALESCE(p.code_1, ''))) ILIKE '%' || normalized_term || '%'
        OR lower(unaccent(COALESCE(p.code_2, ''))) ILIKE '%' || normalized_term || '%'
        OR lower(unaccent(COALESCE(b.name, ''))) ILIKE '%' || normalized_term || '%'
        OR similarity(lower(unaccent(p.name)), normalized_term) > 0.25
      )
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS cnt FROM filtered
  )
  SELECT
    f.id,
    f.name,
    f.description,
    f.price,
    f.image_url,
    f.image_2,
    f.code_1,
    f.code_2,
    f.brand_name,
    f.brand_image_url,
    f.category_name,
    f.created_at,
    f.specifications,
    cnt.cnt AS total_count
  FROM filtered f
  CROSS JOIN counted cnt
  ORDER BY
    CASE WHEN sort_by = 'lowest_price' THEN f.price END ASC,
    CASE WHEN sort_by = 'highest_price' THEN f.price END DESC,
    CASE WHEN sort_by = 'newest' THEN f.created_at END DESC,
    CASE WHEN sort_by = 'relevance' OR sort_by IS NULL THEN f.relevance END DESC,
    f.created_at DESC
  LIMIT page_size
  OFFSET offset_val;
END;
$$;
