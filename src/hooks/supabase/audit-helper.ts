import { supabase } from '@/lib/supabase';
import { AuditLogEntry } from '@/types';

/** Helper for audit logging with graceful fallback if table does not exist. */
export async function logAuditAction(
  entry: Omit<AuditLogEntry, 'id' | 'created_at'> | Array<Omit<AuditLogEntry, 'id' | 'created_at'>>
) {
  try {
    const { error } = await supabase.from('inventory_audit_log').insert(entry as any);
    if (error) {
      console.warn('Audit log notice (table may need creation via SQL script):', error.message);
    }
  } catch (err) {
    console.warn('Audit log error:', err);
  }
}
