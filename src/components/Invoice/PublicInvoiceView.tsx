// src/components/Invoice/PublicInvoiceView.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient'; // Import existing client
import { format } from 'date-fns';
import { Invoice } from '../../types';

export const PublicInvoiceView: React.FC = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadInvoice();
    }
  }, [id]);

  const loadInvoice = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token || !id) {
        throw new Error('Invalid access link');
      }

      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from('invoice_access_tokens')
        .select('invoice_id')
        .eq('token', token)
        .eq('invoice_id', id)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        throw new Error('This link has expired or is invalid');
      }

      // Fetch invoice data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(*),
          items:invoice_items(*)
        `)
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', invoiceData.user_id)
        .single();

      // Fetch invoice settings
      const { data: settings } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .single();

      setInvoice(invoiceData);
      setProfile(profileData);
      setInvoiceSettings(settings);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '2px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading invoice...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontWeight: '500' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <p style={{ color: '#6b7280' }}>Invoice not found</p>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    const styles: any = {
      paid: { backgroundColor: '#d1fae5', color: '#065f46' },
      sent: { backgroundColor: '#dbeafe', color: '#1e40af' },
      overdue: { backgroundColor: '#fee2e2', color: '#991b1b' },
      draft: { backgroundColor: '#f3f4f6', color: '#374151' }
    };
    return styles[status] || styles.draft;
  };

  // Render invoice with inline styles for PDF generation
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="max-w-4xl" style={{ maxWidth: '896px', margin: '0 auto', padding: '32px' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '32px', borderBottom: '2px solid #e5e7eb', paddingBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            {/* Company Info */}
            <div>
              {(profile?.company_logo || invoiceSettings?.company_logo) ? (
                <img 
                  src={profile?.company_logo || invoiceSettings?.company_logo} 
                  alt="Company Logo" 
                  style={{ height: '64px', marginBottom: '16px', objectFit: 'contain' }} 
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    backgroundColor: invoiceSettings?.primary_color || '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '20px',
                    fontWeight: 'bold'
                  }}>
                    {(profile?.company_name || invoiceSettings?.company_name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                    {profile?.company_name || invoiceSettings?.company_name || 'Your Company'}
                  </h1>
                </div>
              )}
              
              <div style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
                {(profile?.company_address || invoiceSettings?.company_address) && (
                  <p style={{ whiteSpace: 'pre-line' }}>{profile?.company_address || invoiceSettings?.company_address}</p>
                )}
                {(profile?.phone || invoiceSettings?.company_phone) && (
                  <p>{profile?.phone || invoiceSettings?.company_phone}</p>
                )}
                {(profile?.email || invoiceSettings?.company_email) && (
                  <p>{profile?.email || invoiceSettings?.company_email}</p>
                )}
                {invoiceSettings?.company_website && (
                  <p>{invoiceSettings.company_website}</p>
                )}
                {invoiceSettings?.tax_number && (
                  <p>Tax ID: {invoiceSettings.tax_number}</p>
                )}
              </div>
            </div>

            {/* Invoice Title & Number */}
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>INVOICE</h2>
              <p style={{ fontSize: '18px', color: '#6b7280' }}>#{invoice.invoice_number}</p>
              <div style={{ 
                marginTop: '16px',
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '500',
                ...getStatusStyle(invoice.status)
              }}>
                {invoice.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & Dates Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
              Bill To:
            </h3>
            <div style={{ color: '#111827' }}>
              <p style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                {invoice.client?.name || 'Client Name'}
              </p>
              {invoice.client?.email && (
                <p style={{ color: '#6b7280', fontSize: '14px' }}>{invoice.client.email}</p>
              )}
              {invoice.client?.phone && (
                <p style={{ color: '#6b7280', fontSize: '14px' }}>{invoice.client.phone}</p>
              )}
              {invoice.client?.address && (
                <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', whiteSpace: 'pre-line' }}>
                  {invoice.client.address}
                </p>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: '600' }}>Date: </span>
              <span style={{ color: '#111827', fontSize: '14px' }}>
                {format(new Date(invoice.date), 'MMM dd, yyyy')}
              </span>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: '600' }}>Due Date: </span>
              <span style={{ color: '#111827', fontSize: '14px' }}>
                {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div style={{ marginBottom: '32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Description
                </th>
                <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Qty
                </th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rate
                </th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => (
                <tr key={item.id || index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 8px', fontSize: '14px', color: '#111827' }}>
                    {item.description}
                  </td>
                  <td style={{ textAlign: 'center', padding: '16px 8px', fontSize: '14px', color: '#111827' }}>
                    {item.quantity}
                  </td>
                  <td style={{ textAlign: 'right', padding: '16px 8px', fontSize: '14px', color: '#111827' }}>
                    ${typeof item.rate === 'number' ? item.rate.toFixed(2) : '0.00'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '16px 8px', fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                    ${typeof item.amount === 'number' ? item.amount.toFixed(2) : '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
          <div style={{ width: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#6b7280' }}>Subtotal:</span>
              <span style={{ color: '#111827', fontWeight: '500' }}>
                ${typeof invoice.subtotal === 'number' ? invoice.subtotal.toFixed(2) : '0.00'}
              </span>
            </div>
            {invoice.tax_rate > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: '#6b7280' }}>Tax ({invoice.tax_rate}%):</span>
                <span style={{ color: '#111827', fontWeight: '500' }}>
                  ${typeof invoice.tax_amount === 'number' ? invoice.tax_amount.toFixed(2) : '0.00'}
                </span>
              </div>
            )}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '18px', 
              fontWeight: 'bold', 
              borderTop: '2px solid #e5e7eb', 
              paddingTop: '8px',
              marginTop: '8px'
            }}>
              <span>Total:</span>
              <span style={{ color: invoiceSettings?.primary_color || '#4f46e5' }}>
                ${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {invoice.notes && (
          <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
              Notes:
            </h3>
            <p style={{ color: '#6b7280', fontSize: '14px', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
              {invoice.notes}
            </p>
          </div>
        )}

        {/* Payment Terms */}
        {invoiceSettings?.payment_terms && (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Payment Terms:
            </h3>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Payment is due within {invoiceSettings.payment_terms} days
            </p>
          </div>
        )}
      </div>
    </div>
  );
};