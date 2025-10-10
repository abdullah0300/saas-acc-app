// src/components/Settings/PaymentMethodsManager.tsx

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Star,
  Check,
  X,
  GripVertical,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  setPrimaryPaymentMethod,
  migrateOldBankDetails,
  isUsingNewPaymentSystem,
  PaymentMethod,
} from '../../services/paymentMethodsService';
import {
  PAYMENT_METHOD_TEMPLATES,
  PaymentMethodTemplate
} from '../../config/paymentMethodTemplates';

export const PaymentMethodsManager: React.FC = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useData();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [usingNewSystem, setUsingNewSystem] = useState(false);

  useEffect(() => {
    if (user) {
      loadPaymentMethods();
      checkSystemStatus();
    }
  }, [user]);

  const checkSystemStatus = async () => {
    if (!user) return;
    const isNew = await isUsingNewPaymentSystem(effectiveUserId || user.id);
    setUsingNewSystem(isNew);
  };

  const loadPaymentMethods = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const methods = await getPaymentMethods(effectiveUserId || user.id);
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!user) return;
    try {
      await migrateOldBankDetails(effectiveUserId || user.id);
      await loadPaymentMethods();
      await checkSystemStatus();
      alert('Migration successful! Your old bank details have been converted to the new system.');
    } catch (error: any) {
      alert('Error migrating: ' + error.message);
    }
  };

  const handleSelectTemplate = (templateType: string) => {
    setSelectedTemplate(templateType);
    const template = PAYMENT_METHOD_TEMPLATES[templateType];
    setDisplayName(template.displayName);
    setInstructions(template.defaultInstructions || '');
    setFormData({});
    setFormErrors({});
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
    // Clear error for this field
    if (formErrors[key]) {
      setFormErrors({ ...formErrors, [key]: '' });
    }
  };

  const validateForm = (): boolean => {
    if (!selectedTemplate) return false;

    const template = PAYMENT_METHOD_TEMPLATES[selectedTemplate];
    const errors: Record<string, string> = {};

    template.fields.forEach(field => {
      const value = formData[field.key];

      if (field.required && !value) {
        errors[field.key] = `${field.label} is required`;
      } else if (value && field.validation && !field.validation.test(value)) {
        errors[field.key] = `Invalid ${field.label.toLowerCase()} format`;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!user || !selectedTemplate) return;

    if (!validateForm()) {
      return;
    }

    try {
      const template = PAYMENT_METHOD_TEMPLATES[selectedTemplate];

      if (editingMethod) {
        // Update existing
        await updatePaymentMethod(editingMethod.id, {
          display_name: displayName,
          fields: formData,
          instructions,
        });
      } else {
        // Create new
        await createPaymentMethod(effectiveUserId || user.id, {
          type: template.type,
          display_name: displayName,
          fields: formData,
          is_primary: paymentMethods.length === 0, // First one is primary
          display_order: paymentMethods.length,
          is_enabled: true,
          instructions,
          supported_currencies: ['USD'], // Default, can be customized
        });
      }

      await loadPaymentMethods();
      handleCloseModal();
    } catch (error: any) {
      alert('Error saving payment method: ' + error.message);
    }
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setSelectedTemplate(method.type);
    setDisplayName(method.display_name);
    setFormData(method.fields);
    setInstructions(method.instructions || '');
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payment method?')) return;

    try {
      await deletePaymentMethod(id);
      await loadPaymentMethods();
    } catch (error: any) {
      alert('Error deleting payment method: ' + error.message);
    }
  };

  const handleSetPrimary = async (id: string) => {
    if (!user) return;
    try {
      await setPrimaryPaymentMethod(id, effectiveUserId || user.id);
      await loadPaymentMethods();
    } catch (error: any) {
      alert('Error setting primary: ' + error.message);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setSelectedTemplate(null);
    setEditingMethod(null);
    setFormData({});
    setFormErrors({});
    setDisplayName('');
    setInstructions('');
  };

  const renderField = (field: any) => {
    const value = formData[field.key] || '';
    const error = formErrors[field.key];

    if (field.type === 'textarea') {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={3}
          />
          {field.helpText && !error && (
            <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type={field.type}
          value={value}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {field.helpText && !error && (
          <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage how your clients can pay you
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Payment Method
        </button>
      </div>

      {/* Migration Notice */}
      {!usingNewSystem && paymentMethods.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Upgrade to New Payment Methods System
              </p>
              <p className="text-sm text-blue-700 mt-1">
                We've detected you might have old bank details. Would you like to migrate them to the new flexible system?
              </p>
              <button
                onClick={handleMigrate}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Migrate Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No payment methods added yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Your First Payment Method
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`border rounded-lg p-4 ${
                method.is_primary ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-2xl">
                    {PAYMENT_METHOD_TEMPLATES[method.type]?.icon || '💳'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">
                        {method.display_name}
                      </h4>
                      {method.is_primary && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {PAYMENT_METHOD_TEMPLATES[method.type]?.description || method.type}
                    </p>

                    {/* Display fields */}
                    <div className="mt-3 space-y-1">
                      {Object.entries(method.fields).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="text-gray-600 capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>{' '}
                          <span className="font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>

                    {method.instructions && (
                      <p className="text-sm text-gray-500 mt-2 italic">
                        {method.instructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!method.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(method.id)}
                      className="p-2 text-gray-400 hover:text-yellow-500"
                      title="Set as primary"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(method)}
                    className="p-2 text-gray-400 hover:text-blue-600"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(method.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!selectedTemplate ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Choose the type of payment method you want to add:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.values(PAYMENT_METHOD_TEMPLATES).map((template) => (
                      <button
                        key={template.type}
                        onClick={() => handleSelectTemplate(template.type)}
                        className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <div className="text-2xl mb-2">{template.icon}</div>
                        <h4 className="font-semibold text-gray-900">
                          {template.displayName}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {template.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., My UK Bank, PayPal Account"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This name will appear on your invoices
                    </p>
                  </div>

                  {/* Template Fields */}
                  {PAYMENT_METHOD_TEMPLATES[selectedTemplate].fields.map(renderField)}

                  {/* Instructions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Instructions (Optional)
                    </label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Additional instructions for clients..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              {selectedTemplate && (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  {editingMethod ? 'Update' : 'Add'} Payment Method
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
