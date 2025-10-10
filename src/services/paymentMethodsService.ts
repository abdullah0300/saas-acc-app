// src/services/paymentMethodsService.ts

import { supabase } from './supabaseClient';

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: string;
  display_name: string;
  fields: Record<string, any>;
  is_primary: boolean;
  display_order: number;
  is_enabled: boolean;
  instructions?: string;
  supported_currencies?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Get all payment methods for a user
 */
export async function getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
}

/**
 * Get primary payment method for a user
 */
export async function getPrimaryPaymentMethod(userId: string): Promise<PaymentMethod | null> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .eq('is_enabled', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
  } catch (error) {
    console.error('Error fetching primary payment method:', error);
    return null;
  }
}

/**
 * Create a new payment method
 */
export async function createPaymentMethod(
  userId: string,
  paymentMethod: Omit<PaymentMethod, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<PaymentMethod> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert([
        {
          user_id: userId,
          ...paymentMethod,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating payment method:', error);
    throw error;
  }
}

/**
 * Update a payment method
 */
export async function updatePaymentMethod(
  id: string,
  updates: Partial<Omit<PaymentMethod, 'id' | 'user_id' | 'created_at'>>
): Promise<PaymentMethod> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating payment method:', error);
    throw error;
  }
}

/**
 * Delete a payment method (soft delete by disabling)
 */
export async function deletePaymentMethod(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting payment method:', error);
    throw error;
  }
}

/**
 * Set a payment method as primary
 */
export async function setPrimaryPaymentMethod(id: string, userId: string): Promise<void> {
  try {
    // The trigger will automatically unset other primaries
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_primary: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error setting primary payment method:', error);
    throw error;
  }
}

/**
 * Reorder payment methods
 */
export async function reorderPaymentMethods(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  try {
    const updates = orderedIds.map((id, index) => ({
      id,
      user_id: userId,
      display_order: index,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('payment_methods')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error reordering payment methods:', error);
    throw error;
  }
}

/**
 * Check if user is using new payment methods system
 */
export async function isUsingNewPaymentSystem(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('use_new_payment_methods')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.use_new_payment_methods || false;
  } catch (error) {
    console.error('Error checking payment system:', error);
    return false;
  }
}

/**
 * Enable new payment methods system for user
 */
export async function enableNewPaymentSystem(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_settings')
      .update({ use_new_payment_methods: true })
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error enabling new payment system:', error);
    throw error;
  }
}

/**
 * Migrate old bank details to new payment method
 */
export async function migrateOldBankDetails(userId: string): Promise<void> {
  try {
    // Get old settings
    const { data: oldSettings, error: fetchError } = await supabase
      .from('invoice_settings')
      .select('bank_name, account_number, routing_number, paypal_email')
      .eq('user_id', userId)
      .single();

    if (fetchError || !oldSettings) return;

    // Check if already has new methods
    const existing = await getPaymentMethods(userId);
    if (existing.length > 0) return;

    // Create US bank method if exists
    if (oldSettings.bank_name && oldSettings.account_number) {
      await createPaymentMethod(userId, {
        type: 'us_bank',
        display_name: 'Bank Transfer',
        fields: {
          bank_name: oldSettings.bank_name,
          account_number: oldSettings.account_number,
          routing_number: oldSettings.routing_number || '',
        },
        is_primary: true,
        display_order: 0,
        is_enabled: true,
        instructions: '',
        supported_currencies: ['USD'],
      });
    }

    // Create PayPal method if exists
    if (oldSettings.paypal_email) {
      await createPaymentMethod(userId, {
        type: 'paypal',
        display_name: 'PayPal',
        fields: {
          email: oldSettings.paypal_email,
        },
        is_primary: !oldSettings.bank_name, // Primary only if no bank
        display_order: 1,
        is_enabled: true,
        instructions: '',
        supported_currencies: ['USD', 'EUR', 'GBP'],
      });
    }

    // Mark as migrated
    await enableNewPaymentSystem(userId);
  } catch (error) {
    console.error('Error migrating bank details:', error);
    throw error;
  }
}
