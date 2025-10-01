// src/components/Invoice/RecurringInvoiceTemplateEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { InvoiceForm } from './InvoiceForm';

/**
 * This component loads a recurring invoice template and allows editing
 * It wraps InvoiceForm and handles saving back to the recurring_invoices table
 */
export const RecurringInvoiceTemplateEdit: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recurringData, setRecurringData] = useState<any>(null);

  useEffect(() => {
    loadRecurringTemplate();
  }, [id, user]);

  const loadRecurringTemplate = async () => {
    if (!id || !user) return;

    try {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (!data) {
        alert('Recurring invoice not found');
        navigate('/invoices/recurring');
        return;
      }

      setRecurringData(data);
    } catch (err: any) {
      console.error('Error loading recurring template:', err);
      alert('Failed to load template');
      navigate('/invoices/recurring');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!recurringData) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Recurring invoice template not found</p>
        <button
          onClick={() => navigate('/invoices/recurring')}
          className="mt-4 text-indigo-600 hover:text-indigo-700"
        >
          Back to Recurring Invoices
        </button>
      </div>
    );
  }

  // Pass recurring invoice data to InvoiceForm via special mode
  return (
    <div>
      <InvoiceForm
        recurringTemplateId={id}
        recurringTemplateData={recurringData}
      />
    </div>
  );
};
