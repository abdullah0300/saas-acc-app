// src/components/Invoice/PublicInvoiceView.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { Invoice } from '../../types';

export const PublicInvoiceView: React.FC = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token || !id) {
      setError('Invalid access link');
      setLoading(false);
      return;
    }

    try {
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

      setInvoice(invoiceData);
      setProfile(profileData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Invoice not found</p>
      </div>
    );
  }

  // Simplified invoice display (copy the essential parts from your InvoiceView)
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-8">
        {/* Company Header */}
        <div className="mb-8">
          {profile?.company_logo && (
            <img src={profile.company_logo} alt="Company Logo" className="h-16 mb-4" />
          )}
          <h1 className="text-2xl font-bold">{profile?.company_name || 'Company Name'}</h1>
          {profile?.company_address && (
            <p className="text-gray-600 whitespace-pre-line">{profile.company_address}</p>
          )}
        </div>

        {/* Invoice Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold">INVOICE</h2>
          <p className="text-gray-600">#{invoice.invoice_number}</p>
        </div>

        {/* Client and Dates */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-semibold mb-2">Bill To:</h3>
            <p className="font-medium">{invoice.client?.name}</p>
            {invoice.client?.address && (
              <p className="text-gray-600 whitespace-pre-line">{invoice.client.address}</p>
            )}
          </div>
          <div className="text-right">
            <p><span className="font-semibold">Date:</span> {format(new Date(invoice.date), 'MMM dd, yyyy')}</p>
            <p><span className="font-semibold">Due Date:</span> {format(new Date(invoice.due_date), 'MMM dd, yyyy')}</p>
          </div>
        </div>

        {/* Invoice Items */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2">Description</th>
              <th className="text-center py-2">Qty</th>
              <th className="text-right py-2">Rate</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2">{item.description}</td>
                <td className="text-center py-2">{item.quantity}</td>
                <td className="text-right py-2">${item.rate.toFixed(2)}</td>
                <td className="text-right py-2">${item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between mb-2">
              <span>Subtotal:</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between mb-2">
                <span>Tax ({invoice.tax_rate}%):</span>
                <span>${invoice.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>${invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8">
            <h3 className="font-semibold mb-2">Notes:</h3>
            <p className="text-gray-600 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};