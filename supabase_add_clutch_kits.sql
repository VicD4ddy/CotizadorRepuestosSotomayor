-- ==============================================================================
-- MIGRACIÓN / SEED: SECCIÓN CLUTCH Y KITS DE CROCHE SOTOMAYOR
-- ==============================================================================

-- 1. Asegurar categoría "Clutch" en kits (el campo category ya admite texto libre)
-- Las marcas de vehículos utilizadas corresponden a:
-- CHEVROLET: '4809bf03-7362-4601-8c67-f343d78add89'
-- FORD:      '796d4e84-bfb6-473c-a473-3ddaff41f219'
-- DODGE:     '212fdced-de7e-4b40-8c43-15cce6bc594c'
-- JEEP:      'e5ecad29-51cf-4bc7-b4bc-4381b00e3a52'

INSERT INTO kits (name, category, description, vehicle_brand_id)
VALUES
  ('C-30 - C-10', 'Clutch', 'PLATO: 1930 | DISCO: 811 | COLLARIN: CT24H', '4809bf03-7362-4601-8c67-f343d78add89'),
  ('F-100 - 350 . M-360', 'Clutch', 'PLATO: 1931 | DISCO: 804 | COLLARIN: 1183 H - 1181 H.F.', '796d4e84-bfb6-473c-a473-3ddaff41f219'),
  ('D100 - D300', 'Clutch', 'PLATO: 1930 o 1770 | DISCO: 768 | COLLARIN: 1054 HV', '212fdced-de7e-4b40-8c43-15cce6bc594c'),
  ('F-100 - 350 . M351', 'Clutch', 'PLATO: 1770 - 1930 | DISCO: 804 | COLLARIN: 1220 o 1183', '796d4e84-bfb6-473c-a473-3ddaff41f219'),
  ('C60 - C70', 'Clutch', 'PLATO: 1823 ABANICO o 1699 PERNO | DISCO: 686 NORMAL, RIGIDO, BOTONES | COLLARIN: 1087 HC', '4809bf03-7362-4601-8c67-f343d78add89'),
  ('F150 - 350 M-300', 'Clutch', 'PLATO: 1009 - 1931 | DISCO: 804 | COLLARIN: H83 - 1439', '796d4e84-bfb6-473c-a473-3ddaff41f219'),
  ('D600', 'Clutch', 'PLATO: 1859 - 1823 - 1699 | DISCO: 1776 - 686 | COLLARIN: 1072 HF', '212fdced-de7e-4b40-8c43-15cce6bc594c'),
  ('CJ-5-7 . J-10', 'Clutch', 'PLATO: 1876 | DISCO: 812 | COLLARIN: H83 H - H81 HF', 'e5ecad29-51cf-4bc7-b4bc-4381b00e3a52'),
  ('DODGE RAM 4000', 'Clutch', 'PLATO: 1918 o 1909 | DISCO: 918 o 965 | COLLARIN: 1437 C - 500055010 P', '212fdced-de7e-4b40-8c43-15cce6bc594c'),
  ('CARGO 815', 'Clutch', 'PLATO: 1823 ABANICO | DISCO: 818 | COLLARIN: F455352', '796d4e84-bfb6-473c-a473-3ddaff41f219')
ON CONFLICT DO NOTHING;
