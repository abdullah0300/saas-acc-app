// src/components/Invoice/InvoiceSettings.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Upload, 
  Globe, 
  Mail, 
  MessageCircle,
  Bell,
  FileText,
  Palette,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';

interface InvoiceSettingsProps {
  onClose: () => void;
}

export const InvoiceSettings: React.FC<InvoiceSettingsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'company' | 'templates' | 'notifications' | 'payment'>('company');
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [settings, setSettings] = useState({
    // Company Details
    company_name: '',
    company_logo: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    tax_number: '',
    
    // Invoice Template
    invoice_prefix: 'INV-',
    invoice_color: '#3B82F6',
    payment_terms: '30',
    fill_number_gaps: true,
    invoice_notes: '',
    invoice_footer: '',
    
    // Notification Settings
    email_notifications: true,
    whatsapp_notifications: false,
    notification_email: '',
    notification_phone: '',
    reminder_days: '3',
    auto_send_recurring: false,
    
    // Payment Settings
    bank_name: '',
    account_number: '',
    routing_number: '',
    paypal_email: '',
    payment_instructions: ''
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setSettings({ ...settings, ...data });
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingLogo(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/invoice-logo.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      setSettings({ ...settings, company_logo: publicUrl });
    } catch (err: any) {
      alert('Error uploading logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('invoice_settings')
        .upsert({
          user_id: user.id,
          ...settings
        });
      
      if (error) throw error;
      
      alert('Settings saved successfully!');
      onClose();
    } catch (err: any) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'company', label: 'Company Details', icon: FileText },
    { id: 'templates', label: 'Invoice Template', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'payment', label: 'Payment Info', icon: DollarSign }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Invoice Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-8rem)]">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 p-4 border-r">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'company' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Details</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Logo
                  </label>
                  <div className="flex items-center space-x-4">
                    {settings.company_logo && (
                      <img
                        src={settings.company_logo}
                        alt="Company logo"
                        className="h-20 w-20 object-contain border rounded"
                      />
                    )}
                    <label className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={uploadingLogo}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={settings.company_name}
                      onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax Number
                    </label>
                    <input
                      type="text"
                      value={settings.tax_number}
                      onChange={(e) => setSettings({ ...settings, tax_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={settings.company_email}
                      onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={settings.company_phone}
                      onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={settings.company_website}
                      onChange={(e) => setSettings({ ...settings, company_website: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    value={settings.company_address}
                    onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Template Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Prefix
                    </label>
                    <input
                      type="text"
                      value={settings.invoice_prefix}
                      onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mt-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Fill gaps in invoice numbers
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Automatically reuse missing invoice numbers in the sequence
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.fill_number_gaps}
                      onChange={(e) => setSettings({ ...settings, fill_number_gaps: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Theme Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={settings.invoice_color}
                        onChange={(e) => setSettings({ ...settings, invoice_color: e.target.value })}
                        className="h-10 w-20"
                      />
                      <span className="text-sm text-gray-500">{settings.invoice_color}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Payment Terms (days)
                    </label>
                    <input
                      type="number"
                      value={settings.payment_terms}
                      onChange={(e) => setSettings({ ...settings, payment_terms: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Invoice Notes
                  </label>
                  <textarea
                    value={settings.invoice_notes}
                    onChange={(e) => setSettings({ ...settings, invoice_notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Thank you for your business!"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Footer Text
                  </label>
                  <textarea
                    value={settings.invoice_footer}
                    onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Payment is due within 30 days. Thank you!"
                  />
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
                
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.email_notifications}
                      onChange={(e) => setSettings({ ...settings, email_notifications: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      Enable email notifications
                    </span>
                  </label>
                  <label className="flex items-center bg-blue-50 p-3 rounded-lg">
                    <input
                      type="checkbox"
                      checked={settings.auto_send_recurring}
                      onChange={(e) => setSettings({ ...settings, auto_send_recurring: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="text-sm font-medium text-gray-700 flex items-center">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Auto-send recurring invoices
                      </span>
                      <span className="text-xs text-gray-500">
                        Automatically email recurring invoices to clients when generated
                      </span>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.whatsapp_notifications}
                      onChange={(e) => setSettings({ ...settings, whatsapp_notifications: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      Enable WhatsApp notifications
                    </span>
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notification Email
                    </label>
                    <input
                      type="email"
                      value={settings.notification_email}
                      onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!settings.email_notifications}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      value={settings.notification_phone}
                      onChange={(e) => setSettings({ ...settings, notification_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!settings.whatsapp_notifications}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Send reminder before due date (days)
                    </label>
                    <input
                      type="number"
                      value={settings.reminder_days}
                      onChange={(e) => setSettings({ ...settings, reminder_days: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Automatic Notifications</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Invoice sent confirmation</li>
                    <li>• Payment reminder {settings.reminder_days} days before due date</li>
                    <li>• Overdue invoice alerts</li>
                    <li>• Payment received confirmation</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={settings.bank_name}
                      onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={settings.account_number}
                      onChange={(e) => setSettings({ ...settings, account_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={settings.routing_number}
                      onChange={(e) => setSettings({ ...settings, routing_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PayPal Email
                    </label>
                    <input
                      type="email"
                      value={settings.paypal_email}
                      onChange={(e) => setSettings({ ...settings, paypal_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Instructions
                  </label>
                  <textarea
                    value={settings.payment_instructions}
                    onChange={(e) => setSettings({ ...settings, payment_instructions: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Please include invoice number with your payment..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};