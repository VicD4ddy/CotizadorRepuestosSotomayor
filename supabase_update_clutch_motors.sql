-- =========================================================================
-- MIGRACIÓN / ACTUALIZACIÓN: ASOCIACIÓN DE MOTORES A KITS DE CLUTCH
-- =========================================================================
-- Almacena las asociaciones directamente en los kits de clutch para
-- permitir búsqueda inmediata, compatibilidad bidireccional y visualización (Opción A).

UPDATE kits 
SET description = 'PLATO: 1930 | DISCO: 811 | COLLARIN: CT24H [MOTORES: Chevrolet 350 (VORTEC), Chevrolet 350 (TBI), Chevrolet 305 5.0L]'
WHERE name = 'C-30 - C-10' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1009 - 1931 | DISCO: 804 | COLLARIN: H83 - 1439 [MOTORES: Ford 300]'
WHERE name = 'F150 - 350 M-300' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1770 - 1930 | DISCO: 804 | COLLARIN: 1220 o 1183 [MOTORES: Ford 351, Ford 302]'
WHERE name = 'F-100 - 350 . M351' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1931 | DISCO: 804 | COLLARIN: 1183 H - 1181 H.F. [MOTORES: Ford 360]'
WHERE name = 'F-100 - 350 . M-360' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1823 ABANICO o 1699 PERNO | DISCO: 686 NORMAL, RIGIDO, BOTONES | COLLARIN: 1087 HC [MOTORES: Chevrolet 366]'
WHERE name = 'C60 - C70' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1876 | DISCO: 812 | COLLARIN: H83 H - H81 HF [MOTORES: Jeep 258 4.2L]'
WHERE name = 'CJ-5-7 . J-10' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1930 o 1770 | DISCO: 768 | COLLARIN: 1054 HV [MOTORES: Dodge 318, Dodge 360]'
WHERE name = 'D100 - D300' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1859 - 1823 - 1699 | DISCO: 1776 - 686 | COLLARIN: 1072 HF [MOTORES: Dodge 360]'
WHERE name = 'D600' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1918 o 1909 | DISCO: 918 o 965 | COLLARIN: 1437 C - 500055010 P [MOTORES: Dodge Ram 4000]'
WHERE name = 'DODGE RAM 4000' AND category = 'Clutch';

UPDATE kits 
SET description = 'PLATO: 1823 ABANICO | DISCO: 818 | COLLARIN: F455352 [MOTORES: Ford Cargo]'
WHERE name = 'CARGO 815' AND category = 'Clutch';
