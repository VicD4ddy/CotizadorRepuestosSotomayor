const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://adxgyekseydqrgsuzhqw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeGd5ZWtzZXlkcXJnc3V6aHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzg2NDgsImV4cCI6MjA5MjYxNDY0OH0.igqpJM1xSH5bqxo5ejCjdDTYSb7-fDE9DUtdoL6-Xxg'
);

const BRAND_IDS = {
  CHEVROLET: '4809bf03-7362-4601-8c67-f343d78add89',
  FORD: '796d4e84-bfb6-473c-a473-3ddaff41f219',
  DODGE: '212fdced-de7e-4b40-8c43-15cce6bc594c',
  JEEP: 'e5ecad29-51cf-4bc7-b4bc-4381b00e3a52',
};

const CLUTCH_KITS = [
  {
    name: 'C-30 - C-10',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.CHEVROLET,
    description: 'PLATO: 1930 | DISCO: 811 | COLLARIN: CT24H',
    codes: ['1930', '811', 'CT24H', 'FK-1930'],
  },
  {
    name: 'F-100 - 350 . M-360',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.FORD,
    description: 'PLATO: 1931 | DISCO: 804 | COLLARIN: 1183 H - 1181 H.F.',
    codes: ['1931', '804', '1183', '1181'],
  },
  {
    name: 'D100 - D300',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.DODGE,
    description: 'PLATO: 1930 o 1770 | DISCO: 768 | COLLARIN: 1054 HV',
    codes: ['1930', '1770', '768', '1054'],
  },
  {
    name: 'F-100 - 350 . M351',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.FORD,
    description: 'PLATO: 1770 - 1930 | DISCO: 804 | COLLARIN: 1220 o 1183',
    codes: ['1770', '1930', '804', '1220', '1183'],
  },
  {
    name: 'C60 - C70',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.CHEVROLET,
    description: 'PLATO: 1823 ABANICO o 1699 PERNO | DISCO: 686 NORMAL, RIGIDO, BOTONES | COLLARIN: 1087 HC',
    codes: ['1823', '1699', '686', '1087', '1171'],
  },
  {
    name: 'F150 - 350 M-300',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.FORD,
    description: 'PLATO: 1009 - 1931 | DISCO: 804 | COLLARIN: H83 - 1439',
    codes: ['1009', '1931', '804', '1439', 'FK-1009', 'MU10091'],
  },
  {
    name: 'D600',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.DODGE,
    description: 'PLATO: 1859 - 1823 - 1699 | DISCO: 1776 - 686 | COLLARIN: 1072 HF',
    codes: ['1859', '1823', '1699', '1776', '686', '1072'],
  },
  {
    name: 'CJ-5-7 . J-10',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.JEEP,
    description: 'PLATO: 1876 | DISCO: 812 | COLLARIN: H83 H - H81 HF',
    codes: ['1876', '812', 'H83', 'H81'],
  },
  {
    name: 'DODGE RAM 4000',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.DODGE,
    description: 'PLATO: 1918 o 1909 | DISCO: 918 o 965 | COLLARIN: 1437 C - 500055010 P',
    codes: ['1918', '1909', '918', '965', '1437', '500055010'],
  },
  {
    name: 'CARGO 815',
    category: 'Clutch',
    vehicle_brand_id: BRAND_IDS.FORD,
    description: 'PLATO: 1823 ABANICO | DISCO: 818 | COLLARIN: F455352',
    codes: ['1823', '818', 'F455352'],
  },
];

async function seed() {
  console.log('--- Iniciando creación de Kits de Clutch ---');

  // Obtener todos los productos para vinculación inteligente
  const { data: allProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, code, name');
  if (prodErr) throw prodErr;

  console.log(`Cargados ${allProducts.length} productos de inventario.`);

  for (const kitDef of CLUTCH_KITS) {
    // 1. Verificar si ya existe
    const { data: existingKits } = await supabase
      .from('kits')
      .select('id, name')
      .eq('name', kitDef.name)
      .eq('category', 'Clutch');

    let kitId;
    if (existingKits && existingKits.length > 0) {
      kitId = existingKits[0].id;
      console.log(`Kit "${kitDef.name}" ya existe (ID: ${kitId}). Actualizando descripción...`);
      await supabase
        .from('kits')
        .update({
          description: kitDef.description,
          vehicle_brand_id: kitDef.vehicle_brand_id,
        })
        .eq('id', kitId);
    } else {
      const { data: createdKit, error: createErr } = await supabase
        .from('kits')
        .insert({
          name: kitDef.name,
          category: kitDef.category,
          vehicle_brand_id: kitDef.vehicle_brand_id,
          description: kitDef.description,
        })
        .select()
        .single();

      if (createErr) {
        console.error(`Error creando kit ${kitDef.name}:`, createErr);
        continue;
      }
      kitId = createdKit.id;
      console.log(`Kit "${kitDef.name}" creado con éxito (ID: ${kitId}).`);
    }

    // 2. Buscar productos coincidentes y vincularlos
    const matchingProducts = allProducts.filter((p) => {
      const codeUpper = (p.code || '').toUpperCase();
      const nameUpper = (p.name || '').toUpperCase();
      const isClutchRelated = /PLATO|PRENSA|DISCO|CLUTCH|CROCHE|COLLAR[IÍ]N|ROLINERA/i.test(nameUpper) ||
                              /FK-|B\d|CG-|CB/i.test(codeUpper);

      if (!isClutchRelated) return false;

      return kitDef.codes.some((c) => {
        const cleanC = c.toUpperCase();
        return codeUpper.includes(cleanC) || nameUpper.includes(cleanC);
      });
    });

    console.log(`  Encontrados ${matchingProducts.length} repuestos coincidentes para ${kitDef.name}.`);

    // 3. Obtener items ya vinculados
    const { data: existingItems } = await supabase
      .from('kit_items')
      .select('product_id')
      .eq('kit_id', kitId);
    const existingIds = new Set((existingItems || []).map((i) => i.product_id));

    const newItemsToInsert = matchingProducts
      .filter((p) => !existingIds.has(p.id))
      .map((p) => ({
        kit_id: kitId,
        product_id: p.id,
        quantity: 1,
      }));

    if (newItemsToInsert.length > 0) {
      const { error: insertItemsErr } = await supabase
        .from('kit_items')
        .insert(newItemsToInsert);
      if (insertItemsErr) {
        console.error(`  Error vinculando items a ${kitDef.name}:`, insertItemsErr);
      } else {
        console.log(`  Vinculados ${newItemsToInsert.length} repuestos nuevos.`);
      }
    }
  }

  console.log('--- Proceso finalizado exitosamente ---');
}

seed().catch(console.error);
