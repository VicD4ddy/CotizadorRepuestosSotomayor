import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
  console.log('🔍 Buscando repuestos duplicados en la tabla kit_items...');
  
  const { data: items, error } = await supabase
    .from('kit_items')
    .select('id, kit_id, product_id, products(name)')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error al obtener kit_items:', error);
    return;
  }

  const groups = {};
  items.forEach(item => {
    const key = `${item.kit_id}_${item.product_id}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  const idsToDelete = [];
  let duplicateGroupsCount = 0;

  for (const [key, group] of Object.entries(groups)) {
    if (group.length > 1) {
      duplicateGroupsCount++;
      const productName = group[0]?.products?.name || group[0].product_id;
      console.log(`⚠️ Encontrado duplicado para "${productName}" (${group.length} copias en el cotizador ${group[0].kit_id})`);
      
      // Keep the first item (group[0]), mark the rest for deletion
      for (let i = 1; i < group.length; i++) {
        idsToDelete.push(group[i].id);
      }
    }
  }

  if (idsToDelete.length === 0) {
    console.log('✅ No se encontraron repuestos duplicados. Todo limpio.');
    return;
  }

  console.log(`🧹 Eliminando ${idsToDelete.length} registros duplicados de ${duplicateGroupsCount} grupos...`);

  const { error: deleteError } = await supabase
    .from('kit_items')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('❌ Error al eliminar duplicados:', deleteError);
  } else {
    console.log(`🎉 ¡Éxito! Se eliminaron ${idsToDelete.length} repuestos duplicados de la base de datos.`);
  }
}

cleanupDuplicates();
