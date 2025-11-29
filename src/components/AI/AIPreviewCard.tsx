import React, { useState, useEffect } from 'react';
import { Check, X, Loader2, FileText, DollarSign, TrendingUp, Calendar, User, Tag, Building2, FileEdit, Receipt, AlertCircle } from 'lucide-react';
import { confirmPendingAction, cancelPendingAction } from '../../services/ai/pendingActionsService';
import { executePendingAction } from '../../services/ai/aiTools';
import { getUserSettings } from '../../services/ai/userSettingsService';
import { useSettings } from '../../contexts/SettingsContext';
import { AILearningService } from '../../services/ai/learningService';

interface AIPreviewCardProps {
  pendingAction: any;
  onUpdate: (action: 'confirmed' | 'cancelled', actionType?: string) => void;
  conversationId: string;
  userId: string;
}

export const AIPreviewCard: React.FC<AIPreviewCardProps> = ({
  pendingAction,
  onUpdate,
  conversationId,
  userId,
}) => {
  const { exchangeRates, baseCurrency: settingsBaseCurrency } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<string>(settingsBaseCurrency || 'USD');

  // Load base currency from user settings
  useEffect(() => {
    const loadBaseCurrency = async () => {
      try {
        const userSettings = await getUserSettings(userId);
        if (userSettings.base_currency) {
          setBaseCurrency(userSettings.base_currency);
        }
      } catch (error) {
        console.error('Error loading base currency:', error);
      }
    };
    loadBaseCurrency();
  }, [userId]);

  const getActionIcon = () => {
    switch (pendingAction.action_type) {
      case 'invoice':
        return <FileText className="h-5 w-5" />;
      case 'expense':
        return <DollarSign className="h-5 w-5" />;
      case 'income':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getActionTitle = () => {
    switch (pendingAction.action_type) {
      case 'invoice':
        return 'Create Invoice';
      case 'expense':
        return 'Create Expense';
      case 'income':
        return 'Record Income';
      default:
        return 'Confirm Action';
    }
  };

  const getCurrencySymbol = (currency: string = 'USD') => {
    const currencyMap: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'PKR': '₨',
      'INR': '₹',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
    };
    return currencyMap[currency.toUpperCase()] || currency.toUpperCase();
  };

  const formatActionData = () => {
    const data = pendingAction.action_data;
    // Use currency from action_data, or fall back to base currency instead of hardcoded USD
    const currency = data.currency || baseCurrency;
    const currencySymbol = getCurrencySymbol(currency);
    
    switch (pendingAction.action_type) {
      case 'invoice':
        const subtotal = data.items?.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0) || 0;
        const tax = subtotal * (data.tax_rate || 0) / 100;
        const total = subtotal + tax;
        return (
          <div className="space-y-4">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Client</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{data.client_name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Invoice Date</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(data.date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Due Date</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(data.due_date).toLocaleDateString()}</p>
                </div>
              </div>
              {data.income_category_name && (
                <div className="flex items-start gap-2">
                  <Tag className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Category</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{data.income_category_name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Invoice Items */}
            {data.items && data.items.length > 0 && (
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Items</p>
                <div className="space-y-2">
                  {data.items.map((item: any, idx: number) => {
                    const itemTotal = (item.quantity || 0) * (item.rate || 0);
                    return (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-medium text-gray-900 flex-1">{item.description || 'Item'}</p>
                          <p className="text-sm font-semibold text-gray-900 ml-2">{currencySymbol}{itemTotal.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>Qty: {item.quantity || 0}</span>
                          <span>×</span>
                          <span>Rate: {currencySymbol}{item.rate || 0}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {data.notes && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-start gap-2">
                  <FileEdit className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.notes}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-200 pt-3 space-y-2 bg-gray-50 rounded-lg p-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              {data.tax_rate && data.tax_rate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({data.tax_rate}%)</span>
                  <span className="font-medium text-gray-900">{currencySymbol}{tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-lg text-gray-900">{currencySymbol}{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );
      
      case 'expense':
        return (
          <div className="space-y-4">
            {/* Amount - Highlighted */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border border-red-100">
              <p className="text-xs text-gray-500 mb-1">Amount</p>
              <p className="text-2xl font-bold text-red-600">{currencySymbol}{data.amount?.toFixed(2) || '0.00'}</p>
            </div>

            {/* Details Grid */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Receipt className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Description</p>
                  <p className="text-sm font-medium text-gray-900">{data.description || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Date</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(data.date).toLocaleDateString()}</p>
                  </div>
                </div>

                {data.category_name && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">Category</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{data.category_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {data.vendor && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Vendor</p>
                    <p className="text-sm font-medium text-gray-900">{data.vendor}</p>
                  </div>
                </div>
              )}

              {data.project_id && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Project</p>
                    <p className="text-sm font-medium text-gray-900">{data.project_id}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'income':
        return (
          <div className="space-y-4">
            {/* Amount - Highlighted */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
              <p className="text-xs text-gray-500 mb-1">Amount</p>
              <p className="text-2xl font-bold text-green-600">{currencySymbol}{data.amount?.toFixed(2) || '0.00'}</p>
            </div>

            {/* Details Grid */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Receipt className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Description</p>
                  <p className="text-sm font-medium text-gray-900">{data.description || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Date</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(data.date).toLocaleDateString()}</p>
                  </div>
                </div>

                {data.category_name && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">Category</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{data.category_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {data.client_name && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Client</p>
                    <p className="text-sm font-medium text-gray-900">
                      {data.client_name}
                      {data.client_company_name && (
                        <span className="text-gray-600"> ({data.client_company_name})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {data.reference_number && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Reference Number</p>
                    <p className="text-sm font-medium text-gray-900">{data.reference_number}</p>
                  </div>
                </div>
              )}

              {data.tax_rate && data.tax_rate > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Tax Rate</span>
                    <span className="text-sm font-semibold text-blue-700">{data.tax_rate}%</span>
                  </div>
                  {data.tax_amount && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-600">Tax Amount</span>
                      <span className="text-sm font-semibold text-blue-700">{currencySymbol}{data.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return (
          <div className="bg-gray-50 rounded-lg p-3">
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Confirm the pending action
      await confirmPendingAction(pendingAction.id);

      console.log('[AIPreviewCard] Executing action with', Object.keys(exchangeRates).length, 'exchange rates');

      // Execute the action with cached exchange rates
      const result = await executePendingAction(userId, pendingAction, exchangeRates);

      if (!result.success) {
        throw new Error(result.error || 'Failed to execute action');
      }

      // Log user confirmation for AI learning
      await AILearningService.logInteraction({
        user_id: userId,
        interaction_type: 'confirmation',
        query_text: `Create ${pendingAction.action_type}`,
        entity_type: pendingAction.action_type,
        entity_id: result.result?.id, // ID of created entity
        ai_suggested_value: pendingAction.action_data,
        user_chosen_value: pendingAction.action_data, // Same as suggested since user confirmed
        context_data: {
          conversation_id: conversationId,
          client_id: pendingAction.action_data?.client_id,
          client_name: pendingAction.action_data?.client_name,
          vendor: pendingAction.action_data?.vendor_name,
          category_id: pendingAction.action_data?.category_id,
          category_name: pendingAction.action_data?.category_name,
        }
      });

      // Trigger pattern analysis if needed (runs max once per 24h)
      AILearningService.maybeAnalyzePatterns(userId).catch(err =>
        console.error('[AI Learning] Pattern analysis failed:', err)
      );

      // Notify parent to refresh with success
      onUpdate('confirmed', getActionTitle().toLowerCase());
    } catch (err: any) {
      setError(err.message || 'Failed to create record. Please try again.');
      console.error('Error confirming action:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Log user rejection for AI learning
      await AILearningService.logInteraction({
        user_id: userId,
        interaction_type: 'rejection',
        query_text: `Create ${pendingAction.action_type}`,
        entity_type: pendingAction.action_type,
        ai_suggested_value: pendingAction.action_data,
        context_data: {
          conversation_id: conversationId,
          reason: 'user_cancelled'
        }
      });

      await cancelPendingAction(pendingAction.id);
      onUpdate('cancelled', getActionTitle().toLowerCase());
    } catch (err: any) {
      setError(err.message || 'Failed to cancel action. Please try again.');
      console.error('Error cancelling action:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 via-purple-50/30 to-indigo-50/30 rounded-xl p-4 border border-gray-200/50 shadow-sm w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 pb-3 border-b border-gray-200/50">
        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-md flex-shrink-0">
          {getActionIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-base">{getActionTitle()}</h4>
          <p className="text-xs text-gray-500 mt-0.5">Review the details below before confirming</p>
        </div>
      </div>

      {/* Preview Content */}
      <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200/50 shadow-sm max-w-full overflow-hidden">
        {formatActionData()}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1 break-words">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 w-full min-w-0">
        <button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="flex-1 min-w-0 px-3 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-medium shadow-sm hover:shadow-md text-xs sm:text-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
              <span className="truncate">Creating...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Confirm & Create</span>
            </>
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={isProcessing}
          className="px-2.5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border border-gray-200 flex-shrink-0"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
