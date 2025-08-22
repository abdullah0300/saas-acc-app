import { supabase } from './supabaseClient';

export class VATAuditService {
  // Only log for UK users
  static async logVATLink(
    userId: string,
    sourceType: 'invoice' | 'expense' | 'income' | 'credit_note',
    sourceId: string,
    targetType: 'income' | 'vat_return',
    targetId: string,
    metadata?: any
  ) {
    // Check if UK user
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('country')
      .eq('user_id', userId)
      .single();
    
    // Only track for UK users
    if (userSettings?.country !== 'GB') return;
    
    await supabase
      .from('tax_audit_trail')
      .insert({
        user_id: userId,
        country_code: 'GB',
        source_type: sourceType,
        source_id: sourceId,
        target_type: targetType,
        target_id: targetId,
        transformation: `${sourceType}_to_${targetType}`,
        metadata: metadata || {}
      });
  }
}