const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const lines = env.split(/\r?\n/);
let supabaseUrl = '', supabaseKey = '';
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].replace(/["']/g, '').trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].replace(/["']/g, '').trim();
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncExistencia() {
  const excelPath = path.join(__dirname, '..', 'Recurso', 'Existencia.xls');
  if (!fs.existsSync(excelPath)) {
    console.error('No se encontró el archivo:', excelPath);
    process.exit(1);
  }

  console.log('Leyendo archivo Excel:', excelPath);
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const headers = (aoa[0] || []).map(h => String(h || '').trim());
  let codeIndex = 0;
  let nameIndex = 1;
  let stockIndex = 5;

  headers.forEach((h, idx) => {
    const lowerH = String(h || '').toLowerCase().trim();
    if (lowerH === 'código' || lowerH === 'codigo' || lowerH === 'code' || lowerH === 'sku') codeIndex = idx;
    if (lowerH === 'nombre' || lowerH === 'descripción' || lowerH === 'descripcion') nameIndex = idx;
    if (lowerH === 'existencia actual' || lowerH === 'existencia' || lowerH === 'stock' || lowerH === 'cantidad') stockIndex = idx;
  });

  console.log('Índices detectados -> Código:', codeIndex, '| Nombre:', nameIndex, '| Existencia:', stockIndex);

  const dbProducts = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from('products').select('id, code, name, stock').range(from, from + pageSize - 1);
    if (error) {
      console.error('Error cargando repuestos:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    dbProducts.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Repuestos en base de datos: ${dbProducts.length}`);
  const dbMap = new Map(dbProducts.map(p => [String(p.code || '').trim().toUpperCase(), p]));

  const updates = [];
  let notFound = 0;

  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.length === 0) continue;

    const code = String(row[codeIndex] || '').trim();
    if (!code) continue;

    let stock = 0;
    const rawVal = row[stockIndex];
    if (typeof rawVal === 'number') {
      stock = Math.max(0, Math.round(rawVal));
    } else if (rawVal !== undefined && rawVal !== null) {
      const cleanStr = String(rawVal).replace(',', '.').trim();
      const parsedNum = parseFloat(cleanStr);
      if (!isNaN(parsedNum) && parsedNum >= 0 && cleanStr.length <= 10) {
        stock = Math.round(parsedNum);
      }
    }
    if (stock > 999999) stock = 0;

    const upperCode = code.toUpperCase();
    const match = dbMap.get(upperCode);

    if (match) {
      updates.push({
        code: match.code,
        name: match.name,
        stock
      });
    } else {
      notFound++;
    }
  }

  console.log(`Listo para actualizar ${updates.length} repuestos (${notFound} códigos del Excel no están en la BD).`);

  const batchSize = 100;
  let updatedCount = 0;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'code' });
    if (error) {
      console.error(`Error en lote ${i}:`, error.message);
    } else {
      updatedCount += batch.length;
      process.stdout.write(`\rProgreso: ${updatedCount} / ${updates.length}`);
    }
  }

  console.log(`\n¡Actualización completada! ${updatedCount} repuestos actualizados.`);
}

syncExistencia();
