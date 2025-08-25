// src/components/Invoice/RecurringInvoiceEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

export const RecurringInvoiceEdit: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recurring, setRecurring] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Load recurring invoice
  useEffect(() => {
    loadRecurring();
  }, [id]);
  
  const loadRecurring = async () => {
    if (!id || !user) return;
    
    const { data, error } = await supabase
      .from('recurring_invoices')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) setRecurring(data);
    setLoading(false);
  };
  
  const handleSave = async () => {
    // Update logic here
    await supabase
      .from('recurring_invoices')
      .update({
        frequency: recurring.frequency,
        next_date: recurring.next_date,
        is_active: recurring.is_active,
        end_date: recurring.end_date
      })
      .eq('id', id);
    
    navigate('/invoices/recurring');
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Recurring Invoice</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Frequency</label>
          <select
            value={recurring.frequency}
            onChange={(e) => setRecurring({...recurring, frequency: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Next Date</label>
          <input
            type="date"
            value={recurring.next_date}
            onChange={(e) => setRecurring({...recurring, next_date: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">End Date (Optional)</label>
          <input
            type="date"
            value={recurring.end_date || ''}
            onChange={(e) => setRecurring({...recurring, end_date: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={recurring.is_active}
              onChange={(e) => setRecurring({...recurring, is_active: e.target.checked})}
              className="mr-2"
            />
            Active
          </label>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Save Changes
          </button>
          <button
            onClick={() => navigate('/invoices/recurring')}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};