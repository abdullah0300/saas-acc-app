// src/services/emailService.ts
import { supabase } from './supabaseClient';

export interface SendInvoiceEmailParams {
  invoiceId: string;
  recipientEmail: string;
  ccEmails?: string[];
  subject?: string;
  message?: string;
  attachPdf?: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  template_type: 'invoice' | 'reminder' | 'receipt' | 'custom';
  is_default: boolean;
}

export const emailService = {
  // Send invoice email
  async sendInvoiceEmail(params: SendInvoiceEmailParams) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No authentication session');
      }

      console.log('Sending invoice email with params:', params);

      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-invoice-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Email API error:', responseData);
        throw new Error(responseData.error || 'Failed to send email');
      }

      return responseData;
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  },

  // Get email logs for an invoice
  async getInvoiceEmailLogs(invoiceId: string) {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get email templates
  async getEmailTemplates() {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as EmailTemplate[];
  },

  // Create email template
  async createEmailTemplate(template: Omit<EmailTemplate, 'id'>) {
    const { data, error } = await supabase
      .from('email_templates')
      .insert([template])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update email template
  async updateEmailTemplate(id: string, updates: Partial<EmailTemplate>) {
    const { data, error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete email template
  async deleteEmailTemplate(id: string) {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Send bulk invoice emails
  async sendBulkInvoiceEmails(invoiceIds: string[], template?: EmailTemplate) {
    const results: Array<{
      invoiceId: string;
      success: boolean;
      result?: any;
      error?: string;
    }> = [];
    
    for (const invoiceId of invoiceIds) {
      try {
        // Get invoice details first
        const { data: invoice } = await supabase
          .from('invoices')
          .select('*, client:clients(*)')
          .eq('id', invoiceId)
          .single();

        if (invoice && invoice.client?.email) {
          const result = await this.sendInvoiceEmail({
            invoiceId,
            recipientEmail: invoice.client.email,
            subject: template?.subject,
            message: template?.body_html
          });
          
          results.push({ invoiceId, success: true, result });
        } else {
          results.push({ 
            invoiceId, 
            success: false, 
            error: 'No client email found' 
          });
        }
      } catch (error: any) {
        results.push({ 
          invoiceId, 
          success: false, 
          error: error?.message || String(error) || 'Unknown error occurred'
        });
      }
    }
    
    return results;
  }
};