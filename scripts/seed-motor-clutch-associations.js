const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://adxgyekseydqrgsuzhqw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeGd5ZWtzZXlkcXJnc3V6aHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzg2NDgsImV4cCI6MjA5MjYxNDY0OH0.igqpJM1xSH5bqxo5ejCjdDTYSb7-fDE9DUtdoL6-Xxg'
);

const MAPPINGS = [
  {
    name: 'C-30 - C-10',
    motors: ['Chevrolet 350 (VORTEC)', 'Chevrolet 350 (TBI)', 'Chevrolet 305 5.0L'],
  },
  {
    name: 'F150 - 350 M-300',
    motors: ['Ford 300'],
  },
  {
    name: 'F-100 - 350 . M351',
    motors: ['Ford 351', 'Ford 302'],
  },
  {
    name: 'F-100 - 350 . M-360',
    motors: ['Ford 360'],
  },
  {
    name: 'C60 - C70',
    motors: ['Chevrolet 366'],
  },
  {
    name: 'CJ-5-7 . J-10',
    motors: ['Jeep 258 4.2L'],
  },
  {
    name: 'D100 - D300',
    motors: ['Dodge 318', 'Dodge 360'],
  },
  {
    name: 'D600',
    motors: ['Dodge 360'],
  },
  {
    name: 'DODGE RAM 4000',
    motors: ['Dodge Ram 4000'],
  },
  {
    name: 'CARGO 815',
    motors: ['Ford Cargo'],
  },
];

async function run() {
  const { data: clutchKits, error } = await supabase.from('kits').select('*').eq('category', 'Clutch');
  if (error) {
    console.error('Error fetching clutch kits:', error);
    return;
  }

  for (const mapping of MAPPINGS) {
    const kit = clutchKits.find((k) => k.name.trim() === mapping.name.trim());
    if (!kit) {
      console.log('Kit not found for mapping:', mapping.name);
      continue;
    }

    const cleanDesc = (kit.description || '')
      .replace(/\[MOTORES:\s*[^\]]+\]/gi, '')
      .trim()
      .replace(/\|\s*$/, '')
      .trim();
    const newDesc = cleanDesc ? `${cleanDesc} [MOTORES: ${mapping.motors.join(', ')}]` : `[MOTORES: ${mapping.motors.join(', ')}]`;

    const { error: updateError } = await supabase
      .from('kits')
      .update({ description: newDesc })
      .eq('id', kit.id);

    if (updateError) {
      console.error('Error updating kit:', kit.name, updateError);
    } else {
      console.log('Updated:', kit.name, '->', newDesc);
    }
  }
}

run();
